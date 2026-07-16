import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildSectionContent, type SectionNarrative } from "./assemble.ts";
import { computeCna } from "../../../_shared/insurance/cna.ts";
import { buildCfpCnaInput, type CfpFinancials } from "../../../_shared/insurance/mapping.ts";

const financials: CfpFinancials = {
  client: {
    id: "c1",
    full_name: "Test Client",
    email: null,
    phone: null,
    date_of_birth: "1985-06-01",
    number_of_dependants: 2,
    occupation: "Engineer",
    retirement_age: 60,
    marital_status: "married",
  },
  inflows: [{ amount: 10000, frequency: "monthly", category: "salary" }],
  liabilities: [
    {
      liability_type: "mortgage",
      name: "House loan",
      outstanding_balance: 400000,
      monthly_payment: 2000,
    },
  ],
  assets: [{ asset_type: "savings", current_value: 60000 }],
  policies: [
    {
      policy_type: "life",
      provider: "Great Insurer",
      policy_number: "GI-123456",
      sum_assured: 500000,
      cash_value: 25000,
      premium: 300,
      premium_frequency: "monthly",
      start_date: "2020-01-01",
      end_date: null,
    },
    {
      policy_type: "medical",
      provider: "MedCo",
      policy_number: null,
      sum_assured: null,
      cash_value: null,
      premium: 2400,
      premium_frequency: "annual",
      start_date: null,
      end_date: null,
    },
  ],
};

const narrative: SectionNarrative = {
  executive_summary: {
    findings: "Coverage gap identified.",
    action_plan: "Increase term life cover.",
    expected_completion_date: "Within 3 months",
    remarks: "Pending client budget confirmation.",
  },
  coverage_review: [
    { category: "life", level: "insufficient", commentary: "Gap exists." },
  ],
  gap_analysis: "The client has a material protection gap.",
  recommendations: [
    { title: "Add term life", detail: "Cover the gap.", priority: 1 },
  ],
  scenarios: [
    {
      title: "Premature Death",
      trigger: "The client passes away unexpectedly.",
      life_impact: "The mortgaged family home faces a forced sale.",
      protection_response: "An extra RM2,653,000 of life cover clears the loan.",
    },
  ],
};

Deno.test("buildSectionContent fills policy_overview from DB rows (code, not LLM)", () => {
  const cna = computeCna(buildCfpCnaInput(financials));
  const content = buildSectionContent(financials, cna, narrative);

  assertEquals(content.version, 1);
  assertEquals(content.section_type, "insurance_planning");
  assertEquals(content.agent, "insurance_brain");
  assertEquals(content.policy_overview.length, 2);

  const life = content.policy_overview[0];
  assertEquals(life.provider, "Great Insurer");
  assertEquals(life.policy_number, "GI-123456");
  assertEquals(life.sum_assured, 500000);
  assertEquals(life.cash_value, 25000);
  assertEquals(life.annual_premium, 3600); // 300 × 12

  const medical = content.policy_overview[1];
  assertEquals(medical.policy_number, null);
  assertEquals(medical.annual_premium, 2400);

  assertEquals(content.annual_premium_total, 6000);
});

Deno.test("buildSectionContent embeds CNA verbatim and narrative fields", () => {
  const cna = computeCna(buildCfpCnaInput(financials));
  const content = buildSectionContent(financials, cna, narrative);

  assertEquals(content.cna, cna);
  assertEquals(content.executive_summary.findings, "Coverage gap identified.");
  assertEquals(content.coverage_review.length, 1);
  assertEquals(content.recommendations[0].priority, 1);
  assert(content.gap_analysis.length > 0);
  assertEquals(content.scenarios.length, 1);
  assertEquals(content.scenarios[0].title, "Premature Death");
  assert(content.scenarios[0].life_impact.includes("family home"));
});
