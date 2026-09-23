// P3 asset quality 2×2 (D6) — spec 2026-09-26-cfp-p3-assets-portfolio-design.md
// 决策 3; framework spec 2026-09-22 §4.
//
// Imports are relative-with-`.ts` only, from ../taxonomy/balance.ts,
// ../cashflow/items.ts, ./loans.ts and ./valuation.ts — the same narrow
// surface derived.ts uses. This file MAY import those; none of them import
// this file back.

import { assetClassOf, type AssetClass } from "../taxonomy/balance.ts";
import { activeItems, itemMonthlyAmount, type StandingItem } from "../cashflow/items.ts";
import { estimateLoan, type LoanInput } from "./loans.ts";
import { valueChangeAnnual, type Valuation, type ValueChangeSource } from "./valuation.ts";

export type Quadrant =
  | "productive"
  | "yielding_depreciating"
  | "appreciating_cash_consuming"
  | "consuming";

export interface QuadrantMeta {
  id: Quadrant;
  label_zh: string;
  label_en: string;
}

/** 框架 spec §4 的四象限 — 净现金流 × 价值变动. */
export const QUADRANTS: readonly QuadrantMeta[] = [
  { id: "productive", label_zh: "生财资产", label_en: "Productive" },
  { id: "yielding_depreciating", label_zh: "收益但贬值", label_en: "Yielding but depreciating" },
  { id: "appreciating_cash_consuming", label_zh: "增值但吃现金", label_en: "Appreciating but cash-consuming" },
  { id: "consuming", label_zh: "消耗型资产", label_en: "Consuming" },
];

const NOTE_MISSING_VALUATION_HISTORY = "缺少估值历史";
// A class-D (personal use) asset with zero linked standing items AND zero
// linked liabilities isn't actually cash-flow-neutral — it almost certainly
// carries a loan, insurance, upkeep or tax that just hasn't been linked yet.
// Labeling it "productive" (net_cash_flow 0 >= 0) would be actively wrong, so
// this case gets no quadrant at all (决策 3 fix, prod incident: an unlinked
// house/car defaulted to 生财资产/收益但贬值).
const NOTE_UNLINKED_PERSONAL_USE =
  "自用资产通常有持有成本（贷款、保险、保养、税费），请先关联相关贷款或收支";
// A class-C (investment) asset with no links keeps its computed quadrant —
// unlike class D, "no cash flow" is a plausible real state for e.g. gold —
// but is still flagged so the advisor knows to check for a missed link.
const NOTE_UNLINKED_INVESTMENT = "未关联任何收支";

export interface AssetInput {
  id: string;
  asset_type: string;
  current_value?: number | null;
}

/** A liability row, scoped down to what estimateLoan + the 2×2 need. */
export interface LiabilityInput extends LoanInput {
  id?: string | null;
  linked_asset_id?: string | null;
}

/** A valuation row that may carry its owning asset's id — assessAssets()
 *  passes the whole client's valuation history through unfiltered and each
 *  per-asset call picks out its own rows; a plain Valuation (no asset_id)
 *  is assumed already scoped to the one asset being assessed. */
export interface AssetValuationRow extends Valuation {
  asset_id?: string | null;
}

export interface AssessContext {
  items?: readonly StandingItem[] | null;
  liabilities?: readonly LiabilityInput[] | null;
  valuations?: readonly AssetValuationRow[] | null;
}

export interface LinkedItemSummary {
  id?: string;
  category: string;
  direction: "inflow" | "outflow";
  /** monthly equivalent, unsigned (direction carries the sign). */
  monthly_amount: number;
}

export interface LinkedLiabilitySummary {
  id?: string | null;
  liability_type: string;
  monthly_payment: number;
}

export interface AssetAssessment {
  asset_id: string;
  asset_class: AssetClass;
  /** null for class A (liquid) and B (retirement) — spec 决策 3: they don't
   *  get a 2×2 label, their "return" is interest/dividends and balance
   *  movement, not a productive-asset judgement. */
  quadrant: Quadrant | null;
  /** true for a class C or D asset with zero linked standing items AND zero
   *  linked liabilities — a class D one also gets `quadrant: null` (see
   *  NOTE_UNLINKED_PERSONAL_USE); a class C one keeps its computed quadrant.
   *  Always false for class A/B (they're never labeled either way). */
  unlinked: boolean;
  net_cash_flow_monthly: number;
  linked_items: LinkedItemSummary[];
  linked_liabilities: LinkedLiabilitySummary[];
  value_change_annual: number | null;
  value_change_source: ValueChangeSource;
  total_return_annual: number;
  return_pct: number | null;
  notes: string[];
}

export interface QuadrantTotal {
  count: number;
  value: number;
  net_cash_flow_monthly: number;
}

export interface UnlinkedTotal {
  count: number;
  value: number;
}

export interface AssessAssetsResult {
  assets: AssetAssessment[];
  /** the four framework quadrants, plus `unlinked` — class-D assets with no
   *  linked items/liabilities, which get no quadrant at all (see
   *  AssetAssessment.unlinked). */
  by_quadrant: Record<Quadrant, QuadrantTotal> & { unlinked: UnlinkedTotal };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

function quadrantFor(netCashFlowMonthly: number, valueChangeEffective: number): Quadrant {
  const cashOk = netCashFlowMonthly >= 0;
  const valueOk = valueChangeEffective >= 0;
  if (cashOk && valueOk) return "productive";
  if (cashOk && !valueOk) return "yielding_depreciating";
  if (!cashOk && valueOk) return "appreciating_cash_consuming";
  return "consuming";
}

/**
 * Assesses one asset: net monthly cash flow from its linked standing items
 * (inflow +, outflow −, monthly equivalents via itemMonthlyAmount) and
 * linked liabilities (the full estimated monthly installment, subtracted —
 * "how much actually leaves the pocket", spec 框架§4), plus its annualised
 * value change and the resulting 2×2 quadrant.
 *
 * A null value change (no usable valuation history, and not a vehicle) is
 * treated as 0 for both the quadrant call and total_return_annual, with a
 * note flagging why — the field itself stays null so callers can tell
 * "measured zero" from "unknown".
 */
export function assessAsset(
  asset: AssetInput,
  ctx: AssessContext,
  asOf: Date | string,
): AssetAssessment {
  const asset_class = assetClassOf(asset.asset_type);
  const currentValue = Number(asset.current_value) || 0;
  const asOfDate = typeof asOf === "string" ? new Date(asOf) : asOf;

  const linkedItems = activeItems(ctx.items ?? [], asOf).filter(
    (it) => it.linked_asset_id != null && it.linked_asset_id === asset.id,
  );
  let itemsMonthly = 0;
  const linked_items: LinkedItemSummary[] = linkedItems.map((it) => {
    const monthly = round2(itemMonthlyAmount(it));
    itemsMonthly += it.direction === "inflow" ? monthly : -monthly;
    return { id: it.id, category: it.category, direction: it.direction, monthly_amount: monthly };
  });

  const linkedLiabilities = (ctx.liabilities ?? []).filter(
    (l) => l.linked_asset_id != null && l.linked_asset_id === asset.id,
  );
  let liabilitiesMonthly = 0;
  const linked_liabilities: LinkedLiabilitySummary[] = linkedLiabilities.map((l) => {
    const est = estimateLoan(l, asOfDate);
    liabilitiesMonthly += est.monthly_payment;
    return { id: l.id ?? null, liability_type: l.liability_type, monthly_payment: est.monthly_payment };
  });

  const net_cash_flow_monthly = round2(itemsMonthly - liabilitiesMonthly);

  const ownValuations = (ctx.valuations ?? []).filter(
    (v) => v.asset_id == null || v.asset_id === asset.id,
  );
  const vc = valueChangeAnnual(ownValuations, asOf, { assetType: asset.asset_type, currentValue });

  const notes: string[] = [];
  let effectiveValueChange: number;
  if (vc.annual_change == null) {
    effectiveValueChange = 0;
    if (vc.source === "none") notes.push(NOTE_MISSING_VALUATION_HISTORY);
  } else {
    effectiveValueChange = vc.annual_change;
  }

  const labeled = asset_class === "C" || asset_class === "D";
  const hasLinks = linked_items.length > 0 || linked_liabilities.length > 0;
  const unlinked = labeled && !hasLinks;
  let quadrant = labeled ? quadrantFor(net_cash_flow_monthly, effectiveValueChange) : null;

  if (unlinked) {
    if (asset_class === "D") {
      // Zero-cost personal use is not a real state — don't hand out a
      // quadrant (previously defaulted to "productive"/"yielding_depreciating"
      // via net_cash_flow_monthly === 0) until it's actually linked.
      quadrant = null;
      notes.push(NOTE_UNLINKED_PERSONAL_USE);
    } else {
      notes.push(NOTE_UNLINKED_INVESTMENT);
    }
  }

  const total_return_annual = round2(net_cash_flow_monthly * 12 + effectiveValueChange);
  const return_pct = currentValue > 0 ? round4(total_return_annual / currentValue) : null;

  return {
    asset_id: asset.id,
    asset_class,
    quadrant,
    unlinked,
    net_cash_flow_monthly,
    linked_items,
    linked_liabilities,
    value_change_annual: vc.annual_change,
    value_change_source: vc.source,
    total_return_annual,
    return_pct,
    notes,
  };
}

/** assessAsset over a whole portfolio, plus totals per quadrant (unlabeled
 *  A/B assets are excluded from by_quadrant — there is no bucket for them). */
export function assessAssets(
  assets: readonly AssetInput[] | null | undefined,
  ctx: AssessContext,
  asOf: Date | string,
): AssessAssetsResult {
  const list = assets ?? [];
  const results = list.map((a) => assessAsset(a, ctx, asOf));

  const by_quadrant: Record<Quadrant, QuadrantTotal> & { unlinked: UnlinkedTotal } = {
    productive: { count: 0, value: 0, net_cash_flow_monthly: 0 },
    yielding_depreciating: { count: 0, value: 0, net_cash_flow_monthly: 0 },
    appreciating_cash_consuming: { count: 0, value: 0, net_cash_flow_monthly: 0 },
    consuming: { count: 0, value: 0, net_cash_flow_monthly: 0 },
    unlinked: { count: 0, value: 0 },
  };

  for (let i = 0; i < list.length; i++) {
    const r = results[i];
    // Class-D unlinked assets carry quadrant: null — tallied into their own
    // bucket instead of one of the four quadrants (they aren't classified).
    if (r.unlinked && r.asset_class === "D") {
      by_quadrant.unlinked.count += 1;
      by_quadrant.unlinked.value = round2(by_quadrant.unlinked.value + (Number(list[i].current_value) || 0));
      continue;
    }
    if (r.quadrant == null) continue;
    const bucket = by_quadrant[r.quadrant];
    bucket.count += 1;
    bucket.value = round2(bucket.value + (Number(list[i].current_value) || 0));
    bucket.net_cash_flow_monthly = round2(bucket.net_cash_flow_monthly + r.net_cash_flow_monthly);
  }

  return { assets: results, by_quadrant };
}
