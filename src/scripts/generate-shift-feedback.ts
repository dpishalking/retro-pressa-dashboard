import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { moscowDateIso } from "@/lib/shift-feedback/time";
import { buildShiftFeedbackReport, placeShiftPages } from "@/lib/shift-feedback/build";
import { renderShiftFeedbackHtml } from "@/lib/shift-feedback/render-html";
import type { ShiftFeedbackReport } from "@/lib/shift-feedback/types";

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function main() {
  const fromJson = process.argv.includes("--from-json");
  const dayArg = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
  const day = dayArg || moscowDateIso();
  const outDir = path.join(process.cwd(), "data/tmp");
  mkdirSync(outDir, { recursive: true });
  const stem = `smena-${day}`;
  const htmlPath = path.join(outDir, `${stem}.html`);
  const pdfPath = path.join(outDir, `${stem}.pdf`);
  const jsonPath = path.join(outDir, `${stem}.json`);

  let report: ShiftFeedbackReport;
  if (fromJson) {
    report = JSON.parse(readFileSync(jsonPath, "utf8")) as ShiftFeedbackReport;
    const placed = placeShiftPages(report.onShiftNames, [...report.managers, ...report.offShift]);
    report = {
      ...report,
      unmatchedSchedule: placed.unmatchedSchedule,
      managers: placed.managers,
      offShift: placed.offShift,
      team: {
        created: placed.managers.reduce((sum, row) => sum + row.leadsCreated, 0),
        dupes: placed.managers.reduce((sum, row) => sum + row.leadDupes, 0),
        unique: placed.managers.reduce((sum, row) => sum + row.leadUnique, 0),
        withUtm: placed.managers.reduce((sum, row) => sum + row.withUtm, 0),
        withoutUtm: placed.managers.reduce((sum, row) => sum + row.withoutUtm, 0),
        dialogs: placed.managers.reduce((sum, row) => sum + row.dialogs, 0),
        waitingOnUs: placed.managers.reduce((sum, row) => sum + row.waitingOnUs, 0)
      }
    };
  } else {
    report = await buildShiftFeedbackReport(day);
  }

  const html = renderShiftFeedbackHtml(report);
  writeFileSync(htmlPath, html);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const printed = spawnSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--virtual-time-budget=8000",
      `--print-to-pdf=${pdfPath}`,
      "--no-pdf-header-footer",
      pathToFileURL(htmlPath).href
    ],
    { encoding: "utf8" }
  );
  if (printed.status !== 0) {
    console.error(printed.stderr || printed.stdout || "Chrome print-to-pdf failed");
    console.error(`HTML saved: ${htmlPath}`);
    process.exit(1);
  }

  console.log(JSON.stringify({
    ok: true,
    day: report.day,
    liveCut: report.liveCut,
    cutLabel: report.cutLabel,
    onShift: report.onShiftNames,
    unmatchedSchedule: report.unmatchedSchedule,
    managers: report.managers.map((row) => ({ name: row.name, leads: row.leadsCreated, unique: row.leadUnique, dialogs: row.dialogs })),
    offShift: report.offShift.map((row) => row.name),
    htmlPath,
    pdfPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
