// Structural panels: the risk pyramid (P14), the SWOT board (P13) and the
// coverage gap bar (P15).

import React from "react";
import { Svg, Polygon, Line, Circle, View, Text } from "@react-pdf/renderer";
import { T, TYPE, SPACE, LEADING, RADIUS, STATUS } from "../theme";
import { FONT, WEIGHT } from "../fonts";

// --------------------------------------------------------------------------
// 风险金字塔 — P14. Protection is the base; nothing above it stands without it.
// --------------------------------------------------------------------------
export interface PyramidTier {
  label: string;
  caption: string;
}

export function RiskPyramid({ tiers, width = 260 }: { tiers: PyramidTier[]; width?: number }) {
  const n = tiers.length;
  const tierH = 46;
  const height = n * tierH;
  const halfTop = width * 0.12;
  const halfBottom = width * 0.5;
  const cx = width / 2;

  // Drawn top-down so the visual apex is tiers[0]; the base is the last tier,
  // which is the one the page is arguing for.
  const shades = [T.gold, "#6B8CA8", "#2E5C82", T.blue];

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Svg width={width} height={height}>
        {tiers.map((_, i) => {
          const t0 = i / n;
          const t1 = (i + 1) / n;
          const w0 = halfTop + (halfBottom - halfTop) * t0;
          const w1 = halfTop + (halfBottom - halfTop) * t1;
          const y0 = i * tierH;
          const y1 = (i + 1) * tierH - 2;
          return (
            <Polygon
              key={i}
              points={`${cx - w0},${y0} ${cx + w0},${y0} ${cx + w1},${y1} ${cx - w1},${y1}`}
              fill={shades[i % shades.length]}
            />
          );
        })}
      </Svg>

      <View style={{ flex: 1, marginLeft: SPACE.lg }}>
        {tiers.map((t, i) => (
          <View key={i} style={{ height: tierH, justifyContent: "center" }}>
            <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.h2 - 2, color: T.blue, lineHeight: LEADING.tight }}>
              {t.label}
            </Text>
            <Text style={{ fontFamily: FONT.body, fontSize: TYPE.caption, color: T.muted, lineHeight: LEADING.tight, marginTop: 2 }}>
              {t.caption}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// --------------------------------------------------------------------------
// SWOT — P13. Three panels, not four: the blueprint asks for 优势 / 警惕 / 优化空间,
// which is a diagnosis, not a strategy matrix.
// --------------------------------------------------------------------------
export interface SwotGroup {
  title: string;
  subtitle: string;
  tone: "good" | "warn" | "bad" | "gold";
  items: string[];
}

export function SwotBoard({ groups }: { groups: SwotGroup[] }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {groups.map((g, i) => {
        const accent =
          g.tone === "gold" ? T.gold : STATUS[g.tone].fill;
        const soft =
          g.tone === "gold" ? T.panel : STATUS[g.tone].softBg;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              marginRight: i < groups.length - 1 ? SPACE.md : 0,
              backgroundColor: soft,
              borderRadius: RADIUS.md,
              padding: SPACE.lg,
            }}
          >
            <View style={{ width: 26, height: 3, backgroundColor: accent, marginBottom: SPACE.sm }} />
            <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.h2 - 1, color: T.blue, lineHeight: LEADING.heading }}>
              {g.title}
            </Text>
            <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.muted, letterSpacing: 1, marginBottom: SPACE.sm }}>
              {g.subtitle}
            </Text>
            {g.items.map((item, k) => (
              <View key={k} style={{ flexDirection: "row", marginBottom: SPACE.sm }}>
                <View style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: accent, marginTop: 5, marginRight: SPACE.sm }} />
                <Text style={{ flex: 1, fontFamily: FONT.body, fontSize: TYPE.body, color: T.text, lineHeight: LEADING.body }}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// --------------------------------------------------------------------------
// 保障缺口条 — P15. Need is the track, cover is the fill, the remainder is the
// gap, spelled out in words underneath so it is never colour-alone.
// --------------------------------------------------------------------------
export interface GapBarProps {
  label: string;
  need: number | null;
  covered: number | null;
  gap: number | null;
  format: (v: number | null | undefined) => string;
  /** medical cover is a yes/no rather than an amount */
  flagOnly?: boolean;
  hasCover?: boolean;
}

export function CoverageGapBar({
  label, need, covered, gap, format, flagOnly, hasCover,
}: GapBarProps) {
  if (flagOnly) {
    const band = hasCover ? "good" : "bad";
    return (
      <View style={{ marginBottom: SPACE.md }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ flex: 1, fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.blue }}>
            {label}
          </Text>
          <View style={{ backgroundColor: STATUS[band].softBg, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 7 }}>
            <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.medium, fontSize: TYPE.micro, color: STATUS[band].fg }}>
              {hasCover ? "已投保" : "未投保"}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const needV = need ?? 0;
  const coveredV = covered ?? 0;
  const gapV = gap ?? Math.max(0, needV - coveredV);
  const pct = needV > 0 ? Math.min(1, coveredV / needV) : 0;
  const band = gapV <= 0 ? "good" : pct >= 0.5 ? "warn" : "bad";

  return (
    <View style={{ marginBottom: SPACE.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <Text style={{ flex: 1, fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.blue }}>
          {label}
        </Text>
        <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.faint }}>
          需求 {format(needV)}
        </Text>
      </View>

      <View style={{ height: 20, backgroundColor: T.panel, borderRadius: 2 }}>
        <View style={{ width: `${pct * 100}%`, height: 20, backgroundColor: STATUS.good.fill, borderRadius: 2 }} />
      </View>

      <View style={{ flexDirection: "row", marginTop: 4 }}>
        <Text style={{ flex: 1, fontFamily: FONT.body, fontSize: TYPE.caption, color: T.muted }}>
          已保 {format(coveredV)}（{(pct * 100).toFixed(0)}%）
        </Text>
        <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: STATUS[band].fg }}>
          {gapV > 0 ? `缺口 ${format(gapV)}` : "已达标"}
        </Text>
      </View>
    </View>
  );
}

// --------------------------------------------------------------------------
// 有遗嘱 vs 无遗嘱 — P17. Two parallel tracks read across, step for step.
//
// The blueprint calls for a flowchart. A node graph with auto-layout costs far
// more in react-pdf than it returns here, and the story is a sequence rather
// than a branching topology: two paths, same number of stops, wildly different
// experience. Reading them side by side is what makes the point.
// --------------------------------------------------------------------------
export interface Track {
  title: string;
  subtitle: string;
  tone: "good" | "bad";
  steps: Array<{ label: string; detail: string }>;
}

export function TrackCompare({ left, right }: { left: Track; right: Track }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {[left, right].map((t, ti) => {
        const accent = STATUS[t.tone].fill;
        return (
          <View
            key={ti}
            style={{
              flex: 1,
              marginRight: ti === 0 ? SPACE.md : 0,
              backgroundColor: STATUS[t.tone].softBg,
              borderRadius: RADIUS.md,
              padding: SPACE.lg,
            }}
          >
            <View style={{ width: 26, height: 3, backgroundColor: accent, marginBottom: SPACE.sm }} />
            <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.h2, color: T.blue, lineHeight: LEADING.heading }}>
              {t.title}
            </Text>
            <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.muted, letterSpacing: 1, marginBottom: SPACE.md }}>
              {t.subtitle}
            </Text>

            {t.steps.map((s, i) => (
              <View key={i} style={{ flexDirection: "row", marginBottom: SPACE.md }}>
                <View style={{ alignItems: "center", marginRight: SPACE.sm }}>
                  <View
                    style={{
                      width: 16, height: 16, borderRadius: 8, backgroundColor: accent,
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.micro - 0.5, color: T.white }}>
                      {i + 1}
                    </Text>
                  </View>
                  {i < t.steps.length - 1 && (
                    <View style={{ width: 1, flexGrow: 1, minHeight: 14, backgroundColor: accent, opacity: 0.4 }} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.blue, lineHeight: LEADING.tight }}>
                    {s.label}
                  </Text>
                  <Text style={{ fontFamily: FONT.body, fontSize: TYPE.caption, color: T.text, lineHeight: LEADING.tight, marginTop: 2 }}>
                    {s.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// --------------------------------------------------------------------------
// 风险光谱 — P20. Four bands, a marker on the one the client landed in.
//
// A four-axis radar was the obvious reach here, but suitability only has four
// INDEPENDENT dimensions and three of them feed the fourth — a radar of that
// would draw a diamond that implies precision the data does not have. A
// spectrum says the true thing: these are ordered bands, and the client sits in
// one of them because the lowest dimension capped it.
// --------------------------------------------------------------------------
export interface SpectrumBand {
  label: string;
  sub: string;
}

export function RiskSpectrum({
  bands, activeBand, width,
}: {
  bands: SpectrumBand[];
  /** 1-based; 0 renders the strip greyed with no marker */
  activeBand: number;
  width: number;
}) {
  const gap = 4;
  const cellW = (width - gap * (bands.length - 1)) / bands.length;
  const shades = ["#6B8CA8", "#2E5C82", "#173A5E", T.blue];

  return (
    <View style={{ width }}>
      <View style={{ flexDirection: "row" }}>
        {bands.map((b, i) => {
          const active = activeBand === i + 1;
          return (
            <View
              key={i}
              style={{
                width: cellW,
                marginRight: i < bands.length - 1 ? gap : 0,
                backgroundColor: activeBand === 0 ? T.panel : shades[i % shades.length],
                opacity: activeBand === 0 || active ? 1 : 0.35,
                paddingVertical: SPACE.md,
                paddingHorizontal: SPACE.sm,
                borderRadius: RADIUS.sm,
              }}
            >
              <Text
                style={{
                  fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption,
                  color: T.white, textAlign: "center", lineHeight: LEADING.tight,
                }}
              >
                {b.label}
              </Text>
              <Text
                style={{
                  fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.onDarkMute,
                  textAlign: "center", marginTop: 2, lineHeight: LEADING.tight,
                }}
              >
                {b.sub}
              </Text>
            </View>
          );
        })}
      </View>

      {/* marker sits under the active band, so the strip reads as a scale */}
      {activeBand > 0 && (
        <View style={{ flexDirection: "row", marginTop: 5 }}>
          {bands.map((_, i) => (
            <View key={i} style={{ width: cellW, marginRight: i < bands.length - 1 ? gap : 0, alignItems: "center" }}>
              {activeBand === i + 1 && (
                <>
                  <View style={{ width: 22, height: 3, backgroundColor: T.gold }} />
                  <Text
                    style={{
                      fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.micro,
                      color: T.goldDark, marginTop: 3, letterSpacing: 1,
                    }}
                  >
                    你在这里
                  </Text>
                </>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// --------------------------------------------------------------------------
// 目标时间轴 — P27. Goals on a single year axis, sized by cost.
// --------------------------------------------------------------------------
export interface TimelineGoal {
  name: string;
  year: number;
  cost: number;
  onTrack: boolean;
}

export function GoalTimeline({ goals, width }: { goals: TimelineGoal[]; width: number }) {
  if (goals.length === 0) return null;
  const years = goals.map((g) => g.year);
  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  const span = maxY - minY || 1;
  const maxCost = Math.max(...goals.map((g) => g.cost)) || 1;

  const AXIS_Y = 26;
  const LANE = 46;
  const height = AXIS_Y + goals.length * LANE;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Line x1={0} y1={AXIS_Y} x2={width} y2={AXIS_Y} stroke={T.hairline} strokeWidth={1} />
        {goals.map((g, i) => {
          const x = ((g.year - minY) / span) * (width - 24) + 12;
          const r = 4 + (g.cost / maxCost) * 7;
          const y = AXIS_Y + LANE * i + LANE / 2;
          const tone = g.onTrack ? STATUS.good.fill : STATUS.warn.fill;
          return (
            <React.Fragment key={i}>
              <Line x1={x} y1={AXIS_Y} x2={x} y2={y} stroke={tone} strokeWidth={0.75} strokeDasharray="2 2" />
              <Circle cx={x} cy={AXIS_Y} r={3.5} fill={tone} />
              <Circle cx={x} cy={y} r={r} fill={tone} fillOpacity={0.18} />
              <Circle cx={x} cy={y} r={3} fill={tone} />
            </React.Fragment>
          );
        })}
      </Svg>

      {/* year ticks and goal labels ride outside the Svg so they can ellipsis */}
      <View style={{ position: "absolute", top: 0, left: 0, width, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint }}>{minY}</Text>
        <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint }}>{maxY}</Text>
      </View>
      {goals.map((g, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: AXIS_Y + LANE * i + LANE / 2 - 12,
            left: 0, width,
            flexDirection: "row", alignItems: "center",
          }}
        >
          <Text
            style={{
              flex: 1, fontFamily: FONT.sans, fontWeight: WEIGHT.bold,
              fontSize: TYPE.caption, color: T.blue, marginLeft: 26,
            }}
          >
            {g.name}
          </Text>
          <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginRight: 6 }}>
            {g.year}
          </Text>
        </View>
      ))}
    </View>
  );
}

// --------------------------------------------------------------------------
// 储蓄进度桶 — P28. One bucket per goal, filled to what is on trajectory.
// --------------------------------------------------------------------------
export function SavingsBucket({
  label, fraction, caption, width = 78,
}: {
  label: string;
  /** 0..1 */
  fraction: number;
  caption: string;
  width?: number;
}) {
  const h = 78;
  const f = Math.max(0, Math.min(1, fraction));
  const fillH = h * f;
  const tone = f >= 1 ? STATUS.good.fill : f >= 0.5 ? STATUS.warn.fill : STATUS.bad.fill;

  return (
    <View style={{ width, alignItems: "center" }}>
      <View
        style={{
          width: width - 18, height: h, backgroundColor: T.panel,
          borderRadius: RADIUS.sm, justifyContent: "flex-end", overflow: "hidden",
        }}
      >
        <View style={{ height: fillH, backgroundColor: tone }} />
      </View>
      <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: TYPE.h2 - 2, color: T.blue, marginTop: 5 }}>
        {(f * 100).toFixed(0)}%
      </Text>
      <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.micro, color: T.blue, marginTop: 1, textAlign: "center" }}>
        {label}
      </Text>
      <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginTop: 1, textAlign: "center" }}>
        {caption}
      </Text>
    </View>
  );
}
