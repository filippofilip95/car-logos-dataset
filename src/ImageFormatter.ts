import sharp from "sharp";
import * as fs from "fs";
import { LogosPath, THUMB_HEIGHT } from "./config";

class ImageFormatter {
  logos: string[] = [];
  optimizedLogos: string[] = [];

  optimizationOpts = {
    quality: 50,
    compressionLevel: 5,
  };

  constructor() {
    this.loadLogos();
  }

  protected loadLogos() {
    const dirContent = fs.readdirSync(LogosPath.Original);

    this.logos = dirContent.filter((path) => {
      const [_, extension] = path.split(".");
      return extension;
    });
  }

  protected async optimizeImages() {
    for (const logo of this.logos) {
      const [name] = logo.split(".");
      const newFile = `${name}.png`;

      try {
        await sharp(`${LogosPath.Original}/${logo}`)
          .png(this.optimizationOpts)
          .toFile(`${LogosPath.Optimized}/${newFile}`);

        this.optimizedLogos.push(newFile);
      } catch (e) {
        console.error(e);
      }
    }

    console.log("Images optimized.");
  }

  protected async makeThumbs() {
    for (const logo of this.optimizedLogos) {
      await sharp(`${LogosPath.Optimized}/${logo}`)
        .png(this.optimizationOpts)
        .resize({
          fit: "contain",
          height: THUMB_HEIGHT,
        })
        .toFile(`${LogosPath.Thumbs}/${logo}`);
    }

    console.log("Thumbnails created.");
  }

  public async run() {
    try {
      console.log("Started Image processing.");

      await this.optimizeImages();
      await this.makeThumbs();

      console.log("Finished Image processing.");
    } catch (e) {
      console.log(e);
    }
  }
}

export default ImageFormatter;
