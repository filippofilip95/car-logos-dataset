import { ManufacturersLogos, OptimizedManufacturerLogos } from "./types";
import BaseScrapper from "./BaseScrapper";
import { META_JSON_PATH } from "./config";

type Results = {
  logos: ManufacturersLogos;
  optimized: {
    originals: string[];
    optimized: string[];
    thumbs: string[];
  };
};

class LogosDataFinalizer extends BaseScrapper {
  results: Results;

  constructor(results: Results) {
    super();
    this.results = results;
  }

  protected getLogoVariations(slug: string) {
    const original = this.results.optimized.originals.find(
      (thumb) => slug === this.getFileNameFromPath(thumb)
    );

    const optimized = this.results.optimized.optimized.find(
      (thumb) => slug === this.getFileNameFromPath(thumb)
    );
    const thumb = this.results.optimized.thumbs.find(
      (thumb) => slug === this.getFileNameFromPath(thumb)
    );

    return {thumb, optimized, original};
  }

  protected composeResultsData() {
    const results = this.results.logos.map((logo) => {
      const variations = this.getLogoVariations(logo.slug);
      const image = {...logo.image, ...variations};

      return {...logo, image};
    });

    const completeResults = results.filter(
      ({image}) =>
        image.source && image.optimized && image.thumb && image.original
    );

    return completeResults as OptimizedManufacturerLogos;
  }

  public run() {
    console.log('Finalizing results.')

    const results = this.composeResultsData()

    this.writeJsonFileSync(
      META_JSON_PATH,
      JSON.stringify(results, null, 2)
    );

    console.log(`Done data saved to ${META_JSON_PATH}.`)
  }
}

export default LogosDataFinalizer;
