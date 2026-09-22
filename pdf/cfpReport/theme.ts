// CFP report design tokens.
//
// Extends pdf/insuranceReport/theme.ts rather than replacing it: the insurance
// PDF, the suitability PDF and the committed api/_lib/suitabilityPdf.mjs bundle
// all consume that file, so editing it would break them. Everything CFP-specific
// lives here.
//
// Direction (see docs/superpowers/direction-approved.md): XinWealth's brand
// navy/gold, wearing the layout grammar of the Canva template the user picked
// (docs/design-refs/canva-extract.md) — section-number block, layered table
// bands, running footer, navy back cover.

import { C as BASE, STATUS, type Band } from "../insuranceReport/theme";

export const T = {
  ...BASE,

  // --- paper -------------------------------------------------------------
  /** ivory ground; warmer than white without drifting into the AI-cream band */
  paper: "#FBF9F4",
  /** panels sitting on the ivory ground */
  panel: "#F1ECE0",
  /** the Canva template's neutral panel, for tables on white */
  panelCool: "#EDEDED",
  /** gold hairline rules */
  hairline: "#E4E0D6",

  // --- table bands (Canva template's grammar, recoloured to brand) -------
  /** full-width group header: navy bar, white bold text */
  bandGroup: BASE.blue,
  /** headline figure band: gold, navy text */
  bandHeadline: BASE.gold,
  /** subtotal row */
  bandSubtotal: "#EDEDED",
  /** grand total row: charcoal, white bold text */
  bandTotal: "#3D4650",

  // --- consequence / solution cards --------------------------------------
  // The blueprint is explicit that 后果 must occupy its own loud card rather
  // than being buried in prose. These are NOT in STATUS: STATUS encodes a
  // measured band (good/warn/bad) and must keep meaning exactly that.
  danger: { bg: "#5A1E1B", fg: "#FBEDEC", accent: "#B4443C" },
  solution: { bg: "#13402F", fg: "#E8F5EF", accent: "#2E7D57" },

  /** ink on dark grounds */
  onDark: "#FFFFFF",
  onDarkMute: "#8FA6BC",
} as const;

/**
 * Categorical ramp for composition charts (expense mix, asset allocation).
 * Deliberately separate from STATUS — if a category ever borrowed the red from
 * the status ramp, red would stop meaning "at risk" on the very next page.
 */
export const SERIES = [
  "#0A2540", "#173A5E", "#2E5C82", "#6B8CA8",
  "#C8A97E", "#E6D3B3", "#94A3B8",
] as const;

/** Fixed type scale. 28 pages cannot look like one document without this. */
/**
 * Type scale, tuned against the Canva reference rather than by eye. Measuring
 * how far down the page content reached put that template at 89% fill across
 * all ten pages while our first pass averaged 64% — the content was right, the
 * scale was small for A4. Roughly 1.3x across the board closes it.
 */
export const TYPE = {
  display: 42,
  h1: 28,
  h2: 15,
  kicker: 9,
  body: 10.5,
  caption: 9,
  micro: 7.5,
} as const;

/**
 * Line heights, pinned per role. Large CJK display text must never inherit the
 * page's body line-height: react-pdf measures a big <Text> inconsistently once
 * it sits inside nested flex containers, and the next element lands on top of
 * it. Setting this explicitly on every display-size string removes the whole
 * class of bug.
 */
export const LEADING = {
  display: 1.2,
  heading: 1.3,
  body: 1.5,
  tight: 1.15,
} as const;

/** Spacing steps. Vary rhythm by picking a step, never a stray number. */
export const SPACE = {
  xs: 4, sm: 7, md: 11, lg: 18, xl: 26, xxl: 38,
} as const;

export const RADIUS = { sm: 4, md: 8, lg: 12 } as const;

export const PAGE = {
  marginX: 46,
  marginTop: 44,
  marginBottom: 52,
  /** A4 at 72dpi, the unit react-pdf lays out in */
  width: 595.28,
  height: 841.89,
} as const;

export const CHART = {
  axis: "#CBD5E1",
  grid: "#EEF2F6",
  tick: TYPE.micro,
  stroke: 1.4,
} as const;

export { STATUS, type Band };
