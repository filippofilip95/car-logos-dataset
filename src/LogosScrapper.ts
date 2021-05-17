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

    console.log(`Recognized ${this.manufacturers.length} manufacturers.`);
  }

  protected async downloadLogos(): Promise<void> {
    const queue = new this.queue({concurrency: 5});
    const runners = this.manufacturers.map(this.createLogoDownloader);

    runners.forEach((runner) => queue.push(runner));

    await new Promise<void>((resolve, reject) =>
      queue.start((error) => {
        if (error) reject(error);
        resolve();
      })
    );

    console.log(
      `Downloaded ${this.chalk.bold(
        this.manufacturersLogos.length
      )} manufacturers logos.`
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
          throw new Error(`${msg}${this.chalk.red("not found")}`);
        }

        const extension = this.getFileExtension(logoUrl);
        const url = this.fixUrl(logoUrl);
        const fileNameSlug = `${this.slugify(
          manufacturer.name
        ).toLowerCase()}.${extension}`;

        await this.downloadFile(url, `./logos/${fileNameSlug}`);

        this.manufacturersLogos.push({
          name: manufacturer.name,
          url: logoUrl,
          slug: fileNameSlug,
        });

        console.log(`${msg}${this.chalk.green("downloaded")}.`);
      } catch (e) {
        console.log(e.message);
      }
    };
  };

  protected saveJson() {
    this.writeFileSync("./logos.json", JSON.stringify(this.manufacturersLogos));
    console.log(`Results meta data saved to JSON.`);
  }

  public async run() {
    try {
      console.log("Started parsing.");

      await this.recognizeManufacturers();
      await this.downloadLogos();
      this.saveJson();

      console.log("Finished.");
    } catch (e) {
      console.error(e);
    }
  }
}

export default LogosScrapper;
