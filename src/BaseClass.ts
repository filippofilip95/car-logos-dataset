import * as fs from "fs";
import * as cheerio from "cheerio";
import {CheerioAPI} from "cheerio";
import fetch from "node-fetch";
import queue from "queue";
import chalk from "chalk";
import slugify from "slugify";

abstract class BaseClass {
    queue = queue;
    chalk = chalk;
    slugify = slugify;

    protected async loadDocument(url: string, retries: number = 3): Promise<CheerioAPI> {
        let attempts = 0;
        while (attempts < retries) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Request failed with status: ${response.status}`);
                }
                const text = await response.text();
                return cheerio.load(text);
            } catch (error) {
                attempts++;
                if (attempts >= retries) {
                    console.error(`${this.chalk.red("Failed after " + retries + " attempts:")} ${url} - ${error.message}`);
                }
                console.log(`Attempt ${attempts} failed. ${this.chalk.yellow("Retrying...")}`);
            }
        }
        throw new Error
    }

    protected async downloadFile(url: string, path: string) {
        const res = await fetch(url);
        const fileStream = fs.createWriteStream(path);

        await new Promise((resolve, reject) => {
            res.body.pipe(fileStream);
            res.body.on("error", reject);
            fileStream.on("finish", resolve);
        });
    }

    protected getFileExtFromUrl(url: string) {
        return (url.match(/\.([^.]*?)(?=\?|#|$)/) || [])[1];
    }

    protected getFileNameFromPath(path: string) {
        return path.split(".")[0];
    }

    protected getFileExtFromPath(path: string) {
        return path.split(".")[1];
    }

    protected writeJsonFileSync(path: string, data: string) {
        return fs.writeFileSync(path, data);
    }
}

export default BaseClass;
