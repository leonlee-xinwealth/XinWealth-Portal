import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { buildChatPrompt, buildRevisePrompt, redactSensitive } from "./chat.ts";
import { computeBaseline } from "./baseline.ts";
import { computeAll } from "./orchestrator.ts";
import { ORDERED_MODULES } from "./modules/registry.ts";
import { insuranceModule } from "./modules/insurance/module.ts";
import { makeCfpData } from "./baseline.test.ts";
import type { InsuranceSectionContent } from "./modules/insurance/assemble.ts";

const NOW = new Date("2026-07-16T00:00:00Z");

Deno.test("redactSensitive strips NRIC and account-like digit runs", () => {
  assertEquals(
    redactSensitive("客户 IC 900101-14-5678，账户 1234567890，电话 0123456"),
    "客户 IC [REDACTED]，账户 [REDACTED]，电话 0123456",
  );
  assertEquals(redactSensitive("990505145678 raw nric"), "[REDACTED] raw nric");
  // Legit small figures survive
  assertEquals(redactSensitive("加保 RM500,000"), "加保 RM500,000");
});

Deno.test("insurance chatContext whitelist keeps policy identifiers out of chat prompts", () => {
  const f = makeCfpData({
    policies: [{
      policy_type: "life",
      provider: "SENTINEL_PROVIDER",
      sum_assured: 250000,
      premium: 200,
      premium_frequency: "monthly",
      policy_number: "SENTINEL_POLICY_NO",
      policy_riders: [],
    }],
  });
  const { baseline, det } = computeAll(ORDERED_MODULES, f, {}, NOW);
  // Build a full content the way generate would, then a chat prompt off it.
  const content = insuranceModule.assemble(
    // deno-lint-ignore no-explicit-any
    det.insurance_planning as any,
    {
      executive_summary: {
        findings: "f",
        action_plan: "a",
        expected_completion_date: "3 months",
        remarks: "r",
      },
      coverage_review: [],
      gap_analysis: "gap prose",
      recommendations: [],
      scenarios: [],
    },
    f,
  ) as InsuranceSectionContent;
  assert(JSON.stringify(content).includes("SENTINEL_POLICY_NO")); // content has it (UI needs it)

  const prompt = buildChatPrompt(
    "insurance_planning",
    "insurance_brain",
    det.insurance_planning,
    baseline,
    insuranceModule.chatContext!(content),
    [],
    "为什么人寿缺口这么大？",
  );
  assertEquals(prompt.includes("SENTINEL_POLICY_NO"), false);
  assertEquals(prompt.includes("SENTINEL_PROVIDER"), false);
  assert(prompt.includes("gap prose")); // narrative whitelist did pass through
  assert(prompt.includes("IRON RULE"));
});

Deno.test("revise prompt carries the base tasks, current draft and instruction", () => {
  const p = buildRevisePrompt(
    "BASE_PROMPT_TASKS",
    { gap_analysis: "old prose" },
    "语气更温和一点，并强调教育金",
  );
  assert(p.startsWith("BASE_PROMPT_TASKS"));
  assert(p.includes("REVISION MODE"));
  assert(p.includes("old prose"));
  assert(p.includes("教育金"));
});
