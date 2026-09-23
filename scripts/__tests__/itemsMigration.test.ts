// build-items-migration.ts generates the P2b backfill SQL from a
// checksum-verified snapshot (spec 2026-09-25-cfp-p2b-standing-items-design.md
// 决策 5, REVISED: a group's amount is its LATEST month, never an average —
// see items.ts's own header for why). The whole backfill is ONE compact
// `insert ... select ... from (values ...) as v` statement, followed by a
// final assertion DO block. This test uses a SYNTHETIC snapshot only — fake
// uuids, no real client data — the same discipline as
// scripts/__tests__/legacyRemap.test.ts.
import { describe, expect, it } from "vitest";
import { backfillSql, type Snapshot, type SnapshotRow } from "../build-items-migration.ts";
import { annualizeItems, itemsFromMonthRows } from "../../supabase/functions/_shared/cashflow/items.ts";
import { annualizeCashflow, defaultBasis, type PeriodRow } from "../../supabase/functions/_shared/cashflow/periods.ts";

// The uuid "variant" nibble deliberately uses 'a' (not '8') so none of these
// fake ids ever accidentally contain a test amount (8000, 542.5, …) as a
// substring — the "never a literal amount" checks below rely on that.
const CLIENT = "00000000-0000-4000-a000-000000000001";
const OTHER_CLIENT = "00000000-0000-4000-a000-000000000099";
const id = (n: number) => `00000000-0000-4000-a000-0000000000${String(n).padStart(2, "0")}`;

const rows: SnapshotRow[] = [
  { id: id(1), client_id: CLIENT, direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", period_month: "2026-04-01", source_note: null, linked_asset_id: null, linked_liability_id: null, needs_review: false, review_reason: null },
  { id: id(2), client_id: CLIENT, direction: "outflow", category: "groceries", amount: 542.5, frequency: "monthly", period_month: "2026-04-01", source_note: "Weekly groceries at Aeon", linked_asset_id: null, linked_liability_id: null, needs_review: false, review_reason: null },
  { id: id(3), client_id: CLIENT, direction: "inflow", category: "bonus", amount: 18400, frequency: "annual", period_month: "2026-03-01", source_note: "Year-end bonus", linked_asset_id: null, linked_liability_id: null, needs_review: false, review_reason: null },
  { id: id(4), client_id: CLIENT, direction: "outflow", category: "unit_trust_contribution", amount: 300, frequency: "monthly", period_month: "2026-04-01", source_note: null, linked_asset_id: null, linked_liability_id: null, needs_review: true, review_reason: "确认基金代码" },
  // a second client, to prove groups never mix across clients even with an
  // identical category/note/frequency.
  { id: id(5), client_id: OTHER_CLIENT, direction: "outflow", category: "groceries", amount: 200, frequency: "monthly", period_month: "2026-04-01", source_note: null, linked_asset_id: null, linked_liability_id: null, needs_review: false, review_reason: null },
];

const checksum = { count: rows.length, sum: rows.reduce((s, r) => s + r.amount, 0) };

// `bases` is accepted in the snapshot shape (an older caller may still send
// one) but is never read any more — window selection is now always "the
// client's latest year with data", per client, computed inside
// itemsFromMonthRows itself.
const snapshot: Snapshot = { rows, checksum };
const sql = backfillSql(snapshot);

/** The insert statement only — excludes the opening guard block's and the
 *  closing assertion block's raise-exception messages, which are fixed
 *  developer text unrelated to any client and exempt from the literal sweep. */
function insertStatementOnly(fullSql: string): string {
  const start = fullSql.indexOf("insert into");
  const rest = fullSql.slice(start);
  const nextDoBlock = rest.indexOf("\ndo $$");
  return nextDoBlock === -1 ? rest : rest.slice(0, nextDoBlock);
}

describe("build-items-migration: backfillSql", () => {
  it("guards on the cashflow_entries checksum before touching anything", () => {
    expect(sql).toContain(`v_count <> ${checksum.count}`);
    expect(sql).toContain(String(checksum.sum));
    expect(sql).toContain("raise exception");
  });

  it("refuses to run twice — guards on an existing source = 'migrated' row", () => {
    expect(sql).toContain("where source = 'migrated'");
    expect(sql).toMatch(/v_migrated > 0/);
  });

  it("emits exactly ONE insert statement, with one VALUES row per migrated item", () => {
    const clientItems = itemsFromMonthRows(rows.filter((r) => r.client_id === CLIENT));
    const otherItems = itemsFromMonthRows(rows.filter((r) => r.client_id === OTHER_CLIENT));
    const inserts = sql.match(/insert into public\.cashflow_items/g) ?? [];
    expect(inserts.length).toBe(1);

    const valuesBlock = sql.slice(sql.indexOf("from (values"), sql.indexOf(") as v("));
    const valuesRows = valuesBlock.split("\n").filter((l) => l.trim().startsWith("("));
    expect(valuesRows.length).toBe(clientItems.length + otherItems.length);
    // CLIENT: salary, groceries, bonus, unit_trust (4) + OTHER_CLIENT: groceries (1).
    expect(valuesRows.length).toBe(5);
  });

  it("adds a final assertion DO block: the migrated count must equal the item count", () => {
    const doBlocks = sql.match(/do \$\$/g) ?? [];
    expect(doBlocks.length).toBe(2); // opening guard + closing assertion
    expect(sql).toMatch(/v_migrated <> 5/);
    expect(sql).toContain("raise exception 'expected % migrated cashflow_items row(s), found %'");
  });

  it("never writes an amount, a note or a name as a literal — amount and name are always scalar subqueries", () => {
    expect(sql).not.toContain("8000");
    expect(sql).not.toContain("18400");
    expect(sql).not.toContain("542.5");
    expect(sql).not.toContain("Aeon");
    expect(sql).not.toContain("groceries at");
    expect(sql).not.toContain("Year-end");
    expect(sql).not.toContain("确认基金代码");
    // amount and name are always read back from the table; no divisor exists
    // any more (the revised 决策 5 never averages).
    expect(sql).toContain("round(sum(e.amount)");
    expect(sql).not.toMatch(/round\(sum\(e\.amount\)\s*\/\s*\d/);
    expect(sql).toContain("array_agg(e.source_note");
    expect(sql).toContain("array_agg(e.review_reason");
    // the subqueries are templated against the VALUES row, never a per-item
    // embedded array.
    expect(sql).toContain("where e.id = any(v.amount_ids)");
    expect(sql).toContain("where e.id = any(v.source_ids)");
  });

  it("every string literal inside the INSERT (not the guard/assertion blocks) is an id, an id-array, a code, or a date", () => {
    const insertOnly = insertStatementOnly(sql);
    const literals = [...insertOnly.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
    expect(literals.length).toBeGreaterThan(0);
    const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    const allowed = new RegExp(
      `^(${uuid}|\\{${uuid}(,${uuid})*\\}|inflow|outflow|monthly|weekly|quarterly|semi_annual|annual|one_off|migrated|\\d{4}-\\d{2}-\\d{2}|[a-z][a-z0-9_]*)$`,
    );
    for (const lit of literals) {
      expect(lit).toMatch(allowed);
    }
  });

  it("keeps two clients' identical-looking rows in separate VALUES rows (never cross-client)", () => {
    expect((sql.match(/'groceries'/g) ?? []).length).toBe(2);
  });

  it("only the FIRST VALUES row carries explicit ::casts; later rows are bare literals", () => {
    const valuesBlock = sql.slice(sql.indexOf("from (values"), sql.indexOf(") as v("));
    const valuesRows = valuesBlock.split("\n").filter((l) => l.trim().startsWith("("));
    expect(valuesRows[0]).toMatch(/::uuid\b/);
    expect(valuesRows[0]).toMatch(/::uuid\[\]/);
    for (const later of valuesRows.slice(1)) {
      expect(later).not.toMatch(/::uuid/);
    }
  });

  it("sets effective_to = effective_from for a migrated one_off item", () => {
    const oneOffRows: SnapshotRow[] = [
      { id: id(6), client_id: CLIENT, direction: "outflow", category: "asset_purchase", amount: 5000, frequency: "one_off", period_month: "2026-04-01", source_note: null, linked_asset_id: null, linked_liability_id: null, needs_review: false, review_reason: null },
    ];
    const oneOffSnapshot: Snapshot = { rows: oneOffRows, checksum: { count: 1, sum: 5000 } };
    const oneOffSql = backfillSql(oneOffSnapshot);
    expect(oneOffSql).toContain("date '2026-04-01', date '2026-04-01'");
  });

  it("a multi-month group's amount/name read only the latest month's ids (v.amount_ids); review_reason/metadata span the whole group (v.source_ids)", () => {
    // Same recurring line (telco) reported in two months: 1,000 in Jul, then
    // 1,100 in Aug — the amount must come from ONLY the Aug row, but both
    // ids still fold into the VALUES row's source_ids for provenance.
    const telcoRows: SnapshotRow[] = [
      { id: id(7), client_id: CLIENT, direction: "outflow", category: "telco", amount: 1000, frequency: "monthly", period_month: "2026-07-01", source_note: "Unifi", linked_asset_id: null, linked_liability_id: null, needs_review: false, review_reason: null },
      { id: id(8), client_id: CLIENT, direction: "outflow", category: "telco", amount: 1100, frequency: "monthly", period_month: "2026-08-01", source_note: "Unifi", linked_asset_id: null, linked_liability_id: null, needs_review: true, review_reason: "确认月费" },
    ];
    const telcoSnapshot: Snapshot = { rows: telcoRows, checksum: { count: 2, sum: 2100 } };
    const telcoSql = backfillSql(telcoSnapshot);

    const items = itemsFromMonthRows(telcoRows);
    expect(items.length).toBe(1);
    expect(items[0].amount_ids).toEqual([id(8)]);
    expect(items[0].source_ids.slice().sort()).toEqual([id(7), id(8)]);

    // the VALUES row itself carries the two DIFFERENT id sets...
    expect(telcoSql).toContain(`'{${id(8)}}'::uuid[]`); // amount_ids: latest month only
    expect(telcoSql).toContain(`'{${id(7)},${id(8)}}'::uuid[]`); // source_ids: whole group
    // ...while the SAME templated subquery is reused for every item.
    expect(telcoSql).toContain("where e.id = any(v.amount_ids)");
    expect(telcoSql).toContain("where e.id = any(v.source_ids)");
    expect(telcoSql).not.toContain("1000");
    expect(telcoSql).not.toContain("1100");
  });

  it("(i) a single-monthly-month client's migrated totals equal annualizeCashflow(rows, defaultBasis(rows)) exactly", () => {
    const clientRows = rows.filter((r) => r.client_id === CLIENT);
    const items = itemsFromMonthRows(clientRows);
    const basis = defaultBasis(clientRows as unknown as PeriodRow[]);
    const got = annualizeItems(items, new Date("2026-04-01T00:00:00Z"));
    const want = annualizeCashflow(clientRows as unknown as PeriodRow[], basis);

    expect(got.annual_income).toBeCloseTo(want.annual_income, 2);
    expect(got.annual_expenses).toBeCloseTo(want.annual_expenses, 2);
    expect(got.monthly_income).toBeCloseTo(want.monthly_income, 2);
    expect(got.monthly_expenses).toBeCloseTo(want.monthly_expenses, 2);
  });

  it("an empty item set skips the insert entirely but still asserts zero migrated rows", () => {
    const emptySnapshot: Snapshot = { rows: [], checksum: { count: 0, sum: 0 } };
    const emptySql = backfillSql(emptySnapshot);
    expect(emptySql).not.toContain("insert into public.cashflow_items");
    expect(emptySql).toMatch(/v_migrated <> 0/);
  });
});
