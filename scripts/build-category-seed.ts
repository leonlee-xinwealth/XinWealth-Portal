// Generates supabase/migrations/20260923000002_cashflow_categories_seed.sql from
// the taxonomy, so the database table the FK points at can never disagree with
// the code that reads it. scripts/__tests__/categorySeed.test.ts fails when the
// committed file is stale.
//
// Usage: npx tsx scripts/build-category-seed.ts
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { CASHFLOW_CATEGORIES } from "../supabase/functions/_shared/taxonomy/cashflow.ts";

export const OUTFILE = "supabase/migrations/20260923000002_cashflow_categories_seed.sql";

const q = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);

export function categorySeedSql(): string {
  const rows = CASHFLOW_CATEGORIES.map((c, i) =>
    "  (" + [
      q(c.code), q(c.label_en), q(c.label_zh), q(c.direction), "true", String((i + 1) * 10),
      q(c.group), q(c.wealth_effect), q(c.recurrence), q(c.fixed_variable), q(c.need_want),
      q(c.link_to), String(c.auto_generated), "true",
    ].join(", ") + ")"
  );
  return [
    "-- GENERATED FILE — do not edit.",
    "-- Source: supabase/functions/_shared/taxonomy/cashflow.ts",
    "-- Rebuild: npx tsx scripts/build-category-seed.ts",
    "-- Upserts every current category. Legacy codes are retired in 20260923000003.",
    "insert into public.cashflow_categories",
    "  (code, label, label_zh, direction, is_system, sort_order, category_group, wealth_effect,",
    "   recurrence, fixed_variable, need_want, link_to, auto_generated, is_active)",
    "values",
    rows.join(",\n"),
    "on conflict (code) do update set",
    "  label = excluded.label,",
    "  label_zh = excluded.label_zh,",
    "  direction = excluded.direction,",
    "  sort_order = excluded.sort_order,",
    "  category_group = excluded.category_group,",
    "  wealth_effect = excluded.wealth_effect,",
    "  recurrence = excluded.recurrence,",
    "  fixed_variable = excluded.fixed_variable,",
    "  need_want = excluded.need_want,",
    "  link_to = excluded.link_to,",
    "  auto_generated = excluded.auto_generated,",
    "  is_active = excluded.is_active;",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fs.writeFileSync(OUTFILE, categorySeedSql());
  console.log(`wrote ${OUTFILE} (${CASHFLOW_CATEGORIES.length} categories)`);
}
