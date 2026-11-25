import { test } from "node:test";
import assert from "node:assert/strict";
import * as cheerio from "cheerio";
import { pickLogoUrl } from "./LogoScrapper";
import { upsert } from "./apply";

test("picks the newest dated history logo", () => {
  const $ = cheerio.load(`
    <img src="/car-logos/kia-logo.png" id="bd-logo">
    <img src="/car-logos/kia-logo-2012.png"><img src="/car-logos/kia-logo-2021.png"><img src="/car-logos/kia-logo-1994.png">`);
  assert.equal(pickLogoUrl($), "https://www.carlogos.org/car-logos/kia-logo-2021.png");
});

test("ignores other brands' images on the page", () => {
  const $ = cheerio.load(`
    <img src="/car-logos/denza-logo.png" id="bd-logo">
    <img src="/car-logos/denza-logo-2024.png"><img src="/car-logos/byd-logo-2025.png">`);
  assert.equal(pickLogoUrl($), "https://www.carlogos.org/car-logos/denza-logo-2024.png");
});

test("falls back to the header logo", () => {
  const $ = cheerio.load(`<img src="/car-logos/onvo-logo.png" id="bd-logo">`);
  assert.equal(pickLogoUrl($), "https://www.carlogos.org/car-logos/onvo-logo.png");
});

test("nothing found", () => {
  assert.equal(pickLogoUrl(cheerio.load("<p>no logo</p>")), undefined);
});

test("upsert replaces by slug and keeps name order", () => {
  const e = (name: string, slug: string) => ({ name, slug, image: {} as any });
  const out = upsert([e("Audi", "audi"), e("Kia", "kia")], e("Denza", "denza"));
  assert.deepEqual(out.map((l) => l.slug), ["audi", "denza", "kia"]);
  assert.equal(upsert(out, e("Kia", "kia")).length, 3);
});
