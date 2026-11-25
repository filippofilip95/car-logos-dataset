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


def brand(logo: dict) -> dict:
    """The public shape of one brand: name, slug and image URLs (jsDelivr), with the source link."""
    img = logo.get("image", {})
    return {
        "name": logo["name"],
        "slug": logo["slug"],
        "image": {k: img.get(k) for k in ("thumb", "optimized", "original", "source")},
    }


def page(logos: list, limit: int | None, offset: int) -> dict:
    items = logos[offset:] if limit is None else logos[offset : offset + limit]
    return {"total": len(logos), "offset": offset, "limit": limit, "items": [brand(l) for l in items]}


def find(logos: list, slug: str) -> dict | None:
    slug = slug.lower()
    return next((brand(l) for l in logos if l["slug"] == slug), None)


def search(logos: list, q: str) -> list:
    """Case-insensitive `contains` on name or slug, at most SEARCH_MAX hits in dataset order."""
    q = q.strip().lower()
    if not q:
        return []
    hits = (l for l in logos if q in l["name"].lower() or q in l["slug"].lower())
    return [brand(l) for _, l in zip(range(SEARCH_MAX), hits)]


def pick(logos: list, count: int, rng: _random.Random | None = None) -> list:
    count = max(1, min(count, RANDOM_MAX, len(logos)))
    return [brand(l) for l in (rng or _random).sample(logos, count)]


def index(base: str, version: str, total: int) -> dict:
    base = base.rstrip("/")
    return {
        "name": "Car Logos Dataset API",
        "description": "Read-only JSON API over the car logos dataset. Images are served by jsDelivr, never by this API.",
        "data_version": f"v{version.lstrip('v')}",
        "brands": total,
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
