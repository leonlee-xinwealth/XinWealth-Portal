import { assertAlmostEquals, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { twr, valueChangeAnnual } from "./valuation.ts";

const ASOF = "2026-09-23";

Deno.test("valueChangeAnnual: exactly ~1yr span, no contributions, annualises to the raw change", () => {
  const r = valueChangeAnnual(
    [
      { valuation_date: "2025-09-23", value: 100000 },
      { valuation_date: "2026-09-23", value: 110000 },
    ],
    ASOF,
    { assetType: "stock", currentValue: 110000 },
  );
  assertEquals(r.source, "history");
  assertEquals(r.from_date, "2025-09-23");
  assertEquals(r.to_date, "2026-09-23");
  assertEquals(r.days, 365);
  assertEquals(r.annual_change, 10000);
});

Deno.test("valueChangeAnnual: shorter span is annualised up by 365/days", () => {
  // 180 days apart, raw change 50 -> annualised = 50 * 365/180
  const r = valueChangeAnnual(
    [
      { valuation_date: "2026-03-27", value: 1000 },
      { valuation_date: "2026-09-23", value: 1050 },
    ],
    ASOF,
    { assetType: "stock", currentValue: 1050 },
  );
  assertEquals(r.source, "history");
  const days = r.days!;
  assertAlmostEquals(r.annual_change!, Math.round((50 * (365 / days)) * 100) / 100, 0.01);
});

Deno.test("valueChangeAnnual: net_contribution between the two points is subtracted before annualising", () => {
  // 1 year apart, value grew 100000 -> 130000, but 20000 of that was a fresh
  // deposit recorded on the latest valuation — true growth is only 10000.
  const r = valueChangeAnnual(
    [
      { valuation_date: "2025-09-23", value: 100000 },
      { valuation_date: "2026-09-23", value: 130000, net_contribution: 20000 },
    ],
    ASOF,
    { assetType: "unit_trust", currentValue: 130000 },
  );
  assertEquals(r.source, "history");
  assertEquals(r.annual_change, 10000);
});

Deno.test("valueChangeAnnual: contributions from every valuation strictly after `earlier` are summed", () => {
  const r = valueChangeAnnual(
    [
      { valuation_date: "2025-09-23", value: 100000 },
      { valuation_date: "2026-03-23", value: 115000, net_contribution: 10000 },
      { valuation_date: "2026-09-23", value: 135000, net_contribution: 10000 },
    ],
    ASOF,
    { assetType: "unit_trust", currentValue: 135000 },
  );
  // earlier = 2025-09-23 (100000); latest = 2026-09-23 (135000).
  // contributions after earlier up to latest = 10000 + 10000 = 20000.
  // raw change = 135000 - 100000 - 20000 = 15000, span = 365 days.
  assertEquals(r.source, "history");
  assertEquals(r.days, 365);
  assertEquals(r.annual_change, 15000);
});

Deno.test("valueChangeAnnual: span under 60 days is treated as no usable history", () => {
  const r = valueChangeAnnual(
    [
      { valuation_date: "2026-08-10", value: 1000 },
      { valuation_date: "2026-09-23", value: 1010 },
    ],
    ASOF,
    { assetType: "stock", currentValue: 1010 },
  );
  assertEquals(r.source, "none");
  assertEquals(r.annual_change, null);
});

Deno.test("valueChangeAnnual: no valuations at all -> vehicle gets the default depreciation", () => {
  const r = valueChangeAnnual([], ASOF, { assetType: "vehicle", currentValue: 80000 });
  assertEquals(r.source, "default_depreciation");
  assertEquals(r.annual_change, -8000);
});

Deno.test("valueChangeAnnual: no valuations at all -> non-vehicle gets null/none", () => {
  const r = valueChangeAnnual(null, ASOF, { assetType: "own_residence", currentValue: 500000 });
  assertEquals(r.source, "none");
  assertEquals(r.annual_change, null);
});

Deno.test("valueChangeAnnual: a single valuation (no earlier candidate) also falls back", () => {
  const r = valueChangeAnnual(
    [{ valuation_date: "2026-06-01", value: 80000 }],
    ASOF,
    { assetType: "vehicle", currentValue: 80000 },
  );
  assertEquals(r.source, "default_depreciation");
  assertEquals(r.annual_change, -8000);
});

Deno.test("valueChangeAnnual: valuations after asOf are ignored", () => {
  const r = valueChangeAnnual(
    [
      { valuation_date: "2025-09-23", value: 100000 },
      { valuation_date: "2026-09-23", value: 110000 },
      { valuation_date: "2027-01-01", value: 999999 }, // future, must be ignored
    ],
    ASOF,
    { assetType: "stock", currentValue: 110000 },
  );
  assertEquals(r.to_date, "2026-09-23");
  assertEquals(r.annual_change, 10000);
});

Deno.test("valueChangeAnnual: picks the valuation closest to 365 days before latest, not just the earliest", () => {
  const r = valueChangeAnnual(
    [
      { valuation_date: "2024-01-01", value: 50000 }, // far earlier, should be ignored
      { valuation_date: "2025-09-24", value: 100000 }, // ~364 days before latest — closest
      { valuation_date: "2026-09-23", value: 108000 },
    ],
    ASOF,
    { assetType: "stock", currentValue: 108000 },
  );
  assertEquals(r.from_date, "2025-09-24");
  assertEquals(r.days, 364);
});

// ---------------------------------------------------------------------------
// twr
// ---------------------------------------------------------------------------

Deno.test("twr: two points, no contribution — simple return", () => {
  const r = twr([
    { valuation_date: "2025-09-23", value: 100000 },
    { valuation_date: "2026-09-23", value: 110000 },
  ]);
  assertEquals(r?.from, "2025-09-23");
  assertEquals(r?.to, "2026-09-23");
  assertAlmostEquals(r!.twr, 0.1, 0.0001);
});

Deno.test("twr: chain-links sub-periods and nets out contributions each period", () => {
  // period 1: 100 -> 120, no contribution -> r1 = 0.20
  // period 2: 120 -> 180, but 40 was a fresh deposit -> (180-40)/120 - 1 = 1/6
  const r = twr([
    { valuation_date: "2026-01-01", value: 100 },
    { valuation_date: "2026-04-01", value: 120 },
    { valuation_date: "2026-07-01", value: 180, net_contribution: 40 },
  ]);
  const expected = (1.2 * (140 / 120)) - 1;
  assertAlmostEquals(r!.twr, expected, 0.0001);
});

Deno.test("twr: a zero-value starting period is skipped, not divided by zero", () => {
  const r = twr([
    { valuation_date: "2026-01-01", value: 0 },
    { valuation_date: "2026-04-01", value: 1000, net_contribution: 1000 }, // funded from zero
    { valuation_date: "2026-07-01", value: 1100 },
  ]);
  // first period skipped (V_{t-1}=0); second period: 1100/1000 - 1 = 0.10
  assertAlmostEquals(r!.twr, 0.10, 0.0001);
});

Deno.test("twr: fewer than 2 valuations -> null", () => {
  assertEquals(twr([{ valuation_date: "2026-01-01", value: 100 }]), null);
  assertEquals(twr([]), null);
});

Deno.test("twr: annualised compounds the cumulative return over the actual span", () => {
  const r = twr([
    { valuation_date: "2026-01-01", value: 100 },
    { valuation_date: "2026-07-01", value: 105 }, // ~181 days, +5%
  ]);
  const totalDays = (new Date("2026-07-01").getTime() - new Date("2026-01-01").getTime()) / 86400000;
  const expectedAnnualised = Math.pow(1.05, 365 / totalDays) - 1;
  assertAlmostEquals(r!.annualised!, expectedAnnualised, 0.0005);
});
