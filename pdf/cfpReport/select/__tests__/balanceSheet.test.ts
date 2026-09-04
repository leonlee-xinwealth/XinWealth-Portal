import { describe, it, expect } from "vitest";
import { selectBalanceTotals, assetRows, liabilityRows, netWorthRows } from "../balanceSheet";
import { money } from "../../viz/DataTable";
import type { CfpReportData } from "../../types";

function payload(
  assets: Array<Record<string, unknown>>,
  liabilities: Array<Record<string, unknown>> = [],
): CfpReportData {
  return {
    clientName: "Test", advisorName: "A", period: "2026", generatedDate: "x",
    language: "zh", hasUnapproved: false, client: {}, baseline: null, sections: [],
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
