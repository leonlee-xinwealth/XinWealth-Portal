// Composition ring — P6 支出占收入, P21 资产配置.
//
// The legend is react-pdf <View>/<Text> outside the <Svg> on purpose: Svg text
// has no wrapping and no ellipsis, so a long Chinese category name would run
// off the chart instead of truncating.

import React from "react";
import { Svg, Path, Circle, View, Text } from "@react-pdf/renderer";
import { T, TYPE, SPACE, LEADING, SERIES } from "../theme";
import { FONT, WEIGHT } from "../fonts";
import { arcPath } from "./primitives";

export interface Slice {
  label: string;
  value: number;
  /** overrides the categorical ramp; used when a slice has a fixed meaning */
  color?: string;
}

export interface DonutProps {
  slices: Slice[];
  size?: number;
  thickness?: number;
  /** big figure in the hole */
  centerValue?: string;
  centerLabel?: string;
}

export function Donut({
  slices, size = 168, thickness = 28, centerValue, centerLabel,
}: DonutProps) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;

  let from = 0;
  const arcs = total > 0
    ? slices.map((s, i) => {
        const frac = Math.max(0, s.value) / total;
        const a0 = from * 360;
        const a1 = (from + frac) * 360;
        from += frac;
        return (
          <Path
            key={i}
            d={arcPath(cx, cx, r, a0, a1)}
            stroke={s.color ?? SERIES[i % SERIES.length]}
            strokeWidth={thickness}
            fill="none"
          />
        );
      })
    : [<Circle key="empty" cx={cx} cy={cx} r={r} stroke={T.hairline} strokeWidth={thickness} fill="none" />];

  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <Svg width={size} height={size}>{arcs}</Svg>
      {(centerValue || centerLabel) && (
        <View
          style={{
            position: "absolute", top: 0, left: 0, width: size, height: size,
            alignItems: "center", justifyContent: "center",
            // The hole, not the ring — text wider than this spills over the
            // stroke and reads as a rendering fault.
            paddingHorizontal: thickness + 4,
          }}
        >
          {centerValue && (
            <Text
              style={{
                fontFamily: FONT.serif, fontWeight: WEIGHT.bold,
                // Long strings (a full RM figure) must step down or they will
                // not fit the hole at any size the ring can offer.
                fontSize: centerValue.length > 7 ? TYPE.h2 : TYPE.h1 - 4,
                color: T.blue, lineHeight: LEADING.tight, textAlign: "center",
              }}
            >
              {centerValue}
            </Text>
          )}
          {centerLabel && (
            <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginTop: 1, lineHeight: LEADING.tight }}>
              {centerLabel}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export interface DonutLegendProps {
  slices: Slice[];
  /** formats each slice's value for the right-hand column */
  format: (v: number) => string;
  /** show each slice's share of the whole */
  showShare?: boolean;
}

export function DonutLegend({ slices, format, showShare = true }: DonutLegendProps) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  // width:100% rather than flex:1 — the legend has to work both beside a ring
  // (row context) and beneath a pair of them (column context). flex:1 in a
  // column collapses the rows on top of each other.
  return (
    <View style={{ width: "100%" }}>
      {slices.map((s, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
          <View
            style={{
              width: 8, height: 8, borderRadius: 2,
              backgroundColor: s.color ?? SERIES[i % SERIES.length], marginRight: SPACE.sm,
            }}
          />
          <Text style={{ flex: 1, fontFamily: FONT.body, fontSize: TYPE.body, color: T.text, lineHeight: LEADING.tight }}>
            {s.label}
          </Text>
          {showShare && total > 0 && (
            <Text style={{ width: 34, textAlign: "right", fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, lineHeight: LEADING.tight }}>
              {((Math.max(0, s.value) / total) * 100).toFixed(0)}%
            </Text>
          )}
          <Text
            style={{
              width: 78, textAlign: "right", fontFamily: FONT.serif, fontWeight: WEIGHT.medium,
              fontSize: TYPE.body, color: T.blue, lineHeight: LEADING.tight,
            }}
          >
            {format(s.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Folds a long tail into "其他" so a ring never carries more slices than the eye
 * can separate. Keeps the top N by value.
 */
export function foldTail(slices: Slice[], keep = 6, otherLabel = "其他"): Slice[] {
  if (slices.length <= keep) return slices;
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, keep - 1);
  const tail = sorted.slice(keep - 1);
  return [...head, { label: otherLabel, value: tail.reduce((s, x) => s + x.value, 0) }];
}
