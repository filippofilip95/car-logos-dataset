import { ManufacturerLogos, PreFinalizedResults } from "./types";
import BaseClass from "./BaseClass";
import { LocalAccessPath, META_JSON_PATH, PublicAccessUrl } from "./config";

class DataFinalizer extends BaseClass {
  results: PreFinalizedResults;

  constructor(results: PreFinalizedResults) {
    super();
    this.results = results;
  }

  protected getLogoVariations(slug: string) {
    const original = this.results.images.originals.find(
      (thumb) => slug === this.getFileNameFromPath(thumb)
    );

    const optimized = this.results.images.optimized.find(
      (thumb) => slug === this.getFileNameFromPath(thumb)
    );
    const thumb = this.results.images.thumbs.find(
      (thumb) => slug === this.getFileNameFromPath(thumb)
    );

    if (!original || !optimized || !thumb) {
      throw new Error(`Unable to find variations for ${slug}`);
    }

    return {
      thumb: PublicAccessUrl.Thumb(thumb),
      optimized: PublicAccessUrl.Optimized(thumb),
      original: PublicAccessUrl.Original(thumb),
      localThumb: LocalAccessPath.Thumb(thumb),
      localOptimized: LocalAccessPath.Optimized(thumb),
      localOriginal: LocalAccessPath.Original(thumb),
    };
  }

  protected composeResultsData(): ManufacturerLogos {
    return this.results.logos.map((logo) => {
      const variations = this.getLogoVariations(logo.slug);
      const image = { ...logo.image, ...variations };

      return { ...logo, image };
    });
  }

  public run() {
    console.log("Finalizing results.");

    try {
      const results = this.composeResultsData();

      this.writeJsonFileSync(META_JSON_PATH, JSON.stringify(results, null, 2));

      console.log(`Done data saved to ${META_JSON_PATH}.`);
    } catch (e) {
      console.error(e);
    }
  }
}

export default DataFinalizer;
