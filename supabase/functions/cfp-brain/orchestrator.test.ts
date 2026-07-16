import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeAll } from "./orchestrator.ts";
import type { CfpModule, FinancialBaseline } from "./types.ts";
import { makeCfpData } from "./baseline.test.ts";

const goalsStub: CfpModule<{ education_total: number }> = {
  section_type: "goals_planning",
  agent: "goal_planner",
  compute: () => ({ education_total: 123000 }),
  updateBaseline: (b: FinancialBaseline, det) => ({
    ...b,
    goal_education_need: det.education_total,
  }),
  buildPrompt: () => ({ prompt: "", schema: {} }),
  assemble: (det) => det,
};

const insuranceStub: CfpModule<{ seen_education: number | undefined }> = {
  section_type: "insurance_planning",
  agent: "insurance_brain",
  compute: (_f, b) => ({ seen_education: b.goal_education_need }),
  buildPrompt: () => ({ prompt: "", schema: {} }),
  assemble: (det) => det,
};

Deno.test("computeAll runs modules in SECTION_ORDER and threads baseline enrichment", () => {
  // Registration order deliberately reversed — SECTION_ORDER must win.
  const { baseline, det } = computeAll([insuranceStub, goalsStub], makeCfpData());
  assertEquals(baseline.goal_education_need, 123000);
  assertEquals(
    (det.insurance_planning as { seen_education: number }).seen_education,
    123000,
  );
});

Deno.test("computeAll tolerates missing modules (phased rollout)", () => {
  const { baseline, det } = computeAll([goalsStub], makeCfpData());
  assertEquals(baseline.goal_education_need, 123000);
  assert(!("insurance_planning" in det));
});
