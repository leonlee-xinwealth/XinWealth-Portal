// P3 asset valuation history — annualised value change and time-weighted
// return (TWR). spec 2026-09-26-cfp-p3-assets-portfolio-design.md 决策 2, 4;
// framework spec 2026-09-22 §4 (D6 2×2).
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS FILE MUST HAVE ZERO IMPORTS (the same contract as ../cashflow/periods.ts,
// ../taxonomy/*.ts and ./loans.ts — see loans.ts's header for why: Deno edge
// functions, the Vite browser bundle, plain Node scripts and esbuild's
// api/_lib/taxonomy.mjs bundle all resolve modules differently, and a file
// with zero imports is the only shape every runtime agrees on).
// ─────────────────────────────────────────────────────────────────────────────

/** One row of `asset_valuations` (already scoped to a single asset by the
 *  caller — this file knows nothing about which asset a row belongs to). */
export interface Valuation {
  /** 'YYYY-MM-DD' */
  valuation_date: string;
  value: number;
  /** Net contribution (deposits − withdrawals) recorded for the period
   *  ending at this valuation — used to separate "the asset grew in value"
   *  from "the client put more money in". */
  net_contribution?: number | null;
}

export type ValueChangeSource = "history" | "default_depreciation" | "none";

export interface ValueChangeResult {
  annual_change: number | null;
  source: ValueChangeSource;
  /** present only when source === 'history' */
  from_date?: string;
  to_date?: string;
  days?: number;
}

export interface TwrResult {
  /** chain-linked cumulative return over the whole span, e.g. 0.0842 = 8.42%. */
  twr: number;
  /** annualised to a 365-day year; null when the span is 0 days. */
  annualised: number | null;
  from: string;
  to: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_SPAN_DAYS = 60;
const TARGET_SPAN_DAYS = 365;
/** Self-use vehicles depreciate at a flat −10%/year when there's no valuation
 *  history to measure the actual change (spec §6 参数默认值). */
const VEHICLE_DEFAULT_DEPRECIATION_PCT = -0.10;
const VEHICLE_ASSET_TYPE = "vehicle";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round5(n: number): number {
  return Math.round((n + Number.EPSILON) * 100000) / 100000;
}

/**
 * 'YYYY-MM-DD' read as UTC midnight, matching cashflow/items.ts's monthStart
 * convention — a plain `new Date("2026-04-01")` prints as 2026-03-31 in any
 * timezone west of Greenwich, so the digits are parsed directly instead.
 */
function toUtcMs(dateStr: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr ?? "");
  if (!m) {
    const d = new Date(dateStr);
    return d.getTime();
  }
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function asOfMs(asOf: string | Date): number {
  if (typeof asOf === "string") return toUtcMs(asOf);
  return Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
}

type Dated = Valuation & { _ts: number };

function sortedDated(valuations: readonly Valuation[] | null | undefined): Dated[] {
  return (valuations ?? [])
    .filter((v): v is Valuation => !!v && !!v.valuation_date && Number.isFinite(v.value))
    .map((v) => ({ ...v, _ts: toUtcMs(v.valuation_date) }))
    .sort((a, b) => a._ts - b._ts);
}

/**
 * Annualised value change (决策 3 / framework §4):
 *   1. Latest valuation ≤ asOf.
 *   2. The valuation closest to 365 days before that latest one (among those
 *      strictly earlier than it).
 *   3. If the span between the two is under 60 days, there isn't enough
 *      history to annualise sensibly — treated the same as no history at all.
 *   4. change = (latest.value − earlier.value − Σ net_contribution of every
 *      valuation after `earlier` up to and including `latest`), annualised
 *      by the 365/days ratio.
 *
 * No usable history: a `vehicle` gets the flat default depreciation
 * (−10%/year of currentValue); every other asset type gets `null` with
 * source 'none' — the caller (assetQuality.ts) decides how to treat that for
 * display and quadrant classification.
 */
export function valueChangeAnnual(
  valuations: readonly Valuation[] | null | undefined,
  asOf: Date | string,
  opts: { assetType?: string | null; currentValue: number },
): ValueChangeResult {
  const currentValue = Number(opts.currentValue) || 0;

  const none = (): ValueChangeResult => {
    if (opts.assetType === VEHICLE_ASSET_TYPE) {
      return {
        annual_change: round2(VEHICLE_DEFAULT_DEPRECIATION_PCT * currentValue),
        source: "default_depreciation",
      };
    }
    return { annual_change: null, source: "none" };
  };

  const asOfTs = asOfMs(asOf);
  const list = sortedDated(valuations).filter((v) => v._ts <= asOfTs);
  if (list.length === 0) return none();

  const latest = list[list.length - 1];
  const earlierCandidates = list.filter((v) => v._ts < latest._ts);
  if (earlierCandidates.length === 0) return none();

  const targetTs = latest._ts - TARGET_SPAN_DAYS * MS_PER_DAY;
  let earlier = earlierCandidates[0];
  let bestDiff = Math.abs(earlier._ts - targetTs);
  for (const c of earlierCandidates.slice(1)) {
    const diff = Math.abs(c._ts - targetTs);
    // ties broken toward the later (closer-to-latest) candidate, so a
    // string of equally-spaced valuations picks a deterministic winner.
    if (diff < bestDiff || (diff === bestDiff && c._ts > earlier._ts)) {
      earlier = c;
      bestDiff = diff;
    }
  }

  const days = Math.round((latest._ts - earlier._ts) / MS_PER_DAY);
  if (days < MIN_SPAN_DAYS) return none();

  const contributions = list
    .filter((v) => v._ts > earlier._ts && v._ts <= latest._ts)
    .reduce((s, v) => s + (Number(v.net_contribution) || 0), 0);

  const rawChange = latest.value - earlier.value - contributions;
  const annual_change = round2(rawChange * (TARGET_SPAN_DAYS / days));

  return {
    annual_change,
    source: "history",
    from_date: earlier.valuation_date,
    to_date: latest.valuation_date,
    days,
  };
}

/**
 * Time-weighted return: chain-linked sub-period returns
 * r_t = (V_t − C_t) / V_{t-1} − 1, where C_t is the net_contribution
 * recorded on the t-th valuation (the contribution that happened during that
 * sub-period). Periods where V_{t-1} = 0 are skipped (nothing to divide by —
 * the asset effectively started from zero that period, which TWR can't
 * express as a return). Needs at least 2 valuations and at least one usable
 * period; otherwise null.
 */
export function twr(valuations: readonly Valuation[] | null | undefined): TwrResult | null {
  const list = sortedDated(valuations);
  if (list.length < 2) return null;

  let chain = 1;
  let any = false;
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const cur = list[i];
    if (prev.value === 0) continue;
    const c = Number(cur.net_contribution) || 0;
    const r = (cur.value - c) / prev.value - 1;
    chain *= 1 + r;
    any = true;
  }
  if (!any) return null;

  const from = list[0].valuation_date;
  const to = list[list.length - 1].valuation_date;
  const totalDays = (list[list.length - 1]._ts - list[0]._ts) / MS_PER_DAY;
  const twrValue = chain - 1;
  const annualised = totalDays > 0 ? Math.pow(chain, TARGET_SPAN_DAYS / totalDays) - 1 : null;

  return {
    twr: round5(twrValue),
    annualised: annualised != null ? round5(annualised) : null,
    from,
    to,
  };
}
