// Types for the plain-JS review-date helpers so its vitest suite type-checks under `strict`.
export declare function daysBetween(fromStr: string, toStr: string): number;
export declare function quarterEndDate(date?: Date | string): string;
export declare function quarterlyPeriodEnd(asOf?: Date | string): string;

export interface ReviewLike {
  kind?: string | null;
  status?: string | null;
  period_end?: string | null;
  approved_at?: string | null;
  submitted_at?: string | null;
}

export interface ReviewStatus {
  last_approved_at: string | null;
  pending: boolean;
  due: boolean;
}

export declare function computeReviewStatus(input: {
  reviews?: ReviewLike[] | null;
  onboardedAt?: string | null;
  asOf?: Date | string;
}): ReviewStatus;
