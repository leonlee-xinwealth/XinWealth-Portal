// P6 现金流概览 — where the money comes in, what it passes through, what is left.
//
// The blueprint asks for a Sankey. A Sankey needs bezier ribbons and a crossing-
// order solver; in an A4 column with Chinese labels it comes out illegible and
// costs far more to build than it returns. A waterfall tells the same story —
// inflow, each outflow stepping the balance down, the remainder — and reads
// correctly in print at this size.

import React from "react";
import { Svg, Rect, Line, View, Text } from "@react-pdf/renderer";
import { T, TYPE, SPACE, LEADING, CHART, STATUS } from "../theme";
import { FONT, WEIGHT } from "../fonts";
import { niceMax, clamp } from "./primitives";

export interface WaterfallStep {
  label: string;
  /** positive = inflow, negative = outflow */
  delta: number;
  /** renders as a resting total rather than a step */
  isTotal?: boolean;
}

export interface WaterfallProps {
  steps: WaterfallStep[];
  width: number;
  height: number;
  format: (v: number) => string;
}

const PAD = { top: 14, bottom: 34, left: 4, right: 4 };

export function Waterfall({ steps, width, height, format }: WaterfallProps) {
  if (steps.length === 0) return null;

  // Walk the steps to find each bar's [from, to] on the value axis.
  let running = 0;
  const bars = steps.map((s) => {
    if (s.isTotal) return { ...s, from: 0, to: running };
    const from = running;
    running += s.delta;
    return { ...s, from, to: running };
  });

  const peak = niceMax(Math.max(...bars.flatMap((b) => [Math.abs(b.from), Math.abs(b.to)])));
  const plotH = height - PAD.top - PAD.bottom;
  const plotW = width - PAD.left - PAD.right;
  const gap = 10;
  const barW = Math.max(12, (plotW - gap * (bars.length - 1)) / bars.length);
  const y = (v: number) => PAD.top + plotH - (clamp(v, 0, peak) / peak) * plotH;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {/* baseline */}
        <Line x1={PAD.left} y1={PAD.top + plotH} x2={width - PAD.right} y2={PAD.top + plotH} stroke={CHART.axis} strokeWidth={1} />

        {bars.map((b, i) => {
          const x = PAD.left + i * (barW + gap);
          const top = Math.min(y(b.from), y(b.to));
          const h = Math.max(1.5, Math.abs(y(b.from) - y(b.to)));
          const fill = b.isTotal
            ? T.gold
            : b.delta >= 0
              ? T.blue
              : STATUS.warn.fill;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={top} width={barW} height={h} fill={fill} />
              {/* dashed connector to the next bar's starting level */}
              {i < bars.length - 1 && !bars[i + 1].isTotal && (
                <Line
                  x1={x} y1={y(b.to)} x2={x + barW + gap} y2={y(b.to)}
                  stroke={T.hairline} strokeWidth={0.75} strokeDasharray="2 2"
                />
              )}
            </React.Fragment>
          );
        })}
      </Svg>

      {/* labels ride in react-pdf text so long Chinese categories can wrap */}
      <View style={{ flexDirection: "row", marginTop: -PAD.bottom + 4, paddingHorizontal: PAD.left }}>
        {bars.map((b, i) => (
          <View key={i} style={{ width: barW, marginRight: i < bars.length - 1 ? gap : 0, alignItems: "center" }}>
            <Text
              style={{
                fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: TYPE.micro,
                color: b.isTotal ? T.goldDark : T.blue, lineHeight: LEADING.tight,
              }}
            >
              {format(Math.abs(b.isTotal ? b.to : b.delta))}
            </Text>
            <Text
              style={{
                fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint,
                marginTop: 1, textAlign: "center", lineHeight: LEADING.tight,
              }}
            >
              {b.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
