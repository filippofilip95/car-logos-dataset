// Checks logos/data.json against the files on disk. Run: npm run validate
import fs from "fs";
import path from "path";

const root = process.cwd();
const BASE = "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/";
const errors = [];
const err = (m) => errors.push(m);

const data = JSON.parse(fs.readFileSync(path.join(root, "logos/data.json"), "utf8"));
if (!Array.isArray(data)) throw new Error("logos/data.json must be an array");

const slugs = new Set();
const referenced = new Set();
for (const logo of data) {
  const id = logo.slug || JSON.stringify(logo).slice(0, 60);
  if (!logo.name || !logo.slug) err(`${id}: missing name or slug`);
  if (slugs.has(logo.slug)) err(`${id}: duplicate slug`);
  slugs.add(logo.slug);
  const img = logo.image || {};
  if (!/^https?:\/\//.test(img.source || "")) err(`${id}: source is not a public URL: ${img.source}`);
  for (const [remote, local, dir] of [
    ["thumb", "localThumb", "thumb"],
    ["optimized", "localOptimized", "optimized"],
    ["original", "localOriginal", "original"],
  ]) {
    const url = img[remote] || "";
    if (!url.startsWith(`${BASE}logos/${dir}/`)) err(`${id}: ${remote} URL is off: ${url}`);
    const rel = url.slice(BASE.length);
    if (!fs.existsSync(path.join(root, rel))) err(`${id}: ${rel} does not exist`);
    if (img[local] !== `./${rel.slice("logos/".length)}`) err(`${id}: ${local} does not match ${remote}`);
    referenced.add(rel);
  }
}

for (const dir of ["thumb", "optimized", "original"]) {
  for (const f of fs.readdirSync(path.join(root, "logos", dir))) {
    if (!referenced.has(`logos/${dir}/${f}`)) err(`logos/${dir}/${f} is not in data.json`);
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const n = data.length;
if (!pkg.description.includes(`${n} `)) err(`package.json description does not say ${n} logos`);
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
if (!readme.includes(`**${n} car manufacturer logos**`)) err(`README.md does not say ${n} logos`);

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\nvalidate: ${errors.length} problem(s) in ${n} logos`);
  process.exit(1);
}
console.log(`validate: ok, ${n} logos`);
