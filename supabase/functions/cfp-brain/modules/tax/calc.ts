// 税务师 (tax_strategist) — deterministic Malaysian resident individual tax
// calculator. Pure, no LLM. Advisor-entered relief claims (PlanningInputs.tax)
// are NOT part of CfpData/FinancialBaseline, so this module's compute() takes
// them via an explicit `inputs` parameter rather than the shared baseline.

import type { CfpData, FinancialBaseline } from "../../types.ts";
import { annualPremiumTotal } from "../../../_shared/insurance/mapping.ts";
import { annualizeByCategory, type CashflowBasis } from "../../../_shared/cashflow/periods.ts";
import { resolveCategory } from "../../../_shared/taxonomy/cashflow.ts";
import {
  marginalRateFor,
  NON_RESIDENT_FLAT_RATE,
  progressiveTax,
  RELIEFS,
} from "./rates2026.ts";

export interface ReliefDetail {
  key: string;
  label: string;
  claimed: number;
  cap: number;
  headroom: number;
  /** where the final claimed value came from */
  source: "advisor" | "auto" | "detected" | "none";
}

export interface OptimizationOpportunity {
  key: string;
  label: string;
  additional_claimable: number;
  est_tax_saving: number;
}

export interface TaxDet {
  employment_income_est: number;
  reliefs_detail: ReliefDetail[];
  chargeable_income: number;
  tax_payable: number;
  marginal_rate: number;
  effective_rate: number | null;
  non_resident: boolean;
  optimization_opportunities: OptimizationOpportunity[];
  insufficient_data: boolean;
}

export interface TaxInputs {
  /** relief key → RM the advisor has entered as already claimed/committed */
  reliefs?: Record<string, number>;
}

const round = (n: number) => Math.round(n);

const OPPORTUNITY_KEYS = ["prs", "medical_insurance", "sspn", "lifestyle"];

type DetectableReliefKey =
  | "medical_insurance"
  | "medical_expenses"
  | "sspn"
  | "lifestyle"
  | "prs";

// Which cash-flow categories evidence which relief. Codes, not keywords: the
// category column is a foreign key into the taxonomy, so a guess is never
// needed. SSPN and PRS deposits are transfers, so the scan includes transfers.
const RELIEF_BY_CATEGORY: Readonly<Record<string, DetectableReliefKey>> = {
  medical_card: "medical_insurance",
  health_medical: "medical_expenses",
  sspn: "sspn",
  prs_contribution: "prs",
  fitness: "lifestyle",
  self_education: "lifestyle",
  telco: "lifestyle",
  subscriptions: "lifestyle",
};

/** Annual amounts per detectable relief, on the plan's own basis. Caller
 * still applies the relief cap; this only sums the matched amounts. */
export function detectReliefsFromCashflow(
  f: CfpData,
  basis: CashflowBasis | null = null,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const t of annualizeByCategory(f.cashflow, basis, { includeTransfers: true })) {
    const key = RELIEF_BY_CATEGORY[resolveCategory(t.category)?.code ?? ""];
    if (!key || t.annual_expenses <= 0) continue;
    totals[key] = (totals[key] ?? 0) + t.annual_expenses;
  }
  return totals;
}

export function computeTax(
  f: CfpData,
  b: FinancialBaseline,
  inputs: TaxInputs = {},
): TaxDet {
  const income = b.annual_income;
  const nonResident = !!f.client.tax_residency &&
    f.client.tax_residency !== "resident";
  const overrides = inputs.reliefs ?? {};
  const detected = detectReliefsFromCashflow(f, b.cashflow_basis);

  const reliefsDetail: ReliefDetail[] = RELIEFS.map((r) => {
    let auto = 0;
    if (r.auto === "always") {
      auto = r.cap;
    } else if (r.auto === "epf") {
      auto = f.client.employment_status === "employed"
        ? Math.min(r.cap, round(0.11 * income))
        : 0;
    } else if (r.auto === "life_premium") {
      auto = Math.min(r.cap, round(annualPremiumTotal(f.policies)));
    }

    const override = overrides[r.key];
    const detectedValue = detected[r.key];

    let claimed: number;
    let source: ReliefDetail["source"];
    if (override != null) {
      claimed = override;
      source = "advisor";
    } else if (detectedValue != null && detectedValue > 0) {
      claimed = detectedValue;
      source = "detected";
    } else if (auto > 0) {
      claimed = auto;
      source = "auto";
    } else {
      claimed = 0;
      source = "none";
    }
    claimed = Math.max(0, Math.min(r.cap, claimed));

    // Reliefs are generally unavailable to non-residents; keep the row for
    // transparency but zero the claim.
    if (nonResident) {
      claimed = 0;
      source = "none";
    }

    return {
      key: r.key,
      label: r.label_zh,
      claimed,
      cap: r.cap,
      headroom: Math.max(0, r.cap - claimed),
      source,
    };
  });

  const totalClaimed = reliefsDetail.reduce((s, r) => s + r.claimed, 0);
  const chargeableIncome = Math.max(0, round(income - totalClaimed));

  let taxPayable: number;
  let marginalRate: number;
  if (nonResident) {
    taxPayable = round(chargeableIncome * NON_RESIDENT_FLAT_RATE);
    marginalRate = NON_RESIDENT_FLAT_RATE;
  } else {
    taxPayable = round(progressiveTax(chargeableIncome));
    marginalRate = marginalRateFor(chargeableIncome);
  }

  const effectiveRate = chargeableIncome > 0
    ? Number((taxPayable / chargeableIncome).toFixed(4))
    : null;

  const optimizationOpportunities: OptimizationOpportunity[] =
    nonResident || marginalRate === 0
      ? []
      : reliefsDetail
        .filter((r) => OPPORTUNITY_KEYS.includes(r.key) && r.headroom > 0)
        .filter((r) => r.key !== "sspn" || b.dependents > 0)
        .map((r) => ({
          key: r.key,
          label: r.label,
          additional_claimable: r.headroom,
          est_tax_saving: round(r.headroom * marginalRate),
        }));

  return {
    employment_income_est: income,
    reliefs_detail: reliefsDetail,
    chargeable_income: chargeableIncome,
    tax_payable: taxPayable,
    marginal_rate: marginalRate,
    effective_rate: effectiveRate,
    non_resident: nonResident,
    optimization_opportunities: optimizationOpportunities,
    insufficient_data: income <= 0,
  };
}
