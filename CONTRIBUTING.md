# Contributing

Thanks for helping. Most contributions are a missing or outdated logo.

## Add or update a logo

The crawler is broken since the source site's redesign ([#35](https://github.com/filippofilip95/car-logos-dataset/issues/35)). Until it is fixed, `npm start` stops before it writes anything, so add every new or updated logo as a local logo:

1. Put a PNG with a transparent background in `local-logos/`, named after the slug (`checker.png`). Use the largest clean version you can find.
2. Add an entry to `local-logos/metadata.json` with `name`, `slug`, `fileName` and `source`, a public link to where the image came from.
3. Generate `logos/original`, `logos/optimized` and `logos/thumb` with the same sharp settings as `src/ImageOptimizer.ts` (png quality 50, compression level 5; thumb 256 px high, `fit: contain`), so the optimized file is really optimized. Add the entry to `logos/data.json` in alphabetical order, with the same fields as the other logos.
4. Run `npm run validate` and `npm test`. It checks that `logos/data.json` and the files on disk match.
5. Open a pull request and say where the image comes from.

## Rules that keep existing users working

Thousands of apps link the files directly from raw.githubusercontent.com and jsDelivr, so:

- never move or rename `local-logos/` or any file under `logos/`; consumers hard-link these paths
- never delete a logo; replace the file under the same name instead
- keep the slug of an existing brand

## Code changes

The crawler and the image pipeline live in `src/` (TypeScript, run with `tsx`). Use `npm` (`package-lock.json` is the only lockfile). For a bigger change, open an issue first.

Logos are trademarks of their owners; only send images you are allowed to share.
