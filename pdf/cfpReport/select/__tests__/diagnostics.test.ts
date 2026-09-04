import { describe, it, expect } from "vitest";
import { selectRatios, formatRatio, investmentAssetsOf, type RatioId } from "../diagnostics";
import type { CfpReportData } from "../../types";

/** Minimal payload; every test overrides only the fields it cares about. */
function payload(baseline: Record<string, unknown> | null, assets: unknown[] = []): CfpReportData {
  return {
    clientName: "Test",
    advisorName: "Advisor",
    period: "2026",
    generatedDate: "2026-08-18",
    language: "zh",
    hasUnapproved: false,
    client: {},
    baseline,
    sections: [],
    assets: assets as CfpReportData["assets"],
    liabilities: [],
  };
}

const HEALTHY = {
  liquid_assets_total: 60000,
  monthly_essential_expenses: 6000, // 10 months
  net_worth: 300000,
  total_assets: 500000,
  total_liabilities: 200000,
  solvency_ratio: 0.6,
  savings_ratio: 0.3,
  debt_service_ratio: 0.2,
};

const by = (rows: ReturnType<typeof selectRatios>, id: RatioId) => rows.find((r) => r.id === id)!;

describe("the seven blueprint ratios", () => {
  it("returns all seven, in blueprint order", () => {
    const ids = selectRatios(payload(HEALTHY)).map((r) => r.id);
    expect(ids).toEqual([
      "basicLiquidity",
      "liquidAssetToNetWorth",
      "solvency",
      "debtToAsset",
      "savings",
      "investmentAssets",
      "debtService",
    ]);
  });

  it("every row ships a verdict word, so status is never colour-alone", () => {
    for (const r of selectRatios(payload(HEALTHY))) {
      expect(r.verdictZh, r.id).toBeTruthy();
      expect(r.verdictEn, r.id).toBeTruthy();
      expect(r.basisZh, r.id).toBeTruthy();
      expect(r.benchmark, r.id).toBeTruthy();
    }
  });
});

describe("band boundaries match components/FinancialHealthCheck.tsx", () => {
  const liquidityAt = (months: number) =>
    by(selectRatios(payload({ ...HEALTHY, liquid_assets_total: months * 6000 })), "basicLiquidity");

  it("basic liquidity: >=6 healthy, >=3 adequate, below that at risk", () => {
    expect(liquidityAt(6).band).toBe("good");
    expect(liquidityAt(5.9).band).toBe("warn");
    expect(liquidityAt(3).band).toBe("warn");
    expect(liquidityAt(2.9).band).toBe("bad");
  });

  const liquidToNetAt = (v: number) =>
    by(selectRatios(payload({ ...HEALTHY, liquid_assets_total: v * 300000 })), "liquidAssetToNetWorth");

  it("liquid-to-net-worth: the ideal band is a window, not a floor", () => {
    expect(liquidToNetAt(0.15).band).toBe("good");
    expect(liquidToNetAt(0.2).band).toBe("good");
    expect(liquidToNetAt(0.21).band).toBe("warn"); // 资金闲置
    expect(liquidToNetAt(0.14).band).toBe("bad");
  });

  it("solvency: strictly greater than 50%", () => {
    expect(by(selectRatios(payload({ ...HEALTHY, solvency_ratio: 0.51 })), "solvency").band).toBe("good");
    expect(by(selectRatios(payload({ ...HEALTHY, solvency_ratio: 0.5 })), "solvency").band).toBe("bad");
  });

  it("debt service: <35% strong, <=50% acceptable, above that at risk", () => {
    const dsr = (v: number) => by(selectRatios(payload({ ...HEALTHY, debt_service_ratio: v })), "debtService").band;
    expect(dsr(0.34)).toBe("good");
    expect(dsr(0.35)).toBe("warn");
    expect(dsr(0.5)).toBe("warn");
    expect(dsr(0.51)).toBe("bad");
  });

  it("savings: strictly greater than 20%", () => {
    const s = (v: number) => by(selectRatios(payload({ ...HEALTHY, savings_ratio: v })), "savings").band;
    expect(s(0.21)).toBe("good");
    expect(s(0.2)).toBe("warn");
  });
});

describe("debt-to-asset is the exact mirror of solvency", () => {
  it("never contradicts solvency on the same page", () => {
    for (const s of [0.1, 0.49, 0.5, 0.51, 0.9]) {
      const rows = selectRatios(payload({ ...HEALTHY, solvency_ratio: s }));
      const solv = by(rows, "solvency");
      const dta = by(rows, "debtToAsset");
      expect(dta.value).toBeCloseTo(1 - s, 10);
      // one healthy implies the other healthy
      expect(dta.band === "good").toBe(solv.band === "good");
    }
  });
});

describe("missing and degenerate data", () => {
  it("a null baseline yields seven no-data rows rather than throwing", () => {
    const rows = selectRatios(payload(null));
    expect(rows).toHaveLength(7);
    for (const r of rows) {
      expect(r.value, r.id).toBeNull();
      expect(r.band, r.id).toBe("none");
      expect(r.verdictZh, r.id).toBe("无数据");
    }
  });

  it("a zero denominator is no-data, not zero", () => {
    const rows = selectRatios(payload({ ...HEALTHY, monthly_essential_expenses: 0, net_worth: 0 }));
    expect(by(rows, "basicLiquidity").value).toBeNull();
    expect(by(rows, "liquidAssetToNetWorth").value).toBeNull();
    expect(by(rows, "investmentAssets").value).toBeNull();
  });

  it("a negative net worth does not invent a ratio", () => {
    const rows = selectRatios(payload({ ...HEALTHY, net_worth: -50000 }));
    expect(by(rows, "liquidAssetToNetWorth").value).toBeNull();
    expect(by(rows, "investmentAssets").value).toBeNull();
  });

  it("null ratios coming from baseline stay null", () => {
    const rows = selectRatios(payload({ ...HEALTHY, solvency_ratio: null, savings_ratio: null, debt_service_ratio: null }));
    expect(by(rows, "solvency").value).toBeNull();
    expect(by(rows, "debtToAsset").value).toBeNull();
    expect(by(rows, "savings").value).toBeNull();
    expect(by(rows, "debtService").value).toBeNull();
  });
});

describe("investment assets classification", () => {
  const assets = [
    { asset_type: "savings", name: "a", current_value: 50000 },        // liquid — excluded
    { asset_type: "stock", name: "b", current_value: 80000 },          // investment
    { asset_type: "unit_trust", name: "c", current_value: 20000 },     // investment
    { asset_type: "epf_account_1", name: "d", current_value: 100000 }, // retirement
    { asset_type: "property", name: "e", current_value: 400000 },      // fixed — excluded
  ];

  it("counts wealth-building assets, excluding cash and the home", () => {
    expect(investmentAssetsOf(payload(HEALTHY, assets))).toBe(200000);
  });

  it("feeds the ratio off net worth", () => {
    const rows = selectRatios(payload({ ...HEALTHY, net_worth: 400000 }, assets));
    expect(by(rows, "investmentAssets").value).toBeCloseTo(0.5, 10);
    expect(by(rows, "investmentAssets").band).toBe("warn"); // 0.5 is not > 0.5
  });

  it("treats an unknown asset type as fixed rather than crashing", () => {
    expect(investmentAssetsOf(payload(HEALTHY, [{ asset_type: "nft", name: "x", current_value: 999 }]))).toBe(0);
  });
});

describe("formatting", () => {
  it("renders months and percents with the unit, and null as a dash", () => {
    const rows = selectRatios(payload(HEALTHY));
    expect(formatRatio(by(rows, "basicLiquidity"), "zh")).toBe("10 个月");
    expect(formatRatio(by(rows, "basicLiquidity"), "en")).toBe("10 mo");
    expect(formatRatio(by(rows, "solvency"), "zh")).toBe("60%");
    expect(formatRatio(by(selectRatios(payload(null)), "solvency"), "zh")).toBe("—");
  });
});

describe("ratios that leave their meaningful range", () => {
  // Drawn from a real client: RM 11,510 of assets against RM 140,000 of debt.
  // Solvency is arithmetically -1116% and debt-to-asset 1216%; both are correct
  // and both are useless to print. The fixture could never surface this because
  // it had a healthy balance sheet.
  const INSOLVENT = { ...HEALTHY, total_assets: 11_510, total_liabilities: 140_000, net_worth: -128_490, solvency_ratio: -11.163 };

  it("names insolvency instead of printing a four-digit percentage", () => {
    const rows = selectRatios(payload(INSOLVENT));
    expect(formatRatio(by(rows, "solvency"), "zh")).toBe("资不抵债");
    expect(formatRatio(by(rows, "solvency"), "en")).toBe("Insolvent");
    expect(formatRatio(by(rows, "debtToAsset"), "zh")).toBe("负债超出资产");
  });

  it("keeps the underlying value so the dial still positions itself", () => {
    const rows = selectRatios(payload(INSOLVENT));
    expect(by(rows, "solvency").value).toBeCloseTo(-11.163, 3);
    expect(by(rows, "solvency").band).toBe("bad");
  });

  it("leaves a solvent client's percentages alone", () => {
    const rows = selectRatios(payload(HEALTHY));
    expect(by(rows, "solvency").readoutZh).toBeUndefined();
    expect(formatRatio(by(rows, "solvency"), "zh")).toBe("60%");
  });

  it("still declines to divide by a negative net worth", () => {
    const rows = selectRatios(payload(INSOLVENT));
    expect(by(rows, "liquidAssetToNetWorth").value).toBeNull();
    expect(by(rows, "investmentAssets").value).toBeNull();
  });
});
