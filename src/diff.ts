import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { META_JSON_PATH, LogosTargetLocation } from "./config";
import { ManufacturerLogos, ManufacturersLogos } from "./types";

// 64-bit average hash of a logo on white, ignoring padding, size and aspect ratio.
async function aHash(file: string): Promise<{ bits: boolean[]; w: number; h: number }> {
  // Trim the padding first: upstream pads every logo onto a 640x426 canvas.
  const { data, info } = await sharp(file)
    .flatten({ background: "#ffffff" })
    .trim()
    .toBuffer({ resolveWithObject: true });
  const meta = { width: info.width, height: info.height };
  const px = await sharp(data).greyscale().resize(8, 8, { fit: "fill" }).raw().toBuffer();
  const avg = px.reduce((a, b) => a + b, 0) / px.length;
  return { bits: [...px].map((v) => v < avg), w: meta.width || 0, h: meta.height || 0 };
}

const hamming = (a: boolean[], b: boolean[]) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type Report = {
  upstream: number;
  ours: number;
  added: { slug: string; name: string; source: string; file: string }[];
  changed: { slug: string; name: string; distance: number; ours: string; upstream: string; source: string }[];
  vanished: { slug: string; name: string }[];
  mismatches: { upstream: string; ours: string }[];
};

// Compares a crawl in `out` (scraped.json + original/) with logos/data.json. Writes nothing to logos/.
export async function buildReport(out: string): Promise<Report> {
  const scraped: ManufacturersLogos = JSON.parse(fs.readFileSync(path.join(out, "scraped.json"), "utf-8"));
  const ours: ManufacturerLogos = JSON.parse(fs.readFileSync(META_JSON_PATH, "utf-8"));
  const bySlug = new Map(ours.map((l) => [l.slug, l]));
  const byNorm = new Map(ours.map((l) => [norm(l.name), l]));
  const files = fs.readdirSync(path.join(out, "original"));
  const fileOf = (slug: string) => files.find((f) => f.split(".")[0] === slug);

  const report: Report = { upstream: scraped.length, ours: ours.length, added: [], changed: [], vanished: [], mismatches: [] };
  const seen = new Set<string>();

  for (const up of scraped) {
    const file = fileOf(up.slug);
    if (!file) continue;
    const mine = bySlug.get(up.slug);
    if (!mine) {
      // Same brand under a renamed slug: "ud" vs "ud-trucks", "Zarooq Motors" vs "Zarooq".
      const near =
        byNorm.get(norm(up.name)) ||
        ours.find((l) => up.slug.startsWith(`${l.slug}-`) || l.slug.startsWith(`${up.slug}-`));
      if (near) {
        report.mismatches.push({ upstream: `${up.name} (${up.slug})`, ours: `${near.name} (${near.slug})` });
        seen.add(near.slug);
      } else {
        report.added.push({ slug: up.slug, name: up.name, source: up.image.source, file });
      }
      continue;
    }
    seen.add(mine.slug);
    if (mine.name !== up.name) report.mismatches.push({ upstream: `${up.name} (${up.slug})`, ours: `${mine.name} (${mine.slug})` });
    const ourFile = path.join(LogosTargetLocation.Original, path.basename(mine.image.localOriginal));
    try {
      const [a, b] = await Promise.all([aHash(ourFile), aHash(path.join(out, "original", file))]);
      const distance = hamming(a.bits, b.bits);
      // ponytail: an 8x8 average hash is a rough signal; every "changed" row gets a human look before apply.
      if (distance > 12) {
        report.changed.push({ slug: mine.slug, name: mine.name, distance, ours: `${a.w}x${a.h}`, upstream: `${b.w}x${b.h}`, source: up.image.source });
      }
    } catch (e) {
      console.error(`compare ${mine.slug}: ${e.message}`);
    }
  }

  const upstreamSlugs = new Set(scraped.map((l) => l.slug));
  for (const l of ours) {
    if (!upstreamSlugs.has(l.slug) && !seen.has(l.slug) && l.image.source.includes("carlogos.org")) {
      report.vanished.push({ slug: l.slug, name: l.name });
    }
  }
  report.changed.sort((a, b) => b.distance - a.distance);
  return report;
}

export function reportMarkdown(r: Report): string {
  const lines = [
    `# Crawl diff`,
    ``,
    `Upstream brands: ${r.upstream}. Ours: ${r.ours}.`,
    `New: ${r.added.length}. Changed: ${r.changed.length}. Vanished upstream (kept): ${r.vanished.length}. Name/slug mismatches: ${r.mismatches.length}.`,
    ``,
    `## New`,
    ...r.added.map((a) => `- ${a.name} (\`${a.slug}\`) ${a.source}`),
    ``,
    `## Changed upstream (average-hash distance of 64, ours vs upstream trimmed size)`,
    ...r.changed.map((c) => `- ${c.name} (\`${c.slug}\`) ${c.distance}, ${c.ours} vs ${c.upstream} ${c.source}`),
    ``,
    `## Vanished upstream (kept)`,
    ...r.vanished.map((v) => `- ${v.name} (\`${v.slug}\`)`),
    ``,
    `## Name/slug mismatches`,
    ...r.mismatches.map((m) => `- upstream ${m.upstream}, ours ${m.ours}`),
    ``,
  ];
  return lines.join("\n");
}
