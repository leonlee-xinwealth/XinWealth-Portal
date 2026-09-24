import { describe, expect, it } from "vitest";
import {
  MONTH_NAMES, buildCurrentPlan, buildDerivedExpenseRecords, isSupersededOutflow, latestMonthYear, legacyHoldings,
} from "../../api/_lib/portalDerived.js";

describe("latestMonthYear", () => {
  it("falls back to today's month/year when there are no dated expense records", () => {
    const today = new Date("2026-03-15T00:00:00Z");
    expect(latestMonthYear([], today)).toEqual({ month: "March", year: "2026" });
    expect(latestMonthYear(undefined, today)).toEqual({ month: "March", year: "2026" });
  });

  it("picks the most recent Year, then the most recent Month within it — mirrors apiService.getLatestRecords", () => {
    const records = [
      { fields: { Year: "2025", Month: "December" } },
      { fields: { Year: "2026", Month: "June" } },
      { fields: { Year: "2026", Month: "July" } },
    ];
    expect(latestMonthYear(records)).toEqual({ month: "July", year: "2026" });
  });

  it("ignores records with no Year/Month when picking the latest", () => {
    const records = [
      { fields: { Description: "no date" } },
      { fields: { Year: "2024", Month: "January" } },
    ];
    expect(latestMonthYear(records)).toEqual({ month: "January", year: "2024" });
  });

  it("exposes the same month-name order apiService.ts sorts by", () => {
    expect(MONTH_NAMES[0]).toBe("January");
    expect(MONTH_NAMES[11]).toBe("December");
  });
});

describe("isSupersededOutflow", () => {
  const liabilities = [{ liability_type: "car_loan", outstanding_balance: 10000 }];
  it("flags a manual O2-split row the client also has a matching liability for", () => {
    expect(isSupersededOutflow({ direction: "outflow", category: "car_installment" }, liabilities, [])).toBe(true);
  });
  it("never flags an inflow row, even with a matching category", () => {
    expect(isSupersededOutflow({ direction: "inflow", category: "car_installment" }, liabilities, [])).toBe(false);
  });
  it("leaves an unrelated category alone", () => {
    expect(isSupersededOutflow({ direction: "outflow", category: "groceries" }, liabilities, [])).toBe(false);
  });
});

describe("legacyHoldings", () => {
  it("keeps a holding whose account isn't in the accounts list at all", () => {
    const holdings = [{ account_id: "acct-1", market_value: 100 }];
    expect(legacyHoldings(holdings, [])).toEqual(holdings);
  });

  it("keeps a holding whose account has no asset_id yet (not migrated)", () => {
    const holdings = [{ account_id: "acct-1", market_value: 100 }];
    const accounts = [{ id: "acct-1", asset_id: null }];
    expect(legacyHoldings(holdings, accounts)).toEqual(holdings);
  });

  it("drops a holding whose account has an asset_id — already folded into assets", () => {
    const holdings = [{ account_id: "acct-1", market_value: 100 }];
    const accounts = [{ id: "acct-1", asset_id: "asset-1" }];
    expect(legacyHoldings(holdings, accounts)).toEqual([]);
  });

  it("mixed: only the migrated account's holding is dropped", () => {
    const holdings = [
      { account_id: "acct-1", market_value: 100 },
      { account_id: "acct-2", market_value: 200 },
    ];
    const accounts = [
      { id: "acct-1", asset_id: "asset-1" },
      { id: "acct-2", asset_id: null },
    ];
    expect(legacyHoldings(holdings, accounts)).toEqual([{ account_id: "acct-2", market_value: 200 }]);
  });

  it("handles null/undefined holdings and accounts without throwing", () => {
    expect(legacyHoldings(undefined, undefined)).toEqual([]);
    expect(legacyHoldings(null, null)).toEqual([]);
  });
});

describe("buildDerivedExpenseRecords", () => {
  it("stamps one record per liability/policy with the given Month/Year, in the portal's expense shape", () => {
    const records = buildDerivedExpenseRecords({
      liabilities: [
        { id: "liab-1", name: "Maybank Mortgage", liability_type: "mortgage", outstanding_balance: 300000, interest_rate: 4.2, monthly_payment: 1500 },
      ],
      policies: [
        { id: "pol-1", plan_name: "AIA Life", policy_type: "life", premium: 1200, premium_frequency: "annual" },
      ],
      month: "June",
      year: "2026",
      today: new Date("2026-06-15T00:00:00Z"),
    });

    expect(records).toHaveLength(2);
    const loanRow = records.find((r) => r.id === "liability:liab-1");
    expect(loanRow?.fields).toMatchObject({
      Type: "Loan Repayment",
      Description: "Maybank Mortgage",
      Amount: 1500,
      Month: "June",
      Year: "2026",
    });
    const premiumRow = records.find((r) => r.id === "policy:pol-1");
    expect(premiumRow?.fields.Description).toBe("AIA Life");
    expect(premiumRow?.fields.Amount).toBeCloseTo(100, 2); // 1200/yr -> 100/mo
    expect(premiumRow?.fields.Month).toBe("June");
    expect(premiumRow?.fields.Year).toBe("2026");
  });

  it("produces nothing for an empty liabilities/policies list", () => {
    expect(buildDerivedExpenseRecords({ liabilities: [], policies: [], month: "June", year: "2026" })).toEqual([]);
  });
});

// P2b followup (cash-flow-correctness fix): buildCurrentPlan exposes
// take-home/statutory/living/savable/planned-savings/net-cash-flow, straight
// off planCashflow's own fields — same fixture and figures as the plan's
// Verification section and supabase/functions/_shared/finance/derived.test.ts's
// own "乙 full waterfall" test.
describe("buildCurrentPlan", () => {
  const today = new Date("2026-06-15T00:00:00Z");
  const weiQiLeeItems = [
    { direction: "inflow", category: "salary_basic", amount: 2577, frequency: "monthly", effective_from: "2026-01-01" },
    { direction: "outflow", category: "groceries", amount: 1548, frequency: "monthly", effective_from: "2026-01-01" },
  ];
  const weiQiLeeLiabilities = [
    { liability_type: "car_loan", outstanding_balance: 10000, interest_rate: 3, monthly_payment: 420, rate_type: "flat" },
    { liability_type: "personal_loan", outstanding_balance: 130000, interest_rate: 12, monthly_payment: 1000 },
  ];

  it("乙 has_epf=true: take-home 2,275.15, living 2,968, savable/net -692.85", () => {
    const current = buildCurrentPlan({
      rows: [],
      liabilities: weiQiLeeLiabilities,
      policies: [],
      items: weiQiLeeItems,
      client: { has_epf: true, date_of_birth: null },
      today,
    });

    expect(current.source).toBe("items");
    expect(current.monthly_employee_epf).toBe(284);
    expect(current.monthly_socso_eis).toBeCloseTo(17.85, 2);
    expect(current.monthly_income_tax).toBe(0); // wiped out by the RM400 rebate
    expect(current.monthly_statutory).toBeCloseTo(301.85, 2);
    expect(current.monthly_take_home).toBeCloseTo(2275.15, 2);
    expect(current.monthly_living).toBeCloseTo(2968, 2);
    expect(current.monthly_savable).toBeCloseTo(-692.85, 2);
    expect(current.monthly_planned_savings).toBe(0);
    expect(current.monthly_net_cash_flow).toBeCloseTo(-692.85, 2);
  });

  it("乙 has_epf=false: no statutory deductions, net cash flow -391", () => {
    const current = buildCurrentPlan({
      rows: [],
      liabilities: weiQiLeeLiabilities,
      policies: [],
      items: weiQiLeeItems,
      client: { has_epf: false, date_of_birth: null },
      today,
    });

    expect(current.monthly_employee_epf).toBe(0);
    expect(current.monthly_socso_eis).toBe(0);
    expect(current.monthly_statutory).toBe(0);
    expect(current.monthly_income_tax).toBe(0);
    expect(current.monthly_take_home).toBeCloseTo(2577, 2);
    expect(current.monthly_living).toBeCloseTo(2968, 2);
    expect(current.monthly_net_cash_flow).toBeCloseTo(-391, 2);
  });

  it("a client with no standing items falls back to the actuals path and still fills every new field", () => {
    const current = buildCurrentPlan({
      rows: [
        { direction: "inflow", amount: 5000, frequency: "monthly", period_month: "2026-06-01", category: "salary_basic" },
        { direction: "outflow", amount: 600, frequency: "monthly", period_month: "2026-06-01", category: "income_tax" },
      ],
      liabilities: [],
      policies: [],
      items: [],
      client: { has_epf: true, date_of_birth: null },
      today,
    });

    expect(current.source).toBe("actuals");
    expect(current.monthly_statutory).toBe(0); // actuals path never derives statutory
    expect(current.monthly_income_tax).toBe(600); // only ever a manual row on this path
    expect(current.monthly_take_home).toBeCloseTo(5000 - 600, 2);
  });
});
