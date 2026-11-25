import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { assertNoShrink, currentLogoCount } from "./guard";

test("refuses a run with fewer logos than data.json", () => {
  assert.throws(() => assertNoShrink(4, 387), /Refusing to write: this run has 4 logos, data.json has 387/);
});

test("allows the same or more logos", () => {
  assert.doesNotThrow(() => assertNoShrink(387, 387));
  assert.doesNotThrow(() => assertNoShrink(390, 387));
});

test("counts the committed data.json", () => {
  assert.ok(currentLogoCount() > 300);
});

test("missing data.json counts as 0, so a first run is allowed", () => {
  assert.equal(currentLogoCount(path.join(os.tmpdir(), "no-such-car-logos.json")), 0);
  assert.doesNotThrow(() => assertNoShrink(4, currentLogoCount(path.join(os.tmpdir(), "no-such-car-logos.json"))));
});

test("apply checks before it writes data.json", () => {
  const apply = fs.readFileSync(path.resolve("src/apply.ts"), "utf-8");
  // match the call, not the import line
  const call = "assertNoShrink(";
  assert.ok(apply.indexOf(call) > -1 && apply.indexOf(call) < apply.indexOf("writeFileSync(META_JSON_PATH"));
});

test("the crawl entry never writes into logos/", () => {
  const index = fs.readFileSync(path.resolve("src/index.ts"), "utf-8");
  assert.ok(!/META_JSON_PATH|LogosTargetLocation|ImageOptimizer/.test(index));
});
