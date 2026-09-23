// Bundle entry for api/_lib/taxonomy.mjs (scripts/build-taxonomy.mjs).
// Deno and the browser import the individual modules, not this file.
import { wealthEffectOf, type CashflowDirection } from "./cashflow.ts";

export * from "./cashflow.ts";
export * from "./balance.ts";
export * from "./legacy.ts";
export * from "../finance/loans.ts";
export * from "../finance/derived.ts";

/** True when the stored code is a transfer, in either direction. */
export function isTransferCategory(code: string | null | undefined, direction: CashflowDirection = "outflow"): boolean {
  return wealthEffectOf(code, direction) === "transfer";
}
