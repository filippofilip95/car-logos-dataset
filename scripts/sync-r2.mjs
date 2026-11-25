// Uploads logos/{thumb,optimized,original} to the R2 bucket `car-logos` under v<version>/,
// with immutable cache headers. Run after tagging a release: npm run sync:r2
//   --dry-run   write the manifests and print what would be uploaded, upload nothing
//   --local     upload to wrangler's local R2 (for testing), no tag check
// Needs `npm ci --prefix api` (wrangler) and, for the real upload, `wrangler login`.
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const BUCKET = "car-logos";
const CACHE = "public, max-age=31536000, immutable";
const TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

const root = process.cwd();
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const local = args.includes("--local");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const tag = `v${version}`;

if (!dry && !local) {
  // only a tagged release goes up: v<version>/ is immutable once uploaded
  const tagged = spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]).status === 0;
  if (!tagged) {
    console.error(`sync-r2: tag ${tag} does not exist; tag the release first (git fetch --tags)`);
    process.exit(1);
  }
}

// one manifest per content type: `wrangler r2 bulk put` sets one content type per call
const manifests = {};
for (const dir of ["thumb", "optimized", "original"]) {
  for (const file of fs.readdirSync(path.join(root, "logos", dir))) {
    if (file.startsWith(".")) continue;
    const ext = path.extname(file).slice(1).toLowerCase();
    if (!TYPES[ext]) throw new Error(`logos/${dir}/${file}: no content type for .${ext}`);
    (manifests[TYPES[ext]] ||= []).push({ key: `${tag}/${dir}/${file}`, file: path.join(root, "logos", dir, file) });
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "car-logos-r2-"));
const wrangler = path.join(root, "api", "node_modules", ".bin", "wrangler");
if (!dry && !fs.existsSync(wrangler)) {
  console.error("sync-r2: wrangler missing, run `npm ci --prefix api` first");
  process.exit(1);
}
let total = 0;
for (const [type, entries] of Object.entries(manifests)) {
  const file = path.join(tmp, `${type.replace("/", "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(entries));
  total += entries.length;
  const cmd = ["r2", "bulk", "put", BUCKET, "--filename", file, "--content-type", type, "--cache-control", CACHE,
    local ? "--local" : "--remote", "-c", path.join(root, "api", "wrangler.jsonc")];
  console.log(`${entries.length} x ${type} -> ${BUCKET}/${tag}/ (e.g. ${entries[0].key})`);
  if (dry) console.log(`  wrangler ${cmd.join(" ")}`);
  else execFileSync(wrangler, cmd, { stdio: "inherit" });
}
console.log(`sync-r2: ${dry ? "would upload" : "uploaded"} ${total} files to ${BUCKET}/${tag}/`);
