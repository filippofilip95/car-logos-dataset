# Car Logos Dataset 🚗

A comprehensive collection of **387 car manufacturer logos** with multiple size variations and metadata. This dataset provides high-quality logos in different formats, making it perfect for automotive-related applications, research, or design projects.

Maintained by [Digitaliko](https://www.digitaliko.com/work/car-logos-dataset), a Slovak studio building custom software and AI agents.

## 📦 Features

- 387 unique car manufacturer logos
- Three size variations for each logo:
    - Original high-resolution images
    - Optimized versions (smaller file size, maintained quality)
    - Thumbnails (256px height)
- Detailed JSON metadata for each logo
- MIT licensed (logos remain property of respective owners)
- Last full crawl: August 27, 2025. Since then updated by hand (new local logos, fixes like the 2021 Kia emblem). The crawler is broken since the source site's redesign ([#35](https://github.com/filippofilip95/car-logos-dataset/issues/35)), so new logos come in through `local-logos/`.

## 📂 Repository Structure

```
/logos
  /optimized/   # Optimized logos with reduced file size
  /thumb/       # 256px height thumbnails
  /original/    # Original crawled images
  data.json     # Metadata for all logos
/local-logos    # Custom/local logos with metadata
  metadata.json # Local logos metadata
  *.png         # Local logo files (Cupra, Jetour, Omoda, SEV)
/src            # Source code for crawler and processing
```

## 🛠 Installation & Usage

```bash
# Clone the repository
git clone https://github.com/filippofilip95/car-logos-dataset.git

# Install dependencies
npm install

# Run the crawler and processor
# (broken until #35 is fixed: it stops without writing anything)
npm start

# Check that data.json and the files on disk match
npm run validate
```

**⚠️ Processing Time:** The script processes 387 logos through image optimization which takes 3-8 minutes. The Node.js memory has been optimized for this workload. If running through automation tools, ensure sufficient timeout allowance.

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

Embed logos directly using GitHub raw URLs:

```json
{
  "name": "Volkswagen",
  "slug": "volkswagen",
  "image": {
    "thumb": "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/thumb/volkswagen.png",
    "optimized": "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/volkswagen.png",
    "original": "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/original/volkswagen.png"
  }
}
```

Most originals are PNG, a few older ones are JPG. Always take the file name from `data.json` instead of building it from the slug.

## 🤝 Contributing

Missing or outdated logo? See [CONTRIBUTING.md](CONTRIBUTING.md). In short: add it as a local logo with a source link, generate the optimized and thumb versions, run `npm run validate`, then open a pull request.

## 📄 License

The code and metadata are MIT licensed, see [LICENSE](LICENSE).

**Trademark note:** the MIT license covers the code, the metadata and the way the dataset is put together. The logos themselves are trademarks of their respective owners. They are included for identification only, and the license grants no rights to them. Check the owner's terms before you use a logo in your own product.

## 🔍 Data Source

- **Main Dataset**: Logo images are crawled from [Carlogos.org](https://www.carlogos.org/) and processed for optimal usage
- **Local Logos**: Custom logos are added directly to the repository in the `local-logos/` directory for brands not available in the main crawl source

## 📫 Support

- Create an [Issue](https://github.com/filippofilip95/car-logos-dataset/issues) for bug reports or feature requests
- Star the repository if you find it useful!
