import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  ASSET_TYPES,
  EPF_ASSET_TYPES,
  LIABILITY_TYPES,
  LIQUID_ASSET_TYPES,
  allocationBucketOf,
  assetClassOf,
  assetTypeLabel,
  assetTypeMeta,
  isLiquid,
  isRetirementCapital,
  liabilityTypeLabel,
  liquidityLevel,
} from "./balance.ts";
import { CATEGORY_BY_CODE } from "./cashflow.ts";

// The live Postgres enums on 2026-09-23. Every one must still resolve.
const LIVE_ASSET_ENUM = [
  "savings", "fixed_deposit", "money_market", "epf_account_1", "epf_account_2",
  "epf_account_3", "unit_trust", "stock", "bond", "etf", "property", "vehicle",
  "business", "other",
];
const LIVE_LIABILITY_ENUM = [
  "mortgage", "car_loan", "personal_loan", "study_loan", "renovation_loan",
  "credit_card", "business_loan", "other",
];

Deno.test("every live enum value is still a known type", () => {
  for (const t of LIVE_ASSET_ENUM) assert(assetTypeMeta(t), t);
  for (const t of LIVE_LIABILITY_ENUM) assert(LIABILITY_TYPES.some((l) => l.code === t), t);
});

Deno.test("codes are unique", () => {
  const a = ASSET_TYPES.map((x) => x.code);
  assertEquals(new Set(a).size, a.length);
  const l = LIABILITY_TYPES.map((x) => x.code);
  assertEquals(new Set(l).size, l.length);
});

Deno.test("class A is exactly the liquid set", () => {
  assertEquals(
    [...LIQUID_ASSET_TYPES].sort(),
    ["cash_on_hand", "ewallet", "fixed_deposit", "foreign_currency", "money_market", "savings"],
  );
  for (const t of LIQUID_ASSET_TYPES) {
    assert(isLiquid(t), t);
    assertEquals(liquidityLevel(t), "high");
  }
  assert(!isLiquid("stock"));
  assertEquals(liquidityLevel("stock"), "medium");
  assertEquals(liquidityLevel("own_residence"), "low");
  assertEquals(liquidityLevel("mystery"), "low");
});

Deno.test("classes and purposes", () => {
  assertEquals(assetClassOf("epf_account_1"), "B");
  assertEquals(assetClassOf("investment_property"), "C");
  assertEquals(assetClassOf("own_residence"), "D");
  assertEquals(assetClassOf("property"), "D");
  assertEquals(assetClassOf("mystery"), "D");
  assertEquals(assetTypeMeta("vehicle")?.default_purpose, "personal_use");
  assertEquals(assetTypeMeta("investment_property")?.default_purpose, "income_producing");
  assertEquals(assetTypeMeta("property")?.offered, false);
});

Deno.test("retirement capital: B plus drawable C, never property or the home", () => {
  for (const t of EPF_ASSET_TYPES) assert(isRetirementCapital(t), t);
  for (const t of ["prs", "stock", "etf", "unit_trust", "bond", "reit", "asnb", "gold"]) {
    assert(isRetirementCapital(t), t);
  }
  for (const t of ["investment_property", "land", "business", "sspn", "other", "own_residence", "vehicle", "savings"]) {
    assert(!isRetirementCapital(t), t);
  }
});

Deno.test("allocation buckets keep today's equity/bond/alternatives split", () => {
  assertEquals(allocationBucketOf("stock"), "equity");
  assertEquals(allocationBucketOf("unit_trust"), "equity");
  assertEquals(allocationBucketOf("bond"), "bond");
  assertEquals(allocationBucketOf("business"), "alternatives");
  assertEquals(allocationBucketOf("gold"), "alternatives");
  assertEquals(allocationBucketOf("own_residence"), null);
  assertEquals(allocationBucketOf("other"), null);
});

Deno.test("every liability installment category exists in the cash-flow taxonomy", () => {
  for (const l of LIABILITY_TYPES) {
    if (l.installment_category) assert(CATEGORY_BY_CODE[l.installment_category], `${l.code} → ${l.installment_category}`);
  }
});

Deno.test("labels", () => {
  assertEquals(assetTypeLabel("epf_account_1", "zh"), "公积金 退休户口");
  assertEquals(assetTypeLabel("epf_account_1", "en"), "EPF Akaun Persaraan");
  assertEquals(assetTypeLabel("mystery", "en"), "mystery");
  assertEquals(liabilityTypeLabel("mortgage", "zh"), "房屋贷款");
  assertEquals(liabilityTypeLabel("mystery", "zh"), "mystery");
});
