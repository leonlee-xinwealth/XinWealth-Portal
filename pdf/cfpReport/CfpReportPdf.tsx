// Client-facing unified CFP report PDF — Cover -> Disclaimer -> Executive
// Summary -> Personal Info -> Cash Flow -> Balance Sheet -> Financial Ratios
// -> one page per generated section -> Overall Health & Timeline -> Back
// page. Reuses the insurance report's font registration and design tokens
// (pdf/insuranceReport/{fonts,theme}.ts) so both client PDFs read as one
// visual family. Content shapes vary per cfp-brain module (see
// supabase/functions/cfp-brain/modules/*/section.ts) — this file branches on
// `section_type` rather than assuming one narrative shape.
import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { registerFonts } from "../insuranceReport/fonts";
import { C, STATUS, type Band } from "../insuranceReport/theme";
import { CFP_SECTION_ORDER, SECTION_META, type CfpSectionType } from "../../components/advisor/cfp/sectionMeta";
import {
  fmtRM, LABELS, DISCLAIMER_EN, DISCLAIMER_ZH,
  buildExecSummaryRows, sectionByType, NARRATIVE_FIELDS,
  verdictSavings, verdictDebtService, verdictEmergencyMonths, verdictSolvency,
} from "./model";
import type { CfpReportData, CfpReportLanguage } from "./types";

registerFonts();

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
  sectionEmoji: { fontSize: 16, marginRight: 8 },
  sectionTitleZh: { color: C.blue, fontSize: 16 },
  sectionTitleEn: { color: C.muted, fontSize: 9, marginTop: 2 },
  sectionPersona: { color: C.gold, fontSize: 9, marginTop: 2 },

  tHead: { flexDirection: "row", backgroundColor: C.blue, borderTopLeftRadius: 5, borderTopRightRadius: 5, paddingVertical: 5 },
  th: { fontSize: 7.5, color: C.white, paddingHorizontal: 5 },
  tRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.line },
  td: { fontSize: 8.5, color: C.text, paddingHorizontal: 5 },
  tTotal: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 5, backgroundColor: C.bg, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },

  kvRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.line },
  kvLabel: { width: 150, fontSize: 9, color: C.muted },
  kvValue: { flex: 1, fontSize: 9.5, color: C.text },

  ratioCard: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 8 },
  ratioTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  ratioLabel: { fontSize: 10, color: C.blue },
  ratioVal: { fontSize: 13, color: C.text, marginBottom: 2 },
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

  phaseCard: { flexDirection: "row", borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 7 },
  phaseBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", marginRight: 9 },
  phaseBadgeNum: { color: C.gold, fontSize: 10 },
  phaseTitle: { color: C.blue, fontSize: 10.5, marginBottom: 2 },
  phaseSub: { fontSize: 9, color: C.text },

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
        <Text style={[s.para, { color: C.muted, fontStyle: "italic" }]}>{t.disclaimerConsult}</Text>
        <Footer label={t.reportTitle} />
      </Page>

      {/* --------------------------------------------------- Executive Summary */}
      <Page size="A4" style={s.page}>
        <H1 text={t.execSummaryTitle} />
        <View style={s.tHead}>
          <Text style={[s.th, { width: "18%" }]}>{t.colItems}</Text>
          <Text style={[s.th, { width: "27%" }]}>{t.colFindings}</Text>
          <Text style={[s.th, { width: "22%" }]}>{t.colActionPlan}</Text>
          <Text style={[s.th, { width: "15%" }]}>{t.colExpectedCompletion}</Text>
          <Text style={[s.th, { width: "18%" }]}>{t.colRemarks}</Text>
        </View>
        {execRows.map((row, i) => (
          <View style={[s.tRow, i % 2 === 1 ? { backgroundColor: C.bgAlt } : {}]} key={row.sectionType} wrap={false}>
            <View style={{ width: "18%", paddingHorizontal: 5 }}>
              <Text style={[s.td, { color: C.blue, paddingHorizontal: 0 }]}>{row.meta.emoji} {row.meta.zh}</Text>
              <Text style={[s.td, { fontSize: 7, color: C.faint, paddingHorizontal: 0 }]}>{row.meta.en}</Text>
            </View>
            {row.generated ? (
              <>
                <Text style={[s.td, { width: "27%" }]}>{row.findings}</Text>
                <Text style={[s.td, { width: "22%" }]}>{row.actionPlan}</Text>
                <Text style={[s.td, { width: "15%" }]}>{row.expectedCompletion}</Text>
                <Text style={[s.td, { width: "18%" }]}>{row.remarks}</Text>
              </>
            ) : (
              <Text style={[s.td, { width: "82%", color: C.faint, fontStyle: "italic" }]}>
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

          <Text style={s.h2}>{t.income}</Text>
          <View style={s.tHead}>
            <Text style={[s.th, { width: "70%" }]}>{t.colItems}</Text>
            <Text style={[s.th, { width: "30%", textAlign: "right" }]}>RM / {lang === "zh" ? "月" : "mo"}</Text>
          </View>
          {(cashflow.content.income_breakdown ?? []).map((row: any, i: number) => (
            <View style={[s.tRow, i % 2 === 1 ? { backgroundColor: C.bgAlt } : {}]} key={i} wrap={false}>
              <Text style={[s.td, { width: "70%" }]}>{row.category}</Text>
              <Text style={[s.td, { width: "30%", textAlign: "right" }]}>{fmtRM(row.monthly_amount)}</Text>
            </View>
          ))}
          <View style={s.tTotal}>
            <Text style={[s.td, { flex: 1, textAlign: "right", color: C.blue }]}>{t.totalIncome}</Text>
            <Text style={[s.td, { width: "30%", textAlign: "right", color: C.blue }]}>{fmtRM(cashflow.content.monthly_income)}</Text>
          </View>

          <Text style={s.h2}>{t.expenses}</Text>
          <View style={s.tHead}>
            <Text style={[s.th, { width: "70%" }]}>{t.colItems}</Text>
            <Text style={[s.th, { width: "30%", textAlign: "right" }]}>RM / {lang === "zh" ? "月" : "mo"}</Text>
          </View>
          {(cashflow.content.expense_breakdown ?? []).map((row: any, i: number) => (
            <View style={[s.tRow, i % 2 === 1 ? { backgroundColor: C.bgAlt } : {}]} key={i} wrap={false}>
              <Text style={[s.td, { width: "70%" }]}>{row.category}</Text>
              <Text style={[s.td, { width: "30%", textAlign: "right" }]}>{fmtRM(row.monthly_amount)}</Text>
            </View>
          ))}
          <View style={s.tTotal}>
            <Text style={[s.td, { flex: 1, textAlign: "right", color: C.blue }]}>{t.totalExpenses}</Text>
            <Text style={[s.td, { width: "30%", textAlign: "right", color: C.blue }]}>{fmtRM(cashflow.content.monthly_expenses)}</Text>
          </View>

          <View style={[s.ratioCard, { marginTop: 10 }]} wrap={false}>
            <View style={s.ratioTop}>
              <Text style={s.ratioLabel}>{t.netCashflow}</Text>
              <VerdictPill
                band={cashflow.content.monthly_surplus >= 0 ? "good" : "bad"}
                text={fmtRM(cashflow.content.monthly_surplus)}
              />
            </View>
          </View>
          <Footer label={t.reportTitle} />
        </Page>
      )}

      {/* ---------------------------------------------------- Balance Sheet */}
      <Page size="A4" style={s.page}>
        <H1 text={t.balanceSheetTitle} />
        <Text style={s.intro}>{t.balanceSheetIntro}</Text>

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
              <Text style={[s.td, { width: "55%" }]}>{a.name}</Text>
              <Text style={[s.td, { width: "25%" }]}>{a.asset_type}</Text>
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
              <Text style={[s.td, { width: "55%" }]}>{l.name}</Text>
              <Text style={[s.td, { width: "25%" }]}>{l.liability_type}</Text>
              <Text style={[s.td, { width: "20%", textAlign: "right" }]}>{fmtRM(l.outstanding_balance)}</Text>
            </View>
          ))
        )}
        <View style={s.tTotal}>
          <Text style={[s.td, { flex: 1, textAlign: "right", color: C.blue }]}>{t.totalLiabilities}</Text>
          <Text style={[s.td, { width: "20%", textAlign: "right", color: C.blue }]}>{fmtRM(totalLiabilities)}</Text>
        </View>

        <View style={[s.ratioCard, { marginTop: 10 }]} wrap={false}>
          <View style={s.ratioTop}>
            <Text style={s.ratioLabel}>{t.netWorth}</Text>
            <VerdictPill band={netWorth >= 0 ? "good" : "bad"} text={fmtRM(netWorth)} />
          </View>
        </View>
        <Footer label={t.reportTitle} />
      </Page>

      {/* ------------------------------------------------------ Financial Ratios */}
      {baseline && (
        <Page size="A4" style={s.page}>
          <H1 text={t.ratiosTitle} />

          {financialHealth && financialHealth.content.health_score != null && (
            <View style={[s.ratioCard, { alignItems: "center", marginBottom: 14 }]} wrap={false}>
              <Text style={s.small}>{t.healthScore}</Text>
              <Text style={{ fontSize: 34, color: C.blue, marginTop: 2 }}>{Math.round(financialHealth.content.health_score)}</Text>
            </View>
          )}

          <View style={s.ratioCard} wrap={false}>
            <View style={s.ratioTop}>
              <Text style={s.ratioLabel}>{t.savingsRatio}</Text>
              <VerdictPill band={verdictSavings(baseline.savings_ratio)} text={verdictSavings(baseline.savings_ratio) === "good" ? t.healthy : t.attention} />
            </View>
            <Text style={s.ratioVal}>{baseline.savings_ratio != null ? `${(baseline.savings_ratio * 100).toFixed(1)}%` : "—"}</Text>
            <Text style={s.ratioGuide}>{t.guideline}: ≥ 20%</Text>
          </View>

          <View style={s.ratioCard} wrap={false}>
            <View style={s.ratioTop}>
              <Text style={s.ratioLabel}>{t.debtServiceRatio}</Text>
              <VerdictPill band={verdictDebtService(baseline.debt_service_ratio)} text={verdictDebtService(baseline.debt_service_ratio) === "good" ? t.healthy : t.attention} />
            </View>
            <Text style={s.ratioVal}>{baseline.debt_service_ratio != null ? `${(baseline.debt_service_ratio * 100).toFixed(1)}%` : "—"}</Text>
            <Text style={s.ratioGuide}>{t.guideline}: ≤ 35%</Text>
          </View>

          <View style={s.ratioCard} wrap={false}>
            <View style={s.ratioTop}>
              <Text style={s.ratioLabel}>{t.emergencyMonths}</Text>
              <VerdictPill band={verdictEmergencyMonths(monthsCovered)} text={verdictEmergencyMonths(monthsCovered) === "good" ? t.healthy : t.attention} />
            </View>
            <Text style={s.ratioVal}>{monthsCovered != null ? monthsCovered : "—"}</Text>
            <Text style={s.ratioGuide}>{t.guideline}: 3 – 6 {lang === "zh" ? "个月" : "months"}</Text>
          </View>

          <View style={s.ratioCard} wrap={false}>
            <View style={s.ratioTop}>
              <Text style={s.ratioLabel}>{t.solvencyRatio}</Text>
              <VerdictPill band={verdictSolvency(baseline.solvency_ratio)} text={verdictSolvency(baseline.solvency_ratio) === "good" ? t.healthy : t.attention} />
            </View>
            <Text style={s.ratioVal}>{baseline.solvency_ratio != null ? `${(baseline.solvency_ratio * 100).toFixed(1)}%` : "—"}</Text>
            <Text style={s.ratioGuide}>{t.guideline}: ≥ 50%</Text>
          </View>
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
          <Text style={s.h2}>{t.overallAssessment}</Text>
          <Text style={s.para}>{financialHealth.content.overall_assessment}</Text>

          {financialHealth.content.wealth_freedom && (
            <View style={[s.ratioCard, { marginBottom: 12 }]} wrap={false}>
              <Text style={s.ratioLabel}>
                {t.wealthFreedomStage}: {t.stageOf.replace("{n}", String(financialHealth.content.wealth_freedom.stage ?? "—"))}
              </Text>
              <Text style={[s.small, { marginTop: 4 }]}>
                {t.passiveIncome}: {fmtRM(financialHealth.content.wealth_freedom.passive_income_monthly)} · {t.monthlyExpensesLabel}: {fmtRM(financialHealth.content.wealth_freedom.monthly_expenses)}
              </Text>
              {financialHealth.content.wealth_freedom.next_stage_gap_monthly > 0 && (
                <Text style={[s.small, { marginTop: 2 }]}>{t.nextStageGap}: {fmtRM(financialHealth.content.wealth_freedom.next_stage_gap_monthly)}</Text>
              )}
            </View>
          )}

          <Text style={s.h2}>{t.priorityPlan}</Text>
          <Text style={s.para}>{financialHealth.content.priority_plan}</Text>

          {(financialHealth.content.budget?.lines ?? []).map((line: any, i: number) => (
            <View style={s.phaseCard} key={line.key} wrap={false}>
              <View style={s.phaseBadge}><Text style={s.phaseBadgeNum}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.phaseTitle}>{t.phase} {i + 1} — {lang === "zh" ? line.label_zh : line.label_en}</Text>
                <Text style={s.phaseSub}>{t.allocated}: {fmtRM(line.allocated_annual)} / {lang === "zh" ? "年" : "yr"}</Text>
                {line.deferred_annual > 0 && (
                  <Text style={[s.phaseSub, { color: STATUS.warn.fg, marginTop: 2 }]}>{t.deferredNote}: {fmtRM(line.deferred_annual)}</Text>
                )}
              </View>
            </View>
          ))}
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
        <Text style={s.sectionEmoji}>{meta.emoji}</Text>
        <View>
          <Text style={s.sectionTitleZh}>{meta.zh} · {meta.en}</Text>
          <Text style={s.sectionPersona}>{meta.personaZh}</Text>
        </View>
      </View>
      <View style={[s.h1Rule, { marginTop: 8, marginBottom: 12 }]} />

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
              <Text style={s.glTerm}>{g.term}</Text>
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
