import sharp from "sharp";
import * as fs from "fs";
import { LogosPath, THUMB_HEIGHT } from "./config";

class LogosOptimizer {
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
    this.loadOriginals();
  }

  protected loadOriginals() {
    const dirContent = fs.readdirSync(LogosPath.Original);

    this.originals = dirContent.filter((path) => {
      const [_, extension] = path.split(".");
      return extension;
    });
  }

  protected async optimizeImages() {
    for (const logo of this.originals) {
      const [name] = logo.split(".");
      const targetFile = `${name}.png`;

      try {
        await sharp(`${LogosPath.Original}/${logo}`)
          .png(this.optimizeOpts)
          .toFile(`${LogosPath.Optimized}/${targetFile}`);

        this.optimized.push(targetFile);
      } catch (e) {
        console.error(e);
      }
    }

    console.log("Images optimized.");
  }

  protected async makeThumbs() {
    for (const logo of this.optimized) {
      // already contains extension
      const targetFile = logo;

      try {
        await sharp(`${LogosPath.Optimized}/${logo}`)
          .png(this.optimizeOpts)
          .resize(this.resizeOpts)
          .toFile(`${LogosPath.Thumbs}/${targetFile}`);

        this.thumbs.push(targetFile);
      } catch (e) {
        console.error(e);
      }
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

    return {
      originals: this.originals,
      optimized: this.optimized,
      thumbs: this.thumbs,
    };
  }
}

export default LogosOptimizer;
