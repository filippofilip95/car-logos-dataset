import { Manufacturer, Manufacturers, ManufacturersLogos } from "./types";
import BaseScrapper from "./BaseScrapper";

const BASE_URL = "https://www.carlogos.org";

const Url = {
  AllManufacturers: `${BASE_URL}/car-brands-a-z`,
  Manufacturer: (url: string) => `${BASE_URL}/${url}`,
};

const Selectors = {
  AllManufacturers: ".a-z dd a",
  ManufacturerLogo: `div.logo-content a img`,
};

class LogosScrapper extends BaseScrapper {
  manufacturers: Manufacturers = [];
  manufacturersLogos: ManufacturersLogos = [];

  protected fixUrl(url: string) {
    return url.startsWith("http") ? url : `${BASE_URL}${url}`;
  }

  protected async recognizeManufacturers() {
    const document = await this.loadDocument(Url.AllManufacturers);
    const text = document(Selectors.AllManufacturers);

    text.each((index, element) => {
      const manufacturerNode = document(element);

      const url = manufacturerNode.attr("href");
      const name = manufacturerNode.text();

      if (url && name) {
        this.manufacturers.push({name, url});
      }
    });
  }

  protected async downloadLogos(): Promise<void> {
    const queue = new this.queue({concurrency: 5});
    const runners = this.manufacturers.map(this.createLogoDownloader);

    runners.forEach((runner) => queue.push(runner));

    return new Promise((resolve, reject) =>
      queue.start((error) => {
        if (error) {
          reject(error);
        }
        resolve();
      })
    );
  }

  protected createLogoDownloader = (manufacturer: Manufacturer) => {
    return async () => {
      try {
        const msg = `Logo of ${this.chalk.bold(manufacturer.name)} `;
        const document = await this.loadDocument(
          Url.Manufacturer(manufacturer.url)
        );

        let logoUrl = document(Selectors.ManufacturerLogo).attr("src");

        if (!logoUrl) {
          throw new Error(`${msg} ${this.chalk.red("not found")}`);
        }

        const extension = this.getFileExtension(logoUrl);
        const url = this.fixUrl(logoUrl);
        const slug = this.slugify(manufacturer.name).toLowerCase();

        await this.downloadFile(url, `./logos/${slug}.${extension}`);

        this.manufacturersLogos.push({name: manufacturer.name, url: logoUrl});
        console.log(`${msg} ${this.chalk.green("downloaded")}.`);
      } catch (e) {
        console.log(e);
      }
    };
  };

  public async run() {
    try {
      console.log("Started parsing.");
      await this.recognizeManufacturers();

      console.log(`Recognized ${this.manufacturers.length} manufacturers.`);
      await this.downloadLogos();
      console.log(
        `Downloaded ${this.chalk.bold(
          this.manufacturersLogos.length
        )} manufacturers logos.`
      );
      // TODO save to json
      console.log("Finished.");
    } catch (e) {
      console.error(e);
    }
  }
}

export default LogosScrapper;
