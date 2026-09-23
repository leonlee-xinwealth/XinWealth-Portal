import { describe, expect, it } from "vitest";
import {
  MONTH_NAMES, buildDerivedExpenseRecords, isSupersededOutflow, latestMonthYear, legacyHoldings,
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
