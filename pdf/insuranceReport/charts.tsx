// Chart & icon primitives for the client PDF, drawn with @react-pdf/renderer's
// built-in SVG + View primitives (no external chart lib). Mark specs follow the
// dataviz skill: meter track = a lighter step of the same ramp; fills are flat
// (no gradients over data); status always pairs colour with an icon/text.
import React from "react";
import { Svg, Path, Circle, Line, Rect, Polyline, View, Text } from "@react-pdf/renderer";
import { C, STATUS, type Band } from "./theme";

// ---------------------------------------------------------------- icon system
// One consistent outline style (stroke 1.6, round caps), sized by a token.
// Replaces every emoji (impeccable: no emoji as structural icons).
export type IconName =
  | "clipboard"
  | "pulse"
  | "bulb"
  | "shield"
  | "heart"
  | "cross"
  | "warning"
  | "check"
  | "x"
  | "arrow"
  | "target"
  | "user"
  | "coins"
  | "doc";

export function Icon({
  name, size = 14, color = C.blue, sw = 1.6,
}: { name: IconName; size?: number; color?: string; sw?: number }) {
  const common = { stroke: color, strokeWidth: sw, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      {name === "clipboard" && <>
        <Rect x={5} y={4} width={14} height={17} rx={2} {...common} />
        <Rect x={9} y={2.5} width={6} height={3.5} rx={1} {...common} />
        <Line x1={9} y1={11} x2={15} y2={11} {...common} />
        <Line x1={9} y1={15} x2={13} y2={15} {...common} />
      </>}
      {name === "pulse" && <>
        <Polyline points="2,12 7,12 9.5,6 13,18 15.5,12 22,12" {...common} />
      </>}
      {name === "bulb" && <>
        <Circle cx={12} cy={9.5} r={5.5} {...common} />
        <Line x1={9.5} y1={18} x2={14.5} y2={18} {...common} />
        <Line x1={10.5} y1={21} x2={13.5} y2={21} {...common} />
      </>}
      {name === "shield" && <>
        <Path d="M12 3 L19 6 V11 C19 15.5 16 19 12 21 C8 19 5 15.5 5 11 V6 Z" {...common} />
      </>}
      {name === "heart" && <>
        <Path d="M12 20 C12 20 4 14.5 4 9 C4 6.5 6 5 8 5 C9.6 5 11 6 12 7.6 C13 6 14.4 5 16 5 C18 5 20 6.5 20 9 C20 14.5 12 20 12 20 Z" {...common} />
      </>}
      {name === "cross" && <>
        <Path d="M10 4 h4 v6 h6 v4 h-6 v6 h-4 v-6 h-6 v-4 h6 z" {...common} />
      </>}
      {name === "warning" && <>
        <Path d="M12 3.5 L21.5 20 H2.5 Z" {...common} />
        <Line x1={12} y1={10} x2={12} y2={14.5} {...common} />
        <Circle cx={12} cy={17.6} r={0.9} fill={color} stroke="none" />
      </>}
      {name === "check" && <>
        <Polyline points="5,13 10,18 19,6" {...common} />
      </>}
      {name === "x" && <>
        <Line x1={6} y1={6} x2={18} y2={18} {...common} />
        <Line x1={18} y1={6} x2={6} y2={18} {...common} />
      </>}
      {name === "arrow" && <>
        <Line x1={4} y1={12} x2={19} y2={12} {...common} />
        <Polyline points="13,6 19,12 13,18" {...common} />
      </>}
      {name === "target" && <>
        <Circle cx={12} cy={12} r={8.5} {...common} />
        <Circle cx={12} cy={12} r={4.5} {...common} />
        <Circle cx={12} cy={12} r={1.4} fill={color} stroke="none" />
      </>}
      {name === "user" && <>
        <Circle cx={12} cy={8} r={3.6} {...common} />
        <Path d="M5 21 C5 16.6 8.2 14.5 12 14.5 C15.8 14.5 19 16.6 19 21" {...common} />
      </>}
      {name === "coins" && <>
        <Circle cx={9} cy={9} r={5} {...common} />
        <Path d="M13.5 5.4 A5 5 0 1 1 13.5 18.6" {...common} />
      </>}
      {name === "doc" && <>
        <Path d="M7 3 h7 l4 4 v14 h-11 z" {...common} />
        <Polyline points="14,3 14,7 18,7" {...common} />
      </>}
    </Svg>
  );
}

// ---------------------------------------------------------------- ring gauge
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

/** Donut gauge — the report's hero figure. `pct` 0..100. Colour by band; the big
 * number in the centre carries the value in text (never colour alone). */
export function RingGauge({
  pct, band, size = 100, thickness = 10, caption,
}: { pct: number; band: Band; size?: number; thickness?: number; caption?: string }) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const end = Math.min(pct * 3.6, 359.9);
  const st = STATUS[band];
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size, position: "relative" }}>
        <Svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <Circle cx={cx} cy={cy} r={r} stroke={st.track} strokeWidth={thickness} fill="none" />
          {pct > 0 && (
            <Path d={arcPath(cx, cy, r, 0, end)} stroke={st.fill} strokeWidth={thickness} fill="none" strokeLinecap="round" />
          )}
        </Svg>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 25, color: C.blue }}>{Math.round(pct)}%</Text>
        </View>
      </View>
      {!!caption && (
        <Text style={{ fontSize: 8, color: C.muted, marginTop: 5, textAlign: "center", maxWidth: size + 24 }}>{caption}</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- meter (bar)
/** Horizontal meter: track (lighter ramp step) + flat fill to `pct`, with a
 * rounded data-end. Pure Views — crisp at any zoom. */
export function Meter({
  pct, band, height = 9,
}: { pct: number; band: Band; height?: number }) {
  const st = STATUS[band];
  const w = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ height, backgroundColor: st.track, borderRadius: height / 2, overflow: "hidden" }}>
      <View style={{ width: `${w}%`, height, backgroundColor: st.fill, borderRadius: height / 2 }} />
    </View>
  );
}

// -------------------------------------------------------------- segment meter
/** 4-segment rating for a coverage level. `score` 0..4; -1 = unknown (outline). */
export function SegmentMeter({
  score, band, segments = 4, height = 7, width = 13, gap = 3,
}: { score: number; band: Band; segments?: number; height?: number; width?: number; gap?: number }) {
  const st = STATUS[band];
  return (
    <View style={{ flexDirection: "row" }}>
      {Array.from({ length: segments }).map((_, i) => {
        const unknown = score < 0;
        const filled = !unknown && i < score;
        return (
          <View
            key={i}
            style={{
              width,
              height,
              marginRight: i < segments - 1 ? gap : 0,
              borderRadius: 2,
              backgroundColor: unknown ? C.white : filled ? st.fill : st.track,
              borderWidth: unknown ? 1 : 0,
              borderColor: C.line,
            }}
          />
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------------ stat tile
export function StatTile({
  label, value, sub, icon,
}: { label: string; value: string; sub?: string; icon?: IconName }) {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 9, backgroundColor: C.white }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        {icon && <View style={{ marginRight: 4 }}><Icon name={icon} size={11} color={C.gold} /></View>}
        <Text style={{ fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 15, color: C.blue }}>{value}</Text>
      {!!sub && <Text style={{ fontSize: 7.5, color: C.faint, marginTop: 3 }}>{sub}</Text>}
    </View>
  );
}
