import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { SHOWCASE_PAGE_IDS } from "../showcase.pages";

/**
 * The tripwire for the fixed template.
 *
 * Every page component must emit exactly one A4 page. If any page's content
 * grows past the sheet, react-pdf silently spills the remainder onto a new one —
 * which in the real document shifts every page number after it and quietly
 * invalidates the table of contents, whose numbers are compile-time constants.
 *
 * This caught a real regression on 2026-08-19: bumping the type scale to fix
 * sparse pages pushed three pages over, producing 18 sheets from 15 components.
 */
function renderPages(args: string[]): Promise<number> {
  const out = path.join(mkdtempSync(path.join(tmpdir(), "cfp-pages-")), "out.pdf");
  execFileSync("npx", ["tsx", "pdf/cfpReport/showcase.tsx", out, ...args], {
    cwd: path.resolve(__dirname, "../../.."),
    stdio: "pipe",
    shell: process.platform === "win32",
  });
  return PDFDocument.load(readFileSync(out)).then((d) => d.getPageCount());
}

describe("the document emits one sheet per page component", () => {
  it("renders exactly as many pages as it declares", async () => {
    expect(
      await renderPages([]),
      `expected one sheet per page component; a mismatch means a page overflowed.\n` +
        `declared: ${SHOWCASE_PAGE_IDS.join(", ")}`,
    ).toBe(SHOWCASE_PAGE_IDS.length);
  }, 180_000);

  it("still renders every page when nothing has been generated yet", async () => {
    // The state every report is in before the advisor runs the modules, and the
    // one production hits most often. A fixed template must keep its page count
    // and degrade each module page to an empty state — if a page instead
    // returned null here, every page number after it would shift and the table
    // of contents would point at the wrong sheets.
    expect(await renderPages(["--sparse"])).toBe(SHOWCASE_PAGE_IDS.length);
  }, 180_000);
});
