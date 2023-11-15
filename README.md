# Car Logos Dataset

This [repository](https://github.com/filippofilip95/car-logos-dataset) contains image collection of **383 car manufacturers logos**.

Each logo has three size variations (original, optimized, thumbnail).

Logo images were crawled on `15.11.2023` from website [Carlogos.org](https://www.carlogos.org/) and processed afterwards for better usability.

## Content

#### Logos are included in these folders:

- `/logos/optimized/` (includes optimized logos with small file size but good quality)
- `/logos/thumb/` (includes thumbnails of logos with height of 256px)
- `/logos/original/` (includes original crawled images)

#### Logo files are also described with JSON file

- `/logos/data.json`

This file contains description of each logo with few properties.

#### Example of item:

```
  {
    "name": "Volkswagen",
    "slug": "volkswagen",
    "image": {
      "source": "https://www.carlogos.org/logo/Volkswagen-logo-2019-640x500.jpg",
      "thumb": "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/thumb/volkswagen.png",
      "optimized": "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/volkswagen.png",
      "original": "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/original/volkswagen.jpg",
      "localThumb": "./thumb/volkswagen.png",
      "localOptimized": "./optimized/volkswagen.png",
      "localOriginal": "./original/volkswagen.jpg"
    }
  },
```

## Usage

You can use this dataset mainly in two ways:

1. **Download repository** and use images and JSON file as you wish.

   - In this case useful for you is the item property `localThumb`, `localOptimized` and `localOriginal`.
   - These properties are representing relative path from JSON file to image.

2. **Embed logo via url** from a repository.
   - In this case useful for you is the item property `thumb`, `optimized` and `original`
   - These properties are urls for direct embedding of image.

## Contributing

Crawler and optimization script is included in `/src/` folder and it's written with `Node.js` and `TypeScript`

If you would like to improve it feel free to open Issue or Pull Request

## License

- [MIT](https://choosealicense.com/licenses/mit/)
- All images are the property of their respective owners.
