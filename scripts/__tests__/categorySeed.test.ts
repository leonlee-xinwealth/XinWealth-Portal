// The cashflow_categories seed is GENERATED from the taxonomy. If this fails,
// run: npx tsx scripts/build-category-seed.ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { OUTFILE, categorySeedSql } from "../build-category-seed.ts";
import { CASHFLOW_CATEGORIES } from "../../supabase/functions/_shared/taxonomy/cashflow";

const norm = (s: string) => s.replace(/\r\n/g, "\n");

describe("cashflow_categories seed", () => {
  it("is up to date with the taxonomy", () => {
    const committed = fs.readFileSync(OUTFILE, "utf8");
    expect(norm(committed) === norm(categorySeedSql()), `${OUTFILE} is stale`).toBe(true);
  });

  it("upserts every category exactly once", () => {
    const sql = categorySeedSql();
    for (const c of CASHFLOW_CATEGORIES) {
      expect(sql.split(`('${c.code}',`).length - 1, c.code).toBe(1);
    }
  });

  it("escapes apostrophes", () => {
    expect(categorySeedSql()).toContain("'Children''s daily expenses'");
  });
});
