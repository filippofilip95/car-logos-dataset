import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import { Candidate, labelVariants, suffixVariants, nhtsaMatch, normalize, pickCountry, pickYear, resolve, tier, withMeta } from "./metadata";
// @ts-ignore: plain ESM shared with scripts/validate.mjs
import { checkMetadata, coverage } from "../scripts/metadata-rules.mjs";

const c = (qid: string, classes: string[], sitelinks: number, description = ""): Candidate => ({ qid, label: qid, description, classes, sitelinks });

test("normalize drops diacritics, case and punctuation", () => {
  assert.equal(normalize("Škoda"), "SKODA");
  assert.equal(normalize("Mercedes-Benz"), "MERCEDESBENZ");
  assert.equal(normalize("Lynk & Co"), "LYNKANDCO");
  assert.equal(normalize("Citroën"), "CITROEN");
});

test("labelVariants adds Title case for all-caps names only", () => {
  assert.deepEqual(labelVariants("AVATR"), ["AVATR", "Avatr"]);
  assert.deepEqual(labelVariants("Alfa Romeo"), ["Alfa Romeo"]);
  assert.deepEqual(labelVariants("9ff"), ["9ff"]);
});

test("suffixVariants: company names for a brand, none when it already has one", () => {
  assert.ok(suffixVariants("Zenos").includes("Zenos Cars"));
  assert.deepEqual(suffixVariants("Force Motors"), []);
});

test("tier: maker or marque, then car model, then description only", () => {
  assert.equal(tier(c("Q1", ["automobile manufacturer", "enterprise"], 1)), 1);
  assert.equal(tier(c("Q1", ["car brand"], 1)), 1);
  assert.equal(tier(c("Q1", ["truck manufacturer"], 1)), 1);
  assert.equal(tier(c("Q1", ["car model"], 1)), 2);
  assert.equal(tier(c("Q1", ["human"], 1, "racing car driver")), 3);
  assert.equal(tier(c("Q1", ["business"], 1, "American manufacturer of medium- and heavy-duty trucks")), 1);
  assert.equal(tier(c("Q1", ["business"], 1, "bulk carrier built in 1990")), 3);
  assert.equal(tier(c("Q1", ["human"], 1, "Italian automobile designer")), 3);
});

test("resolve: a single maker wins over models and description-only items", () => {
  const brand = c("Q116232", ["car brand"], 20);
  const r = resolve([c("Q36024", ["car model"], 60), brand, c("Q9", ["album"], 5, "car album")]);
  assert.equal(r.kind, "match");
  assert.equal(r.kind === "match" && r.candidate.qid, "Q116232");
});

test("resolve: two makers need a clear sitelink lead, else ambiguous", () => {
  const big = c("Q29637", ["automobile manufacturer"], 80);
  assert.equal(resolve([big, c("Q135700024", ["car brand"], 1)]).kind, "match");
  assert.equal(resolve([c("Q1", ["automobile manufacturer"], 30), c("Q2", ["car brand"], 20)]).kind, "ambiguous");
});

test("resolve: a model is picked when no maker matches, description-only never alone", () => {
  assert.equal(resolve([c("Q5", ["automobile model series"], 40)]).kind, "match");
  assert.equal(resolve([c("Q6", ["television series"], 40, "car tuning show")]).kind, "ambiguous");
  assert.equal(resolve([]).kind, "none");
});

test("pickCountry: origin first, then country, null on a conflict", () => {
  assert.equal(pickCountry(["CZ"], ["DE"]), "CZ");
  assert.equal(pickCountry([], ["DE", "DE"]), "DE");
  assert.equal(pickCountry(["GB", "US"], ["GB"]), null);
  assert.equal(pickCountry([], []), null);
});

test("pickYear: year precision only, null on a conflict or out of range", () => {
  assert.equal(pickYear([{ time: "+1895-01-01T00:00:00Z", precision: 9 }]), 1895);
  assert.equal(pickYear([{ time: "+1895-12-18T00:00:00Z", precision: 11 }, { time: "+1895-01-01T00:00:00Z", precision: 9 }]), 1895);
  assert.equal(pickYear([{ time: "+1890-01-01T00:00:00Z", precision: 8 }]), null);
  assert.equal(pickYear([{ time: "+1899-01-01T00:00:00Z", precision: 9 }, { time: "+1906-01-01T00:00:00Z", precision: 9 }]), null);
  assert.equal(pickYear([{ time: "+1700-01-01T00:00:00Z", precision: 9 }]), null);
});

test("nhtsaMatch: exact normalized name, ambiguous when two ids share it", () => {
  const makes = [
    { Make_ID: 448, Make_Name: "TOYOTA" },
    { Make_ID: 449, Make_Name: "MERCEDES-BENZ" },
    { Make_ID: 1, Make_Name: "GALAXY" },
    { Make_ID: 2, Make_Name: "Galaxy" },
  ];
  assert.equal(nhtsaMatch("Mercedes-Benz", makes), 449);
  assert.equal(nhtsaMatch("Toyota Crown", makes), null);
  assert.equal(nhtsaMatch("Galaxy", makes), "ambiguous");
});

test("withMeta puts the four keys after slug and replaces old values", () => {
  const out = withMeta({ name: "Skoda", slug: "skoda", country: "XX", image: {} } as any, { wikidataId: "Q29637", country: "CZ", founded: 1895, nhtsaMakeId: null });
  assert.deepEqual(Object.keys(out), ["name", "slug", "wikidataId", "country", "founded", "nhtsaMakeId", "image"]);
  assert.equal((out as any).country, "CZ");
});

test("checkMetadata: formats and null", () => {
  const ok = { wikidataId: "Q29637", country: "CZ", founded: 1895, nhtsaMakeId: 449 };
  assert.deepEqual(checkMetadata(ok), []);
  assert.deepEqual(checkMetadata({ wikidataId: null, country: null, founded: null, nhtsaMakeId: null }), []);
  assert.equal(checkMetadata({ ...ok, wikidataId: "29637" }).length, 1);
  assert.equal(checkMetadata({ ...ok, country: "cz" }).length, 1);
  assert.equal(checkMetadata({ ...ok, country: "CZE" }).length, 1);
  assert.equal(checkMetadata({ ...ok, founded: 1799 }).length, 1);
  assert.equal(checkMetadata({ ...ok, founded: 2027 }).length, 1);
  assert.equal(checkMetadata({ ...ok, founded: "1895" }).length, 1);
  assert.equal(checkMetadata({ ...ok, nhtsaMakeId: 1.5 }).length, 1);
  assert.match(checkMetadata({ wikidataId: null, country: null, founded: null })[0], /nhtsaMakeId is missing/);
});

test("coverage counts non-null values per field", () => {
  const cov = coverage([
    { wikidataId: "Q1", country: "CZ", founded: null, nhtsaMakeId: null },
    { wikidataId: "Q2", country: null, founded: null, nhtsaMakeId: 3 },
  ]);
  assert.deepEqual(cov, { wikidataId: 2, country: 1, founded: 0, nhtsaMakeId: 1 });
});

test("committed data.json passes the metadata rules", () => {
  const data = JSON.parse(fs.readFileSync("logos/data.json", "utf-8"));
  for (const logo of data) assert.deepEqual(checkMetadata(logo), [], logo.slug);
});

test("every override has a reason and a known slug", () => {
  const data = JSON.parse(fs.readFileSync("logos/data.json", "utf-8"));
  const slugs = new Set(data.map((l: any) => l.slug));
  const overrides = JSON.parse(fs.readFileSync("metadata/overrides.json", "utf-8"));
  for (const [slug, o] of Object.entries<any>(overrides)) {
    assert.ok(slugs.has(slug), slug);
    assert.ok(o.reason && o.reason.length > 10, `${slug}: reason`);
  }
});
