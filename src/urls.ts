import * as fs from "fs";
import * as path from "path";
import { META_JSON_PATH, PublicAccessUrl } from "./config";
import { ManufacturerLogo, ManufacturerLogos } from "./types";

// Rewrites thumb/optimized/original of every logo from its local path, so the URLs always
// follow PublicAccessUrl (jsDelivr @v<package.json version>). Run: npm run urls
export function withPublicUrls(data: ManufacturerLogos): ManufacturerLogos {
  return data.map((logo: ManufacturerLogo) => ({
    ...logo,
    image: {
      ...logo.image,
      thumb: PublicAccessUrl.Thumb(path.basename(logo.image.localThumb)),
      optimized: PublicAccessUrl.Optimized(path.basename(logo.image.localOptimized)),
      original: PublicAccessUrl.Original(path.basename(logo.image.localOriginal)),
    },
  }));
}

if (process.argv[1] && process.argv[1].endsWith("urls.ts")) {
  const data = withPublicUrls(JSON.parse(fs.readFileSync(META_JSON_PATH, "utf-8")));
  fs.writeFileSync(META_JSON_PATH, JSON.stringify(data, null, 2));
  console.log(`data.json: ${data.length} logos, URLs at ${PublicAccessUrl.Thumb("")}`);
}
