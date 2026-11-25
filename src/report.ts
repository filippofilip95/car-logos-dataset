import * as fs from "fs";
import * as path from "path";
import { buildReport, reportMarkdown } from "./diff";

// npm run report -- <crawlDir>: rebuilds the diff report for an existing crawl.
(async function () {
  const out = path.resolve(process.argv[2]);
  const report = await buildReport(out);
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(out, "report.md"), reportMarkdown(report));
  console.log(reportMarkdown(report).split("\n").slice(0, 4).join("\n"));
})();
