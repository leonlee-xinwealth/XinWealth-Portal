import { assertEquals } from "jsr:@std/assert@1";
import {
  annualizeInflows,
  annualPremiumTotal,
  buildCfpCnaInput,
  buildProspectCnaInput,
  parseAmount,
  parseDependents,
} from "./mapping.ts";

Deno.test("parseAmount handles RM strings, numbers and unknown", () => {
  assertEquals(parseAmount("RM500,000"), 500000);
  assertEquals(parseAmount("500000.50"), 500000.5);
  assertEquals(parseAmount("unknown"), 0);
  assertEquals(parseAmount(120000), 120000);
  assertEquals(parseAmount(null), 0);
});

Deno.test("parseDependents extracts counts from text", () => {
  assertEquals(parseDependents("2 个孩子"), 2);
  assertEquals(parseDependents("3"), 3);
  assertEquals(parseDependents("无"), 0);
  assertEquals(parseDependents(2), 2);
});

Deno.test("buildProspectCnaInput includes manual_coverage self-reported amounts", () => {
  const input = buildProspectCnaInput(
    {
      monthly_income_band: "RM8,000-12,000",
      dependents: "1",
      manual_coverage: { life: 200000, ci: 50000, medical: 100000 },
    },
    [],
  );
  assertEquals(input.annual_income, 120000); // 10000 × 12
  assertEquals(input.life_cover, 200000);
  assertEquals(input.ci_cover, 50000);
  assertEquals(input.has_medical, true);
});

Deno.test("buildProspectCnaInput aggregates extracted covers by type", () => {
  const input = buildProspectCnaInput(
    { monthly_income_band: "RM5,000-8,000", dependents: "2 个孩子" },
    [
      { policy_type: "term life", sum_assured: "RM300,000" },
      { policy_type: "investment-linked", sum_assured: "200000" },
      { policy_type: "critical illness", sum_assured: "RM100,000" },
      { policy_type: "medical card", sum_assured: "unknown" },
    ],
  );
  assertEquals(input.annual_income, 78000); // 6500 × 12
  assertEquals(input.income_estimated, true);
  assertEquals(input.life_cover, 500000);
  assertEquals(input.ci_cover, 100000);
  assertEquals(input.has_medical, true);
  assertEquals(input.dependents, 2);
  assertEquals(input.liabilities_total, null);
  assertEquals(input.liquid_assets, null);
});

const cfpFixture = {
  client: {
    id: "c1",
    full_name: "Test Client",
    email: null,
    phone: null,
    date_of_birth: "1990-01-01",
    number_of_dependants: 1,
    occupation: null,
    retirement_age: 60,
  },
  inflows: [
    { amount: 8000, frequency: "monthly", category: "salary" },
    { amount: 12000, frequency: "annual", category: "bonus" },
  ],
  liabilities: [
    {
      liability_type: "mortgage",
      name: "House",
      outstanding_balance: 300000,
      monthly_payment: 1500,
    },
  ],
  assets: [
    { asset_type: "savings", current_value: 50000 },
    { asset_type: "property", current_value: 600000 },
  ],
  policies: [
    {
      policy_type: "life",
      provider: "A",
      sum_assured: 400000,
      premium: 200,
      premium_frequency: "monthly",
    },
    {
      policy_type: "critical_illness",
      provider: "B",
      sum_assured: 150000,
      premium: 1200,
      premium_frequency: "annual",
    },
  ],
};

Deno.test("buildCfpCnaInput derives all figures from DB rows", () => {
  const input = buildCfpCnaInput(cfpFixture);
  assertEquals(input.annual_income, 108000); // 8000×12 + 12000
  assertEquals(input.liabilities_total, 300000);
  assertEquals(input.liquid_assets, 50000); // property excluded
  assertEquals(input.life_cover, 400000);
  assertEquals(input.ci_cover, 150000);
  assertEquals(input.has_medical, false);
  assertEquals(input.dependents, 1);
});

Deno.test("annualizeInflows and annualPremiumTotal use frequency multipliers", () => {
  assertEquals(annualizeInflows(cfpFixture.inflows), 108000);
  assertEquals(annualPremiumTotal(cfpFixture.policies), 3600); // 200×12 + 1200
});
