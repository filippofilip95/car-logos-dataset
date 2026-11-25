import * as fs from "fs";
import { META_JSON_PATH } from "./config";

// Number of logos in the committed data.json (0 when it does not exist yet).
export function currentLogoCount(metaPath: string = META_JSON_PATH): number {
  if (!fs.existsSync(metaPath)) return 0;
  const data = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  return Array.isArray(data) ? data.length : 0;
}

// Stops a run that would shrink the dataset, e.g. when the crawler finds nothing
// because the source site changed. Thousands of apps read data.json directly.
export function assertNoShrink(next: number, current: number): void {
  if (next < current) {
    throw new Error(
      `Refusing to write: this run has ${next} logos, data.json has ${current}. ` +
        `The crawler is probably broken (source site changed). Nothing was written. ` +
        `Add missing logos via local-logos/ instead, see CONTRIBUTING.md.`
    );
  }
}
