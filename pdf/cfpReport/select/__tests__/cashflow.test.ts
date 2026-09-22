import { describe, it, expect } from "vitest";
import {
  selectCashflow, cashflowWaterfall, cashflowRows, expenseSlices,
} from "../cashflow";
import { foldTail } from "../../viz/Donut";
import type { CfpReportData } from "../../types";

function payload(content: Record<string, unknown> | null): CfpReportData {
  return {
    clientName: "T", advisorName: "A", period: "2026", generatedDate: "x",
    language: "zh", hasUnapproved: false, client: {}, baseline: null,
    sections: content ? [{ section_type: "cashflow_planning", status: "approved", content }] : [],
    assets: [], liabilities: [],
  };
}

const CONTENT = {
  insufficient_data: false,
  monthly_income: 18_000,
  monthly_expenses: 12_000,
  monthly_surplus: 4_500,
  annual_income: 216_000,
  annual_expenses: 144_000,
  annual_surplus: 54_000,
  asset_transfers_monthly: 1_500,
  savings_ratio: 0.25,
  income_breakdown: [
    { category: "薪资", monthly_amount: 16_000, share: 0.889 },
    { category: "租金收入", monthly_amount: 2_000, share: 0.111 },
  ],
  expense_breakdown: [
    { category: "房贷", monthly_amount: 4_200, share: 0.35 },
    { category: "生活开销", monthly_amount: 3_000, share: 0.25 },
    { category: "车贷", monthly_amount: 1_800, share: 0.15 },
    { category: "保费", monthly_amount: 1_200, share: 0.1 },
    { category: "教育", monthly_amount: 900, share: 0.075 },
    { category: "娱乐", monthly_amount: 600, share: 0.05 },
    { category: "其他杂项", monthly_amount: 300, share: 0.025 },
  ],
  emergency_fund: {
    need_low: 36_000, need_high: 72_000, actual: 96_000,
    months_covered: 8, shortfall: 0, status: "sufficient",
  },
};

describe("reading the section", () => {
  const v = selectCashflow(payload(CONTENT));

  it("pulls the headline figures", () => {
    expect(v.hasData).toBe(true);
    expect(v.monthlyIncome).toBe(18_000);
    expect(v.monthlySurplus).toBe(4_500);
    expect(v.assetTransfersMonthly).toBe(1_500);
  });

  it("sorts categories biggest first", () => {
    expect(v.expenses.map((r) => r.category)).toEqual([
      "房贷", "生活开销", "车贷", "保费", "教育", "娱乐", "其他杂项",
    ]);
  });

  it("keeps the emergency fund block", () => {
    expect(v.emergency).toMatchObject({ actual: 96_000, monthsCovered: 8, status: "sufficient" });
  });

  it("returns an empty view rather than throwing when the section is absent", () => {
    const e = selectCashflow(payload(null));
    expect(e.hasData).toBe(false);
    expect(e.expenses).toEqual([]);
    expect(e.emergency).toBeNull();
  });

  it("treats insufficient_data as no data", () => {
    expect(selectCashflow(payload({ ...CONTENT, insufficient_data: true })).hasData).toBe(false);
  });

  it("drops zero and negative categories rather than drawing empty slices", () => {
    const v2 = selectCashflow(payload({
      ...CONTENT,
      expense_breakdown: [
        { category: "房贷", monthly_amount: 4_200, share: 1 },
        { category: "空类别", monthly_amount: 0, share: 0 },
      ],
    }));
    expect(v2.expenses.map((r) => r.category)).toEqual(["房贷"]);
  });

  it("labels a blank category rather than printing an empty cell", () => {
    const v2 = selectCashflow(payload({
      ...CONTENT, expense_breakdown: [{ category: "  ", monthly_amount: 100, share: 1 }],
    }));
    expect(v2.expenses[0].category).toBe("未分类");
  });

  it("prints the Chinese label for a taxonomy code, not the raw code", () => {
    const v2 = selectCashflow(payload({
      ...CONTENT,
      expense_breakdown: [
        { category: "groceries", monthly_amount: 100, share: 0.6 },
        { category: "household", monthly_amount: 50, share: 0.3 },
      ],
    }));
    expect(v2.expenses.map((r) => r.category)).toEqual(["杂货/菜市", "其他日常"]);
  });
});

describe("waterfall", () => {
  it("steps income down through expenses and transfers to the surplus", () => {
    const steps = cashflowWaterfall(selectCashflow(payload(CONTENT)));
    expect(steps.map((s) => s.label)).toEqual(["月收入", "月支出", "资产转移", "月结余"]);
    expect(steps[0].delta).toBe(18_000);
    expect(steps[1].delta).toBe(-12_000);
    expect(steps[2].delta).toBe(-1_500);
    expect(steps[steps.length - 1].isTotal).toBe(true);
  });

  it("omits the transfer step when the client moves nothing", () => {
    const steps = cashflowWaterfall(selectCashflow(payload({ ...CONTENT, asset_transfers_monthly: 0 })));
    expect(steps.map((s) => s.label)).toEqual(["月收入", "月支出", "月结余"]);
  });

  it("draws nothing when there is no data", () => {
    expect(cashflowWaterfall(selectCashflow(payload(null)))).toEqual([]);
  });
});

describe("detail table", () => {
  const rows = cashflowRows(selectCashflow(payload(CONTENT)));

  it("groups income and expenses, each with a subtotal, and closes on the net", () => {
    expect(rows.filter((r) => r.kind === "group").map((r) => r.label))
      .toEqual(["收入", "支出", "资产转移（非支出）"]);
    expect(rows.filter((r) => r.kind === "subtotal")).toHaveLength(2);
    const total = rows[rows.length - 1];
    expect(total.kind).toBe("total");
    expect(total.label).toBe("月净结余");
  });

  it("prints outflows as accounting negatives", () => {
    expect(rows.find((r) => r.label === "房贷")?.value).toBe("(RM 4,200)");
    expect(rows.find((r) => r.label === "月支出合计")?.value).toBe("(RM 12,000)");
  });

  it("keeps asset transfers out of the expense subtotal", () => {
    // 12,000 of real spending; the 1,500 transfer is reported separately, so the
    // expense subtotal must not absorb it.
    expect(rows.find((r) => r.label === "月支出合计")?.value).toBe("(RM 12,000)");
    expect(rows.find((r) => r.label === "转入自有资产")?.value).toBe("(RM 1,500)");
  });
});

describe("donut slices", () => {
  it("carries every expense category through", () => {
    expect(expenseSlices(selectCashflow(payload(CONTENT)))).toHaveLength(7);
  });

  it("folds the long tail so the ring stays readable", () => {
    const folded = foldTail(expenseSlices(selectCashflow(payload(CONTENT))), 6);
    expect(folded).toHaveLength(6);
    expect(folded[folded.length - 1].label).toBe("其他");
    // folding must not lose money
    const before = expenseSlices(selectCashflow(payload(CONTENT))).reduce((s, x) => s + x.value, 0);
    expect(folded.reduce((s, x) => s + x.value, 0)).toBe(before);
  });

  it("leaves a short list untouched", () => {
    const short = [{ label: "a", value: 1 }, { label: "b", value: 2 }];
    expect(foldTail(short, 6)).toEqual(short);
  });
});

// ---------------------------------------------------------------------------
// 年化基准 — printed on P6 so the client can see what "RM 1,420 a month" was
// derived from. The shape is written by computeBaseline in
// supabase/functions/cfp-brain/baseline.ts; these tests pin the reading of it.
// ---------------------------------------------------------------------------

function withBasis(basis: unknown, months?: number, withData?: number[]): CfpReportData {
  return {
    clientName: "T", advisorName: "A", period: "2026", generatedDate: "x",
    language: "zh", hasUnapproved: false, client: {},
    baseline: {
      cashflow_basis: basis,
      cashflow_basis_months: months,
      cashflow_months_with_data: withData,
    },
    sections: [], assets: [], liabilities: [],
  } as unknown as CfpReportData;
}

describe("the annualisation basis reaches the page", () => {
  it("reads as a range when the plan spans months", () => {
    const v = selectCashflow(withBasis({ year: 2026, from_month: 6, to_month: 7 }, 2, [6, 7]));
    expect(v.basisLabel).toBe("2026 年 6–7 月");
    expect(v.basisHasGap).toBe(false);
  });

  it("reads as a single month when the advisor narrowed it", () => {
    const v = selectCashflow(withBasis({ year: 2026, from_month: 6, to_month: 6 }, 1, [6]));
    expect(v.basisLabel).toBe("2026 年 6 月");
  });

  it("flags a window holding months with no entries", () => {
    // A twelve-month window with two months of data is not a twelve-month
    // average, and the report says so rather than letting the reader assume.
    const v = selectCashflow(withBasis({ year: 2026, from_month: 1, to_month: 12 }, 12, [6, 7]));
    expect(v.basisHasGap).toBe(true);
  });

  it("says nothing at all when there is no basis, rather than inventing one", () => {
    expect(selectCashflow(withBasis(null)).basisLabel).toBeNull();
    expect(selectCashflow(withBasis(undefined)).basisLabel).toBeNull();
  });

  it("survives a baseline written before the basis existed", () => {
    // Every report generated before this change has no cashflow_basis at all.
    const v = selectCashflow(withBasis({ year: "nonsense" }));
    expect(v.basisLabel).toBeNull();
    expect(v.basisHasGap).toBe(false);
  });
});
