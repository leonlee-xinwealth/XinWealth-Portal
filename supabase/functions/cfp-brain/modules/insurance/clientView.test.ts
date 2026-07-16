import { assert } from "jsr:@std/assert@1";
import { buildClientViewPrompt } from "./clientView.ts";
import { computeCna } from "../../../_shared/insurance/cna.ts";
import { buildCfpCnaInput, type CfpFinancials } from "../../../_shared/insurance/mapping.ts";
import type { SectionNarrative } from "./assemble.ts";

// The simplify pass copies the whitelisted narrative PROSE verbatim, so a
// sentinel placed inside a whitelisted field (findings, gap_analysis, …) is
// expected to appear. To prove the whitelist actually drops fields, sentinels
// live ONLY in places the whitelist excludes: expected_completion_date, and
// identifiers that appear nowhere in a SectionNarrative.
const SENTINELS = [
  "ZZNAME_SENTINEL",
  "ZZEMAIL_SENTINEL@example.com",
  "+60-ZZPHONE-SENTINEL",
  "1985-03-17", // a raw date must never be injected
  "PROV_SENTINEL",
  "PN_SENTINEL",
  "ZZDATE_SENTINEL", // seeded into expected_completion_date (excluded field)
];

const financials: CfpFinancials = {
  client: {
    id: "c-pii",
    full_name: "ZZNAME_SENTINEL",
    email: "ZZEMAIL_SENTINEL@example.com",
    phone: "+60-ZZPHONE-SENTINEL",
    date_of_birth: "1985-03-17",
    number_of_dependants: 2,
    occupation: "Engineer",
    retirement_age: 60,
    marital_status: "married",
  },
  inflows: [{ amount: 10000, frequency: "monthly", category: "salary" }],
  liabilities: [
    {
      liability_type: "mortgage",
      name: "LIABNAME_SENTINEL",
      outstanding_balance: 400000,
      monthly_payment: 2000,
    },
  ],
  assets: [{ asset_type: "property", current_value: 630000 }],
  policies: [
    {
      policy_type: "life",
      provider: "PROV_SENTINEL",
      policy_number: "PN_SENTINEL",
      sum_assured: 500000,
      premium: 300,
      premium_frequency: "monthly",
    },
  ],
};

const narrative: SectionNarrative = {
  executive_summary: {
    findings: "The client has a life gap.",
    action_plan: "Review protection.",
    // Excluded from the whitelist — a sentinel here MUST NOT reach the prompt.
    expected_completion_date: "ZZDATE_SENTINEL",
    remarks: "Draft for advisor review.",
  },
  coverage_review: [
    { category: "life", level: "insufficient", commentary: "Below the need." },
    { category: "medical", level: "adequate", commentary: "Has a medical plan." },
  ],
  gap_analysis: "There is a shortfall against the family's needs.",
  recommendations: [
    { title: "Top up life cover", detail: "Close the life gap.", priority: 1 },
  ],
  scenarios: [
    {
      title: "Premature Death",
      trigger: "The breadwinner passes away.",
      life_impact: "The family home is at risk.",
      protection_response: "Adequate cover clears the loan.",
    },
    {
      title: "Critical Illness",
      trigger: "A serious diagnosis.",
      life_impact: "Income stops during treatment.",
      protection_response: "A lump sum replaces income.",
    },
  ],
};

Deno.test("buildClientViewPrompt never leaks PII / excluded fields to the LLM", () => {
  const cna = computeCna(buildCfpCnaInput(financials));
  for (const lang of ["en", "zh"] as const) {
    const prompt = buildClientViewPrompt(narrative, cna, lang);
    for (const s of SENTINELS) {
      assert(!prompt.includes(s), `PII/excluded field leaked (${lang}): ${s}`);
    }
  }
});

Deno.test("buildClientViewPrompt enforces the IRON RULE and quotes a real CNA figure", () => {
  const cna = computeCna(buildCfpCnaInput(financials));
  const prompt = buildClientViewPrompt(narrative, cna, "en");
  assert(prompt.includes("IRON RULE"), "IRON RULE missing");
  assert(prompt.includes("NEVER compute"), "verbatim-number rule missing");
  const lifeGap = cna.gaps.find((g) => g.key === "life")!.gap;
  assert(prompt.includes(String(lifeGap)), "life gap figure missing");
});

Deno.test("buildClientViewPrompt instructs the target output language", () => {
  const cna = computeCna(buildCfpCnaInput(financials));
  assert(
    buildClientViewPrompt(narrative, cna, "zh").includes("Simplified Chinese"),
    "zh language instruction missing",
  );
  assert(
    buildClientViewPrompt(narrative, cna, "en").includes("plain English"),
    "en language instruction missing",
  );
});

Deno.test("buildClientViewPrompt pins per-section counts and ordering", () => {
  const cna = computeCna(buildCfpCnaInput(financials));
  const prompt = buildClientViewPrompt(narrative, cna, "en");
  assert(prompt.includes(`EXACTLY ${narrative.scenarios.length}`), "scenario count missing");
  assert(prompt.includes(`EXACTLY ${narrative.coverage_review.length}`), "coverage count missing");
  assert(prompt.includes("SAME ORDER"), "ordering instruction missing");
  assert(prompt.includes("glossary"), "glossary task missing");
});
