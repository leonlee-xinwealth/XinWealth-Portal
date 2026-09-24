import { describe, it, expect } from "vitest";
import {
  selectCashflow, cashflowWaterfall, cashflowRows, expenseSlices,
  autoItemRows, oneOffRows, takeHomeWaterfallRows,
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

function payloadWithBaseline(
  content: Record<string, unknown> | null,
  baseline: Record<string, unknown> | null,
): CfpReportData {
  return {
    clientName: "T", advisorName: "A", period: "2026", generatedDate: "x",
    language: "zh", hasUnapproved: false, client: {}, baseline,
    sections: content ? [{ section_type: "cashflow_planning", status: "approved", content }] : [],
    assets: [], liabilities: [],
  } as unknown as CfpReportData;
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

// ---------------------------------------------------------------------------
// P2b 决策 1/4/6 — the plan basis line, statutory EPF/SOCSO-EIS, disposable
// surplus, auto-included installments/premiums/statutory items, and one_off
// items. Everything here lives on `financial_reports.baseline`
// (FinancialBaseline), not the section content — see baseline.ts and
// derived.ts in supabase/functions/cfp-brain.
// ---------------------------------------------------------------------------

const DERIVED_ITEMS = [
  {
    key: "liability:mortgage-1", source_type: "liability", source_id: "mortgage-1",
    source_name: "住宅房贷", category: "mortgage_installment", direction: "outflow",
    monthly_amount: 4_200, interest_monthly: 3_050, principal_monthly: 1_150,
    estimated: [], warnings: [],
  },
  {
    key: "policy:ge-life", source_type: "policy", source_id: "policy-1",
    source_name: "Great Eastern 终身寿险", category: "life_takaful", direction: "outflow",
    monthly_amount: 400, interest_monthly: 0, principal_monthly: 0,
    estimated: [], warnings: [],
  },
  {
    key: "statutory:epf_employee", source_type: "statutory", source_id: null,
    source_name: "EPF（雇员）", category: "epf_employee", direction: "outflow",
    monthly_amount: 1_760, interest_monthly: 0, principal_monthly: 0,
    estimated: ["statutory_rate"], warnings: ["按法定比例估算"],
  },
];

describe("plan basis line", () => {
  it("reads the items-path sentence with the as-of month", () => {
    const v = selectCashflow(payloadWithBaseline(CONTENT, {
      cashflow_source: "items", items_as_of: "2026-08-01",
    }));
    expect(v.cashflowSource).toBe("items");
    expect(v.planBasisLine).toBe("依据：常设项目（截至 2026-08）");
  });

  it("reads the actuals-path sentence from the same basis the old basisLabel uses", () => {
    const v = selectCashflow(payloadWithBaseline(CONTENT, {
      cashflow_source: "actuals",
      cashflow_basis: { year: 2026, from_month: 6, to_month: 7 },
      cashflow_basis_months: 2,
      cashflow_months_with_data: [6, 7],
    }));
    expect(v.cashflowSource).toBe("actuals");
    expect(v.planBasisLine).toBe("依据：实际记录年化（2026 年 6–7 月）");
  });

  it("says nothing on a baseline written before cashflow_source existed", () => {
    const v = selectCashflow(payloadWithBaseline(CONTENT, { net_worth: 100 }));
    expect(v.cashflowSource).toBeNull();
    expect(v.planBasisLine).toBeNull();
  });

  it("says nothing at all without a baseline", () => {
    const v = selectCashflow(payload(CONTENT));
    expect(v.cashflowSource).toBeNull();
    expect(v.planBasisLine).toBeNull();
  });
});

describe("statutory EPF/SOCSO-EIS and disposable surplus", () => {
  it("reads the statutory figures and disposable surplus off the baseline", () => {
    const v = selectCashflow(payloadWithBaseline(CONTENT, {
      monthly_employee_epf: 1_760, monthly_employer_epf: 2_080,
      monthly_socso_eis: 112, annual_disposable_surplus: 32_880,
    }));
    expect(v.employeeEpfMonthly).toBe(1_760);
    expect(v.employerEpfMonthly).toBe(2_080);
    expect(v.socsoEisMonthly).toBe(112);
    expect(v.disposableSurplusAnnual).toBe(32_880);
  });

  it("defaults to 0/null rather than throwing without a baseline", () => {
    const v = selectCashflow(payload(CONTENT));
    expect(v.employeeEpfMonthly).toBe(0);
    expect(v.employerEpfMonthly).toBe(0);
    expect(v.socsoEisMonthly).toBe(0);
    expect(v.disposableSurplusAnnual).toBeNull();
  });
});

describe("auto-included items", () => {
  it("carries every derived item with its category label and estimated flag", () => {
    const v = selectCashflow(payloadWithBaseline(CONTENT, { derived_items: DERIVED_ITEMS }));
    expect(v.autoItems).toHaveLength(3);
    const loan = v.autoItems.find((a) => a.sourceType === "liability")!;
    expect(loan.sourceName).toBe("住宅房贷");
    expect(loan.categoryLabel).toBe("房贷月供");
    expect(loan.principalMonthly).toBe(1_150);
    expect(loan.interestMonthly).toBe(3_050);
    expect(loan.estimated).toBe(false);

    const statutory = v.autoItems.find((a) => a.sourceType === "statutory")!;
    expect(statutory.estimated).toBe(true);
    expect(statutory.principalMonthly).toBeNull();

    const premium = v.autoItems.find((a) => a.sourceType === "policy")!;
    expect(premium.principalMonthly).toBeNull();
    expect(premium.interestMonthly).toBeNull();
  });

  it("is empty on a baseline with no derived_items", () => {
    expect(selectCashflow(payloadWithBaseline(CONTENT, {})).autoItems).toEqual([]);
    expect(selectCashflow(payload(CONTENT)).autoItems).toEqual([]);
  });

  it("builds a table row per item, tagging estimated ones and splitting loan 本金/利息", () => {
    const v = selectCashflow(payloadWithBaseline(CONTENT, { derived_items: DERIVED_ITEMS }));
    const rows = autoItemRows(v);
    expect(rows).toHaveLength(3);
    const loanRow = rows.find((r) => r.label === "住宅房贷")!;
    expect(loanRow.meta).toContain("本金");
    expect(loanRow.meta).toContain("利息");
    expect(loanRow.meta).not.toContain("估算");
    const statutoryRow = rows.find((r) => r.label === "EPF（雇员）")!;
    expect(statutoryRow.meta).toContain("估算");
  });

  it("returns nothing to render when there are no auto items", () => {
    expect(autoItemRows(selectCashflow(payload(CONTENT)))).toEqual([]);
  });
});

describe("one-off items", () => {
  const CONTENT_WITH_ONE_OFF = {
    ...CONTENT,
    one_off_items: [
      { category: "asset_purchase", name: "家庭装修", amount: 15_000, direction: "outflow", effective_from: "2026-09-01" },
    ],
  };

  it("reads one_off_items off the section content", () => {
    const v = selectCashflow(payload(CONTENT_WITH_ONE_OFF));
    expect(v.oneOffItems).toHaveLength(1);
    expect(v.oneOffItems[0]).toMatchObject({ name: "家庭装修", amount: 15_000, direction: "outflow", month: "2026-09" });
  });

  it("prints an outflow as a negative and an inflow as a positive", () => {
    const rows = oneOffRows(selectCashflow(payload(CONTENT_WITH_ONE_OFF)));
    expect(rows[0].value).toBe("(RM 15,000)");

    const inflowContent = {
      ...CONTENT,
      one_off_items: [{ category: "other_income", name: "退税", amount: 2_000, direction: "inflow", effective_from: "2026-05-01" }],
    };
    const inflowRows = oneOffRows(selectCashflow(payload(inflowContent)));
    expect(inflowRows[0].value).toBe("RM 2,000");
  });

  it("is empty when the content has none", () => {
    expect(selectCashflow(payload(CONTENT)).oneOffItems).toEqual([]);
    expect(oneOffRows(selectCashflow(payload(CONTENT)))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P2b followup (WEI QI LEE case) — the take-home / net-cash-flow waterfall.
// Lives on `financial_reports.baseline`, not the section content — see
// computeBaseline in supabase/functions/cfp-brain/baseline.ts.
// ---------------------------------------------------------------------------

const TAKE_HOME_BASELINE = {
  monthly_income_tax: 0,
  monthly_statutory: 17.85,
  monthly_take_home: 2_275.15,
  monthly_living: 2_968,
  monthly_savable: -692.85,
  monthly_planned_savings: 0,
  monthly_net_cash_flow: -692.85,
};

describe("take-home waterfall", () => {
  it("reads every figure off the baseline verbatim", () => {
    const v = selectCashflow(payloadWithBaseline(CONTENT, TAKE_HOME_BASELINE));
    expect(v.takeHome).toEqual({
      incomeTaxMonthly: 0,
      statutoryMonthly: 17.85,
      takeHomeMonthly: 2_275.15,
      livingMonthly: 2_968,
      savableMonthly: -692.85,
      plannedSavingsMonthly: 0,
      netCashFlowMonthly: -692.85,
    });
  });

  it("is null on a baseline written before these fields existed — legacy reports hide the block", () => {
    expect(selectCashflow(payloadWithBaseline(CONTENT, {})).takeHome).toBeNull();
    expect(selectCashflow(payload(CONTENT)).takeHome).toBeNull();
    expect(takeHomeWaterfallRows(selectCashflow(payload(CONTENT)))).toEqual([]);
  });

  it("builds the seven-step compact waterfall, tax+statutory and savings as negatives, ending on net cash flow", () => {
    const v = selectCashflow(payloadWithBaseline(CONTENT, TAKE_HOME_BASELINE));
    const rows = takeHomeWaterfallRows(v);
    expect(rows.map((r) => r.label)).toEqual([
      "总收入", "税与法定扣款", "实得收入", "开销", "可储蓄金额", "定期储蓄/投资", "净现金流",
    ]);
    expect(rows[0].value).toBe(`RM ${CONTENT.monthly_income.toLocaleString()}`);
    expect(rows[1].value).toBe("(RM 18)"); // 17.85 statutory + 0 tax, rounded
    expect(rows[2].value).toBe("RM 2,275");
    expect(rows[3].value).toBe("(RM 2,968)");
    expect(rows[6].label).toBe("净现金流");
    expect(rows[6].kind).toBe("total");
    expect(rows[6].value).toBe("(RM 693)");
  });

  it("shows a positive net cash flow without parentheses", () => {
    const v = selectCashflow(payloadWithBaseline(CONTENT, {
      ...TAKE_HOME_BASELINE, monthly_savable: 500, monthly_net_cash_flow: 500,
    }));
    const rows = takeHomeWaterfallRows(v);
    expect(rows[6].value).toBe("RM 500");
  });
});
