import asyncio
import random
from types import SimpleNamespace

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
            "original": f"https://cdn.jsdelivr.net/gh/x@v2.7.1/logos/original/{s}.jpg",
            "localThumb": f"./thumb/{s}.png",
            "localOptimized": f"./optimized/{s}.png",
            "localOriginal": f"./original/{s}.jpg",
        },
    }
    for n, s in [("Mercedes-Benz", "mercedes-benz"), ("Skoda", "skoda"), ("Smart", "smart"), ("Merkur", "merkur")]
]
JSDELIVR = "https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@v2.7.1/logos"


class Env(SimpleNamespace):
    pass


def make_client(env=None):
    """TestClient with data injected (no network) and an optional Workers env in the ASGI scope."""
    api.app.dependency_overrides[api.get_logos] = lambda: LOGOS

    async def asgi(scope, receive, send):
        if env is not None:
            scope = {**scope, "env": env}
        await api.app(scope, receive, send)

    return TestClient(asgi, raise_server_exceptions=False)


@pytest.fixture
def client():
    yield make_client()
    api.app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clean():
    api._memo.clear()
    yield
    api.app.dependency_overrides.clear()


def assert_error(r, status, code):
    assert r.status_code == status, r.text
    body = r.json()
    assert set(body) == {"error"} and body["error"]["code"] == code and body["error"]["message"]


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


def test_image_base_default_and_r2():
    assert logic.image_base(None, "2.7.1") == JSDELIVR
    assert logic.image_base("https://img.harborix.com/v{version}/", "v2.7.1") == "https://img.harborix.com/v2.7.1"


def test_brand_urls_from_base_and_drops_local_paths():
    b = logic.brand(LOGOS[1], "https://img.harborix.com/v2.7.1")
    assert b["image"] == {
        "thumb": "https://img.harborix.com/v2.7.1/thumb/skoda.png",
        "optimized": "https://img.harborix.com/v2.7.1/optimized/skoda.png",
        "original": "https://img.harborix.com/v2.7.1/original/skoda.jpg",
        "source": "https://www.carlogos.org/logo/skoda.png",
    }
    assert logic.brand(LOGOS[1])["image"]["thumb"] == LOGOS[1]["image"]["thumb"]


def test_page_limit_offset():
    p = logic.page(LOGOS, 2, 1)
    assert p["total"] == 4 and [b["slug"] for b in p["items"]] == ["skoda", "smart"]
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
    assert len(logic.pick(LOGOS, 3, rng=rng)) == 3
    assert len(logic.pick(LOGOS, 99, rng=rng)) == 4  # never more than the dataset
    assert len(logic.pick(LOGOS, 0, rng=rng)) == 1


# --- data loading: timeout, stale on error ---


def test_load_caches_and_serves_stale_on_error(monkeypatch):
    calls = []

    async def ok(url):
        calls.append(url)
        return LOGOS

    async def broken(url):
        raise api.UpstreamError("boom")

    monkeypatch.setattr(api, "fetch_json", ok)
    assert asyncio.run(api.load("2.7.1", 1000.0)) == LOGOS
    assert asyncio.run(api.load("2.7.1", 1001.0)) == LOGOS and len(calls) == 1  # memo hit
    monkeypatch.setattr(api, "fetch_json", broken)
    later = 1000.0 + api.TTL_SECONDS + 1
    assert asyncio.run(api.load("2.7.1", later)) == LOGOS  # stale copy, not an error
    assert api._memo["at"] == later - api.TTL_SECONDS + api.RETRY_SECONDS


def test_load_times_out(monkeypatch):
    async def slow(url):
        await asyncio.sleep(10)

    monkeypatch.setattr(api, "fetch_json", slow)
    monkeypatch.setattr(api, "FETCH_TIMEOUT_SECONDS", 0.05)
    with pytest.raises(api.UpstreamError):
        asyncio.run(api.load("2.7.1", 1000.0))


def test_upstream_failure_without_copy_is_502(monkeypatch):
    async def boom(url):
        raise api.UpstreamError("data.json returned 404")

    monkeypatch.setattr(api, "fetch_json", boom)
    r = TestClient(api.app).get("/brands")
    assert_error(r, 502, "upstream_unavailable")
    assert r.headers["cache-control"] == "no-store"


def test_non_list_upstream_is_502(monkeypatch):
    async def weird(url):
        return {"not": "a list"}

    monkeypatch.setattr(api, "fetch_json", weird)
    assert_error(TestClient(api.app).get("/brands"), 502, "upstream_unavailable")


# --- routes ---


def test_every_response_has_headers(client):
    for path in ["/", "/brands", "/brands/nope", "/search?q=sk", "/random", "/robots.txt", "/llms.txt",
                 "/llms-full.txt", "/docs", "/openapi.json", "/no-such-route"]:
        r = client.get(path)
        assert r.headers["x-robots-tag"] == "noindex, nofollow", path
        assert r.headers["access-control-allow-origin"] == "*", path
        assert r.headers["x-content-type-options"] == "nosniff", path
        assert r.headers["referrer-policy"] == "no-referrer", path
        want = "no-store" if path == "/random" else "public, max-age=86400"
        assert r.headers["cache-control"] == want, path
        csp = r.headers["content-security-policy"]
        assert ("cdn.jsdelivr.net" in csp) == (path == "/docs"), path
        assert "frame-ancestors 'none'" in csp


def test_index_links_and_source(client):
    body = client.get("/").json()
    assert body["brands"] == 4 and body["image_base"] == JSDELIVR
    assert body["links"]["data_json"].endswith("@v2.7.1/logos/data.json")
    assert "carlogos.org" in body["source"]


def test_brands_default_page_and_paging(client):
    body = client.get("/brands").json()
    assert body["total"] == 4 and body["limit"] == 50 and body["offset"] == 0
    assert set(body["items"][0]) == {"name", "slug", "image"}
    assert [b["slug"] for b in client.get("/brands?limit=1&offset=1").json()["items"]] == ["skoda"]


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "limit=x", "offset=-1", "offset=10001"])
def test_brands_param_bounds(client, query):
    assert_error(client.get(f"/brands?{query}"), 422, "invalid_request")


def test_brand_by_slug_and_404(client):
    assert client.get("/brands/skoda").json()["name"] == "Skoda"
    assert_error(client.get("/brands/nope"), 404, "not_found")


@pytest.mark.parametrize("slug", ["Skoda", "sk_oda", "a" * 65, "sk%20oda"])
def test_brand_slug_pattern(client, slug):
    assert_error(client.get(f"/brands/{slug}"), 422, "invalid_request")


def test_search_route_strips_query(client):
    body = client.get("/search?q=%20Mer%20").json()
    assert body["query"] == "Mer" and body["count"] == 2


@pytest.mark.parametrize("query", ["", "q=", "q=%20%20", "q=" + "a" * 65])
def test_search_param_bounds(client, query):
    assert_error(client.get(f"/search?{query}"), 422, "invalid_request")


def test_random_route(client):
    assert len(client.get("/random").json()["items"]) == 1
    assert len(client.get("/random?count=3").json()["items"]) == 3


@pytest.mark.parametrize("query", ["count=0", "count=21", "count=x"])
def test_random_param_bounds(client, query):
    assert_error(client.get(f"/random?{query}"), 422, "invalid_request")


def test_image_base_from_env():
    c = make_client(Env(IMAGE_BASE="https://img.harborix.com/v{version}", DATA_VERSION="2.7.1"))
    assert c.get("/brands/skoda").json()["image"]["thumb"] == "https://img.harborix.com/v2.7.1/thumb/skoda.png"


def test_unknown_route_is_404_json(client):
    assert_error(client.get("/nope"), 404, "not_found")


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
def test_only_get_head_options(client, method):
    r = client.request(method, "/brands")
    assert_error(r, 405, "method_not_allowed")
    assert r.headers["allow"] == "GET, HEAD, OPTIONS"


def test_head_has_headers_no_body(client):
    r = client.head("/brands/skoda")
    assert r.status_code == 200 and r.content == b""
    assert r.headers["x-robots-tag"] == "noindex, nofollow"


def test_options_preflight(client):
    r = client.options("/brands", headers={"Origin": "https://example.com", "Access-Control-Request-Method": "GET"})
    assert r.status_code == 204
    assert r.headers["access-control-allow-origin"] == "*"
    assert "GET" in r.headers["access-control-allow-methods"]


def test_query_over_1kb_rejected(client):
    assert_error(client.get("/search?q=a&pad=" + "x" * 1100), 414, "query_too_long")


def test_rate_limit_429():
    seen = []

    class Limiter:
        async def limit(self, opts):
            seen.append(opts["key"])
            return SimpleNamespace(success=False)

    r = make_client(Env(RATE_LIMITER=Limiter())).get("/brands", headers={"CF-Connecting-IP": "203.0.113.9"})
    assert_error(r, 429, "rate_limited")
    assert r.headers["retry-after"] == "60" and seen == ["203.0.113.9"]
    assert r.headers["cache-control"] == "no-store"


def test_rate_limit_allows_and_survives_broken_limiter():
    class Ok:
        async def limit(self, opts):
            return SimpleNamespace(success=True)

    class Broken:
        async def limit(self, opts):
            raise RuntimeError("binding down")

    assert make_client(Env(RATE_LIMITER=Ok())).get("/brands").status_code == 200
    assert make_client(Env(RATE_LIMITER=Broken())).get("/brands").status_code == 200


def test_crash_is_500_json_without_trace(client):
    def explode():
        raise RuntimeError("secret internals")

    api.app.dependency_overrides[api.get_logos] = explode
    r = client.get("/brands")
    assert_error(r, 500, "internal_error")
    assert r.headers["cache-control"] == "no-store"
    assert "secret" not in r.text and "Traceback" not in r.text


def test_openapi_has_response_models(client):
    spec = client.get("/openapi.json").json()
    for path in ["/", "/brands", "/brands/{slug}", "/search", "/random"]:
        ok = spec["paths"][path]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
        assert "$ref" in ok, path
    assert {"limit", "offset"} <= {p["name"] for p in spec["paths"]["/brands"]["get"]["parameters"]}


def test_robots(client):
    assert client.get("/robots.txt").text == "User-agent: *\nDisallow: /\n"


def test_images_are_never_proxied(client):
    for b in client.get("/brands").json()["items"]:
        assert all(u.startswith("https://") for u in b["image"].values())


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
