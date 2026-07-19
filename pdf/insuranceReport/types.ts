// Browser-side mirror of the stored CFP insurance section shape. These duplicate
// the Deno edge-function types (supabase/functions/insurance-brain/*) because the
// two run in different module systems and cannot share imports.

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

export interface CnaGap {
  key: "life" | "ci" | "medical";
  label: string;
  need?: number;
  covered?: number;
  gap?: number;
  flag_only?: boolean;
  has_cover?: boolean;
}

export interface CnaResult {
  assumptions: string[];
  inputs: {
    annual_income: number;
    liabilities_total: number | null;
    liquid_assets: number | null;
    life_cover: number;
    ci_cover: number;
    has_medical: boolean;
    dependents: number;
  };
  needs: {
    income_replacement: number;
    liabilities: number;
    education: number;
    total_life: number;
    ci: number;
  };
  resources: { life_cover: number; ci_cover: number; liquid_assets: number };
  gaps: CnaGap[];
  insufficient: boolean;
}

/** The layman "simplified" copy produced by the insurance-brain cfp_client_view
 * pass. Optional on content — may be absent if never generated. */
export interface ClientView {
  version: 1;
  language: "en" | "zh";
  data_gathering_intro: string;
  finding_intro: string;
  gap_analysis_plain: string;
  coverage_review_plain: Array<{ category: string; plain: string }>;
  scenarios_plain: Array<{ title: string; plain: string }>;
  recommendation_intro: string;
  recommendations_plain: Array<{ title: string; plain: string }>;
  glossary: Array<{ term: string; plain: string }>;
  disclaimer: string;
}

export interface InsuranceSectionContent {
  version: 1;
  section_type: "insurance_planning";
  agent: "insurance_brain";
  executive_summary: {
    findings: string;
    action_plan: string;
    expected_completion_date: string;
    remarks: string;
  };
  coverage_review: Array<{ category: string; level: string; commentary: string }>;
  gap_analysis: string;
  recommendations: Array<{ title: string; detail: string; priority: number }>;
  scenarios: Array<{
    title: string;
    trigger: string;
    life_impact: string;
    protection_response: string;
  }>;
  policy_overview: PolicyOverviewRow[];
  annual_premium_total: number;
  cna: CnaResult;
  client_view?: ClientView;
}

export type Language = "en" | "zh";

export interface ReportMeta {
  clientName: string;
  advisorName: string;
  period: string;
  generatedDate: string;
  language: Language;
}
