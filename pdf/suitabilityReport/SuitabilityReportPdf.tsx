// The Investor Suitability Assessment PDF. Cover -> profile & expectation ->
// how it was determined -> indicative allocation -> answers -> disclaimer.
//
// Reuses the insurance/CFP report design tokens (pdf/insuranceReport/theme.ts)
// and the shared CJK line-breaking callback so this reads as one visual family
// with the other client PDFs.
//
// Font registration ORDER MATTERS: registerFonts() installs a Latin-only
// hyphenation callback ((w) => [w]); splitForCjkWrap must be registered AFTER it
// or Chinese paragraphs become one unbreakable word and run off the page.
import React from "react";
import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
// Explicit .js extensions: this document is dynamically imported by renderNode
// inside the Vercel function, which is transpiled (not bundled) into ESM where
// Node's resolver requires a real extension.
import { registerFonts } from "../insuranceReport/fonts.js";
import { C, STATUS } from "../insuranceReport/theme.js";
import { splitForCjkWrap } from "../cjkWrap.js";
import {
  BAND_NAME,
  DISCLAIMER,
  GAP_TEXT,
  L,
  bindingDimensions,
  buildAnswerRows,
  fmtAllocation,
  fmtRange,
  fmtTarget,
  type Lang,
  type SuitabilityReportData,
} from "./model.js";

registerFonts();
Font.registerHyphenationCallback(splitForCjkWrap);

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansSC", backgroundColor: C.white, paddingTop: 44, paddingBottom: 56, paddingHorizontal: 46 },
  coverPage: { fontFamily: "NotoSansSC", backgroundColor: C.blue },
  coverInner: { flex: 1, padding: 52 },
  goldRule: { width: 54, height: 3, backgroundColor: C.gold, marginBottom: 18 },
  wordmark: { color: C.white, fontSize: 28, letterSpacing: 1 },
  coverKicker: { color: C.goldLight, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginTop: 30 },
  coverTitle: { color: C.white, fontSize: 24, marginTop: 8, lineHeight: 1.25 },
  coverMetaLabel: { color: C.goldLight, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" },
  coverMetaValue: { color: C.white, fontSize: 12, marginTop: 2 },

  h2: { fontSize: 13, color: C.blue, marginBottom: 10 },
  kicker: { fontSize: 8, color: C.gold, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 5 },
  body: { fontSize: 9.5, color: C.text, lineHeight: 1.7 },
  muted: { fontSize: 8, color: C.muted, lineHeight: 1.6 },

  card: { backgroundColor: C.bg, borderRadius: 8, padding: 14, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center" },
  statRow: { flexDirection: "row", marginBottom: 12 },
  stat: { flex: 1, backgroundColor: C.bg, borderRadius: 8, padding: 10, marginRight: 8 },
  statLabel: { fontSize: 7, color: C.muted, letterSpacing: 0.8, textTransform: "uppercase" },
  statValue: { fontSize: 13, color: C.blue, marginTop: 3 },
  statSub: { fontSize: 7.5, color: C.faint, marginTop: 2 },

  profileBanner: { backgroundColor: C.blue, borderRadius: 8, padding: 18, marginBottom: 14 },
  profileName: { color: C.white, fontSize: 21, marginTop: 4 },

  answerRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: C.line },
  answerQ: { flex: 1, fontSize: 8, color: C.muted, paddingRight: 10, lineHeight: 1.5 },
  answerA: { width: 190, fontSize: 8, color: C.text, lineHeight: 1.5 },

  footer: { position: "absolute", bottom: 26, left: 46, right: 46, flexDirection: "row", justifyContent: "space-between" },
  footerTxt: { fontSize: 7, color: C.faint },
});

/** Segmented 1-4 band track — clearer than a /100 gauge for a 4-level model. */
function BandTrack({ band, label, value }: { band: number; label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
      <View style={[s.row, { marginTop: 6 }]}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              marginRight: i < 4 ? 3 : 0,
              backgroundColor: i <= band ? C.gold : C.line,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** Range bar: the shaded span sits between min and max on a 0-100 track. */
function RangeBar({ label, min, max }: { label: string; min: number; max: number }) {
  return (
    <View style={{ marginBottom: 9 }} wrap={false}>
      <View style={[s.row, { justifyContent: "space-between", marginBottom: 3 }]}>
        <Text style={{ fontSize: 8.5, color: C.text }}>{label}</Text>
        <Text style={{ fontSize: 8.5, color: C.blue }}>{`${min}–${max}%`}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: C.line, borderRadius: 3, position: "relative" }}>
        <View
          style={{
            position: "absolute",
            left: `${min}%`,
            width: `${Math.max(max - min, 1.5)}%`,
            height: 6,
            backgroundColor: C.gold,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
}

export default function SuitabilityReportPdf({ data }: { data: SuitabilityReportData }) {
  const lang: Lang = data.language;
  const tx = L[lang];
  const cs = data.configSnapshot;
  const gapStatus = STATUS[
    data.expectationGap === "ALIGNED" ? "good" : data.expectationGap === "MODERATE_GAP" ? "warn" : "bad"
  ];
  const answerRows = buildAnswerRows(data.answers, lang);

  const Footer = (
    <View style={s.footer} fixed>
      <Text style={s.footerTxt}>XinWealth · {tx.title}</Text>
      <Text
        style={s.footerTxt}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );

  return (
    <Document title={`${tx.title} — ${data.prospectName ?? ""}`.trim()}>
      {/* ── Cover ─────────────────────────────────────────────────────────── */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverInner}>
          <View style={s.goldRule} />
          <Text style={s.wordmark}>XinWealth</Text>

          <Text style={s.coverKicker}>{tx.title}</Text>
          <Text style={s.coverTitle}>{lang === "zh" ? cs.profileNameZh : cs.profileNameEn}</Text>

          <View style={{ marginTop: 44 }}>
            <Text style={s.coverMetaLabel}>{tx.preparedFor}</Text>
            <Text style={s.coverMetaValue}>{data.prospectName || "—"}</Text>
          </View>
          <View style={{ marginTop: 16 }}>
            <Text style={s.coverMetaLabel}>{tx.preparedBy}</Text>
            <Text style={s.coverMetaValue}>{data.advisorName}</Text>
          </View>
          <View style={{ marginTop: 16 }}>
            <Text style={s.coverMetaLabel}>{tx.submitted}</Text>
            <Text style={s.coverMetaValue}>{data.submittedAt}</Text>
          </View>

          <View style={{ marginTop: 44 }}>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 8, lineHeight: 1.7 }}>
              {tx.reviewNote}
            </Text>
          </View>
        </View>
      </Page>

      {/* ── Profile & expectation ─────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <View style={s.profileBanner}>
          <Text style={{ color: C.goldLight, fontSize: 8, letterSpacing: 1.6, textTransform: "uppercase" }}>
            {tx.yourProfile}
          </Text>
          <Text style={s.profileName}>{lang === "zh" ? cs.profileNameZh : cs.profileNameEn}</Text>
        </View>

        <Text style={s.kicker}>{tx.characteristics}</Text>
        <Text style={[s.body, { marginBottom: 16 }]}>
          {lang === "zh" ? cs.descriptionZh : cs.descriptionEn}
        </Text>

        <View style={s.statRow}>
          <View style={s.stat}>
            <Text style={s.statLabel}>{tx.horizon}</Text>
            <Text style={s.statValue}>{lang === "zh" ? cs.horizonZh : cs.horizonEn}</Text>
          </View>
          <View style={[s.stat, { marginRight: 0 }]}>
            <Text style={s.statLabel}>{lang === "zh" ? cs.returnLabelZh : cs.returnLabelEn}</Text>
            <Text style={s.statValue}>{fmtRange(cs.returnRange, lang)}</Text>
          </View>
        </View>

        <Text style={s.kicker}>{tx.expectationCheck}</Text>
        <View style={[s.card, { backgroundColor: gapStatus.softBg }]}>
          <View style={[s.row, { justifyContent: "space-between", marginBottom: 8 }]}>
            <Text style={{ fontSize: 8.5, color: C.muted }}>{tx.yourExpectation}</Text>
            <Text style={{ fontSize: 10, color: gapStatus.fg }}>{fmtTarget(data.targetReturnPct, lang)}</Text>
          </View>
          <Text style={[s.body, { fontSize: 9 }]}>{GAP_TEXT[data.expectationGap]?.[lang] ?? ""}</Text>
        </View>

        <Text style={s.kicker}>{tx.howDerived}</Text>
        <View style={s.statRow}>
          <BandTrack
            band={data.capacityBand}
            label={tx.capacity}
            value={BAND_NAME[data.capacityBand][lang]}
          />
          <BandTrack
            band={data.toleranceBand}
            label={tx.tolerance}
            value={BAND_NAME[data.toleranceBand][lang]}
          />
          <View style={[s.stat, { marginRight: 0 }]}>
            <Text style={s.statLabel}>{tx.boundBy}</Text>
            <Text style={[s.statValue, { fontSize: 10 }]}>{bindingDimensions(data, lang)}</Text>
            <Text style={s.statSub}>
              {lang === "zh"
                ? "最终类型取三者中最保守的一项"
                : "The most conservative of the three sets the profile"}
            </Text>
          </View>
        </View>

        {Footer}
      </Page>

      {/* ── Allocation + answers ──────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>{tx.allocation}</Text>
        <View style={s.card}>
          <RangeBar
            label={tx.defensive}
            min={cs.allocation?.defensive.min ?? 0}
            max={(cs.allocation?.defensive.max as number) ?? 0}
          />
          <RangeBar
            label={tx.growth}
            min={cs.allocation?.growth.min ?? 0}
            max={(cs.allocation?.growth.max as number) ?? 0}
          />
          <RangeBar
            label={tx.diversifier}
            min={cs.allocation?.diversifier.min ?? 0}
            max={(cs.allocation?.diversifier.max as number) ?? 0}
          />
          {cs.allocation?.capApplied && (
            <Text style={[s.muted, { marginTop: 6, color: STATUS.warn.fg }]}>{tx.capNote}</Text>
          )}
        </View>

        <Text style={s.h2}>{tx.answers}</Text>
        <View>
          {answerRows.map((r) => (
            <View key={r.order} style={s.answerRow} wrap={false}>
              <Text style={s.answerQ}>
                {r.order}. {r.question}
              </Text>
              <Text style={s.answerA}>{r.answer}</Text>
            </View>
          ))}
        </View>

        {Footer}
      </Page>

      {/* ── Disclaimer ────────────────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>{tx.disclaimer}</Text>
        <Text style={[s.body, { fontSize: 8.5, color: C.muted }]}>{DISCLAIMER[lang]}</Text>
        <Text style={[s.muted, { marginTop: 20 }]}>
          {tx.rules} v{data.ruleVersion} · {tx.generated} {data.generatedDate}
        </Text>
        {Footer}
      </Page>
    </Document>
  );
}
