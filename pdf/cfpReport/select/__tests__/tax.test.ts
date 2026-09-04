import { describe, it, expect } from "vitest";
import { selectTax, reliefRows, optimizationRows } from "../tax";
import type { CfpReportData } from "../../types";

function payload(content: Record<string, unknown> | null): CfpReportData {
  return {
    clientName: "T", advisorName: "A", period: "2026", generatedDate: "x",
    language: "zh", hasUnapproved: false, client: {}, baseline: null,
    sections: content ? [{ section_type: "tax_planning", status: "approved", content }] : [],
    assets: [], liabilities: [],
  };
}

const CONTENT = {
  insufficient_data: false,
  employment_income_est: 216_000,
  chargeable_income: 168_000,
  tax_payable: 22_950,
  marginal_rate: 0.24,
  effective_rate: 0.106,
  non_resident: false,
  reliefs_detail: [
    { key: "personal", label: "个人及受扶养亲属", claimed: 9_000, cap: 9_000, headroom: 0, source: "auto" },
    { key: "epf", label: "EPF 雇员公积金", claimed: 4_000, cap: 4_000, headroom: 0, source: "detected" },
    { key: "prs", label: "私人退休计划 PRS", claimed: 0, cap: 3_000, headroom: 3_000, source: "none" },
    { key: "sspn", label: "SSPN 教育储蓄", claimed: 2_000, cap: 8_000, headroom: 6_000, source: "advisor" },
  ],
  optimization_opportunities: [
    { key: "sspn", label: "补足 SSPN 教育储蓄", additional_claimable: 6_000, est_tax_saving: 1_440 },
    { key: "prs", label: "开始 PRS 供款", additional_claimable: 3_000, est_tax_saving: 720 },
    { key: "noop", label: "无效项", additional_claimable: 0, est_tax_saving: 0 },
  ],
};

describe("reading the section", () => {
  const v = selectTax(payload(CONTENT));

  it("pulls the headline tax position", () => {
    expect(v.hasData).toBe(true);
    expect(v.taxPayable).toBe(22_950);
    expect(v.marginalRate).toBe(0.24);
  });

  it("drops opportunities worth nothing and ranks the rest by saving", () => {
    expect(v.opportunities.map((o) => o.key)).toEqual(["sspn", "prs"]);
  });

  it("totals the saving and nets it off the tax due", () => {
    expect(v.totalSaving).toBe(2_160);
    expect(v.optimizedTaxPayable).toBe(20_790);
  });

  it("never claims to save more tax than is owed", () => {
    const v2 = selectTax(payload({
      ...CONTENT,
      tax_payable: 500,
      optimization_opportunities: [{ key: "x", label: "x", additional_claimable: 9_000, est_tax_saving: 4_000 }],
    }));
    expect(v2.optimizedTaxPayable).toBe(0);
  });

  it("returns an empty view when the section is missing or unusable", () => {
    expect(selectTax(payload(null)).hasData).toBe(false);
    expect(selectTax(payload({ ...CONTENT, insufficient_data: true })).hasData).toBe(false);
  });
});

describe("relief table", () => {
  const rows = reliefRows(selectTax(payload(CONTENT)));

  it("puts the biggest unused headroom first", () => {
    expect(rows[0].label).toBe("SSPN 教育储蓄");
    expect(rows[1].label).toBe("私人退休计划 PRS");
  });

  it("flags reliefs with headroom and leaves maxed ones unflagged", () => {
    expect(rows.find((r) => r.label === "SSPN 教育储蓄")?.flag).toBe("warn");
    expect(rows.find((r) => r.label === "EPF 雇员公积金")?.flag).toBeUndefined();
  });

  it("shows a dash rather than RM 0 where nothing is left to claim", () => {
    expect(rows.find((r) => r.label === "个人及受扶养亲属")?.value).toBe("—");
  });

  it("totals the claimable headroom", () => {
    expect(rows[rows.length - 1].value).toBe("RM 9,000");
  });
});

describe("optimization table", () => {
  const rows = optimizationRows(selectTax(payload(CONTENT)));

  it("runs before, actions, saving, after", () => {
    expect(rows.filter((r) => r.kind === "group").map((r) => r.label)).toEqual(["优化前", "可采取的行动"]);
    expect(rows[rows.length - 1].label).toBe("优化后应缴税额");
    expect(rows[rows.length - 1].value).toBe("RM 20,790");
  });

  it("shows what each action costs to claim", () => {
    expect(rows.find((r) => r.label === "补足 SSPN 教育储蓄")?.meta).toBe("多扣 RM 6,000");
  });

  it("the arithmetic closes: before minus saving equals after", () => {
    const v = selectTax(payload(CONTENT));
    expect(v.taxPayable - v.totalSaving).toBe(v.optimizedTaxPayable);
  });
});
