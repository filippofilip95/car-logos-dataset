# Car Logos Dataset API

A small read-only JSON API over `logos/data.json`, as a [Cloudflare Python Worker](https://developers.cloudflare.com/workers/languages/python/) with FastAPI. It fetches `data.json` from jsDelivr pinned to `DATA_VERSION` (in `wrangler.jsonc`), keeps it in memory for an hour (and keeps the last good copy when a refresh fails), and returns image URLs built from `IMAGE_BASE`. Images are never proxied.

| Endpoint | Returns |
|---|---|
| `GET /` | index with links, image base and the source attribution |
| `GET /brands?limit=&offset=` | `{total, offset, limit, items}`; `limit` 1 to 100 (default 50), `offset` 0 to 10000 |
| `GET /brands/{slug}` | one brand; `slug` matches `^[a-z0-9-]{1,64}$`; 404 when missing |
| `GET /search?q=` | `q` 1 to 64 characters (trimmed); case-insensitive match on name or slug, at most 50 |
| `GET /random?count=` | 1 to 20 random brands (default 1) |
| `GET /docs`, `GET /openapi.json` | FastAPI docs and schema (response models on every route) |
| `GET /llms.txt`, `GET /llms-full.txt` | [llms.txt](https://llmstxt.org/) summary and endpoint reference |
| `GET /robots.txt` | `Disallow: /` |

Every route answers GET and HEAD; OPTIONS answers CORS preflight with 204; anything else is 405.

**Errors** always look like `{"error": {"code": "...", "message": "..."}}`: 404 `not_found`, 405 `method_not_allowed`, 414 `query_too_long` (query string over 1 KB), 422 `invalid_request`, 429 `rate_limited` (with `Retry-After: 60`), 500 `internal_error` (never a stack trace), 502 `upstream_unavailable` (no copy of data.json yet and jsDelivr unreachable within 5 s).

**Headers** on every response: `X-Robots-Tag: noindex, nofollow`, `Access-Control-Allow-Origin: *`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (on `/docs` a CSP that allows only what Swagger UI needs), `Cache-Control: public, max-age=86400` (`no-store` on `/random`, 429 and 5xx).

**Rate limit**: 60 requests a minute per client IP (`CF-Connecting-IP`), through the [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) `RATE_LIMITER` in `wrangler.jsonc`. The limit is per Cloudflare location and approximate; a failing limiter lets requests through.

## Develop

Needs [uv](https://docs.astral.sh/uv/) and Node.

```bash
cd api
npm ci                                          # wrangler, used by pywrangler and the R2 sync
uv run pytest                                   # routing, validation and error tests, no network
uv run pywrangler dev                           # http://localhost:8787
uv run pywrangler dev --var DATA_VERSION:2.7.0  # against another release tag
```

Code: `src/entry.py` (Worker entrypoint, ASGI bridge), `src/app.py` (models, routes, guard middleware, data.json memo), `src/logic.py` (pure functions).

## Images: R2 with jsDelivr as the fallback

`IMAGE_BASE` decides where image URLs point; `{version}` is replaced by `DATA_VERSION`, and the URL is `<base>/<thumb|optimized|original>/<file>`.

- Default: `https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@v{version}/logos`. Works with no setup.
- Own CDN: `https://img.harborix.com/v{version}`, an R2 bucket `car-logos` behind the custom domain `img.harborix.com` (the harborix.com zone is moving to Cloudflare).

jsDelivr stays the fallback: data.json itself always links jsDelivr, and switching `IMAGE_BASE` back and redeploying moves every API URL back.

R2 layout: `car-logos/v<version>/{thumb,optimized,original}/<file>`, every object with `Cache-Control: public, max-age=31536000, immutable`. A version folder never changes once uploaded; a new release gets a new folder.

Upload (from the repo root, after the release is tagged):

```bash
npm run sync:r2 -- --dry-run   # what would go up
npm run sync:r2                # uploads v<package.json version>/ with wrangler r2 bulk put --remote
npm run sync:r2 -- --local     # into wrangler's local R2, for testing
```

## One-time setup (maintainer)

1. `cd api && npm ci && npx wrangler login`
2. `npx wrangler r2 bucket create car-logos`
3. Once harborix.com is active on Cloudflare: R2 > `car-logos` > Settings > Custom Domains > add `img.harborix.com`.
4. Cache Rule on harborix.com: hostname equals `img.harborix.com`, eligible for cache, edge TTL 1 year, respect origin `Cache-Control` for the browser (the objects already say `immutable`).
5. Tag the release, then `npm run sync:r2` from the repo root.
6. Check one image: `curl -I https://img.harborix.com/v2.7.1/optimized/skoda.png` returns 200 with `immutable`.
7. Set `IMAGE_BASE` to `https://img.harborix.com/v{version}` in `wrangler.jsonc`.
8. `uv run pywrangler deploy`

## Deploy

```bash
cd api
uv run pywrangler deploy
```

No secrets are needed. On the Workers free plan the limit is 100,000 requests a day. After a dataset release: tag, `npm run sync:r2`, bump `DATA_VERSION` in `wrangler.jsonc`, deploy.
