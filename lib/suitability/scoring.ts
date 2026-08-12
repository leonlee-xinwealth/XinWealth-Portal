// The Investor Suitability scoring engine. Pure, dependency-free, deterministic.
//
// ┌─ THE MODEL ─────────────────────────────────────────────────────────────┐
// │  finalBand = MIN(capacity.band, tolerance.band, horizon.ceilingBand)     │
// │                                                                          │
// │  Time horizon is a CEILING, not a score. Risk capacity is what the       │
// │  client can financially afford to lose. Risk tolerance is what they are  │
// │  psychologically willing to lose. The binding constraint wins.           │
// └──────────────────────────────────────────────────────────────────────────┘
//
// ┌─ THE HARD RULE ─────────────────────────────────────────────────────────┐
// │  experience and behaviourConfidence are NEVER operands of finalBand.     │
// │  Q06-Q09 produce a confidence signal and advisor warnings only. A        │
// │  30-year veteran with a 2-year horizon is still STABLE. Do not add       │
// │  experience to the MIN(), and do not add an "upgrade if experienced"     │
// │  branch — that is the failure mode this whole design exists to prevent.  │
// └──────────────────────────────────────────────────────────────────────────┘
//
// Always run server-side. The client is never trusted to compute its own
// profile (precedent: api/prs-application.js re-scores the PRS ISA).
// Explicit .js extensions: this module is imported by api/suitability.ts, which
// Vercel transpiles (not bundles) into an ESM function where Node requires them.
import { QUESTION_BY_ID, QUESTION_IDS, optionOf } from "./questions.js";
import {
  BAND_TO_PROFILE,
  CAPACITY_LEVEL_BY_BAND,
  MODERATE_GAP_TOLERANCE_PP,
  PROFILE_RULES,
  RED_FLAG_RULES,
  REVIEW_BAND_DIVERGENCE,
  RULE_VERSION,
  applyEquityCap,
  bandFromDimensionScore,
  buildConfigSnapshot,
} from "./rules.js";
import type {
  Band,
  Confidence,
  ExpectationGap,
  ExperienceYearsBand,
  ProductLevel,
  QuestionId,
  RedFlag,
  SuitabilityAnswers,
  SuitabilityResult,
  ValidationResult,
} from "./types.js";

const PRODUCT_LEVEL_RANK: Record<ProductLevel, number> = {
  NONE: 0,
  BASIC: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};

/**
 * Validates a raw answers payload from the wire. Every question must be
 * answered; investment_products must be an array (possibly empty — "I have
 * held none of these" is a valid answer); every value must be a known option.
 */
export function validateAnswers(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, questionId: null, reason: "WRONG_SHAPE" };
  }
  const raw = input as Record<string, unknown>;
  const answers: SuitabilityAnswers = {};

  for (const id of QUESTION_IDS) {
    const q = QUESTION_BY_ID[id];
    const v = raw[id];

    if (q.control === "multi") {
      if (!Array.isArray(v)) return { ok: false, questionId: id, reason: "WRONG_SHAPE" };
      for (const item of v) {
        if (typeof item !== "string") return { ok: false, questionId: id, reason: "WRONG_SHAPE" };
        if (!optionOf(id, item)) return { ok: false, questionId: id, reason: "UNKNOWN_OPTION" };
      }
      // Dedupe so a repeated value cannot skew anything downstream.
      answers[id] = Array.from(new Set(v as string[]));
      continue;
    }

    if (typeof v !== "string" || v === "") {
      return { ok: false, questionId: id, reason: "MISSING" };
    }
    if (!optionOf(id, v)) return { ok: false, questionId: id, reason: "UNKNOWN_OPTION" };
    answers[id] = v;
  }

  return { ok: true, answers };
}

function single(answers: SuitabilityAnswers, id: QuestionId): string {
  const v = answers[id];
  if (typeof v !== "string") throw new Error(`Expected a single answer for ${id}`);
  return v;
}

function multi(answers: SuitabilityAnswers, id: QuestionId): string[] {
  const v = answers[id];
  if (!Array.isArray(v)) throw new Error(`Expected a multi answer for ${id}`);
  return v;
}

/** Sums the `points` of the answered options across a dimension's questions. */
function dimensionScore(answers: SuitabilityAnswers, ids: QuestionId[]): number {
  let total = 0;
  for (const id of ids) {
    const opt = optionOf(id, single(answers, id));
    if (!opt) throw new Error(`Unknown option for ${id}`);
    total += opt.points ?? 0;
  }
  return total;
}

const CAPACITY_QUESTIONS: QuestionId[] = [
  "liquidity_backup",
  "income_stability",
  "capital_concentration",
];

const TOLERANCE_QUESTIONS: QuestionId[] = [
  "loss_3_percent_reaction",
  "loss_10_percent_reaction",
  "loss_20_percent_reaction",
  "principal_preference",
];

/**
 * Scores a validated answer set. Assumes validateAnswers() has passed; throws
 * on an unknown question or option rather than silently scoring zero.
 */
export function scoreSuitability(answers: SuitabilityAnswers): SuitabilityResult {
  // ── time horizon: a ceiling, not a score ────────────────────────────────
  const horizonOpt = optionOf("investment_horizon", single(answers, "investment_horizon"));
  const ceilingBand = (horizonOpt?.meta?.horizonCeiling ?? 1) as Band;

  // ── risk capacity ───────────────────────────────────────────────────────
  const capacityScore = dimensionScore(answers, CAPACITY_QUESTIONS);
  const capacityBand = bandFromDimensionScore(capacityScore);

  // ── risk tolerance ──────────────────────────────────────────────────────
  const toleranceScore = dimensionScore(answers, TOLERANCE_QUESTIONS);
  const toleranceBand = bandFromDimensionScore(toleranceScore);

  // ── the MIN rule ────────────────────────────────────────────────────────
  const finalBand = Math.min(capacityBand, toleranceBand, ceilingBand) as Band;
  const profile = BAND_TO_PROFILE[finalBand];

  // ── experience & behaviour: confidence only, never an upgrade ───────────
  const expOpt = optionOf(
    "investment_experience_years",
    single(answers, "investment_experience_years"),
  );
  const yearsBand = (expOpt?.meta?.experienceYearsBand ?? 0) as ExperienceYearsBand;

  const productLevel = multi(answers, "investment_products").reduce<ProductLevel>((best, v) => {
    const lvl = optionOf("investment_products", v)?.meta?.productLevel;
    if (!lvl) return best;
    return PRODUCT_LEVEL_RANK[lvl] > PRODUCT_LEVEL_RANK[best] ? lvl : best;
  }, "NONE");

  const drawdownOver20 = Boolean(
    optionOf("market_drawdown_experience", single(answers, "market_drawdown_experience"))?.meta
      ?.drawdownOver20,
  );
  const panicSold = Boolean(
    optionOf("drawdown_reaction", single(answers, "drawdown_reaction"))?.meta?.panicSold,
  );

  let behaviourConfidence: Confidence = "MEDIUM";
  if (yearsBand === 0 && !drawdownOver20 && toleranceBand >= 3) {
    // Says they can stomach risk, but has never actually been tested by one.
    behaviourConfidence = "LOW";
  } else if (drawdownOver20 && !panicSold && yearsBand >= 3) {
    // Held through a >20% decline without selling, with 5+ years of experience.
    behaviourConfidence = "HIGH";
  }

  // ── expectation gap ─────────────────────────────────────────────────────
  const targetReturnPct =
    optionOf("return_expectation", single(answers, "return_expectation"))?.meta?.targetReturnPct ??
    null;
  const returnRange = PROFILE_RULES[profile].returnRange;

  let expectationGap: ExpectationGap = "ALIGNED";
  if (targetReturnPct !== null && returnRange.max !== null) {
    const excess = targetReturnPct - returnRange.max;
    if (excess > MODERATE_GAP_TOLERANCE_PP) expectationGap = "SIGNIFICANT_GAP";
    else if (excess > 0) expectationGap = "MODERATE_GAP";
  }

  // ── allocation ──────────────────────────────────────────────────────────
  const allocation = applyEquityCap(profile, ceilingBand);

  // ── red flags ───────────────────────────────────────────────────────────
  const concentrationOver50 = Boolean(
    optionOf("capital_concentration", single(answers, "capital_concentration"))?.meta
      ?.concentrationOver50,
  );

  const redFlags: RedFlag[] = [];
  const raise = (code: keyof typeof RED_FLAG_RULES) => redFlags.push({ ...RED_FLAG_RULES[code] });

  if (ceilingBand === 1 && toleranceBand >= 3) raise("RF01");
  if (capacityBand === 1 && toleranceBand >= 3) raise("RF02");
  if (expectationGap === "SIGNIFICANT_GAP") raise("RF03");
  if (concentrationOver50 && finalBand >= 3) raise("RF04");
  if (yearsBand <= 1 && finalBand === 4) raise("RF05");

  // ── advisor review ──────────────────────────────────────────────────────
  const requiresAdvisorReview =
    redFlags.some((f) => f.severity === "HIGH") ||
    expectationGap === "SIGNIFICANT_GAP" ||
    behaviourConfidence === "LOW" ||
    Math.abs(capacityBand - toleranceBand) >= REVIEW_BAND_DIVERGENCE;

  return {
    ruleVersion: RULE_VERSION,
    horizon: { ceilingBand },
    capacity: {
      score: capacityScore,
      level: CAPACITY_LEVEL_BY_BAND[capacityBand],
      band: capacityBand,
    },
    tolerance: { score: toleranceScore, band: toleranceBand },
    experience: { yearsBand, productLevel },
    behaviourConfidence,
    finalBand,
    profile,
    returnRange: { min: returnRange.min, max: returnRange.max },
    targetReturnPct,
    expectationGap,
    allocation,
    redFlags,
    requiresAdvisorReview,
    configSnapshot: buildConfigSnapshot(profile, allocation),
  };
}
