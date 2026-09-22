import { describe, expect, it } from "vitest";
import { remapSql } from "../build-legacy-remap.ts";

describe("legacy remap SQL", () => {
  const sql = remapSql(
    [
      { id: "c1", direction: "outflow", category: "household", source_note: "Utilities Bills", frequency: "monthly", is_recurring: true },
      { id: "c2", direction: "outflow", category: "groceries", source_note: null, frequency: "monthly", is_recurring: true },
      { id: "c3", direction: "outflow", category: "personal", source_note: "Vacation/ Travel", frequency: "monthly", is_recurring: true },
      { id: "c4", direction: "inflow", category: "bonus", source_note: null, frequency: "monthly", is_recurring: false },
      { id: "c5", direction: "outflow", category: "household", source_note: "O'Brien's shop", frequency: "monthly", is_recurring: true },
    ],
    [
      { id: "a1", asset_type: "other", name: "Maybank Gold (MIGA)" },
      { id: "a2", asset_type: "savings", name: "Maybank" },
    ],
  );

  it("backs the tables up before touching anything", () => {
    expect(sql.indexOf("archive.cashflow_entries_20260923")).toBeGreaterThan(-1);
    expect(sql.indexOf("archive.cashflow_entries_20260923")).toBeLessThan(sql.indexOf("update public.cashflow_entries"));
  });

  it("updates only rows that change, each guarded by its old category", () => {
    expect(sql).toContain("update public.cashflow_entries set category = 'utilities', needs_review = false, review_reason = null where id = 'c1' and category = 'household';");
    expect(sql).not.toContain("id = 'c2'");
    expect(sql).toMatch(/set category = 'travel', .*frequency = 'annual' where id = 'c3' and category = 'personal';/);
    expect(sql).toMatch(/frequency = 'annual', is_recurring = true where id = 'c4' and category = 'bonus';/);
  });

  it("reclassifies guessed assets and leaves the rest", () => {
    expect(sql).toContain("update public.assets set asset_type = 'gold', needs_review = false, review_reason = null where id = 'a1' and asset_type = 'other';");
    expect(sql).not.toContain("id = 'a2'");
  });

  it("catches late legacy rows and retires the legacy categories", () => {
    expect(sql).toContain("where category = 'household';");
    expect(sql).toContain("update public.cashflow_categories set is_active = false where code in ('salary',");
  });

  it("never lets a client's note into the SQL", () => {
    expect(sql).not.toContain("Brien");
    expect(sql).not.toContain("Utilities Bills");
  });
});
