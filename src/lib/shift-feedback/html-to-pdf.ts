import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function chromePath(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium"
  ].filter((value): value is string => Boolean(value));
  return candidates.find((path) => existsSync(path)) ?? null;
}

export function htmlToPdfBuffer(html: string): Buffer | null {
  const chrome = chromePath();
  if (!chrome) return null;
  const dir = mkdtempSync(join(tmpdir(), "shift-pdf-"));
  const htmlPath = join(dir, "page.html");
  const pdfPath = join(dir, "page.pdf");
  writeFileSync(htmlPath, html);
  const printed = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      "--virtual-time-budget=4000",
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href
    ],
    { encoding: "utf8", timeout: 20000 }
  );
  try {
    if (printed.status !== 0 || !existsSync(pdfPath)) return null;
    return readFileSync(pdfPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
