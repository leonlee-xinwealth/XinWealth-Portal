import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  allocationOf,
  currentAllocationRows,
  driftAgainst,
  MODEL_PORTFOLIOS,
  riskBandFromSuitability,
} from "./allocation.ts";

Deno.test("riskBandFromSuitability maps the four suitability profiles to model-portfolio bands", () => {
  assertEquals(riskBandFromSuitability("STABLE"), "conservative");
  assertEquals(riskBandFromSuitability("BALANCED"), "balanced");
  assertEquals(riskBandFromSuitability("GROWTH"), "growth");
  assertEquals(riskBandFromSuitability("AGGRESSIVE_GROWTH"), "aggressive");
});

Deno.test("riskBandFromSuitability returns null for an unknown/missing band", () => {
  assertEquals(riskBandFromSuitability("SOMETHING_ELSE"), null);
  assertEquals(riskBandFromSuitability(null), null);
  assertEquals(riskBandFromSuitability(undefined), null);
});

Deno.test("MODEL_PORTFOLIOS keys are the five model-portfolio bands, each summing to 100", () => {
  assertEquals(
    Object.keys(MODEL_PORTFOLIOS).sort(),
    ["aggressive", "balanced", "conservative", "growth", "moderate"],
  );
  for (const band of Object.keys(MODEL_PORTFOLIOS)) {
    const mix = MODEL_PORTFOLIOS[band];
    assertEquals(mix.equity + mix.bond + mix.cash + mix.alternatives, 100);
  }
});

// ---------------------------------------------------------------------------
// Parity with the pre-P3 logic that lived in modules/investment/calc.ts —
// same fixtures as calc.test.ts's own allocation/drift tests, reproduced
// here directly against the moved functions so a regression in either place
// is caught independently.
// ---------------------------------------------------------------------------

Deno.test("allocationOf + currentAllocationRows parity with the old calc.ts allocation buckets test", () => {
  const assets = [
    { asset_type: "savings", current_value: 30000 },
    { asset_type: "fixed_deposit", current_value: 20000 },
    { asset_type: "stock", current_value: 10000 },
    { asset_type: "etf", current_value: 5000 },
    { asset_type: "unit_trust", current_value: 5000 },
    { asset_type: "bond", current_value: 8000 },
    { asset_type: "business", current_value: 2000 },
    { asset_type: "property", current_value: 500000 },
  ];
  const holdings = [{ market_value: 10000 }];
  // cash (5000) mirrors the fixture's liquid_assets_after_emergency — a
  // baseline concept computed elsewhere, passed straight through here.
  const amounts = allocationOf(assets, holdings, 5000);
  const { investable_total, rows } = currentAllocationRows(amounts);

  assertEquals(investable_total, 45000);
  const byBucket = Object.fromEntries(rows.map((r) => [r.bucket, r]));
  assertEquals(byBucket.equity, { bucket: "equity", amount: 30000, pct: 66.7 });
  assertEquals(byBucket.bond, { bucket: "bond", amount: 8000, pct: 17.8 });
  assertEquals(byBucket.cash, { bucket: "cash", amount: 5000, pct: 11.1 });
  assertEquals(byBucket.alternatives, { bucket: "alternatives", amount: 2000, pct: 4.4 });
});

Deno.test("driftAgainst parity with the old calc.ts drift/rebalancing test (growth band)", () => {
  const rows = [
    { bucket: "equity" as const, amount: 30000, pct: 66.7 },
    { bucket: "bond" as const, amount: 8000, pct: 17.8 },
    { bucket: "cash" as const, amount: 5000, pct: 11.1 },
    { bucket: "alternatives" as const, amount: 2000, pct: 4.4 },
  ];
  const { drift, rebalancing_actions } = driftAgainst(MODEL_PORTFOLIOS.growth, rows);

  const byBucket = Object.fromEntries(rebalancing_actions.map((a) => [a.bucket, a]));
  assertEquals(byBucket.equity, undefined); // 66.7 vs 65 -> only 1.7pp drift
  assertEquals(byBucket.bond, { bucket: "bond", action: "increase", amount: 3240 });
  assertEquals(byBucket.cash, { bucket: "cash", action: "reduce", amount: 2745 });
  assertEquals(byBucket.alternatives, undefined); // 4.4 vs 5 -> only -0.6pp drift
  assertEquals(rebalancing_actions.length, 2);

  const bondDrift = drift.find((d) => d.bucket === "bond")!;
  assertEquals(bondDrift.drift_pp, -7.2);
  assertEquals(bondDrift.target_pct, 25);
});

Deno.test("driftAgainst: no investable assets -> pct null everywhere, no rebalancing actions", () => {
  const amounts = allocationOf([], [], 0);
  const { rows, investable_total } = currentAllocationRows(amounts);
  assertEquals(investable_total, 0);
  for (const r of rows) assertEquals(r.pct, null);

  const { drift, rebalancing_actions } = driftAgainst(MODEL_PORTFOLIOS.balanced, rows);
  for (const d of drift) {
    assertEquals(d.current_pct, null);
    assertEquals(d.drift_pp, null);
  }
  assertEquals(rebalancing_actions.length, 0);
});

Deno.test("allocationOf: unknown asset_type and A/B-class assets contribute nothing (only allocationBucketOf-mapped types count)", () => {
  const assets = [
    { asset_type: "savings", current_value: 100000 }, // class A, no allocation bucket
    { asset_type: "epf_account_1", current_value: 200000 }, // class B, no allocation bucket
    { asset_type: "totally_unknown_type", current_value: 50000 },
  ];
  const amounts = allocationOf(assets, [], 0);
  assertEquals(amounts, { equity: 0, bond: 0, cash: 0, alternatives: 0 });
});
