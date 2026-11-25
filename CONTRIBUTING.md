# Contributing

Thanks for helping. Most contributions are a missing or outdated logo.

## Add or update a logo

The crawler can only fetch brands that the source site publishes. For anything else, add a local logo:

1. Put a PNG with a transparent background in `local-logos/`, named after the slug (`checker.png`). Use the largest clean version you can find.
2. Add an entry to `local-logos/metadata.json` with `name`, `slug`, `fileName` and `source`, a public link to where the image came from.
3. Generate `logos/original`, `logos/optimized` and `logos/thumb` with the normal pipeline (`npm start`), so the optimized file is really optimized and the thumb is 256 px high.
4. Run `npm run validate`. It checks that `logos/data.json` and the files on disk match.
5. Open a pull request and say where the image comes from.

## Rules that keep existing users working

Thousands of apps link the files directly from raw.githubusercontent.com and jsDelivr, so:

- never rename or move files or folders under `logos/`
- never delete a logo; replace the file under the same name instead
- keep the slug of an existing brand

## Code changes

The crawler and the image pipeline live in `src/` (TypeScript, run with `tsx`). Use `npm` (`package-lock.json` is the only lockfile). For a bigger change, open an issue first.

Logos are trademarks of their owners; only send images you are allowed to share.
