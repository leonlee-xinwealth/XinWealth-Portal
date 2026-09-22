// Joint-report behaviour of 保险佬: protection need is per LIFE, so a couple's
// report carries one CNA per spouse — each against their OWN income and OWN
// policies, but the SAME household liabilities, dependants and liquid assets.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { insuranceModule, type InsuranceDet } from "./module.ts";
import { buildSectionPrompt } from "./section.ts";
import { buildSectionContent, type SectionNarrative } from "./assemble.ts";
import { computeBaseline } from "../../baseline.ts";
import { mergeHousehold } from "../../household.ts";
import { makeCfpData } from "../../baseline.test.ts";
import type { CfpData } from "../../types.ts";

const NOW = new Date("2026-07-16T00:00:00Z");

const lifePolicy = (sumAssured: number) => ({
  policy_type: "life",
  provider: "PROV_SENTINEL",
  sum_assured: sumAssured,
  premium: 200,
  premium_frequency: "monthly",
  policy_number: "PN_SENTINEL",
  policy_riders: [],
});

/** Primary earns 10k/month and carries RM500k of life cover; the partner earns
 * 5k/month and carries none. */
function couple(): CfpData {
  const primary = makeCfpData({ policies: [lifePolicy(500000)] });
  const partner = makeCfpData({
    client: { ...makeCfpData().client, id: "c-2", number_of_dependants: 2 },
    cashflow: [
      { direction: "inflow", amount: 5000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
    ],
    assets: [],
    liabilities: [],
    policies: [],
    goals: [],
  });
  return mergeHousehold(primary, partner);
}

function detFor(data: CfpData): InsuranceDet {
  return insuranceModule.compute(data, computeBaseline(data), {}, {});
}

Deno.test("individual report is unchanged — no per_person block", () => {
  const det = detFor(makeCfpData({ policies: [lifePolicy(500000)] }));
  assertEquals(det.per_person, undefined);
  assert(det.cna.needs.total_life > 0);
});

Deno.test("joint report produces one CNA per spouse", () => {
  const det = detFor(couple());
  assertEquals(det.per_person?.length, 2);
  assertEquals(det.per_person?.[0].role, "primary");
  assertEquals(det.per_person?.[1].role, "partner");
});

Deno.test("each spouse's income replacement uses their OWN income", () => {
  const det = detFor(couple());
  const [primary, partner] = det.per_person!;
  // 10k vs 5k a month → the primary's replacement need is double the partner's
  assertEquals(primary.cna.inputs.annual_income, 120000 + 12000); // salary + bonus
  assertEquals(partner.cna.inputs.annual_income, 60000);
  assert(primary.cna.needs.income_replacement > partner.cna.needs.income_replacement);
});

Deno.test("both spouses are measured against the same household liabilities", () => {
  const det = detFor(couple());
  const [primary, partner] = det.per_person!;
  // The mortgage sits on the primary's record, but the survivor still owes it.
  assertEquals(primary.cna.inputs.liabilities_total, 300000);
  assertEquals(partner.cna.inputs.liabilities_total, 300000);
  assertEquals(primary.cna.inputs.dependents, partner.cna.inputs.dependents);
});

Deno.test("cover is attributed to the spouse who actually holds the policy", () => {
  const det = detFor(couple());
  const [primary, partner] = det.per_person!;
  assertEquals(primary.cna.inputs.life_cover, 500000);
  assertEquals(partner.cna.inputs.life_cover, 0);
  // …so the uninsured partner shows the larger shortfall relative to need
  assert(
    (partner.cna.gaps.find((g) => g.key === "life")?.gap ?? 0) > 0,
  );
});

Deno.test("household premium and top-up totals sum both spouses", () => {
  const det = detFor(couple());
  const [primary, partner] = det.per_person!;
  assertEquals(
    det.annual_premium_total,
    primary.annual_premium_total + partner.annual_premium_total,
  );
  assertEquals(
    det.premium_topup_estimate,
    primary.premium_topup_estimate + partner.premium_topup_estimate,
  );
  // only the primary holds a policy: 200/month × 12
  assertEquals(det.annual_premium_total, 2400);
});

Deno.test("det.cna stays the primary's, keeping existing consumers working", () => {
  const det = detFor(couple());
  assertEquals(det.cna, det.per_person![0].cna);
});

Deno.test("joint prompt carries both CNAs and still leaks no PII", () => {
  const data = couple();
  const det = detFor(data);
  const { prompt } = insuranceModule.buildPrompt(det, computeBaseline(data), data);

  assert(prompt.includes("JOINT PLAN FOR A MARRIED COUPLE"));
  assert(prompt.includes("household_review"));
  // per-life numbers are present
  assert(prompt.includes(String(det.per_person![1].cna.needs.total_life)));
  // …but identifying fields never are
  for (const sentinel of ["PROV_SENTINEL", "PN_SENTINEL"]) {
    assert(!prompt.includes(sentinel), `PII leak: ${sentinel}`);
  }
});

Deno.test("assemble pairs each spouse's CNA with its narrative commentary", () => {
  const data = couple();
  const det = detFor(data);
  const narrative: SectionNarrative = {
    executive_summary: {
      findings: "f",
      action_plan: "a",
      expected_completion_date: "d",
      remarks: "r",
    },
    coverage_review: [],
    gap_analysis: "g",
    recommendations: [],
    scenarios: [],
    household_review: [
      { role: "partner", commentary: "spouse has no life cover" },
      { role: "primary", commentary: "client is adequately covered" },
    ],
  };

  const content = insuranceModule.assemble(det, narrative, data);
  assertEquals(content.per_person?.length, 2);
  assertEquals(content.per_person?.[0].role, "primary");
  assertEquals(content.per_person?.[0].commentary, "client is adequately covered");
  assertEquals(content.per_person?.[1].commentary, "spouse has no life cover");
});

Deno.test("assemble omits per_person on an individual report", () => {
  const data = makeCfpData();
  const det = detFor(data);
  const narrative: SectionNarrative = {
    executive_summary: {
      findings: "f",
      action_plan: "a",
      expected_completion_date: "d",
      remarks: "r",
    },
    coverage_review: [],
    gap_analysis: "g",
    recommendations: [],
    scenarios: [],
  };
  assertEquals(insuranceModule.assemble(det, narrative, data).per_person, undefined);
  // and the individual prompt keeps its original wording
  assert(
    !buildSectionPrompt(det.cna, {
      client: {
        id: "c-1",
        date_of_birth: null,
        number_of_dependants: 0,
        occupation: null,
        retirement_age: null,
        marital_status: null,
      },
      inflows: [],
      liabilities: [],
      assets: [],
      policies: [],
    }).includes("JOINT PLAN"),
  );
});

Deno.test("baseline flags household mode and reports the partner's age", () => {
  const b = computeBaseline(couple());
  assertEquals(b.household_mode, true);
  assert(b.partner_age !== null);
  assert(
    b.baseline_notes.some((n) => n.includes("联合规划")),
    "expected a joint-planning note on the baseline",
  );
});

Deno.test("buildSectionContent takes per_person straight through", () => {
  const det = detFor(couple());
  const content = buildSectionContent(
    {
      client: {
        id: "c-1",
        date_of_birth: null,
        number_of_dependants: 2,
        occupation: null,
        retirement_age: null,
        marital_status: "married",
      },
      inflows: [],
      liabilities: [],
      assets: [],
      policies: [],
    },
    det.cna,
    {
      executive_summary: {
        findings: "f",
        action_plan: "a",
        expected_completion_date: "d",
        remarks: "r",
      },
      coverage_review: [],
      gap_analysis: "g",
      recommendations: [],
      scenarios: [],
    },
    det.per_person!.map((p) => ({
      role: p.role,
      cna: p.cna,
      annual_premium_total: p.annual_premium_total,
    })),
  );
  assertEquals(content.per_person?.length, 2);
  // no household_review in the narrative → commentary simply absent
  assertEquals(content.per_person?.[0].commentary, undefined);
});

// ---------------------------------------------------------------------------
// CNA 收入口径 — the life and CI needs are multiples of annual income, so the
// income the CNA uses has to be the SAME one the rest of the report is built
// on. A cashflow row is one month's actual figure; deriving income by summing
// every row × its frequency treats June's and July's positions as two
// concurrent salaries.
// ---------------------------------------------------------------------------

Deno.test("the CNA takes its income from the baseline, not from the raw rows", () => {
  // Two months of a commission-based income: RM 6,000 then RM 4,000. The plan's
  // basis averages them to a RM 60,000 run-rate. Row-by-row annualisation would
  // report RM 120,000 and double every protection need on the page.
  const f = makeCfpData({
    cashflow: [
      { direction: "inflow", amount: 6000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
      { direction: "inflow", amount: 4000, frequency: "monthly", category: "salary", period_month: "2026-07-01" },
    ],
  });
  const b = computeBaseline(f, {}, NOW);
  const det = insuranceModule.compute(f, b, {}, {}) as InsuranceDet;

  assertEquals(b.annual_income, 60_000);
  assertEquals(det.cna.inputs.annual_income, 60_000);
});

Deno.test("narrowing the basis moves the protection need with it", () => {
  // The advisor decides June is the complete month. Every figure on the
  // insurance page has to follow that decision, not just the cashflow page.
  const f = makeCfpData({
    cashflow: [
      { direction: "inflow", amount: 6000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
      { direction: "inflow", amount: 4000, frequency: "monthly", category: "salary", period_month: "2026-07-01" },
    ],
  });
  const juneOnly = computeBaseline(f, {
    cashflow_basis: { year: 2026, from_month: 6, to_month: 6 },
  }, NOW);
  const det = insuranceModule.compute(f, juneOnly, {}, {}) as InsuranceDet;

  assertEquals(juneOnly.annual_income, 72_000);
  assertEquals(det.cna.inputs.annual_income, 72_000);
});

Deno.test("an annual bonus reaches the CNA once, not twelve times", () => {
  const f = makeCfpData({
    cashflow: [
      { direction: "inflow", amount: 5000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
      { direction: "inflow", amount: 18400, frequency: "annual", category: "bonus", period_month: "2026-03-01" },
    ],
  });
  const b = computeBaseline(f, { cashflow_basis: { year: 2026, from_month: 6, to_month: 6 } }, NOW);
  const det = insuranceModule.compute(f, b, {}, {}) as InsuranceDet;
  assertEquals(det.cna.inputs.annual_income, 78_400); // 5,000 x 12 + 18,400
});
