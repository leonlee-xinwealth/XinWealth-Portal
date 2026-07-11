// Pure assembly of the insurance_planning section JSON. No LLM, no network.
// Identifying fields (provider, policy_number, dates) are filled here from DB
// rows AFTER the LLM call — they never enter prompts.

import type { CnaResult } from "./cna.ts";
import { annualPremiumTotal, type CfpFinancials } from "./mapping.ts";

export interface SectionNarrative {
  executive_summary: {
    findings: string;
    action_plan: string;
    expected_completion_date: string;
    remarks: string;
  };
  coverage_review: Array<{
    category: string;
    level: string;
    commentary: string;
  }>;
  gap_analysis: string;
  recommendations: Array<{ title: string; detail: string; priority: number }>;
  death_scenario_note: string;
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
}

export function buildSectionContent(
  f: CfpFinancials,
  cna: CnaResult,
  narrative: SectionNarrative,
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
    coverage_review: narrative.coverage_review,
    gap_analysis: narrative.gap_analysis,
    recommendations: narrative.recommendations,
    death_scenario_note: narrative.death_scenario_note,
  };
}
