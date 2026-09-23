// Smoke test: the P2a loan/derived-items functions survive the esbuild bundle
// that plain-JS Vercel functions (api/*.js) actually import at runtime.
// See scripts/build-taxonomy.mjs and taxonomyBundle.test.ts for why this
// bundle exists and how it's kept in sync with the .ts sources.
import { describe, expect, it } from "vitest";
import * as taxonomy from "../../api/_lib/taxonomy.mjs";

describe("linked obligations in the committed taxonomy bundle", () => {
  it("exports the P2a loan estimator and cash-flow planner", () => {
    expect(typeof taxonomy.estimateLoan).toBe("function");
    expect(typeof taxonomy.planCashflow).toBe("function");
    expect(typeof taxonomy.deriveLoanItems).toBe("function");
    expect(typeof taxonomy.derivePremiumItems).toBe("function");
  });

  it("estimateLoan computes a sane mortgage payment from defaults alone", () => {
    const est = taxonomy.estimateLoan({ liability_type: "mortgage", outstanding_balance: 300000 });
    expect(est.rate_type).toBe("reducing");
    expect(est.monthly_payment).toBeGreaterThan(0);
  });

  it("planCashflow reproduces the 乙 paper-drill deficit (~ -1224.33/month)", () => {
    const result = taxonomy.planCashflow({
      rows: [
        { direction: "inflow", amount: 2577, frequency: "monthly", period_month: "2026-06-01", category: "salary_basic" },
        { direction: "outflow", amount: 1548, frequency: "monthly", period_month: "2026-06-01", category: "groceries" },
      ],
      liabilities: [
        { liability_type: "car_loan", outstanding_balance: 10000, interest_rate: 3, monthly_payment: 420, rate_type: "flat" },
        { liability_type: "personal_loan", outstanding_balance: 130000, interest_rate: 12, monthly_payment: 1000 },
      ],
      policies: [{ policy_type: "investment_linked", premium: 10000, premium_frequency: "annual" }],
      basis: { year: 2026, from_month: 6, to_month: 6 },
      today: new Date("2026-06-01T00:00:00Z"),
    });
    const surplus = result.totals.monthly_income - result.totals.monthly_expenses;
    expect(surplus).toBeCloseTo(-1224.33, 2);
  });
});
