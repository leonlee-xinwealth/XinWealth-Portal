// Client-facing unified CFP report PDF — Cover -> Disclaimer -> Executive
// Summary -> Personal Info -> Cash Flow -> Balance Sheet -> Financial Ratios
// -> one page per generated section -> Overall Health & Timeline -> Back
// page. Reuses the insurance report's font registration and design tokens
// (pdf/insuranceReport/{fonts,theme,charts}.ts) so both client PDFs read as
// one visual family. Content shapes vary per cfp-brain module (see
// supabase/functions/cfp-brain/modules/*/section.ts) — this file branches on
// `section_type` rather than assuming one narrative shape.
//
// v2 (chart/icon-driven redesign): every emoji has been replaced by the
// line-style SectionIcon set in ./viz.tsx (NotoSansSC has no emoji glyphs —
// they rendered as tofu/garbage), the Executive Summary moved from a
// 5-column table (which overflowed with real LLM findings, spilling text
// across page boundaries) to one self-contained card per section, and every
// numeric page gained a small chart (gauge / bars / coverage tracks /
// timeline) so the report reads visually rather than as a wall of text. See
// docs/superpowers/plans and specs for the request that drove this pass.
import React from "react";
import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
import { registerFonts } from "../insuranceReport/fonts";
import { C, STATUS, type Band } from "../insuranceReport/theme";
import { Meter } from "../insuranceReport/charts";
import { CFP_SECTION_ORDER, SECTION_META, type CfpSectionType } from "../../components/advisor/cfp/sectionMeta";
import {
  fmtRM, LABELS, DISCLAIMER_EN, DISCLAIMER_ZH,
  buildExecSummaryRows, sectionByType, NARRATIVE_FIELDS,
  verdictSavings, verdictDebtService, verdictEmergencyMonths, verdictSolvency,
  topCategoriesWithOther, ALLOCATION_BUCKET_LABEL, SCORE_COMPONENT_LABEL,
} from "./model";
import {
  SectionIcon, ScoreGauge, HBar, CoverageBar, PairedBar, StageTrack,
  VerdictChip, PhaseTimeline, StatBlock,
} from "./viz";
import type { CfpReportData, CfpReportLanguage } from "./types";

registerFonts();

// react-pdf's text layout (@react-pdf/textkit) only recognises literal ASCII
// spaces as word boundaries. Real LLM-generated Chinese prose has none, so an
// entire long CJK paragraph is treated as ONE unbreakable "word" — insuranceReport's
// registerFonts() sets a hyphenationCallback of `(word) => [word]` (disabling
// Latin hyphenation, which is right for Latin text) but this ALSO makes the
// giant CJK "word" impossible to break, so it overflows straight off the
// page instead of wrapping (the reported 文字跑位 bug). Re-registering the
// callback here (a global Font API call, not an edit to insuranceReport's
// file) fixes it: CJK characters become individually breakable while Latin
// words / numbers (e.g. "RM500,000") are left intact so they never split
// mid-token. The cost is a small "-" glyph at some CJK line-wraps — a known
// textkit limitation (any hyphenation break point renders a hyphen) and a
// vast improvement over text spilling across page boundaries.
function isCjkChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0x3000 && code <= 0x303f) || // CJK punctuation
    (code >= 0xff00 && code <= 0xffef) || // Fullwidth forms
    (code >= 0x3400 && code <= 0x4dbf) // CJK Extension A
  );
}
function splitForCjkWrap(word: string): string[] {
  if (!word) return [word];
  let hasCjk = false;
  for (const ch of word) {
    if (isCjkChar(ch)) { hasCjk = true; break; }
  }
  if (!hasCjk) return [word];
  const parts: string[] = [];
  let latinBuf = "";
  for (const ch of word) {
    if (isCjkChar(ch)) {
      if (latinBuf) { parts.push(latinBuf); latinBuf = ""; }
      parts.push(ch);
    } else {
      latinBuf += ch;
    }
  }
  if (latinBuf) parts.push(latinBuf);
  return parts;
}
Font.registerHyphenationCallback(splitForCjkWrap);

const s = StyleSheet.create({
  coverPage: { fontFamily: "NotoSansSC", backgroundColor: C.blue },
  coverInner: { flex: 1, padding: 52, position: "relative" },
  coverGoldRule: { width: 60, height: 3, backgroundColor: C.gold, marginBottom: 18 },
  wordmark: { color: C.white, fontSize: 30, letterSpacing: 1 },
  coverKicker: { color: C.goldLight, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginTop: 26 },
  coverTitle: { color: C.white, fontSize: 26, marginTop: 6, lineHeight: 1.2 },
  coverDraft: {
    color: C.blue, backgroundColor: C.goldLight, fontSize: 9, letterSpacing: 1,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4, marginTop: 14, alignSelf: "flex-start",
  },
  coverDivider: { height: 1, backgroundColor: "#22405E", marginTop: 26, marginBottom: 20 },
  coverMetaRow: { flexDirection: "row", marginBottom: 8 },
  coverMetaLabel: { width: 120, color: C.goldLight, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 },
  coverMetaValue: { flex: 1, color: C.white, fontSize: 12 },
  coverFooter: { position: "absolute", left: 52, right: 52, bottom: 44 },
  coverConfidential: { color: "#8FA6BC", fontSize: 8 },

  page: {
    fontFamily: "NotoSansSC", fontSize: 10, color: C.text, lineHeight: 1.5,
    paddingTop: 42, paddingBottom: 52, paddingHorizontal: 44,
  },
  h1: { color: C.blue, fontSize: 16, marginBottom: 4 },
  h1Rule: { width: 40, height: 2, backgroundColor: C.gold, marginBottom: 12 },
  h2: {
    color: C.blue, fontSize: 11, borderLeftWidth: 3, borderLeftColor: C.gold,
    paddingLeft: 6, marginTop: 14, marginBottom: 8,
  },
  intro: { color: C.text, fontSize: 10, marginBottom: 10, lineHeight: 1.55 },
  para: { color: C.text, fontSize: 9.5, lineHeight: 1.55, marginBottom: 8 },
  small: { color: C.muted, fontSize: 8 },

  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  sectionIconWrap: { marginRight: 8 },
  sectionTitleZh: { color: C.blue, fontSize: 16 },
  sectionTitleEn: { color: C.muted, fontSize: 9, marginTop: 2 },
  sectionPersona: { color: C.gold, fontSize: 9, marginTop: 2 },

  extrasBlock: { marginBottom: 12 },

  tHead: { flexDirection: "row", backgroundColor: C.blue, borderTopLeftRadius: 5, borderTopRightRadius: 5, paddingVertical: 5 },
  th: { fontSize: 7.5, color: C.white, paddingHorizontal: 5 },
  tRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.line },
  td: { fontSize: 8.5, color: C.text, paddingHorizontal: 5 },
  tTotal: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 5, backgroundColor: C.bg, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },

  kvRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.line },
  kvLabel: { width: 150, fontSize: 9, color: C.muted },
  kvValue: { flex: 1, fontSize: 9.5, color: C.text },

  statRow: { flexDirection: "row", borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12, marginTop: 4, marginBottom: 12 },

  ratioCard: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 8 },
  ratioTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  ratioLabel: { fontSize: 10, color: C.blue },
  ratioVal: { fontSize: 13, color: C.text, marginBottom: 5 },
  ratioGuide: { fontSize: 7.5, color: C.faint },
  pill: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 8 },
  pillText: { fontSize: 8 },

  bulletCard: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 9, marginBottom: 7 },
  bulletTitle: { fontSize: 10, color: C.blue, marginBottom: 3 },
  bulletBody: { fontSize: 9, color: C.text, lineHeight: 1.5 },

  glRow: { flexDirection: "row", marginBottom: 5 },
  glTerm: { width: 140, color: C.blue, fontSize: 9, paddingRight: 8 },
  glDef: { flex: 1, color: C.text, fontSize: 8.5 },
  disclaimer: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line, color: C.muted, fontSize: 7.5, lineHeight: 1.5 },

  execCard: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 10 },
  execCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  execCardZh: { fontSize: 11, color: C.blue },
  execCardEn: { fontSize: 7.5, color: C.faint, marginTop: 1 },
  execCardBlock: { marginBottom: 6 },
  execCardLabel: { fontSize: 7, color: C.muted, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  execCardText: { fontSize: 9, color: C.text, lineHeight: 1.5 },
  execCardFooter: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 5, marginTop: 2 },
  execCardFooterText: { fontSize: 7.5, color: C.muted },

  footer: {
    position: "absolute", bottom: 22, left: 44, right: 44,
    flexDirection: "row", justifyContent: "space-between",
    color: C.faint, fontSize: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6,
  },
});

const Footer = ({ label }: { label: string }) => (
  <View style={s.footer} fixed>
    <Text>XinWealth · {label}</Text>
    <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  </View>
);

const H1 = ({ text }: { text: string }) => (
  <View wrap={false}>
    <Text style={s.h1}>{text}</Text>
    <View style={s.h1Rule} />
  </View>
);

const VerdictPill = ({ band, text }: { band: Band; text: string }) => {
  const st = STATUS[band];
  return (
    <View style={[s.pill, { backgroundColor: st.softBg }]}>
      <Text style={[s.pillText, { color: st.fg }]}>{text}</Text>
    </View>
  );
};

/** One stat block per column, hairline divider between columns — used by
 * the Cash Flow and Balance Sheet pages' 三大数字 rows. */
const StatRow = ({
  items,
}: { items: Array<{ label: string; value: string; tone?: "good" | "bad" | "warn" | "ink" }> }) => (
  <View style={s.statRow} wrap={false}>
    {items.map((it, i) => (
      <View
        key={i}
        style={i < items.length - 1 ? { flex: 1, borderRightWidth: 1, borderRightColor: C.line, paddingRight: 10, marginRight: 10 } : { flex: 1 }}
      >
        <StatBlock label={it.label} value={it.value} tone={it.tone} />
      </View>
    ))}
  </View>
);

/** Ratio name + prominent value + VerdictChip + a mini bar of value vs
 * guideline (track capped at 2x the guideline so the fill stays meaningful
 * at both healthy and unhealthy readings). */
const RatioRow = ({
  label, valueLabel, value, guidelineMax, ok, okText, badText, guidelineText,
}: {
  label: string; valueLabel: string; value: number | null; guidelineMax: number;
  ok: boolean; okText: string; badText: string; guidelineText: string;
}) => {
  const pct = value != null && guidelineMax > 0 ? Math.max(0, Math.min(100, (value / guidelineMax) * 100)) : 0;
  const band: Band = ok ? "good" : "bad";
  return (
    <View style={s.ratioCard} wrap={false}>
      <View style={s.ratioTop}>
        <Text style={s.ratioLabel}>{label}</Text>
        <VerdictChip ok={ok} textOk={okText} textBad={badText} />
      </View>
      <Text style={s.ratioVal}>{valueLabel}</Text>
      {value != null && <Meter pct={pct} band={band} height={6} />}
      <Text style={[s.ratioGuide, { marginTop: 5 }]}>{guidelineText}</Text>
    </View>
  );
};

const MARITAL_LABEL: Record<string, [string, string]> = {
  single: ["Single", "单身"],
  married: ["Married", "已婚"],
  divorced: ["Divorced", "离婚"],
  widowed: ["Widowed", "丧偶"],
};
const EMPLOYMENT_LABEL: Record<string, [string, string]> = {
  employed: ["Employed", "受雇"],
  self_employed: ["Self-Employed", "自雇"],
  unemployed: ["Unemployed", "待业"],
  retired: ["Retired", "退休"],
  student: ["Student", "学生"],
};
const pickEnum = (map: Record<string, [string, string]>, key: string | null | undefined, lang: CfpReportLanguage) =>
  key && map[key] ? (lang === "zh" ? map[key][1] : map[key][0]) : (key ?? "—");

export default function CfpReportPdf({ data }: { data: CfpReportData }) {
  const lang = data.language;
  const t = LABELS[lang];
  const baseline = data.baseline;
  const financialHealth = sectionByType(data, "financial_health");
  const cashflow = sectionByType(data, "cashflow_planning");
  const execRows = buildExecSummaryRows(data);

  const clientFieldRows: Array<[string, string]> = [];
  const c = data.client || {};
  if (c.date_of_birth) clientFieldRows.push([t.dob, c.date_of_birth]);
  if (c.marital_status) clientFieldRows.push([t.maritalStatus, pickEnum(MARITAL_LABEL, c.marital_status, lang)]);
  if (c.number_of_dependants != null) clientFieldRows.push([t.dependents, String(c.number_of_dependants)]);
  if (c.occupation) clientFieldRows.push([t.occupation, c.occupation]);
  if (c.employment_status) clientFieldRows.push([t.employmentStatus, pickEnum(EMPLOYMENT_LABEL, c.employment_status, lang)]);
  if (c.retirement_age != null) clientFieldRows.push([t.retirementAge, String(c.retirement_age)]);

  const totalAssets = (data.assets ?? []).reduce((sum, a) => sum + (a.current_value ?? 0), 0);
  const totalLiabilities = (data.liabilities ?? []).reduce((sum, l) => sum + (l.outstanding_balance ?? 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  const monthsCovered = baseline && baseline.monthly_essential_expenses > 0
    ? Number((baseline.emergency_fund_actual / baseline.monthly_essential_expenses).toFixed(1))
    : null;

  return (
    <Document title={`${t.reportTitle} — ${data.period}`}>
      {/* -------------------------------------------------------------- Cover */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverInner}>
          <View style={s.coverGoldRule} />
          <Text style={s.wordmark}>XinWealth</Text>
          <Text style={s.coverKicker}>{t.reportTitle}</Text>
          <Text style={s.coverTitle}>{data.period}</Text>
          {data.hasUnapproved && <Text style={s.coverDraft}>{t.draftTag}</Text>}
          <View style={s.coverDivider} />
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaLabel}>{t.preparedFor}</Text>
            <Text style={s.coverMetaValue}>{data.clientName || "—"}</Text>
          </View>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaLabel}>{t.preparedBy}</Text>
            <Text style={s.coverMetaValue}>{data.advisorName || "—"}</Text>
          </View>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaLabel}>{t.generatedOn}</Text>
            <Text style={s.coverMetaValue}>{data.generatedDate}</Text>
          </View>
          <View style={s.coverFooter}>
            <View style={{ width: 40, height: 2, backgroundColor: C.gold, marginBottom: 8 }} />
            <Text style={s.coverConfidential}>{t.confidential}</Text>
          </View>
        </View>
      </Page>

      {/* --------------------------------------------------------- Disclaimer */}
      <Page size="A4" style={s.page}>
        <H1 text={t.disclaimerTitle} />
        <Text style={s.h2}>English</Text>
        {DISCLAIMER_EN.map((p, i) => <Text style={s.para} key={i}>{p}</Text>)}
        <Text style={s.h2}>中文</Text>
        {DISCLAIMER_ZH.map((p, i) => <Text style={s.para} key={i}>{p}</Text>)}
        <Text style={[s.para, { color: C.muted }]}>{t.disclaimerConsult}</Text>
        <Footer label={t.reportTitle} />
      </Page>

      {/* --------------------------------------------------- Executive Summary */}
      <Page size="A4" style={s.page}>
        <H1 text={t.execSummaryTitle} />
        {execRows.map((row) => (
          <View style={s.execCard} key={row.sectionType} wrap={false}>
            <View style={s.execCardHeader}>
              <View style={s.sectionIconWrap}>
                <SectionIcon type={row.sectionType} size={14} color={C.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.execCardZh}>{row.meta.zh}</Text>
                <Text style={s.execCardEn}>{row.meta.en}</Text>
              </View>
              <VerdictPill
                band={row.generated ? "good" : "none"}
                text={row.generated ? (lang === "zh" ? "已生成" : "Generated") : t.notIncluded}
              />
            </View>
            {row.generated ? (
              <>
                <View style={s.execCardBlock}>
                  <Text style={s.execCardLabel}>{t.colFindings}</Text>
                  <Text style={s.execCardText}>{row.findings || "—"}</Text>
                </View>
                <View style={s.execCardBlock}>
                  <Text style={s.execCardLabel}>{t.colActionPlan}</Text>
                  <Text style={s.execCardText}>{row.actionPlan || "—"}</Text>
                </View>
                <View style={s.execCardFooter}>
                  <Text style={s.execCardFooterText}>
                    {t.colExpectedCompletion}: {row.expectedCompletion || "—"} · {t.colRemarks}: {row.remarks || "—"}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={[s.small, { marginTop: 2 }]}>
                {lang === "zh" ? "未纳入本期 / Not included this period" : "Not included this period / 未纳入本期"}
              </Text>
            )}
          </View>
        ))}
        <Footer label={t.reportTitle} />
      </Page>

      {/* --------------------------------------------------- Personal Information */}
      {clientFieldRows.length > 0 && (
        <Page size="A4" style={s.page}>
          <H1 text={t.personalInfoTitle} />
          {clientFieldRows.map(([label, value], i) => (
            <View style={s.kvRow} key={i} wrap={false}>
              <Text style={s.kvLabel}>{label}</Text>
              <Text style={s.kvValue}>{value}</Text>
            </View>
          ))}
          <Footer label={t.reportTitle} />
        </Page>
      )}

      {/* --------------------------------------------------------- Cash Flow */}
      {cashflow && (
        <Page size="A4" style={s.page}>
          <H1 text={t.cashflowTitle} />
          <Text style={s.intro}>{t.cashflowIntro}</Text>

          <StatRow
            items={[
              { label: t.income, value: fmtRM(cashflow.content.monthly_income) },
              { label: t.expenses, value: fmtRM(cashflow.content.monthly_expenses) },
              {
                label: t.netCashflow,
                value: fmtRM(cashflow.content.monthly_surplus),
                tone: cashflow.content.monthly_surplus >= 0 ? "good" : "bad",
              },
            ]}
          />

          <View wrap={false}>
            <PairedBar
              aLabel={t.income}
              aValue={cashflow.content.monthly_income}
              bLabel={t.expenses}
              bValue={cashflow.content.monthly_expenses}
              fmtRM={fmtRM}
              labelWidth={70}
            />
          </View>

          <Text style={s.h2}>{t.income}</Text>
          {(() => {
            const rows = topCategoriesWithOther(cashflow.content.income_breakdown, 8, lang);
            const max = Math.max(...rows.map((r) => r.monthly_amount), 1);
            return rows.map((row, i) => (
              <HBar key={i} label={row.category} value={row.monthly_amount} max={max} valueLabel={fmtRM(row.monthly_amount)} />
            ));
          })()}

          <Text style={s.h2}>{t.expenses}</Text>
          {(() => {
            const rows = topCategoriesWithOther(cashflow.content.expense_breakdown, 8, lang);
            const max = Math.max(...rows.map((r) => r.monthly_amount), 1);
            return rows.map((row, i) => (
              <HBar key={i} label={row.category} value={row.monthly_amount} max={max} valueLabel={fmtRM(row.monthly_amount)} />
            ));
          })()}
          <Footer label={t.reportTitle} />
        </Page>
      )}

      {/* ---------------------------------------------------- Balance Sheet */}
      <Page size="A4" style={s.page}>
        <H1 text={t.balanceSheetTitle} />
        <Text style={s.intro}>{t.balanceSheetIntro}</Text>

        <StatRow
          items={[
            { label: t.totalAssets, value: fmtRM(totalAssets) },
            { label: t.totalLiabilities, value: fmtRM(totalLiabilities) },
            { label: t.netWorth, value: fmtRM(netWorth), tone: netWorth >= 0 ? "good" : "bad" },
          ]}
        />

        <View wrap={false}>
          <PairedBar
            aLabel={t.totalAssets}
            aValue={totalAssets}
            bLabel={t.totalLiabilities}
            bValue={totalLiabilities}
            fmtRM={fmtRM}
            labelWidth={90}
          />
        </View>

        <Text style={s.h2}>{t.assets}</Text>
        <View style={s.tHead}>
          <Text style={[s.th, { width: "55%" }]}>{t.colItems}</Text>
          <Text style={[s.th, { width: "25%" }]}>Type</Text>
          <Text style={[s.th, { width: "20%", textAlign: "right" }]}>RM</Text>
        </View>
        {(data.assets ?? []).length === 0 ? (
          <View style={s.tRow}><Text style={[s.td, { width: "100%", textAlign: "center", color: C.faint }]}>—</Text></View>
        ) : (
          (data.assets ?? []).map((a, i) => (
            <View style={[s.tRow, i % 2 === 1 ? { backgroundColor: C.bgAlt } : {}]} key={i} wrap={false}>
              <Text style={[s.td, { width: "55%", maxLines: 2, textOverflow: "ellipsis" }]}>{a.name}</Text>
              <Text style={[s.td, { width: "25%", maxLines: 1, textOverflow: "ellipsis" }]}>{a.asset_type}</Text>
              <Text style={[s.td, { width: "20%", textAlign: "right" }]}>{fmtRM(a.current_value)}</Text>
            </View>
          ))
        )}
        <View style={s.tTotal}>
          <Text style={[s.td, { flex: 1, textAlign: "right", color: C.blue }]}>{t.totalAssets}</Text>
          <Text style={[s.td, { width: "20%", textAlign: "right", color: C.blue }]}>{fmtRM(totalAssets)}</Text>
        </View>

        <Text style={s.h2}>{t.liabilities}</Text>
        <View style={s.tHead}>
          <Text style={[s.th, { width: "55%" }]}>{t.colItems}</Text>
          <Text style={[s.th, { width: "25%" }]}>Type</Text>
          <Text style={[s.th, { width: "20%", textAlign: "right" }]}>RM</Text>
        </View>
        {(data.liabilities ?? []).length === 0 ? (
          <View style={s.tRow}><Text style={[s.td, { width: "100%", textAlign: "center", color: C.faint }]}>—</Text></View>
        ) : (
          (data.liabilities ?? []).map((l, i) => (
            <View style={[s.tRow, i % 2 === 1 ? { backgroundColor: C.bgAlt } : {}]} key={i} wrap={false}>
              <Text style={[s.td, { width: "55%", maxLines: 2, textOverflow: "ellipsis" }]}>{l.name}</Text>
              <Text style={[s.td, { width: "25%", maxLines: 1, textOverflow: "ellipsis" }]}>{l.liability_type}</Text>
              <Text style={[s.td, { width: "20%", textAlign: "right" }]}>{fmtRM(l.outstanding_balance)}</Text>
            </View>
          ))
        )}
        <View style={s.tTotal}>
          <Text style={[s.td, { flex: 1, textAlign: "right", color: C.blue }]}>{t.totalLiabilities}</Text>
          <Text style={[s.td, { width: "20%", textAlign: "right", color: C.blue }]}>{fmtRM(totalLiabilities)}</Text>
        </View>
        <Footer label={t.reportTitle} />
      </Page>

      {/* ------------------------------------------------------ Financial Ratios */}
      {baseline && (
        <Page size="A4" style={s.page}>
          <H1 text={t.ratiosTitle} />

          {financialHealth && financialHealth.content.health_score != null && (
            <View style={[s.ratioCard, { flexDirection: "row", alignItems: "center", marginBottom: 14 }]} wrap={false}>
              <ScoreGauge score={financialHealth.content.health_score} size={72} />
              <Text style={[s.ratioLabel, { marginLeft: 16 }]}>{t.healthScore}</Text>
            </View>
          )}

          <RatioRow
            label={t.savingsRatio}
            value={baseline.savings_ratio != null ? baseline.savings_ratio * 100 : null}
            guidelineMax={40}
            valueLabel={baseline.savings_ratio != null ? `${(baseline.savings_ratio * 100).toFixed(1)}%` : "—"}
            ok={verdictSavings(baseline.savings_ratio) === "good"}
            okText={t.healthy}
            badText={t.attention}
            guidelineText={`${t.guideline}: ≥ 20%`}
          />

          <RatioRow
            label={t.debtServiceRatio}
            value={baseline.debt_service_ratio != null ? baseline.debt_service_ratio * 100 : null}
            guidelineMax={70}
            valueLabel={baseline.debt_service_ratio != null ? `${(baseline.debt_service_ratio * 100).toFixed(1)}%` : "—"}
            ok={verdictDebtService(baseline.debt_service_ratio) === "good"}
            okText={t.healthy}
            badText={t.attention}
            guidelineText={`${t.guideline}: ≤ 35%`}
          />

          <RatioRow
            label={t.emergencyMonths}
            value={monthsCovered}
            guidelineMax={12}
            valueLabel={monthsCovered != null ? String(monthsCovered) : "—"}
            ok={verdictEmergencyMonths(monthsCovered) === "good"}
            okText={t.healthy}
            badText={t.attention}
            guidelineText={`${t.guideline}: 3 – 6 ${lang === "zh" ? "个月" : "months"}`}
          />

          <RatioRow
            label={t.solvencyRatio}
            value={baseline.solvency_ratio != null ? baseline.solvency_ratio * 100 : null}
            guidelineMax={100}
            valueLabel={baseline.solvency_ratio != null ? `${(baseline.solvency_ratio * 100).toFixed(1)}%` : "—"}
            ok={verdictSolvency(baseline.solvency_ratio) === "good"}
            okText={t.healthy}
            badText={t.attention}
            guidelineText={`${t.guideline}: ≥ 50%`}
          />
          <Footer label={t.reportTitle} />
        </Page>
      )}

      {/* --------------------------------------------------- Per-section pages */}
      {CFP_SECTION_ORDER.filter((st) => st !== "financial_health").map((sectionType) => {
        const section = sectionByType(data, sectionType);
        if (!section) return null;
        return (
          <SectionContentPage
            key={sectionType}
            sectionType={sectionType}
            content={section.content}
            lang={lang}
            t={t}
          />
        );
      })}

      {/* --------------------------------------- Overall Health + Timeline */}
      {financialHealth && (
        <Page size="A4" style={s.page}>
          <H1 text={t.overallHealthTitle} />

          <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 14 }} wrap={false}>
            <ScoreGauge score={financialHealth.content.health_score} size={90} label={t.healthScore} />
            <View style={{ flex: 1, marginLeft: 18, marginTop: 4 }}>
              <Text style={[s.small, { marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }]}>
                {t.scoreComponents}
              </Text>
              {(financialHealth.content.score_components ?? []).map((comp: any, i: number) => (
                <HBar
                  key={i}
                  label={SCORE_COMPONENT_LABEL[lang][comp.key] ?? comp.label_zh}
                  value={comp.score ?? 0}
                  max={100}
                  valueLabel={comp.score != null ? `${Math.round(comp.score)}/100` : "—"}
                  labelWidth={92}
                />
              ))}
            </View>
          </View>

          <Text style={s.h2}>{t.overallAssessment}</Text>
          <Text style={s.para}>{financialHealth.content.overall_assessment}</Text>

          {financialHealth.content.wealth_freedom && (
            <View style={[s.ratioCard, { marginBottom: 14 }]} wrap={false}>
              <Text style={s.ratioLabel}>
                {t.wealthFreedomStage}: {t.stageOf.replace("{n}", String(financialHealth.content.wealth_freedom.stage ?? "—"))}
              </Text>
              <View style={{ marginTop: 9, marginBottom: 2 }}>
                <StageTrack
                  stage={financialHealth.content.wealth_freedom.stage}
                  labels={lang === "zh" ? ["起步", "积累", "财务独立", "财务自由"] : ["Starting", "Accumulating", "Independent", "Free"]}
                />
              </View>
              <Text style={[s.small, { marginTop: 8 }]}>
                {t.passiveIncome}: {fmtRM(financialHealth.content.wealth_freedom.passive_income_monthly)} · {t.monthlyExpensesLabel}: {fmtRM(financialHealth.content.wealth_freedom.monthly_expenses)}
              </Text>
              {financialHealth.content.wealth_freedom.next_stage_gap_monthly > 0 && (
                <Text style={[s.small, { marginTop: 2 }]}>{t.nextStageGap}: {fmtRM(financialHealth.content.wealth_freedom.next_stage_gap_monthly)}</Text>
              )}
            </View>
          )}

          <Text style={s.h2}>{t.budgetWaterfall}</Text>
          {(() => {
            const lines = financialHealth.content.budget?.lines ?? [];
            const max = Math.max(financialHealth.content.budget?.annual_surplus ?? 0, ...lines.map((l: any) => l.allocated_annual), 1);
            return lines.map((line: any) => (
              <View key={line.key} style={{ marginBottom: 3 }} wrap={false}>
                <HBar
                  label={lang === "zh" ? line.label_zh : line.label_en}
                  value={line.allocated_annual}
                  max={max}
                  valueLabel={fmtRM(line.allocated_annual)}
                  highlight={line.key === "wealth"}
                />
                {line.deferred_annual > 0 && (
                  <Text style={{ fontSize: 7.5, color: STATUS.warn.fg, marginLeft: 116, marginBottom: 3 }}>
                    {t.deferredNote}: {fmtRM(line.deferred_annual)}
                  </Text>
                )}
              </View>
            ));
          })()}

          <Text style={s.h2}>{t.priorityPlan}</Text>
          <Text style={s.para}>{financialHealth.content.priority_plan}</Text>

          <PhaseTimeline
            phases={(financialHealth.content.budget?.lines ?? []).map((line: any, i: number) => ({
              title: `${t.phase} ${i + 1} — ${lang === "zh" ? line.label_zh : line.label_en}`,
              allocatedLabel: `${t.allocated}: ${fmtRM(line.allocated_annual)} / ${lang === "zh" ? "年" : "yr"}`,
              deferredLabel: line.deferred_annual > 0 ? `${t.deferredNote}: ${fmtRM(line.deferred_annual)}` : undefined,
            }))}
          />
          <Footer label={t.reportTitle} />
        </Page>
      )}

      {/* -------------------------------------------------------------- Back */}
      <Page size="A4" style={s.coverPage}>
        <View style={[s.coverInner, { justifyContent: "center" }]}>
          <View style={s.coverGoldRule} />
          <Text style={s.wordmark}>XinWealth</Text>
          <Text style={[s.coverTitle, { marginTop: 16 }]}>{t.questions}</Text>
          <View style={s.coverDivider} />
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaLabel}>{t.preparedBy}</Text>
            <Text style={s.coverMetaValue}>{data.advisorName || "—"}</Text>
          </View>
          {!!data.advisorEmail && (
            <View style={s.coverMetaRow}>
              <Text style={s.coverMetaLabel}>Email</Text>
              <Text style={s.coverMetaValue}>{data.advisorEmail}</Text>
            </View>
          )}
          <View style={s.coverFooter}>
            <View style={{ width: 40, height: 2, backgroundColor: C.gold, marginBottom: 8 }} />
            <Text style={s.coverConfidential}>{t.confidential}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// -------------------------------------------------------- per-section extras
// Small "at a glance" visual block rendered before the narrative prose on a
// section content page — pulls straight from the deterministic fields that
// sit alongside each module's narrative on `content` (cna / goals /
// capital_needed / current_allocation), independent of whether client_view
// prose has been generated yet.
// deno-lint-ignore no-explicit-any
function SectionExtras({
  sectionType, content, lang, t,
}: { sectionType: CfpSectionType; content: any; lang: CfpReportLanguage; t: (typeof LABELS)["en"] }) {
  if (sectionType === "insurance_planning" && content.cna) {
    const gaps: any[] = content.cna.gaps ?? [];
    const lifeGap = gaps.find((g) => g.key === "life" && !g.flag_only);
    const ciGap = gaps.find((g) => g.key === "ci" && !g.flag_only);
    const medicalGap = gaps.find((g) => g.key === "medical");
    if (!lifeGap && !ciGap && !medicalGap) return null;
    return (
      <View style={s.extrasBlock}>
        {lifeGap && (
          <CoverageBar label={lifeGap.label} need={lifeGap.need ?? 0} covered={lifeGap.covered ?? 0} gap={lifeGap.gap ?? 0} fmtRM={fmtRM} lang={lang} />
        )}
        {ciGap && (
          <CoverageBar label={ciGap.label} need={ciGap.need ?? 0} covered={ciGap.covered ?? 0} gap={ciGap.gap ?? 0} fmtRM={fmtRM} lang={lang} />
        )}
        {medicalGap && (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }} wrap={false}>
            <Text style={{ fontSize: 9, color: C.blue, marginRight: 8 }}>{medicalGap.label}</Text>
            <VerdictChip ok={!!medicalGap.has_cover} textOk={t.hasCover} textBad={t.noCover} />
          </View>
        )}
      </View>
    );
  }

  if (sectionType === "goals_planning" && Array.isArray(content.goals) && content.goals.length > 0) {
    return (
      <View style={s.extrasBlock}>
        {content.goals.map((g: any, i: number) => {
          const pct = g.future_cost > 0 ? Math.max(0, Math.min(100, (g.projected_savings / g.future_cost) * 100)) : 0;
          return (
            <View key={i} style={{ marginBottom: 10 }} wrap={false}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <Text style={{ fontSize: 9, color: C.blue, flex: 1, paddingRight: 8, maxLines: 1, textOverflow: "ellipsis" }}>
                  {(g.name || g.goal_type)} · {g.target_year}
                </Text>
                <VerdictChip ok={!!g.on_track} textOk={t.onTrack} textBad={t.notOnTrack} />
              </View>
              <Meter pct={pct} band={g.on_track ? "good" : "bad"} height={6} />
              <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 3 }}>
                {fmtRM(g.projected_savings)} / {fmtRM(g.future_cost)}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  if (sectionType === "retirement_planning" && content.capital_needed != null) {
    return (
      <View style={s.extrasBlock} wrap={false}>
        <CoverageBar
          label={`${t.capitalNeeded} / ${t.totalProjected}`}
          need={content.capital_needed}
          covered={content.total_projected ?? 0}
          gap={content.gap ?? 0}
          fmtRM={fmtRM}
          lang={lang}
        />
        <View style={{ flexDirection: "row", marginTop: 4 }}>
          <View style={{ marginRight: 8 }}>
            <VerdictChip ok={!!content.survives_to_85} textOk={t.survives85} textBad={t.depletes85} />
          </View>
          <VerdictChip ok={!!content.survives_to_100} textOk={t.survives100} textBad={t.depletes100} />
        </View>
      </View>
    );
  }

  if (sectionType === "investment_planning" && Array.isArray(content.current_allocation) && content.current_allocation.length > 0) {
    const rows = content.current_allocation as Array<{ bucket: string; amount: number; pct: number | null }>;
    const max = Math.max(...rows.map((r) => r.amount), 1);
    return (
      <View style={s.extrasBlock}>
        <Text style={[s.small, { marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }]}>{t.currentAllocation}</Text>
        {rows.map((r, i) => (
          <HBar
            key={i}
            label={ALLOCATION_BUCKET_LABEL[lang][r.bucket] ?? r.bucket}
            value={r.amount}
            max={max}
            valueLabel={r.pct != null ? `${r.pct.toFixed(0)}%` : fmtRM(r.amount)}
          />
        ))}
      </View>
    );
  }

  return null;
}

// ------------------------------------------------------------ section page
function SectionContentPage({
  sectionType, content, lang, t,
}: {
  sectionType: CfpSectionType;
  // deno-lint-ignore no-explicit-any
  content: any;
  lang: CfpReportLanguage;
  t: (typeof LABELS)["en"];
}) {
  const meta = SECTION_META[sectionType];
  const cv = content.client_view;
  const isInsuranceShape = !!cv && "data_gathering_intro" in cv;
  const isGenericShape = !!cv && "intro" in cv && "findings_plain" in cv;

  return (
    <Page size="A4" style={s.page} wrap>
      <View style={s.sectionHeader} wrap={false}>
        <View style={s.sectionIconWrap}>
          <SectionIcon type={sectionType} size={20} color={C.blue} />
        </View>
        <View>
          <Text style={s.sectionTitleZh}>{meta.zh} · {meta.en}</Text>
          <Text style={s.sectionPersona}>{meta.personaZh}</Text>
        </View>
      </View>
      <View style={[s.h1Rule, { marginTop: 8, marginBottom: 12 }]} />

      <SectionExtras sectionType={sectionType} content={content} lang={lang} t={t} />

      {isInsuranceShape ? (
        <>
          {!!cv.data_gathering_intro && <Text style={s.intro}>{cv.data_gathering_intro}</Text>}
          {!!cv.finding_intro && <Text style={s.para}>{cv.finding_intro}</Text>}
          {!!cv.gap_analysis_plain && (
            <>
              <Text style={s.h2}>{t.findings}</Text>
              <Text style={s.para}>{cv.gap_analysis_plain}</Text>
            </>
          )}
          {(cv.coverage_review_plain ?? []).length > 0 && (
            <>
              <Text style={s.h2}>{lang === "zh" ? "保障评估" : "Coverage Review"}</Text>
              {cv.coverage_review_plain.map((c: any, i: number) => (
                <View style={s.bulletCard} key={i} wrap={false}>
                  <Text style={s.bulletTitle}>{c.category}</Text>
                  <Text style={s.bulletBody}>{c.plain}</Text>
                </View>
              ))}
            </>
          )}
          {(cv.scenarios_plain ?? []).length > 0 && (
            <>
              <Text style={s.h2}>{lang === "zh" ? "真实生活场景" : "Real-Life Scenarios"}</Text>
              {cv.scenarios_plain.map((sc: any, i: number) => (
                <View style={s.bulletCard} key={i} wrap={false}>
                  <Text style={s.bulletTitle}>{sc.title}</Text>
                  <Text style={s.bulletBody}>{sc.plain}</Text>
                </View>
              ))}
            </>
          )}
          {!!cv.recommendation_intro && <Text style={s.para}>{cv.recommendation_intro}</Text>}
          {(cv.recommendations_plain ?? []).length > 0 && (
            <>
              <Text style={s.h2}>{t.recommendations}</Text>
              {cv.recommendations_plain.map((r: any, i: number) => (
                <View style={s.bulletCard} key={i} wrap={false}>
                  <Text style={s.bulletTitle}>{r.title}</Text>
                  <Text style={s.bulletBody}>{r.plain}</Text>
                </View>
              ))}
            </>
          )}
          <GlossaryAndDisclaimer glossary={cv.glossary} disclaimer={cv.disclaimer} t={t} />
        </>
      ) : isGenericShape ? (
        <>
          {!!cv.intro && <Text style={s.intro}>{cv.intro}</Text>}
          {(cv.findings_plain ?? []).length > 0 && (
            <>
              <Text style={s.h2}>{t.findings}</Text>
              {cv.findings_plain.map((f: any, i: number) => (
                <View style={s.bulletCard} key={i} wrap={false}>
                  <Text style={s.bulletTitle}>{f.title}</Text>
                  <Text style={s.bulletBody}>{f.plain}</Text>
                </View>
              ))}
            </>
          )}
          {(cv.recommendations_plain ?? []).length > 0 && (
            <>
              <Text style={s.h2}>{t.recommendations}</Text>
              {cv.recommendations_plain.map((r: any, i: number) => (
                <View style={s.bulletCard} key={i} wrap={false}>
                  <Text style={s.bulletTitle}>{r.title}</Text>
                  <Text style={s.bulletBody}>{r.plain}</Text>
                </View>
              ))}
            </>
          )}
          <GlossaryAndDisclaimer glossary={cv.glossary} disclaimer={cv.disclaimer} t={t} />
        </>
      ) : (
        <FallbackNarrative sectionType={sectionType} content={content} lang={lang} t={t} />
      )}

      <Footer label={t.reportTitle} />
    </Page>
  );
}

function GlossaryAndDisclaimer({
  glossary, disclaimer, t,
}: { glossary?: Array<{ term: string; plain: string }>; disclaimer?: string; t: (typeof LABELS)["en"] }) {
  return (
    <>
      {(glossary ?? []).length > 0 && (
        <>
          <Text style={s.h2}>{t.glossary}</Text>
          {glossary!.map((g, i) => (
            <View style={s.glRow} key={i} wrap={false}>
              <Text style={[s.glTerm, { maxLines: 2, textOverflow: "ellipsis" }]}>{g.term}</Text>
              <Text style={s.glDef}>{g.plain}</Text>
            </View>
          ))}
        </>
      )}
      {!!disclaimer && <Text style={s.disclaimer}>{disclaimer}</Text>}
    </>
  );
}

// deno-lint-ignore no-explicit-any
function FallbackNarrative({ sectionType, content, lang, t }: { sectionType: CfpSectionType; content: any; lang: CfpReportLanguage; t: (typeof LABELS)["en"] }) {
  const fields = NARRATIVE_FIELDS[sectionType] ?? [];
  return (
    <>
      {!!content.executive_summary?.findings && (
        <>
          <Text style={s.h2}>{t.findings}</Text>
          <Text style={s.para}>{content.executive_summary.findings}</Text>
        </>
      )}

      {fields.map((f) => (
        content[f.key] ? (
          <React.Fragment key={f.key}>
            <Text style={s.h2}>{lang === "zh" ? f.zh : f.en}</Text>
            <Text style={s.para}>{content[f.key]}</Text>
          </React.Fragment>
        ) : null
      ))}

      {sectionType === "goals_planning" && (content.goals ?? []).length > 0 && (
        <>
          <Text style={s.h2}>{lang === "zh" ? "目标详情" : "Goal Details"}</Text>
          {content.goals.map((g: any, i: number) => (
            <View style={s.bulletCard} key={i} wrap={false}>
              <Text style={s.bulletTitle}>{g.goal_type} · {g.target_year}</Text>
              <Text style={s.bulletBody}>{g.commentary}</Text>
            </View>
          ))}
        </>
      )}

      {sectionType === "insurance_planning" && (content.coverage_review ?? []).length > 0 && (
        <>
          <Text style={s.h2}>{lang === "zh" ? "保障评估" : "Coverage Review"}</Text>
          {content.coverage_review.map((c: any, i: number) => (
            <View style={s.bulletCard} key={i} wrap={false}>
              <Text style={s.bulletTitle}>{c.category} — {c.level}</Text>
              <Text style={s.bulletBody}>{c.commentary}</Text>
            </View>
          ))}
        </>
      )}
      {sectionType === "insurance_planning" && (content.scenarios ?? []).length > 0 && (
        <>
          <Text style={s.h2}>{lang === "zh" ? "真实生活场景" : "Real-Life Scenarios"}</Text>
          {content.scenarios.map((sc: any, i: number) => (
            <View style={s.bulletCard} key={i} wrap={false}>
              <Text style={s.bulletTitle}>{sc.title}</Text>
              <Text style={s.bulletBody}>{[sc.trigger, sc.life_impact, sc.protection_response].filter(Boolean).join(" ")}</Text>
            </View>
          ))}
        </>
      )}

      {(content.recommendations ?? []).length > 0 && (
        <>
          <Text style={s.h2}>{t.recommendations}</Text>
          {content.recommendations
            .slice()
            .sort((a: any, b: any) => a.priority - b.priority)
            .map((r: any, i: number) => (
              <View style={s.bulletCard} key={i} wrap={false}>
                <Text style={s.bulletTitle}>{r.priority}. {r.title}</Text>
                <Text style={s.bulletBody}>{r.detail}</Text>
              </View>
            ))}
        </>
      )}

      {!!content.disclaimer && <Text style={s.disclaimer}>{content.disclaimer}</Text>}
      {(content.assumptions ?? []).length > 0 && (
        <Text style={[s.small, { marginTop: 6 }]}>{t.assumptions}: {content.assumptions.join(" · ")}</Text>
      )}
    </>
  );
}
