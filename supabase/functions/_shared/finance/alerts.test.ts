import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeAlerts, type AlertLiability, type AlertReview, type AlertSnapshot } from "./alerts.ts";

const ASOF = new Date("2026-06-01T00:00:00Z");
const CLIENT_ID = "client-1";

function codesOf(alerts: ReturnType<typeof computeAlerts>): string[] {
  return alerts.map((a) => a.code);
}

// ---------------------------------------------------------------------------
// unexplained_gap: > max(RM 5,000, 5% of net worth).
// ---------------------------------------------------------------------------

Deno.test("computeAlerts: unexplained_gap fires only past max(5000, 5% of net worth)", () => {
  const latest = (gap: number, netWorth: number): AlertSnapshot => ({
    snapshot_date: "2026-06-01",
    net_worth: netWorth,
    unexplained_gap: gap,
  });

  // net worth 50,000 -> 5% = 2,500 < floor 5,000, so the floor applies.
  const atFloor = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: latest(5000, 50000), reviews: [], asOf: ASOF });
  assertEquals(codesOf(atFloor).includes("unexplained_gap"), false);
  const overFloor = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: latest(5001, 50000), reviews: [], asOf: ASOF });
  assertEquals(codesOf(overFloor).includes("unexplained_gap"), true);

  // net worth 200,000 -> 5% = 10,000, above the floor.
  const atPct = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: latest(10000, 200000), reviews: [], asOf: ASOF });
  assertEquals(codesOf(atPct).includes("unexplained_gap"), false);
  const overPct = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: latest(10001, 200000), reviews: [], asOf: ASOF });
  assertEquals(codesOf(overPct).includes("unexplained_gap"), true);
});

// ---------------------------------------------------------------------------
// emergency_fund_low: months < 3.
// ---------------------------------------------------------------------------

Deno.test("computeAlerts: emergency_fund_low fires below, not at, 3 months", () => {
  const at = computeAlerts({
    client_id: CLIENT_ID,
    snapshots: [],
    latestSnapshot: { snapshot_date: "2026-06-01", basic_liquidity_ratio: 3 },
    reviews: [],
    asOf: ASOF,
  });
  assertEquals(codesOf(at).includes("emergency_fund_low"), false);

  const below = computeAlerts({
    client_id: CLIENT_ID,
    snapshots: [],
    latestSnapshot: { snapshot_date: "2026-06-01", basic_liquidity_ratio: 2.9 },
    reviews: [],
    asOf: ASOF,
  });
  assertEquals(codesOf(below).includes("emergency_fund_low"), true);
});

// ---------------------------------------------------------------------------
// dsr_rising: >= 5 percentage points since the last snapshot; dsr_high: >60%.
// ---------------------------------------------------------------------------

Deno.test("computeAlerts: dsr_rising fires at a 5pp rise, not at 4pp", () => {
  const prev: AlertSnapshot = { snapshot_date: "2026-03-01", debt_service_ratio: 0.30 };

  const fourPp = computeAlerts({
    client_id: CLIENT_ID,
    snapshots: [prev],
    latestSnapshot: { snapshot_date: "2026-06-01", debt_service_ratio: 0.34 },
    reviews: [],
    asOf: ASOF,
  });
  assertEquals(codesOf(fourPp).includes("dsr_rising"), false);

  const fivePp = computeAlerts({
    client_id: CLIENT_ID,
    snapshots: [prev],
    latestSnapshot: { snapshot_date: "2026-06-01", debt_service_ratio: 0.35 },
    reviews: [],
    asOf: ASOF,
  });
  assertEquals(codesOf(fivePp).includes("dsr_rising"), true);
});

Deno.test("computeAlerts: dsr_high fires above, not at, 60%", () => {
  const at = computeAlerts({
    client_id: CLIENT_ID,
    snapshots: [],
    latestSnapshot: { snapshot_date: "2026-06-01", debt_service_ratio: 0.6 },
    reviews: [],
    asOf: ASOF,
  });
  assertEquals(codesOf(at).includes("dsr_high"), false);

  const over = computeAlerts({
    client_id: CLIENT_ID,
    snapshots: [],
    latestSnapshot: { snapshot_date: "2026-06-01", debt_service_ratio: 0.61 },
    reviews: [],
    asOf: ASOF,
  });
  assertEquals(codesOf(over).includes("dsr_high"), true);
});

// ---------------------------------------------------------------------------
// quarterly review due (>92 days) / overdue (>120 days) — overdue supersedes
// due, and both are measured off the last APPROVED review only.
// ---------------------------------------------------------------------------

Deno.test("computeAlerts: quarterly review due/overdue boundaries", () => {
  const reviewsAt = (daysAgo: number): AlertReview[] => {
    const d = new Date(ASOF.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return [{ kind: "quarterly", status: "approved", period_end: d.toISOString().slice(0, 10), approved_at: d.toISOString().slice(0, 10) }];
  };

  const at92 = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: { snapshot_date: "2026-06-01" }, reviews: reviewsAt(92), asOf: ASOF });
  assertEquals(codesOf(at92).includes("quarterly_review_due"), false);
  assertEquals(codesOf(at92).includes("quarterly_review_overdue"), false);

  const at93 = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: { snapshot_date: "2026-06-01" }, reviews: reviewsAt(93), asOf: ASOF });
  assertEquals(codesOf(at93).includes("quarterly_review_due"), true);
  assertEquals(codesOf(at93).includes("quarterly_review_overdue"), false);

  const at120 = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: { snapshot_date: "2026-06-01" }, reviews: reviewsAt(120), asOf: ASOF });
  assertEquals(codesOf(at120).includes("quarterly_review_due"), true);
  assertEquals(codesOf(at120).includes("quarterly_review_overdue"), false);

  const at121 = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: { snapshot_date: "2026-06-01" }, reviews: reviewsAt(121), asOf: ASOF });
  assertEquals(codesOf(at121).includes("quarterly_review_due"), false); // overdue supersedes due
  assertEquals(codesOf(at121).includes("quarterly_review_overdue"), true);
});

Deno.test("computeAlerts: no quarterly alert at all when the client has never had an approved quarterly review", () => {
  const r = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: { snapshot_date: "2026-06-01" }, reviews: [], asOf: ASOF });
  assertEquals(codesOf(r).includes("quarterly_review_due"), false);
  assertEquals(codesOf(r).includes("quarterly_review_overdue"), false);
});

// ---------------------------------------------------------------------------
// annual_review_due: >365 days.
// ---------------------------------------------------------------------------

Deno.test("computeAlerts: annual_review_due at 366 days, not at 365", () => {
  const reviewsAt = (daysAgo: number): AlertReview[] => {
    const d = new Date(ASOF.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return [{ kind: "annual", status: "approved", period_end: d.toISOString().slice(0, 10), approved_at: d.toISOString().slice(0, 10) }];
  };
  const at365 = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: { snapshot_date: "2026-06-01" }, reviews: reviewsAt(365), asOf: ASOF });
  assertEquals(codesOf(at365).includes("annual_review_due"), false);
  const at366 = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: { snapshot_date: "2026-06-01" }, reviews: reviewsAt(366), asOf: ASOF });
  assertEquals(codesOf(at366).includes("annual_review_due"), true);
});

// ---------------------------------------------------------------------------
// estimated_rate: a liability whose interest_rate was D1-estimated.
// ---------------------------------------------------------------------------

Deno.test("computeAlerts: estimated_rate fires only for liabilities missing an interest_rate", () => {
  const liabilities: AlertLiability[] = [
    { id: "l1", name: "Car loan", liability_type: "car_loan", outstanding_balance: 20000, interest_rate: 3, monthly_payment: 500, remaining_months: 40 },
  ];
  const withRate = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: { snapshot_date: "2026-06-01" }, reviews: [], liabilities, asOf: ASOF });
  assertEquals(codesOf(withRate).includes("estimated_rate"), false);

  const noRate: AlertLiability[] = [
    { id: "l1", name: "Car loan", liability_type: "car_loan", outstanding_balance: 20000, monthly_payment: 500, remaining_months: 40 },
  ];
  const missingRate = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: { snapshot_date: "2026-06-01" }, reviews: [], liabilities: noRate, asOf: ASOF });
  assertEquals(codesOf(missingRate).includes("estimated_rate"), true);
});

// ---------------------------------------------------------------------------
// review_pending: a submitted review awaiting approval.
// ---------------------------------------------------------------------------

Deno.test("computeAlerts: review_pending fires for a submitted review", () => {
  const reviews: AlertReview[] = [{ kind: "quarterly", status: "submitted", period_end: "2026-06-01" }];
  const r = computeAlerts({ client_id: CLIENT_ID, snapshots: [], latestSnapshot: { snapshot_date: "2026-06-01" }, reviews, asOf: ASOF });
  assertEquals(codesOf(r).includes("review_pending"), true);
});

Deno.test("computeAlerts: alerts are sorted high -> medium -> low", () => {
  const reviews: AlertReview[] = [{ kind: "quarterly", status: "submitted", period_end: "2026-06-01" }]; // low
  const r = computeAlerts({
    client_id: CLIENT_ID,
    snapshots: [],
    latestSnapshot: { snapshot_date: "2026-06-01", basic_liquidity_ratio: 1, debt_service_ratio: 0.7 }, // high x2
    reviews,
    asOf: ASOF,
  });
  const severities = r.map((a) => a.severity);
  assertEquals(severities[0], "high");
  assertEquals(severities[severities.length - 1], "low");
});
