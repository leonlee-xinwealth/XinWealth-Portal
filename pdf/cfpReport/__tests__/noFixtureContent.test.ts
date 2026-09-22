import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

// pdfjs ships an ESM build that expects a browser; the legacy CJS build is the
// one that runs under Node. Same pattern as pageOrder.test.ts.
const require = createRequire(import.meta.url);

/**
 * The guard against design-time content surviving into a client's report.
 *
 * Real regression, 2026-08-20: eight pages were moved into the fixed template
 * without being converted from their design fixture, so every real client's
 * report printed the same invented figures — RM 2.71M of retirement capital, an
 * RM 2.21M life gap, a named insurer — and the profile page introduced the
 * client as "Lim Wei Jian" with two children who did not exist.
 *
 * Neither existing test could see it. pageCount counts sheets; pageOrder checks
 * numbering. Both pass perfectly while every page lies, because the fixture's
 * numbers look exactly as plausible as real ones.
 *
 * This test renders the report for a client with NO data at all. In that state
 * every figure on every page is a figure the report cannot possibly know, so
 * any currency amount that appears is by definition invented. It is the one
 * assertion that does not need to know what the right answer is.
 */
function sparseText(): Promise<string[]> {
  const out = path.join(mkdtempSync(path.join(tmpdir(), "cfp-sparse-")), "out.pdf");
  execFileSync("npx", ["tsx", "pdf/cfpReport/showcase.tsx", out, "--sparse"], {
    cwd: path.resolve(__dirname, "../../.."),
    stdio: "pipe",
    shell: process.platform === "win32",
  });
  const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
  return pdfjs.getDocument({ url: out, useSystemFonts: true }).promise.then(async (doc: any) => {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      pages.push(
        (content.items as Array<{ str?: string }>)
          .map((it) => it.str ?? "")
          // Space-joined, not concatenated: extraction emits the footer stamp
          // as its own run, and gluing it onto the preceding text turns a
          // legitimate "RM 0" on page 26 into "RM 026".
          .join(" ")
          // react-pdf splits a single string across runs, so collapse
          // whitespace to make "RM 1,486" match however it was broken up.
          .replace(/\s+/g, " "),
      );
    }
    return pages;
  });
}

/** Any RM figure with a digit in it. "RM 0" is legitimate; "RM 1,486" is not. */
const INVENTED_MONEY = /RM ?\d[\d,.]*\s*[MmKk]?\b/g;

/** Figures the empty report is entitled to print. */
const ALLOWED = new Set(["RM 0", "RM0"]);

describe("a report for a client with no data prints no figures", () => {
  it("has no currency amount anywhere it could not have come from", async () => {
    const pages = await sparseText();
    const offenders: string[] = [];
    pages.forEach((text, i) => {
      for (const m of text.match(INVENTED_MONEY) ?? []) {
        if (!ALLOWED.has(m.trim())) offenders.push(`p${i + 1}: ${m.trim()}`);
      }
    });
    expect(
      offenders,
      "these amounts appear on a report whose client has no assets, no liabilities, " +
        "no baseline and no generated sections — every one of them is design-time " +
        "content that would print verbatim in a real client's report",
    ).toEqual([]);
  }, 180_000);

  it("does not name a person the report has never been told about", async () => {
    // The profile page introduced every client as the same fictional person.
    const all = (await sparseText()).join("\n");
    for (const name of ["Lim Wei Jian", "Prudential", "长子", "次女"]) {
      expect(all, `${name} is fixture content`).not.toContain(name);
    }
  }, 180_000);
});
