// Drift guard for the committed taxonomy bundle.
//
// api/*.js are plain-JS Vercel functions: they cannot import the .ts taxonomy,
// so they import api/_lib/taxonomy.mjs, a GENERATED, COMMITTED bundle of
// supabase/functions/_shared/taxonomy/**. A source edit is invisible to KYC,
// LevelUp and the client portal until the bundle is rebuilt — this test fails
// until it is. Fix: node scripts/build-taxonomy.mjs
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OUTFILE, buildTaxonomyBundle } from "../build-taxonomy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const norm = (s: string) => s.replace(/\r\n/g, "\n");

describe("committed taxonomy bundle", () => {
  it("exists and has no relative imports left", () => {
    const committed = fs.readFileSync(path.join(ROOT, OUTFILE), "utf8");
    expect(committed).toContain("GENERATED FILE");
    expect(committed.match(/from\s*["']\.[^"']*["']/g) ?? []).toEqual([]);
  });

  it("is up to date with the taxonomy sources", async () => {
    const committed = fs.readFileSync(path.join(ROOT, OUTFILE), "utf8");
    const rebuilt = (await buildTaxonomyBundle(undefined, false)).outputFiles![0].text;
    expect(norm(rebuilt) === norm(committed), "api/_lib/taxonomy.mjs is stale. Run: node scripts/build-taxonomy.mjs").toBe(true);
  });

  it("works when loaded the way a Vercel function loads it", async () => {
    const t = await import("../../api/_lib/taxonomy.mjs");
    expect(t.resolveCategory("household")?.code).toBe("living_other");
    expect(t.isTransferCategory("to_savings")).toBe(true);
    expect(t.classifyAsset({ asset_type: "other", name: "Maybank Gold (MIGA)" }).asset_type).toBe("gold");
    expect(t.liquidityLevel("savings")).toBe("high");
  });
});
