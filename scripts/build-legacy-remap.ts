// Generates supabase/migrations/20260923000003_legacy_taxonomy_remap.sql from a
// snapshot of the live rows, using the classifier the KYC / LevelUp write paths
// use (supabase/functions/_shared/taxonomy/legacy.ts) — spec 附录 A.
//
// The snapshot JSON holds client notes and is NOT committed: keep it in the
// session scratchpad. The SQL holds only row ids, codes and fixed reasons.
//
// Usage: npx tsx scripts/build-legacy-remap.ts <cashflow.json> <assets.json> [out.sql]
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { classifyAsset, classifyCashflowRow } from "../supabase/functions/_shared/taxonomy/legacy.ts";
import { LEGACY_CATEGORY_MAP } from "../supabase/functions/_shared/taxonomy/cashflow.ts";
import { ASSET_TYPES, liquidityLevel } from "../supabase/functions/_shared/taxonomy/balance.ts";

export const OUTFILE = "supabase/migrations/20260923000003_legacy_taxonomy_remap.sql";

export interface SnapshotCashflowRow {
  id: string;
  direction: "inflow" | "outflow";
  category: string;
  source_note: string | null;
  frequency: string;
  is_recurring: boolean;
}

export interface SnapshotAssetRow {
  id: string;
  asset_type: string;
  name: string | null;
}

const q = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);

export function remapSql(cashflow: SnapshotCashflowRow[], assets: SnapshotAssetRow[]): string {
  const out: string[] = [
    "-- GENERATED FILE — review before applying.",
    "-- Source: scripts/build-legacy-remap.ts over a snapshot of cashflow_entries and assets.",
    "-- Spec 附录 A. Needs 20260923000001/000002 committed first (new enum values, new codes).",
    "",
    "-- 0. Keep the pre-remap rows. The archive schema is not exposed through the API.",
    "create schema if not exists archive;",
    "revoke all on schema archive from anon, authenticated;",
    "create table if not exists archive.cashflow_entries_20260923 as table public.cashflow_entries;",
    "create table if not exists archive.assets_20260923 as table public.assets;",
    "alter table archive.cashflow_entries_20260923 enable row level security;",
    "alter table archive.assets_20260923 enable row level security;",
    "",
    "-- 1. Cash-flow rows from the snapshot. The `and category = …` guard turns an",
    "--    update into a no-op if the row was edited after the snapshot.",
  ];
  for (const r of [...cashflow].sort((a, b) => a.id.localeCompare(b.id))) {
    const c = classifyCashflowRow(r);
    if (c.code === r.category && !c.needs_review && c.frequency === null && c.is_recurring === null) continue;
    const sets = [
      `category = ${q(c.code)}`,
      `needs_review = ${c.needs_review}`,
      `review_reason = ${q(c.review_reason)}`,
    ];
    if (c.frequency) sets.push(`frequency = ${q(c.frequency)}`);
    if (c.is_recurring !== null) sets.push(`is_recurring = ${c.is_recurring}`);
    out.push(`update public.cashflow_entries set ${sets.join(", ")} where id = ${q(r.id)} and category = ${q(r.category)};`);
  }

  out.push("", "-- 2. Assets whose type was a guess (property / other).");
  for (const a of [...assets].sort((x, y) => x.id.localeCompare(y.id))) {
    const c = classifyAsset(a);
    if (c.asset_type === a.asset_type && !c.needs_review) continue;
    out.push(
      `update public.assets set asset_type = ${q(c.asset_type)}, needs_review = ${c.needs_review}, ` +
        `review_reason = ${q(c.review_reason)} where id = ${q(a.id)} and asset_type = ${q(a.asset_type)};`,
    );
  }

  out.push("", "-- 3. Any legacy code written after the snapshot: plain mapping, flagged.");
  for (const [legacy, current] of Object.entries(LEGACY_CATEGORY_MAP)) {
    out.push(
      `update public.cashflow_entries set category = ${q(current)}, needs_review = true, ` +
        `review_reason = '迁移后写入的旧分类，请确认具体分类' where category = ${q(legacy)};`,
    );
  }

  out.push("", "-- 4. Purpose (where unset) and liquidity for every asset, from the taxonomy.");
  const purposes = ASSET_TYPES.filter((t) => t.default_purpose)
    .map((t) => `when ${q(t.code)} then ${q(t.default_purpose)}`).join(" ");
  out.push(`update public.assets set purpose = case asset_type::text ${purposes} else null end where purpose is null;`);
  const levels = ASSET_TYPES.map((t) => `when ${q(t.code)} then ${q(liquidityLevel(t.code))}`).join(" ");
  out.push(`update public.assets set liquidity = (case asset_type::text ${levels} else 'low' end)::public.liquidity_level;`);

  out.push("", "-- 5. Retire the legacy categories. Rows no longer use them; the FK keeps them.");
  out.push(
    `update public.cashflow_categories set is_active = false where code in (${Object.keys(LEGACY_CATEGORY_MAP).map(q).join(", ")});`,
  );
  return out.join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cfPath, assetPath, outPath = OUTFILE] = process.argv.slice(2);
  if (!cfPath || !assetPath) {
    console.error("usage: npx tsx scripts/build-legacy-remap.ts <cashflow.json> <assets.json> [out.sql]");
    process.exit(1);
  }
  const sql = remapSql(
    JSON.parse(fs.readFileSync(cfPath, "utf8")),
    JSON.parse(fs.readFileSync(assetPath, "utf8")),
  );
  fs.writeFileSync(outPath, sql);
  console.log(`wrote ${outPath} (${sql.split("\n").filter((l) => l.startsWith("update")).length} updates)`);
}
