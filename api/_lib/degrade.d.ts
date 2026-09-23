// Types for the plain-JS degrade helpers so its vitest suite type-checks under `strict`.
export interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
}

export declare function isMissingColumnError(error: PostgrestLikeError | null | undefined): boolean;
export declare function isMissingTableError(error: PostgrestLikeError | null | undefined): boolean;
