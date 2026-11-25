# AGENTS.md

Notes for coding agents working in this repo. Humans: start at README.md and CONTRIBUTING.md.

## What this is

A dataset of 435 car manufacturer logos (original, optimized, 256 px thumb) plus `logos/data.json` metadata. The main source is carlogos.org; a few brands come from `local-logos/` with their own source link. Code and metadata are MIT; the logos are trademarks of their owners.

## Layout

- `logos/data.json`: one entry per brand: `name`, `slug`, `image.source` (attribution), `thumb`/`optimized`/`original` (jsDelivr URLs pinned to the release tag), `localThumb`/`localOptimized`/`localOriginal`.
- `logos/original/`, `logos/optimized/`, `logos/thumb/`: the image files.
- `local-logos/`: logos the source does not publish, with `metadata.json` (source link per file).
- `src/`: TypeScript run with `tsx`. Crawler (`index.ts`, `LogoScrapper.ts`), diff report (`report.ts`, `diff.ts`), apply into `logos/` (`apply.ts`), image processing (`ImageOptimizer.ts`), URL generator (`urls.ts`, `config.ts`), shrink guard (`guard.ts`), tests (`*.test.ts`).
- `scripts/validate.mjs`: checks `data.json` against the files on disk. `scripts/sync-r2.mjs`: uploads a tagged release's images to R2.
- `llms.txt`: llmstxt.org summary of the dataset with the pinned CDN URL; bump its version with each release (validate checks it).
- `api/`: the hosted read-only API (FastAPI on a Cloudflare Python Worker), its own uv project.

## Commands

```bash
npm install
npm start -- <tmpDir>                            # crawl into a temp folder + report.md, never logos/
npm run apply -- <tmpDir> --add a,b --replace c  # take chosen logos into logos/ and data.json
npm run apply -- --local <slug>                  # add a logo from local-logos/
npm run urls                                     # regenerate image URLs from package.json version
npm run validate
npm test
```

Run `npm run validate` and `npm test` before every commit.

## Rules

- Never hand-edit `logos/data.json`; it is written by `npm run apply` and `npm run urls`.
- Never crawl into `logos/` directly; crawl into a temp folder, then `apply`.
- Never rename, move or delete a file under `logos/` or `local-logos/`, and never change an existing slug: apps link these paths directly.
- A local logo needs a public source URL in `local-logos/metadata.json` and a PNG with a transparent background.
- Image URLs are pinned to `https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@v<package.json version>/`; validate fails on any other base.
- Use npm (`package-lock.json` is the only lockfile).

## Release

1. `npm version <x.y.z> --no-git-tag-version` (its `version` script runs `npm run urls`, so every URL moves to the new tag); bump the version in `llms.txt`.
2. `npm run validate && npm test`, update "What's new" in README, open a PR.
3. After merge: tag `v<x.y.z>` on the merge commit and publish a GitHub release with notes. The pinned URLs return 404 until the tag exists.
4. `npm run sync:r2` (`scripts/sync-r2.mjs`): uploads the images to R2 `car-logos/v<x.y.z>/` with immutable cache headers; refuses without the tag. Maintainer only (needs a Cloudflare login).
5. API: bump `DATA_VERSION` in `api/wrangler.jsonc`, `uv run pywrangler deploy`.

## API (`api/`)

- FastAPI app on a Cloudflare Python Worker: `src/entry.py` (entrypoint, ASGI bridge), `src/app.py` (Pydantic models, routes, `Guard` middleware, data.json memo), `src/logic.py` (pure functions, llms.txt text).
- Reads `data.json` from jsDelivr pinned to `DATA_VERSION`, 5 s timeout, 1 h memo, last good copy kept when a refresh fails.
- Image URLs come from `IMAGE_BASE` (`{version}` = `DATA_VERSION`): jsDelivr by default; `https://img.harborix.com/v{version}` once the R2 bucket `car-logos` has its custom domain. jsDelivr stays the fallback.
- `cd api && uv run pytest` for tests, `uv run pywrangler dev` for a local server. Deploy, bucket creation and Cloudflare login are the maintainer's call.
- Params are validated by Pydantic (limit 1 to 100, offset 0 to 10000, q 1 to 64, count 1 to 20, slug `^[a-z0-9-]{1,64}$`); every error is `{"error": {"code", "message"}}`; GET/HEAD/OPTIONS only; query strings over 1 KB get 414; 60 requests a minute per IP (Rate Limiting binding `RATE_LIMITER`), 429 above.
- Every response: `X-Robots-Tag: noindex, nofollow`, CORS `*`, nosniff, `Referrer-Policy: no-referrer`, a strict CSP (relaxed only on `/docs`), `Cache-Control: public, max-age=86400` (`no-store` on `/random`, 429, 5xx). `/robots.txt` disallows all; `/llms.txt` and `/llms-full.txt` describe the API for LLMs.
- Never proxy or store images in the Worker: return CDN URLs.
- Versions are pinned in `pyproject.toml` (`fastapi`, `workers-py`, `workers-runtime-sdk`) and locked in `uv.lock`.
