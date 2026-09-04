// Consequence / solution cards.
//
// The blueprint is explicit about these: wherever the report names a shortfall,
// the CONSEQUENCE must occupy its own loud card rather than being buried in a
// paragraph. They appear on the insurance gap, estate findings, retirement
// run-out and high-interest-debt pages, so they live here rather than being
// re-typed per page.
//
// These colours are deliberately NOT from STATUS. STATUS encodes a measured
// band (good / warn / bad) on a dial or a bar; if a decorative card borrowed its
// red, red would stop meaning "this ratio failed" on the very next page.

import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { T, TYPE, SPACE, LEADING, RADIUS } from "../theme";
import { FONT, WEIGHT } from "../fonts";

export interface CalloutProps {
  /** small tracked label, e.g. 后果 · CONSEQUENCE */
  kickerZh: string;
  kickerEn: string;
  /** the one line that should land hardest — a figure or a blunt statement */
  headline?: string;
  body: string;
  /** extra lines under the body, e.g. specific actions */
  bullets?: string[];
}

function Card({
  kickerZh, kickerEn, headline, body, bullets, palette,
}: CalloutProps & { palette: { bg: string; fg: string; accent: string } }) {
  return (
    <View style={{ backgroundColor: palette.bg, borderRadius: RADIUS.md, padding: SPACE.lg }} wrap={false}>
      <Text
        style={{
          fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption,
          color: palette.accent, letterSpacing: 2, lineHeight: LEADING.tight,
        }}
      >
        {kickerZh} · {kickerEn}
      </Text>

      {headline && (
        <Text
          style={{
            fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: TYPE.h1,
            color: T.onDark, marginTop: SPACE.sm, marginBottom: SPACE.sm,
            lineHeight: LEADING.display,
          }}
        >
          {headline}
        </Text>
      )}

      <Text
        style={{
          fontFamily: FONT.body, fontSize: TYPE.body, color: palette.fg,
          marginTop: headline ? 0 : SPACE.sm, lineHeight: LEADING.body,
        }}
      >
        {body}
      </Text>

      {bullets?.map((b, i) => (
        <View key={i} style={{ flexDirection: "row", marginTop: SPACE.sm }}>
          <View
            style={{
              width: 4, height: 4, borderRadius: 2, backgroundColor: palette.accent,
              marginTop: 5, marginRight: SPACE.sm,
            }}
          />
          <Text style={{ flex: 1, fontFamily: FONT.body, fontSize: TYPE.body, color: palette.fg, lineHeight: LEADING.body }}>
            {b}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** 后果 — deep red. Never used for anything the client is doing right. */
export function ConsequenceCard(props: Omit<CalloutProps, "kickerZh" | "kickerEn"> & Partial<Pick<CalloutProps, "kickerZh" | "kickerEn">>) {
  return (
    <Card
      kickerZh={props.kickerZh ?? "后果"}
      kickerEn={props.kickerEn ?? "CONSEQUENCE"}
      headline={props.headline}
      body={props.body}
      bullets={props.bullets}
      palette={T.danger}
    />
  );
}

/** 解决方案 — deep green. Always paired with a consequence, never alone. */
export function SolutionCard(props: Omit<CalloutProps, "kickerZh" | "kickerEn"> & Partial<Pick<CalloutProps, "kickerZh" | "kickerEn">>) {
  return (
    <Card
      kickerZh={props.kickerZh ?? "解决方案"}
      kickerEn={props.kickerEn ?? "RECOMMENDATION"}
      headline={props.headline}
      body={props.body}
      bullets={props.bullets}
      palette={T.solution}
    />
  );
}
