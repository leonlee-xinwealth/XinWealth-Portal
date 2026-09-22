import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  CASHFLOW_CATEGORIES,
  CASHFLOW_GROUPS,
  CATEGORY_BY_CODE,
  LEGACY_CATEGORY_MAP,
  TRANSFER_CATEGORY_CODES,
  categoryLabel,
  groupOf,
  resolveCategory,
  wealthEffectOf,
} from "./cashflow.ts";

Deno.test("codes are unique snake_case", () => {
  const codes = CASHFLOW_CATEGORIES.map((c) => c.code);
  assertEquals(new Set(codes).size, codes.length);
  for (const c of codes) assert(/^[a-z][a-z0-9_]*$/.test(c), c);
});

Deno.test("every group is populated and all but I4 have a catch-all", () => {
  const catchAll = (code: string) =>
    code.endsWith("_other") || code === "other_income" || code === "other_expense";
  for (const g of CASHFLOW_GROUPS) {
    const inGroup = CASHFLOW_CATEGORIES.filter((c) => c.group === g.id);
    assert(inGroup.length > 0, g.id);
    for (const c of inGroup) assertEquals(c.direction, g.direction, c.code);
    // I4 has no catch-all on purpose: a non-income inflow must be named.
    if (g.id !== "I4") assert(inGroup.some((c) => catchAll(c.code)), `${g.id} lacks a catch-all`);
  }
});

Deno.test("outflows carry fixed/variable; living costs (O4–O8) carry need/want", () => {
  for (const c of CASHFLOW_CATEGORIES) {
    if (c.direction === "outflow") assert(c.fixed_variable !== null, c.code);
    else assertEquals(c.fixed_variable, null, c.code);
    if (/^O[4-8]$/.test(c.group)) assert(c.need_want !== null, c.code);
    else assertEquals(c.need_want, null, c.code);
  }
});

Deno.test("wealth effects follow spec §1", () => {
  const fx = (code: string) => CATEGORY_BY_CODE[code].wealth_effect;
  assertEquals(fx("salary_basic"), "income");
  assertEquals(fx("rental_income"), "income");
  assertEquals(fx("policy_surrender_maturity"), "income");
  assertEquals(fx("asset_sale"), "transfer");
  assertEquals(fx("loan_drawdown"), "transfer");
  assertEquals(fx("unit_trust_contribution"), "transfer");
  assertEquals(fx("credit_card_payment"), "transfer");
  assertEquals(fx("mortgage_installment"), "split");
  assertEquals(fx("finance_charges"), "expense");
  assertEquals(fx("share_margin_interest"), "expense");
  assertEquals(fx("savings_plan_premium"), "expense");
  assertEquals(fx("groceries"), "expense");
});

Deno.test("legacy codes resolve to current categories", () => {
  for (const [legacy, current] of Object.entries(LEGACY_CATEGORY_MAP)) {
    assert(CATEGORY_BY_CODE[current], `${legacy} → ${current} is not a category`);
    assert(!CATEGORY_BY_CODE[legacy], `${legacy} is still a live code`);
    assertEquals(resolveCategory(legacy)?.code, current);
  }
  assertEquals(resolveCategory("nonsense"), null);
  assertEquals(resolveCategory(null), null);
  assertEquals(resolveCategory(undefined), null);
});

Deno.test("wealthEffectOf falls back by direction for unknown codes", () => {
  assertEquals(wealthEffectOf("nonsense", "inflow"), "income");
  assertEquals(wealthEffectOf("nonsense", "outflow"), "expense");
  assertEquals(wealthEffectOf("investment_contribution", "outflow"), "transfer");
});

Deno.test("labels and groups", () => {
  assertEquals(categoryLabel("groceries", "zh"), "杂货/菜市");
  assertEquals(categoryLabel("household", "en"), "Other daily living");
  assertEquals(categoryLabel("mystery", "zh"), "mystery");
  assertEquals(categoryLabel(null, "zh"), "");
  assertEquals(groupOf("rental_income")?.id, "I2");
  assertEquals(groupOf("dividend")?.id, "I2");
  assertEquals(groupOf("mystery"), null);
});

Deno.test("transfer list = transfer categories + legacy aliases, sorted", () => {
  assert(TRANSFER_CATEGORY_CODES.includes("investment_contribution"));
  assert(TRANSFER_CATEGORY_CODES.includes("credit_card_payment"));
  assert(TRANSFER_CATEGORY_CODES.includes("asset_sale"));
  assert(!TRANSFER_CATEGORY_CODES.includes("mortgage_installment"));
  assert(!TRANSFER_CATEGORY_CODES.includes("rental_income"));
  assertEquals([...TRANSFER_CATEGORY_CODES], [...TRANSFER_CATEGORY_CODES].sort());
});
