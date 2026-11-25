"""FastAPI app: routes and headers. The Worker entrypoint is in entry.py."""

import json
import time

from fastapi import Depends, FastAPI, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse

import logic

DEFAULT_VERSION = "2.7.1"
TTL_SECONDS = 3600
HEADERS = {
    "X-Robots-Tag": "noindex, nofollow",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Cache-Control": "public, max-age=86400",
}

app = FastAPI(
    title="Car Logos Dataset API",
    description="Read-only JSON over https://github.com/filippofilip95/car-logos-dataset. Image URLs point to jsDelivr.",
    version="1.0.0",
)

# Module-level memo: one isolate keeps data.json for TTL_SECONDS.
# ponytail: per isolate only; a cold isolate refetches from jsDelivr. Cache API if that ever matters.
_memo: dict = {}


class UpstreamError(Exception):
    pass


async def fetch_json(url: str):
    from workers import fetch  # only exists inside the Workers runtime

    resp = await fetch(url)
    if resp.status != 200:
        raise UpstreamError(f"{url} returned {resp.status}")
    return json.loads(await resp.text())


def data_version(request: Request) -> str:
    env = request.scope.get("env")
    return str(getattr(env, "DATA_VERSION", None) or DEFAULT_VERSION).lstrip("v")


async def get_logos(request: Request) -> list:
    version = data_version(request)
    now = time.time()
    if not logic.is_fresh(_memo, version, now, TTL_SECONDS):
        _memo.update(version=version, at=now, logos=await fetch_json(logic.data_url(version)))
    return _memo["logos"]


@app.middleware("http")
async def common_headers(request: Request, call_next):
    resp = await call_next(request)
    for k, v in HEADERS.items():
        resp.headers[k] = v
    if request.url.path == "/random":  # a cached pick would repeat for a day
        resp.headers["Cache-Control"] = "no-store"
    return resp


@app.exception_handler(UpstreamError)
async def upstream_error(request: Request, exc: UpstreamError):
    return JSONResponse({"error": "dataset unavailable", "detail": str(exc)}, status_code=502)


@app.get("/")
async def root(request: Request, logos: list = Depends(get_logos)):
    return logic.index(str(request.base_url), data_version(request), len(logos))


@app.get("/brands")
async def brands(
    limit: int | None = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
    logos: list = Depends(get_logos),
):
    return logic.page(logos, limit, offset)


@app.get("/brands/{slug}")
async def brand(slug: str, logos: list = Depends(get_logos)):
    hit = logic.find(logos, slug)
    if hit is None:
        return JSONResponse({"error": "not found", "slug": slug}, status_code=404)
    return hit


@app.get("/search")
async def search(q: str = Query(..., min_length=1, max_length=100), logos: list = Depends(get_logos)):
    items = logic.search(logos, q)
    return {"query": q, "count": len(items), "items": items}


@app.get("/random")
async def random(count: int = Query(1, ge=1, le=logic.RANDOM_MAX), logos: list = Depends(get_logos)):
    return {"items": logic.pick(logos, count)}


@app.get("/llms.txt", include_in_schema=False)
async def llms(request: Request):
    return PlainTextResponse(logic.llms_txt(str(request.base_url), data_version(request)))


@app.get("/llms-full.txt", include_in_schema=False)
async def llms_full(request: Request):
    return PlainTextResponse(logic.llms_full_txt(str(request.base_url), data_version(request)))


@app.get("/robots.txt", include_in_schema=False)
async def robots():
    return PlainTextResponse("User-agent: *\nDisallow: /\n")
