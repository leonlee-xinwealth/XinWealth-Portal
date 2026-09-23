// Generates supabase/migrations/20260925000002_cashflow_items_backfill.sql from
// a CHECKSUM-VERIFIED snapshot of cashflow_entries, using itemsFromMonthRows
// (spec 2026-09-25-cfp-p2b-standing-items-design.md 决策 5, REVISED: a
// multi-month client's amount is the group's LATEST month, not an average —
// see items.ts's own header comment for why) — the same pattern as
// scripts/build-legacy-remap.ts.
//
// The snapshot JSON holds every client's amounts and notes and is NOT
// committed: keep it in the session scratchpad. The generated SQL holds only
// ids, category codes, frequencies, dates and booleans — every AMOUNT, NAME
// and REVIEW REASON is read back from cashflow_entries by the migration
// itself at apply time (a scalar subquery over the exact row ids this script
// resolved them from), so nothing about a client's actual figures or wording
// ever appears in a committed file.
//
// The whole backfill is ONE `insert ... select ... from (values ...) as v`
// statement: a VALUES table of one short row per item (id lists as compact
// '{a,b}' array literals, only the FIRST row carrying explicit ::casts —
// Postgres fixes every column's type from that row and coerces the rest),
// joined back to cashflow_entries by scalar subquery for amount/name/reason.
//
// Usage: npx tsx scripts/build-items-migration.ts <snapshot.json> [out.sql]
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { itemsFromMonthRows, type MigratedItem, type MonthRow } from "../supabase/functions/_shared/cashflow/items.ts";
import type { CashflowBasis } from "../supabase/functions/_shared/cashflow/periods.ts";

export const OUTFILE = "supabase/migrations/20260925000002_cashflow_items_backfill.sql";

export type SnapshotRow = MonthRow;

export interface SnapshotChecksum {
  count: number;
  sum: number;
}

export interface Snapshot {
  rows: SnapshotRow[];
  /** No longer used — itemsFromMonthRows picks its own window (the latest
   *  year with data, every month of it) regardless of any basis. Kept
   *  OPTIONAL purely so an older snapshot file that still carries this key
   *  (or a caller that still builds one) does not need to be reshaped. */
  bases?: Record<string, CashflowBasis | null>;
  checksum: SnapshotChecksum;
}

const codeLit = (s: string): string => `'${s.replace(/'/g, "''")}'`;
/** Postgres array-literal syntax, e.g. '{a,b,c}' — far shorter per line than
 *  array['a'::uuid, 'b'::uuid]. No per-element cast: the column's array type
 *  is fixed once, by the first row's own `::uuid[]`. */
const pgArrayLit = (ids: string[]): string => `'{${ids.join(",")}}'`;

/**
 * Groups the snapshot by client and runs itemsFromMonthRows over that
 * client's own rows only — a group must never mix two clients' rows just
 * because they share a category and an empty note. `bases` (if present in
 * the snapshot) is intentionally never read: the revised 决策 5 has no basis
 * concept for window selection any more.
 */
function migratedItemsByClient(snapshot: Snapshot): MigratedItem[] {
  const byClient = new Map<string, SnapshotRow[]>();
  for (const r of snapshot.rows ?? []) {
    const clientId = r.client_id ?? "";
    if (!clientId) continue;
    const list = byClient.get(clientId) ?? [];
    list.push(r);
    byClient.set(clientId, list);
  }

  const items: MigratedItem[] = [];
  for (const clientId of [...byClient.keys()].sort()) {
    const clientRows = byClient.get(clientId)!;
    for (const item of itemsFromMonthRows(clientRows)) {
      items.push({ ...item, client_id: clientId });
    }
  }
  return items;
}

/**
 * The checksum guard: the migration must refuse to run if cashflow_entries
 * has moved since the snapshot was taken, or if it has already been applied
 * once (a `source = 'migrated'` row already exists — running it twice would
 * double every client's plan).
 */
function guardSql(checksum: SnapshotChecksum): string[] {
  return [
    "do $$",
    "declare",
    "  v_count bigint;",
    "  v_sum numeric;",
    "  v_migrated bigint;",
    "begin",
    "  select count(*), coalesce(sum(amount), 0) into v_count, v_sum from public.cashflow_entries;",
    `  if v_count <> ${checksum.count} or abs(v_sum - ${checksum.sum}) > 0.01 then`,
    "    raise exception 'cashflow_entries has drifted from the migration snapshot (count % vs expected %, sum % vs expected %) — regenerate this migration before applying it',",
    `      v_count, ${checksum.count}, v_sum, ${checksum.sum};`,
    "  end if;",
    "",
    "  select count(*) into v_migrated from public.cashflow_items where source = 'migrated';",
    "  if v_migrated > 0 then",
    "    raise exception 'public.cashflow_items already has % row(s) with source = migrated — this backfill has already been applied', v_migrated;",
    "  end if;",
    "end $$;",
    "",
  ];
}

/**
 * The final assertion: exactly `expectedCount` rows landed with
 * `source = 'migrated'` — catches a silent partial apply (a constraint
 * skipped a row, a transaction got split, …) that the opening guard cannot
 * see because it only runs before the insert.
 */
function assertionSql(expectedCount: number): string[] {
  return [
    "do $$",
    "declare",
    "  v_migrated bigint;",
    "begin",
    "  select count(*) into v_migrated from public.cashflow_items where source = 'migrated';",
    `  if v_migrated <> ${expectedCount} then`,
    `    raise exception 'expected % migrated cashflow_items row(s), found %', ${expectedCount}, v_migrated;`,
    "  end if;",
    "end $$;",
    "",
  ];
}

/**
 * One VALUES row per item: (client_id, direction, category, frequency,
 * effective_from, effective_to, linked_asset_id, linked_liability_id,
 * needs_review, amount_ids, source_ids) — matching the `v(...)` column list
 * in `insertSelectSql`. Only `isFirst` carries explicit `::casts`; every
 * later row is bare literals Postgres coerces to the column type the first
 * row established.
 */
function valuesRow(item: MigratedItem, isFirst: boolean): string {
  const amountIds = pgArrayLit([...item.amount_ids].sort());
  const sourceIds = pgArrayLit([...item.source_ids].sort());
  const needsReview = item.needs_review ? "true" : "false";
  const effectiveFrom = `date '${item.effective_from}'`;

  const clientId = isFirst ? `'${item.client_id}'::uuid` : `'${item.client_id}'`;
  const effectiveTo = item.effective_to
    ? `date '${item.effective_to}'`
    : isFirst
      ? "null::date"
      : "null";
  const linkedAsset = item.linked_asset_id ? `'${item.linked_asset_id}'` : isFirst ? "null::uuid" : "null";
  const linkedLiability = item.linked_liability_id ? `'${item.linked_liability_id}'` : isFirst ? "null::uuid" : "null";
  const amountIdsLit = isFirst ? `${amountIds}::uuid[]` : amountIds;
  const sourceIdsLit = isFirst ? `${sourceIds}::uuid[]` : sourceIds;

  return `  (${clientId}, ${codeLit(item.direction)}, ${codeLit(item.category)}, ${codeLit(item.frequency)}, ${effectiveFrom}, ${effectiveTo}, ${linkedAsset}, ${linkedLiability}, ${needsReview}, ${amountIdsLit}, ${sourceIdsLit})`;
}

/**
 * The single insert: a VALUES table `v` of every migrated item, joined back
 * to cashflow_entries by scalar subquery for the three columns that must
 * never be literals — `name` and `amount` from `v.amount_ids` (the group's
 * latest month only, 决策 5 revised), `review_reason` from `v.source_ids`
 * (the whole group, across every month, because a flag raised in an earlier
 * month still needs attention even though that month didn't set the amount).
 */
function insertSelectSql(items: MigratedItem[]): string[] {
  return [
    "insert into public.cashflow_items (client_id, direction, category, name, amount, frequency, effective_from, effective_to, linked_asset_id, linked_liability_id, source, needs_review, review_reason, metadata)",
    "select v.client_id, v.direction::public.cashflow_direction, v.category,",
    "  (select (array_agg(e.source_note order by e.id desc))[1] from public.cashflow_entries e where e.id = any(v.amount_ids)),",
    "  (select round(sum(e.amount), 2) from public.cashflow_entries e where e.id = any(v.amount_ids)),",
    "  v.frequency::public.cashflow_frequency, v.effective_from, v.effective_to, v.linked_asset_id, v.linked_liability_id, 'migrated', v.needs_review,",
    "  (select (array_remove(array_agg(e.review_reason order by e.period_month, e.id), null))[1] from public.cashflow_entries e where e.id = any(v.source_ids)),",
    "  jsonb_build_object('migrated_from', v.source_ids, 'amount_from', v.amount_ids)",
    "from (values",
    items.map((item, i) => valuesRow(item, i === 0)).join(",\n"),
    ") as v(client_id, direction, category, frequency, effective_from, effective_to, linked_asset_id, linked_liability_id, needs_review, amount_ids, source_ids);",
    "",
  ];
}

export function backfillSql(snapshot: Snapshot): string {
  const items = migratedItemsByClient(snapshot);

  const out: string[] = [
    "-- GENERATED FILE — review before applying.",
    "-- Source: scripts/build-items-migration.ts over a checksum-verified snapshot",
    "-- of cashflow_entries (spec 2026-09-25-cfp-p2b-standing-items-design.md 决策 5,",
    "-- REVISED: each item's amount is its group's LATEST month, not an average —",
    "-- averaging a multi-month client's split-across-months position was quietly",
    "-- halving real figures like a client's salary).",
    "-- The snapshot JSON holds every client's amounts and notes and is NEVER",
    "-- committed. This file holds only ids, category codes, frequencies, dates",
    "-- and booleans — every amount, name and review reason below is read back",
    "-- from cashflow_entries at apply time via a scalar subquery over the exact",
    "-- row ids the snapshot resolved them from.",
    "",
    ...guardSql(snapshot.checksum),
  ];

  if (items.length > 0) out.push(...insertSelectSql(items));

  out.push(...assertionSql(items.length));

  return out.join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [snapshotPath, outPath = OUTFILE] = process.argv.slice(2);
  if (!snapshotPath) {
    console.error("usage: npx tsx scripts/build-items-migration.ts <snapshot.json> [out.sql]");
    process.exit(1);
  }
  const snapshot: Snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const sql = backfillSql(snapshot);
  fs.writeFileSync(outPath, sql);
  const rows = sql.match(/from \(values\n([\s\S]*?)\n\) as v/);
  const count = rows ? rows[1].split("\n").length : 0;
  console.log(`wrote ${outPath} (${count} values rows)`);
}
