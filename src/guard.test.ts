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

test("the pipeline checks before optimizing and before writing", () => {
  const index = fs.readFileSync(path.resolve("src/index.ts"), "utf-8");
  const finalizer = fs.readFileSync(path.resolve("src/DataFinalizer.ts"), "utf-8");
  // match the call, not the import line
  const call = "assertNoShrink(";
  assert.ok(index.indexOf(call) > -1 && index.indexOf(call) < index.indexOf("new ImageOptimizer"));
  assert.ok(finalizer.indexOf(call) > -1 && finalizer.indexOf(call) < finalizer.indexOf("writeJsonFileSync(META_JSON_PATH"));
});
