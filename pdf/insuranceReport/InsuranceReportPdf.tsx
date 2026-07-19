// Client-facing Insurance Planning PDF — a visual, paged advisory deliverable.
// Cover → Snapshot dashboard → Data Gathering → Finding → Recommendation.
// Data-viz (ring gauge, meters, rating segments) and a consistent SVG icon set
// replace walls of text. Hierarchy uses colour + size + a gold rule; status
// always pairs colour with an icon + word (dataviz + impeccable rules).
import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { registerFonts } from "./fonts";
import { fmtRM, type ReportViewModel } from "./buildReportModel";
import { C, STATUS, bandForPct, bandForLevel, type Band } from "./theme";
import {
  Icon, RingGauge, Meter, SegmentMeter, StatTile, type IconName,
} from "./charts";

registerFonts();

const s = StyleSheet.create({
  // Cover
  coverPage: { fontFamily: "NotoSansSC", backgroundColor: C.blue },
  coverInner: { flex: 1, padding: 52, position: "relative" },
  coverGoldRule: { width: 60, height: 3, backgroundColor: C.gold, marginBottom: 18 },
  wordmark: { color: C.white, fontSize: 30, letterSpacing: 1 },
  coverKicker: { color: C.goldLight, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginTop: 26 },
  coverTitle: { color: C.white, fontSize: 30, marginTop: 6, lineHeight: 1.2 },
  coverDivider: { height: 1, backgroundColor: "#22405E", marginTop: 26, marginBottom: 20 },
  coverMetaRow: { flexDirection: "row", marginBottom: 8 },
  coverMetaLabel: { width: 120, color: C.goldLight, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 },
  coverMetaValue: { flex: 1, color: C.white, fontSize: 12 },
  coverFooter: { position: "absolute", left: 52, right: 52, bottom: 44 },
  coverConfidential: { color: "#8FA6BC", fontSize: 8 },

  // Content pages
  page: {
    fontFamily: "NotoSansSC", fontSize: 10, color: C.text, lineHeight: 1.5,
    paddingTop: 42, paddingBottom: 52, paddingHorizontal: 44,
  },
  partHeader: { flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 10 },
  partIconWrap: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: "#F3EEE4",
    alignItems: "center", justifyContent: "center", marginRight: 9,
  },
  partNum: { color: C.gold, fontSize: 10, marginRight: 6 },
  partTitle: { color: C.blue, fontSize: 16 },
  partRule: { height: 1, backgroundColor: C.line, marginTop: 8, marginBottom: 12 },

  sectionLabel: {
    color: C.blue, fontSize: 11, borderLeftWidth: 3, borderLeftColor: C.gold,
    paddingLeft: 6, marginTop: 14, marginBottom: 8,
  },
  intro: { color: C.text, fontSize: 10.5, marginBottom: 6, lineHeight: 1.55 },
  para: { color: C.text, fontSize: 10, lineHeight: 1.55 },

  // Snapshot
  snapWrap: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  snapTiles: { flex: 1, marginLeft: 16 },
  snapTileRow: { flexDirection: "row", marginBottom: 8 },
  covStrip: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 6 },
  covStripRow: { flexDirection: "row", flexWrap: "wrap" },
  covChip: { width: "33.33%", flexDirection: "row", alignItems: "center", marginBottom: 6 },

  // Table
  tHead: { flexDirection: "row", backgroundColor: C.blue, borderTopLeftRadius: 5, borderTopRightRadius: 5, paddingVertical: 5 },
  th: { fontSize: 8, color: C.white, paddingHorizontal: 6 },
  tRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.line },
  td: { fontSize: 9, color: C.text, paddingHorizontal: 6 },
  tTotal: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, backgroundColor: C.bg, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },

  // Bullet / gap card
  gapCard: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 11, marginBottom: 8 },
  gapTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  gapLabel: { fontSize: 11, color: C.blue },
  pill: { flexDirection: "row", alignItems: "center", paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8 },
  pillText: { fontSize: 8, marginLeft: 3 },
  gapValues: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  gapValCol: { flexDirection: "column" },
  gapValLabel: { fontSize: 7.5, color: C.muted },
  gapValNum: { fontSize: 10, color: C.text },

  // Coverage rows
  covRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line },
  covLeft: { width: 150, paddingRight: 8 },
  covLabelLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  covCatLabel: { fontSize: 10, color: C.blue },
  covLevelWord: { fontSize: 8 },
  covPlain: { flex: 1, fontSize: 9.5, color: C.text, lineHeight: 1.5 },

  // Callout
  callout: { borderRadius: 8, padding: 11, marginTop: 4 },
  calloutRow: { flexDirection: "row" },

  // Scenario
  scCard: { flexDirection: "row", borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 7 },
  scIconWrap: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 9 },
  scTitle: { fontSize: 11, color: C.blue, marginBottom: 3 },

  // Recommendation
  recCard: { flexDirection: "row", borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 7 },
  recBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", marginRight: 9 },
  recBadgeNum: { color: C.gold, fontSize: 10 },
  recTitle: { color: C.blue, fontSize: 11, marginBottom: 2 },
  nextStrip: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginTop: 4, backgroundColor: C.bgAlt },
  nextRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  nextKey: { fontSize: 9, color: C.muted, width: 110, marginLeft: 6 },
  nextVal: { fontSize: 9.5, color: C.text, flex: 1 },

  // Glossary / footer
  glRow: { flexDirection: "row", marginBottom: 5 },
  glTerm: { width: 150, color: C.blue, fontSize: 9.5, paddingRight: 8 },
  glDef: { flex: 1, color: C.text, fontSize: 9 },
  disclaimer: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line, color: C.muted, fontSize: 8, lineHeight: 1.5 },
  footer: {
    position: "absolute", bottom: 22, left: 44, right: 44,
    flexDirection: "row", justifyContent: "space-between",
    color: C.faint, fontSize: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6,
  },
});

const StatusPill = ({ band, text }: { band: Band; text: string }) => {
  const st = STATUS[band];
  const icon: IconName = band === "good" ? "check" : band === "none" ? "warning" : "warning";
  return (
    <View style={[s.pill, { backgroundColor: st.softBg }]}>
      <Icon name={icon} size={9} color={st.fg} sw={1.8} />
      <Text style={[s.pillText, { color: st.fg }]}>{text}</Text>
    </View>
  );
};

const PartHeader = ({ num, title, icon }: { num: number; title: string; icon: IconName }) => (
  <View wrap={false}>
    <View style={s.partHeader}>
      <View style={s.partIconWrap}><Icon name={icon} size={14} color={C.goldDark} /></View>
      <Text style={s.partNum}>{num}</Text>
      <Text style={s.partTitle}>{title}</Text>
    </View>
    <View style={s.partRule} />
  </View>
);

const SCENARIO_ICON = (title: string): IconName => {
  const t = title.toLowerCase();
  if (/(death|die|passing|离世|身故|不幸)/.test(t)) return "shield";
  if (/(illness|cancer|critical|重疾|癌|病)/.test(t)) return "heart";
  if (/(disab|残|伤)/.test(t)) return "user";
  if (/(hospital|medical|住院|医)/.test(t)) return "cross";
  return "warning";
};

export default function InsuranceReportPdf({ model }: { model: ReportViewModel }) {
  const { meta, labels, snapshot, dataGathering, finding, recommendation, glossary, disclaimer } = model;
  const gaugeBand = bandForPct(snapshot.coveragePct);

  return (
    <Document title={`${labels.reportTitle} — ${meta.period}`}>
      {/* ---------------------------------------------------------- Cover */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverInner}>
          <View style={s.coverGoldRule} />
          <Text style={s.wordmark}>XinWealth</Text>
          <Text style={s.coverKicker}>{labels.reportTitle}</Text>
          <Text style={s.coverTitle}>{meta.period}</Text>
          <View style={s.coverDivider} />
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaLabel}>{labels.preparedFor}</Text>
            <Text style={s.coverMetaValue}>{meta.clientName || "—"}</Text>
          </View>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaLabel}>{labels.preparedBy}</Text>
            <Text style={s.coverMetaValue}>{meta.advisorName || "—"}</Text>
          </View>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaLabel}>{labels.generatedOn}</Text>
            <Text style={s.coverMetaValue}>{meta.generatedDate}</Text>
          </View>
          <View style={s.coverFooter}>
            <View style={{ width: 40, height: 2, backgroundColor: C.gold, marginBottom: 8 }} />
            <Text style={s.coverConfidential}>{labels.confidential}</Text>
          </View>
        </View>
      </Page>

      {/* ------------------------------------------------- Content pages */}
      <Page size="A4" style={s.page}>
        {/* Snapshot dashboard */}
        <View style={s.partHeader}>
          <View style={s.partIconWrap}><Icon name="target" size={14} color={C.goldDark} /></View>
          <Text style={s.partTitle}>{labels.snapshot}</Text>
        </View>
        <View style={s.partRule} />

        <View style={s.snapWrap}>
          <RingGauge pct={snapshot.coveragePct} band={gaugeBand} caption={labels.coveragePct} />
          <View style={s.snapTiles}>
            <View style={s.snapTileRow}>
              <StatTile icon="shield" label={labels.totalSumAssured} value={fmtRM(snapshot.totalSumAssured)} sub={`${snapshot.policyCount} ${labels.policies}`} />
              <View style={{ width: 8 }} />
              <StatTile icon="coins" label={labels.annualPremium} value={fmtRM(dataGathering.annualPremiumTotal)} />
            </View>
            <View style={[s.snapTileRow, { marginBottom: 0 }]}>
              <StatTile icon="doc" label={labels.premiumOfIncome} value={`${snapshot.premiumPctOfIncome}%`} />
              <View style={{ width: 8 }} />
              <StatTile icon="user" label={labels.dependents} value={String(snapshot.dependents)} />
            </View>
          </View>
        </View>

        {/* Coverage profile strip */}
        {finding.coverage.length > 0 && (
          <View style={s.covStrip}>
            <View style={s.covStripRow}>
              {finding.coverage.map((c, i) => {
                const band = bandForLevel(c.level);
                return (
                  <View style={s.covChip} key={i}>
                    <View style={{ marginRight: 5 }}>
                      <SegmentMeter score={c.score} band={band} width={9} height={6} gap={2} />
                    </View>
                    <Text style={{ fontSize: 8.5, color: C.text }}>{c.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* -------------------------------------------- Part 1: Data Gathering */}
        <PartHeader num={1} title={labels.part1Title} icon="clipboard" />
        {!!dataGathering.intro && <Text style={s.intro}>{dataGathering.intro}</Text>}

        <View style={s.tHead}>
          <Text style={[s.th, { width: "28%" }]}>{labels.provider}</Text>
          <Text style={[s.th, { width: "20%" }]}>{labels.policyType}</Text>
          <Text style={[s.th, { width: "20%", textAlign: "right" }]}>{labels.sumAssured}</Text>
          <Text style={[s.th, { width: "16%", textAlign: "right" }]}>{labels.cashValue}</Text>
          <Text style={[s.th, { width: "16%", textAlign: "right" }]}>{labels.annualPremium}</Text>
        </View>
        {dataGathering.policies.length === 0 ? (
          <View style={s.tRow}><Text style={[s.td, { width: "100%", textAlign: "center", color: C.faint }]}>{labels.noPolicies}</Text></View>
        ) : (
          dataGathering.policies.map((p, i) => (
            <View style={[s.tRow, i % 2 === 1 ? { backgroundColor: C.bgAlt } : {}]} key={i} wrap={false}>
              <Text style={[s.td, { width: "28%" }]}>{p.provider ?? "—"}</Text>
              <Text style={[s.td, { width: "20%" }]}>{p.policy_type}</Text>
              <Text style={[s.td, { width: "20%", textAlign: "right" }]}>{fmtRM(p.sum_assured)}</Text>
              <Text style={[s.td, { width: "16%", textAlign: "right" }]}>{fmtRM(p.cash_value)}</Text>
              <Text style={[s.td, { width: "16%", textAlign: "right" }]}>{fmtRM(p.annual_premium)}</Text>
            </View>
          ))
        )}
        <View style={s.tTotal}>
          <Text style={[s.td, { flex: 1, textAlign: "right", color: C.blue }]}>{labels.totalAnnualPremium}</Text>
          <Text style={[s.td, { width: "16%", textAlign: "right", color: C.blue }]}>{fmtRM(dataGathering.annualPremiumTotal)}</Text>
        </View>

        <View style={[s.snapTileRow, { marginTop: 10 }]}>
          {dataGathering.facts.map((f, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={{ width: 8 }} />}
              <StatTile label={f.label} value={f.value} />
            </React.Fragment>
          ))}
        </View>

        {/* -------------------------------------------------- Part 2: Finding */}
        <PartHeader num={2} title={labels.part2Title} icon="pulse" />
        {!!finding.intro && <Text style={s.intro}>{finding.intro}</Text>}

        {finding.gaps.map((g, i) => {
          const band: Band = g.sufficient ? "good" : g.coveredPct >= 50 ? "warn" : "bad";
          return (
            <View style={s.gapCard} key={i} wrap={false}>
              <View style={s.gapTop}>
                <Text style={s.gapLabel}>{g.label}</Text>
                <StatusPill band={band} text={g.sufficient ? labels.sufficient : `${labels.gap} ${fmtRM(g.gap)}`} />
              </View>
              <Meter pct={g.coveredPct} band={band} />
              <View style={s.gapValues}>
                <View style={s.gapValCol}>
                  <Text style={s.gapValLabel}>{labels.covered}</Text>
                  <Text style={s.gapValNum}>{fmtRM(g.covered)}</Text>
                </View>
                <View style={[s.gapValCol, { alignItems: "flex-end" }]}>
                  <Text style={s.gapValLabel}>{labels.need}</Text>
                  <Text style={s.gapValNum}>{fmtRM(g.need)}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {finding.medical && (
          <View style={[s.gapCard, { flexDirection: "row", alignItems: "center" }]} wrap={false}>
            <View style={{ marginRight: 8 }}>
              <Icon name="cross" size={16} color={finding.medical.hasCover ? STATUS.good.fill : STATUS.bad.fill} />
            </View>
            <Text style={{ fontSize: 10, color: finding.medical.hasCover ? STATUS.good.fg : STATUS.bad.fg }}>
              {finding.medical.hasCover ? labels.hasMedical : labels.noMedical}
            </Text>
          </View>
        )}

        {/* Coverage review as rating rows */}
        <Text style={s.sectionLabel}>{labels.coverageReview}</Text>
        {finding.coverage.map((c, i) => {
          const band = bandForLevel(c.level);
          return (
            <View style={s.covRow} key={i} wrap={false}>
              <View style={s.covLeft}>
                <View style={s.covLabelLine}>
                  <Text style={s.covCatLabel}>{c.label}</Text>
                  <Text style={[s.covLevelWord, { color: STATUS[band].fg }]}>{c.level}</Text>
                </View>
                <SegmentMeter score={c.score} band={band} />
              </View>
              <Text style={s.covPlain}>{c.plain}</Text>
            </View>
          );
        })}

        {/* Gap analysis callout */}
        <Text style={s.sectionLabel}>{labels.gapAnalysis}</Text>
        <View style={[s.callout, { backgroundColor: STATUS[gaugeBand].softBg }]}>
          <View style={s.calloutRow}>
            <View style={{ marginRight: 8, marginTop: 1 }}>
              <Icon name="warning" size={13} color={STATUS[gaugeBand].fg} />
            </View>
            <Text style={[s.para, { flex: 1 }]}>{finding.gapAnalysis}</Text>
          </View>
        </View>

        {/* Scenarios */}
        {finding.scenarios.length > 0 && (
          <>
            <Text style={s.sectionLabel}>{labels.scenarios}</Text>
            {finding.scenarios.map((sc, i) => (
              <View style={s.scCard} key={i} wrap={false}>
                <View style={[s.scIconWrap, { backgroundColor: STATUS.warn.softBg }]}>
                  <Icon name={SCENARIO_ICON(sc.title)} size={14} color={STATUS.warn.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.scTitle}>{sc.title}</Text>
                  <Text style={s.para}>{sc.plain}</Text>
                </View>
              </View>
            ))}
          </>
        )}
        {finding.assumptions.length > 0 && (
          <Text style={{ color: C.faint, fontSize: 7.5, marginTop: 6 }}>
            {labels.assumptions}: {finding.assumptions.join(" · ")}
          </Text>
        )}

        {/* --------------------------------------- Part 3: Recommendation */}
        <PartHeader num={3} title={labels.part3Title} icon="bulb" />
        {!!recommendation.intro && <Text style={s.intro}>{recommendation.intro}</Text>}
        {recommendation.items.map((r, i) => (
          <View style={s.recCard} key={i} wrap={false}>
            <View style={s.recBadge}><Text style={s.recBadgeNum}>{r.priority}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.recTitle}>{r.title}</Text>
              <Text style={s.para}>{r.plain}</Text>
            </View>
          </View>
        ))}
        {(!!recommendation.actionPlan || !!recommendation.expectedCompletion) && (
          <View style={s.nextStrip} wrap={false}>
            {!!recommendation.actionPlan && (
              <View style={s.nextRow}>
                <Icon name="arrow" size={12} color={C.goldDark} />
                <Text style={s.nextKey}>{labels.actionPlan}</Text>
                <Text style={s.nextVal}>{recommendation.actionPlan}</Text>
              </View>
            )}
            {!!recommendation.expectedCompletion && (
              <View style={[s.nextRow, { marginBottom: 0 }]}>
                <Icon name="target" size={12} color={C.goldDark} />
                <Text style={s.nextKey}>{labels.expectedCompletion}</Text>
                <Text style={s.nextVal}>{recommendation.expectedCompletion}</Text>
              </View>
            )}
          </View>
        )}

        {/* Glossary + disclaimer */}
        {glossary.length > 0 && (
          <>
            <Text style={s.sectionLabel}>{labels.glossary}</Text>
            {glossary.map((g, i) => (
              <View style={s.glRow} key={i} wrap={false}>
                <Text style={s.glTerm}>{g.term}</Text>
                <Text style={s.glDef}>{g.plain}</Text>
              </View>
            ))}
          </>
        )}
        {!!disclaimer && <Text style={s.disclaimer}>{disclaimer}</Text>}

        <View style={s.footer} fixed>
          <Text>XinWealth · {labels.reportTitle}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
