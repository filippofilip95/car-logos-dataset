# Car Logos Dataset 🚗

A comprehensive collection of **387 car manufacturer logos** with multiple size variations and metadata. This dataset provides high-quality logos in different formats, making it perfect for automotive-related applications, research, or design projects.

## 📦 Features

- 387 unique car manufacturer logos
- Three size variations for each logo:
    - Original high-resolution images
    - Optimized versions (smaller file size, maintained quality)
    - Thumbnails (256px height)
- Detailed JSON metadata for each logo
- MIT licensed (logos remain property of respective owners)
- Regular updates (Last crawled: November 28, 2024)

## 📂 Repository Structure

```
/logos
  /optimized/   # Optimized logos with reduced file size
  /thumb/       # 256px height thumbnails
  /original/    # Original crawled images
  data.json     # Metadata for all logos
/src            # Source code for crawler and processing
```

## 🛠 Installation & Usage

```bash
# Clone the repository
git clone https://github.com/filippofilip95/car-logos-dataset.git

# Install dependencies
npm install

# Run the crawler and processor
npm start
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
    "localOriginal": "./original/volkswagen.jpg",
    "source": "https://www.carlogos.org/logo/Volkswagen-logo-2019-640x500.jpg"
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
    "original": "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/original/volkswagen.jpg"
  }
}
```

## 🤝 Contributing

We welcome contributions! The crawler and optimization scripts are written in TypeScript and located in the `/src/` directory.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Note:** All logo images are the property of their respective owners and are subject to their own licensing terms.

## 🔍 Data Source

Logo images are crawled from [Carlogos.org](https://www.carlogos.org/) and processed for optimal usage.

## 📫 Support

- Create an [Issue](https://github.com/filippofilip95/car-logos-dataset/issues) for bug reports or feature requests
- Star the repository if you find it useful!
