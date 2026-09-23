import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  allFingerprints,
  fingerprintInput,
  sectionFingerprint,
  stableStringify,
} from "./fingerprint.ts";
import { BUDGET_LINE } from "./budgetContext.ts";
import type { FinancialBaseline } from "./types.ts";
import { SECTION_ORDER } from "./types.ts";

function baseline(over: Partial<FinancialBaseline> = {}): FinancialBaseline {
  return {
    version: 1,
    cashflow_basis: { year: 2026, from_month: 6, to_month: 7 },
    cashflow_basis_months: 2,
    cashflow_months_with_data: [6, 7],
    annual_income: 240_000,
    annual_expenses: 168_000,
    monthly_income: 20_000,
    monthly_essential_expenses: 14_000,
    annual_surplus: 72_000,
    emergency_fund_need_low: 42_000,
    emergency_fund_need_high: 84_000,
    emergency_fund_actual: 60_000,
    liquid_assets_total: 60_000,
    liquid_assets_after_emergency: 0,
    total_assets: 1_003_000,
    net_worth: 231_500,
    total_liabilities: 771_500,
    monthly_debt_service: 4_200,
    // P2a: FinancialBaseline gained these three fields; this fixture predates
    // them and doesn't exercise them, so zero/empty keeps every assertion below unchanged.
    monthly_principal: 1_800,
    derived_items: [],
    superseded_manual: 0,
    debt_service_ratio: 0.21,
    savings_ratio: 0.3,
    solvency_ratio: 0.23,
    current_year: 2026,
    age: 41,
    retirement_age: 60,
    years_to_retirement: 19,
    dependents: 2,
    marital_status: "married",
    assumptions: {} as FinancialBaseline["assumptions"],
    budget_summary: {
      annual_surplus: 72_000,
      required_total: 90_000,
      over_budget: true,
      lines: [
        { key: "protection", label_zh: "保障", label_en: "Protection", required_annual: 12_000, allocated_annual: 12_000, deferred_annual: 0 },
        { key: "emergency", label_zh: "紧急", label_en: "Emergency", required_annual: 24_000, allocated_annual: 24_000, deferred_annual: 0 },
        { key: "retirement", label_zh: "退休", label_en: "Retirement", required_annual: 36_000, allocated_annual: 36_000, deferred_annual: 0 },
        { key: "goals", label_zh: "目标", label_en: "Goals", required_annual: 18_000, allocated_annual: 0, deferred_annual: 18_000 },
        { key: "wealth", label_zh: "增值", label_en: "Wealth", required_annual: 0, allocated_annual: 0, deferred_annual: 0 },
      ],
    },
    baseline_notes: [],
    ...over,
  };
}

const DET = { capital_needed: 4_320_000, shortfall: 900_000 };

Deno.test("stableStringify is order-independent", () => {
  assertEquals(
    stableStringify({ b: 1, a: { d: 4, c: 3 } }),
    stableStringify({ a: { c: 3, d: 4 }, b: 1 }),
  );
});

Deno.test("stableStringify keeps array order, which is meaningful", () => {
  assertNotEquals(stableStringify([1, 2]), stableStringify([2, 1]));
});

Deno.test("stableStringify treats an absent key and an explicit undefined alike", () => {
  assertEquals(stableStringify({ a: 1 }), stableStringify({ a: 1, b: undefined }));
});

Deno.test("the same inputs always hash the same", async () => {
  const a = await sectionFingerprint("retirement_planning", DET, baseline());
  const b = await sectionFingerprint("retirement_planning", { ...DET }, baseline());
  assertEquals(a, b);
  assertEquals(a.length, 64, "sha256 hex");
});

Deno.test("one ringgit of movement in the section's own numbers changes the hash", async () => {
  const before = await sectionFingerprint("retirement_planning", DET, baseline());
  const after = await sectionFingerprint(
    "retirement_planning",
    { ...DET, shortfall: 900_001 },
    baseline(),
  );
  assertNotEquals(before, after);
});

Deno.test("reallocating THIS section's budget line changes the hash", async () => {
  // The coupling that made fingerprints necessary: regenerating any section
  // re-runs the waterfall, and an approved retirement narrative that promised
  // RM36,000 a year is wrong the moment the allocation drops.
  const moved = baseline();
  moved.budget_summary!.lines = moved.budget_summary!.lines.map((l) =>
    l.key === "retirement"
      ? { ...l, allocated_annual: 20_000, deferred_annual: 16_000 }
      : l
  );
  assertNotEquals(
    await sectionFingerprint("retirement_planning", DET, baseline()),
    await sectionFingerprint("retirement_planning", DET, moved),
  );
});

Deno.test("reallocating ANOTHER section's budget line leaves this one alone", async () => {
  // Without this, every generation would stale every section and the whole
  // review pipeline would be unusable.
  const moved = baseline();
  moved.budget_summary!.lines = moved.budget_summary!.lines.map((l) =>
    l.key === "goals" ? { ...l, allocated_annual: 9_000, deferred_annual: 9_000 } : l
  );
  assertEquals(
    await sectionFingerprint("retirement_planning", DET, baseline()),
    await sectionFingerprint("retirement_planning", DET, moved),
  );
});

Deno.test("the shared surplus is part of every budgeted section's basis", async () => {
  // annual_surplus and over_budget are quoted in the prose, so a change in the
  // headroom must stale even when this section's own line did not move.
  const moved = baseline();
  moved.budget_summary!.annual_surplus = 80_000;
  assertNotEquals(
    await sectionFingerprint("retirement_planning", DET, baseline()),
    await sectionFingerprint("retirement_planning", DET, moved),
  );
});

Deno.test("sections with no budget line ignore the waterfall entirely", async () => {
  const moved = baseline();
  moved.budget_summary!.annual_surplus = 80_000;
  moved.budget_summary!.lines = [];
  for (const s of ["tax_planning", "legacy_planning", "financial_health"] as const) {
    assertEquals(
      await sectionFingerprint(s, DET, baseline()),
      await sectionFingerprint(s, DET, moved),
      `${s} has no budget line and must not react to the waterfall`,
    );
    assertEquals(BUDGET_LINE[s], null);
  }
});

Deno.test("a birthday changes the basis", async () => {
  assertNotEquals(
    await sectionFingerprint("retirement_planning", DET, baseline()),
    await sectionFingerprint(
      "retirement_planning",
      DET,
      baseline({ age: 42, years_to_retirement: 18 }),
    ),
  );
});

Deno.test("figures the prompt never sees do not change the basis", async () => {
  // baseline carries plenty the section prompt is not given; hashing all of it
  // would demote approved sections for reasons the advisor cannot see.
  assertEquals(
    await sectionFingerprint("retirement_planning", DET, baseline()),
    await sectionFingerprint(
      "retirement_planning",
      DET,
      baseline({ baseline_notes: ["recomputed"], current_year: 2027 }),
    ),
  );
});

Deno.test("a missing det hashes rather than throwing", async () => {
  const fp = await sectionFingerprint("tax_planning", undefined, baseline());
  assertEquals(fp.length, 64);
  assertEquals(
    fp,
    await sectionFingerprint("tax_planning", null, baseline()),
    "not generated and generated-as-null are the same basis",
  );
});

Deno.test("allFingerprints covers every section and gives each its own hash", async () => {
  const det = Object.fromEntries(SECTION_ORDER.map((s) => [s, { marker: s }]));
  const fps = await allFingerprints(det, baseline());
  assertEquals(Object.keys(fps).sort(), [...SECTION_ORDER].sort());
  assertEquals(new Set(Object.values(fps)).size, SECTION_ORDER.length);
});

Deno.test("a null budget_summary is a valid basis, not a crash", async () => {
  const b = baseline({ budget_summary: undefined });
  const fp = await sectionFingerprint("retirement_planning", DET, b);
  assertEquals(fp.length, 64);
  assert(
    (fingerprintInput("retirement_planning", DET, b) as { budget: unknown })
      .budget === null,
  );
});

Deno.test("moving the cashflow basis changes every section's fingerprint", () => {
  // The basis decides which months of actuals the entire plan is annualised
  // from, so switching it from June to June–July moves every income and expense
  // figure in the report at once. An approved section written against the old
  // basis is no longer describing this client, and the sweep has to withdraw it.
  const before = baseline();
  const after = baseline({ cashflow_basis: { year: 2026, from_month: 6, to_month: 6 } });
  return Promise.all(SECTION_ORDER.map(async (s) => {
    assertNotEquals(
      await sectionFingerprint(s, DET, before),
      await sectionFingerprint(s, DET, after),
      `${s} must stale when the basis moves`,
    );
  }));
});

Deno.test("re-selecting the same months hashes identically", async () => {
  // The CHOICE is hashed, not the object identity — otherwise every re-open of
  // the report would look like a change.
  assertEquals(
    await sectionFingerprint("cashflow_planning", DET, baseline()),
    await sectionFingerprint("cashflow_planning", DET, baseline({
      cashflow_basis: { year: 2026, from_month: 6, to_month: 7 },
    })),
  );
});

Deno.test("a client with no recorded months hashes without throwing", async () => {
  const fp = await sectionFingerprint("cashflow_planning", DET, baseline({
    cashflow_basis: null,
    cashflow_months_with_data: [],
  }));
  assertEquals(fp.length, 64);
});
