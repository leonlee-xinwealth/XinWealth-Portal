// Types for the plain-JS review-submission helpers so its vitest suite
// type-checks under `strict`.

export declare function dedupeById<T extends Record<string, unknown>>(
  list: readonly (T | null | undefined)[] | null | undefined,
  idKey: string,
): T[];

export interface StrictAmountResult {
  ok: boolean;
  value: number | null;
}

export declare function parseStrictAmount(raw: unknown): StrictAmountResult;
