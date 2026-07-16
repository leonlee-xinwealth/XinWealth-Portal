// Module registry — the single place a new CFP section plugs in. Modules ship
// incrementally by phase; computeAll and index.ts tolerate missing entries.

import type { CfpModule, SectionType } from "../types.ts";

export const SECTION_LABELS: Record<SectionType, { en: string; zh: string }> = {
  cashflow_planning: { en: "Cashflow & Budget Planning", zh: "现金流规划与财务预算" },
  insurance_planning: { en: "Insurance Planning", zh: "保险规划" },
  investment_planning: { en: "Investment & Asset Allocation", zh: "投资规划与资产配置" },
  retirement_planning: { en: "Retirement Planning", zh: "退休规划" },
  tax_planning: { en: "Tax Planning", zh: "税务筹划" },
  legacy_planning: { en: "Legacy & Estate Planning", zh: "财富传承与遗产规划" },
  goals_planning: { en: "Goal-Based Planning", zh: "特定目标规划" },
  financial_health: { en: "Overall Financial Health", zh: "整体财务健康" },
};

// deno-lint-ignore no-explicit-any
export const ORDERED_MODULES: CfpModule<any, any, any>[] = [];

export function registerModule(
  // deno-lint-ignore no-explicit-any
  module: CfpModule<any, any, any>,
): void {
  ORDERED_MODULES.push(module);
}

export function findModule(
  sectionType: string,
  // deno-lint-ignore no-explicit-any
): CfpModule<any, any, any> | undefined {
  return ORDERED_MODULES.find((m) => m.section_type === sectionType);
}
