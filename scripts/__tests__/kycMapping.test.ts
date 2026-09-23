import { describe, expect, it } from "vitest";
import {
  assetCashflowEntries, assetCashflowItems, kycAssetFields, kycExpenseEntry, kycExpenseItem,
  kycIncomeEntry, kycIncomeItem,
} from "../../api/_lib/kycMapping.js";

describe("KYC expenses", () => {
  it("files each sub-item under its exact category", () => {
    expect(kycExpenseEntry("household", { type: "Utilities Bills" }).category).toBe("utilities");
    expect(kycExpenseEntry("transportation", { type: "Car Insurance" }).category).toBe("motor_insurance");
    expect(kycExpenseEntry("household", { type: "All - Household" }).category).toBe("living_other");
  });
  it("stores the two yearly items as annual, without a review flag", () => {
    const e = kycExpenseEntry("personal", { type: "Vacation/ Travel" });
    expect(e).toMatchObject({ category: "travel", frequency: "annual", needs_review: false });
  });
  it("flags loan repayments for the P2 de-duplication", () => {
    const e = kycExpenseEntry("otherExpenses", { type: "Loan Repayment" });
    expect(e.category).toBe("debt_other");
    expect(e.needs_review).toBe(true);
  });
});

describe("KYC income", () => {
  it("uses current codes and makes the bonus annual", () => {
    expect(kycIncomeEntry("salary")).toEqual({ category: "salary_basic", frequency: "monthly" });
    expect(kycIncomeEntry("bonus")).toEqual({ category: "bonus", frequency: "annual" });
    expect(kycIncomeEntry("dividendCompany").category).toBe("dividend_company");
  });
});

describe("KYC assets", () => {
  it("reads 'other' by name and fills purpose and liquidity", () => {
    expect(kycAssetFields("other", "Gold bar 100g")).toMatchObject({
      asset_type: "gold", purpose: "investment", liquidity: "low", needs_review: false,
    });
    expect(kycAssetFields("own_residence", "Condo")).toMatchObject({
      asset_type: "own_residence", purpose: "personal_use", liquidity: "low",
    });
    expect(kycAssetFields("savings", "Maybank")).toMatchObject({ asset_type: "savings", liquidity: "high", purpose: null });
  });
  it("turns an asset's monthly inflow and outflow into linked rows", () => {
    const rows = assetCashflowEntries({ assetType: "investment_property", name: "Condo", monthlyIncome: 1800, monthlyExpenses: 300 });
    expect(rows).toEqual([
      { direction: "inflow", category: "rental_income", amount: 1800, needs_review: false, review_reason: null, source_note: "Condo (KYC)" },
      { direction: "outflow", category: "housing_other", amount: 300, needs_review: false, review_reason: null, source_note: "Condo (KYC)" },
    ]);
    const other = assetCashflowEntries({ assetType: "unit_trust", name: "Fund", monthlyIncome: 0, monthlyExpenses: 50 });
    expect(other).toEqual([
      { direction: "outflow", category: "other_expense", amount: 50, needs_review: true, review_reason: "请确认这笔资产相关支出的类别", source_note: "Fund (KYC)" },
    ]);
  });
});

// P2b: KYC now writes standing items (cashflow_items), not month rows. These
// item-shaped variants carry `name` where the entries shape carried
// `source_note` — everything else (category/frequency/needs_review) is
// identical, so they're tested against the same fixtures as above.
describe("KYC items (P2b cashflow_items shape)", () => {
  it("kycIncomeItem is the same mapping as kycIncomeEntry", () => {
    expect(kycIncomeItem("salary")).toEqual({ category: "salary_basic", frequency: "monthly" });
    expect(kycIncomeItem("bonus")).toEqual({ category: "bonus", frequency: "annual" });
  });

  it("kycExpenseItem classifies the same as kycExpenseEntry but returns `name` not `source_note`", () => {
    const item = kycExpenseItem("household", { type: "Utilities Bills" });
    expect(item).toEqual({ category: "utilities", frequency: "monthly", name: "Utilities Bills", needs_review: false, review_reason: null });
  });

  it("kycExpenseItem keeps the yearly-item and review-flag behaviour", () => {
    const yearly = kycExpenseItem("personal", { type: "Vacation/ Travel" });
    expect(yearly).toMatchObject({ category: "travel", frequency: "annual", needs_review: false });
    const loan = kycExpenseItem("otherExpenses", { type: "Loan Repayment" });
    expect(loan.category).toBe("debt_other");
    expect(loan.needs_review).toBe(true);
  });

  it("assetCashflowItems mirrors assetCashflowEntries with `name` in place of `source_note`", () => {
    const rows = assetCashflowItems({ assetType: "investment_property", name: "Condo", monthlyIncome: 1800, monthlyExpenses: 300 });
    expect(rows).toEqual([
      { direction: "inflow", category: "rental_income", amount: 1800, needs_review: false, review_reason: null, name: "Condo (KYC)" },
      { direction: "outflow", category: "housing_other", amount: 300, needs_review: false, review_reason: null, name: "Condo (KYC)" },
    ]);
  });
});
