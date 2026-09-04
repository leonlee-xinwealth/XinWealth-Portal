// P23 资金耗尽推演 / P24 现状 vs 优化 — the report's visual centrepiece.
//
// The blueprint is explicit that this chart must be big and unmissable: a curve
// falling to zero with the depletion age called out. It plots one or two series
// on a shared axis so 现状 and 优化后 can be read against each other.
//
// Axis labels are Svg <Text> (short, fixed strings like "74岁" — no wrapping
// needed). The depletion callout is a react-pdf <View> positioned over the Svg,
// because it holds two lines of mixed-size text.

import React from "react";
import {
  Svg, Polyline, Path, Line, Circle, Text as SvgText, View, Text,
  Defs, LinearGradient, Stop,
} from "@react-pdf/renderer";
import { T, TYPE, CHART, STATUS } from "../theme";
import { FONT, WEIGHT } from "../fonts";
import {
  makeScale, polylinePoints, areaPath, ticks, compactMoney, niceMax, type Point,
} from "./primitives";

export interface CurvePoint {
  age: number;
  closing: number;
}

export interface CurveSeries {
  points: CurvePoint[];
  color: string;
  label: string;
  /** fill the area under the curve — only ever on one series, or they muddy */
  fill?: boolean;
  dashed?: boolean;
}

export interface LineChartProps {
  series: CurveSeries[];
  width: number;
  height: number;
  /** draws a dashed drop-line and a callout at this age */
  markAge?: number | null;
  markLabelZh?: string;
  markLabelEn?: string;
}

const PAD = { left: 34, right: 12, top: 10, bottom: 20 };

export function DepletionLineChart({
  series, width, height, markAge, markLabelZh, markLabelEn,
}: LineChartProps) {
  const live = series.filter((s) => s.points.length > 0);
  if (live.length === 0) return null;

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const allAges = live.flatMap((s) => s.points.map((p) => p.age));
  const xMin = Math.min(...allAges);
  const xMax = Math.max(...allAges);
  const yMax = niceMax(Math.max(...live.flatMap((s) => s.points.map((p) => p.closing))));
  const sc = makeScale({ width: plotW, height: plotH, xMin, xMax, yMax });

  const toPts = (s: CurveSeries): Point[] =>
    s.points.map((p) => ({ x: sc.x(p.age), y: sc.y(p.closing) }));

  const yTicks = ticks(yMax, 4);
  // Label roughly every 5 years so the axis does not turn into a smear.
  const xStep = Math.max(1, Math.round((xMax - xMin) / 6));
  const xTicks: number[] = [];
  for (let a = xMin; a <= xMax; a += xStep) xTicks.push(a);
  if (xTicks[xTicks.length - 1] !== xMax) xTicks.push(xMax);

  const markX = markAge != null ? PAD.left + sc.x(markAge) : null;

  return (
    <View style={{ width, height, position: "relative" }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="runoutFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={T.blue} stopOpacity={0.16} />
            <Stop offset="1" stopColor={T.blue} stopOpacity={0.01} />
          </LinearGradient>
        </Defs>

        {/* horizontal grid + y labels */}
        {yTicks.map((v, i) => {
          const y = PAD.top + sc.y(v);
          return (
            <React.Fragment key={`y${i}`}>
              <Line
                x1={PAD.left} y1={y} x2={width - PAD.right} y2={y}
                stroke={i === 0 ? CHART.axis : CHART.grid}
                strokeWidth={i === 0 ? 1 : 0.6}
              />
              <SvgText
                x={PAD.left - 5} y={y + 2.4} textAnchor="end"
                style={{ fontFamily: FONT.sans, fontSize: CHART.tick }} fill={T.faint}
              >
                {compactMoney(v)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* x labels */}
        {xTicks.map((a, i) => (
          <SvgText
            key={`x${i}`}
            x={PAD.left + sc.x(a)} y={height - PAD.bottom + 12} textAnchor="middle"
            style={{ fontFamily: FONT.sans, fontSize: CHART.tick }} fill={T.faint}
          >
            {`${a}`}
          </SvgText>
        ))}

        {/* areas first so strokes sit on top */}
        {live.map((s, i) =>
          s.fill ? (
            <Path
              key={`a${i}`}
              d={areaPath(toPts(s).map((p) => ({ x: p.x + PAD.left, y: p.y + PAD.top })), PAD.top + plotH)}
              fill="url(#runoutFill)"
            />
          ) : null,
        )}

        {live.map((s, i) => (
          <Polyline
            key={`l${i}`}
            points={polylinePoints(toPts(s).map((p) => ({ x: p.x + PAD.left, y: p.y + PAD.top })))}
            stroke={s.color}
            strokeWidth={CHART.stroke + 0.5}
            strokeDasharray={s.dashed ? "4 3" : undefined}
            fill="none"
            strokeLinejoin="round"
          />
        ))}

        {/* depletion marker */}
        {markX != null && (
          <>
            <Line
              x1={markX} y1={PAD.top} x2={markX} y2={PAD.top + plotH}
              stroke={STATUS.bad.fill} strokeWidth={1} strokeDasharray="3 3"
            />
            <Circle cx={markX} cy={PAD.top + plotH} r={4} fill={STATUS.bad.fill} />
          </>
        )}
      </Svg>

      {/* callout — react-pdf text so it can hold two lines cleanly */}
      {markX != null && markLabelZh && (
        <View
          style={{
            position: "absolute",
            // keep the box on-page when depletion lands near the right edge
            left: Math.min(markX + 6, width - 92),
            top: PAD.top + 4,
            backgroundColor: STATUS.bad.softBg,
            borderWidth: 1,
            borderColor: STATUS.bad.fill,
            borderRadius: 3,
            paddingVertical: 3,
            paddingHorizontal: 6,
            maxWidth: 86,
          }}
        >
          <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.micro, color: STATUS.bad.fg }}>
            {markLabelZh}
          </Text>
          {markLabelEn ? (
            <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro - 0.5, color: STATUS.bad.fg }}>
              {markLabelEn}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** Legend rendered outside the Svg so labels can be any length. */
export function CurveLegend({ series }: { series: CurveSeries[] }) {
  return (
    <View style={{ flexDirection: "row", marginTop: 6 }}>
      {series.filter((s) => s.points.length > 0).map((s, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", marginRight: 18 }}>
          <View style={{ width: 14, height: 2.5, backgroundColor: s.color, marginRight: 5 }} />
          <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.text }}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}
