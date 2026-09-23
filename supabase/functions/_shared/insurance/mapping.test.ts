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
    marital_status: "single",
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

Deno.test("buildCfpCnaInput aggregates coverage from policy riders", () => {
  const input = buildCfpCnaInput({
    ...cfpFixture,
    policies: [
      {
        // Base ILP plan whose own benefit is death/TPD but sum_assured unset;
        // CI + medical are recorded as riders (the real-world case).
        policy_type: "investment_linked",
        provider: "GE",
        sum_assured: null,
        premium: 750,
        premium_frequency: "monthly",
        policy_riders: [
          { category: "critical_illness", sum_assured: 500000 },
          { category: "medical", sum_assured: null, room_board_daily: 200 },
        ],
      },
    ],
  });
  assertEquals(input.life_cover, 0);
  assertEquals(input.ci_cover, 500000);
  assertEquals(input.has_medical, true);
});

Deno.test("annualizeInflows and annualPremiumTotal use frequency multipliers", () => {
  assertEquals(annualizeInflows(cfpFixture.inflows), 108000);
  assertEquals(annualPremiumTotal(cfpFixture.policies), 3600); // 200×12 + 1200
});

Deno.test("buildCfpCnaInput baseline overrides: after-emergency liquid assets + real education need", () => {
  const input = buildCfpCnaInput(cfpFixture, {
    liquid_assets: 14000,
    education_need: 148024,
  });
  assertEquals(input.liquid_assets, 14000);
  assertEquals(input.education_need_override, 148024);
  // No overrides → original behaviour (raw liquid sum, no override field).
  const plain = buildCfpCnaInput(cfpFixture);
  assertEquals("education_need_override" in plain, false);
});

// ---------------------------------------------------------------------------
// P5 决策 1/2: buildCoverageDetail via buildCfpCnaInput — status filtering,
// group-employer exclusion, MRTA/MLTA offset, TPD/PA/medical-limit detail.
// cna.test.ts covers the arithmetic that consumes this; these tests pin what
// mapping.ts aggregates from raw policy/liability rows.
// ---------------------------------------------------------------------------

Deno.test("buildCfpCnaInput: an unset policy status counts exactly like in_force (every pre-P5 row)", () => {
  const input = buildCfpCnaInput(cfpFixture);
  assertEquals(input.coverage?.death_cover, 400000);
  assertEquals(input.coverage?.ci_cover, 150000);
});

Deno.test("buildCfpCnaInput: lapsed/surrendered/matured policies drop out of cover; paid_up still counts", () => {
  const input = buildCfpCnaInput({
    ...cfpFixture,
    policies: [
      { ...cfpFixture.policies[0], status: "lapsed" },
      { ...cfpFixture.policies[1], status: "paid_up" },
    ],
  });
  assertEquals(input.life_cover, 0); // the lapsed life policy no longer counts
  assertEquals(input.ci_cover, 150000); // paid_up CI policy still covers
  assertEquals(input.coverage?.death_cover, 0);
  assertEquals(input.coverage?.ci_cover, 150000);
});

Deno.test("buildCfpCnaInput: is_group_employer cover is included in `coverage` but dropped from `coverage_excluding_group`", () => {
  const input = buildCfpCnaInput({
    ...cfpFixture,
    policies: [
      { ...cfpFixture.policies[0], is_group_employer: true },
      cfpFixture.policies[1],
    ],
  });
  assertEquals(input.coverage?.death_cover, 400000);
  assertEquals(input.coverage?.death_has_group, true);
  assertEquals(input.coverage_excluding_group?.death_cover, 0);
  assertEquals(input.coverage_excluding_group?.death_has_group, false);
  // The non-group CI policy is unaffected either way.
  assertEquals(input.coverage_excluding_group?.ci_cover, 150000);
});

Deno.test("buildCfpCnaInput: an in-force MRTA/MLTA policy's covers_liability_id offsets that liability's balance", () => {
  const input = buildCfpCnaInput({
    ...cfpFixture,
    liabilities: [{ ...cfpFixture.liabilities[0], id: "liab-1" }],
    policies: [
      { ...cfpFixture.policies[0], covers_liability_id: "liab-1" },
      cfpFixture.policies[1],
    ],
  });
  assertEquals(input.coverage?.liabilities_covered_by_policy, 300000);
});

Deno.test("buildCfpCnaInput: a lapsed MRTA policy does not offset the liability (status filter applies first)", () => {
  const input = buildCfpCnaInput({
    ...cfpFixture,
    liabilities: [{ ...cfpFixture.liabilities[0], id: "liab-1" }],
    policies: [
      { ...cfpFixture.policies[0], covers_liability_id: "liab-1", status: "lapsed" },
      cfpFixture.policies[1],
    ],
  });
  assertEquals(input.coverage?.liabilities_covered_by_policy, 0);
});

Deno.test("buildCfpCnaInput: disability riders add to TPD cover on top of the base death/TPD sum", () => {
  const input = buildCfpCnaInput({
    ...cfpFixture,
    policies: [
      {
        ...cfpFixture.policies[0],
        policy_riders: [{ category: "disability", sum_assured: 100000 }],
      },
      cfpFixture.policies[1],
    ],
  });
  assertEquals(input.coverage?.death_cover, 400000);
  assertEquals(input.coverage?.tpd_cover, 500000);
  assertEquals(input.coverage?.tpd_assumed_from_life, true);
});

Deno.test("buildCfpCnaInput: medical rider annual_limit and accident rider (PA) are aggregated", () => {
  const input = buildCfpCnaInput({
    ...cfpFixture,
    policies: [
      {
        ...cfpFixture.policies[0],
        policy_riders: [
          { category: "medical", sum_assured: null, annual_limit: 500000 },
          { category: "accident", sum_assured: 250000 },
        ],
      },
      cfpFixture.policies[1],
    ],
  });
  assertEquals(input.coverage?.has_medical, true);
  assertEquals(input.coverage?.medical_annual_limit, 500000);
  assertEquals(input.coverage?.pa_cover, 250000);
});

Deno.test("buildCfpCnaInput: no coverage detail at all still returns a fully-populated (zeroed) coverage set", () => {
  const input = buildCfpCnaInput({ ...cfpFixture, policies: [] });
  assertEquals(input.coverage?.death_cover, 0);
  assertEquals(input.coverage?.ci_early_cover, 0);
  assertEquals(input.coverage?.pa_cover, 0);
  assertEquals(input.coverage?.liabilities_covered_by_policy, 0);
  assertEquals(input.coverage, input.coverage_excluding_group);
});
