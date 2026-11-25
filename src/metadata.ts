import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { META_JSON_PATH } from "./config";

// Adds open brand metadata to logos/data.json: wikidataId, country, founded, nhtsaMakeId.
// Sources: Wikidata (CC0) over SPARQL, NHTSA vPIC GetAllMakes (public domain). Run: npm run metadata
//   --refresh   re-resolve every brand instead of reusing metadata/sources.json
//   --offline   use cache/metadata/ only, never the network
// A value is null when the source has none, or more than one that disagree; it is never guessed.

export const USER_AGENT = "car-logos-dataset-metadata/1.0 (https://github.com/filippofilip95/car-logos-dataset)";
const SPARQL_URL = "https://query.wikidata.org/sparql";
const VPIC_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json";
// GetAllMakes also lists trailer, motorcycle and body builders; a brand only matches a make registered for one of these.
const VPIC_TYPES = ["car", "truck", "multipurpose passenger vehicle (mpv)", "bus", "low speed vehicle (lsv)", "incomplete vehicle"];
const vpicTypeUrl = (t: string) => `https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/${encodeURIComponent(t)}?format=json`;
const CACHE_DIR = path.resolve("cache/metadata");
const SOURCES_PATH = path.resolve("metadata/sources.json");
const OVERRIDES_PATH = path.resolve("metadata/overrides.json");
const BATCH = 25;
const PAUSE_MS = 1500;
export const YEAR_MIN = 1800;
export const YEAR_MAX = 2026;

export type Candidate = { qid: string; label: string; description: string; classes: string[]; sitelinks: number };
export type Resolution =
  | { kind: "match"; candidate: Candidate; others: Candidate[] }
  | { kind: "ambiguous"; candidates: Candidate[] }
  | { kind: "none" };
export type Override = {
  wikidataId?: string | null;
  country?: string | null;
  founded?: number | null;
  nhtsaMakeId?: number | null;
  reason: string;
  evidence?: string;
};
export type BrandMeta = { wikidataId: string | null; country: string | null; founded: number | null; nhtsaMakeId: number | null };
export const META_KEYS = ["wikidataId", "country", "founded", "nhtsaMakeId"] as const;

// --- pure matching ---

/** Comparable form of a name: no diacritics, case, punctuation or spaces. "Škoda" -> "SKODA". */
export function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "AND")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

const SUFFIXES = ["Motors", "Motor", "Automobiles", "Automobile", "Auto", "Automotive", "Cars", "Motor Company", "Group"];

/** Second-pass labels for a brand with no hit: the company names it is often filed under ("Zenos" -> "Zenos Cars"). */
export function suffixVariants(name: string): string[] {
  if (new RegExp(`\\b(${SUFFIXES.join("|")})$`, "i").test(name)) return [];
  return labelVariants(name).flatMap((n) => SUFFIXES.map((s) => `${n} ${s}`));
}

/** Exact labels to look up on Wikidata: the name, and its Title case when it is all caps ("AVATR" -> "Avatr"). */
export function labelVariants(name: string): string[] {
  const out = [name];
  if (/^[A-Z0-9 -]+$/.test(name) && /[A-Z]{2}/.test(name)) {
    out.push(name.toLowerCase().replace(/(^|[ -])([a-z])/g, (_, s, c) => s + c.toUpperCase()));
  }
  return [...new Set(out)];
}

// Class labels (P31, English) that say "this is a car maker or a marque", and "this is a car model".
const MAKER = /\b(car brand|automobile (manufacturer|marque|brand)|automotive (company|brand|marque|manufacturer)|(vehicle|truck|bus|motorcycle|tractor|coach|car|sports car|electric vehicle|commercial vehicle|motor vehicle) (manufacturer|brand|marque|company)|coachbuilder|marque)\b/i;
const MODEL = /\b(car model|automobile model|model series|vehicle model)\b/i;
// A generic organisation or brand class counts as a maker only when the description says it makes vehicles.
const ORG = /\b(business|enterprise|company|organi[sz]ation|brand|trademark|corporation|subsidiary|division|conglomerate|joint venture)\b/i;
const MAKER_DESC = /\b((car|cars|automobiles?|automotive|vehicles?|trucks?|bus|buses|coach|motor|electric vehicle|supercars?|sports cars?)\b.*\b(manufacturer|maker|brand|marque|company|firm|tuner|coachbuilder|producer|division|subsidiary|startup|corporation|builder)|(manufacturer|maker|producer|make) of\b.*\b(cars|automobiles|vehicles|trucks|buses|coaches)|automaker|carmaker|coachbuilder)\b/i;

/** 1 = maker or marque, 2 = car model, 3 = automotive only by its description (always reviewed by hand). */
export function tier(c: Candidate): 1 | 2 | 3 {
  if (c.classes.some((x) => MAKER.test(x))) return 1;
  if (c.classes.some((x) => ORG.test(x)) && MAKER_DESC.test(c.description)) return 1;
  if (c.classes.some((x) => MODEL.test(x))) return 2;
  return 3;
}

/**
 * Picks the item a brand name means, from exact-label candidates that look automotive.
 * The best tier wins; within it one candidate must have at least twice the sitelinks of the next,
 * else the brand is ambiguous and needs metadata/overrides.json. Tier 3 is never picked alone.
 */
export function resolve(candidates: Candidate[]): Resolution {
  if (!candidates.length) return { kind: "none" };
  const best = Math.min(...candidates.map(tier));
  const top = candidates.filter((c) => tier(c) === best).sort((a, b) => b.sitelinks - a.sitelinks || a.qid.localeCompare(b.qid));
  if (best === 3) return { kind: "ambiguous", candidates: top };
  if (top.length === 1 || top[0].sitelinks >= 2 * top[1].sitelinks) {
    return { kind: "match", candidate: top[0], others: candidates.filter((c) => c !== top[0]) };
  }
  return { kind: "ambiguous", candidates: top };
}

/** One ISO 3166-1 alpha-2 code: P495 (country of origin) first, else P17 (country); null when they disagree. */
export function pickCountry(origin: string[], country: string[]): string | null {
  for (const values of [origin, country]) {
    const codes = [...new Set(values.filter((v) => /^[A-Z]{2}$/.test(v)))];
    if (codes.length === 1) return codes[0];
    if (codes.length > 1) return null;
  }
  return null;
}

/** Year from P571 (inception) values {time, precision}; precision 9 = year or finer. Null when none or they disagree. */
export function pickYear(values: { time: string; precision: number }[]): number | null {
  const years = new Set<number>();
  for (const v of values) {
    const m = /^\+?(\d{4})-/.exec(v.time);
    if (!m || v.precision < 9) continue;
    years.add(Number(m[1]));
  }
  if (years.size !== 1) return null;
  const [year] = years;
  return year >= YEAR_MIN && year <= YEAR_MAX ? year : null;
}

/** vPIC make id for a brand name by exact normalized name; null when absent or when two makes share the name. */
export function nhtsaMatch(name: string, makes: { Make_ID: number; Make_Name: string }[]): number | null | "ambiguous" {
  const key = normalize(name);
  const ids = [...new Set(makes.filter((m) => normalize(m.Make_Name) === key).map((m) => m.Make_ID))];
  if (ids.length === 0) return null;
  return ids.length === 1 ? ids[0] : "ambiguous";
}

/** Brand with the four metadata keys right after slug, so data.json keeps one stable key order. */
export function withMeta<T extends { name: string; slug: string }>(logo: T, meta: BrandMeta): T {
  const { name, slug, ...rest } = logo as any;
  for (const k of META_KEYS) delete rest[k];
  return { name, slug, ...meta, ...rest };
}

// --- network, polite and cached ---

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let offline = false;

async function cached(key: string, fetcher: () => Promise<any>): Promise<any> {
  const file = path.join(CACHE_DIR, crypto.createHash("sha1").update(key).digest("hex") + ".json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf-8"));
  if (offline) throw new Error(`--offline and no cache for ${key.slice(0, 80)}`);
  const body = await fetcher();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(body));
  return body;
}

async function getJson(url: string, init: RequestInit = {}): Promise<any> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...(init.headers || {}) } });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * 2 ** attempt;
      console.warn(`  ${res.status} from ${new URL(url).host}, waiting ${Math.round(wait / 1000)} s`);
      await sleep(wait);
      continue;
    }
    throw new Error(`${res.status} ${res.statusText} from ${url.slice(0, 120)}`);
  }
  throw new Error(`gave up on ${url.slice(0, 120)}`);
}

async function sparql(query: string): Promise<any[]> {
  const body = await cached(query, async () => {
    await sleep(PAUSE_MS);
    return getJson(SPARQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" },
      body: new URLSearchParams({ query }).toString(),
    });
  });
  return body.results.bindings;
}

const lit = (s: string) => JSON.stringify(s);
const qidOf = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);
const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

const AUTO_DESC = "(^|[^a-z])(car|cars|automobiles?|automotive|vehicles?|motors?|trucks?|bus|buses|marque|coachbuilder|tuner|tuning|supercars?|sports cars?)([^a-z]|$)";

/** Items whose English or multilingual label or alias is exactly one of `labels` and that look automotive. */
async function candidatesFor(labels: string[]): Promise<Map<string, Candidate[]>> {
  const values = labels.flatMap((l) => [`${lit(l)}@en`, `${lit(l)}@mul`]).join(" ");
  const rows = await sparql(`SELECT ?l ?item ?label ?desc ?links (GROUP_CONCAT(DISTINCT ?cl; separator="|") AS ?classes) WHERE {
  VALUES ?l { ${values} }
  ?item rdfs:label|skos:altLabel ?l ; wikibase:sitelinks ?links .
  OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "en") }
  OPTIONAL { ?item wdt:P31 ?c . ?c rdfs:label ?cl FILTER(LANG(?cl) = "en") }
  FILTER(REGEX(COALESCE(?desc, ""), "${AUTO_DESC}", "i") || EXISTS { ?item wdt:P31/rdfs:label ?x FILTER(LANG(?x) = "en" && REGEX(?x, "car|automobile|automotive|vehicle|truck|bus manufacturer|marque|coachbuilder", "i")) })
} GROUP BY ?l ?item ?label ?desc ?links`);
  const out = new Map<string, Candidate[]>();
  for (const r of rows) {
    const key = r.l.value;
    const list = out.get(key) || [];
    const qid = qidOf(r.item.value);
    if (!list.some((c) => c.qid === qid)) {
      list.push({
        qid,
        label: r.label?.value || key,
        description: r.desc?.value || "",
        classes: r.classes?.value ? r.classes.value.split("|") : [],
        sitelinks: Number(r.links.value),
      });
    }
    out.set(key, list);
  }
  return out;
}

type Facts = { label: string; description: string; origin: string[]; country: string[]; inception: { time: string; precision: number }[] };

async function factsFor(qids: string[]): Promise<Map<string, Facts>> {
  const out = new Map<string, Facts>();
  for (const q of qids) out.set(q, { label: "", description: "", origin: [], country: [], inception: [] });
  for (const part of chunk(qids, 100)) {
    const rows = await sparql(`SELECT ?item ?p ?iso ?time ?prec ?label ?desc WHERE {
  VALUES ?item { ${part.map((q) => "wd:" + q).join(" ")} }
  { ?item wdt:P495/wdt:P297 ?iso . BIND("P495" AS ?p) }
  UNION { ?item wdt:P17/wdt:P297 ?iso . BIND("P17" AS ?p) }
  UNION { ?item p:P571 ?st . ?st a wikibase:BestRank ; psv:P571 ?v . ?v wikibase:timeValue ?time ; wikibase:timePrecision ?prec . BIND("P571" AS ?p) }
  UNION { ?item rdfs:label ?label FILTER(LANG(?label) = "en") }
  UNION { ?item schema:description ?desc FILTER(LANG(?desc) = "en") }
}`);
    for (const r of rows) {
      const f = out.get(qidOf(r.item.value));
      if (!f) continue;
      if (r.label) f.label = r.label.value;
      if (r.desc) f.description = r.desc.value;
      if (r.p?.value === "P495") f.origin.push(r.iso.value);
      if (r.p?.value === "P17") f.country.push(r.iso.value);
      if (r.p?.value === "P571") f.inception.push({ time: r.time.value, precision: Number(r.prec.value) });
    }
  }
  return out;
}

// --- main ---

type Source = { wikidataId: string | null; label?: string; description?: string; via: string; nhtsaMakeId: number | null; nhtsaName?: string };

async function main() {
  const refresh = process.argv.includes("--refresh");
  offline = process.argv.includes("--offline");
  const data: any[] = JSON.parse(fs.readFileSync(META_JSON_PATH, "utf-8"));
  const overrides: Record<string, Override> = fs.existsSync(OVERRIDES_PATH) ? JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf-8")) : {};
  const sources: Record<string, Source> = !refresh && fs.existsSync(SOURCES_PATH) ? JSON.parse(fs.readFileSync(SOURCES_PATH, "utf-8")) : {};
  for (const slug of Object.keys(overrides)) {
    if (!data.some((l) => l.slug === slug)) throw new Error(`metadata/overrides.json: ${slug} is not in data.json`);
    if (!overrides[slug].reason) throw new Error(`metadata/overrides.json: ${slug} has no reason`);
  }

  // 1. Wikidata QID per brand: lock file, else exact label match.
  const todo = data.filter((l) => !sources[l.slug] && !(overrides[l.slug] && "wikidataId" in overrides[l.slug]));
  const review: string[] = [];
  if (todo.length) {
    const byLabel = new Map<string, Candidate[]>();
    const labels = [...new Set(todo.flatMap((l) => labelVariants(l.name)))];
    for (const [i, part] of chunk(labels, BATCH).entries()) {
      console.log(`wikidata: labels ${i * BATCH + 1}-${i * BATCH + part.length} of ${labels.length}`);
      for (const [k, v] of await candidatesFor(part)) byLabel.set(k, v);
    }
    const firstHit = (l: any) => resolve(labelVariants(l.name).flatMap((v) => byLabel.get(v) || [])).kind === "match";
    const second = [...new Set(todo.filter((l) => !firstHit(l)).flatMap((l) => suffixVariants(l.name)))];
    for (const [i, part] of chunk(second, BATCH).entries()) {
      console.log(`wikidata: suffixed labels ${i * BATCH + 1}-${i * BATCH + part.length} of ${second.length}`);
      for (const [k, v] of await candidatesFor(part)) byLabel.set(k, v);
    }
    for (const l of todo) {
      const first = labelVariants(l.name).flatMap((v) => byLabel.get(v) || []);
      const cands = resolve(first).kind === "match" ? first : [...first, ...suffixVariants(l.name).flatMap((v) => byLabel.get(v) || [])];
      const unique = cands.filter((c, i) => cands.findIndex((d) => d.qid === c.qid) === i);
      const r = resolve(unique);
      const show = (c: Candidate) => `${c.qid} "${c.label}: ${c.description}" [${c.classes.join(", ")}] links ${c.sitelinks}`;
      if (r.kind === "match") {
        sources[l.slug] = { wikidataId: r.candidate.qid, label: r.candidate.label, description: r.candidate.description, via: "label", nhtsaMakeId: null };
        if (r.others.length) review.push(`picked ${l.slug}: ${show(r.candidate)}\n    over ${r.others.map(show).join("\n    over ")}`);
      } else {
        sources[l.slug] = { wikidataId: null, via: r.kind, nhtsaMakeId: null };
        if (r.kind === "ambiguous") review.push(`AMBIGUOUS ${l.slug} (${l.name}):\n    ${r.candidates.map(show).join("\n    ")}`);
      }
    }
  }

  // 2. NHTSA vPIC make id: one GetAllMakes call, cached.
  const vpic = await cached(VPIC_URL, () => getJson(VPIC_URL));
  const motor = new Set<number>();
  for (const t of VPIC_TYPES) {
    const r = await cached(vpicTypeUrl(t), async () => (await sleep(500), getJson(vpicTypeUrl(t))));
    for (const m of r.Results) motor.add(m.MakeId);
  }
  const makes: { Make_ID: number; Make_Name: string }[] = vpic.Results.filter((m: any) => motor.has(m.Make_ID));
  for (const l of data) {
    const s = (sources[l.slug] ||= { wikidataId: null, via: "override", nhtsaMakeId: null });
    const id = nhtsaMatch(l.name, makes);
    if (id === "ambiguous") review.push(`AMBIGUOUS nhtsa ${l.slug}: ${makes.filter((m) => normalize(m.Make_Name) === normalize(l.name)).map((m) => `${m.Make_ID} ${m.Make_Name}`).join(", ")}`);
    s.nhtsaMakeId = typeof id === "number" ? id : null;
    s.nhtsaName = typeof id === "number" ? makes.find((m) => m.Make_ID === id).Make_Name : undefined;
  }

  // 3. Facts for every QID (overrides included), then write.
  const qidOfSlug = (slug: string) => (overrides[slug] && "wikidataId" in overrides[slug] ? overrides[slug].wikidataId : sources[slug]?.wikidataId) ?? null;
  const qids = [...new Set(data.map((l) => qidOfSlug(l.slug)).filter(Boolean))] as string[];
  const facts = await factsFor(qids);
  const seen = new Map<string, string>();
  const out = data.map((l) => {
    const qid = qidOfSlug(l.slug);
    if (qid && seen.has(qid)) review.push(`DUPLICATE ${qid}: ${seen.get(qid)} and ${l.slug}`);
    if (qid) seen.set(qid, l.slug);
    const f = qid ? facts.get(qid) : undefined;
    if (overrides[l.slug] && "wikidataId" in overrides[l.slug]) {
      Object.assign(sources[l.slug], { wikidataId: qid, label: f?.label, description: f?.description, via: "override" });
    }
    const o = overrides[l.slug] || ({} as Override);
    const meta: BrandMeta = {
      wikidataId: qid,
      country: "country" in o ? o.country : f ? pickCountry(f.origin, f.country) : null,
      founded: "founded" in o ? o.founded : f ? pickYear(f.inception) : null,
      nhtsaMakeId: "nhtsaMakeId" in o ? o.nhtsaMakeId : sources[l.slug].nhtsaMakeId,
    };
    return withMeta(l, meta);
  });

  fs.mkdirSync(path.dirname(SOURCES_PATH), { recursive: true });
  const sorted = Object.fromEntries(Object.keys(sources).sort().map((k) => [k, sources[k]]));
  fs.writeFileSync(SOURCES_PATH, JSON.stringify(sorted, null, 2) + "\n");
  fs.writeFileSync(META_JSON_PATH, JSON.stringify(out, null, 2));
  if (review.length) console.log(`\nreview (${review.length}):\n  ${review.join("\n  ")}`);
  console.log(`\ncoverage of ${out.length} brands:`);
  for (const k of META_KEYS) {
    const n = out.filter((l) => l[k] !== null).length;
    console.log(`  ${k.padEnd(12)} ${String(n).padStart(3)} (${((100 * n) / out.length).toFixed(1)} %)`);
  }
  console.log(`  overrides    ${Object.keys(overrides).length}`);
}

if (process.argv[1] && process.argv[1].endsWith("metadata.ts")) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
