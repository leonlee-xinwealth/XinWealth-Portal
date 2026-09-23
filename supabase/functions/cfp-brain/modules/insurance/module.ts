// 保险佬 (insurance_brain) as a CFP module. The 2026-07-16 iteration wires the
// shared baseline into the proven CNA:
//   * liquid assets deducted from the life need are AFTER the emergency-fund
//     reservation (no more double-counting the same ringgit)
//   * education need comes from real client_goals when present
//   * premium figures flow to the synthesis budget reconciliation
// Prompt/assemble/clientView logic is the battle-tested insurance-brain code,
// moved here unchanged.

import type {
  CfpData,
  CfpModule,
  FinancialBaseline,
  PersonSlice,
} from "../../types.ts";
import { computeCna, type CnaResult } from "../../../_shared/insurance/cna.ts";
import {
  annualPremiumTotal,
  buildCfpCnaInput,
  type CfpFinancials,
} from "../../../_shared/insurance/mapping.ts";
import { buildSectionPrompt, SECTION_RESPONSE_SCHEMA } from "./section.ts";
import { BUDGET_LINE, sectionBudgetContext } from "../../budgetContext.ts";
import {
  buildSectionContent,
  type InsuranceSectionContent,
  type SectionNarrative,
} from "./assemble.ts";
import { generateClientView } from "./clientView.ts";
import { annualizeCashflow } from "../../../_shared/cashflow/periods.ts";

// Rule-of-thumb annual term rates (RM per RM1,000 sum assured) used ONLY to
// rank the protection top-up inside the synthesis budget — never quoted as a
// real premium. Actual pricing always comes from product quotes.
const LIFE_RATE_PER_1000 = 3;
const CI_RATE_PER_1000 = 8;

export interface PersonCna {
  role: "primary" | "partner";
  cna: CnaResult;
  annual_premium_total: number;
  premium_topup_estimate: number;
}

export interface InsuranceDet {
  /** the primary client's CNA — unchanged shape for every existing consumer */
  cna: CnaResult;
  /** household totals on a joint report, the client's own otherwise */
  annual_premium_total: number;
  /** budget-ranking estimate for synthesis; assumption-flagged, not a quote */
  premium_topup_estimate: number;
  /** joint reports only: one CNA per spouse (protection need is per life) */
  per_person?: PersonCna[];
}

/** CfpData → the legacy CfpFinancials view the shared insurance code expects. */
export function toCfpFinancials(f: CfpData): CfpFinancials {
  return {
    client: {
      id: f.client.id,
      // Deliberately not f.client.date_of_birth. The only consumer downstream
      // wanted an age, which the baseline already computes; see the `age`
      // parameter on buildSectionPrompt.
      date_of_birth: null,
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
      // P5 决策 1: `id` is what a policy's `covers_liability_id` matches
      // against to net an MRTA/MLTA-covered mortgage balance out of the
      // death/TPD need (_shared/insurance/mapping.ts's buildCoverageDetail).
      // Not identifying — a liability row id, never client PII.
      id: l.id ?? null,
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

/** One spouse's view for a joint CNA: their OWN income and policies (the sum
 * assured that pays out on their life), against the HOUSEHOLD's liabilities and
 * dependants (the survivor still owes the mortgage and still raises the same
 * children). Liquid assets and the education need arrive via the baseline
 * overrides, which are already household-wide. */
function personFinancials(f: CfpData, slice: PersonSlice): CfpFinancials {
  return {
    ...toCfpFinancials(f),
    inflows: slice.cashflow
      .filter((r) => r.direction === "inflow")
      .map((r) => ({
        amount: r.amount,
        frequency: r.frequency,
        category: r.category ?? "",
      })),
    policies: slice.policies,
  };
}

function topupEstimate(cna: CnaResult): number {
  const lifeGap = cna.gaps.find((g) => g.key === "life")?.gap ?? 0;
  const ciGap = cna.gaps.find((g) => g.key === "ci")?.gap ?? 0;
  return Math.round(
    (lifeGap / 1000) * LIFE_RATE_PER_1000 + (ciGap / 1000) * CI_RATE_PER_1000,
  );
}

function compute(f: CfpData, b: FinancialBaseline): InsuranceDet {
  const overrides = {
    liquid_assets: b.liquid_assets_after_emergency,
    ...(b.goal_education_need != null
      ? { education_need: b.goal_education_need }
      : {}),
  };

  /**
   * The CNA must not re-derive income from the raw rows.
   *
   * A cashflow row is ONE MONTH'S actual amount, so summing every row × its
   * frequency reports a client who earned RM 6,000 in June and RM 4,000 in July
   * as making RM 120,000 a year. Income replacement and the CI need are
   * multiples of this figure, so the loudest page in the report would rest on a
   * different income from every other page.
   *
   * Passed per CNA rather than once, because protection need is per LIFE: on a
   * joint plan each spouse is measured against their OWN income, on the SAME
   * basis the advisor chose for the plan.
   */
  const cnaFor = (fin: CfpFinancials, annualIncome: number) =>
    computeCna(buildCfpCnaInput(fin, { ...overrides, annual_income: annualIncome }));

  if (!f.household) {
    const cna = cnaFor(toCfpFinancials(f), b.annual_income);
    return {
      cna,
      annual_premium_total: Math.round(annualPremiumTotal(f.policies)),
      premium_topup_estimate: topupEstimate(cna),
    };
  }

  // Joint report: protection need is per life, so each spouse gets their own
  // CNA. The household totals still feed synthesis's budget waterfall.
  const per_person: PersonCna[] = [f.household.primary, f.household.partner]
    .map((slice) => {
      // That spouse's own months, annualised on the household's basis.
      const ownIncome = annualizeCashflow(slice.cashflow, b.cashflow_basis)
        .annual_income;
      const cna = cnaFor(personFinancials(f, slice), ownIncome);
      return {
        role: slice.role,
        cna,
        annual_premium_total: Math.round(annualPremiumTotal(slice.policies)),
        premium_topup_estimate: topupEstimate(cna),
      };
    });

  return {
    cna: per_person[0].cna,
    annual_premium_total: per_person.reduce(
      (s, p) => s + p.annual_premium_total,
      0,
    ),
    premium_topup_estimate: per_person.reduce(
      (s, p) => s + p.premium_topup_estimate,
      0,
    ),
    per_person,
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
  buildPrompt: (det, b, f) => ({
    prompt: buildSectionPrompt(
      det.cna,
      toCfpFinancials(f),
      sectionBudgetContext(b, BUDGET_LINE.insurance_planning),
      det.per_person
        ? { per_person: det.per_person.map((p) => ({ role: p.role, cna: p.cna })) }
        : null,
      b.age,
    ),
    schema: SECTION_RESPONSE_SCHEMA,
  }),
  assemble: (det, narrative, f) =>
    buildSectionContent(
      toCfpFinancials(f),
      det.cna,
      narrative,
      det.per_person?.map((p) => ({
        role: p.role,
        cna: p.cna,
        annual_premium_total: p.annual_premium_total,
      })),
    ),
  // Chat whitelist: CNA + narrative prose only. policy_overview (provider,
  // policy numbers) must NEVER enter a prompt.
  chatContext: (content) => ({
    cna: content.cna,
    per_person: content.per_person?.map((p) => ({
      role: p.role,
      cna: p.cna,
      commentary: p.commentary,
    })),
    annual_premium_total: content.annual_premium_total,
    executive_summary: content.executive_summary,
    coverage_review: content.coverage_review,
    gap_analysis: content.gap_analysis,
    recommendations: content.recommendations,
    scenarios: content.scenarios,
  }),
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
