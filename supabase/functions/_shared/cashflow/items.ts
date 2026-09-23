// CFP P2b — standing cash-flow items (常设项目): the plan.
// spec docs/superpowers/specs/2026-09-25-cfp-p2b-standing-items-design.md 决策 1-5, 8.
//
// ─────────────────────────────────────────────────────────────────────────────
// This file may import ONLY ./periods.ts (relative, with the .ts extension).
// Three runtimes resolve modules differently (Deno edge functions, the Vite
// browser bundle, plain Node/tsx scripts and the esbuild api/_lib bundle) —
// see periods.ts's own header for why the import surface is kept this narrow.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHAT AN ITEM MEANS
//
// A cashflow_entries ROW is one month's actual figure (periods.ts's contract).
// A cashflow_items ITEM is a standing fact: "RM 8,000/month, from 2026-04,
// until further notice." It is defined once; a raise or a new expense doesn't
// overwrite it, it either corrects a mistake in place or opens a new version
// from the month it actually changed (决策 3). A client with items never has
// their plan reduced to "pick a few months and average them" — the plan is
// items, always was one, and closes exactly when told to.

import {
  ANNUAL_OCCURRENCES,
  isTransferCode,
  recordedYears,
  yearOf,
  type CashflowBasis,
  type CashflowTotals,
  type CategoryTotals,
} from "./periods.ts";

export type ItemDirection = "inflow" | "outflow";
export type ItemSource = "advisor" | "kyc" | "client" | "migrated";

/** A standing plan item — one row of `public.cashflow_items`. */
export interface StandingItem {
  id?: string;
  client_id?: string;
  direction: ItemDirection;
  category: string;
  name?: string | null;
  amount: number;
  /** one of periods.ts's ANNUAL_OCCURRENCES keys; an unrecognised value is
   *  treated the same way periods.ts treats one (see itemMonthlyAmount). */
  frequency: string;
  /** 'YYYY-MM-01' */
  effective_from: string;
  /** 'YYYY-MM-01' (inclusive) or null = still open. one_off items always have
   *  effective_to === effective_from (DB check). */
  effective_to?: string | null;
  linked_asset_id?: string | null;
  linked_liability_id?: string | null;
  linked_policy_id?: string | null;
  previous_id?: string | null;
  source?: ItemSource;
  needs_review?: boolean;
  review_reason?: string | null;
}

// ---------------------------------------------------------------------------
// Months
// ---------------------------------------------------------------------------

/**
 * The first of the month, as 'YYYY-MM-01'.
 *
 * A `Date` is read in UTC (the whole app stores months as UTC midnight, same
 * as periods.ts's monthOf/yearOf). A 'YYYY-MM-DD' STRING is sliced directly
 * instead of parsed into a `Date` — `new Date("2026-04-01")` is midnight UTC,
 * which prints as 2026-03-31 in any timezone west of Greenwich. Slicing the
 * digits out of the string is the only way this cannot shift a month.
 */
export function monthStart(d: Date | string): string {
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})/.exec(d);
    if (m) return `${m[1]}-${m[2]}-01`;
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) {
      throw new Error(`monthStart: unusable date "${d}"`);
    }
    return monthStart(parsed);
  }
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${mo}-01`;
}

/** Months since a fixed epoch, purely so two months can be compared/offset
 *  with integer arithmetic. Not meaningful on its own. */
function monthIndex(month: string): number {
  const y = Number(month.slice(0, 4));
  const mo = Number(month.slice(5, 7));
  return y * 12 + (mo - 1);
}

function monthFromIndex(idx: number): string {
  const y = Math.floor(idx / 12);
  const mo = idx - y * 12 + 1;
  return `${y}-${String(mo).padStart(2, "0")}-01`;
}

function monthBefore(month: string): string {
  return monthFromIndex(monthIndex(month) - 1);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Active-at / monthly equivalent
// ---------------------------------------------------------------------------

/** from ≤ month(asOf) ≤ (to ?? ∞) — 决策 2. */
export function isActiveAt(
  item: { effective_from: string; effective_to?: string | null },
  asOf: Date | string,
): boolean {
  const asOfMonth = monthStart(asOf);
  if (item.effective_from > asOfMonth) return false;
  if (item.effective_to != null && item.effective_to < asOfMonth) return false;
  return true;
}

/** The items of `items` that are in force at `asOf`. */
export function activeItems<T extends { effective_from: string; effective_to?: string | null }>(
  items: readonly T[],
  asOf: Date | string,
): T[] {
  return (items ?? []).filter((it) => isActiveAt(it, asOf));
}

/**
 * The monthly equivalent of an item's amount — 决策 4, the same
 * ANNUAL_OCCURRENCES table periods.ts annualises with. `one_off` occurs 0
 * times a year, so it contributes 0 (one-offs are reported separately, never
 * folded into a recurring monthly figure). An unrecognised frequency falls
 * back to 12/yr, the same "don't silently drop it" rule periods.ts uses for a
 * row it doesn't understand.
 */
export function itemMonthlyAmount(item: { amount: number; frequency: string }): number {
  const occurrences = ANNUAL_OCCURRENCES[item.frequency] ?? 12;
  const amount = Number(item.amount);
  const n = Number.isFinite(amount) ? amount : 0;
  return (n * occurrences) / 12;
}

// ---------------------------------------------------------------------------
// annualizeItems
// ---------------------------------------------------------------------------

export interface AnnualizeItemsResult extends CashflowTotals {
  /** one_off items whose month falls in [asOf − 11 months, asOf + 12 months]. */
  one_off_items: StandingItem[];
}

/**
 * The plan's income/expenses at `asOf` — the items analogue of
 * periods.ts's annualizeCashflow, built so the two are ASSIGNABLE to the same
 * CashflowTotals shape and every downstream reader (health score, reports,
 * cfp-brain) can treat "plan" and "actuals" totals identically.
 *
 * There is no basis window here — an item is either in force at `asOf` or it
 * isn't, so `basis_months` is always 12 and `months_with_data` always empty
 * (kept only so the shape matches; nothing should read them for an items
 * plan). `annual_items_income/expenses` mirrors periods.ts's meaning: the
 * slice of the annual figure that comes from a non-monthly recurring item
 * (quarterly road tax, an annual bonus item, …), broken out for the UI the
 * same way a periods-based report breaks it out.
 *
 * Transfers (决策 4 / periods.ts 小会计口径) are excluded from every total,
 * exactly like periods.ts — an EPF or unit-trust standing item moves the
 * client's own money, it is neither income nor spending.
 */
export function annualizeItems(items: readonly StandingItem[], asOf: Date | string): AnnualizeItemsResult {
  const asOfMonth = monthStart(asOf);
  const active = activeItems(items ?? [], asOfMonth);

  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let annualItemsIncome = 0;
  let annualItemsExpenses = 0;

  for (const item of active) {
    if (item.frequency === "one_off") continue;
    if (isTransferCode(item.category)) continue;
    const inflow = item.direction === "inflow";
    const monthlyAmount = itemMonthlyAmount(item);

    if ((item.frequency ?? "monthly") === "monthly") {
      if (inflow) monthlyIncome += monthlyAmount;
      else monthlyExpenses += monthlyAmount;
    } else {
      const annual = monthlyAmount * 12;
      if (inflow) annualItemsIncome += annual;
      else annualItemsExpenses += annual;
    }
  }

  const annualIncome = monthlyIncome * 12 + annualItemsIncome;
  const annualExpenses = monthlyExpenses * 12 + annualItemsExpenses;

  const asOfIdx = monthIndex(asOfMonth);
  const lowIdx = asOfIdx - 11;
  const highIdx = asOfIdx + 12;
  const one_off_items = (items ?? []).filter((it) => {
    if (it.frequency !== "one_off") return false;
    const idx = monthIndex(monthStart(it.effective_from));
    return idx >= lowIdx && idx <= highIdx;
  });

  return {
    annual_income: annualIncome,
    annual_expenses: annualExpenses,
    monthly_income: annualIncome / 12,
    monthly_expenses: annualExpenses / 12,
    basis_months: 12,
    months_with_data: [],
    annual_items_income: annualItemsIncome,
    annual_items_expenses: annualItemsExpenses,
    one_off_items,
  };
}

/**
 * annualizeItems, split by category — the items analogue of periods.ts's
 * annualizeByCategory, for the modules (cashflow breakdown, tax relief scan)
 * that need a per-category view of the plan rather than just its totals.
 *
 * Only items active at `asOf` are counted; `one_off` items are excluded
 * (mirrors annualizeItems — a one-off has no place in a recurring monthly
 * breakdown, and is reported separately via `one_off_items`).
 *
 * `includeTransfers` mirrors annualizeByCategory's option: off by default (a
 * transfer is neither income nor spending, 决策 4), on when a caller
 * specifically wants a transfer category's own total (e.g. the "asset
 * transfers" line, or a relief scan that watches an SSPN/PRS deposit item).
 */
export function annualizeItemsByCategory(
  items: readonly StandingItem[],
  asOf: Date | string,
  opts: { includeTransfers?: boolean } = {},
): CategoryTotals[] {
  const asOfMonth = monthStart(asOf);
  const active = activeItems(items ?? [], asOfMonth);
  const acc = new Map<string, { mi: number; me: number; ai: number; ae: number }>();

  for (const item of active) {
    if (item.frequency === "one_off") continue;
    if (!opts.includeTransfers && isTransferCode(item.category)) continue;
    const key = item.category;
    const a = acc.get(key) ?? { mi: 0, me: 0, ai: 0, ae: 0 };
    const inflow = item.direction === "inflow";
    const monthlyAmount = itemMonthlyAmount(item);

    if ((item.frequency ?? "monthly") === "monthly") {
      if (inflow) a.mi += monthlyAmount;
      else a.me += monthlyAmount;
    } else {
      const annual = monthlyAmount * 12;
      if (inflow) a.ai += annual;
      else a.ae += annual;
    }
    acc.set(key, a);
  }

  return [...acc.entries()].map(([category, a]) => {
    const annual_income = a.mi * 12 + a.ai;
    const annual_expenses = a.me * 12 + a.ae;
    return {
      category,
      annual_income,
      annual_expenses,
      monthly_income: annual_income / 12,
      monthly_expenses: annual_expenses / 12,
    };
  });
}

// ---------------------------------------------------------------------------
// Revise / end — 决策 3
// ---------------------------------------------------------------------------

export type ReviseResult =
  | { mode: "correct"; update: Partial<StandingItem> }
  | { mode: "version"; close: { id: string; effective_to: string }; insert: StandingItem };

/**
 * 决策 3: two kinds of edit.
 *
 * 「更正」correct — the item was mis-keyed; there is no meaningful "before".
 * Fixed in place. Always the outcome for a `one_off` item (it has no future
 * version to open), and for any item when `fromMonth` is at or before its own
 * `effective_from` (you cannot "change" something before it started; that is
 * just a correction to its start).
 *
 * 「变更」version — a REAL change from month M onward (a raise, a new rent):
 * the old row is closed the month before M, and a new row opens at M carrying
 * `previous_id` back to the old one, so the history stays intact.
 */
export function reviseItem(
  item: StandingItem,
  changes: Partial<StandingItem>,
  fromMonth: Date | string,
): ReviseResult {
  const fm = monthStart(fromMonth);

  if (item.frequency === "one_off") {
    const update: Partial<StandingItem> = { ...changes };
    if (update.effective_from != null) {
      const ef = monthStart(update.effective_from);
      update.effective_from = ef;
      update.effective_to = ef;
    }
    return { mode: "correct", update };
  }

  if (fm <= item.effective_from) {
    return { mode: "correct", update: { ...changes } };
  }

  const { id: _oldId, ...rest } = item;
  const insert: StandingItem = {
    ...rest,
    ...changes,
    effective_from: fm,
    effective_to: item.effective_to ?? null,
    previous_id: item.id,
  };

  return {
    mode: "version",
    close: { id: item.id as string, effective_to: monthBefore(fm) },
    insert,
  };
}

/** 「结束」— writes effective_to, clamped so it never lands before the item
 *  even started (ending something "last month" when it only began this month
 *  would violate the DB's effective_to >= effective_from check). */
export function endItem(item: StandingItem, lastMonth: Date | string): { id: string; effective_to: string } {
  const lm = monthStart(lastMonth);
  const effective_to = lm < item.effective_from ? item.effective_from : lm;
  return { id: item.id as string, effective_to };
}

// ---------------------------------------------------------------------------
// itemsFromMonthRows — 决策 5, the migration
// ---------------------------------------------------------------------------

/** One client's cashflow_entries row, as read from the DB for migration. */
export interface MonthRow {
  id: string;
  client_id?: string | null;
  direction: ItemDirection;
  category: string;
  amount: number;
  frequency: string;
  /** 'YYYY-MM-DD' */
  period_month: string;
  source_note?: string | null;
  linked_asset_id?: string | null;
  linked_liability_id?: string | null;
  needs_review?: boolean | null;
  review_reason?: string | null;
}

export interface MigratedItem extends StandingItem {
  /** EVERY cashflow_entries id in this item's group, across the whole year —
   *  kept for provenance (the SQL's `migrated_from` metadata), not for the
   *  amount. */
  source_ids: string[];
  /** the id(s) of ONLY the group's latest-appearing month — this is what the
   *  amount is summed from (决策 5 §revised: last value, not an average). For
   *  a group with one row a month this is a single id; it can hold more than
   *  one if the same group somehow has two rows in that same month. */
  amount_ids: string[];
  /** always 1 — kept only so callers that still destructure `divisor` don't
   *  break. Migration no longer averages, so nothing is actually divided. */
  divisor: number;
}

function normaliseNote(note: string | null | undefined): string {
  return (note ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

interface Group {
  client_id: string | null;
  direction: ItemDirection;
  category: string;
  frequency: string;
  note: string;
  linked_asset_id: string | null;
  linked_liability_id: string | null;
  allIds: string[];
  earliestMonth: string;
  latestMonth: string;
  latestMonthAmount: number;
  latestMonthIds: string[];
  latestNote: string | null;
  needsReview: boolean;
  reviewReason: string | null;
}

/**
 * 决策 5 (REVISED — live data corrected the original averaging design): a
 * multi-month client's "several months" usually turn out to be ONE financial
 * position that got typed into different months — Jane's salary only landed
 * in July, her BNPL payment only in August; 乙's phone bill sat alone in
 * July. Averaging those months (the original design) would have quietly
 * halved Jane's RM 9,600 salary to RM 4,800 — exactly the "only one entry
 * this month" under-count the cashflow page already warns advisors about.
 * Migrating to items is the moment to correct that, not repeat it.
 *
 * New rule: take the group's MOST RECENT value, not an average.
 *   - Window = the client's latest year that has any data, EVERY month of
 *     it (not the saved/default `basis` — that concept only served the old
 *     averaging algorithm and no longer applies to window selection here;
 *     `basis` stays an accepted parameter purely so existing callers that
 *     already pass one, e.g. a UI computing `defaultBasis(entries)`, keep
 *     compiling — its value is ignored).
 *   - Grouped by (direction, category, frequency, normalised note, linked
 *     asset, linked liability) — unchanged.
 *   - amount = the SUM of the group's rows in the LATEST month the group
 *     appears in (not divided by anything — one real position, read once).
 *   - effective_from = the EARLIEST month the group appears in that year
 *     (when the position started being reported, even if a later month is
 *     what sets the amount).
 *   - `one_off` groups become one_off items: effective_to = effective_from.
 *   - Rows from an earlier year are left alone — still actuals, never
 *     migrated.
 *   - needs_review = true if ANY row in the group needs it; review_reason =
 *     the first non-empty one, across the WHOLE group (not just the latest
 *     month).
 */
export function itemsFromMonthRows(rows: MonthRow[], basis?: CashflowBasis | null): MigratedItem[] {
  void basis; // accepted for API compatibility only — no longer used for window selection.
  const allRows = rows ?? [];
  const year = recordedYears(allRows)[0];
  if (year == null) return [];

  const eligible = allRows
    .filter((r) => yearOf(r.period_month) === year)
    .slice()
    .sort((x, y) => (x.period_month !== y.period_month ? (x.period_month < y.period_month ? -1 : 1) : x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

  const groups = new Map<string, Group>();
  for (const r of eligible) {
    const freq = r.frequency ?? "monthly";
    const note = normaliseNote(r.source_note);
    const linkedAsset = r.linked_asset_id ?? null;
    const linkedLiability = r.linked_liability_id ?? null;
    const month = monthStart(r.period_month);
    const key = JSON.stringify([r.direction, r.category, freq, note, linkedAsset, linkedLiability]);

    let g = groups.get(key);
    if (!g) {
      g = {
        client_id: r.client_id ?? null,
        direction: r.direction,
        category: r.category,
        frequency: freq,
        note,
        linked_asset_id: linkedAsset,
        linked_liability_id: linkedLiability,
        allIds: [],
        earliestMonth: month,
        latestMonth: month,
        latestMonthAmount: 0,
        latestMonthIds: [],
        latestNote: null,
        needsReview: false,
        reviewReason: null,
      };
      groups.set(key, g);
    }

    g.allIds.push(r.id);
    if (month < g.earliestMonth) g.earliestMonth = month;

    const amount = Number(r.amount);
    const amt = Number.isFinite(amount) ? amount : 0;

    // `eligible` is sorted ascending by period_month, so `month` here is
    // always >= g.latestMonth — a strictly later month starts a fresh
    // "latest month" bucket; an equal month accumulates into it (more than
    // one row for the same group in the same month, summed together).
    if (month > g.latestMonth) {
      g.latestMonth = month;
      g.latestMonthAmount = amt;
      g.latestMonthIds = [r.id];
      g.latestNote = r.source_note ?? null;
    } else {
      g.latestMonthAmount += amt;
      g.latestMonthIds.push(r.id);
      g.latestNote = r.source_note ?? g.latestNote;
    }

    if (r.needs_review) g.needsReview = true;
    if (!g.reviewReason && r.review_reason) g.reviewReason = r.review_reason;
  }

  const items: MigratedItem[] = [];
  for (const g of groups.values()) {
    const isOneOff = g.frequency === "one_off";
    const amount = round2(g.latestMonthAmount);
    const effective_from = g.earliestMonth;
    const effective_to = isOneOff ? effective_from : null;

    items.push({
      client_id: g.client_id ?? undefined,
      direction: g.direction,
      category: g.category,
      name: g.latestNote ?? undefined,
      amount,
      frequency: g.frequency,
      effective_from,
      effective_to,
      linked_asset_id: g.linked_asset_id ?? undefined,
      linked_liability_id: g.linked_liability_id ?? undefined,
      source: "migrated",
      needs_review: g.needsReview,
      review_reason: g.reviewReason ?? undefined,
      source_ids: g.allIds.slice().sort(),
      amount_ids: g.latestMonthIds.slice().sort(),
      divisor: 1,
    });
  }

  return items.sort((a, b2) => {
    if (a.direction !== b2.direction) return a.direction < b2.direction ? -1 : 1;
    if (a.category !== b2.category) return a.category < b2.category ? -1 : 1;
    const an = normaliseNote(a.name);
    const bn = normaliseNote(b2.name);
    if (an !== bn) return an < bn ? -1 : 1;
    if (a.frequency !== b2.frequency) return a.frequency < b2.frequency ? -1 : 1;
    return 0;
  });
}
