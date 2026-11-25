import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import ImageOptimizer from "./ImageOptimizer";
import { LocalAccessPath, LogosTargetLocation, META_JSON_PATH, PublicAccessUrl } from "./config";
import { assertNoShrink, currentLogoCount } from "./guard";
import { ManufacturerLogos } from "./types";

// npm run apply -- <crawlDir> [--add a,b] [--replace c,d] [--local e,f]
//   --add      new brands from the crawl
//   --replace  existing brands whose upstream logo is clearly the current mark (same file name kept)
//   --local    brands from local-logos/metadata.json
// Never renames or removes a slug or a file.
type Pick = { slug: string; name: string; source: string; from: string };

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1].split(",").filter(Boolean) : [];
};

export function upsert(data: ManufacturerLogos, entry: ManufacturerLogos[number]): ManufacturerLogos {
  const rest = data.filter((l) => l.slug !== entry.slug);
  return [...rest, entry].sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const crawl = process.argv[2] && !process.argv[2].startsWith("--") ? path.resolve(process.argv[2]) : "";
  let data: ManufacturerLogos = JSON.parse(fs.readFileSync(META_JSON_PATH, "utf-8"));
  const bySlug = new Map(data.map((l) => [l.slug, l]));
  const picks: (Pick & { replace: boolean })[] = [];

  const scraped = crawl ? JSON.parse(fs.readFileSync(path.join(crawl, "scraped.json"), "utf-8")) : [];
  const crawlFiles = crawl ? fs.readdirSync(path.join(crawl, "original")) : [];
  for (const [flag, replace] of [["--add", false], ["--replace", true]] as const) {
    for (const slug of arg(flag)) {
      const up = scraped.find((l) => l.slug === slug);
      const file = crawlFiles.find((f) => f.split(".")[0] === slug);
      if (!up || !file) throw new Error(`${slug}: not in the crawl`);
      picks.push({ slug, name: up.name, source: up.image.source, from: path.join(crawl, "original", file), replace });
    }
  }
  const meta = JSON.parse(fs.readFileSync(path.resolve("local-logos/metadata.json"), "utf-8"));
  for (const slug of arg("--local")) {
    const m = meta.find((l) => l.slug === slug);
    if (!m) throw new Error(`${slug}: not in local-logos/metadata.json`);
    picks.push({
      slug,
      name: m.name,
      source: m.source || PublicAccessUrl.Local(m.fileName),
      from: path.resolve("local-logos", m.fileName),
      replace: bySlug.has(slug),
    });
  }

  const optimizer = new ImageOptimizer();
  for (const p of picks) {
    const existing = bySlug.get(p.slug);
    if (existing && !p.replace) throw new Error(`${p.slug}: already in data.json, use --replace`);
    // Keep the existing file name (and so its URL); a new brand keeps the source extension.
    const original = existing
      ? path.basename(existing.image.localOriginal)
      : `${p.slug}.${path.extname(p.from).slice(1)}`;
    const target = path.join(LogosTargetLocation.Original, original);
    if (path.extname(original) === path.extname(p.from)) fs.copyFileSync(p.from, target);
    // A JPG has no transparency: put the logo on white, not black.
    else await sharp(p.from).flatten({ background: "#ffffff" }).toFormat(path.extname(original).slice(1) as any).toFile(target);

    const derived = await optimizer.processOne(original);
    data = upsert(data, {
      name: existing ? existing.name : p.name,
      slug: p.slug,
      image: {
        source: p.source,
        thumb: PublicAccessUrl.Thumb(derived),
        optimized: PublicAccessUrl.Optimized(derived),
        original: PublicAccessUrl.Original(original),
        localThumb: LocalAccessPath.Thumb(derived),
        localOptimized: LocalAccessPath.Optimized(derived),
        localOriginal: LocalAccessPath.Original(original),
      },
    });
    console.log(`${existing ? "replaced" : "added"} ${p.slug}`);
  }

  assertNoShrink(data.length, currentLogoCount());
  fs.writeFileSync(META_JSON_PATH, JSON.stringify(data, null, 2));
  console.log(`data.json: ${data.length} logos`);
}

if (process.argv[1] && process.argv[1].endsWith("apply.ts")) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
