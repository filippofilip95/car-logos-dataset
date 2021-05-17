import * as fs from "fs";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import fetch from "node-fetch";
import queue from "queue";
import chalk from "chalk";
import slugify from "slugify";

class BaseScrapper {
  queue = queue;
  chalk = chalk;
  slugify = slugify;

  protected async loadDocument(url: string): Promise<CheerioAPI> {
    const response = await fetch(url);
    const text = await response.text();

    return cheerio.load(text);
  }

  protected async downloadFile(url: string, path: string) {
    const res = await fetch(url, { timeout: 20000 });
    const fileStream = fs.createWriteStream(path);

    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on("error", reject);
      fileStream.on("finish", resolve);
    });
  }

  protected getFileExtension(url: string) {
    return (url.match(/\.([^.]*?)(?=\?|#|$)/) || [])[1];
  }
}

export default BaseScrapper;
