// Chart & icon primitives for the unified CFP client PDF — pure
// @react-pdf/renderer Svg/View/Text, zero new deps. Mirrors the mark specs
// used by pdf/insuranceReport/charts.tsx (track = lighter step of the same
// ramp, flat fills, status always pairs colour with an icon/word) but adds
// the report-level building blocks this redesign needs: a section icon set
// keyed by `section_type`, a score donut, comparison bars, coverage bars, a
// 4-stage track, a verdict pill and a phase timeline. Text is ALWAYS in ink
// colours (navy/slate/muted) — colour is only ever used for the drawn mark.
import React from "react";
import { Svg, Path, Circle, Line, Polyline, View, Text } from "@react-pdf/renderer";
import { C, STATUS, type Band } from "../insuranceReport/theme";

type FmtRM = (n: number | null | undefined) => string;
type Lang = "en" | "zh";

// ---------------------------------------------------------------- section icons
// One consistent outline style (stroke 1.6, round caps, 24x24 viewBox),
// keyed by CfpSectionType. Replaces every emoji in the report (NotoSansSC has
// no emoji glyphs — emoji rendered as tofu/garbage before this change).
export type SectionIconType =
  | "cashflow_planning" | "goals_planning" | "insurance_planning" | "investment_planning"
  | "retirement_planning" | "tax_planning" | "legacy_planning" | "financial_health";

export function SectionIcon({
  type, size = 16, color = C.blue,
}: { type: string; size?: number; color?: string }) {
  const common = { stroke: color, strokeWidth: 1.6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type as SectionIconType) {
    case "cashflow_planning":
      return (
        <Svg viewBox="0 0 24 24" width={size} height={size}>
          <Path d="M12 2 C12 2 5 11 5 15.5 A7 7 0 0 0 19 15.5 C19 11 12 2 12 2 Z" {...common} />
        </Svg>
      );
    case "goals_planning":
      return (
        <Svg viewBox="0 0 24 24" width={size} height={size}>
          <Circle cx={12} cy={12} r={8} {...common} />
          <Circle cx={12} cy={12} r={4} {...common} />
          <Circle cx={12} cy={12} r={1.4} fill={color} stroke="none" />
        </Svg>
      );
    case "insurance_planning":
      return (
        <Svg viewBox="0 0 24 24" width={size} height={size}>
          <Path d="M12 3 L19 6 V11 C19 15.5 16 19 12 21 C8 19 5 15.5 5 11 V6 Z" {...common} />
        </Svg>
      );
    case "investment_planning":
      return (
        <Svg viewBox="0 0 24 24" width={size} height={size}>
          <Polyline points="3,17 9,11 13,15 21,6" {...common} />
          <Polyline points="15,6 21,6 21,12" {...common} />
        </Svg>
      );
    case "retirement_planning":
      return (
        <Svg viewBox="0 0 24 24" width={size} height={size}>
          <Line x1={3} y1={17} x2={21} y2={17} {...common} />
          <Path d="M7 17 A5 5 0 0 1 17 17" {...common} />
          <Path d="M12 4 L12 6.5 M5.5 10 L7.3 11.2 M18.5 10 L16.7 11.2" {...common} />
        </Svg>
      );
    case "tax_planning":
      return (
        <Svg viewBox="0 0 24 24" width={size} height={size}>
          <Path d="M6 2 H18 V20 L16 18 L14 20 L12 18 L10 20 L8 18 L6 20 Z" {...common} />
          <Line x1={9} y1={7} x2={15} y2={7} {...common} />
          <Line x1={9} y1={11} x2={15} y2={11} {...common} />
        </Svg>
      );
    case "legacy_planning":
      return (
        <Svg viewBox="0 0 24 24" width={size} height={size}>
          <Path d="M4 9 L12 3 L20 9 Z" {...common} />
          <Path d="M6 9 V19 M10 9 V19 M14 9 V19 M18 9 V19" {...common} />
          <Line x1={4} y1={21} x2={20} y2={21} {...common} />
        </Svg>
      );
    case "financial_health":
      return (
        <Svg viewBox="0 0 24 24" width={size} height={size}>
          <Path d="M12 20 C12 20 4 14.5 4 9 C4 6.5 6 5 8 5 C9.6 5 11 6 12 7.6 C13 6 14.4 5 16 5 C18 5 20 6.5 20 9 C20 14.5 12 20 12 20 Z" {...common} />
          <Polyline points="2,13 7,13 9,8 12,17 14,13 22,13" {...common} />
        </Svg>
      );
    default:
      return (
        <Svg viewBox="0 0 24 24" width={size} height={size}>
          <Circle cx={12} cy={12} r={8} {...common} />
        </Svg>
      );
  }
}

// ---------------------------------------------------------------- arc helpers
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
export function bandForScore(score: number): Band {
  return score >= 70 ? "good" : score >= 40 ? "warn" : "bad";
}

// ---------------------------------------------------------------- score gauge
/** Donut arc from -90deg (12 o'clock). Big score centred in ink navy, /100
 * small, label under. `score` null renders a dash on a muted ring. */
export function ScoreGauge({
  score, size = 86, label,
}: { score: number | null; size?: number; label?: string }) {
  const thickness = Math.max(6, size * 0.11);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;

  if (score == null) {
    return (
      <View style={{ alignItems: "center" }}>
        <View style={{ width: size, height: size, position: "relative" }}>
          <Svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
            <Circle cx={cx} cy={cy} r={r} stroke={C.line} strokeWidth={thickness} fill="none" />
          </Svg>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: size * 0.26, color: C.faint }}>—</Text>
          </View>
        </View>
        {!!label && <Text style={{ fontSize: 8, color: C.muted, marginTop: 5, textAlign: "center" }}>{label}</Text>}
      </View>
    );
  }

  const clamped = Math.max(0, Math.min(100, score));
  const band = bandForScore(clamped);
  const st = STATUS[band];
  const end = Math.min(clamped * 3.6, 359.9);
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size, position: "relative" }}>
        <Svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <Circle cx={cx} cy={cy} r={r} stroke={C.line} strokeWidth={thickness} fill="none" />
          {clamped > 0 && (
            <Path d={arcPath(cx, cy, r, 0, end)} stroke={st.fill} strokeWidth={thickness} fill="none" strokeLinecap="round" />
          )}
        </Svg>
        {/* Two independently absolute-positioned lines (each own top/left/
            right, no shared flex container) rather than flex-stacking two
            Text children inside one centered absolute View — the flex
            version measures 0-height for the second line and overlaps the
            first specifically when this gauge sits inside a wrap={false}
            block deep in a long document (reproduced only in the full
            report, not in isolation — a Yoga layout quirk under react-pdf's
            two-pass "does this atomic block fit" measurement). Absolute
            positioning sidesteps flex measurement entirely. */}
        <Text style={{ position: "absolute", top: size * 0.30, left: 0, right: 0, textAlign: "center", fontSize: size * 0.27, color: C.blue }}>
          {Math.round(clamped)}
        </Text>
        <Text style={{ position: "absolute", top: size * 0.60, left: 0, right: 0, textAlign: "center", fontSize: size * 0.09, color: C.muted }}>
          /100
        </Text>
      </View>
      {!!label && <Text style={{ fontSize: 8, color: C.muted, marginTop: 5, textAlign: "center" }}>{label}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------- HBar
/** One labelled bar row. Bars sharing the same `max` are visually comparable.
 * Label column is fixed-width + ellipsis-guarded so long category names never
 * collide with the bar (bug #3: narrow widths + long content overflow). */
export function HBar({
  label, value, max, valueLabel, highlight, color, labelWidth = 110,
}: {
  label: string; value: number; max: number; valueLabel: string;
  highlight?: boolean; color?: string; labelWidth?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill = color ?? (highlight ? C.gold : C.blue);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }} wrap={false}>
      <Text
        style={{ width: labelWidth, fontSize: 8, color: C.text, paddingRight: 6, maxLines: 1, textOverflow: "ellipsis" }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 6, backgroundColor: C.line, borderRadius: 3, marginRight: 6, overflow: "hidden" }}>
        {pct > 0 && <View style={{ width: `${pct}%`, height: 6, backgroundColor: fill, borderRadius: 2 }} />}
      </View>
      <Text style={{ width: 70, fontSize: 8, color: C.text, textAlign: "right", maxLines: 1, textOverflow: "ellipsis" }}>
        {valueLabel}
      </Text>
    </View>
  );
}

// ----------------------------------------------------------------- coverage bar
const COVERAGE_TXT: Record<Lang, { need: string; covered: string; gap: string; sufficient: string }> = {
  zh: { need: "需求", covered: "已覆盖", gap: "缺口", sufficient: "✓ 已足够" },
  en: { need: "Need", covered: "Covered", gap: "Gap", sufficient: "✓ Sufficient" },
};

/** Need = full track (muted); covered = green fill from left; the remaining
 * gap is implied by the uncovered track and spelled out in the caption. */
export function CoverageBar({
  label, need, covered, gap, fmtRM, lang = "zh",
}: {
  label: string; need: number; covered: number; gap: number; fmtRM: FmtRM; lang?: Lang;
}) {
  const pct = need > 0 ? Math.max(0, Math.min(100, (covered / need) * 100)) : 0;
  const hasGap = gap > 0;
  const t = COVERAGE_TXT[lang];
  return (
    <View style={{ marginBottom: 10 }} wrap={false}>
      <Text style={{ fontSize: 9, color: C.blue, marginBottom: 3 }}>{label}</Text>
      <View style={{ height: 8, backgroundColor: C.line, borderRadius: 4, overflow: "hidden" }}>
        {pct > 0 && <View style={{ width: `${pct}%`, height: 8, backgroundColor: STATUS.good.fill, borderRadius: 4 }} />}
      </View>
      <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 3 }}>
        {t.need} {fmtRM(need)} · {t.covered} {fmtRM(covered)} ·{" "}
        {hasGap
          ? <Text style={{ color: STATUS.bad.fg }}>{t.gap} {fmtRM(gap)}</Text>
          : <Text style={{ color: STATUS.good.fg }}>{t.sufficient}</Text>}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------------ paired bar
/** Two HBar rows sharing max(a,b) — e.g. assets vs liabilities, income vs
 * expenses. `a` renders navy, `b` renders the warn-amber tone. */
export function PairedBar({
  aLabel, aValue, bLabel, bValue, fmtRM, labelWidth,
}: {
  aLabel: string; aValue: number; bLabel: string; bValue: number; fmtRM: FmtRM; labelWidth?: number;
}) {
  const max = Math.max(aValue, bValue, 1);
  return (
    <View style={{ marginTop: 2, marginBottom: 8 }}>
      <HBar label={aLabel} value={aValue} max={max} valueLabel={fmtRM(aValue)} color={C.blue} labelWidth={labelWidth} />
      <HBar label={bLabel} value={bValue} max={max} valueLabel={fmtRM(bValue)} color={STATUS.warn.fill} labelWidth={labelWidth} />
    </View>
  );
}

// ----------------------------------------------------------------- stage track
/** 4 equal segments, gold-filled up to the current stage, muted after. */
export function StageTrack({
  stage, labels,
}: { stage: number | null; labels: [string, string, string, string] }) {
  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        {labels.map((_, i) => {
          const filled = stage != null && i < stage;
          return (
            <View
              key={i}
              style={{
                flex: 1, height: 8, marginRight: i < labels.length - 1 ? 2 : 0,
                borderRadius: 2, backgroundColor: filled ? C.gold : C.line,
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: "row", marginTop: 3 }}>
        {labels.map((lb, i) => {
          const isCurrent = stage != null && i === stage - 1;
          return (
            <Text
              key={i}
              style={{
                flex: 1, fontSize: 7,
                textAlign: i === 0 ? "left" : i === labels.length - 1 ? "right" : "center",
                color: isCurrent ? C.blue : C.faint,
              }}
            >
              {lb}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

// ----------------------------------------------------------------- verdict chip
/** Status is never colour-alone: a small drawn check/exclamation glyph ships
 * WITH the word, both ink-coloured (dark green / dark red). */
export function VerdictChip({
  ok, textOk, textBad,
}: { ok: boolean; textOk: string; textBad: string }) {
  const st = ok ? STATUS.good : STATUS.bad;
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
        backgroundColor: st.softBg, borderRadius: 7, paddingVertical: 2, paddingHorizontal: 6,
      }}
    >
      <Svg viewBox="0 0 24 24" width={8} height={8} style={{ marginRight: 3 }}>
        {ok ? (
          <Polyline points="4,13 9,18 20,5" stroke={st.fg} strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <Line x1={12} y1={3.5} x2={12} y2={14.5} stroke={st.fg} strokeWidth={3.4} strokeLinecap="round" />
            <Circle cx={12} cy={19.5} r={1.8} fill={st.fg} stroke="none" />
          </>
        )}
      </Svg>
      <Text style={{ fontSize: 8, color: st.fg }}>{ok ? textOk : textBad}</Text>
    </View>
  );
}

// --------------------------------------------------------------- phase timeline
export interface TimelinePhase {
  title: string;
  allocatedLabel: string;
  deferredLabel?: string;
}

/** Vertical phase list: numbered circle (gold ring on phase 1) + connector,
 * title in ink, allocated amount in a strong gold-ish tone, deferred note in
 * warn ink when present. Last phase has no connector line. */
export function PhaseTimeline({ phases }: { phases: TimelinePhase[] }) {
  return (
    <View>
      {phases.map((p, i) => {
        const isLast = i === phases.length - 1;
        const isFirst = i === 0;
        return (
          <View key={i} style={{ flexDirection: "row" }} wrap={false}>
            <View style={{ width: 24, alignItems: "center" }}>
              {/* Phase 1's gold "ring" is two solid concentric circles, not
                  borderWidth on the centered badge — borderWidth combined
                  with alignItems/justifyContent:center on a single-Text-child
                  View loses the child under react-pdf's Yoga layout when
                  nested inside a wrap={false} block deep in a long document
                  (same class of bug as ScoreGauge's overlay; confirmed by
                  rendering the actual report — the "1" digit vanished while
                  plain circles with borderWidth:0, like phase 2+, were fine). */}
              {isFirst ? (
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 8.5, color: C.gold }}>{i + 1}</Text>
                  </View>
                </View>
              ) : (
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 8.5, color: C.gold }}>{i + 1}</Text>
                </View>
              )}
              {!isLast && <View style={{ width: 1, flexGrow: 1, minHeight: 20, backgroundColor: C.line, marginTop: 2 }} />}
            </View>
            <View style={{ flex: 1, paddingLeft: 10, paddingBottom: isLast ? 2 : 14 }}>
              <Text style={{ fontSize: 10, color: C.blue, marginBottom: 2 }}>{p.title}</Text>
              <Text style={{ fontSize: 9.5, color: C.goldDark }}>{p.allocatedLabel}</Text>
              {!!p.deferredLabel && (
                <Text style={{ fontSize: 8, color: STATUS.warn.fg, marginTop: 2 }}>{p.deferredLabel}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// -------------------------------------------------------------------- stat block
/** Hero number block for a row of 三大数字 — big value, small muted label. */
export function StatBlock({
  label, value, tone = "ink",
}: { label: string; value: string; tone?: "good" | "bad" | "warn" | "ink" }) {
  const color =
    tone === "good" ? STATUS.good.fg :
    tone === "bad" ? STATUS.bad.fg :
    tone === "warn" ? STATUS.warn.fg : C.blue;
  return (
    // NOTE: no flex:1 here — this View already sits inside a flex:1 column
    // wrapper (see StatRow in CfpReportPdf.tsx). Nesting flex:1 inside
    // flex:1 with a single child collapses the second Text's height in
    // react-pdf's Yoga layout (confirmed by isolated repro), causing the
    // label to disappear behind the value instead of stacking below it.
    <View>
      <Text style={{ fontSize: 17, color }}>{value}</Text>
      <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}
