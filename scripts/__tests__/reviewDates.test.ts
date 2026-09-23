import { describe, expect, it } from "vitest";
import {
  computeReviewStatus, daysBetween, quarterEndDate, quarterlyPeriodEnd,
} from "../../api/_lib/reviewDates.js";

describe("daysBetween", () => {
  it("counts whole days forward", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
  });
  it("is negative when `to` is before `from`", () => {
    expect(daysBetween("2026-03-01", "2026-01-01")).toBe(-59);
  });
  it("is zero for the same date", () => {
    expect(daysBetween("2026-06-15", "2026-06-15")).toBe(0);
  });
});

describe("quarterEndDate", () => {
  it("maps Jan–Mar to Mar 31", () => {
    expect(quarterEndDate("2026-02-10")).toBe("2026-03-31");
  });
  it("maps Apr–Jun to Jun 30", () => {
    expect(quarterEndDate("2026-04-01")).toBe("2026-06-30");
  });
  it("maps Jul–Sep to Sep 30", () => {
    expect(quarterEndDate("2026-09-23")).toBe("2026-09-30");
  });
  it("maps Oct–Dec to Dec 31", () => {
    expect(quarterEndDate("2026-12-31")).toBe("2026-12-31");
  });
});

describe("quarterlyPeriodEnd", () => {
  it("returns the current quarter's end for a valid date", () => {
    expect(quarterlyPeriodEnd("2026-09-23")).toBe("2026-09-30");
  });
  it("degrades to a valid date string without throwing when given an unparseable date", () => {
    const result = quarterlyPeriodEnd("not-a-date");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("computeReviewStatus", () => {
  const asOf = "2026-09-23";

  it("no reviews, client onboarded recently — not due", () => {
    const status = computeReviewStatus({ reviews: [], onboardedAt: "2026-08-01", asOf });
    expect(status).toEqual({ last_approved_at: null, pending: false, due: false });
  });

  it("no reviews, client onboarded > 92 days ago — due", () => {
    const status = computeReviewStatus({ reviews: [], onboardedAt: "2026-05-01", asOf });
    expect(status.due).toBe(true);
    expect(status.pending).toBe(false);
    expect(status.last_approved_at).toBeNull();
  });

  it("last approved review within 92 days — not due", () => {
    const reviews = [
      { kind: "quarterly", status: "approved", period_end: "2026-06-30", approved_at: "2026-07-05" },
    ];
    const status = computeReviewStatus({ reviews, asOf });
    expect(status.due).toBe(false);
    expect(status.last_approved_at).toBe("2026-07-05");
  });

  it("last approved review over 92 days ago — due", () => {
    const reviews = [
      { kind: "quarterly", status: "approved", period_end: "2026-03-31", approved_at: "2026-04-02" },
    ];
    const status = computeReviewStatus({ reviews, asOf });
    expect(status.due).toBe(true);
  });

  it("a submitted review is pending, regardless of age", () => {
    const reviews = [
      { kind: "quarterly", status: "submitted", period_end: "2026-09-30", submitted_at: "2026-09-20" },
    ];
    const status = computeReviewStatus({ reviews, asOf });
    expect(status.pending).toBe(true);
    expect(status.due).toBe(false);
  });

  it("ignores non-quarterly (annual) reviews", () => {
    const reviews = [
      { kind: "annual", status: "approved", period_end: "2026-01-01", approved_at: "2026-01-01" },
    ];
    const status = computeReviewStatus({ reviews, onboardedAt: "2026-01-01", asOf });
    // annual review ignored → falls back to onboardedAt, which is > 92 days before asOf
    expect(status.due).toBe(true);
    expect(status.last_approved_at).toBeNull();
  });

  it("rejected review does not count as the last relevant review", () => {
    const reviews = [
      { kind: "quarterly", status: "rejected", period_end: "2026-09-20", submitted_at: "2026-09-18" },
    ];
    const status = computeReviewStatus({ reviews, onboardedAt: "2026-01-01", asOf });
    expect(status.pending).toBe(false);
    // falls back to onboardedAt since the rejected review isn't "relevant"
    expect(status.due).toBe(true);
  });
});
