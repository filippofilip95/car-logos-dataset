# Car Logos Dataset 🚗

A comprehensive collection of **435 car manufacturer logos** with multiple size variations and metadata. This dataset provides high-quality logos in different formats, making it perfect for automotive-related applications, research, or design projects.

Maintained by [Digitaliko](https://www.digitaliko.com/work/car-logos-dataset), a Slovak studio building custom software and AI agents.

## 📦 Features

- 435 unique car manufacturer logos
- Three size variations for each logo:
    - Original high-resolution images
    - Optimized versions (smaller file size, maintained quality)
    - Thumbnails (256px height)
- Detailed JSON metadata for each logo, with open brand data: Wikidata id, country, year founded, NHTSA make id (see [Brand metadata](#brand-metadata))
- MIT licensed (logos remain property of respective owners)
- Last full crawl: November 25, 2026 (see [What's new](#whats-new))

## What's new

**v2.8.0**: every brand gets `wikidataId`, `country`, `founded` and `nhtsaMakeId` from Wikidata (CC0) and NHTSA vPIC (public domain), null when unknown (see [Brand metadata](#brand-metadata)). The hosted API returns them and filters `/brands?country=DE`. No logo changed.

**v2.7.1**: image URLs in `data.json` now point to jsDelivr pinned to the release tag, and the dataset works as a static CDN API (see [Use as an API (CDN)](#use-as-an-api-cdn)). No logo changed.

**November 2026** (v2.7.0): crawler fixed for the redesigned source site, 48 new brands, 15 brands updated to their current logo.

- New: AITO, Aion, Ankai, Aria, ATS, Aurus, AVATR, Brockway, Czinger, Dallara, Deepal, Denza, Devalliet, Fangchengbao, Galaxy, GMA, Hofele, iCAR, IM, INEOS, INKAS, Isotta Fraschini, Italdesign, Jaecoo, Kaiyi, KGM, KrAZ, Livan, Luxeed, Maextro, MHERO, Onvo, ORA, Oshkosh, Puritalia, Rising, Rox, SANY, SCG, Scout, Sitrak, Stelato, Tank, Trumpchi, Voyah, XCMG, Xiaomi, Yangwang
- Current logo, same file name: BYD, Buick, Citroen, Dacia, Fiat, Geely, Infiniti, Iveco, Lada, Opel, Peugeot, Renault, Skoda, Smart, Volvo

## 📂 Repository Structure

```
/logos
  /optimized/   # Optimized logos with reduced file size
  /thumb/       # 256px height thumbnails
  /original/    # Original crawled images
  data.json     # Metadata for all logos
/local-logos    # Custom/local logos with metadata
  metadata.json # Local logos metadata
  *.png         # Local logo files (brands the crawl source does not publish)
/src            # Source code for crawler and processing
```

## 🛠 Installation & Usage

```bash
# Clone the repository
git clone https://github.com/filippofilip95/car-logos-dataset.git

# Install dependencies
npm install

# Crawl into a temp folder and write a diff report (never touches logos/)
npm start -- /tmp/car-logos-crawl

# Take chosen logos from the crawl, see CONTRIBUTING.md
npm run apply -- /tmp/car-logos-crawl --add <slug,...>

# Check that data.json and the files on disk match
npm run validate
```

**⚠️ Processing Time:** a crawl downloads about 400 brand pages and takes a few minutes.

## 📝 Usage Examples

### 1. Local Usage

Download the repository and use images with their relative paths:

```json
{
  "name": "Volkswagen",
  "slug": "volkswagen",
  "image": {
    "localThumb": "./thumb/volkswagen.png",
    "localOptimized": "./optimized/volkswagen.png",
    "localOriginal": "./original/volkswagen.png",
    "source": "https://www.carlogos.org/logo/Volkswagen-logo-2019-1500x1500.png"
  }
}
```

### 2. Remote Usage

Every image URL in `data.json` points to [jsDelivr](https://www.jsdelivr.com/), pinned to the release the file came from:

```json
{
  "name": "Volkswagen",
  "slug": "volkswagen",
  "image": {
    "thumb": "https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@v2.8.0/logos/thumb/volkswagen.png",
    "optimized": "https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@v2.8.0/logos/optimized/volkswagen.png",
    "original": "https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@v2.8.0/logos/original/volkswagen.png"
  }
}
```

Most originals are PNG, a few older ones are JPG. Always take the file name from `data.json` instead of building it from the slug.

The old `raw.githubusercontent.com/.../master/logos/...` links keep working: files are never renamed or removed.

## Brand metadata

Since v2.8.0 every entry in `data.json` has four more fields:

| Field | Type | Meaning | Source |
|---|---|---|---|
| `wikidataId` | string or null | Wikidata item, e.g. `Q29637` | Wikidata, matched by exact name |
| `country` | string or null | ISO 3166-1 alpha-2, e.g. `CZ` | Wikidata P495 (country of origin), else P17 (country) |
| `founded` | integer or null | year, 1800 to 2026 | Wikidata P571 (inception), year precision or finer |
| `nhtsaMakeId` | integer or null | NHTSA vPIC `Make_ID` | vPIC `GetAllMakes`, exact name, motor-vehicle makes only |

```json
{ "name": "Škoda", "slug": "skoda", "wikidataId": "Q29637", "country": "CZ", "founded": 1895, "nhtsaMakeId": null, "image": { ... } }
```

Coverage in v2.8.0 (of 435 brands): `wikidataId` 359 (82.5 %), `country` 288 (66.2 %), `founded` 320 (73.6 %), `nhtsaMakeId` 113 (26.0 %). 28 brands have a hand-reviewed override.

A value is `null` when the source has none or has several that disagree; nothing is guessed. `country` is the code Wikidata gives the country item, so a defunct state keeps its own code (Wartburg: `DD`, East Germany). `nhtsaMakeId` is set only for makes registered with NHTSA (mostly brands sold in the US). The Wikidata item is the company or marque a logo stands for; a few entries are car models (Ford Mustang, Dodge Viper) and point to the model's item.

How it is built: `npm run metadata` (`src/metadata.ts`) looks every brand name up on the [Wikidata Query Service](https://query.wikidata.org/) (exact label or alias, automotive items only) and in one vPIC `GetAllMakes` call, keeping only makes vPIC lists for cars, trucks, MPVs, buses, low speed or incomplete vehicles (so a trailer or motorcycle make of the same name never matches). Resolved items are locked in `metadata/sources.json`, so reruns are deterministic (`--refresh` re-resolves); ambiguous or wrong matches are fixed by hand in `metadata/overrides.json`, each with a reason and the Wikidata label and description as evidence. `npm run validate` checks the formats and prints the coverage.

Licences: Wikidata data is [CC0](https://creativecommons.org/publicdomain/zero/1.0/); NHTSA vPIC data is a US government work in the public domain. The metadata in this repo stays MIT.

## Use as an API (CDN)

No server needed: jsDelivr serves the whole dataset as a static, read-only JSON API.

```
https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@v2.8.0/logos/data.json
```

- **Pinned** (`@v2.8.0`): the file and every image URL in it never change. Use this in production.
- **Latest** (`@latest`, or no tag): follows the newest release, but jsDelivr caches it for up to 7 days and a new release can add or replace logos under you. The image URLs inside always stay pinned to their own release.

JavaScript:

```js
const res = await fetch("https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@v2.8.0/logos/data.json");
const logos = await res.json();
const skoda = logos.find((l) => l.slug === "skoda");
console.log(skoda.image.optimized);
```

Python:

```python
import json, urllib.request

URL = "https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@v2.8.0/logos/data.json"
logos = json.load(urllib.request.urlopen(URL))
skoda = next(l for l in logos if l["slug"] == "skoda")
print(skoda["image"]["optimized"])
```

Fair use: the logos are trademarks of their owners, for identification only (see [License](#-license)). The main source is [carlogos.org](https://www.carlogos.org/); each entry's `source` field links the original image. Cache the JSON on your side instead of fetching it on every request.

## Hosted API (Cloudflare Worker)

`api/` holds a small read-only JSON API over the same data: a Cloudflare Python Worker with FastAPI. It reads `data.json` from jsDelivr (pinned to `DATA_VERSION` in `api/wrangler.jsonc`) and returns brands with image URLs on a CDN (jsDelivr by default, or an R2 bucket behind your own domain via `IMAGE_BASE`); it never serves the images itself.

Endpoints: `/brands` (`?limit&offset&country=DE`), `/brands/{slug}`, `/search?q=`, `/random?count=1..20`, `/docs`, `/llms.txt`. Responses are JSON, CORS open, `noindex`, rate limited to 60 requests a minute per IP.

Run your own copy:

```bash
cd api
uv run pywrangler dev      # local, http://localhost:8787
uv run pywrangler deploy   # to your Cloudflare account (asks you to log in)
```

No secrets are needed. The Workers free plan allows 100,000 requests a day; for more, use the CDN URLs above directly. Details in [api/README.md](api/README.md).

## 🤝 Contributing

Missing or outdated logo? See [CONTRIBUTING.md](CONTRIBUTING.md). In short: add it as a local logo with a source link, generate the optimized and thumb versions, run `npm run validate`, then open a pull request.

## 📄 License

The code and metadata are MIT licensed, see [LICENSE](LICENSE).

**Trademark note:** the MIT license covers the code, the metadata and the way the dataset is put together. The logos themselves are trademarks of their respective owners. They are included for identification only, and the license grants no rights to them. Check the owner's terms before you use a logo in your own product.

## 🔍 Data Source

- **Main Dataset**: Logo images are crawled from [Carlogos.org](https://www.carlogos.org/) and processed for optimal usage
- **Brand metadata**: [Wikidata](https://www.wikidata.org/) (CC0) and [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) (public domain), see [Brand metadata](#brand-metadata)
- **Local Logos**: logos for brands the main source does not publish, in `local-logos/` with a source link per file (several from [Wikimedia Commons](https://commons.wikimedia.org/), public domain)

## 📫 Support

- Create an [Issue](https://github.com/filippofilip95/car-logos-dataset/issues) for bug reports or feature requests
- Star the repository if you find it useful!
