import { assert } from "jsr:@std/assert@1";
import { buildSectionPrompt } from "./section.ts";
import { computeCna } from "../../../_shared/insurance/cna.ts";
import { buildCfpCnaInput, type CfpFinancials } from "../../../_shared/insurance/mapping.ts";

// Sentinel values: if ANY of these appear in the LLM prompt, PII is leaking.
const SENTINELS = [
  "ZZNAME_SENTINEL",
  "ZZEMAIL_SENTINEL@example.com",
  "+60-ZZPHONE-SENTINEL",
  "1985-03-17", // exact date_of_birth — only derived age may be sent
  "PROV_SENTINEL",
  "PN_SENTINEL",
  "LIABNAME_SENTINEL",
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
      cash_value: 25000,
      premium: 300,
      premium_frequency: "monthly",
      start_date: "2020-01-01",
      end_date: null,
    },
  ],
};

Deno.test("buildSectionPrompt never leaks PII sentinels to the LLM", () => {
  const cna = computeCna(buildCfpCnaInput(financials));
  const prompt = buildSectionPrompt(cna, financials);
  for (const s of SENTINELS) {
    assert(!prompt.includes(s), `PII leaked into LLM prompt: ${s}`);
  }
});

Deno.test("buildSectionPrompt includes derived age, asset composition and CNA figures", () => {
  const cna = computeCna(buildCfpCnaInput(financials));
  const prompt = buildSectionPrompt(cna, financials);
  assert(prompt.includes('"age":'), "derived age missing");
  assert(prompt.includes(String(cna.needs.total_life)), "CNA total_life missing");
  assert(prompt.includes("Insurance Planning"), "section framing missing");
  assert(prompt.includes("the client"), "anonymous reference missing");
  // Asset composition (type + value, no names) must reach the LLM so it can
  // ground scenarios in the real thing at stake.
  assert(prompt.includes("property"), "asset composition missing");
  assert(prompt.includes('"marital_status"'), "marital status missing");
});

Deno.test("buildSectionPrompt instructs real-life scenario framing", () => {
  const cna = computeCna(buildCfpCnaInput(financials));
  const prompt = buildSectionPrompt(cna, financials);
  assert(prompt.includes("scenarios"), "scenarios task missing");
  assert(prompt.includes("family home"), "life-impact framing missing");
});
