import { describe, expect, it } from "vitest";
import { assetCategory, cashflowLabel } from "../../api/_lib/portalLabels.js";

describe("client-portal labels", () => {
  it("keeps the exact strings services/apiService.ts keys off", () => {
    expect(cashflowLabel("inflow", "bonus")).toBe("Annual Bonus");
    expect(cashflowLabel("inflow", "rental_income")).toBe("Rental Income");
    expect(cashflowLabel("inflow", "dividend_investment")).toBe("Dividend Income");
    expect(cashflowLabel("outflow", "travel")).toBe("Vacation/ Travel");
    expect(cashflowLabel("outflow", "income_tax")).toBe("Income Tax Expense");
    expect(cashflowLabel("outflow", "mortgage_installment")).toBe("Loan Repayment");
    expect(cashflowLabel("outflow", "loan_repayment")).toBe("Loan Repayment");
  });
  it("labels everything else from the taxonomy", () => {
    expect(cashflowLabel("outflow", "groceries")).toBe("Groceries");
    expect(cashflowLabel("outflow", "household")).toBe("Other daily living");
    expect(cashflowLabel("outflow", "mystery")).toBe("mystery");
    expect(cashflowLabel("outflow", null)).toBe("Expense");
  });
  it("labels assets, keeping the portal's EPF wording", () => {
    expect(assetCategory("epf_account_1")).toBe("EPF Account 1 (Akaun Persaraan)");
    expect(assetCategory("gold")).toBe("Gold / precious metals");
    expect(assetCategory(null)).toBe("Other");
  });
});
