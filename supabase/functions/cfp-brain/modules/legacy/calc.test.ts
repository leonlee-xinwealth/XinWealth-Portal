import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeLegacy, type LegacyInputs } from "./calc.ts";
import { computeBaseline } from "../../baseline.ts";
import { makeCfpData } from "../../baseline.test.ts";
import type { CfpData } from "../../types.ts";

const NOW = new Date("2026-07-16T00:00:00Z");

function det(overrides: Partial<CfpData> = {}, inputs: LegacyInputs = {}) {
  const f = makeCfpData(overrides);
  return computeLegacy(f, computeBaseline(f, {}, NOW), inputs);
}

Deno.test("net estate and liquidity include life cover from base plan + riders", () => {
  const d = det({
    policies: [
      {
        policy_type: "life",
        provider: null,
        sum_assured: 300000,
        premium: 2000,
        premium_frequency: "annual",
      },
      {
        policy_type: "medical",
        provider: null,
        sum_assured: null,
        premium: 1200,
        premium_frequency: "annual",
        policy_riders: [{ category: "life", sum_assured: 200000 }],
      },
    ],
  });
  assertEquals(d.life_cover_total, 500000); // 300k base + 200k rider
  assertEquals(d.gross_estate, 650000);
  assertEquals(d.net_estate, 850000); // 350k net worth + 500k life cover
  assertEquals(d.settlement_costs_est, 32500); // 5% of 650,000
  assertEquals(d.estate_obligations, 332500); // 300k liabilities + 32,500
  assertEquals(d.estate_liquidity.available, 550000); // 50k liquid + 500k cover
  assertEquals(d.estate_liquidity.status, "covered");
  assertEquals(d.estate_liquidity.shortfall, 0);
  assert(d.trust_consideration); // dependents > 0 and net estate > 500,000
});

Deno.test("shortfall path: large liabilities with no life cover force a shortfall", () => {
  const d = det({
    liabilities: [{
      liability_type: "mortgage",
      outstanding_balance: 600000,
      interest_rate: 0.04,
      monthly_payment: 3000,
      end_date: null,
    }],
  });
  assertEquals(d.life_cover_total, 0);
  assertEquals(d.net_estate, 50000); // 650k assets - 600k liabilities
  assertEquals(d.estate_obligations, 632500); // 600k + 32,500 settlement
  assertEquals(d.estate_liquidity.available, 50000);
  assertEquals(d.estate_liquidity.status, "shortfall");
  assertEquals(d.estate_liquidity.shortfall, 582500);
  assert(!d.trust_consideration); // net estate not above 500,000 threshold
});

Deno.test("conventional, no will, married with dependents: 1/3 spouse, 2/3 children", () => {
  const d = det({}, { regime: "conventional", will_status: "no_will" });
  assertEquals(d.distribution.faraid_flagged, false);
  assertEquals(d.distribution.intestate_conventional_split, [
    { beneficiary: "spouse", share: "1/3" },
    { beneficiary: "children", share: "2/3" },
  ]);
});

Deno.test("syariah regime flags faraid and never computes shares", () => {
  const d = det({}, { regime: "syariah", will_status: "no_will" });
  assert(d.distribution.faraid_flagged);
  assertEquals(d.distribution.intestate_conventional_split, null);

  const withWill = det({}, { regime: "syariah", will_status: "has_will" });
  assert(withWill.distribution.faraid_flagged);
  assertEquals(withWill.distribution.intestate_conventional_split, null);
});

Deno.test("conventional, no will, single with no dependents: 100% to parents", () => {
  const d = det(
    {
      client: {
        ...makeCfpData().client,
        marital_status: "single",
        number_of_dependants: 0,
      },
    },
    { regime: "conventional", will_status: "no_will" },
  );
  assertEquals(d.distribution.intestate_conventional_split, [
    { beneficiary: "parents", share: "100%" },
  ]);
});

Deno.test("trust_consideration threshold: needs both dependents and net estate above 500,000", () => {
  const atThreshold = det({
    assets: [
      { asset_type: "property", current_value: 800000, cost_value: null, ownership_type: null },
    ],
    liabilities: [{
      liability_type: "mortgage",
      outstanding_balance: 300000,
      interest_rate: 0.04,
      monthly_payment: 1500,
      end_date: null,
    }],
  });
  assertEquals(atThreshold.net_estate, 500000);
  assert(!atThreshold.trust_consideration); // not strictly above threshold

  const aboveThreshold = det({
    assets: [
      { asset_type: "property", current_value: 800001, cost_value: null, ownership_type: null },
    ],
    liabilities: [{
      liability_type: "mortgage",
      outstanding_balance: 300000,
      interest_rate: 0.04,
      monthly_payment: 1500,
      end_date: null,
    }],
  });
  assert(aboveThreshold.trust_consideration);

  const noDependents = det({
    client: { ...makeCfpData().client, number_of_dependants: 0 },
    assets: [
      { asset_type: "property", current_value: 800001, cost_value: null, ownership_type: null },
    ],
    liabilities: [{
      liability_type: "mortgage",
      outstanding_balance: 300000,
      interest_rate: 0.04,
      monthly_payment: 1500,
      end_date: null,
    }],
  });
  assert(!noDependents.trust_consideration); // dependents == 0
});

Deno.test("no assets flags insufficient_data without throwing", () => {
  const d = det({ assets: [], liabilities: [] });
  assert(d.insufficient_data);
  assertEquals(d.gross_estate, 0);
  assertEquals(d.estate_liquidity.status, "covered"); // 0 obligations, 0 available
});

Deno.test("asset_isolation_flag is true for a self-employed client with bankruptcy risk", () => {
  const d = det(
    {
      client: { ...makeCfpData().client, employment_status: "self_employed" },
    },
    { bankruptcy_risk: true },
  );
  assert(d.asset_isolation_flag);

  const businessOwner = det(
    { client: { ...makeCfpData().client, employment_status: "employed" } },
    { business_owner: true, bankruptcy_risk: true },
  );
  assert(businessOwner.asset_isolation_flag);
});

Deno.test("asset_isolation_flag is false when bankruptcy_risk is absent, even for a business owner", () => {
  const d = det(
    {
      client: { ...makeCfpData().client, employment_status: "self_employed" },
    },
    { business_owner: true },
  );
  assert(!d.asset_isolation_flag);

  const employed = det(
    { client: { ...makeCfpData().client, employment_status: "employed" } },
    { bankruptcy_risk: true },
  );
  assert(!employed.asset_isolation_flag);
});
