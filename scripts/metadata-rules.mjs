// Format rules for the brand metadata fields in logos/data.json, shared by validate.mjs and the tests.
export const META_KEYS = ["wikidataId", "country", "founded", "nhtsaMakeId"];
export const YEAR_MAX = 2026;

const RULES = {
  wikidataId: [(v) => typeof v === "string" && /^Q[1-9]\d*$/.test(v), "a Wikidata id like Q123"],
  country: [(v) => typeof v === "string" && /^[A-Z]{2}$/.test(v), "an ISO 3166-1 alpha-2 code like CZ"],
  founded: [(v) => Number.isInteger(v) && v >= 1800 && v <= YEAR_MAX, `a year from 1800 to ${YEAR_MAX}`],
  nhtsaMakeId: [(v) => Number.isInteger(v) && v > 0, "a positive integer"],
};

/** Problems with one brand's metadata: every key present, each value null or of its format. */
export function checkMetadata(logo) {
  const out = [];
  for (const key of META_KEYS) {
    if (!(key in logo)) {
      out.push(`${key} is missing (run npm run metadata)`);
      continue;
    }
    const v = logo[key];
    const [ok, what] = RULES[key];
    if (v !== null && !ok(v)) out.push(`${key} must be null or ${what}: ${JSON.stringify(v)}`);
  }
  return out;
}

/** Count of non-null values per field. */
export function coverage(data) {
  return Object.fromEntries(META_KEYS.map((k) => [k, data.filter((l) => l[k] !== null && l[k] !== undefined).length]));
}
