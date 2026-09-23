import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeTax, detectReliefsFromCashflow, type TaxInputs } from "./calc.ts";
import { progressiveTax } from "./rates2026.ts";
import { computeBaseline } from "../../baseline.ts";
import { makeCfpData } from "../../baseline.test.ts";
import type { CfpData } from "../../types.ts";

const NOW = new Date("2026-07-16T00:00:00Z");

function det(overrides = {}, inputs: TaxInputs = {}) {
  const f = makeCfpData(overrides);
  return computeTax(f, computeBaseline(f, {}, NOW), inputs);
}

function reliefByKey(d: ReturnType<typeof det>, key: string) {
  return d.reliefs_detail.find((r) => r.key === key)!;
}

Deno.test("progressiveTax hand-checked at three chargeable income levels", () => {
  // 5k*0 + 15k*0.01 = 150
  assertEquals(progressiveTax(20000), 150);
  // 5k*0 + 15k*0.01 + 15k*0.03 + 15k*0.06 = 0 + 150 + 450 + 900 = 1500
  assertEquals(progressiveTax(50000), 1500);
  // ...+ 20k*0.11 + 30k*0.19 = 1500 + 2200 + 5700 = 9400
  assertEquals(progressiveTax(100000), 9400);
});

Deno.test("auto EPF and life premium reliefs are capped from client data", () => {
  const d = det(); // income 132,000, employed, no policies
  const epf = reliefByKey(d, "epf");
  assertEquals(epf.claimed, 4000); // 11% of 132,000 = 14,520 -> capped at 4,000
  assertEquals(epf.headroom, 0);
  const personal = reliefByKey(d, "personal");
  assertEquals(personal.claimed, 9000);

  const withLifePolicy = det({
    policies: [{
      policy_type: "life",
      provider: null,
      sum_assured: 200000,
      premium: 5000,
      premium_frequency: "annual",
    }],
  });
  const life = reliefByKey(withLifePolicy, "life_insurance");
  assertEquals(life.claimed, 3000); // 5,000 annual premium capped at 3,000
  assertEquals(life.headroom, 0);
});

// ---------------------------------------------------------------------------
// P2b 决策 6 — the EPF relief uses the real statutory employee EPF (12 ×
// monthly_employee_epf) instead of a blanket 11%-of-total-income guess, once
// standing items produce one. The two diverge whenever total income
// includes something outside the EPF wage base (here, rental income) — that
// divergence is what proves the statutory figure, not the old heuristic, is
// what actually got used.
// ---------------------------------------------------------------------------

Deno.test("EPF relief uses the statutory employee EPF when standing items produced one, still capped", () => {
  const d = det({
    client: { ...makeCfpData().client, has_epf: true },
    items: [
      { direction: "inflow", category: "salary_basic", amount: 2000, frequency: "monthly", effective_from: "2026-01-01" },
      { direction: "inflow", category: "rental_income", amount: 1000, frequency: "monthly", effective_from: "2026-01-01" },
    ],
  });
  // EPF wage base is ONLY the 2,000 salary (rental income isn't EPF wage):
  // employee 11% = 220/mo -> 2,640/yr, well under the 4,000 cap.
  // The old 11%-of-total-income heuristic would have given 11% × 36,000 =
  // 3,960 — a different number, so this pins which formula actually ran.
  const epf = reliefByKey(d, "epf");
  assertEquals(epf.claimed, 2640);
  assertEquals(epf.headroom, 4000 - 2640);
});

Deno.test("advisor override wins over the auto value and is still capped", () => {
  const notEmployed = det(
    { client: { ...makeCfpData().client, employment_status: "self_employed" } },
    { reliefs: { epf: 2500, medical_insurance: 1000 } },
  );
  assertEquals(reliefByKey(notEmployed, "epf").claimed, 2500); // override, under cap
  assertEquals(reliefByKey(notEmployed, "medical_insurance").claimed, 1000);

  const overClaim = det({}, { reliefs: { epf: 50000 } });
  assertEquals(reliefByKey(overClaim, "epf").claimed, 4000); // capped at 4,000
});

Deno.test("non-resident path applies the flat 30% rate and zeroes reliefs", () => {
  const d = det({
    client: { ...makeCfpData().client, tax_residency: "non_resident" },
  });
  assert(d.non_resident);
  assertEquals(d.chargeable_income, 132000);
  assertEquals(d.tax_payable, 39600);
  assertEquals(d.marginal_rate, 0.30);
  assertEquals(d.effective_rate, 0.30);
  assertEquals(d.optimization_opportunities.length, 0);
  for (const r of d.reliefs_detail) assertEquals(r.claimed, 0);
});

Deno.test("optimization opportunities exclude SSPN without dependents, include with dependents", () => {
  const withDependents = det(); // default fixture: 2 dependants
  assertEquals(withDependents.marginal_rate, 0.25);
  const sspn = withDependents.optimization_opportunities.find((o) => o.key === "sspn");
  assert(sspn);
  assertEquals(sspn!.additional_claimable, 8000);
  assertEquals(sspn!.est_tax_saving, 2000); // 8,000 * 0.25

  const noDependents = det({
    client: { ...makeCfpData().client, number_of_dependants: 0 },
  });
  const sspnNone = noDependents.optimization_opportunities.find((o) => o.key === "sspn");
  assertEquals(sspnNone, undefined);
  // other opportunities still present
  const prs = noDependents.optimization_opportunities.find((o) => o.key === "prs");
  assert(prs);
  assertEquals(prs!.est_tax_saving, 750); // 3,000 * 0.25
});

Deno.test("no recurring income flags insufficient_data without throwing", () => {
  const d = det({ cashflow: [] });
  assert(d.insufficient_data);
  assertEquals(d.chargeable_income, 0);
  assertEquals(d.tax_payable, 0);
  assertEquals(d.effective_rate, null);
});

Deno.test("detected relief category is annualized and capped", () => {
  const d = det({
    cashflow: [
      { direction: "inflow", amount: 10000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
      { direction: "outflow", amount: 800, frequency: "monthly", category: "health_medical", period_month: "2026-06-01" },
    ],
  });
  const medical = reliefByKey(d, "medical_expenses");
  assertEquals(medical.claimed, 8000); // 800*12 = 9,600 -> capped at 8,000
  assertEquals(medical.source, "detected");
  assertEquals(medical.headroom, 0);
});

Deno.test("medical insurance category is claimed under medical_insurance, not medical_expenses", () => {
  const d = det({
    cashflow: [
      { direction: "inflow", amount: 10000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
      {
        direction: "outflow",
        amount: 200,
        frequency: "monthly",
        category: "medical_card", period_month: "2026-06-01" },
    ],
  });
  const medInsurance = reliefByKey(d, "medical_insurance");
  assertEquals(medInsurance.claimed, 2400); // 200*12, under the 3,000 cap
  assertEquals(medInsurance.source, "detected");
  const medExpenses = reliefByKey(d, "medical_expenses");
  assertEquals(medExpenses.claimed, 0);
  assertEquals(medExpenses.source, "none");
});

Deno.test("advisor override beats a detected relief value", () => {
  const d = det(
    {
      cashflow: [
        { direction: "inflow", amount: 10000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
        { direction: "outflow", amount: 1000, frequency: "monthly", category: "health_medical", period_month: "2026-06-01" },
      ],
    },
    { reliefs: { medical_expenses: 500 } },
  );
  const medical = reliefByKey(d, "medical_expenses");
  assertEquals(medical.claimed, 500);
  assertEquals(medical.source, "advisor");
});

Deno.test("detectReliefsFromCashflow sums matched categories across frequencies", () => {
  const f: CfpData = makeCfpData({
    cashflow: [
      { direction: "outflow", amount: 100, frequency: "weekly", category: "fitness", period_month: "2026-06-01" },
      { direction: "outflow", amount: 500, frequency: "quarterly", category: "sspn", period_month: "2026-06-01" },
      { direction: "outflow", amount: 50, frequency: "monthly", category: "groceries", period_month: "2026-06-01" },
    ],
  });
  const detected = detectReliefsFromCashflow(f, { year: 2026, from_month: 1, to_month: 12 });
  assertEquals(detected.lifestyle, 100 * 52);
  assertEquals(detected.sspn, 500 * 4);
  assertEquals(detected.medical_expenses, undefined);
});
