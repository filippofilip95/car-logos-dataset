import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import { CDN_BASE_URL, VERSION } from "./config";
import { withPublicUrls } from "./urls";

test("image URLs are jsDelivr pinned to the package.json version", () => {
  const [logo] = withPublicUrls([
    {
      name: "Skoda",
      slug: "skoda",
      image: {
        source: "https://www.carlogos.org/x.png",
        thumb: "old",
        optimized: "old",
        original: "old",
        localThumb: "./thumb/skoda.png",
        localOptimized: "./optimized/skoda.png",
        localOriginal: "./original/skoda.jpg",
      },
    },
  ]);
  const base = `https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@v${VERSION}`;
  assert.equal(logo.image.thumb, `${base}/logos/thumb/skoda.png`);
  assert.equal(logo.image.optimized, `${base}/logos/optimized/skoda.png`);
  assert.equal(logo.image.original, `${base}/logos/original/skoda.jpg`);
  assert.equal(logo.image.source, "https://www.carlogos.org/x.png");
});

test("the version comes from package.json", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
  assert.equal(VERSION, pkg.version);
  assert.equal(CDN_BASE_URL("9.9.9"), "https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@v9.9.9");
});

test("committed data.json matches the generator", () => {
  const data = JSON.parse(fs.readFileSync("logos/data.json", "utf-8"));
  assert.deepEqual(withPublicUrls(data), data);
});
