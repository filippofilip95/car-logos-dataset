# Contributing

Thanks for helping. Most contributions are a missing or outdated logo.

## Refresh from the source (crawler)

The crawler reads carlogos.org. It never writes into `logos/` directly:

1. `npm start -- <tmpDir>` crawls into `<tmpDir>` (the default is a new temp folder) and writes `report.md` there. The report lists new brands, logos that changed upstream, brands that vanished upstream and name/slug mismatches.
2. Look at the report and pick what to take. Take a changed logo only when the upstream one is clearly the brand's current official mark. Upstream files are at most 640 px wide, often smaller than ours.
3. `npm run apply -- <tmpDir> --add a,b --replace c,d` copies those logos in and generates the optimized and thumb versions. `--replace` keeps the existing file name, so every URL stays the same. A run that would leave fewer logos than `data.json` has stops before writing anything.
4. Run `npm run validate` and `npm test`.

## Add or update a logo by hand

For a brand the source does not publish, add a local logo:

1. Put a PNG with a transparent background in `local-logos/`, named after the slug (`checker.png`). Use the largest clean version you can find.
2. Add an entry to `local-logos/metadata.json` with `name`, `slug`, `fileName`, `source` (a public link to where the image came from) and `license` if the source states one.
3. `npm run apply -- --local <slug>` generates original, optimized and thumb and adds the brand to `logos/data.json`.
4. Run `npm run validate` and `npm test`.
5. Open a pull request and say where the image comes from.

## Rules that keep existing users working

Thousands of apps link the files directly from raw.githubusercontent.com and jsDelivr, so:

- never move or rename `local-logos/` or any file under `logos/`; consumers hard-link these paths
- never delete a logo; replace the file under the same name instead
- keep the slug of an existing brand

## Code changes

The crawler and the image pipeline live in `src/` (TypeScript, run with `tsx`). Use `npm` (`package-lock.json` is the only lockfile). For a bigger change, open an issue first.

Logos are trademarks of their owners; only send images you are allowed to share.
