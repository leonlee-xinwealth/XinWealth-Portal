import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  classifyAsset,
  classifyCashflowRow,
  levelUpAsset,
  levelUpLiabilityType,
} from "./legacy.ts";
import { CATEGORY_BY_CODE } from "./cashflow.ts";
import { assetTypeMeta } from "./balance.ts";

const out = (category: string, source_note: string | null, extra = {}) =>
  classifyCashflowRow({ direction: "outflow", category, source_note, frequency: "monthly", is_recurring: true, ...extra });
const inn = (category: string, source_note: string | null, extra = {}) =>
  classifyCashflowRow({ direction: "inflow", category, source_note, frequency: "monthly", is_recurring: true, ...extra });

Deno.test("KYC sub-items land in their exact category without review", () => {
  const cases: Array<[string, string, string]> = [
    ["household", "Tel/ Mobile/ Internet", "telco"],
    ["household", "Home Maintenance", "home_repair"],
    ["household", "Utilities Bills", "utilities"],
    ["household", "Groceries/Marketing", "groceries"],
    ["household", "Maid's Levy/ Salary", "household_help"],
    ["transportation", "Parking Fee", "toll_parking"],
    ["transportation", "Petrol", "fuel"],
    ["transportation", "Bus/ MRT/ Taxi/ Car Share", "public_transport_ehailing"],
    ["transportation", "Car Insurance", "motor_insurance"],
    ["dependants", "Child Care", "childcare"],
    ["dependants", "Children's School Fee", "school_fees"],
    ["dependants", "Upgrading Class", "tuition_enrichment"],
    ["dependants", "Dependant Allowances", "other_dependants"],
    ["dependants", "Child Expenses", "child_expenses"],
    ["dependants", "Parent Allowance", "parents_allowance"],
    ["personal", "Entertainment", "entertainment"],
    ["personal", "Dining Out", "dining_out"],
    ["personal", "Personal Care/ Clothing", "personal_care"],
    ["personal", "Donations/ Charity/ Gifts", "donations"],
    ["personal", "School Fees", "self_education"],
    ["miscellaneous", "Medical Cost", "health_medical"],
  ];
  for (const [cat, note, want] of cases) {
    const c = out(cat, note);
    assertEquals(c.code, want, `${cat} / ${note}`);
    assertEquals(c.needs_review, false, `${cat} / ${note}: ${c.review_reason}`);
  }
});

Deno.test("free-text notes seen in production", () => {
  assertEquals(out("household", "Indah Water").code, "utilities");
  assertEquals(out("household", "Mobile data").code, "telco");
  assertEquals(out("household", "Pet's Food").code, "pet_care");
  assertEquals(out("household", "Senior Livings").code, "parents_allowance");
  assertEquals(out("personal", "Kindergarden Fees").code, "school_fees");
  assertEquals(out("personal", "Youtube Subscription").code, "subscriptions");
  assertEquals(out("personal", "iCloud").code, "subscriptions");
  assertEquals(out("other_expense", "Software Subscriptions").code, "subscriptions");
  assertEquals(out("transportation", "Grab").code, "public_transport_ehailing");
  assertEquals(out("transportation", "Road Tax").code, "road_tax");
  assertEquals(out("transportation", "Servicing").code, "car_service_repair");
  assertEquals(out("personal", "Gym Membership").code, "fitness");
  // a weak rule (child) never outvotes a specific one (medical)
  const meds = out("miscellaneous", "Children Medication & Supplement");
  assertEquals(meds.code, "health_medical");
  assertEquals(meds.needs_review, false);
});

Deno.test("a row that mixes two kinds of spending goes to review", () => {
  for (const note of ["Car Loan & Petrol", "Groceries & Utilities", "Dining & Entertainment"]) {
    const c = out("household", note);
    assert(c.needs_review, note);
    assert(c.review_reason?.includes("多个项目"), note);
  }
});

Deno.test("group-level 'All - X' rows fall back to the catch-all without review", () => {
  assertEquals(out("household", "All - Household").code, "living_other");
  assertEquals(out("transportation", "All - Transport").code, "transport_other");
  assertEquals(out("personal", "All - Personal").code, "lifestyle_other");
  assertEquals(out("miscellaneous", "All - Miscellaneous").code, "other_expense");
  assertEquals(out("household", "All - Household").needs_review, false);
  // "Dependant" in the group line must not trigger the other_dependants rule
  assertEquals(out("dependants", "All - Dependants").code, "family_other");
  // "Road Tax" is one item, not road tax + income tax
  assertEquals(out("transportation", "Road Tax").needs_review, false);
});

Deno.test("an unmatched free-text note falls back but asks for review", () => {
  const c = out("household", "Something odd");
  assertEquals(c.code, "living_other");
  assert(c.needs_review);
});

Deno.test("KYC yearly items entered as monthly are corrected to annual", () => {
  const travel = out("personal", "Vacation/ Travel");
  assertEquals(travel.code, "travel");
  assertEquals(travel.frequency, "annual");
  assert(travel.needs_review);
  const tax = out("personal", "Income Tax Expense");
  assertEquals(tax.code, "income_tax");
  assertEquals(tax.frequency, "annual");
  // already annual → untouched, no review
  const ok = out("personal", "Vacation/ Travel", { frequency: "annual" });
  assertEquals(ok.frequency, null);
  assertEquals(ok.needs_review, false);
});

Deno.test("loans and premiums are flagged for the P2 de-duplication", () => {
  const loan = out("other_expense", "Loan Repayment");
  assertEquals(loan.code, "debt_other");
  assert(loan.needs_review);
  assertEquals(out("personal", "Shopee Pay Later").code, "bnpl_payment");
  assertEquals(out("insurance_premium", null).code, "protection_other");
  assert(out("insurance_premium", null).needs_review);
});

Deno.test("current, specific codes are left alone", () => {
  const c = out("groceries", "Jaya Grocer");
  assertEquals(c.code, "groceries");
  assertEquals(c.needs_review, false);
  assertEquals(c.frequency, null);
});

Deno.test("inflows: legacy codes, LevelUp labels, bonus, unclear other income", () => {
  assertEquals(inn("salary", null).code, "salary_basic");
  assertEquals(inn("dividend", "Annual Dividend Q1").code, "dividend_company");
  assertEquals(inn("investment_return", "Fixed Deposit & Bonds").code, "dividend_investment");
  assertEquals(inn("Salary", null).code, "salary_basic");
  assertEquals(inn("Investment Dividends / Interest", null).code, "dividend_investment");
  assertEquals(inn("Other", null).code, "other_income");
  const bonus = inn("bonus", null, { is_recurring: false });
  assertEquals(bonus.frequency, "annual");
  assertEquals(bonus.is_recurring, true);
  assert(bonus.needs_review);
  const unclear = inn("other_income", "Marriage Fund");
  assertEquals(unclear.code, "other_income");
  assert(unclear.needs_review);
  assertEquals(inn("rental_income", "Subang Jaya Condo").needs_review, false);
});

Deno.test("LevelUp outflow labels map to the group catch-alls", () => {
  assertEquals(out("Household", null).code, "living_other");
  assertEquals(out("Other Expenses", null).code, "other_expense");
  assertEquals(out("Transportation", "Petrol").code, "fuel");
});

Deno.test("every code the classifier can emit is a real category", () => {
  const notes = ["Petrol", "Loan Repayment", "x", "All - Household", "Medical Cost", "Car Insurance"];
  for (const cat of ["household", "transportation", "dependants", "personal", "miscellaneous", "other_expense", "insurance_premium", "loan_repayment", "investment_contribution", "tax", "property_expense", "property_maintenance"]) {
    for (const n of notes) assert(CATEGORY_BY_CODE[out(cat, n).code], `${cat}/${n}`);
  }
});

Deno.test("assets: property purpose and 'other' by name", () => {
  assertEquals(classifyAsset({ asset_type: "property", name: "Arte Cheras (Own stay)" }).asset_type, "own_residence");
  assertEquals(classifyAsset({ asset_type: "property", name: "Own House (Sendayan)" }).asset_type, "own_residence");
  assertEquals(classifyAsset({ asset_type: "property", name: "Shop lot for rent" }).asset_type, "investment_property");
  const unknown = classifyAsset({ asset_type: "property", name: "Landed Semi-D Damansara Jaya" });
  assertEquals(unknown.asset_type, "own_residence");
  assert(unknown.needs_review);
  assertEquals(classifyAsset({ asset_type: "other", name: "Maybank Gold (MIGA)" }).asset_type, "gold");
  const mixed = classifyAsset({ asset_type: "other", name: "Gold Bars & Jewellery" });
  assertEquals(mixed.asset_type, "gold");
  assert(mixed.needs_review);
  assertEquals(classifyAsset({ asset_type: "other", name: "ASB" }).asset_type, "asnb");
  const odd = classifyAsset({ asset_type: "other", name: "Something" });
  assertEquals(odd.asset_type, "other");
  assert(odd.needs_review);
  assertEquals(classifyAsset({ asset_type: "stock", name: "Maybank shares" }).asset_type, "stock");
  assertEquals(classifyAsset({ asset_type: "stock", name: "x" }).needs_review, false);
});

Deno.test("LevelUp asset and liability labels", () => {
  assertEquals(levelUpAsset("Cash/Savings").asset_type, "savings");
  assertEquals(levelUpAsset("EPF").asset_type, "epf_account_1");
  assertEquals(levelUpAsset("Gold/Precious Metals").asset_type, "gold");
  assertEquals(levelUpAsset("Crypto").asset_type, "crypto");
  assertEquals(levelUpAsset("Forex").asset_type, "forex");
  assertEquals(levelUpAsset("Properties", "My condo (own stay)").asset_type, "own_residence");
  assertEquals(levelUpAsset("Other Investments", "ASB").asset_type, "asnb");
  assertEquals(levelUpAsset("nonsense").asset_type, "other");
  for (const l of ["Cash/Savings", "Fixed Deposit", "EPF", "Properties", "Vehicles", "Other Assets", "ETF", "Stocks", "Unit Trusts", "Bonds", "Forex", "Gold/Precious Metals", "Crypto", "Other Investments"]) {
    assert(assetTypeMeta(levelUpAsset(l).asset_type), l);
  }
  assertEquals(levelUpLiabilityType("Mortgage / Property Loan"), "mortgage");
  assertEquals(levelUpLiabilityType("Vehicle Loan"), "car_loan");
  assertEquals(levelUpLiabilityType("Other Loans"), "other");
  assertEquals(levelUpLiabilityType("nonsense"), "other");
});
