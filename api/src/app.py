"""FastAPI app: models, routes, guard middleware. The Worker entrypoint is in entry.py."""

import asyncio
import json
import time
from typing import Annotated

from fastapi import Depends, FastAPI, Path, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field, StringConstraints
from starlette.exceptions import HTTPException as StarletteHTTPException

import logic

DEFAULT_VERSION = "2.7.1"
TTL_SECONDS = 3600  # how long one copy of data.json is used
RETRY_SECONDS = 60  # after a failed refresh, serve the stale copy this long before trying again
FETCH_TIMEOUT_SECONDS = 5
MAX_QUERY_BYTES = 1024
ALLOWED_METHODS = ("GET", "HEAD", "OPTIONS")

HEADERS = {
    "x-robots-tag": "noindex, nofollow",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": ", ".join(ALLOWED_METHODS),
    "cache-control": "public, max-age=86400",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
}
# FastAPI's /docs page: Swagger UI from jsDelivr, one inline script, the favicon, and /openapi.json.
DOCS_CSP = (
    "default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src https://cdn.jsdelivr.net; img-src https://fastapi.tiangolo.com data:; "
    "connect-src 'self'; frame-ancestors 'none'"
)
NO_STORE = ("/random",)


# --- models ---


class Image(BaseModel):
    thumb: str | None
    optimized: str | None
    original: str | None
    source: str | None


class Brand(BaseModel):
    name: str
    slug: str
    wikidataId: str | None = Field(None, description="Wikidata item, e.g. Q29637 (CC0)", examples=["Q29637"])
    country: str | None = Field(None, description="ISO 3166-1 alpha-2 country of origin, from Wikidata", examples=["CZ"])
    founded: int | None = Field(None, description="Year founded (Wikidata inception)", examples=[1895])
    nhtsaMakeId: int | None = Field(None, description="NHTSA vPIC Make_ID", examples=[448])
    image: Image


class BrandPage(BaseModel):
    total: int
    offset: int
    limit: int
    items: list[Brand]


class SearchResult(BaseModel):
    query: str
    count: int
    items: list[Brand]


class RandomResult(BaseModel):
    items: list[Brand]


class Index(BaseModel):
    name: str
    description: str
    data_version: str
    brands: int
    image_base: str
    links: dict[str, str]
    source: str
    notice: str


class ErrorDetail(BaseModel):
    code: str
    message: str


class Error(BaseModel):
    error: ErrorDetail


class PageParams(BaseModel):
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0, le=10000)
    country: str | None = Field(None, pattern=r"^[A-Z]{2}$", description="ISO 3166-1 alpha-2, e.g. DE")


class SearchParams(BaseModel):
    q: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]


class RandomParams(BaseModel):
    count: int = Field(1, ge=1, le=logic.RANDOM_MAX)


Slug = Annotated[str, Path(pattern=r"^[a-z0-9-]{1,64}$")]
ERRORS = {422: {"model": Error}, 429: {"model": Error}, 502: {"model": Error}}

app = FastAPI(
    title="Car Logos Dataset API",
    description="Read-only JSON over https://github.com/filippofilip95/car-logos-dataset. Image URLs point to the image CDN.",
    version="1.0.0",
)


# --- data ---

# Module-level memo: one isolate keeps data.json for TTL_SECONDS, and keeps the last good copy
# when a refresh fails. ponytail: per isolate only; a cold isolate refetches. Cache API if that ever matters.
_memo: dict = {}


class UpstreamError(Exception):
    pass


async def fetch_json(url: str):
    from workers import fetch  # only exists inside the Workers runtime

    resp = await fetch(url)
    if resp.status != 200:
        raise UpstreamError(f"data.json returned {resp.status}")
    return json.loads(await resp.text())


def env_of(request: Request):
    return request.scope.get("env")


def data_version(request: Request) -> str:
    return str(getattr(env_of(request), "DATA_VERSION", None) or DEFAULT_VERSION).lstrip("v")


def images(request: Request) -> str:
    return logic.image_base(getattr(env_of(request), "IMAGE_BASE", None), data_version(request))


async def load(version: str, now: float) -> list:
    if logic.is_fresh(_memo, version, now, TTL_SECONDS):
        return _memo["logos"]
    try:
        logos = await asyncio.wait_for(fetch_json(logic.data_url(version)), FETCH_TIMEOUT_SECONDS)
        if not isinstance(logos, list):
            raise UpstreamError("data.json is not a list")
    except Exception as exc:
        if _memo.get("logos") is None:
            raise UpstreamError(str(exc) or type(exc).__name__) from None
        _memo["at"] = now - TTL_SECONDS + RETRY_SECONDS  # stale on error, retry soon
        return _memo["logos"]
    _memo.update(version=version, at=now, logos=logos)
    return logos


async def get_logos(request: Request) -> list:
    return await load(data_version(request), time.time())


# --- errors: one shape, {"error": {"code", "message"}} ---


def fail(status: int, code: str, message: str, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(logic.error(code, message), status_code=status, headers=headers)


@app.exception_handler(RequestValidationError)
async def invalid(request: Request, exc: RequestValidationError):
    parts = []
    for e in exc.errors():
        where = ".".join(str(x) for x in e.get("loc", ())[1:]) or "request"
        parts.append(f"{where}: {e.get('msg', 'invalid')}")
    return fail(422, "invalid_request", "; ".join(parts))


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    codes = {404: "not_found", 405: "method_not_allowed"}
    return fail(exc.status_code, codes.get(exc.status_code, "http_error"), str(exc.detail))


@app.exception_handler(UpstreamError)
async def upstream_error(request: Request, exc: UpstreamError):
    return fail(502, "upstream_unavailable", "The dataset could not be loaded, try again later.")


# --- guard: methods, query size, rate limit, headers, HEAD, last-resort 500 ---


def client_key(scope) -> str:
    for k, v in scope.get("headers", []):
        if k == b"cf-connecting-ip":
            return v.decode("latin-1")
    return (scope.get("client") or ("unknown",))[0]


def _js(obj: dict):
    try:
        import js
        from pyodide.ffi import to_js

        return to_js(obj, dict_converter=js.Object.fromEntries)
    except ImportError:  # outside the Workers runtime (tests)
        return obj


async def rate_limited(env, key: str) -> bool:
    limiter = getattr(env, "RATE_LIMITER", None)
    if limiter is None:
        return False
    try:
        outcome = await limiter.limit(_js({"key": key}))
    except Exception:
        return False  # a broken limiter never takes the API down
    return not getattr(outcome, "success", True)


class Guard:
    """Raw ASGI middleware, outermost inside FastAPI, so it also wraps 404/405 and crashes."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path, method = scope.get("path", ""), scope.get("method", "GET")
        extra = dict(HEADERS)
        if path.startswith("/docs"):
            extra["content-security-policy"] = DOCS_CSP
        if path in NO_STORE:
            extra["cache-control"] = "no-store"
        started = False

        async def send_with_headers(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
                out = dict(extra)
                if message["status"] == 429 or message["status"] >= 500:
                    out["cache-control"] = "no-store"  # never cache a throttle or an outage
                headers = [(k, v) for k, v in message.get("headers", []) if k.decode("latin-1").lower() not in out]
                headers += [(k.encode(), v.encode()) for k, v in out.items()]
                message = {**message, "headers": headers}
            elif message["type"] == "http.response.body" and method == "HEAD":
                message = {**message, "body": b""}
            await send(message)

        async def reply(resp):
            await resp(scope, receive, send_with_headers)

        if method not in ALLOWED_METHODS:
            return await reply(fail(405, "method_not_allowed", f"{method} is not allowed", {"allow": ", ".join(ALLOWED_METHODS)}))
        if len(scope.get("query_string", b"")) > MAX_QUERY_BYTES:
            return await reply(fail(414, "query_too_long", f"Query string over {MAX_QUERY_BYTES} bytes"))
        if method == "OPTIONS":
            return await reply(PlainTextResponse("", status_code=204, headers={"access-control-max-age": "86400"}))
        if await rate_limited(scope.get("env"), client_key(scope)):
            return await reply(fail(429, "rate_limited", "Too many requests, slow down.", {"retry-after": "60"}))
        inner = {**scope, "method": "GET"} if method == "HEAD" else scope
        try:
            await self.app(inner, receive, send_with_headers)
        except Exception:
            if started:
                raise
            await reply(fail(500, "internal_error", "Internal server error"))


app.add_middleware(Guard)


# --- routes ---


@app.get("/", response_model=Index, responses=ERRORS)
async def root(request: Request, logos: list = Depends(get_logos)):
    return logic.index(str(request.base_url), data_version(request), len(logos), images(request))


@app.get("/brands", response_model=BrandPage, responses=ERRORS)
async def brands(request: Request, params: Annotated[PageParams, Query()], logos: list = Depends(get_logos)):
    return logic.page(logos, params.limit, params.offset, images(request), params.country)


@app.get("/brands/{slug}", response_model=Brand, responses={404: {"model": Error}, **ERRORS})
async def brand(request: Request, slug: Slug, logos: list = Depends(get_logos)):
    hit = logic.find(logos, slug, images(request))
    if hit is None:
        return fail(404, "not_found", f"No brand with slug '{slug}'")
    return hit


@app.get("/search", response_model=SearchResult, responses=ERRORS)
async def search(request: Request, params: Annotated[SearchParams, Query()], logos: list = Depends(get_logos)):
    items = logic.search(logos, params.q, images(request))
    return {"query": params.q, "count": len(items), "items": items}


@app.get("/random", response_model=RandomResult, responses=ERRORS)
async def random(request: Request, params: Annotated[RandomParams, Query()], logos: list = Depends(get_logos)):
    return {"items": logic.pick(logos, params.count, images(request))}


@app.get("/llms.txt", response_class=PlainTextResponse, include_in_schema=False)
async def llms(request: Request):
    return PlainTextResponse(logic.llms_txt(str(request.base_url), data_version(request)))


@app.get("/llms-full.txt", response_class=PlainTextResponse, include_in_schema=False)
async def llms_full(request: Request):
    return PlainTextResponse(logic.llms_full_txt(str(request.base_url), data_version(request)))


@app.get("/robots.txt", response_class=PlainTextResponse, include_in_schema=False)
async def robots():
    return PlainTextResponse("User-agent: *\nDisallow: /\n")
