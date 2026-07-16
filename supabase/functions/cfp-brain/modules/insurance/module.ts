// 保险佬 (insurance_brain) as a CFP module. The 2026-07-16 iteration wires the
// shared baseline into the proven CNA:
//   * liquid assets deducted from the life need are AFTER the emergency-fund
//     reservation (no more double-counting the same ringgit)
//   * education need comes from real client_goals when present
//   * premium figures flow to the synthesis budget reconciliation
// Prompt/assemble/clientView logic is the battle-tested insurance-brain code,
// moved here unchanged.

import type { CfpData, CfpModule, FinancialBaseline } from "../../types.ts";
import { computeCna, type CnaResult } from "../../../_shared/insurance/cna.ts";
import {
  annualPremiumTotal,
  buildCfpCnaInput,
  type CfpFinancials,
} from "../../../_shared/insurance/mapping.ts";
import { buildSectionPrompt, SECTION_RESPONSE_SCHEMA } from "./section.ts";
import {
  buildSectionContent,
  type InsuranceSectionContent,
  type SectionNarrative,
} from "./assemble.ts";
import { generateClientView } from "./clientView.ts";

// Rule-of-thumb annual term rates (RM per RM1,000 sum assured) used ONLY to
// rank the protection top-up inside the synthesis budget — never quoted as a
// real premium. Actual pricing always comes from product quotes.
const LIFE_RATE_PER_1000 = 3;
const CI_RATE_PER_1000 = 8;

export interface InsuranceDet {
  cna: CnaResult;
  annual_premium_total: number;
  /** budget-ranking estimate for synthesis; assumption-flagged, not a quote */
  premium_topup_estimate: number;
}

/** CfpData → the legacy CfpFinancials view the shared insurance code expects. */
export function toCfpFinancials(f: CfpData): CfpFinancials {
  return {
    client: {
      id: f.client.id,
      date_of_birth: f.client.date_of_birth,
      number_of_dependants: f.client.number_of_dependants,
      occupation: f.client.occupation,
      retirement_age: f.client.retirement_age,
      marital_status: f.client.marital_status,
    },
    inflows: f.cashflow
      .filter((r) => r.direction === "inflow")
      .map((r) => ({
        amount: r.amount,
        frequency: r.frequency,
        category: r.category ?? "",
      })),
    liabilities: f.liabilities.map((l) => ({
      liability_type: l.liability_type,
      name: "",
      outstanding_balance: l.outstanding_balance,
      monthly_payment: l.monthly_payment,
    })),
    assets: f.assets.map((a) => ({
      asset_type: a.asset_type,
      current_value: a.current_value,
    })),
    policies: f.policies,
  };
}

function compute(f: CfpData, b: FinancialBaseline): InsuranceDet {
  const fin = toCfpFinancials(f);
  const cna = computeCna(buildCfpCnaInput(fin, {
    liquid_assets: b.liquid_assets_after_emergency,
    ...(b.goal_education_need != null
      ? { education_need: b.goal_education_need }
      : {}),
  }));
  const lifeGap = cna.gaps.find((g) => g.key === "life")?.gap ?? 0;
  const ciGap = cna.gaps.find((g) => g.key === "ci")?.gap ?? 0;
  return {
    cna,
    annual_premium_total: Math.round(annualPremiumTotal(f.policies)),
    premium_topup_estimate: Math.round(
      (lifeGap / 1000) * LIFE_RATE_PER_1000 + (ciGap / 1000) * CI_RATE_PER_1000,
    ),
  };
}

export const insuranceModule: CfpModule<
  InsuranceDet,
  SectionNarrative,
  InsuranceSectionContent
> = {
  section_type: "insurance_planning",
  agent: "insurance_brain",
  compute: (f, b) => compute(f, b),
  updateBaseline: (b, det) => ({
    ...b,
    annual_premium_current: det.annual_premium_total,
  }),
  buildPrompt: (det, _b, f) => ({
    prompt: buildSectionPrompt(det.cna, toCfpFinancials(f)),
    schema: SECTION_RESPONSE_SCHEMA,
  }),
  assemble: (det, narrative, f) =>
    buildSectionContent(toCfpFinancials(f), det.cna, narrative),
  // Insurance keeps its richer legacy client view — the PDF exporter and the
  // portal UI both consume this exact shape.
  generateClientView: (content, language, apiKey) => {
    const narrative: SectionNarrative = {
      executive_summary: content.executive_summary,
      coverage_review: content.coverage_review ?? [],
      gap_analysis: content.gap_analysis ?? "",
      recommendations: content.recommendations ?? [],
      scenarios: content.scenarios ?? [],
    };
    return generateClientView(narrative, content.cna, language, apiKey);
  },
};
