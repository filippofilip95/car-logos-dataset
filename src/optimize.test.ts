import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import sharp from "sharp";
import ImageOptimizer from "./ImageOptimizer";
import { LogosTargetLocation, THUMB_HEIGHT } from "./config";

// Smoke test for the image pipeline: the ImageOptimizer settings on committed originals
// (transparent PNG, opaque JPG), written to a temp folder, never into logos/.
const optimizer = new ImageOptimizer();
const out = fs.mkdtempSync(path.join(os.tmpdir(), "car-logos-optimize-"));

for (const [file, alpha] of [["bmw.png", true], ["aro.jpg", false]] as const) {
  test(`optimize + thumb keep size, format and transparency: ${file}`, async () => {
    const src = path.join(LogosTargetLocation.Original, file);
    const optimized = path.join(out, `opt-${file}.png`);
    const thumb = path.join(out, `thumb-${file}.png`);

    await sharp(src).png(optimizer.optimizeOpts).toFile(optimized);
    await sharp(optimized).png(optimizer.optimizeOpts).resize(optimizer.resizeOpts).toFile(thumb);

    const o = await sharp(src).metadata();
    const opt = await sharp(optimized).metadata();
    const th = await sharp(thumb).metadata();

    assert.equal(opt.format, "png");
    assert.deepEqual([opt.width, opt.height], [o.width, o.height]);
    assert.equal(opt.hasAlpha, alpha);

    assert.equal(th.format, "png");
    assert.equal(th.height, THUMB_HEIGHT);
    assert.equal(th.width, Math.round((o.width! * THUMB_HEIGHT) / o.height!));
    assert.equal(th.hasAlpha, alpha);
  });
}
