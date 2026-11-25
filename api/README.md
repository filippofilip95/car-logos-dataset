# Car Logos Dataset API

A small read-only JSON API over `logos/data.json`, as a [Cloudflare Python Worker](https://developers.cloudflare.com/workers/languages/python/) with FastAPI. It fetches `data.json` from jsDelivr pinned to `DATA_VERSION` (in `wrangler.jsonc`), keeps it in memory for an hour, and returns image URLs that point to jsDelivr. Images are never proxied.

| Endpoint | Returns |
|---|---|
| `GET /` | index with links and the source attribution |
| `GET /brands?limit=&offset=` | `{total, offset, limit, items}`; `limit` 1 to 500, all when omitted |
| `GET /brands/{slug}` | one brand, or 404 `{"error": "not found"}` |
| `GET /search?q=` | case-insensitive match on name or slug, at most 50 |
| `GET /random?count=` | 1 to 20 random brands |
| `GET /docs`, `GET /openapi.json` | FastAPI docs |
| `GET /llms.txt`, `GET /llms-full.txt` | [llms.txt](https://llmstxt.org/) summary and endpoint reference |
| `GET /robots.txt` | `Disallow: /` |

Every response carries `X-Robots-Tag: noindex, nofollow`, `Access-Control-Allow-Origin: *` and `Cache-Control: public, max-age=86400` (`/random`: `no-store`).

## Develop

Needs [uv](https://docs.astral.sh/uv/) and Node.

```bash
cd api
uv run pytest                                   # routing and filter tests, no network
uv run pywrangler dev                           # http://localhost:8787
uv run pywrangler dev --var DATA_VERSION:2.7.0  # against another release tag
```

Code: `src/entry.py` (Worker entrypoint, ASGI bridge), `src/app.py` (FastAPI routes, headers, data.json memo), `src/logic.py` (pure functions).

## Deploy

```bash
cd api
uv run pywrangler deploy
```

The first deploy asks you to log in to Cloudflare. No secrets are needed. On the Workers free plan the limit is 100,000 requests a day. After a dataset release, bump `DATA_VERSION` in `wrangler.jsonc` and deploy again.
