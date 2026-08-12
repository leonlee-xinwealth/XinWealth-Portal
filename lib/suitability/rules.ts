// Versioned rule constants for the Investor Suitability Assessment.
//
// VERSIONING CONTRACT: every scored assessment persists RULE_VERSION plus a deep
// clone of the resolved config (buildConfigSnapshot) into
// suitability_results.config_snapshot. Editing anything in this file therefore
// changes only FUTURE assessments — a PDF an advisor already sent can never
// retro-change. If you change a return range or an allocation band, BUMP
// RULE_VERSION so the two populations stay distinguishable in the data.
//
// Return figures are historical long-term reference RANGES. They are not
// guarantees, promises, or personalised forecasts, and must never be rendered as
// a single number. pdf/suitabilityReport/__tests__/model.test.ts enforces this.
import type {
  AllocationRanges,
  Band,
  CapacityLevel,
  ConfigSnapshot,
  ProfileKey,
  Range,
  RedFlagCode,
  Severity,
} from "./types";

export const RULE_VERSION = "1.0";

/** Numeric band <-> profile key. MIN() over bands is the core of the model. */
export const BAND_TO_PROFILE: Record<Band, ProfileKey> = {
  1: "STABLE",
  2: "BALANCED",
  3: "GROWTH",
  4: "AGGRESSIVE_GROWTH",
};

export const PROFILE_TO_BAND: Record<ProfileKey, Band> = {
  STABLE: 1,
  BALANCED: 2,
  GROWTH: 3,
  AGGRESSIVE_GROWTH: 4,
};

// ── dimension score -> band ────────────────────────────────────────────────
// Both capacity and tolerance are scored 0-9 and share these cut-points.
// questions.test.ts pins the questions' maxima at 9 so these stay reachable.
export function bandFromDimensionScore(score: number): Band {
  if (score <= 2) return 1;
  if (score <= 5) return 2;
  if (score <= 7) return 3;
  return 4;
}

export const CAPACITY_LEVEL_BY_BAND: Record<Band, CapacityLevel> = {
  1: "LOW",
  2: "MEDIUM",
  3: "HIGH",
  4: "VERY_HIGH",
};

// ── profile copy + historical reference return ranges ──────────────────────
// max: null = open-ended ("12%+"), which also means the profile imposes no
// ceiling for the expectation-gap comparison.
export interface ProfileRule {
  nameEn: string;
  nameZh: string;
  descriptionEn: string;
  descriptionZh: string;
  returnRange: Range;
  horizonEn: string;
  horizonZh: string;
}

export const PROFILE_RULES: Record<ProfileKey, ProfileRule> = {
  STABLE: {
    nameEn: "Stable Investor",
    nameZh: "稳健型投资者",
    descriptionEn:
      "You prioritise the security and availability of your capital over higher returns. You prefer that the value of your investments moves within a narrow range, and you are willing to accept more modest growth in exchange for that steadiness.",
    descriptionZh:
      "你更重视资金的安全性与灵活可用，而非追求较高回报。你希望投资价值的波动维持在较小的范围内，并愿意为这份稳定接受较为温和的增长。",
    returnRange: { min: 4, max: 6 },
    horizonEn: "1–3 years or more",
    horizonZh: "1–3年以上",
  },
  BALANCED: {
    nameEn: "Balanced Investor",
    nameZh: "平衡型投资者",
    descriptionEn:
      "You are willing to accept some short-term fluctuation in exchange for long-term growth, while still valuing the stability and flexibility of your capital. You look for a middle path between protecting what you have and growing it.",
    descriptionZh:
      "你愿意接受一定的短期波动，以换取长期财富增长，但同时仍然重视资金的稳定性与使用灵活性。你在守住既有财富与推动其增长之间寻求平衡。",
    returnRange: { min: 6, max: 10 },
    horizonEn: "3–5 years or more",
    horizonZh: "3–5年以上",
  },
  GROWTH: {
    nameEn: "Growth Investor",
    nameZh: "成长型投资者",
    descriptionEn:
      "Long-term capital growth is your main objective, and you accept that meaningful ups and downs along the way are the cost of pursuing it. You are comfortable staying invested through periods when your portfolio is worth less than you put in.",
    descriptionZh:
      "长期资本增值是你的主要目标，你也理解过程中出现明显的涨跌是追求增长必须承担的代价。当投资组合价值一度低于投入本金时，你仍能安心持有。",
    returnRange: { min: 8, max: 12 },
    horizonEn: "5–10 years or more",
    horizonZh: "5–10年以上",
  },
  AGGRESSIVE_GROWTH: {
    nameEn: "Aggressive Growth Investor",
    nameZh: "积极成长型投资者",
    descriptionEn:
      "You pursue the highest long-term growth available to you and accept large swings in value, including extended periods of substantial loss, as part of that pursuit. Your decisions are driven by long-horizon outcomes rather than year-to-year results.",
    descriptionZh:
      "你追求所能获得的最高长期增长，并接受价值的大幅波动，包括较长时间的显著亏损，视其为追求增长的一部分。你的决策着眼于长远结果，而非逐年的表现。",
    returnRange: { min: 12, max: null },
    horizonEn: "10 years or more",
    horizonZh: "10年以上",
  },
};

export const RETURN_LABEL_EN = "Indicative historical long-term return range";
export const RETURN_LABEL_ZH = "历史长期回报参考区间";

/** Formats a range for display. Open-ended renders as "12%+", never "12%". */
export function formatReturnRange(r: Range): string {
  return r.max === null ? `${r.min}%+ p.a.` : `${r.min}–${r.max}% p.a.`;
}

// ── strategic asset allocation ─────────────────────────────────────────────
export interface AllocationRule {
  defensive: Range;
  growth: Range;
  diversifier: Range;
}

export const ALLOCATION_RULES: Record<ProfileKey, AllocationRule> = {
  STABLE: {
    defensive: { min: 70, max: 90 },
    growth: { min: 0, max: 15 },
    diversifier: { min: 0, max: 15 },
  },
  BALANCED: {
    defensive: { min: 40, max: 60 },
    growth: { min: 30, max: 50 },
    diversifier: { min: 10, max: 20 },
  },
  GROWTH: {
    defensive: { min: 20, max: 35 },
    growth: { min: 50, max: 70 },
    diversifier: { min: 10, max: 20 },
  },
  AGGRESSIVE_GROWTH: {
    defensive: { min: 10, max: 20 },
    growth: { min: 65, max: 80 },
    diversifier: { min: 10, max: 20 },
  },
};

/**
 * Time-horizon equity ceiling, applied AFTER the profile is chosen. Keyed by the
 * horizon ceiling band, which is what Q02 produces:
 *   band 1 = under 3 years  -> growth capped at 10%
 *   band 2 = 3-5 years      -> growth capped at 40%
 *   bands 3-4 = 5 years+    -> no additional cap
 *
 * Only growth.max is clipped; defensive and diversifier are left alone. The cap
 * can only bind on STABLE (0-15 -> 0-10) and BALANCED (30-50 -> 30-40), because
 * a horizon ceiling of 1 or 2 forces the final band to 1 or 2. Both clipped
 * envelopes still admit a 100% allocation (e.g. 85/5/10 and 55/30/15), so no
 * redistribution is needed.
 */
export const EQUITY_CAP_BY_HORIZON_BAND: Record<Band, number | null> = {
  1: 10,
  2: 40,
  3: null,
  4: null,
};

export function applyEquityCap(profile: ProfileKey, horizonCeiling: Band): AllocationRanges {
  const base = ALLOCATION_RULES[profile];
  const cap = EQUITY_CAP_BY_HORIZON_BAND[horizonCeiling];
  const capApplied = cap !== null && base.growth.max !== null && cap < base.growth.max;
  return {
    defensive: { ...base.defensive },
    growth: {
      min: base.growth.min,
      max: capApplied ? cap : base.growth.max,
    },
    diversifier: { ...base.diversifier },
    equityCapPct: cap,
    capApplied,
  };
}

// ── expectation gap ────────────────────────────────────────────────────────
/** Target may exceed the profile's upper range by this much and still be MODERATE. */
export const MODERATE_GAP_TOLERANCE_PP = 2;

// ── red flags ──────────────────────────────────────────────────────────────
export interface RedFlagRule {
  code: RedFlagCode;
  severity: Severity;
  messageEn: string;
  messageZh: string;
}

export const RED_FLAG_RULES: Record<RedFlagCode, RedFlagRule> = {
  RF01: {
    code: "RF01",
    severity: "HIGH",
    messageEn:
      "Investment horizon is under 3 years but risk tolerance is high. The horizon may not support a volatile strategy.",
    messageZh: "投资期限不足3年，但风险承受意愿偏高。此期限可能不足以支撑高波动策略。",
  },
  RF02: {
    code: "RF02",
    severity: "HIGH",
    messageEn:
      "Financial capacity to absorb loss is low while risk tolerance is high. Willingness exceeds ability to bear risk.",
    messageZh: "承受亏损的财务能力偏低，但风险承受意愿偏高。主观意愿高于客观承受能力。",
  },
  RF03: {
    code: "RF03",
    severity: "MEDIUM",
    messageEn:
      "Return expectation is significantly above the historical range associated with this risk profile.",
    messageZh: "回报期望明显高于此风险概况所对应的历史回报区间。",
  },
  RF04: {
    code: "RF04",
    severity: "HIGH",
    messageEn:
      "More than 50% of investable assets would sit in a single growth-oriented strategy. Concentration risk is material.",
    messageZh: "超过 50% 的可投资资产将集中于单一成长型策略，集中度风险显著。",
  },
  RF05: {
    code: "RF05",
    severity: "MEDIUM",
    messageEn:
      "Limited investing experience combined with the most aggressive profile. Additional education is recommended before proceeding.",
    messageZh: "投资经验有限，却对应最积极的风险档位。建议在推进前补充相关认知与教育。",
  },
};

// ── advisor review trigger ─────────────────────────────────────────────────
/** Capacity and tolerance diverging by this many bands forces a human review. */
export const REVIEW_BAND_DIVERGENCE = 2;

// ── config snapshot ────────────────────────────────────────────────────────
/**
 * Deep-clones the resolved rules for one profile. MUST be a clone, never a
 * reference — a caller mutating the snapshot would otherwise poison these
 * module-level constants for the rest of a warm serverless container's life.
 */
export function buildConfigSnapshot(profile: ProfileKey, allocation: AllocationRanges): ConfigSnapshot {
  const p = PROFILE_RULES[profile];
  return {
    ruleVersion: RULE_VERSION,
    profile,
    profileNameEn: p.nameEn,
    profileNameZh: p.nameZh,
    descriptionEn: p.descriptionEn,
    descriptionZh: p.descriptionZh,
    returnRange: { min: p.returnRange.min, max: p.returnRange.max },
    returnLabelEn: RETURN_LABEL_EN,
    returnLabelZh: RETURN_LABEL_ZH,
    horizonEn: p.horizonEn,
    horizonZh: p.horizonZh,
    allocation: {
      defensive: { ...allocation.defensive },
      growth: { ...allocation.growth },
      diversifier: { ...allocation.diversifier },
      equityCapPct: allocation.equityCapPct,
      capApplied: allocation.capApplied,
    },
  };
}
