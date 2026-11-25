"""Pure functions behind the API: no network, no runtime imports, tested in tests/."""

import random as _random

REPO = "filippofilip95/car-logos-dataset"
SOURCE = "https://www.carlogos.org/"
SEARCH_MAX = 50
RANDOM_MAX = 20


def data_url(version: str) -> str:
    """jsDelivr URL of data.json pinned to a release tag; accepts `2.7.1` or `v2.7.1`."""
    return f"https://cdn.jsdelivr.net/gh/{REPO}@v{version.strip().lstrip('v')}/logos/data.json"


def is_fresh(entry: dict, version: str, now: float, ttl: float) -> bool:
    """A memo entry is usable when it holds data for this version and is younger than ttl."""
    return entry.get("logos") is not None and entry.get("version") == version and now - entry.get("at", 0) < ttl


DEFAULT_IMAGE_BASE = "https://cdn.jsdelivr.net/gh/" + REPO + "@v{version}/logos"
IMAGE_DIRS = (("thumb", "localThumb"), ("optimized", "localOptimized"), ("original", "localOriginal"))


def image_base(template: str | None, version: str) -> str:
    """IMAGE_BASE with `{version}` filled in: the folder that holds thumb/, optimized/, original/."""
    return (template or DEFAULT_IMAGE_BASE).replace("{version}", version.strip().lstrip("v")).rstrip("/")


def brand(logo: dict, base: str | None = None) -> dict:
    """The public shape of one brand: name, slug and image URLs, with the source link.

    With `base`, image URLs are `<base>/<dir>/<file>` from the local paths in data.json
    (R2 or jsDelivr); without it, the URLs in data.json as they are.
    """
    img = logo.get("image", {})
    out = {}
    for key, local in IMAGE_DIRS:
        rel = (img.get(local) or "").removeprefix("./")
        out[key] = f"{base}/{rel}" if base and rel else img.get(key)
    out["source"] = img.get("source")
    return {"name": logo["name"], "slug": logo["slug"], "image": out}


def page(logos: list, limit: int, offset: int, base: str | None = None) -> dict:
    items = logos[offset : offset + limit]
    return {"total": len(logos), "offset": offset, "limit": limit, "items": [brand(l, base) for l in items]}


def find(logos: list, slug: str, base: str | None = None) -> dict | None:
    slug = slug.lower()
    return next((brand(l, base) for l in logos if l["slug"] == slug), None)


def search(logos: list, q: str, base: str | None = None) -> list:
    """Case-insensitive `contains` on name or slug, at most SEARCH_MAX hits in dataset order."""
    q = q.strip().lower()
    if not q:
        return []
    hits = (l for l in logos if q in l["name"].lower() or q in l["slug"].lower())
    return [brand(l, base) for _, l in zip(range(SEARCH_MAX), hits)]


def pick(logos: list, count: int, base: str | None = None, rng: _random.Random | None = None) -> list:
    count = max(1, min(count, RANDOM_MAX, len(logos)))
    return [brand(l, base) for l in (rng or _random).sample(logos, count)]


def error(code: str, message: str) -> dict:
    """The one error shape of the API."""
    return {"error": {"code": code, "message": message}}


def index(base: str, version: str, total: int, images: str) -> dict:
    base = base.rstrip("/")
    return {
        "name": "Car Logos Dataset API",
        "description": "Read-only JSON API over the car logos dataset. Images are served by a CDN (see image_base), never by this API.",
        "data_version": f"v{version.lstrip('v')}",
        "brands": total,
        "image_base": images,
        "links": {
            "brands": f"{base}/brands?limit=20&offset=0",
            "brand": f"{base}/brands/skoda",
            "search": f"{base}/search?q=mer",
            "random": f"{base}/random?count=3",
            "docs": f"{base}/docs",
            "openapi": f"{base}/openapi.json",
            "data_json": data_url(version),
            "repository": f"https://github.com/{REPO}",
        },
        "source": f"Logos from {SOURCE} and local sources listed in the repository; each brand's image.source links the original.",
        "notice": "Logos are trademarks of their respective owners, for identification only.",
    }


def llms_txt(base: str, version: str) -> str:
    """llms.txt (llmstxt.org): H1, blockquote summary, then sections of links."""
    base = base.rstrip("/")
    v = version.lstrip("v")
    return f"""# Car Logos Dataset API

> Read-only JSON API over a dataset of car manufacturer logos (data release v{v}). Each brand has a name, a slug and image URLs (thumb, optimized, original) served by a CDN (jsDelivr, or the project's R2 domain); this API never serves images.

Logos come from {SOURCE} and a few local sources; each brand's `image.source` links the original. Logos are trademarks of their respective owners, for identification only. Code and metadata are MIT licensed.

## API

- [OpenAPI schema]({base}/openapi.json): machine-readable reference of every endpoint
- [Interactive docs]({base}/docs): Swagger UI
- [List brands]({base}/brands?limit=20&offset=0): paged list, `limit` 1 to 100 (default 50), `offset` 0 to 10000
- [One brand]({base}/brands/skoda): by slug, 404 JSON when missing
- [Search]({base}/search?q=mer): case-insensitive match on name or slug, at most 50
- [Random]({base}/random?count=3): 1 to 20 random brands

## Data

- [data.json on jsDelivr]({data_url(v)}): the whole dataset as one static JSON file, pinned to v{v}
- [GitHub repository](https://github.com/{REPO}): source, README and license

## Optional

- [Full endpoint reference]({base}/llms-full.txt): every endpoint, parameter and response shape
- [carlogos.org]({SOURCE}): main source of the logos
"""


def llms_full_txt(base: str, version: str) -> str:
    base = base.rstrip("/")
    v = version.lstrip("v")
    return f"""# Car Logos Dataset API: endpoint reference

> Read-only JSON over the car logos dataset, data release v{v}. All endpoints answer GET and HEAD (OPTIONS for CORS), return JSON (except the .txt files), send `Access-Control-Allow-Origin: *` and `X-Robots-Tag: noindex, nofollow`, and are cached for a day except `/random` (`no-store`). Rate limit: 60 requests a minute per IP.

A brand looks like:

```json
{{"name": "Škoda", "slug": "skoda", "image": {{"thumb": "https://cdn.jsdelivr.net/gh/{REPO}@v{v}/logos/thumb/skoda.png", "optimized": "...", "original": "...", "source": "https://www.carlogos.org/..."}}}}
```

Image URLs come from the image CDN (jsDelivr or the project's own R2 domain); the API never serves images.

## GET {base}/

Index: data version, brand count, links, source attribution.

## GET {base}/brands

Query: `limit` (1 to 100, default 50), `offset` (0 to 10000). Returns `{{"total", "offset", "limit", "items": [brand]}}`.

## GET {base}/brands/{{slug}}

`slug` matches `^[a-z0-9-]{{1,64}}$`. Returns one brand, or 404 `not_found`.

## GET {base}/search?q=

`q` 1 to 64 characters after trimming. Case-insensitive substring match on name or slug, in dataset order, at most 50. Returns `{{"query", "count", "items": [brand]}}`.

## GET {base}/random?count=

`count` 1 to 20 (default 1). Returns `{{"items": [brand]}}`.

## Errors

Every error is `{{"error": {{"code", "message"}}}}`: 404 `not_found`, 405 `method_not_allowed`, 414 `query_too_long` (query string over 1 KB), 422 `invalid_request`, 429 `rate_limited` (with `Retry-After`), 500 `internal_error`, 502 `upstream_unavailable`.

## Without this API

Fetch {data_url(v)} directly and filter it yourself. Logos are trademarks of their respective owners, for identification only; source {SOURCE}.
"""
