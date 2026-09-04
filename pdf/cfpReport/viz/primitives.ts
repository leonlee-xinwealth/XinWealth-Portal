// Pure geometry for the report's charts. No JSX, no react-pdf — so every one of
// these is unit-testable without rendering a document, which is where the real
// bugs live (off-by-one ticks, arcs that wrap the wrong way, axes that collapse
// when every value is identical).

export interface Point {
  x: number;
  y: number;
}

/** Polar to cartesian, 0° at 12 o'clock, clockwise. */
export function polar(cx: number, cy: number, r: number, deg: number): Point {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/**
 * SVG arc path from a0 to a1 degrees, drawn clockwise.
 * A full 360° arc is clamped to 359.9° — an arc whose endpoints coincide is a
 * no-op in SVG, which would silently erase a 100% ring.
 */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  let end = a1;
  if (end - a0 >= 359.9) end = a0 + 359.9;
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, a0);
  const large = end - a0 <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

/** Clamp a value into [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Rounds an axis maximum up to a readable number (1/2/2.5/5 × 10^n).
 * Guarantees a positive result so a chart of all-zeros still has a usable axis
 * instead of dividing by zero.
 */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/** Evenly spaced axis ticks from 0 to max inclusive. */
export function ticks(max: number, count = 4): number[] {
  const top = niceMax(max);
  return Array.from({ length: count + 1 }, (_, i) => (top / count) * i);
}

/** Compact money for axis labels: 2.7M / 850k / 400. */
export function compactMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trimZero(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trimZero(n / 1_000)}k`;
  return String(Math.round(n));
}

function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

export interface ScaleOptions {
  /** plot area in page units */
  width: number;
  height: number;
  xMin: number;
  xMax: number;
  yMax: number;
}

/** Maps data space to plot space. y is inverted: 0 sits on the baseline. */
export function makeScale(o: ScaleOptions) {
  // A degenerate domain (one data point, or every value zero) would divide by
  // zero and emit NaN into the path, which renders as nothing at all.
  const xSpan = o.xMax - o.xMin || 1;
  const yTop = o.yMax > 0 ? o.yMax : 1;
  return {
    x: (v: number) => ((v - o.xMin) / xSpan) * o.width,
    y: (v: number) => o.height - (clamp(v, 0, yTop) / yTop) * o.height,
    yTop,
  };
}

/** Builds an SVG polyline `points` attribute. */
export function polylinePoints(pts: Point[]): string {
  return pts.map((p) => `${round2(p.x)},${round2(p.y)}`).join(" ");
}

/** Closes a line down to the baseline so it can be filled as an area. */
export function areaPath(pts: Point[], baselineY: number): string {
  if (pts.length === 0) return "";
  const head = `M ${round2(pts[0].x)} ${round2(baselineY)}`;
  const line = pts.map((p) => `L ${round2(p.x)} ${round2(p.y)}`).join(" ");
  const tail = `L ${round2(pts[pts.length - 1].x)} ${round2(baselineY)} Z`;
  return `${head} ${line} ${tail}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
