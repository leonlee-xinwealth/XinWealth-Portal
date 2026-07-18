// Budget-alignment tests: every section narrative is drafted against 首席规划师's
// single allocation (protection-first), so the report is interlinked — one
// section can never spend surplus the waterfall assigned to another.

import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeAll } from "./orchestrator.ts";
import { ORDERED_MODULES, findModule } from "./modules/registry.ts";
import { makeCfpData } from "./baseline.test.ts";
import { sectionBudgetContext } from "./budgetContext.ts";
import type { CfpData, SectionType } from "./types.ts";

const NOW = new Date("2026-07-16T00:00:00Z");

/** Tight-surplus fixture: big income gap needs vs small surplus → over budget. */
function tightData(): CfpData {
  return makeCfpData({
    cashflow: [
      { direction: "inflow", amount: 6000, frequency: "monthly", category: "salary" },
      { direction: "outflow", amount: 5500, frequency: "monthly", category: "household" },
    ],
    assets: [
      { asset_type: "savings", current_value: 5000, cost_value: null, ownership_type: null },
    ],
  });
}

Deno.test("computeAll writes the synthesis waterfall back into baseline.budget_summary", () => {
  const { baseline } = computeAll(ORDERED_MODULES, tightData(), {}, NOW);
  const bs = baseline.budget_summary!;
  assert(bs, "budget_summary must be present once synthesis is registered");
  assert(bs.over_budget, "tight fixture must be over budget");
  assertEquals(bs.lines.map((l) => l.key), [
    "protection",
    "emergency",
    "retirement",
    "goals",
    "wealth",
  ]);
  // Waterfall discipline: allocations never exceed the surplus.
  const allocated = bs.lines.reduce((s, l) => s + l.allocated_annual, 0);
  assert(allocated <= bs.annual_surplus + 1);
});

Deno.test("every budget-aligned section prompt carries its allocation and the deferral rule", () => {
  const f = tightData();
  const { baseline, det } = computeAll(ORDERED_MODULES, f, {}, NOW);
  const cases: Array<[SectionType, string]> = [
    ["insurance_planning", "protection"],
    ["cashflow_planning", "emergency"],
    ["retirement_planning", "retirement"],
    ["goals_planning", "goals"],
    ["investment_planning", "wealth"],
  ];
  for (const [sectionType, lineKey] of cases) {
    const module = findModule(sectionType)!;
    const { prompt } = module.buildPrompt(det[sectionType], baseline, f);
    assert(
      prompt.includes("BUDGET ALIGNMENT"),
      `${sectionType} prompt missing budget instructions`,
    );
    assert(
      prompt.includes("deferred under the plan's priority order"),
      `${sectionType} prompt missing deferral rule`,
    );
    const line = baseline.budget_summary!.lines.find((l) => l.key === lineKey)!;
    assert(
      prompt.includes(`"allocated_annual":${line.allocated_annual}`),
      `${sectionType} prompt missing its allocated amount`,
    );
  }
});

Deno.test("insurance prompt states protection-first priority", () => {
  const f = tightData();
  const { baseline, det } = computeAll(ORDERED_MODULES, f, {}, NOW);
  const module = findModule("insurance_planning")!;
  const { prompt } = module.buildPrompt(det.insurance_planning, baseline, f);
  assert(prompt.includes("Protection sits FIRST"));
});

Deno.test("sectionBudgetContext is null-safe without synthesis", () => {
  const { baseline } = computeAll([], makeCfpData(), {}, NOW);
  assertEquals(sectionBudgetContext(baseline, "protection"), null);
});
