import { Manufacturer, Manufacturers, ManufacturersLogos } from "./types";
import BaseClass from "./BaseClass";
import { BASE_URL, LogosTargetLocation, Selectors, Url } from "./config";

class LogoScrapper extends BaseClass {
  manufacturers: Manufacturers = [];
  logos: ManufacturersLogos = [];

  protected fixUrl(url: string) {
    return url.startsWith("http") ? url : `${BASE_URL}${url}`;
  }

  protected async chooseUrl(sourceUrl: string, fallbackUrl: string) {
    let res = await fetch(sourceUrl);
    let usedUrl = sourceUrl;

    if (res.status === 404) {
      res = await fetch(fallbackUrl);
      usedUrl = fallbackUrl;
    }

    if (!res.ok) {
      throw new Error(`No valid URL: ${res.status} ${res.statusText}`);
    }

    return usedUrl;
  }

  protected async recognizeManufacturers() {
    const document = await this.loadDocument(Url.AllManufacturers);
    const text = document(Selectors.AllManufacturers);

    text.each((index, element) => {
      const manufacturerNode = document(element);

      const url = manufacturerNode.attr("href");
      const name = manufacturerNode.text();

      if (url && name) {
        this.manufacturers.push({ name, url });
      }
    });

    console.log(`Recognized ${this.manufacturers.length} manufacturers.`);
  }

  protected async downloadLogos(): Promise<void> {
    const queue = new this.queue({ concurrency: 5 });
    const runners = this.manufacturers.map(this.createLogoDownloader);

    runners.forEach((runner) => queue.push(runner));

    await new Promise<void>((resolve, reject) =>
      queue.start((error) => {
        if (error) reject(error);
        resolve();
      })
    );

    console.log(
      `Downloaded ${this.chalk.bold(this.logos.length)} manufacturers logos.`
    );
  }

  protected createLogoDownloader = (manufacturer: Manufacturer) => {
    return async () => {
      try {
        const msg = `Logo of ${this.chalk.bold(manufacturer.name)} - ${manufacturer.url} `;
        const document = await this.loadDocument(
          Url.Manufacturer(manufacturer.url)
        );

        let logoUrl = '';
        let logoUrlFallback = '';
        let logoSelectors = Selectors.Logos;

        for (const key in logoSelectors) {
          const selector = logoSelectors[key as keyof typeof logoSelectors];
          logoUrl = logoUrlFallback = document(selector).attr("src");

          if (logoUrl && !logoUrl.endsWith("png")) {
            let parent = document(selector).parent("a");
            if (parent.length > 0) {
              if (parent.attr("href").endsWith("png")) {
                logoUrl = parent.attr("href");
              }
            }
          }

          if (logoUrl) break;
        }

        if (!logoUrl) {
          throw new Error(`${msg}${this.chalk.red("not found")}`);
        }

        const sourceUrl = this.fixUrl(logoUrl);
        const sourceUrlFallback = this.fixUrl(logoUrlFallback);
        const usedUrl = await this.chooseUrl(sourceUrl, sourceUrlFallback);

        const extension = this.getFileExtFromUrl(usedUrl);
        const slug = this.slugify(manufacturer.name).toLowerCase();
        const fileName = `${slug}.${extension}`;
        const targetLocation = `${LogosTargetLocation.Original}/${fileName}`;

        await this.downloadFile(usedUrl, targetLocation);

        this.logos.push({
          name: manufacturer.name,
          slug: slug,
          image: { source: usedUrl },
        });

        console.log(`${msg}${this.chalk.green("downloaded")}.`);
      } catch (e) {
        console.log(e.message);
      }
    };
  };

  public async run() {
    try {
      console.log("Started parsing.");

      await this.recognizeManufacturers();
      await this.downloadLogos();

      console.log("Finished parsing.");
    } catch (e) {
      console.error(e);
    }

    return this.logos;
  }
}

export default LogoScrapper;
