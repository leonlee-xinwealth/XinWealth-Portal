// The 29 pages of the fixed CFP report template.
//
// Each page takes the whole CfpReportData and pulls what it needs through the
// select/* layer, so the same components render a real client's report and the
// fixture harness in showcase.tsx. Page ORDER and page NUMBERS both come from
// registry.ts — never from the order these are declared or rendered in.

import React from "react";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { T, TYPE, SPACE, PAGE, STATUS, LEADING } from "../theme";
import { FONT, WEIGHT } from "../fonts";
import {
  PageFrame, PageTitle, SectionNumber, H2, Hairline, Prose, EmptyState,
} from "../layout/chrome";
import { RatioDial, zonesFor } from "../viz/Speedometer";
import { DepletionLineChart, CurveLegend } from "../viz/LineChart";
import { DataTable, money, compactMoneyAccounting, type TableRow } from "../viz/DataTable";
import { ConsequenceCard, SolutionCard } from "../viz/callouts";
import { Donut, DonutLegend, foldTail } from "../viz/Donut";
import { compactMoney } from "../viz/primitives";
import { Waterfall } from "../viz/Waterfall";
import {
  RiskPyramid, SwotBoard, CoverageGapBar, TrackCompare, RiskSpectrum,
  GoalTimeline, SavingsBucket,
} from "../viz/panels";
import { selectRatios, formatRatio } from "../select/diagnostics";
import { selectRetirementCurves, selectRetirementTargets } from "../select/retirement";
import {
  consequenceOf, retirementVisionOf, severityOf, solutionOf, swotOf,
} from "../select/narrative";
import {
  assetRows, liabilityRows, netWorthRows, selectBalanceTotals,
  quadrantSummaryRows, selectAssetQuality,
} from "../select/balanceSheet";
import {
  selectCashflow, cashflowWaterfall, cashflowRows, expenseSlices,
  autoItemRows, oneOffRows,
} from "../select/cashflow";
import {
  selectInsurance, needsRows, policyRows, premiumBurden, INSURANCE_GAP_KEYS,
} from "../select/insurance";
import {
  selectEstate, estateRows, nominationRows, TESTATE_TRACK, INTESTATE_TRACK,
  ESTATE_EXPOSURE_KEYS,
} from "../select/estate";
import { selectTax, reliefRows, optimizationRows } from "../select/tax";
import {
  selectSuitability, suitabilityDimensions, selectPortfolio, driftRows,
} from "../select/investment";
import { selectGoals, goalFundingRows, monthlyShortfall } from "../select/goals";
import { selectProfile } from "../select/profile";
import { DISCLAIMER_ZH, DISCLAIMER_EN, buildExecSummaryRows } from "../model";
import {
  PAGE_ORDER, MODULE_TITLES, tocEntries, pageNumberOf, CFP_PAGE_COUNT,
  isModuleOpener, type CfpPageId, type CfpPageProps, type ModuleNo,
} from "../registry";
import type { CfpReportData } from "../types";

/** lockup aspect from the trimmed source, 1692 x 1524 */
const LOGO_RATIO = 1524 / 1692;

function hasLogo(data: CfpReportData): boolean {
  return data.brand?.logo != null;
}

/** Footer running title — the client's own report period, not a constant. */
function runningTitle(data: CfpReportData): string {
  return `XinWealth · ${data.period}`;
}

export function openerFor(id: CfpPageId, titleZh: string, titleEn: string) {
  if (!isModuleOpener(id)) return undefined;
  const module = PAGE_ORDER.find((p) => p.id === id)!.module as ModuleNo;
  return { moduleNo: module, moduleZh: MODULE_TITLES[module].zh, titleZh, titleEn };
}

// --------------------------------------------------------------------------
// P1 封面
// --------------------------------------------------------------------------
export function Cover({ data }: CfpPageProps) {
  return (
    <Page size="A4" style={{ backgroundColor: T.paper, fontFamily: FONT.body }}>
      {/* slim navy band: brand colour without competing with the logo */}
      <View style={{ height: 92, backgroundColor: T.blue }} />

      <View style={{ paddingHorizontal: PAGE.marginX, paddingTop: 30, flex: 1 }}>
        {hasLogo(data) ? (
          <Image src={data.brand!.logo!} style={{ width: 132, height: 132 * LOGO_RATIO, marginBottom: 26 }} />
        ) : (
          <View style={{ marginBottom: 26 }}>
            <View style={{ width: 46, height: 3, backgroundColor: T.gold }} />
            <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: 30, color: T.blue, marginTop: 12, letterSpacing: 1, lineHeight: LEADING.display }}>
              XinWealth
            </Text>
            <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, letterSpacing: 2.6, marginTop: 2 }}>
              LOGO 占位 · 待 public/brand/xinwealth-logo.png
            </Text>
          </View>
        )}
        <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.medium, fontSize: TYPE.kicker, color: T.goldDark, letterSpacing: 3 }}>
          COMPREHENSIVE FINANCIAL PLAN
        </Text>
        <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: 40, color: T.blue, marginTop: 6, lineHeight: LEADING.display }}>
          财务规划报告
        </Text>
        <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.medium, fontSize: TYPE.h1 - 4, color: T.goldDark, marginTop: 4, lineHeight: LEADING.display }}>
          {data.period}
        </Text>

        <View style={{ marginTop: 96 }}>
          <View style={{ height: 0.75, backgroundColor: T.hairline, marginBottom: SPACE.lg }} />
          <MetaRow label="呈交予" value={data.clientName} />
          <MetaRow label="财务规划师" value={`${data.advisorName} · 持牌财务规划师`} />
          <MetaRow label="机构" value="XinWealth Advisory" />
          <MetaRow label="报告日期" value={data.generatedDate} />
        </View>
      </View>

      <View style={{ backgroundColor: T.panel, paddingVertical: 12, paddingHorizontal: PAGE.marginX }}>
        <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.muted, letterSpacing: 1 }}>
          私人及保密文件 · PRIVATE &amp; CONFIDENTIAL · 仅供指名客户参阅
        </Text>
      </View>
    </Page>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: SPACE.sm }}>
      <Text style={{ width: 88, fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.goldDark, letterSpacing: 1 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.medium, fontSize: TYPE.body + 1.5, color: T.blue }}>
        {value}
      </Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// P4 执行摘要 — the action console. Three columns: What | When | Status.
// --------------------------------------------------------------------------
export function ExecSummary({ data }: CfpPageProps) {
  // One row per CFP module, whether or not it has been generated — a fixed
  // template shows the whole plan and marks what is still outstanding, rather
  // than silently shortening the console.
  const rows = buildExecSummaryRows(data);
  const planned = rows.filter((r) => r.generated).length;
  // The dot used to say only "generated / not generated", which told the reader
  // nothing about their own position. Each module now judges its own urgency;
  // an ungenerated section, or one that pre-dates the slot, keeps the grey dot.
  const dotFor = (sectionType: string, generated: boolean) => {
    if (!generated) return STATUS.none.fill;
    switch (severityOf(data, sectionType)) {
      case "critical": return STATUS.bad.fill;
      case "attention": return STATUS.warn.fill;
      case "on_track": return STATUS.good.fill;
      default: return STATUS.none.fill;
    }
  };
  const budget = data.baseline?.budget_summary ?? null;
  return (
    <PageFrame
      pageNumber={pageNumberOf("exec-summary")}
      runningTitle={runningTitle(data)}
      opener={openerFor("exec-summary", "执行摘要", "Executive Summary")}
    >
      <PageTitle zh="执行摘要" en="Executive Summary" moduleNo={1} />
      <Prose style={{marginBottom: SPACE.lg }}>
        这一页是整份报告的行动控制台。以下事项按紧急程度排列，建议与规划师逐项确认完成节点。
      </Prose>

      {/* headline figure band — the template's gold bar */}
      <View style={{ backgroundColor: T.gold, paddingVertical: 9, paddingHorizontal: SPACE.lg }}>
        <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: TYPE.h2 + 1, color: T.blue, lineHeight: LEADING.tight }}>
          年度可支配盈余 {money(data.baseline?.annual_surplus ?? null)} · 已规划 {planned} / {rows.length} 个板块
        </Text>
      </View>

      {/* column header — navy band */}
      <View style={{ flexDirection: "row", backgroundColor: T.blue, paddingVertical: 7, paddingHorizontal: SPACE.lg, marginTop: 2 }}>
        <Text style={{ flex: 1, fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.white }}>
          要做的关键事项
        </Text>
        <Text style={{ width: 76, fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.white }}>
          完成节点
        </Text>
        <Text style={{ width: 56, textAlign: "right", fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.white }}>
          状态
        </Text>
      </View>

      {rows.map((r, i) => (
        <View
          key={r.sectionType}
          style={{
            flexDirection: "row", alignItems: "flex-start",
            paddingVertical: 9, paddingHorizontal: SPACE.lg,
            backgroundColor: i % 2 === 0 ? T.white : T.bandSubtotal,
          }}
        >
          <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-start" }}>
            <View
              style={{
                width: 5, height: 5, borderRadius: 2.5, marginTop: 5, marginRight: SPACE.sm,
                backgroundColor: dotFor(r.sectionType, r.generated),
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.blue }}>
                {r.meta.zh}
              </Text>
              <Text style={{ fontFamily: FONT.body, fontSize: TYPE.caption, color: T.text, lineHeight: LEADING.body, marginTop: 1 }}>
                {r.generated ? (r.actionPlan || r.findings || "—") : "本期未纳入"}
              </Text>
            </View>
          </View>
          <Text style={{ width: 96, fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.text }}>
            {r.expectedCompletion || "—"}
          </Text>
          <View style={{ width: 56, alignItems: "flex-end" }}>
            <View
              style={{
                backgroundColor: r.generated ? STATUS.good.softBg : STATUS.none.softBg,
                borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: FONT.sans, fontWeight: WEIGHT.medium, fontSize: TYPE.micro,
                  color: r.generated ? STATUS.good.fg : STATUS.none.fg,
                }}
              >
                {r.generated ? "已规划" : "未纳入"}
              </Text>
            </View>
          </View>
        </View>
      ))}

      {/* The budget waterfall the chief planner reconciled, when it exists. */}
      {budget && (
        <View style={{ flexDirection: "row", backgroundColor: T.bandTotal, paddingVertical: 8, paddingHorizontal: SPACE.lg }}>
          <Text style={{ flex: 1, fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.body, color: T.white }}>
            合计年度所需投入
          </Text>
          <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: TYPE.body, color: T.white }}>
            {money(budget.required_total)}
          </Text>
        </View>
      )}

      <Hairline my={SPACE.lg} />
      <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.blue }}>说明</Text>
      <Text style={{ fontFamily: FONT.body, fontSize: TYPE.caption, color: T.muted, marginTop: 3 }}>
        完成节点为建议时程，非合约承诺。所有金额以报告生成日的资料为准，实际执行前请与规划师复核。
      </Text>
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P11 七大财务比率
// --------------------------------------------------------------------------
export function Ratios({ data }: CfpPageProps) {
  const rows = selectRatios(data);
  return (
    <PageFrame
      pageNumber={pageNumberOf("ratios-1")}
      runningTitle={runningTitle(data)}
      opener={openerFor("ratios-1", "财务比率诊断", "Financial Ratio Diagnostics")}
    >
      <Prose style={{marginBottom: SPACE.md }}>
        七项国际通用的财务健康指标。指针落在绿区代表达标，黄区代表边缘，红区代表需立即处理。
      </Prose>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {rows.map((r) => {
          const frac = r.value == null ? null : Math.min(1, Math.max(0, r.value / r.scaleMax));
          return (
            <View
              key={r.id}
              style={{
                width: "33.33%", alignItems: "center",
                paddingVertical: SPACE.md, paddingHorizontal: 4,
              }}
            >
              <RatioDial
                fraction={frac}
                zones={zonesFor(r.id)}
                band={r.band}
                size={108}
                readout={formatRatio(r, "zh")}
                verdict={r.verdictZh}
                nameZh={r.zh}
                basisZh={r.basisZh}
                benchmark={r.benchmark}
              />
            </View>
          );
        })}
      </View>

      <Hairline my={SPACE.md} />
      <View style={{ flexDirection: "row" }}>
        {(["good", "warn", "bad"] as const).map((b, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginRight: SPACE.xl }}>
            <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: STATUS[b].fill, marginRight: 5 }} />
            <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.text }}>
              {b === "good" ? "达标" : b === "warn" ? "边缘" : "需处理"}
            </Text>
          </View>
        ))}
      </View>
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P23 资金耗尽推演 — the centrepiece
// --------------------------------------------------------------------------
export function RunOut({ data }: CfpPageProps) {
  const c = selectRetirementCurves(data);
  const t = selectRetirementTargets(data);
  const series = [
    {
      points: c.baseline.map((p) => ({ age: p.age, closing: p.closing })),
      color: STATUS.bad.fill,
      label: "现状推演",
      fill: false,
    },
    {
      points: c.optimized.map((p) => ({ age: p.age, closing: p.closing })),
      color: T.blue,
      label: "优化后推演",
      fill: true,
      dashed: true,
    },
  ];

  return (
    <PageFrame
      pageNumber={pageNumberOf("retirement-runout")}
      runningTitle={runningTitle(data)}
      opener={openerFor("retirement-runout", "退休资金寿命推演", "Retirement Cash Run-Out")}
    >
      <PageTitle zh="退休资金寿命推演" en="Retirement Cash Run-Out" moduleNo={7} />

      <View style={{ flexDirection: "row", marginBottom: SPACE.md }}>
        <StatCell
          label="退休年龄"
          value={c.retirementAge != null ? `${c.retirementAge} 岁` : "—"}
        />
        <StatCell label="退休时预计资产" value={compactMoneyAccounting(t.projected)} />
        <StatCell label="所需资本" value={compactMoneyAccounting(t.capitalPassive)} />
        <StatCell
          label="缺口"
          value={compactMoneyAccounting(t.gap)}
          tone={t.gap != null && t.gap > 0 ? "bad" : undefined}
        />
      </View>

      {/* An empty chart frame reads as a rendering fault rather than as "not
          generated yet" — the axes are drawn, so the eye looks for a line. */}
      {!c.hasCurve ? (
        <EmptyState
          zh="生成「退休规划」板块后，这里会画出退休金逐年支取的耐久曲线。"
          en="Generate the Retirement Planning section to plot how long the capital lasts under annual drawdown."
        />
      ) : (
      <View style={{ backgroundColor: T.white, borderWidth: 0.75, borderColor: T.hairline, borderRadius: 6, padding: SPACE.md }}>
        <DepletionLineChart
          series={series}
          width={PAGE.width - PAGE.marginX * 2 - SPACE.md * 2 - 2}
          height={250}
          markAge={c.depletionAge}
          markLabelZh={c.depletionAge ? `${c.depletionAge} 岁资金耗尽` : undefined}
          markLabelEn={c.depletionAge ? "Funds depleted" : undefined}
        />
        <CurveLegend series={series} />
        <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginTop: 4 }}>
          横轴为年龄，纵轴为年末可用资金余额（RM）
        </Text>
      </View>
      )}

      {c.depletionAge != null && (
        <View style={{ marginTop: SPACE.lg }}>
          <ConsequenceCard
            headline={`${c.depletionAge} 岁资金归零`}
            body={`按目前的储蓄与投资节奏推演，退休金将在 ${c.depletionAge} 岁耗尽。若寿命超过该年龄，将需依赖他人供养或变卖自住房产维持生活，且届时已无收入能力可补救。`}
          />
        </View>
      )}
      {t.requiredMonthlyTopup != null && t.requiredMonthlyTopup > 0 && (
        <View style={{ marginTop: SPACE.sm }}>
          <SolutionCard
            body={`自本月起每月增投 ${money(t.requiredMonthlyTopup)}，退休时资本可达 ${compactMoneyAccounting(t.capitalPassive)}${
              c.depletionAge != null
                ? `，资金寿命由 ${c.depletionAge} 岁延长至 ${c.optimizedDepletionAge ?? `${c.maxAge}+`} 岁`
                : ""
            }。`}
          />
        </View>
      )}
    </PageFrame>
  );
}

function StatCell({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, letterSpacing: 1 }}>{label}</Text>
      <Text
        style={{
          fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: TYPE.h2 + 2,
          color: tone === "bad" ? STATUS.bad.fg : T.blue, marginTop: 1,
          lineHeight: LEADING.tight,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// P29 封底 — full navy field, reversed lockup, contact band. The template's
// back cover, recoloured; the reversed logo exists because the full-colour
// one loses its navy half on this ground.
// --------------------------------------------------------------------------
const CONTACT = [
  { label: "电邮", value: "leon@xinwealth.com" },
  { label: "电话", value: "+60 12-345 6789" },
  { label: "网站", value: "www.xinwealth.com" },
];

export function BackCover({ data }: CfpPageProps) {
  return (
    <Page size="A4" style={{ backgroundColor: T.blue, fontFamily: FONT.body }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: PAGE.marginX }}>
        {hasLogo(data) ? (
          <Image src={data.brand!.logoReversed!} style={{ width: 176, height: 176 * LOGO_RATIO }} />
        ) : (
          <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: 30, color: T.white, lineHeight: LEADING.display }}>
            XinWealth
          </Text>
        )}
        <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.onDarkMute, letterSpacing: 3, marginTop: 18 }}>
          XINWEALTH ADVISORY
        </Text>
        <View style={{ width: 46, height: 3, backgroundColor: T.gold, marginTop: 22 }} />
        {/* No tagline exists anywhere in the codebase and inventing brand copy
            for a client deliverable is the user's call, not ours. Placeholder
            until one is supplied; delete this block if there is to be none. */}
        <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.onDarkMute, marginTop: 22, lineHeight: LEADING.heading }}>
          〔品牌标语占位 · 待提供〕
        </Text>
      </View>

      <View style={{ backgroundColor: T.panel, paddingVertical: 26, paddingHorizontal: PAGE.marginX, flexDirection: "row" }}>
        {CONTACT.map((c, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <View style={{ width: 1.5, height: 16, backgroundColor: T.blue }} />
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: T.gold, marginTop: -1 }} />
            <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.blue, marginTop: 7 }}>
              {c.label}
            </Text>
            <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.text, marginTop: 2 }}>
              {c.value}
            </Text>
          </View>
        ))}
      </View>
    </Page>
  );
}

// --------------------------------------------------------------------------
// P2 目录 — generated from registry.ts. Because the template is fixed, the page
// numbers are compile-time constants; no second render pass needed.
// --------------------------------------------------------------------------
function TocColumn({ modules }: { modules: ModuleNo[] }) {
  const entries = tocEntries();
  return (
    <View style={{ flex: 1 }}>
      {modules.map((m) => (
        <View key={m} style={{ marginBottom: SPACE.md }} wrap={false}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <SectionNumber n={m} size={18} />
            <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.micro, color: T.goldDark, letterSpacing: 1.4, marginLeft: SPACE.sm }}>
              {MODULE_TITLES[m].zh}
            </Text>
          </View>
          {entries.filter((e) => e.module === m).map((e) => (
            <View key={e.id} style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 2.5, paddingLeft: 24 }}>
              <Text style={{ fontFamily: FONT.body, fontSize: TYPE.caption, color: T.text }}>{e.zh}</Text>
              <View style={{ flex: 1, height: 0.75, backgroundColor: T.hairline, marginHorizontal: 5, marginBottom: 3 }} />
              <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.medium, fontSize: TYPE.caption, color: T.blue }}>
                {String(e.page).padStart(2, "0")}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// 25 entries across ten modules will not fit one A4 column at a readable size,
// and a TOC that spills onto a second page would shift every page number after
// it — the one thing a fixed template cannot tolerate. Two columns, split so
// both run to roughly the same depth.
export function Toc({ data }: CfpPageProps) {
  return (
    <PageFrame pageNumber={pageNumberOf("toc")} runningTitle={runningTitle(data)}>
      <PageTitle zh="目录" en="Contents" />
      <View style={{ flexDirection: "row" }}>
        <TocColumn modules={[1, 2, 3, 4]} />
        <View style={{ width: SPACE.xl }} />
        <TocColumn modules={[5, 6, 7, 8, 9]} />
      </View>
      <Hairline my={SPACE.md} />
      <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.faint }}>
        全书共 {CFP_PAGE_COUNT} 页 · 封面、目录、免责声明与封底不计入上表
      </Text>
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P9 资产明细 — the Canva template's table grammar carrying real rows.
// --------------------------------------------------------------------------
export function AssetsDetail({ data }: CfpPageProps) {
  const t = selectBalanceTotals(data);
  const quality = selectAssetQuality(data);
  return (
    <PageFrame
      pageNumber={pageNumberOf("assets-detail")}
      runningTitle={runningTitle(data)}
      opener={openerFor("assets-detail", "资产明细", "Asset Details")}
    >
      <PageTitle zh="资产明细" en="Asset Details" moduleNo={2} />
      <DataTable
        headline={{ label: "资产总额", value: money(t.assets) }}
        columns={{ label: "项目", meta: "类别 / 占比", value: "金额" }}
        rows={assetRows(data)}
        note={
          quality.hasData
            ? "流动资产为可即时动用的现金与等价物，是紧急预备金的来源；退休资产（EPF / PRS）在法定年龄前无法自由支取，不计入流动性。投资/自用资产的类别栏另标注其现金流×增值象限（生财资产 / 收益但贬值 / 增值但吃现金 / 消耗型资产），详见下一页的资产象限盘点。"
            : "流动资产为可即时动用的现金与等价物，是紧急预备金的来源；退休资产（EPF / PRS）在法定年龄前无法自由支取，不计入流动性。"
        }
      />
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P10 负债明细
// --------------------------------------------------------------------------
export function LiabilitiesDetail({ data }: CfpPageProps) {
  const t = selectBalanceTotals(data);
  return (
    <PageFrame
      pageNumber={pageNumberOf("liabilities-detail")}
      runningTitle={runningTitle(data)}
      opener={openerFor("liabilities-detail", "负债明细", "Liability Details")}
    >
      <PageTitle zh="负债明细" en="Liability Details" moduleNo={2} />
      <DataTable
        headline={{ label: "负债总额", value: money(t.liabilities) }}
        columns={{ label: "项目", meta: "类别", value: "未偿余额" }}
        rows={liabilityRows(data)}
        note={`标记 ● 者为高息循环债务，合计 ${money(t.highInterestTotal)}，建议优先清偿 —— 其利率通常高于任何投资的合理预期回报。`}
      />

      <View style={{ marginTop: SPACE.lg }}>
        <ConsequenceCard
          kickerZh="高息负债"
          kickerEn="HIGH-INTEREST DEBT"
          headline={money(t.highInterestTotal)}
          body="信用卡循环利率一般在 15%–18% 之间。在这笔余额清零之前，任何新增投资的净效益都可能是负的。"
        />
      </View>
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P6 现金流概览
// --------------------------------------------------------------------------
export function CashflowOverview({ data }: CfpPageProps) {
  const v = selectCashflow(data);
  const slices = foldTail(expenseSlices(v), 6);
  const chartW = PAGE.width - PAGE.marginX * 2;
  return (
    <PageFrame
      pageNumber={pageNumberOf("cashflow-overview")}
      runningTitle={runningTitle(data)}
      opener={openerFor("cashflow-overview", "现金流概览", "Cash Flow Overview")}
    >

      <View style={{ flexDirection: "row", marginBottom: SPACE.md }}>
        <StatCell label="月收入" value={money(v.monthlyIncome)} />
        <StatCell label="月支出" value={money(v.monthlyExpenses)} />
        <StatCell label="月结余" value={money(v.monthlySurplus)} />
        <StatCell label="储蓄率" value={v.savingsRatio != null ? `${(v.savingsRatio * 100).toFixed(0)}%` : "—"} />
      </View>

      <View style={{ backgroundColor: T.white, borderWidth: 0.75, borderColor: T.hairline, borderRadius: 6, padding: SPACE.md }}>
        <Waterfall steps={cashflowWaterfall(v)} width={chartW - SPACE.md * 2 - 2} height={230} format={money} />
      </View>

      <H2>支出结构</H2>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Donut
          slices={slices}
          size={168}
          centerValue={`${((v.monthlyExpenses / Math.max(1, v.monthlyIncome)) * 100).toFixed(0)}%`}
          centerLabel="支出占收入"
        />
        <View style={{ width: SPACE.xl }} />
        <View style={{ flex: 1 }}>
          <DonutLegend slices={slices} format={money} />
        </View>
      </View>

      <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginTop: SPACE.md }}>
        「资产转移」为从储蓄转入投资等自有资产的资金，不属于支出，故单列一步 —— 这也是月结余与银行户口变动不一致的原因。
      </Text>
      {/* The plan basis is an assumption the client is entitled to see: "RM
          1,420 a month" means something different drawn from a standing plan
          than from one recorded month of actuals. Prefer the new uniform
          sentence; fall back to the old actuals-only wording for a baseline
          written before cashflow_source existed. */}
      {v.planBasisLine ? (
        <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginTop: 3 }}>
          {v.planBasisLine}
        </Text>
      ) : v.basisLabel && (
        <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginTop: 3 }}>
          {`本页收支按${v.basisLabel}的实际记录年化${
            v.basisHasGap ? "；该区间内部分月份无记录，月均按有记录的月份计算。" : "。"
          }`}
        </Text>
      )}

      {/* P2b 决策 6: compact micro-text, not a padded panel — this page is
          already tight (waterfall + donut), and these are footnote-weight
          facts, not headline ones. */}
      {v.employeeEpfMonthly > 0 && (
        <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginTop: 3 }}>
          {`雇员 EPF 供款 ${money(v.employeeEpfMonthly)}/月已计入储蓄（非支出，已从月支出中剔除）`}
          {v.employerEpfMonthly > 0 ? `；雇主另计 ${money(v.employerEpfMonthly)}/月，不进入现金流，仅供净资产对账。` : "。"}
        </Text>
      )}
      {v.disposableSurplusAnnual != null && (
        <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginTop: 2 }}>
          {`可支配年结余（扣除强制 EPF 储蓄后）${money(v.disposableSurplusAnnual)} —— 预算与目标规划真正可动用的部分。`}
        </Text>
      )}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P7 现金流明细
// --------------------------------------------------------------------------
/** P7 附注: a single auto-included or one-off line, well below the full
 *  DataTable's row weight — the main table above already runs the page close
 *  to full, so this reuses the row DATA (`autoItemRows`/`oneOffRows`) without
 *  the DataTable component's own padding/column-header overhead. */
function CompactItemLine({ row }: { row: TableRow }) {
  // Label and meta share ONE line (not stacked) — this block sits under an
  // already page-filling table, so every extra line of height matters.
  return (
    <View style={{ flexDirection: "row", marginBottom: 1 }}>
      <Text style={{ flex: 1, fontFamily: FONT.body, fontSize: TYPE.micro, color: T.text }}>
        {row.label}
        {row.meta ? <Text style={{ fontFamily: FONT.sans, color: T.faint }}>{`  ·  ${row.meta}`}</Text> : null}
      </Text>
      <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.medium, fontSize: TYPE.micro, color: T.blue }}>
        {row.value}
      </Text>
    </View>
  );
}

export function CashflowDetail({ data }: CfpPageProps) {
  const v = selectCashflow(data);
  const autoRows = autoItemRows(v);
  const oneOff = oneOffRows(v);
  return (
    <PageFrame
      pageNumber={pageNumberOf("cashflow-detail")}
      runningTitle={runningTitle(data)}
      opener={openerFor("cashflow-detail", "现金流明细", "Cash Flow Details")}
    >
      <PageTitle zh="现金流明细" en="Cash Flow Details" moduleNo={2} />
      <DataTable
        headline={{ label: "月净结余", value: money(v.monthlySurplus) }}
        columns={{ label: "项目", meta: "占比", value: "每月金额" }}
        rows={cashflowRows(v)}
        metaWidth={54}
        note="占比以各自分组的合计为基数。所有金额为月度口径；年度数字为月度乘以十二，不含一次性收支。"
      />

      {autoRows.length > 0 && (
        <View style={{ marginTop: 5 }}>
          <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.micro, color: T.blue, marginBottom: 1 }}>
            自动计入项目
          </Text>
          {autoRows.map((r, i) => <CompactItemLine key={i} row={r} />)}
        </View>
      )}

      {oneOff.length > 0 && (
        <View style={{ marginTop: 5 }}>
          <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.micro, color: T.blue, marginBottom: 1 }}>
            一次性收支（未计入以上数字）
          </Text>
          {oneOff.map((r, i) => <CompactItemLine key={i} row={r} />)}
        </View>
      )}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P8 资产负债表概览
// --------------------------------------------------------------------------
export function BalanceOverview({ data }: CfpPageProps) {
  const t = selectBalanceTotals(data);
  const slices = t.assetGroups.map((g) => ({ label: g.zh, value: g.total }));
  const scale = Math.max(t.assets, t.liabilities) || 1;
  const quadrantRows = quadrantSummaryRows(data);
  return (
    <PageFrame
      pageNumber={pageNumberOf("balance-overview")}
      runningTitle={runningTitle(data)}
      opener={openerFor("balance-overview", "资产负债表概览", "Balance Sheet Overview")}
    >
      <PageTitle zh="资产负债表概览" en="Balance Sheet Overview" moduleNo={2} />

      <DataTable rows={netWorthRows(data)} valueWidth={110} />

      <H2>资产与负债对比</H2>
      {[
        { label: "资产", value: t.assets, color: T.blue },
        { label: "负债", value: t.liabilities, color: STATUS.warn.fill },
      ].map((b, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACE.sm }}>
          <Text style={{ width: 44, fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.text }}>{b.label}</Text>
          <View style={{ flex: 1, height: 14, backgroundColor: T.panel }}>
            <View style={{ width: `${(b.value / scale) * 100}%`, height: 14, backgroundColor: b.color }} />
          </View>
          <Text style={{ width: 96, textAlign: "right", fontFamily: FONT.serif, fontWeight: WEIGHT.medium, fontSize: TYPE.caption, color: T.blue }}>
            {money(b.value)}
          </Text>
        </View>
      ))}

      <H2>资产结构</H2>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Donut slices={slices} size={168} centerValue={compactMoneyAccounting(t.netWorth)} centerLabel="净资产" />
        <View style={{ width: SPACE.xl }} />
        <View style={{ flex: 1 }}>
          <DonutLegend slices={slices} format={money} />
        </View>
      </View>

      {quadrantRows.length > 0 && (
        <View style={{ marginTop: SPACE.md }}>
          <H2>资产象限盘点</H2>
          <DataTable
            columns={{ label: "象限", meta: "资产数 / 月净现金流", value: "资产总值" }}
            rows={quadrantRows}
            metaWidth={150}
            note="现金流×增值两轴划出四象限：生财资产（现金流、价值双正）、收益但贬值（现金流为正、价值下滑，如出租的旧车）、增值但吃现金（价值上升但需持续投入，如未出租的房产）、消耗型资产（两者皆负）。流动与退休资产不参与此划分。"
          />
        </View>
      )}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P13 综合财务分析与洞察 — SWOT
// --------------------------------------------------------------------------
export function Insights({ data }: CfpPageProps) {
  const swot = swotOf(data);
  const columns = swot
    ? [
      { title: "优势", subtitle: "STRENGTHS", tone: "good" as const, items: swot.strengths },
      { title: "警惕", subtitle: "WARNINGS", tone: "bad" as const, items: swot.warnings },
      { title: "优化空间", subtitle: "OPPORTUNITIES", tone: "gold" as const, items: swot.opportunities },
    ].filter((c) => c.items.length > 0)
    : [];

  return (
    <PageFrame
      pageNumber={pageNumberOf("insights")}
      runningTitle={runningTitle(data)}
      opener={openerFor("insights", "综合财务分析与洞察", "Overall Insights")}
    >
      <PageTitle zh="综合财务分析与洞察" en="Overall Insights" moduleNo={3} />
      {columns.length === 0 ? (
        <EmptyState
          zh="生成「整体财务健康」板块后，这里会汇总前面几页的数字，给出优势、警惕与优化空间。"
          en="Generate the Overall Financial Health section to see strengths, warnings and opportunities drawn from the pages above."
        />
      ) : (
        <>
          <Prose style={{ marginBottom: SPACE.lg }}>
            把前面几页的数字放在一起看，这份财务状况的骨架、裂缝与可以撬动的地方如下。
          </Prose>
          <SwotBoard groups={columns} />
        </>
      )}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P14 保险规划理念
// --------------------------------------------------------------------------
export function InsuranceConcept({ data }: CfpPageProps) {
  const v = selectInsurance(data);
  // The leverage argument is far stronger in the client's own numbers than in
  // an illustration, but it is only honest when they actually hold cover — a
  // client with no policies would otherwise read an invented premium as theirs.
  const lever = v.annualPremiumTotal > 0 && (v.resources?.lifeCover ?? 0) > 0
    ? `你目前年缴 ${money(v.annualPremiumTotal)} 的保费，换来的是 ${money(v.resources!.lifeCover)} 的即时赔付能力。`
      + `若没有这些保单，同样的保障要靠自有资金准备，意味着必须先攒够 ${money(v.resources!.lifeCover)} —— 而攒钱需要时间，风险不等人。`
    : "保障的作用，是用一笔确定的小额支出，换取一笔不确定的大额损失。"
      + "同样的保障若要靠自有资金准备，得先攒够全额 —— 而攒钱需要时间，风险不等人。";
  return (
    <PageFrame
      pageNumber={pageNumberOf("insurance-concept")}
      runningTitle={runningTitle(data)}
      opener={openerFor("insurance-concept", "保险规划理念", "Insurance Principles")}
    >
      <Prose style={{marginBottom: SPACE.lg }}>
        保险不是投资，它的作用是在最坏的情况发生时，让已经积累的财富不必被变卖。
        风险金字塔由下往上建：底座不牢，上面每一层都会在同一场意外里一起塌。
      </Prose>

      <RiskPyramid
        tiers={[
          { label: "财富传承", caption: "遗嘱、信托 —— 决定财富归谁" },
          { label: "财富增值", caption: "投资组合 —— 让盈余长大" },
          { label: "财富积累", caption: "储蓄与紧急预备金 —— 应对短期波动" },
          { label: "风险保障", caption: "人寿、重疾、医疗 —— 防止本金被迫变现" },
        ]}
      />

      <H2>为什么防守要先做</H2>
      <View style={{ backgroundColor: T.white, borderWidth: 0.75, borderColor: T.hairline, borderRadius: 6, padding: SPACE.lg }}>
        <Prose style={{ lineHeight: LEADING.body }}>
          {`${lever}这就是保障的杠杆：用确定的小额支出，换取不确定的大额损失。`}
        </Prose>
      </View>
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P15 保障缺口与后果 — the blueprint's loudest page
// --------------------------------------------------------------------------
export function InsuranceGap({ data }: CfpPageProps) {
  const v = selectInsurance(data);
  const cf = selectCashflow(data);
  const burden = premiumBurden(v, cf.annualIncome);
  // The model chose which gap leads; the amount beside its headline is looked
  // up here from the CNA, so no figure on this page was written by a model.
  const consequence = consequenceOf(data, "insurance_planning", INSURANCE_GAP_KEYS);
  const leadGap = consequence?.headlineKey
    ? v.gaps.find((g) => g.key === consequence.headlineKey) ?? null
    : v.gaps.find((g) => !g.flagOnly && (g.gap ?? 0) > 0) ?? null;
  return (
    <PageFrame
      pageNumber={pageNumberOf("insurance-gap")}
      runningTitle={runningTitle(data)}
      opener={openerFor("insurance-gap", "保障缺口与后果", "Coverage Gap & Consequences")}
    >
      <PageTitle zh="保障缺口与后果" en="Coverage Gap & Consequences" moduleNo={4} />

      {v.categories ? (
        <>
          {/* P5 决策 1: 身故/TPD/重疾 carry an actual need figure. */}
          <CoverageGapBar label={v.categories.death.label} need={v.categories.death.need} covered={v.categories.death.cover} gap={v.categories.death.gap} format={money} />
          <CoverageGapBar label={v.categories.tpd.label} need={v.categories.tpd.need} covered={v.categories.tpd.cover} gap={v.categories.tpd.gap} format={money} />
          <CoverageGapBar label={v.categories.ci.label} need={v.categories.ci.need} covered={v.categories.ci.cover} gap={v.categories.ci.gap} format={money} />

          {/* 早期重疾/医药/意外 are cover-only — a compact strip of badges
              rather than three more full-width bars. */}
          <View style={{ flexDirection: "row", marginTop: SPACE.xs, marginBottom: SPACE.sm }}>
            {[
              { label: v.categories.ciEarlyCover.label, hasCover: v.categories.ciEarlyCover.cover > 0 },
              {
                label: v.categories.medical.label,
                hasCover: v.categories.medical.hasCover,
                sub: v.categories.medical.hasCover
                  ? (v.categories.medical.lowLimit
                    ? `年限额 ${money(v.categories.medical.annualLimit)}（偏低）`
                    : v.categories.medical.limitUnknown
                    ? "年限额未记录"
                    : `年限额 ${money(v.categories.medical.annualLimit)}`)
                  : undefined,
                warn: v.categories.medical.hasCover && (v.categories.medical.lowLimit || v.categories.medical.limitUnknown),
              },
              { label: v.categories.pa.label, hasCover: v.categories.pa.cover > 0 },
            ].map((b, i) => (
              <View key={i} style={{ flex: 1, marginRight: i < 2 ? SPACE.sm : 0, backgroundColor: T.white, borderWidth: 0.75, borderColor: T.hairline, borderRadius: 6, padding: SPACE.sm }}>
                <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.micro, color: T.blue, marginBottom: 3 }}>
                  {b.label}
                </Text>
                <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.medium, fontSize: TYPE.micro, color: b.warn ? STATUS.warn.fg : b.hasCover ? STATUS.good.fg : STATUS.bad.fg }}>
                  {b.hasCover ? "已投保" : "未投保"}
                </Text>
                {b.sub && (
                  <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginTop: 1 }}>
                    {b.sub}
                  </Text>
                )}
              </View>
            ))}
          </View>

          {v.hasGroupCover && v.excludingGroup && (
            <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginBottom: SPACE.sm }}>
              {`不含团保（离职即失效）时：身故缺口 ${money(Math.max(0, (v.excludingGroup.death.need ?? 0) - v.excludingGroup.death.cover))}，`
                + `重疾缺口 ${money(Math.max(0, (v.excludingGroup.ci.need ?? 0) - v.excludingGroup.ci.cover))}。`}
            </Text>
          )}
        </>
      ) : (
        v.gaps.map((g) => (
          <CoverageGapBar
            key={g.key}
            label={g.label}
            need={g.need}
            covered={g.covered}
            gap={g.gap}
            flagOnly={g.flagOnly}
            hasCover={g.hasCover}
            format={money}
          />
        ))
      )}

      <View style={{ backgroundColor: T.white, borderWidth: 0.75, borderColor: T.hairline, borderRadius: 6, padding: SPACE.md, marginTop: SPACE.sm }}>
        <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.blue, marginBottom: SPACE.sm }}>
          身故保障需求由三部分构成
        </Text>
        {v.needs && [
          { label: "收入替代", value: v.needs.incomeReplacement },
          { label: "清偿负债", value: v.needs.liabilities },
          { label: "子女教育金", value: v.needs.education },
        ].map((n, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
            <Text style={{ flex: 1, fontFamily: FONT.body, fontSize: TYPE.caption, color: T.text }}>{n.label}</Text>
            <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.medium, fontSize: TYPE.caption, color: T.blue }}>
              {money(n.value)}
            </Text>
          </View>
        ))}
      </View>

      {consequence && (
        <View style={{ marginTop: SPACE.lg }}>
          <ConsequenceCard
            headline={
              leadGap && leadGap.gap != null
                ? `${leadGap.label}缺口 ${money(leadGap.gap)}`
                : consequence.headline
            }
            body={consequence.body}
            bullets={consequence.bullets}
          />
        </View>
      )}

      {burden && (
        <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginTop: SPACE.md }}>
          现有年缴保费 {money(v.annualPremiumTotal)}，占年收入 {(burden.share * 100).toFixed(1)}%
          （建议区间 10%–15%）—— 预算本身没有错配，问题在保额分配。
        </Text>
      )}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P16 风险管理建议 — existing policies finally printed
// --------------------------------------------------------------------------
export function InsurancePlan({ data }: CfpPageProps) {
  const v = selectInsurance(data);
  const solution = solutionOf(data, "insurance_planning");
  return (
    <PageFrame
      pageNumber={pageNumberOf("insurance-plan")}
      runningTitle={runningTitle(data)}
      opener={openerFor("insurance-plan", "风险管理建议", "Risk Recommendations")}
    >
      <PageTitle zh="风险管理建议" en="Risk Recommendations" moduleNo={4} />

      <H2>现有保单</H2>
      <DataTable
        columns={{ label: "承保公司", meta: "险种", value: "保额" }}
        rows={policyRows(v)}
        metaWidth={86}
        note={
          v.categories?.medical.hasCover
            ? `保额为身故/重疾赔付上限；医疗卡为实报实销，无固定保额，故不列示金额。现有医疗卡年限额 ${money(v.categories.medical.annualLimit)}${v.categories.medical.lowLimit ? "（偏低，建议提升至 RM1,000,000 以上）" : v.categories.medical.limitUnknown ? "（未记录，建议核实）" : ""}。`
            : "保额为身故/重疾赔付上限；医疗卡为实报实销，无固定保额，故不列示金额。"
        }
      />

      {solution && (
        <View style={{ marginTop: SPACE.lg }}>
          <SolutionCard
            headline={solution.headline}
            body={solution.body}
            bullets={solution.bullets}
          />
        </View>
      )}

      <H2>假设基础</H2>
      {v.assumptions.map((a, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
          <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.goldDark, marginRight: SPACE.sm }}>
            {String(i + 1).padStart(2, "0")}
          </Text>
          <Text style={{ flex: 1, fontFamily: FONT.body, fontSize: TYPE.caption, color: T.muted, lineHeight: LEADING.body }}>
            {a}
          </Text>
        </View>
      ))}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P17 有无遗嘱的差别 — module 5 opener
// --------------------------------------------------------------------------
export function EstateConcept({ data }: CfpPageProps) {
  return (
    <PageFrame
      pageNumber={pageNumberOf("estate-concept")}
      runningTitle={runningTitle(data)}
      opener={openerFor("estate-concept", "有无遗嘱的差别", "Testate vs Intestate")}
    >
      <Prose style={{ marginBottom: SPACE.lg }}>
        遗嘱决定的不是「财富归谁」这一件事，而是「家人要花多久、多少钱、经历什么，才能拿到本来就属于他们的东西」。
        以下两条路径的终点看似相同，过程完全不同。
      </Prose>

      <TrackCompare
        left={{
          title: "已立遗嘱", subtitle: "TESTATE", tone: "good",
          steps: TESTATE_TRACK.map((s) => ({ label: s.label, detail: s.detail })),
        }}
        right={{
          title: "未立遗嘱", subtitle: "INTESTATE", tone: "bad",
          steps: INTESTATE_TRACK.map((s) => ({ label: s.label, detail: s.detail })),
        }}
      />

      <H2>差别落在哪里</H2>
      <View style={{ backgroundColor: T.white, borderWidth: 0.75, borderColor: T.hairline, borderRadius: 6, padding: SPACE.lg }}>
        <Prose>
          未立遗嘱时，遗产管理令需要两名担保人，而担保人须承担与遗产等值的责任 —— 现实中极难找到。
          这一步卡住的案例，冻结期动辄两年以上，期间房贷仍需偿还，家人却动不了遗产里的任何一分钱。
        </Prose>
      </View>
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P18 传承现状与后果
// --------------------------------------------------------------------------
export function EstateFindings({ data }: CfpPageProps) {
  const v = selectEstate(data);
  const consequence = consequenceOf(data, "legacy_planning", ESTATE_EXPOSURE_KEYS);
  // The headline figure belongs to whichever exposure the model chose to lead
  // with; only the liquidity shortfall is an amount, so the others lead with
  // the model's words and no number.
  const headline = consequence?.headlineKey === "estate_liquidity" && v.liquidity
    ? money(v.liquidity.shortfall)
    : consequence?.headline ?? "";
  return (
    <PageFrame pageNumber={pageNumberOf("estate-findings")} runningTitle={runningTitle(data)}>
      <PageTitle zh="传承现状与后果" en="Estate Findings & Impact" moduleNo={5} />

      <DataTable rows={estateRows(v)} valueWidth={120} />

      <H2>受益人提名状态</H2>
      <DataTable rows={nominationRows(v)} valueWidth={90} />

      {consequence && (
        <View style={{ marginTop: SPACE.lg }}>
          <ConsequenceCard
            headline={headline}
            body={consequence.body}
            bullets={consequence.bullets}
          />
        </View>
      )}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P19 传承规划建议
// --------------------------------------------------------------------------
export function EstatePlan({ data }: CfpPageProps) {
  const v = selectEstate(data);
  const solution = solutionOf(data, "legacy_planning");
  return (
    <PageFrame pageNumber={pageNumberOf("estate-plan")} runningTitle={runningTitle(data)}>
      <PageTitle zh="传承规划建议" en="Estate Recommendations" moduleNo={5} />

      {solution ? (
        <SolutionCard
          headline={solution.headline}
          body={solution.body}
          bullets={solution.bullets}
        />
      ) : (
        <EmptyState
          zh="生成「财富传承与遗产规划」板块后，这里会给出提名与遗嘱的执行顺序。"
          en="Generate the Legacy & Estate section to see the order in which nominations and the will should be executed."
        />
      )}

      {/* The review cadence is a rule of the instrument, not a client figure —
          it holds whatever the plan says, so it stands outside the slot. */}
      <H2>复盘周期</H2>
      <Prose style={{ marginBottom: SPACE.md }}>
        传承安排会因人生事件失效。以下任一情况发生时，应立即复核，而非等到下一个周期。
      </Prose>
      {[
        { when: "每 3 年", what: "例行复核遗嘱与提名是否仍反映本人意愿" },
        { when: "婚姻状况变动", what: "结婚会使先前遗嘱自动失效，须重立" },
        { when: "新增子女", what: "补充监护人指定与教育金安排" },
        { when: "重大资产变动", what: "购置房产、出售生意、境外资产新增" },
      ].map((r, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: SPACE.sm }}>
          <View style={{ width: 96 }}>
            <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.goldDark }}>
              {r.when}
            </Text>
          </View>
          <Text style={{ flex: 1, fontFamily: FONT.body, fontSize: TYPE.caption, color: T.text, lineHeight: LEADING.body }}>
            {r.what}
          </Text>
        </View>
      ))}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P25 税务减免盘点 — module 8 opener
// --------------------------------------------------------------------------
export function TaxFindings({ data }: CfpPageProps) {
  const v = selectTax(data);
  return (
    <PageFrame
      pageNumber={pageNumberOf("tax-findings")}
      runningTitle={runningTitle(data)}
      opener={openerFor("tax-findings", "税务减免盘点", "Tax Relief Review")}
    >
      <View style={{ flexDirection: "row", marginBottom: SPACE.md }}>
        <StatCell label="应课税收入" value={money(v.chargeableIncome)} />
        <StatCell label="应缴税额" value={money(v.taxPayable)} />
        <StatCell label="边际税率" value={`${(v.marginalRate * 100).toFixed(0)}%`} />
        <StatCell label="实际税率" value={v.effectiveRate != null ? `${(v.effectiveRate * 100).toFixed(1)}%` : "—"} />
      </View>

      <DataTable
        columns={{ label: "扣除项目", meta: "已用 / 上限", value: "尚可扣除" }}
        rows={reliefRows(v)}
        metaWidth={128}
        note="标记 ● 者为尚有额度未用满。所有金额依 LHDN 当年度个人所得税扣除规定，实际以报税时的凭证为准。"
      />
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P26 税务优化对照
// --------------------------------------------------------------------------
export function TaxPlan({ data }: CfpPageProps) {
  const v = selectTax(data);
  const solution = solutionOf(data, "tax_planning");
  return (
    <PageFrame pageNumber={pageNumberOf("tax-plan")} runningTitle={runningTitle(data)}>
      <PageTitle zh="税务优化对照" en="Tax Optimization" moduleNo={8} />

      <DataTable
        headline={{ label: "预估可节省", value: money(v.totalSaving) }}
        rows={optimizationRows(v)}
        valueWidth={120}
      />

      {solution && (
        <View style={{ marginTop: SPACE.lg }}>
          {/* The saving is deterministic, so it leads; the model's own headline
              is the fallback when there is nothing left to claim. */}
          <SolutionCard
            headline={v.totalSaving > 0 ? `每年少缴 ${money(v.totalSaving)}` : solution.headline}
            body={solution.body}
            bullets={solution.bullets}
          />
        </View>
      )}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P20 投资适宜性评估 — module 6 opener
// --------------------------------------------------------------------------
export function Suitability({ data }: CfpPageProps) {
  const v = selectSuitability(data);
  const width = PAGE.width - PAGE.marginX * 2;
  return (
    <PageFrame
      pageNumber={pageNumberOf("suitability")}
      runningTitle={runningTitle(data)}
      opener={openerFor("suitability", "投资适宜性评估", "Investment Suitability")}
    >
      {!v.hasData ? (
        <>
          <Prose style={{ marginBottom: SPACE.lg }}>
            投资建议必须建立在风险适宜性评估之上。在完成评估之前，本报告不会提出任何具体的投资配置建议 ——
            这不是流程上的形式，而是因为同一个组合对不同承受能力的人，风险完全不同。
          </Prose>
          <EmptyState
            zh="尚未完成投资适宜性评估"
            en="No suitability assessment on file"
          />
          <View style={{ marginTop: SPACE.lg }}>
            <SolutionCard
              kickerZh="下一步"
              kickerEn="NEXT STEP"
              body="评估共 15 题，约 10 分钟完成。规划师会发送专属链接；提交后本页将自动填入风险画像、对应的资产配置区间与预期回报区间。"
              bullets={[
                "评估结果决定配置区间的上下限，而非某一个具体产品",
                "回报以历史区间呈现，不作任何保证或预测",
                "画像会随收入、年期与家庭状况变化，建议每两年重做一次",
              ]}
            />
          </View>
        </>
      ) : (
        <>
          <Prose style={{ marginBottom: SPACE.lg }}>
            风险画像由三个维度共同决定，最终取其中最保守的一项 —— 因为任何一项不足，都足以让组合在压力时刻失控。
          </Prose>

          <RiskSpectrum
            width={width}
            activeBand={v.finalBand}
            bands={[
              { label: "稳健型", sub: "STABLE" },
              { label: "平衡型", sub: "BALANCED" },
              { label: "成长型", sub: "GROWTH" },
              { label: "积极成长型", sub: "AGGRESSIVE" },
            ]}
          />

          <H2>三个维度</H2>
          {suitabilityDimensions(v).map((d, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACE.sm }}>
              <Text style={{ width: 120, fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.text }}>
                {d.label}
              </Text>
              <View style={{ flex: 1, height: 10, backgroundColor: T.panel, borderRadius: 2 }}>
                <View style={{ width: `${(d.band / 4) * 100}%`, height: 10, backgroundColor: d.isFinal ? T.gold : T.blue, borderRadius: 2 }} />
              </View>
              <Text style={{ width: 74, textAlign: "right", fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.blue }}>
                {["—", "稳健", "平衡", "成长", "积极成长"][d.band] ?? "—"}
              </Text>
            </View>
          ))}
          <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint, marginTop: 3 }}>
            实际封顶维度：{v.bindingZh}
          </Text>

          <H2>对应的配置区间与回报区间</H2>
          <DataTable
            rows={[
              { kind: "row", label: "防守型资产", value: v.allocation.defensive },
              { kind: "row", label: "增长型资产", value: v.allocation.growth },
              { kind: "row", label: "分散型资产", value: v.allocation.diversifier },
              { kind: "subtotal", label: "此画像的历史回报区间", value: v.expectedRange },
              { kind: "row", label: "你的回报期望", value: v.targetReturn },
            ]}
            valueWidth={130}
            note={v.gapTextZh}
          />
        </>
      )}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P21 投资组合盘点与调整
// --------------------------------------------------------------------------
export function Portfolio({ data }: CfpPageProps) {
  const v = selectPortfolio(data);
  const suit = selectSuitability(data);
  return (
    <PageFrame pageNumber={pageNumberOf("portfolio")} runningTitle={runningTitle(data)}>
      <PageTitle zh="投资组合盘点与调整" en="Portfolio Review" moduleNo={6} />

      {!v.hasData ? (
        <EmptyState zh="尚无可投资资产记录" en="No investable assets recorded" />
      ) : (
        <>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.blue, marginBottom: SPACE.sm }}>
                现有配置
              </Text>
              <Donut slices={v.current} size={150} thickness={26} />
            </View>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.goldDark, marginBottom: SPACE.sm }}>
                目标配置
              </Text>
              <Donut slices={v.target} size={150} thickness={26} />
            </View>
          </View>

          <View style={{ marginTop: SPACE.md }}>
            <DonutLegend slices={v.current} format={money} />
          </View>

          <H2>偏离度</H2>
          <DataTable
            columns={{ label: "资产类别", meta: "现况 → 目标", value: "偏离" }}
            rows={driftRows(v)}
            metaWidth={104}
            note={
              suit.hasData
                ? "目标配置来自适宜性评估的画像区间，取区间中值。标记 ● 者偏离达 5 个百分点以上，建议优先调整。"
                : "目标配置为系统默认稳健区间的中值 —— 尚未完成适宜性评估，实际目标须待评估后确认。"
            }
          />
        </>
      )}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P3 免责声明
// --------------------------------------------------------------------------
export function Disclaimer({ data }: CfpPageProps) {
  return (
    <PageFrame pageNumber={pageNumberOf("disclaimer")} runningTitle={runningTitle(data)}>
      <PageTitle zh="免责声明" en="Important Notice" />
      <View style={{ flexDirection: "row" }}>
        <View style={{ flex: 1, marginRight: SPACE.lg }}>
          {DISCLAIMER_ZH.map((para, i) => (
            <Text
              key={i}
              style={{
                fontFamily: FONT.body, fontSize: TYPE.caption, color: T.text,
                lineHeight: LEADING.body, marginBottom: SPACE.md,
              }}
            >
              {para}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {DISCLAIMER_EN.map((para, i) => (
            <Text
              key={i}
              style={{
                fontFamily: FONT.body, fontSize: TYPE.caption, color: T.muted,
                lineHeight: LEADING.body, marginBottom: SPACE.md,
              }}
            >
              {para}
            </Text>
          ))}
        </View>
      </View>
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P5 客户个人资料
// --------------------------------------------------------------------------
export function Profile({ data }: CfpPageProps) {
  const v = selectProfile(data);
  return (
    <PageFrame pageNumber={pageNumberOf("profile")} runningTitle={runningTitle(data)}>
      <PageTitle zh="客户个人资料" en="Personal Profile" moduleNo={1} />

      {!v.hasData ? (
        <EmptyState
          zh="客户资料尚未填写完整。请先在客户档案中补齐出生日期、职业与婚姻状况。"
          en="The client record is incomplete. Fill in date of birth, occupation and marital status on the client profile first."
        />
      ) : (
        <>
          <View style={{ backgroundColor: T.white, borderWidth: 0.75, borderColor: T.hairline, borderRadius: 6, padding: SPACE.lg }}>
            {v.rows.map((r, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row", paddingVertical: SPACE.sm,
                  borderBottomWidth: i < v.rows.length - 1 ? 0.5 : 0,
                  borderBottomColor: T.hairline,
                }}
              >
                <Text style={{ width: 130, fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.muted }}>
                  {r.label}
                </Text>
                <Text style={{ flex: 1, fontFamily: FONT.serif, fontWeight: WEIGHT.medium, fontSize: TYPE.body, color: T.blue }}>
                  {r.value}
                </Text>
              </View>
            ))}
          </View>

          {v.family.length > 0 && (
            <>
              <H2>家庭结构</H2>
              <View style={{ flexDirection: "row" }}>
                {v.family.map((m, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1, marginRight: i < v.family.length - 1 ? SPACE.sm : 0,
                      backgroundColor: T.panel, borderRadius: 6, padding: SPACE.md, alignItems: "center",
                    }}
                  >
                    <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.blue }}>
                      {m.role}
                    </Text>
                    <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.muted, marginTop: 3, textAlign: "center" }}>
                      {m.detail}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      )}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P12 比率解读与达标线
// --------------------------------------------------------------------------
export function RatiosGuide({ data }: CfpPageProps) {
  const rows = selectRatios(data);
  return (
    <PageFrame pageNumber={pageNumberOf("ratios-2")} runningTitle={runningTitle(data)}>
      <PageTitle zh="比率解读与达标线" en="Ratio Interpretation" moduleNo={3} />
      <Prose style={{ marginBottom: SPACE.lg }}>
        上一页的七个指针，逐项对照达标线与实际意义。达标线取自国际通行的个人理财规划基准，并非监管要求。
      </Prose>

      <DataTable
        columns={{ label: "指标", meta: "达标线", value: "实测" }}
        rows={rows.map((r) => ({
          kind: "row" as const,
          label: r.zh,
          meta: r.benchmark,
          value: formatRatio(r, "zh"),
          flag: r.band === "bad" ? ("bad" as const) : r.band === "warn" ? ("warn" as const) : undefined,
        }))}
        metaWidth={92}
      />

      <H2>三项最需要注意的</H2>
      {rows
        .filter((r) => r.band === "bad")
        .slice(0, 3)
        .map((r, i) => (
          <View key={i} style={{ marginBottom: SPACE.md }}>
            <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.blue }}>
              {r.zh} · 实测 {formatRatio(r, "zh")}（达标线 {r.benchmark}）
            </Text>
            <Text style={{ fontFamily: FONT.body, fontSize: TYPE.caption, color: T.text, lineHeight: LEADING.body, marginTop: 2 }}>
              {r.basisZh} —— {r.verdictZh}
            </Text>
          </View>
        ))}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P22 退休目标与定义 — module 7 opener
// --------------------------------------------------------------------------
export function RetirementVision({ data }: CfpPageProps) {
  const t = selectRetirementTargets(data);
  const vision = retirementVisionOf(data);

  // Prose and figures arrive from different places and either can be missing:
  // the section may be generated but pre-date the vision slot, or the client's
  // data may be too thin to project. Each half degrades on its own.
  const definitions = [
    {
      title: "资金耗尽式", sub: "CAPITAL DEPLETION", tone: "warn" as const,
      body: vision?.depletionBody
        ?? "退休后逐年动用本金，目标是资金支撑到预期寿命。所需资本较低，但本金会归零，无法留给下一代。",
      need: t.capitalDepletion,
    },
    {
      title: "被动收入式", sub: "PASSIVE INCOME", tone: "good" as const,
      body: vision?.passiveBody
        ?? "投资收益完全覆盖全年开销，本金不动。所需资本较高，但资产可完整传承。",
      need: t.capitalPassive,
    },
  ];

  return (
    <PageFrame
      pageNumber={pageNumberOf("retirement-vision")}
      runningTitle={runningTitle(data)}
      opener={openerFor("retirement-vision", "退休目标与定义", "Retirement Vision")}
    >
      <Prose style={{ marginBottom: SPACE.lg }}>
        「退休」有两种定义，达成的难度与所需资金差距极大。这份规划同时给出两者的数字，由你决定要走哪一条。
      </Prose>

      {!t.hasData ? (
        <EmptyState
          zh="生成「退休规划」板块后，这里会给出两种退休定义各自所需的资本。"
          en="Generate the Retirement Planning section to see the capital each definition of retirement requires."
        />
      ) : (
        <>
          <View style={{ flexDirection: "row" }}>
            {definitions.map((c, i) => (
              <View
                key={i}
                style={{
                  flex: 1, marginRight: i === 0 ? SPACE.md : 0,
                  backgroundColor: STATUS[c.tone].softBg, borderRadius: 6, padding: SPACE.lg,
                }}
              >
                <View style={{ width: 26, height: 3, backgroundColor: STATUS[c.tone].fill, marginBottom: SPACE.sm }} />
                <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.h2, color: T.blue }}>
                  {c.title}
                </Text>
                <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.muted, letterSpacing: 1, marginBottom: SPACE.sm }}>
                  {c.sub}
                </Text>
                <Text style={{ fontFamily: FONT.body, fontSize: TYPE.caption, color: T.text, lineHeight: LEADING.body }}>
                  {c.body}
                </Text>
                <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: TYPE.h1 - 4, color: T.blue, marginTop: SPACE.md, lineHeight: LEADING.tight }}>
                  {compactMoneyAccounting(c.need)}
                </Text>
                <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.micro, color: T.faint }}>
                  退休时所需资本
                </Text>
              </View>
            ))}
          </View>

          <H2>被动收入现况</H2>
          <View style={{ flexDirection: "row", marginBottom: SPACE.md }}>
            <StatCell label="目前月被动收入" value={money(t.passiveIncomeMonthly)} />
            <StatCell label="目前月支出" value={money(t.monthlyExpenses)} />
            <StatCell
              label="覆盖率"
              value={t.coverage == null ? "—" : `${Math.round(t.coverage * 100)}%`}
              tone={t.coverage != null && t.coverage < 1 ? "bad" : undefined}
            />
            <StatCell
              label="距完全覆盖"
              value={t.toFullCoverageMonthly == null ? "—" : `${money(t.toFullCoverageMonthly)}/月`}
            />
          </View>
          <Prose>
            被动收入覆盖率是财务自由的唯一硬指标。达到 100% 之前，退休都依赖动用本金 —— 也就是上一种定义。
          </Prose>
        </>
      )}
    </PageFrame>
  );
}


// --------------------------------------------------------------------------
// P24 退休延寿方案
// --------------------------------------------------------------------------
export function RetirementPlan({ data }: CfpPageProps) {
  const c = selectRetirementCurves(data);
  const t = selectRetirementTargets(data);
  const solution = solutionOf(data, "retirement_planning");
  const yearsGained = c.optimizedDepletionAge != null && c.depletionAge != null
    ? c.optimizedDepletionAge - c.depletionAge
    : c.depletionAge != null
      ? c.maxAge - c.depletionAge
      : null;

  return (
    <PageFrame pageNumber={pageNumberOf("retirement-plan")} runningTitle={runningTitle(data)}>
      <PageTitle zh="退休延寿方案" en="Retirement Recommendations" moduleNo={7} />

      {!t.hasData ? (
        <EmptyState
          zh="生成「退休规划」板块后，这里会给出补足缺口所需的每月投入，以及资金寿命可延长多少。"
          en="Generate the Retirement Planning section to see the monthly top-up that closes the gap and how much longer the capital lasts."
        />
      ) : (
        <>
          <DataTable
            headline={{ label: "每月需增投", value: money(t.requiredMonthlyTopup) }}
            rows={[
              { kind: "group", label: "现状推演" },
              { kind: "row", label: "退休时预计资产", indent: true, value: money(t.projected) },
              {
                kind: "row", label: "资金耗尽年龄", indent: true,
                value: c.depletionAge != null ? `${c.depletionAge} 岁` : `${c.maxAge}+ 岁`,
              },
              { kind: "group", label: "优化后" },
              { kind: "row", label: "退休时资本", indent: true, value: money(t.capitalPassive) },
              {
                kind: "row", label: "资金耗尽年龄", indent: true,
                value: c.optimizedDepletionAge != null ? `${c.optimizedDepletionAge} 岁` : `${c.maxAge}+ 岁`,
              },
              {
                kind: "total", label: "资金寿命延长",
                value: yearsGained == null ? "—" : `${yearsGained} 年`,
              },
            ]}
            valueWidth={120}
          />

          {solution && (
            <View style={{ marginTop: SPACE.lg }}>
              <SolutionCard
                headline={solution.headline}
                body={solution.body}
                bullets={solution.bullets}
              />
            </View>
          )}
        </>
      )}
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P27 专项目标时间轴 — module 9 opener
// --------------------------------------------------------------------------
export function GoalsTimeline({ data }: CfpPageProps) {
  const v = selectGoals(data);
  const width = PAGE.width - PAGE.marginX * 2;
  return (
    <PageFrame
      pageNumber={pageNumberOf("goals-timeline")}
      runningTitle={runningTitle(data)}
      opener={openerFor("goals-timeline", "专项目标时间轴", "Goal Timeline")}
    >
      <Prose style={{ marginBottom: SPACE.lg }}>
        以下是开场时谈到的具体生活目标。每一项的金额都已按通胀推算到目标年份 —— 今天的价格不是届时要付的价格。
      </Prose>

      <GoalTimeline
        width={width}
        goals={v.goals.map((g) => ({ name: g.name, year: g.targetYear, cost: g.futureCost, onTrack: g.onTrack }))}
      />

      <H2>各目标的真实成本</H2>
      <DataTable
        columns={{ label: "目标", meta: "今日价格", value: "届时成本" }}
        rows={v.goals.map((g) => ({
          kind: "row" as const,
          label: `${g.name}（${g.yearsToTarget} 年后）`,
          meta: money(g.targetToday),
          value: money(g.futureCost),
        }))}
        metaWidth={104}
        note="届时成本按各目标适用的通胀率推算：教育 5%，其他 3%。差额即通胀侵蚀的部分。"
      />
    </PageFrame>
  );
}

// --------------------------------------------------------------------------
// P28 攒钱系统与进度
// --------------------------------------------------------------------------
export function GoalsFunding({ data }: CfpPageProps) {
  const v = selectGoals(data);
  const short = monthlyShortfall(v);
  const solution = solutionOf(data, "goals_planning");
  return (
    <PageFrame pageNumber={pageNumberOf("goals-funding")} runningTitle={runningTitle(data)}>
      <PageTitle zh="攒钱系统与进度" en="Funding Plan" moduleNo={9} />

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: SPACE.lg }}>
        {v.goals.map((g, i) => (
          <SavingsBucket
            key={i}
            label={g.name}
            fraction={g.fundedFraction}
            caption={g.onTrack ? "已达标" : `缺 ${money(g.gap)}`}
            width={(PAGE.width - PAGE.marginX * 2) / Math.max(3, v.goals.length) - 6}
          />
        ))}
      </View>

      <DataTable
        headline={{ label: "每月尚需增加", value: money(short) }}
        columns={{ label: "目标", meta: "现投", value: "应投" }}
        rows={goalFundingRows(v)}
        metaWidth={104}
        note="进度条为按现有投入推演至目标年份的预计储备占届时成本的比例，非当前已存金额。"
      />

      {solution && (
        <View style={{ marginTop: SPACE.lg }}>
          <SolutionCard
            headline={solution.headline}
            body={solution.body}
            bullets={solution.bullets}
          />
        </View>
      )}
    </PageFrame>
  );
}

/**
 * Every page bound to its registry id.
 *
 * `Record<CfpPageId, …>` makes this exhaustive at compile time: a page missing
 * from the map, or an id that no longer exists, fails the build.
 *
 * Hand-writing the render order in JSX is what produced the defect this file
 * used to carry — assets-detail and liabilities-detail sat at positions 21-22 in
 * the JSX while the registry placed them at 9-10, so 14 sheets printed a footer
 * number that did not match where they physically were, and the table of
 * contents pointed at the wrong sheets. Order now has exactly one source.
 */

/**
 * Every page bound to its registry id.
 *
 * `Record<CfpPageId, …>` is exhaustive at compile time: a page missing from the
 * map, or an id that no longer exists in the registry, fails the build. This is
 * the only place a page id meets a component.
 */
const BY_ID: Record<CfpPageId, React.ComponentType<CfpPageProps>> = {
  "cover": Cover,
  "toc": Toc,
  "disclaimer": Disclaimer,
  "exec-summary": ExecSummary,
  "profile": Profile,
  "cashflow-overview": CashflowOverview,
  "cashflow-detail": CashflowDetail,
  "balance-overview": BalanceOverview,
  "assets-detail": AssetsDetail,
  "liabilities-detail": LiabilitiesDetail,
  "ratios-1": Ratios,
  "ratios-2": RatiosGuide,
  "insights": Insights,
  "insurance-concept": InsuranceConcept,
  "insurance-gap": InsuranceGap,
  "insurance-plan": InsurancePlan,
  "estate-concept": EstateConcept,
  "estate-findings": EstateFindings,
  "estate-plan": EstatePlan,
  "suitability": Suitability,
  "portfolio": Portfolio,
  "retirement-vision": RetirementVision,
  "retirement-runout": RunOut,
  "retirement-plan": RetirementPlan,
  "tax-findings": TaxFindings,
  "tax-plan": TaxPlan,
  "goals-timeline": GoalsTimeline,
  "goals-funding": GoalsFunding,
  "back-cover": BackCover,
};

/** The document, in order, each page carrying its own 1-based sheet number. */
export const PAGES = PAGE_ORDER.map((p, i) => ({
  ...p,
  Component: BY_ID[p.id],
  pageNumber: i + 1,
}));
