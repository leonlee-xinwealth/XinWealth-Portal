// P4 Task A — reconciling ΔNW between two snapshots into explained components.
// spec docs/superpowers/specs/2026-09-27-cfp-p4-review-monitoring-design.md 决策 4.
//
// 可解释 = 月数 × (计划月结余 + 月供中的本金 + 雇主 EPF) + Σ 资产市场变动
// 资产市场变动 = 期间估值变化 − 关联到该资产的转移类常设项目 × 月数
//   （EPF 账户合计扣雇员+雇主 EPF；A 类不计市场变动）
// 未解释差额 = ΔNW − 可解释
//
// Why "savings" (monthly_surplus) already carries the employee EPF flow:
// `epf_employee` is a TRANSFER category (cashflow/periods.ts's
// TRANSFER_CATEGORIES_INLINE), so derived.ts's planCashflow excludes it from
// monthly_expenses — the salary standing item is recorded GROSS, and the
// employee's EPF deduction never reduces the plan's income or expense totals.
// That means `monthly_surplus` OVERSTATES actual take-home cash by exactly
// the employee EPF amount — which is exactly the amount that left the bank
// for the EPF account instead. So "savings" already explains that flow, and
// subtracting BOTH employee + employer EPF from the EPF assets' own raw value
// change (below) is what stops it being counted twice: employee EPF is
// explained via "savings", employer EPF via its own explicit term, and only
// the dividend on top of both is left as those assets' "market change".
//
// ─────────────────────────────────────────────────────────────────────────────
// Imports are relative-with-`.ts` only: ../taxonomy/balance.ts (EPF_ASSET_TYPES),
// ../cashflow/items.ts (activeItems, itemMonthlyAmount, StandingItem),
// ./valuation.ts (Valuation — the asset_valuations row shape P3 already
// defined; reused rather than re-declared).
// ─────────────────────────────────────────────────────────────────────────────

import { EPF_ASSET_TYPES, isLiquid } from "../taxonomy/balance.ts";
import { activeItems, itemMonthlyAmount, type StandingItem } from "../cashflow/items.ts";
import type { Valuation } from "./valuation.ts";

export interface SnapshotRef {
  net_worth: number;
  /** the snapshot's date — used only to know which end of the
   *  valuationsByAsset history is "before" and which is "after". */
  asOf: Date | string;
}

/** The four plan figures `reconcile` needs, already monthly. Callers build
 *  this from `derived.ts`'s `planCashflow()` result directly:
 *  `{ monthly_surplus: totals.monthly_income - totals.monthly_expenses,
 *     monthly_principal: plan.monthly_principal,
 *     monthly_employer_epf: plan.monthly_employer_epf,
 *     monthly_employee_epf: plan.monthly_employee_epf }`.
 *  `monthly_employee_epf` defaults to 0 (not every caller has an EPF asset to
 *  reconcile, and `computeSnapshot`'s own trimmed output doesn't carry it —
 *  see snapshot.ts's `raw_metrics.monthly_employee_epf` for where to read it
 *  when needed). */
export interface ReconcilePlan {
  monthly_surplus: number;
  monthly_principal: number;
  monthly_employer_epf: number;
  monthly_employee_epf?: number;
}

export interface ReconcileAsset {
  id: string;
  asset_type: string;
}

export type MarketChangeSource = "history" | "none" | "epf_combined";

export interface AssetMarketChange {
  asset_id: string;
  asset_type: string;
  /** raw estimated-value change between the two valuation points */
  value_change: number;
  /** linked transfer-item contributions (or, for the combined EPF row,
   *  employee+employer EPF) subtracted out of value_change */
  contribution_adjustment: number;
  /** value_change − contribution_adjustment — the genuine market movement */
  market_change: number;
  source: MarketChangeSource;
  note?: string;
}

export interface ReconcileInput {
  prev: SnapshotRef;
  curr: SnapshotRef;
  /** months between prev and curr — passed explicitly rather than derived
   *  from prev.asOf/curr.asOf, so a caller that already knows the review
   *  cadence (quarterly = 3, annual = 12, or an irregular gap) never has to
   *  fight a date-math edge case to get it right. */
  months: number;
  plan: ReconcilePlan;
  assets: readonly ReconcileAsset[];
  /** every asset's valuation history, keyed by asset id (P3's
   *  `asset_valuations`, already grouped by the caller). */
  valuationsByAsset: Readonly<Record<string, readonly Valuation[]>>;
  /** active standing items — used to find, per asset, the linked TRANSFER
   *  items whose monthly contribution inflated its value without being
   *  "market growth" (决策 4). */
  items?: readonly StandingItem[];
}

export interface ReconcileResult {
  delta_net_worth: number;
  explained: {
    savings: number;
    principal: number;
    employer_epf: number;
    market_change: number;
  };
  market_by_asset: AssetMarketChange[];
  unexplained_gap: number;
  notes: string[];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * 'YYYY-MM-DD' read as UTC midnight — same convention as
 * cashflow/items.ts's monthStart / finance/valuation.ts's toUtcMs: slicing
 * the string directly, never round-tripping through `new Date(string)`,
 * which shifts a date-only string a day earlier west of Greenwich.
 */
function toUtcMs(d: Date | string): number {
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(d).getTime();
  }
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** The latest valuation at or before `asOfMs`, or null when there is none. */
function valueAt(valuations: readonly Valuation[] | undefined, asOfMs: number): number | null {
  const usable = (valuations ?? [])
    .filter((v) => v && v.valuation_date && Number.isFinite(v.value))
    .map((v) => ({ ...v, _ts: toUtcMs(v.valuation_date) }))
    .filter((v) => v._ts <= asOfMs)
    .sort((a, b) => a._ts - b._ts);
  if (usable.length === 0) return null;
  return usable[usable.length - 1].value;
}

/** Sum of active, TRANSFER-category, non-transfer-agnostic standing items
 *  linked to `assetId`'s monthly contribution — unsigned, since a deposit
 *  inflates the asset's value regardless of which side of the ledger the
 *  item is recorded on. Only items whose category is a taxonomy TRANSFER
 *  code count: a rental-income item linked to a property is real income, not
 *  a contribution, and must not be subtracted here. */
function linkedContributionMonthly(
  items: readonly StandingItem[],
  assetId: string,
  asOf: Date | string,
  isTransfer: (category: string) => boolean,
): number {
  let total = 0;
  for (const it of activeItems(items, asOf)) {
    if (it.linked_asset_id !== assetId) continue;
    if (!isTransfer(it.category)) continue;
    total += Math.abs(itemMonthlyAmount(it));
  }
  return total;
}

/** Inline TRANSFER check — the same list cashflow/periods.ts carries (this
 *  file may only import ../cashflow/items.ts and ./valuation.ts, not
 *  periods.ts, to avoid pulling a third module into reconcile.ts's surface;
 *  periods.test.ts / cashflowPeriods.test.ts already pin this list against
 *  taxonomy/cashflow.ts's own, and this is a verbatim copy of that list). */
const TRANSFER_CATEGORIES: ReadonlySet<string> = new Set([
  "asnb_contribution", "asset_purchase", "asset_sale", "borrowing_family",
  "business_capital", "credit_card_payment", "crypto_purchase", "epf_employee",
  "epf_voluntary", "epf_withdrawal", "fd_placement", "gold_purchase",
  "investment_contribution", "investment_other", "lend_out", "loan_drawdown",
  "prs_contribution", "savings_withdrawal", "sspn", "stock_etf_purchase",
  "tabung_haji", "to_savings", "unit_trust_contribution",
]);
const isTransferCategory = (code: string | null | undefined) => code != null && TRANSFER_CATEGORIES.has(code);

const NOTE_UNLINKED_TRANSFERS = "未关联的定期投入会让对账失真";

export function reconcile(input: ReconcileInput): ReconcileResult {
  const { prev, curr, months, plan, assets, valuationsByAsset, items = [] } = input;

  const deltaNetWorth = round2(curr.net_worth - prev.net_worth);
  const savings = round2(months * plan.monthly_surplus);
  const principal = round2(months * plan.monthly_principal);
  const employerEpf = round2(months * plan.monthly_employer_epf);
  const employeeEpf = plan.monthly_employee_epf ?? 0;

  const prevMs = toUtcMs(prev.asOf);
  const currMs = toUtcMs(curr.asOf);

  const notes: string[] = [];
  const market_by_asset: AssetMarketChange[] = [];

  // A 类流动资产不计市场变动 (决策 4) — only non-liquid assets are walked
  // below. EPF-class assets (决策 4: "EPF 账户合计扣雇员+雇主 EPF") are
  // pooled into ONE combined row instead of one row per account, since the
  // employee/employer EPF flow is a single figure for the whole household
  // member, not one per epf_account_N.
  const epfAssets = assets.filter((a) => EPF_ASSET_TYPES.includes(a.asset_type));
  const otherAssets = assets.filter(
    (a) => !isLiquid(a.asset_type) && !EPF_ASSET_TYPES.includes(a.asset_type),
  );

  if (epfAssets.length > 0) {
    let rawChange = 0;
    let anyHistory = false;
    for (const a of epfAssets) {
      const before = valueAt(valuationsByAsset[a.id], prevMs);
      const after = valueAt(valuationsByAsset[a.id], currMs);
      if (before != null && after != null) {
        rawChange += after - before;
        anyHistory = true;
      }
    }
    const contribution = round2(months * (employeeEpf + plan.monthly_employer_epf));
    if (!anyHistory) {
      notes.push(`EPF 账户缺少估值记录，市场变动记为 0（合计 ${epfAssets.length} 个账户）`);
      market_by_asset.push({
        asset_id: "epf_combined",
        asset_type: "epf",
        value_change: 0,
        contribution_adjustment: contribution,
        market_change: round2(0 - contribution),
        source: "none",
        note: "缺少估值记录",
      });
    } else {
      const marketChange = round2(rawChange - contribution);
      market_by_asset.push({
        asset_id: "epf_combined",
        asset_type: "epf",
        value_change: round2(rawChange),
        contribution_adjustment: contribution,
        market_change: marketChange,
        source: "epf_combined",
      });
    }
  }

  for (const a of otherAssets) {
    const before = valueAt(valuationsByAsset[a.id], prevMs);
    const after = valueAt(valuationsByAsset[a.id], currMs);
    const contribution = round2(months * linkedContributionMonthly(items, a.id, curr.asOf, isTransferCategory));

    if (before == null || after == null) {
      notes.push(`资产「${a.id}」缺少估值记录，市场变动记为 0`);
      market_by_asset.push({
        asset_id: a.id,
        asset_type: a.asset_type,
        value_change: 0,
        contribution_adjustment: contribution,
        market_change: round2(0 - contribution),
        source: "none",
        note: "缺少估值记录",
      });
      continue;
    }

    const valueChange = round2(after - before);
    market_by_asset.push({
      asset_id: a.id,
      asset_type: a.asset_type,
      value_change: valueChange,
      contribution_adjustment: contribution,
      market_change: round2(valueChange - contribution),
      source: "history",
    });
  }

  // 决策 4: flag unlinked transfer items — they still moved money, but
  // reconcile has no asset to attribute their contribution to, so the target
  // asset's whole value change is misread as "market growth".
  const hasUnlinkedTransfer = activeItems(items, curr.asOf).some(
    (it) => isTransferCategory(it.category) && it.linked_asset_id == null,
  );
  if (hasUnlinkedTransfer) notes.push(NOTE_UNLINKED_TRANSFERS);

  const marketChangeTotal = round2(market_by_asset.reduce((s, m) => s + m.market_change, 0));
  const explainedTotal = round2(savings + principal + employerEpf + marketChangeTotal);
  const unexplainedGap = round2(deltaNetWorth - explainedTotal);

  return {
    delta_net_worth: deltaNetWorth,
    explained: {
      savings,
      principal,
      employer_epf: employerEpf,
      market_change: marketChangeTotal,
    },
    market_by_asset,
    unexplained_gap: unexplainedGap,
    notes,
  };
}
