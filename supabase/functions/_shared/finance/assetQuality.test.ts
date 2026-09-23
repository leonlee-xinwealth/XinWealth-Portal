import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { assessAsset, assessAssets, QUADRANTS, type AssetInput, type LiabilityInput } from "./assetQuality.ts";
import type { StandingItem } from "../cashflow/items.ts";

const ASOF = "2026-09-23";

function item(o: {
  direction: "inflow" | "outflow";
  category: string;
  amount: number;
  frequency?: string;
  linked_asset_id: string;
  effective_from?: string;
  effective_to?: string | null;
}): StandingItem {
  return {
    frequency: "monthly",
    effective_from: "2026-01-01",
    effective_to: null,
    ...o,
  };
}

Deno.test("QUADRANTS lists all four with zh/en labels", () => {
  assertEquals(QUADRANTS.length, 4);
  assertEquals(QUADRANTS.map((q) => q.id).sort(), [
    "appreciating_cash_consuming",
    "consuming",
    "productive",
    "yielding_depreciating",
  ]);
  for (const q of QUADRANTS) {
    assert(q.label_zh.length > 0);
    assert(q.label_en.length > 0);
  }
});

Deno.test("rental condo (spec example): rent in, maintenance out, mortgage installment -> net 0 -> productive when value >= 0", () => {
  const asset: AssetInput = { id: "condo-1", asset_type: "investment_property", current_value: 300000 };
  const items: StandingItem[] = [
    item({ direction: "inflow", category: "rental_income", amount: 1800, linked_asset_id: "condo-1" }),
    item({ direction: "outflow", category: "maintenance_fee", amount: 300, linked_asset_id: "condo-1" }),
  ];
  const liabilities: LiabilityInput[] = [
    {
      id: "loan-1",
      liability_type: "mortgage",
      outstanding_balance: 300000,
      interest_rate: 4.2,
      monthly_payment: 1500,
      remaining_months: 240,
      linked_asset_id: "condo-1",
    },
  ];
  const r = assessAsset(asset, { items, liabilities, valuations: [] }, ASOF);
  assertEquals(r.net_cash_flow_monthly, 0);
  assertEquals(r.linked_items.length, 2);
  assertEquals(r.linked_liabilities.length, 1);
  assertEquals(r.linked_liabilities[0].monthly_payment, 1500);
  assertEquals(r.value_change_annual, null);
  assertEquals(r.value_change_source, "none");
  assert(r.notes.includes("缺少估值历史"));
  // no valuation history -> value change treated as 0 -> value "flat" -> productive
  assertEquals(r.quadrant, "productive");
  assertEquals(r.total_return_annual, 0); // 0*12 + 0
});

Deno.test("an item or liability linked to a DIFFERENT asset is not counted", () => {
  const asset: AssetInput = { id: "condo-1", asset_type: "investment_property", current_value: 300000 };
  const items: StandingItem[] = [
    item({ direction: "inflow", category: "rental_income", amount: 5000, linked_asset_id: "other-asset" }),
  ];
  const liabilities: LiabilityInput[] = [
    { id: "loan-x", liability_type: "mortgage", outstanding_balance: 100000, monthly_payment: 900, linked_asset_id: "other-asset" },
  ];
  const r = assessAsset(asset, { items, liabilities, valuations: [] }, ASOF);
  assertEquals(r.linked_items.length, 0);
  assertEquals(r.linked_liabilities.length, 0);
  assertEquals(r.net_cash_flow_monthly, 0);
});

Deno.test("class A (liquid) and class B (retirement) assets are never labeled", () => {
  const savings: AssetInput = { id: "sav-1", asset_type: "savings", current_value: 20000 };
  const epf: AssetInput = { id: "epf-1", asset_type: "epf_account_1", current_value: 150000 };
  const rSavings = assessAsset(savings, {}, ASOF);
  const rEpf = assessAsset(epf, {}, ASOF);
  assertEquals(rSavings.asset_class, "A");
  assertEquals(rSavings.quadrant, null);
  assertEquals(rEpf.asset_class, "B");
  assertEquals(rEpf.quadrant, null);
});

Deno.test("all four quadrants + by_quadrant totals via assessAssets", () => {
  const assets: AssetInput[] = [
    { id: "p1", asset_type: "stock", current_value: 50000 }, // productive
    { id: "v1", asset_type: "vehicle", current_value: 40000 }, // yielding_depreciating
    { id: "s1", asset_type: "stock", current_value: 60000 }, // appreciating_cash_consuming
    { id: "v2", asset_type: "vehicle", current_value: 30000 }, // consuming
    { id: "sav-1", asset_type: "savings", current_value: 20000 }, // unlabeled (A)
  ];

  const items: StandingItem[] = [
    // p1: net cash flow +200/mo (dividend)
    item({ direction: "inflow", category: "dividend_investment", amount: 200, linked_asset_id: "p1" }),
    // v1: grab income 1000 in, fuel 400 out -> net +600/mo
    item({ direction: "inflow", category: "side_income", amount: 1000, linked_asset_id: "v1" }),
    item({ direction: "outflow", category: "fuel", amount: 400, linked_asset_id: "v1" }),
  ];

  const liabilities: LiabilityInput[] = [
    // s1: margin financing installment -500/mo, no offsetting inflow
    { id: "loan-s1", liability_type: "share_margin", outstanding_balance: 20000, monthly_payment: 500, linked_asset_id: "s1" },
    // v2: car loan installment -800/mo, no offsetting inflow
    { id: "loan-v2", liability_type: "car_loan", outstanding_balance: 40000, monthly_payment: 800, linked_asset_id: "v2" },
  ];

  const valuations = [
    // p1: +5000/yr (grew from 45000 to 50000 over ~1yr)
    { asset_id: "p1", valuation_date: "2025-09-23", value: 45000 },
    { asset_id: "p1", valuation_date: "2026-09-23", value: 50000 },
    // s1: +3000/yr (grew from 57000 to 60000 over ~1yr)
    { asset_id: "s1", valuation_date: "2025-09-23", value: 57000 },
    { asset_id: "s1", valuation_date: "2026-09-23", value: 60000 },
    // v1 and v2 have no valuation history -> vehicle default depreciation applies
  ];

  const { assets: results, by_quadrant } = assessAssets(assets, { items, liabilities, valuations }, ASOF);
  const byId = new Map(results.map((r) => [r.asset_id, r]));

  assertEquals(byId.get("p1")!.quadrant, "productive");
  assertEquals(byId.get("p1")!.net_cash_flow_monthly, 200);
  assertEquals(byId.get("p1")!.value_change_annual, 5000);

  assertEquals(byId.get("v1")!.quadrant, "yielding_depreciating");
  assertEquals(byId.get("v1")!.net_cash_flow_monthly, 600);
  assertEquals(byId.get("v1")!.value_change_annual, -4000); // -10% of 40000
  assertEquals(byId.get("v1")!.value_change_source, "default_depreciation");

  assertEquals(byId.get("s1")!.quadrant, "appreciating_cash_consuming");
  assertEquals(byId.get("s1")!.net_cash_flow_monthly, -500);
  assertEquals(byId.get("s1")!.value_change_annual, 3000);

  assertEquals(byId.get("v2")!.quadrant, "consuming");
  assertEquals(byId.get("v2")!.net_cash_flow_monthly, -800);
  assertEquals(byId.get("v2")!.value_change_annual, -3000); // -10% of 30000

  assertEquals(byId.get("sav-1")!.quadrant, null);

  assertEquals(by_quadrant.productive, { count: 1, value: 50000, net_cash_flow_monthly: 200 });
  assertEquals(by_quadrant.yielding_depreciating, { count: 1, value: 40000, net_cash_flow_monthly: 600 });
  assertEquals(by_quadrant.appreciating_cash_consuming, { count: 1, value: 60000, net_cash_flow_monthly: -500 });
  assertEquals(by_quadrant.consuming, { count: 1, value: 30000, net_cash_flow_monthly: -800 });
});

Deno.test("total_return_annual and return_pct combine net cash flow x12 with the value change", () => {
  const asset: AssetInput = { id: "p1", asset_type: "stock", current_value: 50000 };
  const items: StandingItem[] = [
    item({ direction: "inflow", category: "dividend_investment", amount: 200, linked_asset_id: "p1" }),
  ];
  const valuations = [
    { valuation_date: "2025-09-23", value: 45000 },
    { valuation_date: "2026-09-23", value: 50000 },
  ];
  const r = assessAsset(asset, { items, valuations }, ASOF);
  // total_return_annual = 200*12 + 5000 = 7400; return_pct = 7400/50000
  assertEquals(r.total_return_annual, 7400);
  assertEquals(r.return_pct, 0.148);
});

Deno.test("return_pct is null when current_value is 0", () => {
  const asset: AssetInput = { id: "z1", asset_type: "stock", current_value: 0 };
  const r = assessAsset(asset, {}, ASOF);
  assertEquals(r.return_pct, null);
});

// ---------------------------------------------------------------------------
// Prod incident fix: a class D (personal use) asset with NO linked standing
// items and NO linked liabilities was falling through to net_cash_flow_monthly
// === 0 -> quadrantFor(0, 0) -> "productive" — a personal-use house with a
// RM 3,298/mo mortgage that simply hadn't been linked yet was mislabeled 生财
// 资产, and an unlinked car came out 收益但贬值. Neither has any real cash
// flow data behind it; the fix withholds the quadrant entirely until the
// advisor links something.
// ---------------------------------------------------------------------------

Deno.test("class D asset with zero linked items and zero linked liabilities gets no quadrant, flagged unlinked", () => {
  const house: AssetInput = { id: "house-1", asset_type: "own_residence", current_value: 800000 };
  const r = assessAsset(house, {}, ASOF);
  assertEquals(r.linked_items.length, 0);
  assertEquals(r.linked_liabilities.length, 0);
  assertEquals(r.quadrant, null);
  assertEquals(r.unlinked, true);
  assert(r.notes.includes("自用资产通常有持有成本（贷款、保险、保养、税费），请先关联相关贷款或收支"));
});

Deno.test("the same house, once its mortgage is linked, gets a real quadrant again", () => {
  const house: AssetInput = { id: "house-1", asset_type: "own_residence", current_value: 800000 };
  const liabilities: LiabilityInput[] = [
    {
      id: "mortgage-1",
      liability_type: "mortgage",
      outstanding_balance: 600000,
      interest_rate: 4.0,
      monthly_payment: 3298,
      remaining_months: 300,
      linked_asset_id: "house-1",
    },
  ];
  const r = assessAsset(house, { liabilities, valuations: [] }, ASOF);
  assertEquals(r.linked_liabilities.length, 1);
  assertEquals(r.net_cash_flow_monthly, -3298);
  assertEquals(r.unlinked, false);
  // no offsetting inflow -> cash negative; no valuation history -> value
  // change treated as 0 (>= 0) -> appreciating_cash_consuming.
  assertEquals(r.quadrant, "appreciating_cash_consuming");
  assert(!r.notes.includes("自用资产通常有持有成本（贷款、保险、保养、税费），请先关联相关贷款或收支"));
});

Deno.test("an unlinked car (class D, no links) also gets no quadrant instead of defaulting to yielding_depreciating", () => {
  const car: AssetInput = { id: "car-1", asset_type: "vehicle", current_value: 90000 };
  const r = assessAsset(car, {}, ASOF);
  assertEquals(r.quadrant, null);
  assertEquals(r.unlinked, true);
});

Deno.test("class C asset with no links keeps its computed quadrant but is flagged unlinked", () => {
  const gold: AssetInput = { id: "gold-1", asset_type: "gold", current_value: 20000 };
  const r = assessAsset(gold, {}, ASOF);
  assertEquals(r.linked_items.length, 0);
  assertEquals(r.linked_liabilities.length, 0);
  assertEquals(r.unlinked, true);
  // 0 net cash flow, 0 value change (gold isn't a vehicle, no history) -> still classified.
  assertEquals(r.quadrant, "productive");
  assert(r.notes.includes("未关联任何收支"));
});

Deno.test("by_quadrant.unlinked tallies class-D unlinked assets separately from the four quadrants", () => {
  const assets: AssetInput[] = [
    { id: "house-1", asset_type: "own_residence", current_value: 800000 }, // unlinked D
    { id: "car-1", asset_type: "vehicle", current_value: 90000 }, // unlinked D
    { id: "p1", asset_type: "stock", current_value: 50000 }, // productive (has a linked item)
  ];
  const items: StandingItem[] = [
    item({ direction: "inflow", category: "dividend_investment", amount: 200, linked_asset_id: "p1" }),
  ];
  const { assets: results, by_quadrant } = assessAssets(assets, { items }, ASOF);
  assertEquals(results.find((r) => r.asset_id === "house-1")!.quadrant, null);
  assertEquals(results.find((r) => r.asset_id === "car-1")!.quadrant, null);
  assertEquals(by_quadrant.unlinked, { count: 2, value: 890000 });
  assertEquals(by_quadrant.productive.count, 1);
});

Deno.test("an item that is not active at asOf is excluded", () => {
  const asset: AssetInput = { id: "p1", asset_type: "stock", current_value: 10000 };
  const items: StandingItem[] = [
    item({
      direction: "inflow",
      category: "dividend_investment",
      amount: 500,
      linked_asset_id: "p1",
      effective_from: "2020-01-01",
      effective_to: "2021-12-01", // closed long before asOf
    }),
  ];
  const r = assessAsset(asset, { items }, ASOF);
  assertEquals(r.linked_items.length, 0);
  assertEquals(r.net_cash_flow_monthly, 0);
});
