import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeInvestment } from "./calc.ts";
import { computeBaseline } from "../../baseline.ts";
import { makeCfpData } from "../../baseline.test.ts";
import { fvMonthly } from "../goals/calc.ts";

const NOW = new Date("2026-07-16T00:00:00Z");

function det(overrides = {}) {
  const f = makeCfpData(overrides);
  return computeInvestment(f, computeBaseline(f, {}, NOW));
}

Deno.test("allocation buckets & pct math with mixed assets and holdings", () => {
  const d = det({
    assets: [
      { asset_type: "savings", current_value: 30000, cost_value: null, ownership_type: null },
      { asset_type: "fixed_deposit", current_value: 20000, cost_value: null, ownership_type: null },
      { asset_type: "stock", current_value: 10000, cost_value: null, ownership_type: null },
      { asset_type: "etf", current_value: 5000, cost_value: null, ownership_type: null },
      { asset_type: "unit_trust", current_value: 5000, cost_value: null, ownership_type: null },
      { asset_type: "bond", current_value: 8000, cost_value: null, ownership_type: null },
      { asset_type: "business", current_value: 2000, cost_value: null, ownership_type: null },
      { asset_type: "property", current_value: 500000, cost_value: null, ownership_type: null },
    ],
    holdings: [
      { snapshot_month: "2026-07-01", instrument_code: "F1", market_value: 10000, cost_basis: null },
    ],
  });
  // equity = 10000 + 5000 + 5000 (unit trust) + 10000 (holdings) = 30000
  // bond = 8000; cash = liquid_assets_after_emergency = 14000; alternatives = 2000
  // investable_total = 54000
  assertEquals(d.investable_total, 54000);
  const equity = d.current_allocation.find((r) => r.bucket === "equity")!;
  const bond = d.current_allocation.find((r) => r.bucket === "bond")!;
  const cash = d.current_allocation.find((r) => r.bucket === "cash")!;
  const alternatives = d.current_allocation.find((r) => r.bucket === "alternatives")!;
  assertEquals(equity.amount, 30000);
  assertEquals(equity.pct, 55.6);
  assertEquals(bond.amount, 8000);
  assertEquals(bond.pct, 14.8);
  assertEquals(cash.amount, 14000);
  assertEquals(cash.pct, 25.9);
  assertEquals(alternatives.amount, 2000);
  assertEquals(alternatives.pct, 3.7);
});

Deno.test("drift and rebalancing threshold: only |drift| > 5pp triggers an action", () => {
  const d = det({
    assets: [
      { asset_type: "savings", current_value: 30000, cost_value: null, ownership_type: null },
      { asset_type: "fixed_deposit", current_value: 20000, cost_value: null, ownership_type: null },
      { asset_type: "stock", current_value: 10000, cost_value: null, ownership_type: null },
      { asset_type: "etf", current_value: 5000, cost_value: null, ownership_type: null },
      { asset_type: "unit_trust", current_value: 5000, cost_value: null, ownership_type: null },
      { asset_type: "bond", current_value: 8000, cost_value: null, ownership_type: null },
      { asset_type: "business", current_value: 2000, cost_value: null, ownership_type: null },
    ],
    holdings: [
      { snapshot_month: "2026-07-01", instrument_code: "F1", market_value: 10000, cost_basis: null },
    ],
  });
  // client.risk_profile is "growth" -> target equity 65 / bond 25 / cash 5 / alternatives 5
  assertEquals(d.risk_band, "growth");
  const actionsByBucket = new Map(d.rebalancing_actions.map((a) => [a.bucket, a]));
  assertEquals(actionsByBucket.get("equity")?.action, "increase"); // 55.6 vs 65
  assertEquals(actionsByBucket.get("equity")?.amount, 5076);
  assertEquals(actionsByBucket.get("bond")?.action, "increase"); // 14.8 vs 25
  assertEquals(actionsByBucket.get("cash")?.action, "reduce"); // 25.9 vs 5
  // alternatives drift is only 3.7 - 5 = -1.3pp, under the 5pp threshold
  assert(!actionsByBucket.has("alternatives"));
  assertEquals(d.rebalancing_actions.length, 3);
});

Deno.test("risk band falls back to balanced when risk_profile is null", () => {
  const d = det({
    client: { ...makeCfpData().client, risk_profile: null },
  });
  assertEquals(d.risk_band, "balanced");
  assert(d.risk_band_defaulted);
  const cash = d.current_allocation.find((r) => r.bucket === "cash")!;
  const cashDrift = d.drift.find((r) => r.bucket === "cash")!;
  assertEquals(cashDrift.target_pct, 10); // balanced band cash target
  assertEquals(cash.amount, 14000);
});

Deno.test("no investable assets: all-zero allocation without throwing", () => {
  const d = det({ assets: [] });
  assert(d.no_investable);
  assertEquals(d.investable_total, 0);
  for (const row of d.current_allocation) {
    assertEquals(row.amount, 0);
    assertEquals(row.pct, null);
  }
  for (const row of d.drift) {
    assertEquals(row.current_pct, null);
    assertEquals(row.drift_pp, null);
  }
  assertEquals(d.rebalancing_actions.length, 0);
});

Deno.test("cash bucket equals liquid assets after emergency reserve", () => {
  const d = det(); // default fixture: 50,000 liquid − 36,000 reserve = 14,000
  const cash = d.current_allocation.find((r) => r.bucket === "cash")!;
  assertEquals(cash.amount, 14000);
});

Deno.test("wealth_projection compounds investable_total plus monthly surplus at 5/10/15 years", () => {
  const d = det(); // default fixture: investable_total 14,000, growth band r=0.075, surplus 60,000/yr
  const investable = 14000;
  const r = 0.075;
  const monthlySurplus = 5000; // 60,000 / 12
  const expected = [5, 10, 15].map((y) => ({
    year: y,
    projected: Math.round(
      investable * Math.pow(1 + r, y) + fvMonthly(monthlySurplus, r, y),
    ),
  }));
  assertEquals(d.wealth_projection, expected);
});

Deno.test("wealth_projection still projects pure contributions when investable_total is zero", () => {
  const d = det({ assets: [] }); // no investable assets, but surplus/return unaffected
  const investable = 0;
  const r = 0.075;
  const monthlySurplus = 5000;
  const expected = [5, 10, 15].map((y) => ({
    year: y,
    projected: Math.round(
      investable * Math.pow(1 + r, y) + fvMonthly(monthlySurplus, r, y),
    ),
  }));
  assertEquals(d.no_investable, true);
  assertEquals(d.wealth_projection, expected);
});

Deno.test("wealth_projection FV term is zero when monthly surplus is zero", () => {
  const d = det({
    client: { ...makeCfpData().client, risk_profile: null }, // -> balanced band, r=0.06
    cashflow: [
      { direction: "inflow", amount: 6000, frequency: "monthly", category: "salary" },
      { direction: "outflow", amount: 6000, frequency: "monthly", category: "household" },
    ],
  });
  assertEquals(d.monthly_surplus, 0);
  assertEquals(d.risk_band, "balanced");
  const investable = 14000; // 50,000 liquid − 36,000 reserve, unchanged assets
  const r = 0.06;
  const expected = [5, 10, 15].map((y) => ({
    year: y,
    projected: Math.round(investable * Math.pow(1 + r, y)), // fvMonthly term is 0
  }));
  assertEquals(d.wealth_projection, expected);
});
