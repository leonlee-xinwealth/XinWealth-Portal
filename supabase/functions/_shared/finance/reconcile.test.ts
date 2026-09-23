import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { reconcile, type ReconcileAsset, type ReconcilePlan } from "./reconcile.ts";
import type { StandingItem } from "../cashflow/items.ts";
import type { Valuation } from "./valuation.ts";

// ---------------------------------------------------------------------------
// The task's worked example, verbatim:
// prev NW 100,000 -> curr NW 112,000 over 3 months, plan surplus 2,000/mo,
// principal 500/mo, employer EPF 600/mo, a unit trust rising 5,000 of which
// 1,500 was a linked 500/mo contribution -> explained = 3*3,100 + 3,500 =
// 12,800 -> unexplained = -800.
// ---------------------------------------------------------------------------

Deno.test("reconcile: worked example — unit trust with a linked contribution", () => {
  const plan: ReconcilePlan = { monthly_surplus: 2000, monthly_principal: 500, monthly_employer_epf: 600 };
  const assets: ReconcileAsset[] = [{ id: "ut1", asset_type: "unit_trust" }];
  const valuationsByAsset: Record<string, Valuation[]> = {
    ut1: [
      { valuation_date: "2026-01-01", value: 50000 },
      { valuation_date: "2026-04-01", value: 55000 }, // +5000 raw
    ],
  };
  const items: StandingItem[] = [
    {
      id: "i1",
      direction: "outflow",
      category: "unit_trust_contribution",
      amount: 500,
      frequency: "monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      linked_asset_id: "ut1",
    },
  ];

  const r = reconcile({
    prev: { net_worth: 100000, asOf: "2026-01-01" },
    curr: { net_worth: 112000, asOf: "2026-04-01" },
    months: 3,
    plan,
    assets,
    valuationsByAsset,
    items,
  });

  assertEquals(r.delta_net_worth, 12000);
  assertEquals(r.explained.savings, 6000); // 3*2000
  assertEquals(r.explained.principal, 1500); // 3*500
  assertEquals(r.explained.employer_epf, 1800); // 3*600
  assertEquals(r.explained.market_change, 3500); // 5000 - 1500
  assertEquals(r.market_by_asset.length, 1);
  assertEquals(r.market_by_asset[0].value_change, 5000);
  assertEquals(r.market_by_asset[0].contribution_adjustment, 1500);
  assertEquals(r.market_by_asset[0].market_change, 3500);
  assertEquals(r.unexplained_gap, -800);
});

// ---------------------------------------------------------------------------
// EPF: accounts pooled into one combined row, employee+employer both
// subtracted.
// ---------------------------------------------------------------------------

Deno.test("reconcile: EPF accounts are pooled and subtract employee+employer contributions together", () => {
  const plan: ReconcilePlan = {
    monthly_surplus: 1000,
    monthly_principal: 0,
    monthly_employer_epf: 300,
    monthly_employee_epf: 250,
  };
  const assets: ReconcileAsset[] = [
    { id: "epf1", asset_type: "epf_account_1" },
    { id: "epf2", asset_type: "epf_account_2" },
  ];
  const valuationsByAsset: Record<string, Valuation[]> = {
    epf1: [{ valuation_date: "2026-01-01", value: 40000 }, { valuation_date: "2026-04-01", value: 41800 }], // +1800
    epf2: [{ valuation_date: "2026-01-01", value: 10000 }, { valuation_date: "2026-04-01", value: 10400 }], // +400
  };

  const r = reconcile({
    prev: { net_worth: 50000, asOf: "2026-01-01" },
    curr: { net_worth: 53650, asOf: "2026-04-01" },
    months: 3,
    plan,
    assets,
    valuationsByAsset,
    items: [],
  });

  // combined raw change = 1800 + 400 = 2200; contribution = 3*(250+300) = 1650
  assertEquals(r.market_by_asset.length, 1);
  assertEquals(r.market_by_asset[0].asset_id, "epf_combined");
  assertEquals(r.market_by_asset[0].value_change, 2200);
  assertEquals(r.market_by_asset[0].contribution_adjustment, 1650);
  assertEquals(r.market_by_asset[0].market_change, 550);
});

// ---------------------------------------------------------------------------
// A-class (liquid) assets never produce a market_by_asset row.
// ---------------------------------------------------------------------------

Deno.test("reconcile: class-A liquid assets are excluded from market_by_asset", () => {
  const plan: ReconcilePlan = { monthly_surplus: 0, monthly_principal: 0, monthly_employer_epf: 0 };
  const assets: ReconcileAsset[] = [{ id: "sav1", asset_type: "savings" }];
  const r = reconcile({
    prev: { net_worth: 1000, asOf: "2026-01-01" },
    curr: { net_worth: 1500, asOf: "2026-04-01" },
    months: 3,
    plan,
    assets,
    valuationsByAsset: { sav1: [{ valuation_date: "2026-04-01", value: 1500 }] },
    items: [],
  });
  assertEquals(r.market_by_asset.length, 0);
  assertEquals(r.explained.market_change, 0);
  assertEquals(r.unexplained_gap, 500); // nothing explains the +500 at all
});

// ---------------------------------------------------------------------------
// Missing valuation history -> market_change falls back to 0 (minus any
// linked contribution), with a note.
// ---------------------------------------------------------------------------

Deno.test("reconcile: an asset with no valuation history falls back to 0 market change, with a note", () => {
  const plan: ReconcilePlan = { monthly_surplus: 0, monthly_principal: 0, monthly_employer_epf: 0 };
  const assets: ReconcileAsset[] = [{ id: "prop1", asset_type: "investment_property" }];
  const r = reconcile({
    prev: { net_worth: 100000, asOf: "2026-01-01" },
    curr: { net_worth: 100000, asOf: "2026-04-01" },
    months: 3,
    plan,
    assets,
    valuationsByAsset: {},
    items: [],
  });
  assertEquals(r.market_by_asset[0].source, "none");
  assertEquals(r.market_by_asset[0].value_change, 0);
  assertEquals(r.market_by_asset[0].market_change, 0);
  assertEquals(r.notes.some((n) => n.includes("prop1")), true);
});

// ---------------------------------------------------------------------------
// Unlinked transfer item -> the 「未关联的定期投入会让对账失真」note.
// ---------------------------------------------------------------------------

Deno.test("reconcile: an active transfer item with no linked_asset_id adds the unlinked-contribution note", () => {
  const plan: ReconcilePlan = { monthly_surplus: 0, monthly_principal: 0, monthly_employer_epf: 0 };
  const items: StandingItem[] = [
    {
      direction: "outflow",
      category: "unit_trust_contribution",
      amount: 300,
      frequency: "monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      // no linked_asset_id
    },
  ];
  const r = reconcile({
    prev: { net_worth: 0, asOf: "2026-01-01" },
    curr: { net_worth: 0, asOf: "2026-04-01" },
    months: 3,
    plan,
    assets: [],
    valuationsByAsset: {},
    items,
  });
  assertEquals(r.notes.includes("未关联的定期投入会让对账失真"), true);
});

Deno.test("reconcile: no unlinked-contribution note when every transfer item is linked", () => {
  const plan: ReconcilePlan = { monthly_surplus: 0, monthly_principal: 0, monthly_employer_epf: 0 };
  const items: StandingItem[] = [
    {
      direction: "outflow",
      category: "unit_trust_contribution",
      amount: 300,
      frequency: "monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      linked_asset_id: "ut1",
    },
  ];
  const r = reconcile({
    prev: { net_worth: 0, asOf: "2026-01-01" },
    curr: { net_worth: 0, asOf: "2026-04-01" },
    months: 3,
    plan,
    assets: [{ id: "ut1", asset_type: "unit_trust" }],
    valuationsByAsset: { ut1: [{ valuation_date: "2026-01-01", value: 1000 }, { valuation_date: "2026-04-01", value: 1900 }] },
    items,
  });
  assertEquals(r.notes.includes("未关联的定期投入会让对账失真"), false);
});
