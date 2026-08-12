// Drift guard for the committed PDF renderer bundle.
//
// api/_lib/suitabilityPdf.mjs is a GENERATED, COMMITTED artifact: @vercel/node
// does not emit .tsx dependencies, so the JSX document has to be bundled ahead
// of time rather than transpiled at deploy. That means source edits to
// pdf/suitabilityReport/** are invisible in production until the bundle is
// rebuilt — exactly the kind of silent staleness a generated artifact invites.
//
// This test re-runs the bundler in memory and fails if the committed file
// differs, so the failure is a red test rather than a wrong PDF sent to a
// client. If it fails: node scripts/build-suitability-pdf.mjs
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OUTFILE, buildSuitabilityPdfBundle } from "../../../scripts/build-suitability-pdf.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("committed suitability PDF bundle", () => {
  it("exists and is self-contained (no relative imports left to resolve)", () => {
    const committed = fs.readFileSync(path.join(ROOT, OUTFILE), "utf8");
    expect(committed.length).toBeGreaterThan(1000);
    // Any surviving relative specifier would be a file Vercel has to resolve —
    // the whole point of bundling is that none remain.
    const relative = committed.match(/from\s*["']\.[^"']*["']/g) ?? [];
    expect(relative, `unbundled relative imports: ${relative.join(", ")}`).toEqual([]);
    expect(committed).toContain("GENERATED FILE");
  });

  it("is up to date with pdf/suitabilityReport/** sources", async () => {
    const committed = fs.readFileSync(path.join(ROOT, OUTFILE), "utf8");
    const result = await buildSuitabilityPdfBundle(undefined, false);
    const rebuilt = result.outputFiles![0].text;

    // Normalise line endings only — git may check the artifact out as CRLF.
    const norm = (s: string) => s.replace(/\r\n/g, "\n");
    expect(
      norm(rebuilt) === norm(committed),
      "api/_lib/suitabilityPdf.mjs is stale. Run: node scripts/build-suitability-pdf.mjs",
    ).toBe(true);
  });
});
