// Deterministic FinancialBaseline — the single source of truth every module
// calculator consumes. Pure function, no LLM, no network. Resolves the two
// coupling bugs the multi-agent design exists to fix:
//   1. emergency fund vs insurance CNA double-counting liquid assets
//      (liquid_assets_after_emergency reserves 6 months of essential spend)
//   2. unified economic assumptions so retirement/investment/goals never
//      diverge on returns or inflation.

import {
  ANNUAL_OCCURRENCES,
  defaultBasis,
  isAssetTransfer,
  type CashflowBasis,
} from "../_shared/cashflow/periods.ts";
import { monthStart } from "../_shared/cashflow/items.ts";
import { LIQUID_ASSET_TYPES as TAXONOMY_LIQUID } from "../_shared/taxonomy/balance.ts";
import { planCashflow, type PlanCashflowInput } from "../_shared/finance/derived.ts";
import { assessAssets } from "../_shared/finance/assetQuality.ts";
import type {
  BaselineAssumptions,
  CfpData,
  FinancialBaseline,
  HoldingRow,
  InvestmentAccountRow,
  PlanningInputs,
} from "./types.ts";

export const BASELINE_DEFAULTS = {
  epf_dividend: 0.055,
  inflation: 0.035,
  education_inflation: 0.04,
  retirement_replacement_ratio: 0.66,
  withdrawal_rate: 0.04,
  life_expectancy: 85,
  default_retirement_age: 60,
  emergency_months_low: 3,
  emergency_months_high: 6,
  investment_return_by_band: {
    conservative: 0.04,
    moderate: 0.05,
    balanced: 0.06,
    growth: 0.075,
    aggressive: 0.09,
  } as Record<string, number>,
  default_band: "balanced",
} as const;

/** @deprecated Re-exported from the shared module so existing importers keep
 *  working. The annualisation itself lives in _shared/cashflow/periods.ts —
 *  applying this table row-by-row is what treated a month's actual figure as a
 *  standing monthly commitment. */
export const CASHFLOW_ANNUALIZE = ANNUAL_OCCURRENCES;

/** Emergency-fund-eligible liquid assets: taxonomy class A. */
export const LIQUID_ASSET_TYPES: readonly string[] = TAXONOMY_LIQUID;

const round = (n: number) => Math.round(n);

/**
 * P3 决策 1: `assets` is the single source of truth for net worth / the
 * investable total. An `investment_accounts` row with `asset_id` set has
 * already been folded into `assets` — its own value now lives on that asset,
 * and its historical snapshots moved to `asset_valuations` (migration
 * 20260926000003_investment_consolidation_backfill.sql). Summing its
 * `portfolio_holdings` on top of `assets` would double-count it.
 *
 * A holding is still "legacy" — and must still be counted — when its account
 * either isn't in `accounts` at all, or is but has no `asset_id` yet (not
 * migrated). This is exactly today's behaviour (no account carries an
 * asset_id until the migration runs, so every holding still counts) and
 * flips to excluding a holding the moment ITS OWN account is migrated —
 * without any caller needing to know why. Exported so
 * modules/investment/calc.ts's allocation total applies the identical rule.
 */
export function legacyHoldings<H extends Pick<HoldingRow, "account_id">>(
  holdings: readonly H[],
  accounts: ReadonlyArray<Pick<InvestmentAccountRow, "id" | "asset_id">>,
): H[] {
  const migratedAccountIds = new Set(
    accounts
      .filter((a) => a.id != null && a.asset_id != null)
      .map((a) => a.id as string),
  );
  if (migratedAccountIds.size === 0) return holdings.slice();
  return holdings.filter(
    (h) => h.account_id == null || !migratedAccountIds.has(h.account_id),
  );
}

/** Chinese label for a D1-estimated loan field, for baseline_notes. */
const ESTIMATED_FIELD_LABEL_ZH: Record<string, string> = {
  monthly_payment: "月供",
  interest_rate: "利率",
  remaining_months: "剩余期数",
};

export function ageFromDob(dob: string | null, now = new Date()): number | null {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (!isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / (365.25 * 24 * 3600 * 1000));
}

/** 小会计口径 — re-exported from the shared module; see periods.ts. */
export { isAssetTransfer };

export function resolveAssumptions(
  riskProfile: string | null,
  overrides?: Partial<BaselineAssumptions>,
): BaselineAssumptions {
  const d = BASELINE_DEFAULTS;
  const band = riskProfile && d.investment_return_by_band[riskProfile]
    ? riskProfile
    : d.default_band;
  const base: BaselineAssumptions = {
    epf_dividend: d.epf_dividend,
    inflation: d.inflation,
    education_inflation: d.education_inflation,
    retirement_replacement_ratio: d.retirement_replacement_ratio,
    withdrawal_rate: d.withdrawal_rate,
    life_expectancy: d.life_expectancy,
    default_retirement_age: d.default_retirement_age,
    emergency_months_low: d.emergency_months_low,
    emergency_months_high: d.emergency_months_high,
    investment_return_by_band: { ...d.investment_return_by_band },
    client_investment_return: d.investment_return_by_band[band],
  };
  return { ...base, ...(overrides ?? {}) };
}

export function computeBaseline(
  f: CfpData,
  inputs: PlanningInputs = {},
  now = new Date(),
): FinancialBaseline {
  const assumptions = resolveAssumptions(
    f.client.risk_profile,
    inputs.assumption_overrides,
  );
  const notes: string[] = [];

  // The plan is annualised from the months the advisor chose. Absent a choice,
  // from every month the client has on record — never from "the latest month",
  // which is the rule that used to silently discard most of the data.
  const basis: CashflowBasis | null = inputs.cashflow_basis ??
    defaultBasis(f.cashflow);

  // P2b 决策 6: per-employee statutory info. A joint report's SOCSO/EIS wage
  // ceiling and EPF employer-rate threshold each apply PER EMPLOYEE, so the
  // household path is keyed by client_id (each spouse's items keep their own
  // client_id through the household merge — see household.ts) instead of a
  // single pooled `client`.
  const clientsInfo: Record<string, { has_epf?: boolean | null; date_of_birth?: string | null }> | undefined =
    f.household
      ? {
        [f.household.primary.client.id]: {
          has_epf: f.household.primary.client.has_epf,
          date_of_birth: f.household.primary.client.date_of_birth,
        },
        [f.household.partner.client.id]: {
          has_epf: f.household.partner.client.has_epf,
          date_of_birth: f.household.partner.client.date_of_birth,
        },
      }
      : undefined;

  // P2a (决策 1, 5) / P2b (决策 1, 6): installments and premiums are derived
  // from the liabilities and policies themselves — never re-keyed by hand —
  // and folded into the same income/expense totals every ratio below is built
  // on. This ONE call replaces the old annualizeCashflow(...) +
  // liabilities.monthly_payment sum: manual rows that duplicate a derived
  // item (决策 4) are dropped from the manual side so the total counts each
  // obligation once. When the client has any standing items, the same call
  // reads the PLAN instead of averaging actuals (P2b 决策 1) and also derives
  // EPF/SOCSO/EIS from the standing salary items (决策 6).
  const planInput: PlanCashflowInput = {
    rows: f.cashflow,
    liabilities: f.liabilities,
    policies: f.policies,
    basis,
    today: now,
    items: f.items,
    client: { has_epf: f.client.has_epf, date_of_birth: f.client.date_of_birth },
    ...(clientsInfo ? { clients: clientsInfo } : {}),
  };
  const plan = planCashflow(planInput);
  const cf = plan.totals;
  const annualIncome = cf.annual_income;
  const annualExpenses = cf.annual_expenses;
  const monthlyIncome = cf.monthly_income;
  // Essential-expense proxy: all recurring outflows, including derived loan
  // installments and policy premiums. Category strings are free-text, so a
  // conservative "everything is essential" reading keeps the emergency fund
  // honest rather than optimistic.
  const monthlyEssential = cf.monthly_expenses;
  notes.push("紧急预备金按全部经常性月支出为「必要支出」口径计算");

  const itemsAsOf = plan.source === "items" ? monthStart(now) : null;
  if (plan.source === "items") {
    // P2b 决策 1: the plan comes from standing items, not a chosen window of
    // actuals — there is no basis to state, only the month it was read as of.
    notes.push(`现金流依据：常设项目（截至 ${itemsAsOf!.slice(0, 7)}）`);
  } else if (basis) {
    notes.push(
      `收支按 ${basis.year} 年 ${basis.from_month}–${basis.to_month} 月的实际记录年化`,
    );
    // A gap in the record is a fact about the data, not a rounding question:
    // the advisor has to know the average came from fewer months than they
    // selected before they read anything built on it.
    if (cf.months_with_data.length < cf.basis_months) {
      notes.push(
        `基准区间 ${cf.basis_months} 个月中,仅 ${cf.months_with_data.length} 个月有记录,月均按有记录的月份计算`,
      );
    }
  } else {
    notes.push("未录得任何月份的收支记录,收入与支出按零处理");
  }
  notes.push("储蓄/投资转入、资产变现与借入视为资产转移，不计入收入或支出；贷款月供仍计入支出");

  // P2b 决策 6: statutory EPF/SOCSO/EIS notes, verbatim from the derived
  // items' own warnings (「按法定比例估算」) — deduped, since every employee's
  // statutory items carry the identical note.
  const statutoryItems = plan.derived.filter((d) => d.source_type === "statutory");
  if (statutoryItems.length > 0) {
    const statutoryNotes = new Set<string>();
    for (const item of statutoryItems) {
      for (const w of item.warnings) statutoryNotes.add(w);
    }
    for (const w of statutoryNotes) notes.push(w);
  }

  // P2a: which installments/premiums were auto-included, which of their
  // fields were estimated rather than given, every loan warning verbatim, and
  // how many manually-keyed rows were superseded by them (决策 2-4).
  const loanItems = plan.derived.filter((d) => d.source_type === "liability");
  const premiumItems = plan.derived.filter((d) => d.source_type === "policy");
  if (loanItems.length > 0 || premiumItems.length > 0) {
    notes.push(
      `现金流已自动计入 ${loanItems.length} 笔贷款月供、${premiumItems.length} 笔保单保费（来自负债/保单记录，非手工录入）`,
    );
  }
  for (const item of loanItems) {
    if (item.estimated.length > 0) {
      const fields = item.estimated.map((k) => ESTIMATED_FIELD_LABEL_ZH[k] ?? k).join("、");
      notes.push(`${item.source_name}：${fields}缺失，按 D1 规则估算`);
    }
    for (const w of item.warnings) notes.push(`${item.source_name}：${w}`);
  }
  if (plan.superseded.length > 0) {
    notes.push(`${plan.superseded.length} 笔手工录入的现金流已由对应负债/保单自动计入取代，不再重复计算`);
  }

  const emergencyNeedLow = monthlyEssential * assumptions.emergency_months_low;
  const emergencyNeedHigh = monthlyEssential * assumptions.emergency_months_high;

  const liquidTotal = f.assets
    .filter((a) => LIQUID_ASSET_TYPES.includes(a.asset_type))
    .reduce((s, a) => s + (a.current_value ?? 0), 0);
  // Reserve the conservative 6-month target before anything else claims the
  // cash — insurance CNA deducts only what is left (coupling fix #1).
  const liquidAfterEmergency = Math.max(0, liquidTotal - emergencyNeedHigh);
  notes.push(
    `可抵扣流动资产已预留 ${assumptions.emergency_months_high} 个月紧急预备金`,
  );

  // P3 决策 1: only holdings not yet folded into an asset count on top of
  // assets — see legacyHoldings above.
  const investableHoldings = legacyHoldings(f.holdings, f.investment_accounts);
  const totalAssets = f.assets.reduce((s, a) => s + (a.current_value ?? 0), 0) +
    investableHoldings.reduce((s, h) => s + (h.market_value ?? 0), 0);
  const totalLiabilities = f.liabilities.reduce(
    (s, l) => s + (l.outstanding_balance ?? 0),
    0,
  );
  // P2a (决策 5): each liability's FULL estimated payment (credit card = its
  // minimum payment; policy_loan excluded) — replaces the old raw
  // liabilities.monthly_payment sum, which was 0 for any liability that never
  // had a payment typed in by hand.
  const monthlyDebtService = plan.monthly_debt_service;
  const monthlyPrincipal = plan.monthly_principal;
  const netWorth = totalAssets - totalLiabilities;

  // P3 决策 3: per-asset 2×2 — net monthly cash flow (linked standing items
  // minus linked liabilities' estimated installments) × annualised value
  // change (from asset_valuations history, or a vehicle's default
  // depreciation). Additive: nothing above reads this back.
  const assetQuality = assessAssets(
    f.assets.map((a) => ({ id: a.id ?? "", asset_type: a.asset_type, current_value: a.current_value })),
    { items: f.items, liabilities: f.liabilities, valuations: f.asset_valuations ?? [] },
    now,
  );

  const age = ageFromDob(f.client.date_of_birth, now);
  const retirementAge = f.client.retirement_age ??
    assumptions.default_retirement_age;
  if (!f.client.retirement_age) {
    notes.push(`退休年龄未填写，按 ${retirementAge} 岁假设`);
  }
  if (annualIncome <= 0) {
    notes.push("未录得经常性收入，收入相关比率不具参考意义");
  }

  // Joint report: every figure above is already the couple's combined position
  // (f holds the merged household data). The timeline still runs on the primary
  // client's age — a dual retirement horizon is out of scope, so say so.
  const partner = f.household?.partner.client ?? null;
  const partnerAge = partner ? ageFromDob(partner.date_of_birth, now) : null;
  const partnerRetirementAge = partner
    ? partner.retirement_age ?? assumptions.default_retirement_age
    : null;
  if (partner) {
    notes.push("联合规划：收入、支出、资产与负债为夫妻两人合并口径");
    notes.push(
      `退休时间轴按主客户年龄计算；配偶年龄 ${
        partnerAge ?? "未知"
      }、计划退休年龄 ${partnerRetirementAge} 另行列示`,
    );
    const dupes = f.household?.duplicates ?? [];
    if (dupes.length > 0) {
      notes.push(
        `联合规划：检测到 ${dupes.length} 项两人重复录入的资产／负债，请确认共同持有的项目只录在一方名下`,
      );
    }
  }

  return {
    version: 1,
    cashflow_basis: basis,
    cashflow_basis_months: cf.basis_months,
    cashflow_months_with_data: cf.months_with_data,
    annual_income: round(annualIncome),
    annual_expenses: round(annualExpenses),
    monthly_income: round(monthlyIncome),
    monthly_essential_expenses: round(monthlyEssential),
    annual_surplus: round(annualIncome - annualExpenses),
    cashflow_source: plan.source,
    monthly_employee_epf: plan.monthly_employee_epf,
    monthly_employer_epf: plan.monthly_employer_epf,
    monthly_socso_eis: plan.monthly_socso_eis,
    // P2b 决策 6: forced EPF savings can't be redirected by the budget
    // waterfall — subtract it from the surplus every allocation is measured
    // against. 0 employee EPF (actuals path, or no has_epf) leaves this equal
    // to annual_surplus.
    annual_disposable_surplus: round(annualIncome - annualExpenses) - round(12 * plan.monthly_employee_epf),
    one_off_items: plan.one_off_items,
    items_as_of: itemsAsOf,
    emergency_fund_need_low: round(emergencyNeedLow),
    emergency_fund_need_high: round(emergencyNeedHigh),
    emergency_fund_actual: round(liquidTotal),
    liquid_assets_total: round(liquidTotal),
    liquid_assets_after_emergency: round(liquidAfterEmergency),
    total_assets: round(totalAssets),
    net_worth: round(netWorth),
    total_liabilities: round(totalLiabilities),
    monthly_debt_service: round(monthlyDebtService),
    monthly_principal: round(monthlyPrincipal),
    derived_items: plan.derived,
    superseded_manual: plan.superseded.length,
    debt_service_ratio: monthlyIncome > 0
      ? Number((monthlyDebtService / monthlyIncome).toFixed(4))
      : null,
    savings_ratio: annualIncome > 0
      ? Number(((annualIncome - annualExpenses) / annualIncome).toFixed(4))
      : null,
    solvency_ratio: totalAssets > 0
      ? Number((netWorth / totalAssets).toFixed(4))
      : null,
    current_year: now.getFullYear(),
    age,
    retirement_age: retirementAge,
    years_to_retirement: age != null ? Math.max(0, retirementAge - age) : null,
    dependents: f.client.number_of_dependants ?? 0,
    marital_status: f.client.marital_status,
    ...(partner
      ? {
        household_mode: true,
        partner_age: partnerAge,
        partner_retirement_age: partnerRetirementAge,
      }
      : {}),
    assumptions,
    baseline_notes: notes,
    asset_quality: assetQuality,
  };
}
