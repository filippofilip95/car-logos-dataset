import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import LogoScrapper from "./LogoScrapper";
import { buildReport, reportMarkdown } from "./diff";

// npm start [outDir]: crawls into a temp folder and writes a diff report there.
// It never touches logos/; `npm run apply` copies chosen logos over.
(async function () {
  const out = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "car-logos-crawl-")));
  const logos = await new LogoScrapper(path.join(out, "original")).run();
  fs.writeFileSync(path.join(out, "scraped.json"), JSON.stringify(logos, null, 2));
  const report = await buildReport(out);
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(out, "report.md"), reportMarkdown(report));
  console.log(reportMarkdown(report).split("\n").slice(0, 4).join("\n"));
  console.log(`\nCrawl and report in ${out}`);
})();
