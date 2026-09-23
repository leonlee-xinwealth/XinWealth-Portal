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
  // bond = 8000; alternatives = 2000.
  // P2a: cash = liquid_assets_after_emergency = 5000, not 14000 — the
  // fixture's mortgage installment (1,500/mo) is now auto-derived into
  // essential spend, so the 6-month reserve grew from 36,000 to 45,000 and
  // ate further into the 50,000 of liquid assets.
  // investable_total = 30000 + 8000 + 5000 + 2000 = 45000
  assertEquals(d.investable_total, 45000);
  const equity = d.current_allocation.find((r) => r.bucket === "equity")!;
  const bond = d.current_allocation.find((r) => r.bucket === "bond")!;
  const cash = d.current_allocation.find((r) => r.bucket === "cash")!;
  const alternatives = d.current_allocation.find((r) => r.bucket === "alternatives")!;
  assertEquals(equity.amount, 30000);
  assertEquals(equity.pct, 66.7);
  assertEquals(bond.amount, 8000);
  assertEquals(bond.pct, 17.8);
  assertEquals(cash.amount, 5000);
  assertEquals(cash.pct, 11.1);
  assertEquals(alternatives.amount, 2000);
  assertEquals(alternatives.pct, 4.4);
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
  //
  // P2a: cash is now 5000/45000 = 11.1% (not 25.9%) — see the allocation test
  // above for why — which pushes every OTHER bucket's share up too (same
  // amounts, smaller total): equity 66.7% (was 55.6%), bond 17.8% (was 14.8%).
  // Equity's drift (66.7 - 65 = 1.7pp) is now under the 5pp threshold, so it no
  // longer triggers a rebalancing action.
  assertEquals(d.risk_band, "growth");
  const actionsByBucket = new Map(d.rebalancing_actions.map((a) => [a.bucket, a]));
  assert(!actionsByBucket.has("equity")); // 66.7 vs 65, only 1.7pp drift
  assertEquals(actionsByBucket.get("bond")?.action, "increase"); // 17.8 vs 25
  assertEquals(actionsByBucket.get("bond")?.amount, 3240);
  assertEquals(actionsByBucket.get("cash")?.action, "reduce"); // 11.1 vs 5
  assertEquals(actionsByBucket.get("cash")?.amount, 2745);
  // alternatives drift is only 4.4 - 5 = -0.6pp, under the 5pp threshold
  assert(!actionsByBucket.has("alternatives"));
  assertEquals(d.rebalancing_actions.length, 2);
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
  // P2a: liquid_assets_after_emergency dropped to 5000 (see the allocation
  // test above) once the fixture's mortgage installment counted toward the
  // 6-month reserve.
  assertEquals(cash.amount, 5000);
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
  // P2a: 50,000 liquid − 45,000 reserve = 5,000 — the reserve grew from
  // 36,000 because the fixture's mortgage installment (1,500/mo) is now
  // auto-derived into essential spend (6,000 manual + 1,500 derived = 7,500/mo).
  const d = det();
  const cash = d.current_allocation.find((r) => r.bucket === "cash")!;
  assertEquals(cash.amount, 5000);
});

Deno.test("wealth_projection compounds investable_total plus monthly surplus at 5/10/15 years", () => {
  // P2a: default fixture now nets investable_total 5,000 (see the allocation
  // test above) and annual_surplus 42,000 (90,000 of expenses now includes
  // the derived mortgage installment), growth band r=0.075.
  const d = det();
  const investable = 5000;
  const r = 0.075;
  const monthlySurplus = 3500; // 42,000 / 12
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
  const monthlySurplus = 3500; // P2a: 42,000 annual surplus / 12 (see test above)
  const expected = [5, 10, 15].map((y) => ({
    year: y,
    projected: Math.round(
      investable * Math.pow(1 + r, y) + fvMonthly(monthlySurplus, r, y),
    ),
  }));
  assertEquals(d.no_investable, true);
  assertEquals(d.wealth_projection, expected);
});

// ---------------------------------------------------------------------------
// P3 决策 1 — a holding already folded into an asset (its account has an
// asset_id) must not also be summed into the investable total.
// ---------------------------------------------------------------------------

Deno.test("a holding backed by a migrated account is excluded from investable_total", () => {
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
    investment_accounts: [
      { id: "acct-1", asset_id: "asset-1", account_type: "unit_trust", prs_sub_account_a: null, prs_sub_account_b: null },
    ],
    holdings: [
      // backed by a migrated account — excluded (its value already lives on asset-1)
      { account_id: "acct-1", snapshot_month: "2026-07-01", instrument_code: "F1", market_value: 10000, cost_basis: null },
    ],
  });
  // Same fixture as "allocation buckets & pct math with mixed assets and
  // holdings" above but WITHOUT the 10,000 holding: investable_total is
  // 45,000 - 10,000 = 35,000, and equity drops to 20,000.
  assertEquals(d.investable_total, 35000);
  const equity = d.current_allocation.find((r) => r.bucket === "equity")!;
  assertEquals(equity.amount, 20000);
});

Deno.test("portfolio_drift groups the same target_allocation/drift/rebalancing_actions as the flat fields", () => {
  const d = det();
  assertEquals(d.portfolio_drift.target_allocation, d.target_allocation);
  assertEquals(d.portfolio_drift.drift, d.drift);
  assertEquals(d.portfolio_drift.rebalancing_actions, d.rebalancing_actions);
});

Deno.test("wealth_projection FV term is zero when monthly surplus is zero", () => {
  const d = det({
    client: { ...makeCfpData().client, risk_profile: null }, // -> balanced band, r=0.06
    cashflow: [
      { direction: "inflow", amount: 6000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
      { direction: "outflow", amount: 6000, frequency: "monthly", category: "household", period_month: "2026-06-01" },
    ],
  });
  // P2a: this cashflow break-evens on its own, but the fixture's mortgage
  // installment (1,500/mo) is auto-derived on top, so the household is
  // actually RM1,500/mo short — monthly_surplus is negative, not zero.
  // computeInvestment still clamps it to a zero FV-term contribution below.
  assertEquals(d.monthly_surplus, -1500);
  assertEquals(d.risk_band, "balanced");
  // P2a: 50,000 liquid − 45,000 reserve (6,000 manual + 1,500 derived = 7,500/mo
  // essential spend x 6) = 5,000, not 14,000.
  const investable = 5000;
  const r = 0.06;
  const expected = [5, 10, 15].map((y) => ({
    year: y,
    projected: Math.round(investable * Math.pow(1 + r, y)), // fvMonthly term is 0 (surplus clamped)
  }));
  assertEquals(d.wealth_projection, expected);
});
