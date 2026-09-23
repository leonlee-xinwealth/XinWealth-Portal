import { describe, it, expect } from "vitest";
import {
  selectBalanceTotals, assetRows, liabilityRows, netWorthRows,
  selectAssetQuality, quadrantSummaryRows,
} from "../balanceSheet";
import { money } from "../../viz/DataTable";
import type { CfpReportData } from "../../types";

function payload(
  assets: Array<Record<string, unknown>>,
  liabilities: Array<Record<string, unknown>> = [],
  baseline: Record<string, unknown> | null = null,
): CfpReportData {
  return {
    clientName: "Test", advisorName: "A", period: "2026", generatedDate: "x",
    language: "zh", hasUnapproved: false, client: {}, baseline, sections: [],
    assets: assets as unknown as CfpReportData["assets"],
    liabilities: liabilities as unknown as CfpReportData["liabilities"],
  };
}

const ASSETS = [
  { asset_type: "savings", name: "储蓄户口", current_value: 60_000 },
  { asset_type: "fixed_deposit", name: "定期存款", current_value: 36_000 },
  { asset_type: "epf_account_1", name: "EPF 户口一", current_value: 320_000 },
  { asset_type: "stock", name: "股票组合", current_value: 87_000 },
  { asset_type: "property", name: "自住房产", current_value: 500_000 },
];
const LIABS = [
  { liability_type: "mortgage", name: "房贷", outstanding_balance: 700_000 },
  { liability_type: "credit_card", name: "信用卡", outstanding_balance: 21_500 },
  { liability_type: "car_loan", name: "车贷", outstanding_balance: 50_000 },
];

describe("totals", () => {
  const t = selectBalanceTotals(payload(ASSETS, LIABS));

  it("sums assets and liabilities from the printed rows", () => {
    expect(t.assets).toBe(1_003_000);
    expect(t.liabilities).toBe(771_500);
  });

  it("derives net worth so the table always foots", () => {
    expect(t.netWorth).toBe(t.assets - t.liabilities);
  });

  it("groups assets and the group subtotals add back to the whole", () => {
    expect(t.assetGroups.map((g) => g.group)).toEqual(["liquid", "investment", "retirement", "fixed"]);
    expect(t.assetGroups.reduce((s, g) => s + g.total, 0)).toBe(t.assets);
    expect(t.assetGroups.reduce((s, g) => s + g.share, 0)).toBeCloseTo(1, 8);
  });

  it("omits groups the client has nothing in", () => {
    const only = selectBalanceTotals(payload([ASSETS[0]]));
    expect(only.assetGroups.map((g) => g.group)).toEqual(["liquid"]);
  });

  it("totals high-interest debt for the 高息负债 callout", () => {
    expect(t.highInterestTotal).toBe(21_500);
  });

  it("survives an empty client without dividing by zero", () => {
    const e = selectBalanceTotals(payload([], []));
    expect(e).toMatchObject({ assets: 0, liabilities: 0, netWorth: 0, highInterestTotal: 0 });
    expect(e.assetGroups).toEqual([]);
  });
});

describe("asset rows", () => {
  const rows = assetRows(payload(ASSETS, LIABS));

  it("emits a group header, its items and a subtotal, then one grand total", () => {
    expect(rows.filter((r) => r.kind === "group")).toHaveLength(4);
    expect(rows.filter((r) => r.kind === "subtotal")).toHaveLength(4);
    const totals = rows.filter((r) => r.kind === "total");
    expect(totals).toHaveLength(1);
    expect(totals[0].value).toBe(money(1_003_000));
  });

  it("orders items big to small inside a group", () => {
    const liquid = rows.slice(
      rows.findIndex((r) => r.kind === "group") + 1,
      rows.findIndex((r) => r.kind === "subtotal"),
    );
    expect(liquid.map((r) => r.label)).toEqual(["储蓄户口", "定期存款"]);
  });

  it("never leaves a raw enum in a label or meta cell", () => {
    for (const r of rows) {
      expect(r.label, r.label).not.toMatch(/_/);
      if (r.meta) expect(r.meta, r.meta).not.toMatch(/_/);
    }
  });

  it("returns nothing when the client has no assets, so the page can show its empty state", () => {
    expect(assetRows(payload([]))).toEqual([]);
  });
});

describe("liability rows", () => {
  const rows = liabilityRows(payload(ASSETS, LIABS));

  it("flags revolving consumer debt and leaves secured debt unflagged", () => {
    expect(rows.find((r) => r.label === "信用卡")?.flag).toBe("bad");
    expect(rows.find((r) => r.label === "房贷")?.flag).toBeUndefined();
  });

  it("orders biggest first and closes with the total", () => {
    expect(rows.map((r) => r.label)).toEqual(["房贷", "车贷", "信用卡", "负债总额"]);
    expect(rows[rows.length - 1].kind).toBe("total");
  });
});

describe("net worth summary", () => {
  it("prints liabilities as a negative in accounting parentheses", () => {
    const rows = netWorthRows(payload(ASSETS, LIABS));
    expect(rows[1].value).toBe("(RM 771,500)");
    expect(rows[2].value).toBe(money(231_500));
  });

  it("shows a negative net worth in parentheses too", () => {
    const rows = netWorthRows(payload([ASSETS[0]], LIABS));
    expect(rows[2].value).toMatch(/^\(RM /);
  });
});

describe("money formatting", () => {
  it("uses parentheses rather than a minus sign", () => {
    expect(money(1234)).toBe("RM 1,234");
    expect(money(-1234)).toBe("(RM 1,234)");
  });

  it("renders a dash for missing figures rather than RM 0", () => {
    expect(money(null)).toBe("—");
    expect(money(undefined)).toBe("—");
    expect(money(NaN)).toBe("—");
    expect(money(0)).toBe("RM 0");
  });
});

// ---------------------------------------------------------------------------
// P3 决策 3 — the per-asset 2×2 (assessAssets result), read off
// `baseline.asset_quality`. See supabase/functions/_shared/finance/
// assetQuality.ts for the shape this mirrors.
// ---------------------------------------------------------------------------

const ASSET_QUALITY_BASELINE = {
  asset_quality: {
    assets: [
      {
        asset_id: "asset-property-1", asset_class: "D", quadrant: "appreciating_cash_consuming",
        net_cash_flow_monthly: -4_200, value_change_annual: 15_000,
      },
    ],
    by_quadrant: {
      productive: { count: 0, value: 0, net_cash_flow_monthly: 0 },
      yielding_depreciating: { count: 0, value: 0, net_cash_flow_monthly: 0 },
      appreciating_cash_consuming: { count: 1, value: 500_000, net_cash_flow_monthly: -4_200 },
      consuming: { count: 0, value: 0, net_cash_flow_monthly: 0 },
    },
  },
};

describe("selectAssetQuality", () => {
  it("returns all four quadrants in framework order, even the empty ones", () => {
    const q = selectAssetQuality(payload(ASSETS, [], ASSET_QUALITY_BASELINE));
    expect(q.hasData).toBe(true);
    expect(q.byQuadrant.map((r) => r.quadrant)).toEqual([
      "productive", "yielding_depreciating", "appreciating_cash_consuming", "consuming",
    ]);
    const appreciating = q.byQuadrant.find((r) => r.quadrant === "appreciating_cash_consuming")!;
    expect(appreciating).toMatchObject({ count: 1, value: 500_000, netCashFlowMonthly: -4_200, labelZh: "增值但吃现金" });
  });

  it("keys perAsset by asset_id for the row-level match", () => {
    const q = selectAssetQuality(payload(ASSETS, [], ASSET_QUALITY_BASELINE));
    expect(q.perAsset["asset-property-1"]).toMatchObject({
      labelZh: "增值但吃现金", netCashFlowMonthly: -4_200, valueChangeAnnual: 15_000,
    });
  });

  it("has no data and no matches without a baseline", () => {
    const q = selectAssetQuality(payload(ASSETS));
    expect(q.hasData).toBe(false);
    expect(q.byQuadrant.every((r) => r.count === 0)).toBe(true);
    expect(q.perAsset).toEqual({});
  });

  it("survives a baseline with no asset_quality at all (pre-P3 report)", () => {
    const q = selectAssetQuality(payload(ASSETS, [], { net_worth: 100 }));
    expect(q.hasData).toBe(false);
    expect(q.perAsset).toEqual({});
  });
});

describe("quadrant summary rows", () => {
  it("builds one row per quadrant with count, net cash flow and value", () => {
    const rows = quadrantSummaryRows(payload(ASSETS, [], ASSET_QUALITY_BASELINE));
    expect(rows).toHaveLength(4);
    const row = rows.find((r) => r.label === "增值但吃现金")!;
    expect(row.value).toBe(money(500_000));
    expect(row.meta).toContain("1 项");
  });

  it("returns nothing when the baseline has no asset_quality", () => {
    expect(quadrantSummaryRows(payload(ASSETS))).toEqual([]);
  });
});

describe("asset rows with a matched quadrant", () => {
  it("appends the quadrant label to the row's meta when the asset id matches", () => {
    const assetsWithId = ASSETS.map((a) =>
      a.asset_type === "property" ? { ...a, id: "asset-property-1" } : a,
    );
    const rows = assetRows(payload(assetsWithId, [], ASSET_QUALITY_BASELINE));
    const propertyRow = rows.find((r) => r.label === "自住房产")!;
    expect(propertyRow.meta).toContain("增值但吃现金");
  });

  it("leaves meta unchanged when the row has no id to match with (existing behaviour)", () => {
    // Same rows, with vs. without asset_quality on the baseline — confirms
    // adding P3 support did not change a single existing row's meta when
    // `data.assets` carries no `id` (every report before the caller's query
    // selects it, which is every report as of this change).
    const withQuality = assetRows(payload(ASSETS, LIABS, ASSET_QUALITY_BASELINE));
    const without = assetRows(payload(ASSETS, LIABS));
    expect(withQuality.map((r) => r.meta)).toEqual(without.map((r) => r.meta));
  });
});
