import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { PAGE_ORDER, tocEntries } from "../registry";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, "../../..");

/**
 * The page number printed in a sheet's footer must equal that sheet's physical
 * position in the document.
 *
 * This is the assertion that was missing. registry.test.ts compares a
 * hand-written id list against PAGE_ORDER — both agreed while the JSX that
 * actually renders the pages carried a third, different order. pageCount.test.ts
 * only counts sheets. So a real defect shipped: <Doc> rendered assets-detail and
 * liabilities-detail in positions 21-22 while the registry (and therefore the
 * footer stamp and the table of contents) placed them at 9-10, leaving 14 sheets
 * printing a page number that did not match where they physically sat.
 *
 * Reading the number back out of the rendered PDF is the only formulation that
 * catches it, because it compares the artifact against itself rather than
 * comparing two lists that were both derived from the registry.
 */

interface Sheet {
  index: number; // 1-based physical position
  text: string;
  /** the standalone two-digit token sitting in the footer band, if any */
  footer: string | null;
}

let sheets: Sheet[] = [];

beforeAll(async () => {
  const out = path.join(mkdtempSync(path.join(tmpdir(), "cfp-order-")), "out.pdf");
  execFileSync("npx", ["tsx", "pdf/cfpReport/showcase.tsx", out], {
    cwd: ROOT,
    stdio: "pipe",
    shell: process.platform === "win32",
  });

  // pdfjs ships an ESM build that expects a browser; the legacy CJS build is the
  // one that runs under Node.
  const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
  const doc = await pdfjs.getDocument({ url: out, useSystemFonts: true }).promise;

  sheets = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: string; transform?: number[] }>;

    // Locate the stamp by POSITION, not by scanning the tail of the text: a
    // legend reading "RM 147,000" or a phone number will happily yield a
    // two-digit run, and text order is not reliably bottom-last.
    const FOOTER_BAND = 60; // page units from the bottom edge
    const footer = items
      .filter((it) => (it.transform?.[5] ?? Infinity) < FOOTER_BAND)
      .map((it) => (it.str ?? "").trim())
      .find((s) => /^\d{2}$/.test(s)) ?? null;

    sheets.push({
      index: i,
      text: items.map((it) => it.str ?? "").join(""),
      footer,
    });
  }
}, 240_000);

describe("printed page numbers match physical position", () => {
  it("renders one sheet per registry page", () => {
    expect(sheets).toHaveLength(PAGE_ORDER.length);
  });

  it("stamps every content sheet with its own position", () => {
    // Cover and back cover carry no running footer by design.
    const framed = sheets.filter(
      (s) => PAGE_ORDER[s.index - 1].id !== "cover" && PAGE_ORDER[s.index - 1].id !== "back-cover",
    );

    const wrong = framed
      .map((s) => ({ sheet: s.index, id: PAGE_ORDER[s.index - 1].id, printed: s.footer }))
      .filter((r) => r.printed !== String(r.sheet).padStart(2, "0"));

    expect(
      wrong,
      `sheets whose footer disagrees with where they physically sit:\n` +
        wrong.map((w) => `  sheet ${w.sheet} (${w.id}) prints "${w.printed}"`).join("\n"),
    ).toEqual([]);
  });
});

describe("the table of contents points at the right sheets", () => {
  it("finds each entry's Chinese title on the sheet its page number names", () => {
    const wrong = tocEntries()
      .map((e) => ({ ...e, text: sheets[e.page - 1]?.text ?? "" }))
      // The title is set in the display serif, which renders per-glyph; strip
      // whitespace on both sides before looking for it.
      .filter((e) => !e.text.replace(/\s+/g, "").includes(e.zh.replace(/\s+/g, "")))
      .map((e) => ({ entry: e.zh, claimsPage: e.page }));

    expect(
      wrong,
      `table-of-contents entries pointing at a sheet that does not carry them:\n` +
        wrong.map((w) => `  "${w.entry}" claims page ${w.claimsPage}`).join("\n"),
    ).toEqual([]);
  });
});
