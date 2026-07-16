// Deterministic orchestration: run every module's calculator in SECTION_ORDER,
// letting earlier modules enrich the baseline for later ones (goals → education
// need, insurance → current premium). Cheap (pure functions, no LLM), so each
// edge-function invocation recomputes everything fresh — no cross-invocation
// state, no staleness. The LLM narrative runs only for the requested section.

import type {
  CfpData,
  CfpModule,
  FinancialBaseline,
  ModuleOutputs,
  PlanningInputs,
  SectionType,
} from "./types.ts";
import { SECTION_ORDER } from "./types.ts";
import { computeBaseline } from "./baseline.ts";

export interface ComputedReport {
  baseline: FinancialBaseline;
  det: ModuleOutputs;
}

export function computeAll(
  modules: CfpModule[],
  f: CfpData,
  inputs: PlanningInputs = {},
  now = new Date(),
): ComputedReport {
  const byType = new Map(modules.map((m) => [m.section_type, m]));
  let baseline = computeBaseline(f, inputs, now);
  const det: ModuleOutputs = {};
  for (const sectionType of SECTION_ORDER) {
    const m = byType.get(sectionType as SectionType);
    if (!m) continue; // modules ship incrementally by phase
    const d = m.compute(f, baseline, det, inputs);
    det[m.section_type] = d;
    if (m.updateBaseline) baseline = m.updateBaseline(baseline, d);
  }
  return { baseline, det };
}
