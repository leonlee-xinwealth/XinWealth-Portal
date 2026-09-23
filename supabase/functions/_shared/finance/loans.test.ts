import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { estimateLoan, LOAN_DEFAULTS, type LoanInput } from "./loans.ts";

const TODAY = new Date("2026-06-01T00:00:00Z");

Deno.test("zero balance → all zeros, no warnings", () => {
  const est = estimateLoan({ liability_type: "mortgage", outstanding_balance: 0 }, TODAY);
  assertEquals(est.monthly_payment, 0);
  assertEquals(est.annual_rate_pct, 0);
  assertEquals(est.remaining_months, 0);
  assertEquals(est.interest_monthly, 0);
  assertEquals(est.principal_monthly, 0);
  assertEquals(est.estimated, []);
  assertEquals(est.warnings, []);
});

Deno.test("policy_loan produces no cash flow", () => {
  const est = estimateLoan({ liability_type: "policy_loan", outstanding_balance: 50000, interest_rate: 6 }, TODAY);
  assertEquals(est.monthly_payment, 0);
  assertEquals(est.interest_monthly, 0);
  assertEquals(est.principal_monthly, 0);
  assertEquals(est.estimated, []);
  assertEquals(est.warnings, []);
});

Deno.test("unknown liability_type falls back to `other` defaults", () => {
  const known = estimateLoan({ liability_type: "other", outstanding_balance: 10000 }, TODAY);
  const unknown = estimateLoan({ liability_type: "some_new_type", outstanding_balance: 10000 }, TODAY);
  assertEquals(unknown.annual_rate_pct, known.annual_rate_pct);
  assertEquals(unknown.remaining_months, known.remaining_months);
  assertAlmostEquals(unknown.monthly_payment, known.monthly_payment, 0.01);
  assertEquals(unknown.rate_type, "reducing");
});

// ---------------------------------------------------------------------------
// Every default value (决策 2 table): balance only given, everything else
// (rate, months, rate_type) comes from LOAN_DEFAULTS, and all three end up
// estimated.
// ---------------------------------------------------------------------------

const DEFAULT_CASES: Array<[string, number, number | null, string]> = [
  ["mortgage", 4.2, 300, "reducing"],
  ["car_loan", 3.0, 60, "flat"],
  ["personal_loan", 8, 60, "reducing"],
  ["study_loan", 1, 120, "reducing"],
  ["renovation_loan", 7, 60, "reducing"],
  ["business_loan", 7, 60, "reducing"],
  ["asb_financing", 4.5, 120, "reducing"],
  ["family_loan", 0, 36, "reducing"],
  ["bnpl", 0, 6, "reducing"],
  ["tax_payable", 0, 12, "reducing"],
  ["other", 6, 60, "reducing"],
  ["credit_card", 18, null, "revolving"],
  ["overdraft", 8, null, "interest_only"],
  ["share_margin", 6, null, "interest_only"],
];

Deno.test("every LOAN_DEFAULTS entry matches the spec table", () => {
  for (const [type, rate, months, rateType] of DEFAULT_CASES) {
    const d = LOAN_DEFAULTS[type];
    assert(d, `${type} should have a default entry`);
    assertEquals(d!.rate_pct, rate, `${type} rate_pct`);
    assertEquals(d!.months, months, `${type} months`);
    assertEquals(d!.rate_type, rateType, `${type} rate_type`);
  }
  assertEquals(LOAN_DEFAULTS.policy_loan, null);
});

Deno.test("balance-only input uses defaults for rate, months, rate_type and payment", () => {
  for (const [type, rate, months, rateType] of DEFAULT_CASES) {
    const est = estimateLoan({ liability_type: type, outstanding_balance: 20000 }, TODAY);
    assertEquals(est.rate_type, rateType, `${type} rate_type`);
    assertEquals(est.annual_rate_pct, rate, `${type} annual_rate_pct`);
    assert(est.estimated.includes("interest_rate"), `${type} should mark interest_rate estimated`);
    if (rateType === "reducing" || rateType === "flat") {
      assertEquals(est.remaining_months, months, `${type} remaining_months`);
      assert(est.estimated.includes("remaining_months"), `${type} should mark remaining_months estimated`);
    } else {
      // revolving / interest_only: no term, nothing to estimate for months.
      assertEquals(est.remaining_months, null, `${type} remaining_months`);
      assert(!est.estimated.includes("remaining_months"));
    }
    assert(est.estimated.includes("monthly_payment"), `${type} should mark monthly_payment estimated`);
    assert(est.monthly_payment > 0, `${type} should produce a positive payment`);
  }
});

// ---------------------------------------------------------------------------
// Reducing: 有余额+利率+期数 → 算月供
// ---------------------------------------------------------------------------

Deno.test("reducing: balance+rate+months computes the standard amortised payment", () => {
  // Textbook check: RM100,000 @ 6%/yr over 120 months.
  const est = estimateLoan(
    { liability_type: "personal_loan", outstanding_balance: 100000, interest_rate: 6, remaining_months: 120 },
    TODAY,
  );
  const r = 0.06 / 12;
  const expectedPayment = (100000 * r) / (1 - Math.pow(1 + r, -120));
  assertAlmostEquals(est.monthly_payment, Math.round(expectedPayment * 100) / 100, 0.01);
  assertEquals(est.estimated, ["monthly_payment"]);
  assertEquals(est.remaining_months, 120);
  assertAlmostEquals(est.interest_monthly, 100000 * r, 0.01);
});

// ---------------------------------------------------------------------------
// Reducing: 有余额+月供+期数 → 二分法反推利率
// ---------------------------------------------------------------------------

Deno.test("reducing: balance+payment+months solves for the rate by bisection", () => {
  const knownRate = 6;
  const rMonthly = knownRate / 1200;
  const months = 120;
  const balance = 100000;
  const payment = Math.round(((balance * rMonthly) / (1 - Math.pow(1 + rMonthly, -months))) * 100) / 100;

  const est = estimateLoan(
    { liability_type: "personal_loan", outstanding_balance: balance, monthly_payment: payment, remaining_months: months },
    TODAY,
  );
  assertAlmostEquals(est.annual_rate_pct, knownRate, 0.05);
  assertEquals(est.estimated, ["interest_rate"]);
  assertEquals(est.monthly_payment, payment);
});

// ---------------------------------------------------------------------------
// Reducing: 有余额+利率+月供 → 推期数
// ---------------------------------------------------------------------------

Deno.test("reducing: balance+rate+payment derives the remaining months", () => {
  const balance = 100000;
  const rate = 6;
  const rMonthly = rate / 1200;
  const knownMonths = 120;
  const payment = Math.round(((balance * rMonthly) / (1 - Math.pow(1 + rMonthly, -knownMonths))) * 100) / 100;

  const est = estimateLoan(
    { liability_type: "personal_loan", outstanding_balance: balance, interest_rate: rate, monthly_payment: payment },
    TODAY,
  );
  assert(est.remaining_months != null);
  assertAlmostEquals(est.remaining_months!, knownMonths, 1);
  assertEquals(est.estimated, ["remaining_months"]);
});

// ---------------------------------------------------------------------------
// end_date used to fill missing remaining_months before the default.
// ---------------------------------------------------------------------------

Deno.test("end_date fills remaining_months ahead of the type default", () => {
  const est = estimateLoan(
    {
      liability_type: "mortgage",
      outstanding_balance: 300000,
      interest_rate: 4.2,
      end_date: "2028-06-01", // 24 months from TODAY
    },
    TODAY,
  );
  assertEquals(est.remaining_months, 24);
  assert(est.estimated.includes("remaining_months"));
  assert(est.estimated.includes("monthly_payment"));
  assert(!est.estimated.includes("interest_rate"));
});

// ---------------------------------------------------------------------------
// flat (car loan): interest off original_principal, payment = balance/n + interest.
// ---------------------------------------------------------------------------

Deno.test("flat: interest is a % of original_principal, not the declining balance", () => {
  const est = estimateLoan(
    {
      liability_type: "car_loan",
      outstanding_balance: 10000,
      original_principal: 40000,
      interest_rate: 3,
      remaining_months: 24,
    },
    TODAY,
  );
  // interest = 40000 * 3% / 12 = 100/month, regardless of the 10000 balance.
  assertAlmostEquals(est.interest_monthly, 100, 0.01);
  // payment = 10000/24 + 100 (missing payment → estimated)
  assertAlmostEquals(est.monthly_payment, 10000 / 24 + 100, 0.01);
  assert(est.estimated.includes("monthly_payment"));
  assertEquals(est.rate_type, "flat");
});

Deno.test("flat: given payment is respected as-is (not recomputed)", () => {
  const est = estimateLoan(
    { liability_type: "car_loan", outstanding_balance: 10000, interest_rate: 3, monthly_payment: 420 },
    TODAY,
  );
  assertEquals(est.monthly_payment, 420);
  assert(!est.estimated.includes("monthly_payment"));
  assertAlmostEquals(est.interest_monthly, 25, 0.01); // 10000 * 3% / 12
  assertAlmostEquals(est.principal_monthly, 395, 0.01);
});

// ---------------------------------------------------------------------------
// revolving (credit card): minimum payment rule.
// ---------------------------------------------------------------------------

Deno.test("revolving: minimum payment is max(5% balance, RM50), capped at balance", () => {
  const midBalance = estimateLoan({ liability_type: "credit_card", outstanding_balance: 5000 }, TODAY);
  assertAlmostEquals(midBalance.monthly_payment, 250, 0.01); // 5% of 5000

  const smallBalance = estimateLoan({ liability_type: "credit_card", outstanding_balance: 500 }, TODAY);
  assertAlmostEquals(smallBalance.monthly_payment, 50, 0.01); // RM50 floor beats 5% (=25)

  const tinyBalance = estimateLoan({ liability_type: "credit_card", outstanding_balance: 30 }, TODAY);
  assertAlmostEquals(tinyBalance.monthly_payment, 30, 0.01); // capped at the balance itself

  assertEquals(midBalance.remaining_months, null);
  assertEquals(midBalance.rate_type, "revolving");
});

// ---------------------------------------------------------------------------
// interest_only (overdraft / share_margin): payment defaults to the interest.
// ---------------------------------------------------------------------------

Deno.test("interest_only: payment defaults to interest, no principal", () => {
  const est = estimateLoan({ liability_type: "overdraft", outstanding_balance: 20000 }, TODAY);
  const expectedInterest = 20000 * (8 / 1200);
  assertAlmostEquals(est.interest_monthly, expectedInterest, 0.01);
  assertAlmostEquals(est.monthly_payment, expectedInterest, 0.01);
  assertEquals(est.principal_monthly, 0);
  assertEquals(est.remaining_months, null);
});

// ---------------------------------------------------------------------------
// The two warnings, verbatim.
// ---------------------------------------------------------------------------

Deno.test("warning: reducing payment that doesn't cover interest", () => {
  const est = estimateLoan(
    { liability_type: "personal_loan", outstanding_balance: 130000, interest_rate: 12, monthly_payment: 1000 },
    TODAY,
  );
  assert(est.warnings.includes("月供不足以支付当期利息，余额或利率可能有误"));
  assertEquals(est.remaining_months, null);
  assertAlmostEquals(est.interest_monthly, 1300, 0.01);
  assertEquals(est.principal_monthly, 0);
});

Deno.test("warning: payment × remaining months falls short of the balance", () => {
  const est = estimateLoan(
    {
      liability_type: "personal_loan",
      outstanding_balance: 100000,
      interest_rate: 8, // interest_monthly ≈ 666.67 — 700 comfortably covers it
      monthly_payment: 700,
      remaining_months: 12,
    },
    TODAY,
  );
  // 700 * 12 = 8,400, nowhere near 100,000 * 0.98 — but the payment DOES cover
  // interest, so only this warning should fire, not the "insufficient interest" one.
  assert(est.warnings.includes("月供 × 剩余期数小于余额，数据可能有误"));
  assert(!est.warnings.includes("月供不足以支付当期利息，余额或利率可能有误"));
});

Deno.test("no warnings for a healthy reducing loan", () => {
  const est = estimateLoan(
    { liability_type: "mortgage", outstanding_balance: 300000, interest_rate: 4.2, remaining_months: 300 },
    TODAY,
  );
  assertEquals(est.warnings, []);
});

Deno.test("interest_rate=0 loans (family_loan/bnpl/tax_payable) amortise as balance/months", () => {
  const est = estimateLoan({ liability_type: "family_loan", outstanding_balance: 3600, interest_rate: 0, remaining_months: 36 }, TODAY);
  assertAlmostEquals(est.monthly_payment, 100, 0.01);
  assertEquals(est.interest_monthly, 0);
  assertAlmostEquals(est.principal_monthly, 100, 0.01);
  assertEquals(est.warnings, []);
});
