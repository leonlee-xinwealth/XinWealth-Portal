// Shared budget-alignment prompt block. Every section narrative is drafted
// against 首席规划师's ONE deterministic allocation so the report reads as a
// single coordinated plan: downside protection first, upside after — never
// two sections spending the same surplus ringgit twice.

import type { FinancialBaseline } from "./types.ts";

export interface SectionBudgetContext {
  annual_surplus: number;
  over_budget: boolean;
  this_section: {
    required_annual: number;
    allocated_annual: number;
    deferred_annual: number;
  } | null;
  priority_order:
    "protection → emergency fund → retirement → goals → wealth building";
}

/** JSON payload for the prompt context; null-safe when synthesis is absent. */
export function sectionBudgetContext(
  b: FinancialBaseline,
  lineKey: string,
): SectionBudgetContext | null {
  const bs = b.budget_summary;
  if (!bs) return null;
  const line = bs.lines.find((l) => l.key === lineKey) ?? null;
  return {
    annual_surplus: bs.annual_surplus,
    over_budget: bs.over_budget,
    this_section: line
      ? {
        required_annual: line.required_annual,
        allocated_annual: line.allocated_annual,
        deferred_annual: line.deferred_annual,
      }
      : null,
    priority_order:
      "protection → emergency fund → retirement → goals → wealth building",
  };
}

/** Instruction lines appended to every section prompt (identical wording). */
export function budgetInstructionLines(sectionNoun: string): string[] {
  return [
    "",
    "BUDGET ALIGNMENT (the whole report shares ONE budget): budget_context",
    "shows the chief planner's deterministic allocation of the client's annual",
    "surplus across the fixed priority order (protection first — downside risk",
    "is always secured before any upside). Rules:",
    `- State the full ${sectionNoun} need once, but every concrete`,
    "  recommendation must fit within this_section.allocated_annual.",
    "- If this_section.deferred_annual > 0, say explicitly that the remainder",
    "  is deferred under the plan's priority order and will be revisited when",
    "  income grows or at the next review — do NOT present it as an immediate",
    "  action item.",
    "- NEVER recommend spending beyond the allocated amount, and never claim",
    "  budget that the allocation assigns to another section.",
    "- If budget_context is null, omit any budget commentary.",
    "- Write in natural, client-facing prose. NEVER echo a JSON field name or",
    "  code identifier (e.g. over_budget, asset_transfers_monthly, deferred_",
    "  annual) — always describe the concept in plain words.",
  ];
}
