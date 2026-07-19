import { describe, expect, it } from "vitest";
import { buildReportModel, levelScore, type ReportMeta } from "../buildReportModel";
import type { ClientView, InsuranceSectionContent } from "../types";

const baseContent = (): InsuranceSectionContent => ({
  version: 1,
  section_type: "insurance_planning",
  agent: "insurance_brain",
  executive_summary: {
    findings: "Life gap identified.",
    action_plan: "Top up life cover within 3 months.",
    expected_completion_date: "Within 3 months",
    remarks: "Draft.",
  },
  coverage_review: [
    { category: "life", level: "insufficient", commentary: "Base commentary life." },
    { category: "medical", level: "adequate", commentary: "Base commentary medical." },
  ],
  gap_analysis: "BASE gap analysis prose.",
  recommendations: [
    { title: "Rec B", detail: "Detail B", priority: 2 },
    { title: "Rec A", detail: "Detail A", priority: 1 },
  ],
  scenarios: [
    {
      title: "Premature Death",
      trigger: "T1.",
      life_impact: "I1.",
      protection_response: "R1.",
    },
  ],
  policy_overview: [
    {
      provider: "ACME",
      policy_number: "P-1",
      policy_type: "life",
      sum_assured: 500000,
      cash_value: 25000,
      premium: 300,
      premium_frequency: "monthly",
      annual_premium: 3600,
      start_date: null,
      end_date: null,
    },
  ],
  annual_premium_total: 3600,
  cna: {
    assumptions: ["假设一"],
    inputs: {
      annual_income: 120000,
      liabilities_total: 400000,
      liquid_assets: 50000,
      life_cover: 500000,
      ci_cover: 0,
      has_medical: true,
      dependents: 2,
    },
    needs: { income_replacement: 1200000, liabilities: 400000, education: 118000, total_life: 1718000, ci: 360000 },
    resources: { life_cover: 500000, ci_cover: 0, liquid_assets: 50000 },
    gaps: [
      { key: "life", label: "人寿保障", need: 1718000, covered: 550000, gap: 1168000 },
      { key: "ci", label: "重疾保障", need: 360000, covered: 0, gap: 360000 },
      { key: "medical", label: "医疗保障", flag_only: true, has_cover: true },
    ],
    insufficient: false,
  },
});

const meta = (language: "en" | "zh"): ReportMeta => ({
  clientName: "Jane Tan",
  advisorName: "Leon Lee",
  period: "Q3'26",
  generatedDate: "2026-07-14",
  language,
});

describe("buildReportModel", () => {
  it("passes CNA numbers through untouched", () => {
    const m = buildReportModel(baseContent(), meta("en"));
    const life = m.finding.gaps.find((g) => g.label.includes("Life"))!;
    expect(life.need).toBe(1718000);
    expect(life.covered).toBe(550000);
    expect(life.gap).toBe(1168000);
    expect(life.sufficient).toBe(false);
    expect(m.dataGathering.annualPremiumTotal).toBe(3600);
    expect(m.finding.medical).toEqual({ hasCover: true });
  });

  it("falls back to base prose when no client_view is present", () => {
    const m = buildReportModel(baseContent(), meta("en"));
    expect(m.finding.gapAnalysis).toBe("BASE gap analysis prose.");
    expect(m.dataGathering.intro).toBe("");
    expect(m.finding.coverage[0].plain).toBe("Base commentary life.");
    expect(m.glossary).toEqual([]);
    expect(m.finding.scenarios[0].plain).toBe("T1. I1. R1.");
  });

  it("prefers layman client_view prose when present", () => {
    const content = baseContent();
    const cv: ClientView = {
      version: 1,
      language: "en",
      data_gathering_intro: "PLAIN intro 1.",
      finding_intro: "PLAIN intro 2.",
      gap_analysis_plain: "PLAIN gap analysis.",
      coverage_review_plain: [
        { category: "life", plain: "PLAIN life." },
        { category: "medical", plain: "PLAIN medical." },
      ],
      scenarios_plain: [{ title: "If the worst happens", plain: "PLAIN scenario." }],
      recommendation_intro: "PLAIN intro 3.",
      recommendations_plain: [
        { title: "Plain B", plain: "Plain detail B" },
        { title: "Plain A", plain: "Plain detail A" },
      ],
      glossary: [{ term: "Sum Assured", plain: "The payout amount." }],
      disclaimer: "Plain disclaimer.",
    };
    content.client_view = cv;
    const m = buildReportModel(content, meta("en"));
    expect(m.dataGathering.intro).toBe("PLAIN intro 1.");
    expect(m.finding.gapAnalysis).toBe("PLAIN gap analysis.");
    expect(m.finding.coverage[0].plain).toBe("PLAIN life.");
    expect(m.finding.scenarios[0].title).toBe("If the worst happens");
    expect(m.glossary[0].term).toBe("Sum Assured");
    expect(m.disclaimer).toBe("Plain disclaimer.");
  });

  it("sorts recommendations by priority ascending (with client_view titles by index)", () => {
    const content = baseContent();
    // recommendations_plain is index-aligned to the base recommendations array.
    content.client_view = {
      version: 1,
      language: "en",
      data_gathering_intro: "",
      finding_intro: "",
      gap_analysis_plain: "",
      coverage_review_plain: [],
      scenarios_plain: [],
      recommendation_intro: "",
      recommendations_plain: [
        { title: "Plain B", plain: "pB" },
        { title: "Plain A", plain: "pA" },
      ],
      glossary: [],
      disclaimer: "",
    };
    const m = buildReportModel(content, meta("en"));
    expect(m.recommendation.items.map((r) => r.priority)).toEqual([1, 2]);
    // priority 1 was base index 1 ("Rec A") -> client_view index 1 ("Plain A")
    expect(m.recommendation.items[0].title).toBe("Plain A");
  });

  it("localizes section labels by language", () => {
    expect(buildReportModel(baseContent(), meta("en")).labels.part1Title).toBe("Your Information");
    expect(buildReportModel(baseContent(), meta("zh")).labels.part1Title).toBe("资料收集");
  });

  it("derives snapshot ratios from existing numbers (no recompute)", () => {
    const m = buildReportModel(baseContent(), meta("en"));
    // life covered 550k of need 1,718k; ci 0 of 360k -> 550k / 2,078k = 26%
    expect(m.snapshot.coveragePct).toBe(26);
    // premium 3,600 / income 120,000 = 3.0%
    expect(m.snapshot.premiumPctOfIncome).toBe(3);
    expect(m.snapshot.totalSumAssured).toBe(500000);
    expect(m.snapshot.policyCount).toBe(1);
    expect(m.snapshot.dependents).toBe(2);
    // per-gap coveredPct
    const life = m.finding.gaps.find((g) => g.label.includes("Life"))!;
    expect(life.coveredPct).toBe(32); // 550k / 1,718k
  });

  it("attaches a 0..4 level score to each coverage row", () => {
    const m = buildReportModel(baseContent(), meta("en"));
    expect(m.finding.coverage.find((c) => c.level === "insufficient")!.score).toBe(1);
    expect(m.finding.coverage.find((c) => c.level === "adequate")!.score).toBe(4);
    expect(levelScore("fair")).toBe(2);
    expect(levelScore("none")).toBe(0);
    expect(levelScore("unknown")).toBe(-1);
  });

  it("guards divide-by-zero (no income / no need)", () => {
    const content = baseContent();
    content.cna.inputs.annual_income = 0;
    content.cna.gaps = [
      { key: "life", label: "人寿保障", need: 0, covered: 0, gap: 0 },
      { key: "ci", label: "重疾保障", need: 0, covered: 0, gap: 0 },
      { key: "medical", label: "医疗保障", flag_only: true, has_cover: false },
    ];
    const m = buildReportModel(content, meta("en"));
    expect(m.snapshot.premiumPctOfIncome).toBe(0);
    expect(m.snapshot.coveragePct).toBe(100); // no need => trivially met
    expect(m.finding.gaps[0].coveredPct).toBe(100);
  });
});
