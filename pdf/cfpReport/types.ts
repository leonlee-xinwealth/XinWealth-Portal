// Browser-side shape for the unified client CFP report export. `sections` and
// `baseline`/`content` stay loosely typed (`any`) because each of the 8
// cfp-brain modules (supabase/functions/cfp-brain/modules/*/section.ts) has
// its own narrative field names — the PDF renderer branches on
// `section_type` to pick the right fields, same discipline the edge function
// itself uses (see modules/registry.ts).

export interface CfpReportClient {
  date_of_birth?: string | null;
  marital_status?: string | null;
  number_of_dependants?: number | null;
  occupation?: string | null;
  employment_status?: string | null;
  retirement_age?: number | null;
}

export interface CfpReportSection {
  section_type: string;
  status: string;
  // deno-lint-ignore no-explicit-any
  content: any;
}

export interface CfpReportAsset {
  asset_type: string;
  name: string;
  current_value: number;
}

export interface CfpReportLiability {
  liability_type: string;
  name: string;
  outstanding_balance: number;
}

export type CfpReportLanguage = "en" | "zh";

export interface CfpReportData {
  clientName: string;
  advisorName: string;
  advisorEmail?: string;
  period: string;
  generatedDate: string;
  language: CfpReportLanguage;
  /** adds a small DRAFT tag on the cover when true */
  hasUnapproved: boolean;
  client: CfpReportClient;
  /** financial_reports.baseline jsonb — see FinancialBaseline in
   * supabase/functions/cfp-brain/types.ts */
  // deno-lint-ignore no-explicit-any
  baseline: any | null;
  /** generated sections only (content present) */
  sections: CfpReportSection[];
  assets: CfpReportAsset[];
  liabilities: CfpReportLiability[];
}
