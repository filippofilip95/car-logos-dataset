# AGENTS.md

Notes for coding agents working in this repo. Humans: start at README.md and CONTRIBUTING.md.

## What this is

A dataset of 435 car manufacturer logos (original, optimized, 256 px thumb) plus `logos/data.json` metadata. The main source is carlogos.org; a few brands come from `local-logos/` with their own source link. Code and metadata are MIT; the logos are trademarks of their owners.

## Layout

- `logos/data.json`: one entry per brand: `name`, `slug`, `image.source` (attribution), `thumb`/`optimized`/`original` (jsDelivr URLs pinned to the release tag), `localThumb`/`localOptimized`/`localOriginal`.
- `logos/original/`, `logos/optimized/`, `logos/thumb/`: the image files.
- `local-logos/`: logos the source does not publish, with `metadata.json` (source link per file).
- `src/`: TypeScript run with `tsx`. Crawler (`index.ts`, `LogoScrapper.ts`), diff report (`report.ts`, `diff.ts`), apply into `logos/` (`apply.ts`), image processing (`ImageOptimizer.ts`), URL generator (`urls.ts`, `config.ts`), shrink guard (`guard.ts`), tests (`*.test.ts`).
- `scripts/validate.mjs`: checks `data.json` against the files on disk.

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

1. `npm version <x.y.z> --no-git-tag-version` (its `version` script runs `npm run urls`, so every URL moves to the new tag).
2. `npm run validate && npm test`, update "What's new" in README, open a PR.
3. After merge: tag `v<x.y.z>` on the merge commit and publish a GitHub release with notes. The pinned URLs return 404 until the tag exists.
