import sharp from "sharp";
import * as fs from "fs";
import { LogosTargetLocation, THUMB_HEIGHT } from "./config";
import BaseClass from "./BaseClass";

class ImageOptimizer extends BaseClass {
  originals: string[] = [];
  optimized: string[] = [];
  thumbs: string[] = [];

  optimizeOpts = {
    quality: 50,
    compressionLevel: 5,
  } as const;

  resizeOpts = {
    fit: "contain",
    height: THUMB_HEIGHT,
  } as const;

  constructor() {
    super();
    this.loadOriginals();
  }

  protected loadOriginals() {
    const dirContent = fs.readdirSync(LogosTargetLocation.Original);

    this.originals = dirContent.filter(
      (path) => !!this.getFileExtFromPath(path)
    );
  }

  protected async optimizeImages() {
    for (const logo of this.originals) {
      const [name] = logo.split(".");
      const targetFile = `${name}.png`;

      try {
        await sharp(`${LogosTargetLocation.Original}/${logo}`)
          .png(this.optimizeOpts)
          .toFile(`${LogosTargetLocation.Optimized}/${targetFile}`);

        this.optimized.push(targetFile);
      } catch (e) {
        console.error(e);
      }
    }

    console.log("Original images optimized.");
  }

  protected async makeThumbs() {
    for (const logo of this.optimized) {
      // already contains extension
      const targetFile = logo;

      try {
        await sharp(`${LogosTargetLocation.Optimized}/${logo}`)
          .png(this.optimizeOpts)
          .resize(this.resizeOpts)
          .toFile(`${LogosTargetLocation.Thumbs}/${targetFile}`);

        this.thumbs.push(targetFile);
      } catch (e) {
        console.error(e);
      }
    }

    console.log("Thumbnails created.");
  }

  public async run() {
    try {
      console.log("Started image processing.");

      await this.optimizeImages();
      await this.makeThumbs();

      console.log("Finished Image processing.");
    } catch (e) {
      console.log(e);
    }

    return {
      originals: this.originals,
      optimized: this.optimized,
      thumbs: this.thumbs,
    };
  }
}

export default ImageOptimizer;
