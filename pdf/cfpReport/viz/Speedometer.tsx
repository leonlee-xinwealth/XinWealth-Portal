// P11-12 财务比率仪表盘 — a 240° dial with a red/amber/green track and a needle.
//
// The dial draws ONLY the arc and the needle. An earlier version put the
// readout in an absolutely-positioned <Text> over the centre, which is exactly
// where the needle pivots — the two collided at every value. Numbers now live
// below the dial in ordinary flow, which also removes the absolute-positioning
// measurement risk entirely.

import React from "react";
import { Svg, Path, Circle, Polygon, View, Text } from "@react-pdf/renderer";
import { T, STATUS, TYPE, LEADING } from "../theme";
import { FONT, WEIGHT } from "../fonts";
import { arcPath, polar, clamp } from "./primitives";
import type { RatioBand } from "../select/diagnostics";

/** The dial sweeps 240°, from 7 o'clock round to 5 o'clock. */
const SWEEP = 240;
const START = -120;

export interface DialZone {
  /** fraction of full scale where this zone ends, 0..1 */
  to: number;
  band: Exclude<RatioBand, "none">;
}

export interface DialProps {
  /** 0..1 of full scale; null greys the track and hides the needle */
  fraction: number | null;
  zones: DialZone[];
  band: RatioBand;
  size?: number;
}

/** Arc + needle only. */
export function Dial({ fraction, zones, band, size = 92 }: DialProps) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  // The sweep leaves the bottom 120° open, so the drawing is shorter than wide.
  const height = size * 0.8;

  const angleAt = (f: number) => START + clamp(f, 0, 1) * SWEEP;

  let from = 0;
  const arcs = zones.map((z, i) => {
    const a0 = angleAt(from);
    const a1 = angleAt(z.to);
    from = z.to;
    return (
      <Path
        key={i}
        d={arcPath(cx, cx, r, a0, a1)}
        stroke={band === "none" ? STATUS.none.track : STATUS[z.band].track}
        strokeWidth={stroke}
        fill="none"
      />
    );
  });

  const needle = (() => {
    if (fraction == null) return null;
    const a = angleAt(fraction);
    // Stops short of the track so the tip points at the band rather than
    // punching through it.
    const tip = polar(cx, cx, r - stroke * 0.85, a);
    const l = polar(cx, cx, 3.5, a - 90);
    const rt = polar(cx, cx, 3.5, a + 90);
    const fill = STATUS[band === "none" ? "none" : band].fill;
    return (
      <>
        <Polygon points={`${tip.x},${tip.y} ${l.x},${l.y} ${rt.x},${rt.y}`} fill={fill} />
        <Circle cx={cx} cy={cx} r={4} fill={T.blue} />
      </>
    );
  })();

  return (
    <Svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
      {arcs}
      {needle}
    </Svg>
  );
}

export interface RatioDialProps extends DialProps {
  /** formatted value, e.g. "8 个月" / "31%" */
  readout: string;
  /** verdict word — status is never colour-alone */
  verdict: string;
  nameZh: string;
  basisZh: string;
  benchmark: string;
}

/** One complete cell of the P11 grid: dial, readout, name, basis, benchmark. */
export function RatioDial({
  fraction, zones, band, size = 92, readout, verdict, nameZh, basisZh, benchmark,
}: RatioDialProps) {
  const tone = STATUS[band === "none" ? "none" : band];
  return (
    <View style={{ alignItems: "center" }}>
      <Dial fraction={fraction} zones={zones} band={band} size={size} />

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
        <Text
          style={{
            fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: TYPE.h2 + 3,
            color: T.blue, lineHeight: LEADING.tight,
          }}
        >
          {readout}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: tone.softBg, borderRadius: 3,
          paddingVertical: 1.5, paddingHorizontal: 6, marginTop: 2,
        }}
      >
        <Text
          style={{
            fontFamily: FONT.sans, fontWeight: WEIGHT.medium, fontSize: TYPE.micro,
            color: tone.fg, lineHeight: LEADING.tight,
          }}
        >
          {verdict}
        </Text>
      </View>

      <Text
        style={{
          fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption,
          color: T.blue, marginTop: 5, textAlign: "center", lineHeight: LEADING.heading,
        }}
      >
        {nameZh}
      </Text>
      <Text
        style={{
          fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint,
          marginTop: 1, textAlign: "center", lineHeight: LEADING.tight,
        }}
      >
        {basisZh}
      </Text>
      <Text
        style={{
          fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.goldDark,
          marginTop: 1, lineHeight: LEADING.tight,
        }}
      >
        达标线 {benchmark}
      </Text>
    </View>
  );
}

/**
 * Zone layout per ratio. Ratios differ in direction — most are "higher is
 * better", debt ones invert, and liquid-to-net-worth has an ideal window — so
 * the zones cannot be derived from the band alone.
 */
export function zonesFor(id: string): DialZone[] {
  switch (id) {
    case "basicLiquidity": // scale 12 months: <3 bad, 3-6 warn, >6 good
      return [{ to: 0.25, band: "bad" }, { to: 0.5, band: "warn" }, { to: 1, band: "good" }];
    case "liquidAssetToNetWorth": // scale 40%: <15 bad, 15-20 good, >20 warn
      return [{ to: 0.375, band: "bad" }, { to: 0.5, band: "good" }, { to: 1, band: "warn" }];
    case "solvency": // scale 100%: <=50 bad, >50 good
    case "investmentAssets":
      return [{ to: 0.5, band: "bad" }, { to: 1, band: "good" }];
    case "debtToAsset": // scale 100%, inverted: <50 good
      return [{ to: 0.5, band: "good" }, { to: 1, band: "bad" }];
    case "savings": // scale 50%: <=20 warn, >20 good
      return [{ to: 0.4, band: "warn" }, { to: 1, band: "good" }];
    case "debtService": // scale 70%, inverted: <35 good, <=50 warn
      return [{ to: 0.5, band: "good" }, { to: 0.714, band: "warn" }, { to: 1, band: "bad" }];
    default:
      return [{ to: 1, band: "good" }];
  }
}
