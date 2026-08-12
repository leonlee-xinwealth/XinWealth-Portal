// Domain types for the Investor Suitability Assessment.
//
// HARD CONSTRAINT for every file in lib/suitability/: zero runtime dependencies,
// no `node:` imports, no browser globals. That is what lets these modules be
// imported by the public quiz, the advisor pages, the PDF renderer AND the
// serverless function — one source of truth for every bilingual label and every
// point value.

/** Profile band as a number so MIN() is expressible. 1 = most conservative. */
export type Band = 1 | 2 | 3 | 4;

export type ProfileKey = "STABLE" | "BALANCED" | "GROWTH" | "AGGRESSIVE_GROWTH";

export type CapacityLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

/** Highest product family the client has actually held. */
export type ProductLevel = "NONE" | "BASIC" | "INTERMEDIATE" | "ADVANCED";

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export type ExpectationGap = "ALIGNED" | "MODERATE_GAP" | "SIGNIFICANT_GAP";

export type RedFlagCode = "RF01" | "RF02" | "RF03" | "RF04" | "RF05";

export type Severity = "HIGH" | "MEDIUM";

export type QuestionId =
  | "investment_objective"
  | "investment_horizon"
  | "liquidity_backup"
  | "income_stability"
  | "capital_concentration"
  | "investment_experience_years"
  | "investment_products"
  | "market_drawdown_experience"
  | "drawdown_reaction"
  | "loss_3_percent_reaction"
  | "loss_10_percent_reaction"
  | "loss_20_percent_reaction"
  | "principal_preference"
  | "return_expectation"
  | "investment_preference";

/** Which score a question feeds. null = narrative context only, never scored. */
export type Dimension = "capacity" | "tolerance";

export type ExperienceYearsBand = 0 | 1 | 2 | 3 | 4;

/**
 * Per-option scoring metadata. Lives ON THE OPTION so a question's copy and its
 * point value cannot drift apart — there is deliberately no parallel scoring
 * table indexed by position.
 */
export interface OptionMeta {
  /** investment_horizon only — the ceiling this horizon imposes. */
  horizonCeiling?: Band;
  /** investment_experience_years only. */
  experienceYearsBand?: ExperienceYearsBand;
  /** investment_products only. */
  productLevel?: Exclude<ProductLevel, "NONE">;
  /** capital_concentration only — drives RF04. */
  concentrationOver50?: boolean;
  /** market_drawdown_experience only — did they live through a >20% drawdown. */
  drawdownOver20?: boolean;
  /** drawdown_reaction only. */
  panicSold?: boolean;
  /**
   * return_expectation only — the UPPER bound of the client's stated target
   * band, compared against the profile's return_max to size the gap.
   */
  targetReturnPct?: number;
}

export interface SuitabilityOption {
  /** Stable code persisted to the DB. NEVER renumber or reuse these. */
  value: string;
  en: string;
  zh: string;
  /** Points toward the question's dimension. Absent = unscored. */
  points?: number;
  meta?: OptionMeta;
}

export interface SuitabilityQuestion {
  id: QuestionId;
  /** 1..15, the order the client sees them in. */
  order: number;
  dimension: Dimension | null;
  control: "single" | "multi";
  titleEn: string;
  titleZh: string;
  helpEn?: string;
  helpZh?: string;
  options: SuitabilityOption[];
}

/** Single-select answers are a string; investment_products is a string[]. */
export type SuitabilityAnswers = Record<string, string | string[]>;

/** `max: null` means open-ended, e.g. "12%+". */
export interface Range {
  min: number;
  max: number | null;
}

export interface RedFlag {
  code: RedFlagCode;
  severity: Severity;
  messageEn: string;
  messageZh: string;
}

export interface AllocationRanges {
  defensive: Range;
  growth: Range;
  diversifier: Range;
  /** Time-horizon equity ceiling; null when 5yr+ imposes no additional cap. */
  equityCapPct: number | null;
  /** True when the cap actually clipped growth.max below the profile default. */
  capApplied: boolean;
}

/**
 * Frozen at scoring time and persisted to suitability_results.config_snapshot,
 * so editing rules.ts later can never retro-change a report already sent.
 */
export interface ConfigSnapshot {
  ruleVersion: string;
  profile: ProfileKey;
  profileNameEn: string;
  profileNameZh: string;
  descriptionEn: string;
  descriptionZh: string;
  returnRange: Range;
  returnLabelEn: string;
  returnLabelZh: string;
  horizonEn: string;
  horizonZh: string;
  allocation: AllocationRanges;
}

export interface SuitabilityResult {
  ruleVersion: string;
  horizon: { ceilingBand: Band };
  capacity: { score: number; level: CapacityLevel; band: Band };
  tolerance: { score: number; band: Band };
  experience: { yearsBand: ExperienceYearsBand; productLevel: ProductLevel };
  behaviourConfidence: Confidence;
  finalBand: Band;
  profile: ProfileKey;
  returnRange: Range;
  targetReturnPct: number | null;
  expectationGap: ExpectationGap;
  allocation: AllocationRanges;
  redFlags: RedFlag[];
  requiresAdvisorReview: boolean;
  configSnapshot: ConfigSnapshot;
}

export type ValidationResult =
  | { ok: true; answers: SuitabilityAnswers }
  | {
      ok: false;
      questionId: string | null;
      reason: "MISSING" | "UNKNOWN_OPTION" | "WRONG_SHAPE";
    };
