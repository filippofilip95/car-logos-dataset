import * as fs from "fs";
import * as path from "path";
import type { CheerioAPI } from "cheerio";
import { Manufacturer, Manufacturers, ManufacturersLogos } from "./types";
import BaseClass from "./BaseClass";
import { BASE_URL, LogosTargetLocation, Selectors, Url } from "./config";

// Picks the current mark on a carlogos.org brand page: the newest dated
// history image (640 px), else the small header logo (240 px).
export function pickLogoUrl(document: CheerioAPI): string | undefined {
  const header = document(Selectors.CurrentLogo).attr("src");
  // Only this brand's own history (/car-logos/kia-logo-2021.png for kia-logo.png),
  // never a related brand's thumbnail elsewhere on the page.
  const prefix = header ? header.replace(/\.(png|jpg|svg)$/, "-") : undefined;
  let best: { year: number; src: string } | undefined;
  document(Selectors.HistoryLogos).each((_, el) => {
    const src = document(el).attr("src") || "";
    if (prefix && !src.startsWith(prefix)) return;
    const m = src.match(/-logo-(\d{4})\.(png|jpg|svg)$/);
    if (m && (!best || Number(m[1]) > best.year)) best = { year: Number(m[1]), src };
  });
  const src = best?.src || header;
  if (!src) return undefined;
  return src.startsWith("http") ? src : `${BASE_URL}${src}`;
}

class LogoScrapper extends BaseClass {
  manufacturers: Manufacturers = [];
  logos: ManufacturersLogos = [];
  // Where originals are downloaded. The crawl script points this at a temp folder.
  outDir: string;

  constructor(outDir: string = LogosTargetLocation.Original) {
    super();
    this.outDir = outDir;
    fs.mkdirSync(outDir, { recursive: true });
  }

  protected async recognizeManufacturers() {
    const document = await this.loadDocument(Url.AllManufacturers);

    document(Selectors.AllManufacturers).each((_, element) => {
      const node = document(element);
      const url = node.attr("href");
      const name = node.text().trim();
      if (url && name) this.manufacturers.push({ name, url: url.replace(/^\//, "") });
    });

    console.log(`Recognized ${this.manufacturers.length} manufacturers.`);
  }

  protected async downloadLogos(): Promise<void> {
    const queue = new this.queue({ concurrency: 3 });
    this.manufacturers.map(this.createLogoDownloader).forEach((r) => queue.push(r));

    await new Promise<void>((resolve, reject) =>
      queue.start((error) => (error ? reject(error) : resolve()))
    );

    console.log(`Downloaded ${this.chalk.bold(this.logos.length)} manufacturers logos.`);
  }

  protected createLogoDownloader = (manufacturer: Manufacturer) => {
    return async () => {
      const msg = `Logo of ${this.chalk.bold(manufacturer.name)} - ${manufacturer.url} `;
      try {
        const document = await this.loadDocument(Url.Manufacturer(manufacturer.url));
        const usedUrl = pickLogoUrl(document);
        if (!usedUrl) throw new Error(`${msg}${this.chalk.red("not found")}`);

        const slug = this.slugify(manufacturer.name).toLowerCase();
        const fileName = `${slug}.${this.getFileExtFromUrl(usedUrl)}`;
        await this.downloadFile(usedUrl, path.join(this.outDir, fileName));

        this.logos.push({ name: manufacturer.name, slug, image: { source: usedUrl } });
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
