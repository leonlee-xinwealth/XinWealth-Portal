// Pure assembly of the insurance_planning section JSON. No LLM, no network.
// Identifying fields (provider, policy_number, dates) are filled here from DB
// rows AFTER the LLM call — they never enter prompts.

import type { CnaResult } from "../../../_shared/insurance/cna.ts";
import { annualPremiumTotal, type CfpFinancials } from "../../../_shared/insurance/mapping.ts";
import type { ConsequenceCard, NarrativeCard, Severity } from "../../narrativeBlocks.ts";

export interface SectionNarrative {
  executive_summary: {
    findings: string;
    action_plan: string;
    expected_completion_date: string;
    remarks: string;
    /** status dot on the report's executive-summary page; absent on sections
     *  generated before the slot existed, which render without a dot */
    severity?: Severity;
  };
  coverage_review: Array<{
    category: string;
    level: string;
    commentary: string;
  }>;
  gap_analysis: string;
  recommendations: Array<{ title: string; detail: string; priority: number }>;
  // Real-life "what if" scenarios grounded in the client's actual assets,
  // liabilities and family — trigger event → concrete life impact → how
  // adequate protection resolves it (citing CNA figures).
  scenarios: Array<{
    title: string;
    trigger: string;
    life_impact: string;
    protection_response: string;
  }>;
  /** joint reports only — one entry per spouse */
  household_review?: Array<{ role: "primary" | "partner"; commentary: string }>;
  /** P15 保障缺口分析 — the model names which gap leads; the PDF prints its
   *  figure from the CNA, so no amount is ever model-generated. */
  consequences?: ConsequenceCard;
  /** P16 保障方案建议 */
  solution?: NarrativeCard;
}

/** Joint reports only: each spouse's own CNA, paired with the narrative's
 * commentary for that person. The primary's CNA is also kept at the top level
 * as `cna` so every existing consumer keeps working. */
export interface PersonCnaBlock {
  role: "primary" | "partner";
  cna: CnaResult;
  annual_premium_total: number;
  commentary?: string;
}

export interface PolicyOverviewRow {
  provider: string | null;
  policy_number: string | null;
  policy_type: string;
  sum_assured: number | null;
  cash_value: number | null;
  premium: number | null;
  premium_frequency: string | null;
  annual_premium: number;
  start_date: string | null;
  end_date: string | null;
}

export interface InsuranceSectionContent extends SectionNarrative {
  version: 1;
  section_type: "insurance_planning";
  agent: "insurance_brain";
  policy_overview: PolicyOverviewRow[];
  annual_premium_total: number;
  cna: CnaResult;
  /** joint reports only */
  per_person?: PersonCnaBlock[];
}

export function buildSectionContent(
  f: CfpFinancials,
  cna: CnaResult,
  narrative: SectionNarrative,
  perPerson?: Array<{
    role: "primary" | "partner";
    cna: CnaResult;
    annual_premium_total: number;
  }>,
): InsuranceSectionContent {
  return {
    version: 1,
    section_type: "insurance_planning",
    agent: "insurance_brain",
    executive_summary: narrative.executive_summary,
    policy_overview: f.policies.map((p) => ({
      provider: p.provider ?? null,
      policy_number: p.policy_number ?? null,
      policy_type: p.policy_type,
      sum_assured: p.sum_assured ?? null,
      cash_value: p.cash_value ?? null,
      premium: p.premium ?? null,
      premium_frequency: p.premium_frequency ?? null,
      annual_premium: annualPremiumTotal([p]),
      start_date: p.start_date ?? null,
      end_date: p.end_date ?? null,
    })),
    annual_premium_total: annualPremiumTotal(f.policies),
    cna,
    ...(perPerson
      ? {
        per_person: perPerson.map((p) => ({
          ...p,
          commentary: narrative.household_review
            ?.find((h) => h.role === p.role)?.commentary,
        })),
      }
      : {}),
    coverage_review: narrative.coverage_review,
    gap_analysis: narrative.gap_analysis,
    recommendations: narrative.recommendations,
    scenarios: narrative.scenarios,
  };
}
