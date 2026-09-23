import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  detectDuplicateHoldings,
  mergeHousehold,
  toPersonSlice,
} from "./household.ts";
import { computeBaseline } from "./baseline.ts";
import { makeCfpData } from "./baseline.test.ts";
import type { CfpData } from "./types.ts";

function partnerData(overrides: Partial<CfpData> = {}): CfpData {
  const base = makeCfpData();
  return {
    ...base,
    client: {
      ...base.client,
      id: "c-2",
      date_of_birth: "1992-06-01",
      risk_profile: "conservative",
      retirement_age: 55,
      number_of_dependants: 2,
      has_epf_account: false,
      has_prs_account: true,
    },
    cashflow: [
      { direction: "inflow", amount: 5000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
      { direction: "outflow", amount: 2000, frequency: "monthly", category: "household", period_month: "2026-06-01" },
    ],
    assets: [
      { asset_type: "savings", current_value: 15000, cost_value: null, ownership_type: null },
    ],
    liabilities: [],
    policies: [],
    investment_accounts: [],
    holdings: [],
    goals: [],
    ...overrides,
  };
}

Deno.test("merges cashflow, assets and liabilities by concatenation", () => {
  const merged = mergeHousehold(makeCfpData(), partnerData());
  assertEquals(merged.cashflow.length, 3 + 2);
  assertEquals(merged.assets.length, 4 + 1);
  assertEquals(merged.liabilities.length, 1 + 0);
});

Deno.test("household income and net worth are the couple's combined position", () => {
  const primary = makeCfpData();
  const partner = partnerData();
  const solo = computeBaseline(primary);
  const joint = computeBaseline(mergeHousehold(primary, partner));

  // partner adds 5000/month = 60000/year
  assertEquals(joint.annual_income, solo.annual_income + 60000);
  // partner adds 2000/month = 24000/year
  assertEquals(joint.annual_expenses, solo.annual_expenses + 24000);
  // partner adds 15000 of savings
  assertEquals(joint.total_assets, solo.total_assets + 15000);
  assertEquals(joint.net_worth, solo.net_worth + 15000);
});

Deno.test("dependants take the max, never the sum", () => {
  const primary = makeCfpData();
  const partner = partnerData();
  primary.client.number_of_dependants = 2;
  partner.client.number_of_dependants = 3;

  const merged = mergeHousehold(primary, partner);
  assertEquals(merged.client.number_of_dependants, 3);
});

Deno.test("primary client's demographics drive the merged plan", () => {
  const merged = mergeHousehold(makeCfpData(), partnerData());
  assertEquals(merged.client.id, "c-1");
  assertEquals(merged.client.date_of_birth, "1990-01-01");
  assertEquals(merged.client.risk_profile, "growth");
  assertEquals(merged.client.retirement_age, 60);
  assertEquals(merged.client.marital_status, "married");
});

Deno.test("account flags are true when either spouse has one", () => {
  const merged = mergeHousehold(makeCfpData(), partnerData());
  assert(merged.client.has_epf_account); // primary only
  assert(merged.client.has_prs_account); // partner only
});

Deno.test("the same goal recorded on both spouses counts once", () => {
  const goal = {
    id: "g-1",
    goal_type: "education" as const,
    name: "Ah Boy university",
    target_amount: 300000,
    target_year: 2040,
    current_saved: 10000,
    monthly_contribution: 500,
    inflation_override: null,
    priority: 1,
  };
  const primary = makeCfpData({ goals: [goal] });
  const partner = partnerData({
    // same goal, different row id and saved amount — still one goal
    goals: [{ ...goal, id: "g-2", current_saved: 4000 }],
  });

  const merged = mergeHousehold(primary, partner);
  assertEquals(merged.goals.length, 1);
  assertEquals(merged.goals[0].id, "g-1");
});

Deno.test("genuinely different goals are both kept", () => {
  const base = {
    id: "g-1",
    goal_type: "education" as const,
    name: "Ah Boy university",
    target_amount: 300000,
    target_year: 2040,
    current_saved: 0,
    monthly_contribution: 0,
    inflation_override: null,
    priority: 1,
  };
  const merged = mergeHousehold(
    makeCfpData({ goals: [base] }),
    partnerData({ goals: [{ ...base, id: "g-2", name: "Ah Girl university" }] }),
  );
  assertEquals(merged.goals.length, 2);
});

Deno.test("flags a jointly-owned asset entered on both records", () => {
  const primary = makeCfpData();
  const partner = partnerData({
    assets: [
      // the same house, recorded twice
      { asset_type: "property", current_value: 500000, cost_value: null, ownership_type: "joint" },
      { asset_type: "savings", current_value: 15000, cost_value: null, ownership_type: null },
    ],
  });

  const merged = mergeHousehold(primary, partner);
  const dups = merged.household!.duplicates;
  assertEquals(dups.length, 1);
  assertEquals(dups[0], { kind: "asset", type: "property", amount: 500000 });

  // Flagged, never silently dropped — the advisor decides.
  assertEquals(merged.assets.filter((a) => a.asset_type === "property").length, 2);
});

Deno.test("flags a shared mortgage entered on both records", () => {
  const partner = partnerData({
    liabilities: [{
      liability_type: "mortgage",
      outstanding_balance: 300000,
      interest_rate: 0.04,
      monthly_payment: 1500,
      end_date: null,
    }],
  });
  const dups = detectDuplicateHoldings(makeCfpData(), partner);
  assertEquals(dups.length, 1);
  assertEquals(dups[0].kind, "liability");
});

Deno.test("different amounts of the same asset type are not flagged", () => {
  const partner = partnerData({
    assets: [
      { asset_type: "savings", current_value: 15000, cost_value: null, ownership_type: null },
    ],
  });
  // primary has savings of 30000 — same type, different amount
  assertEquals(detectDuplicateHoldings(makeCfpData(), partner).length, 0);
});

Deno.test("person slices keep each spouse's own figures intact", () => {
  const primary = makeCfpData();
  const partner = partnerData();
  const merged = mergeHousehold(primary, partner);

  assertEquals(merged.household!.primary.role, "primary");
  assertEquals(merged.household!.primary.client.id, "c-1");
  assertEquals(merged.household!.primary.assets.length, 4);
  assertEquals(merged.household!.partner.role, "partner");
  assertEquals(merged.household!.partner.client.id, "c-2");
  assertEquals(merged.household!.partner.assets.length, 1);
  assertEquals(merged.household!.partner.cashflow.length, 2);
});

Deno.test("toPersonSlice carries the client's own rows", () => {
  const slice = toPersonSlice(makeCfpData(), "primary");
  assertEquals(slice.role, "primary");
  assertEquals(slice.liabilities.length, 1);
  assertEquals(slice.policies.length, 0);
});

Deno.test("an individual report has no household block", () => {
  assertEquals(makeCfpData().household, undefined);
  assertEquals(computeBaseline(makeCfpData()).household_mode, undefined);
});

// ---------------------------------------------------------------------------
// P2b 决策 6 (household) — SOCSO/EIS's wage ceiling and EPF's employer-rate
// threshold are PER EMPLOYEE. A joint plan must derive each spouse's
// statutory deductions from their OWN wage, never a pooled household one.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-07-16T00:00:00Z");

Deno.test("household: two earners each get statutory EPF/SOCSO/EIS from their OWN wage, not a pooled one", () => {
  const primary = makeCfpData({
    client: { ...makeCfpData().client, has_epf: true },
    cashflow: [],
    liabilities: [],
    policies: [],
    items: [
      { client_id: "c-1", direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
    ],
  });
  const partner = partnerData({
    client: { ...partnerData().client, has_epf: true },
    cashflow: [],
    liabilities: [],
    policies: [],
    items: [
      { client_id: "c-2", direction: "inflow", category: "salary_basic", amount: 4000, frequency: "monthly", effective_from: "2026-01-01" },
    ],
  });

  const merged = mergeHousehold(primary, partner);
  const b = computeBaseline(merged, {}, NOW);

  assertEquals(b.cashflow_source, "items");
  // c-1 (8,000): employee 880, employer 960 (>5,000 threshold), SOCSO/EIS
  // capped at 6,000 -> 42. c-2 (4,000): employee 440, employer 520 (<=5,000
  // threshold), SOCSO/EIS on the uncapped 4,000 -> 28.
  assertEquals(b.monthly_employee_epf, 880 + 440);
  assertEquals(b.monthly_employer_epf, 960 + 520);
  assertAlmostEquals(b.monthly_socso_eis, 42 + 28, 0.01);

  // Pooling both salaries into one 12,000 wage base would cap SOCSO/EIS once
  // (42) instead of twice (70) — the exact bug the household `clients` map
  // exists to prevent.
  assert(b.monthly_socso_eis > 42, "must not be computed off a single pooled wage base");

  assertEquals(b.annual_disposable_surplus, b.annual_surplus - (880 + 440) * 12);
});

Deno.test("household: merged items keep each spouse's own client_id so per-employee statutory can split them back apart", () => {
  const primary = makeCfpData({
    items: [{ client_id: "c-1", direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" }],
  });
  const partner = partnerData({
    items: [{ client_id: "c-2", direction: "inflow", category: "salary_basic", amount: 4000, frequency: "monthly", effective_from: "2026-01-01" }],
  });
  const merged = mergeHousehold(primary, partner);
  assertEquals(merged.items.length, 2);
  assertEquals(merged.items.map((i) => i.client_id).sort(), ["c-1", "c-2"]);
  assertEquals(merged.household!.primary.items.length, 1);
  assertEquals(merged.household!.partner.items.length, 1);
});
