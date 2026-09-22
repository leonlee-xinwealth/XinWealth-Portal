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
  /** joint reports only — which spouse the row belongs to */
  owner?: string;
}

export interface CfpReportLiability {
  liability_type: string;
  name: string;
  outstanding_balance: number;
  /** joint reports only — which spouse the row belongs to */
  owner?: string;
}

export type CfpReportLanguage = "en" | "zh";

/**
 * A submitted suitability assessment belonging to THIS client.
 *
 * The assessment is also issued standalone to prospects; those rows carry
 * `client_id = null` and must never reach a named client's plan — the query in
 * CfpTab filters on client_id, and this field stays null when nothing matches.
 * Figures come from the row's frozen `config_snapshot`, not from live rules, so
 * a printed report always reflects the ruleset in force when it was taken.
 */
export interface CfpSuitability {
  finalProfile: string;
  finalBand: number;
  capacityBand: number;
  toleranceBand: number;
  horizonCeilingBand: number;
  productLevel: string | null;
  expectationGap: string | null;
  targetReturnPct: number | null;
  // deno-lint-ignore no-explicit-any
  redFlags: any[];
  requiresAdvisorReview: boolean;
  /** frozen ruleset: band return ranges and allocation ranges */
  // deno-lint-ignore no-explicit-any
  configSnapshot: any;
  submittedAt: string | null;
}

export interface CfpReportData {
  clientName: string;
  /** set on a joint household plan — the report covers both spouses */
  partnerName?: string;
  advisorName: string;
  advisorEmail?: string;
  period: string;
  generatedDate: string;
  language: CfpReportLanguage;
  /** adds a small DRAFT tag on the cover when true */
  hasUnapproved: boolean;
  client: CfpReportClient;
  /** joint reports only — the spouse's profile, shown beside the client's */
  partner?: CfpReportClient;
  /** financial_reports.baseline jsonb — see FinancialBaseline in
   * supabase/functions/cfp-brain/types.ts */
  // deno-lint-ignore no-explicit-any
  baseline: any | null;
  /** generated sections only (content present) */
  sections: CfpReportSection[];
  assets: CfpReportAsset[];
  liabilities: CfpReportLiability[];
  /** null when the client has never submitted an assessment — the common case */
  suitability?: CfpSuitability | null;
  /**
   * Brand artwork for the cover and back cover.
   *
   * react-pdf's <Image src> takes either a URL (browser) or a { data, format }
   * buffer (Node), and the two environments cannot share one value — the
   * browser has no `fs` and a Node render has no dev server to fetch from. The
   * caller supplies whichever its environment can load; the pages just pass it
   * through, which keeps them free of any environment branch.
   */
  brand?: {
    // deno-lint-ignore no-explicit-any
    logo?: any;
    /** white-wordmark variant, for the navy back cover */
    // deno-lint-ignore no-explicit-any
    logoReversed?: any;
  };
}
