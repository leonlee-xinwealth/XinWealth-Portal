import { describe, it, expect } from "vitest";
import { selectInsurance, needsRows, policyRows, premiumBurden } from "../insurance";
import type { CfpReportData } from "../../types";

function payload(content: Record<string, unknown> | null): CfpReportData {
  return {
    clientName: "T", advisorName: "A", period: "2026", generatedDate: "x",
    language: "zh", hasUnapproved: false, client: {}, baseline: null,
    sections: content ? [{ section_type: "insurance_planning", status: "approved", content }] : [],
    assets: [], liabilities: [],
  };
}

const CONTENT = {
  annual_premium_total: 14_400,
  policy_overview: [
    { provider: "Great Eastern", policy_type: "人寿", sum_assured: 300_000, cash_value: 12_000, annual_premium: 4_800 },
    { provider: "Prudential", policy_type: "重疾", sum_assured: 150_000, cash_value: null, annual_premium: 6_000 },
    { provider: null, policy_type: "医疗卡", sum_assured: null, cash_value: null, annual_premium: 3_600 },
  ],
  cna: {
    insufficient: false,
    assumptions: ["收入替代按 10 年计算", "教育金按每名子女 RM 150,000 估算"],
    needs: {
      income_replacement: 1_440_000, liabilities: 771_500,
      education: 300_000, total_life: 2_511_500, ci: 432_000,
    },
    resources: { life_cover: 300_000, ci_cover: 150_000, liquid_assets: 96_000 },
    gaps: [
      { key: "life", label: "人寿保障", need: 2_511_500, covered: 300_000, gap: 2_211_500 },
      { key: "ci", label: "重疾保障", need: 432_000, covered: 150_000, gap: 282_000 },
      { key: "medical", label: "医疗保障", flag_only: true, has_cover: true },
    ],
  },
};

describe("reading the section", () => {
  const v = selectInsurance(payload(CONTENT));

  it("pulls the CNA breakdown that the old report never rendered", () => {
    expect(v.needs).toEqual({
      incomeReplacement: 1_440_000, liabilities: 771_500,
      education: 300_000, totalLife: 2_511_500, ci: 432_000,
    });
    expect(v.resources).toEqual({ lifeCover: 300_000, ciCover: 150_000, liquidAssets: 96_000 });
  });

  it("carries the gaps including the flag-only medical row", () => {
    expect(v.gaps.map((g) => g.key)).toEqual(["life", "ci", "medical"]);
    const med = v.gaps.find((g) => g.key === "medical")!;
    expect(med.flagOnly).toBe(true);
    expect(med.hasCover).toBe(true);
    expect(med.gap).toBeNull();
  });

  it("names an unnamed policy rather than printing a blank row", () => {
    expect(v.policies.map((p) => p.provider)).toContain("未具名保单");
  });

  it("keeps the assumptions so the page can print its basis", () => {
    expect(v.assumptions).toHaveLength(2);
  });

  it("returns an empty view when the section is absent", () => {
    const e = selectInsurance(payload(null));
    expect(e.hasData).toBe(false);
    expect(e.gaps).toEqual([]);
    expect(e.needs).toBeNull();
  });

  it("surfaces insufficient so the page can refuse to show meaningless figures", () => {
    const v2 = selectInsurance(payload({ ...CONTENT, cna: { ...CONTENT.cna, insufficient: true } }));
    expect(v2.insufficient).toBe(true);
  });

  it("falls back to null categories on legacy content that predates P5", () => {
    expect(v.categories).toBeNull();
    expect(v.excludingGroup).toBeNull();
    expect(v.hasGroupCover).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P5 决策 1 — the six-category breakdown (身故/TPD/重疾/早期重疾/医药/意外),
// additive alongside the legacy `needs`/`resources`/`gaps` above. See
// supabase/functions/_shared/insurance/cna.ts's CnaResult/buildProtectionSet.
// ---------------------------------------------------------------------------

const CONTENT_NEW = {
  ...CONTENT,
  cna: {
    ...CONTENT.cna,
    death: { need: 2_511_500, cover: 300_000, gap: 2_211_500, notes: ["含团保，离职即失效 / ..."] },
    tpd: { need: 2_511_500, cover: 300_000, gap: 2_211_500, notes: [] },
    ci: { need: 432_000, cover: 150_000, gap: 282_000, notes: [] },
    ci_early_cover: { cover: 0, notes: ["早期重疾未单独记录"] },
    medical: { cover: 0, notes: [], has_cover: true, annual_limit: 500_000, low_limit: true, limit_unknown: false },
    pa: { cover: 0, notes: [] },
    excluding_group: {
      death: { need: 2_511_500, cover: 200_000, gap: 2_311_500, notes: [] },
      tpd: { need: 2_511_500, cover: 200_000, gap: 2_311_500, notes: [] },
      ci: { need: 432_000, cover: 150_000, gap: 282_000, notes: [] },
      ci_early_cover: { cover: 0, notes: [] },
      medical: { cover: 0, notes: [], has_cover: true, annual_limit: 500_000, low_limit: true, limit_unknown: false },
      pa: { cover: 0, notes: [] },
    },
  },
};

describe("the six-category CNA breakdown", () => {
  const v = selectInsurance(payload(CONTENT_NEW));

  it("maps each category with its Chinese label", () => {
    expect(v.categories).not.toBeNull();
    expect(v.categories!.death).toMatchObject({ label: "身故", need: 2_511_500, cover: 300_000, gap: 2_211_500 });
    expect(v.categories!.tpd.label).toBe("全残（TPD）");
    expect(v.categories!.ciEarlyCover.label).toBe("早期重疾（保障）");
    expect(v.categories!.pa.label).toBe("意外（保障）");
  });

  it("carries the medical category's cover-only fields", () => {
    const med = v.categories!.medical;
    expect(med.hasCover).toBe(true);
    expect(med.annualLimit).toBe(500_000);
    expect(med.lowLimit).toBe(true);
    expect(med.limitUnknown).toBe(false);
    expect(med.need).toBeNull();
  });

  it("flags group cover when excluding it actually changes a category's cover", () => {
    expect(v.hasGroupCover).toBe(true);
    expect(v.excludingGroup!.death.cover).toBe(200_000);
  });

  it("does not flag group cover when excluding_group is identical to the main set", () => {
    const noGroup = selectInsurance(payload({
      ...CONTENT_NEW,
      cna: { ...CONTENT_NEW.cna, excluding_group: undefined },
    }));
    // computeCna's own fallback: excluding_group defaults to the main set
    // itself when the caller never supplied group-policy detail.
    expect(noGroup.hasGroupCover).toBe(false);
    expect(noGroup.excludingGroup).toEqual(noGroup.categories);
  });

  it("returns null for a section with no cna at all", () => {
    const e = selectInsurance(payload({ annual_premium_total: 0 }));
    expect(e.categories).toBeNull();
    expect(e.hasGroupCover).toBe(false);
  });
});

describe("needs table", () => {
  const rows = needsRows(selectInsurance(payload(CONTENT)));

  it("adds the three needs up to the stated total", () => {
    const n = CONTENT.cna.needs;
    expect(n.income_replacement + n.liabilities + n.education).toBe(n.total_life);
  });

  it("closes on the gap between need and existing cover", () => {
    const total = rows[rows.length - 1];
    expect(total.kind).toBe("total");
    expect(total.label).toBe("保障缺口");
    expect(total.value).toBe("RM 2,211,500");
  });

  it("never reports a negative gap when the client is over-covered", () => {
    const over = selectInsurance(payload({
      ...CONTENT,
      cna: { ...CONTENT.cna, resources: { ...CONTENT.cna.resources, life_cover: 9_000_000 } },
    }));
    expect(needsRows(over)[needsRows(over).length - 1].value).toBe("RM 0");
  });

  it("returns nothing without a CNA so the page shows its empty state", () => {
    expect(needsRows(selectInsurance(payload({ annual_premium_total: 0 })))).toEqual([]);
  });
});

describe("policy table", () => {
  const rows = policyRows(selectInsurance(payload(CONTENT)));

  it("lists policies biggest sum assured first and totals the premium", () => {
    expect(rows.slice(0, 3).map((r) => r.label)).toEqual(["Great Eastern", "Prudential", "未具名保单"]);
    expect(rows[rows.length - 1].value).toBe("RM 14,400");
  });

  it("prints a dash where a policy has no sum assured rather than RM 0", () => {
    expect(rows.find((r) => r.label === "未具名保单")?.value).toBe("—");
  });
});

describe("premium burden", () => {
  it("flags a healthy share of income", () => {
    expect(premiumBurden(selectInsurance(payload(CONTENT)), 216_000)).toMatchObject({ band: "good" });
  });

  it("warns then fails as premium eats the budget", () => {
    const v = selectInsurance(payload({ ...CONTENT, annual_premium_total: 40_000 }));
    expect(premiumBurden(v, 216_000)?.band).toBe("warn");
    expect(premiumBurden(v, 150_000)?.band).toBe("bad");
  });

  it("declines to compute without an income figure", () => {
    expect(premiumBurden(selectInsurance(payload(CONTENT)), null)).toBeNull();
    expect(premiumBurden(selectInsurance(payload(CONTENT)), 0)).toBeNull();
  });
});
