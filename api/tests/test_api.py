import random

import pytest
from fastapi.testclient import TestClient

import app as api
import logic

LOGOS = [
    {
        "name": n,
        "slug": s,
        "image": {
            "source": f"https://www.carlogos.org/logo/{s}.png",
            "thumb": f"https://cdn.jsdelivr.net/gh/x@v2.7.1/logos/thumb/{s}.png",
            "optimized": f"https://cdn.jsdelivr.net/gh/x@v2.7.1/logos/optimized/{s}.png",
            "original": f"https://cdn.jsdelivr.net/gh/x@v2.7.1/logos/original/{s}.png",
            "localThumb": f"./thumb/{s}.png",
            "localOptimized": f"./optimized/{s}.png",
            "localOriginal": f"./original/{s}.png",
        },
    }
    for n, s in [("Mercedes-Benz", "mercedes-benz"), ("Skoda", "skoda"), ("Smart", "smart"), ("Merkur", "merkur")]
]


@pytest.fixture
def client():
    api.app.dependency_overrides[api.get_logos] = lambda: LOGOS
    yield TestClient(api.app)
    api.app.dependency_overrides.clear()


# --- pure functions ---


def test_data_url_pins_tag():
    want = "https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@v2.7.1/logos/data.json"
    assert logic.data_url("2.7.1") == want
    assert logic.data_url("v2.7.1") == want


def test_memo_freshness():
    entry = {"version": "2.7.1", "at": 100.0, "logos": []}
    assert logic.is_fresh(entry, "2.7.1", 150.0, 60)
    assert not logic.is_fresh(entry, "2.7.1", 161.0, 60)
    assert not logic.is_fresh(entry, "2.7.0", 150.0, 60)
    assert not logic.is_fresh({}, "2.7.1", 150.0, 60)


def test_brand_drops_local_paths():
    b = logic.brand(LOGOS[1])
    assert b == {"name": "Skoda", "slug": "skoda", "image": {k: LOGOS[1]["image"][k] for k in ("thumb", "optimized", "original", "source")}}


def test_page_limit_offset():
    p = logic.page(LOGOS, 2, 1)
    assert p["total"] == 4 and [b["slug"] for b in p["items"]] == ["skoda", "smart"]
    assert len(logic.page(LOGOS, None, 0)["items"]) == 4
    assert logic.page(LOGOS, 5, 10)["items"] == []


def test_search_case_insensitive_name_or_slug():
    assert [b["slug"] for b in logic.search(LOGOS, "MER")] == ["mercedes-benz", "merkur"]
    assert [b["slug"] for b in logic.search(LOGOS, "benz")] == ["mercedes-benz"]
    assert logic.search(LOGOS, "  ") == []


def test_search_caps_at_50():
    many = [{"name": f"Brand {i}", "slug": f"brand-{i}", "image": {}} for i in range(80)]
    assert len(logic.search(many, "brand")) == logic.SEARCH_MAX == 50


def test_pick_bounds():
    rng = random.Random(1)
    assert len(logic.pick(LOGOS, 3, rng)) == 3
    assert len(logic.pick(LOGOS, 99, rng)) == 4  # never more than the dataset
    assert len(logic.pick(LOGOS, 0, rng)) == 1


# --- routes (FastAPI TestClient, data injected, no network) ---


def test_every_response_has_headers(client):
    for path in ["/", "/brands", "/brands/nope", "/search?q=sk", "/random", "/robots.txt", "/llms.txt", "/llms-full.txt", "/docs", "/openapi.json"]:
        r = client.get(path)
        assert r.headers["x-robots-tag"] == "noindex, nofollow", path
        assert r.headers["access-control-allow-origin"] == "*", path
        want = "no-store" if path == "/random" else "public, max-age=86400"
        assert r.headers["cache-control"] == want, path


def test_index_links_and_source(client):
    body = client.get("/").json()
    assert body["brands"] == 4
    assert body["links"]["data_json"].endswith("@v2.7.1/logos/data.json")
    assert "carlogos.org" in body["source"]


def test_brands_list_and_paging(client):
    assert client.get("/brands").json()["total"] == 4
    assert [b["slug"] for b in client.get("/brands?limit=1&offset=1").json()["items"]] == ["skoda"]
    assert client.get("/brands?limit=0").status_code == 422


def test_brand_by_slug_and_404(client):
    assert client.get("/brands/skoda").json()["name"] == "Skoda"
    r = client.get("/brands/nope")
    assert r.status_code == 404 and r.json() == {"error": "not found", "slug": "nope"}


def test_search_route(client):
    body = client.get("/search?q=Mer").json()
    assert body["count"] == 2
    assert client.get("/search").status_code == 422


def test_random_route(client):
    assert len(client.get("/random?count=3").json()["items"]) == 3
    assert client.get("/random?count=21").status_code == 422


def test_robots(client):
    r = client.get("/robots.txt")
    assert r.text == "User-agent: *\nDisallow: /\n"


def test_images_are_never_proxied(client):
    for b in client.get("/brands").json()["items"]:
        assert all(u.startswith("https://") for u in b["image"].values())


def test_only_get(client):
    assert client.post("/brands").status_code == 405


def test_upstream_failure_is_json_502(monkeypatch):
    async def boom(url):
        raise api.UpstreamError(f"{url} returned 404")

    monkeypatch.setattr(api, "fetch_json", boom)
    api._memo.clear()
    r = TestClient(api.app).get("/brands")
    assert r.status_code == 502 and r.json()["error"] == "dataset unavailable"


def test_llms_txt(client):
    r = client.get("/llms.txt")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/plain")
    lines = r.text.splitlines()
    assert lines[0] == "# Car Logos Dataset API" and lines[2].startswith("> ")
    for want in ["/docs)", "/openapi.json)", "/brands?", "/search?q=", "/random?", "@v2.7.1/logos/data.json)",
                 "github.com/filippofilip95/car-logos-dataset)", "carlogos.org", "trademarks"]:
        assert want in r.text, want
    assert "## API" in r.text and "## Optional" in r.text


def test_llms_full_txt(client):
    r = client.get("/llms-full.txt")
    assert r.status_code == 200 and r.text.startswith("# ")
    for path in ["/brands", "/brands/{slug}", "/search?q=", "/random?count="]:
        assert f"## GET http://testserver{path}" in r.text, path
