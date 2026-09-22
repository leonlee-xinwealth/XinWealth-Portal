import { describe, it, expect } from "vitest";
import { ASSET_OPTS, LIAB_OPTS } from "../../../../components/advisor/tabs/NetworthTab";
import { LIQUID_ASSET_TYPES } from "../../../../supabase/functions/cfp-brain/baseline.ts";
import {
  ASSET_TYPES, LIABILITY_TYPES, ASSET_GROUP_LABELS, ASSET_GROUP_ORDER,
  assetTypeLabel, liabilityTypeLabel, assetGroupOf, isHighInterest, cashflowCategoryLabel,
} from "../enums";
import { ASSET_TYPES as TAXONOMY_ASSETS } from "../../../../supabase/functions/_shared/taxonomy/balance";

describe("enum label coverage", () => {
  // The advisor UI is the only thing that creates these rows, so its option
  // lists are the contract. A new type added there without a label here would
  // otherwise print a raw enum on a client-facing page.
  it("labels every asset type the advisor UI can create", () => {
    const missing = ASSET_OPTS.map(([k]) => k).filter((k) => !ASSET_TYPES[k]);
    expect(missing).toEqual([]);
  });

  it("labels every liability type the advisor UI can create", () => {
    const missing = LIAB_OPTS.map(([k]) => k).filter((k) => !LIABILITY_TYPES[k]);
    expect(missing).toEqual([]);
  });

  it("carries no label for a type the taxonomy does not define", () => {
    const known = new Set(TAXONOMY_ASSETS.map((a) => a.code));
    expect(Object.keys(ASSET_TYPES).filter((k) => !known.has(k))).toEqual([]);
  });

  it("has both languages filled for every entry", () => {
    for (const [k, v] of Object.entries(ASSET_TYPES)) {
      expect(v.zh, k).toBeTruthy();
      expect(v.en, k).toBeTruthy();
    }
    for (const [k, v] of Object.entries(LIABILITY_TYPES)) {
      expect(v.zh, k).toBeTruthy();
      expect(v.en, k).toBeTruthy();
    }
  });
});

describe("asset grouping agrees with the ratio maths", () => {
  // P8's composition chart and P11's liquidity ratio must not disagree about
  // what counts as liquid — the client reads both on facing pages.
  it("the liquid group is exactly baseline.ts's LIQUID_ASSET_TYPES", () => {
    const liquid = Object.keys(ASSET_TYPES).filter((k) => ASSET_TYPES[k].group === "liquid");
    expect(liquid.sort()).toEqual([...LIQUID_ASSET_TYPES].sort());
  });

  it("every group has a label and a place in the display order", () => {
    for (const g of new Set(Object.values(ASSET_TYPES).map((a) => a.group))) {
      expect(ASSET_GROUP_LABELS[g], g).toBeTruthy();
      expect(ASSET_GROUP_ORDER, g).toContain(g);
    }
  });
});

describe("lookup helpers", () => {
  it("resolves labels in both languages", () => {
    expect(assetTypeLabel("epf_account_1", "zh")).toBe("公积金 退休户口");
    expect(assetTypeLabel("epf_account_1", "en")).toBe("EPF Akaun Persaraan");
    expect(liabilityTypeLabel("mortgage", "zh")).toBe("房屋贷款");
  });

  it("falls back to the raw key rather than rendering an empty cell", () => {
    expect(assetTypeLabel("crypto_moon_bag", "zh")).toBe("crypto_moon_bag");
    expect(liabilityTypeLabel("loan_shark", "en")).toBe("loan_shark");
    expect(assetGroupOf("crypto_moon_bag")).toBe("fixed");
    expect(isHighInterest("loan_shark")).toBe(false);
  });

  it("flags revolving consumer debt for the 高息负债 callout", () => {
    expect(isHighInterest("credit_card")).toBe(true);
    expect(isHighInterest("personal_loan")).toBe(true);
    expect(isHighInterest("mortgage")).toBe(false);
  });
});

describe("cash-flow category labels", () => {
  it("prints the taxonomy label, resolving legacy codes", () => {
    expect(cashflowCategoryLabel("groceries", "zh")).toBe("杂货/菜市");
    expect(cashflowCategoryLabel("household", "zh")).toBe("其他日常");
    expect(cashflowCategoryLabel("mystery", "zh")).toBe("mystery");
  });
});
