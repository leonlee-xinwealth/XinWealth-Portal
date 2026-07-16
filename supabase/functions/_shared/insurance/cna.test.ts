import { assertEquals, assert } from "jsr:@std/assert@1";
import { CNA_DEFAULTS, computeCna, incomeBandMidpoint } from "./cna.ts";

Deno.test("computeCna: full cfp data produces rounded needs and gaps", () => {
  const r = computeCna({
    annual_income: 120000,
    liabilities_total: 200000,
    liquid_assets: 100000,
    life_cover: 500000,
    ci_cover: 100000,
    has_medical: true,
    dependents: 2,
  });
  // education = 2 × 80000 × 1.04^10 = 236839.07 → needs rounded to nearest 1000
  assertEquals(r.needs.income_replacement, 1200000);
  assertEquals(r.needs.liabilities, 200000);
  assertEquals(r.needs.education, 237000);
  assertEquals(r.needs.total_life, 1637000);
  assertEquals(r.needs.ci, 360000);
  assertEquals(r.resources.life_cover, 500000);
  assertEquals(r.resources.liquid_assets, 100000);

  const life = r.gaps.find((g) => g.key === "life")!;
  assertEquals(life.need, 1637000);
  assertEquals(life.covered, 600000);
  assertEquals(life.gap, 1037000);

  const ci = r.gaps.find((g) => g.key === "ci")!;
  assertEquals(ci.need, 360000);
  assertEquals(ci.covered, 100000);
  assertEquals(ci.gap, 260000);

  const medical = r.gaps.find((g) => g.key === "medical")!;
  assertEquals(medical.flag_only, true);
  assertEquals(medical.has_cover, true);

  assertEquals(r.insufficient, false);
  assert(r.assumptions.length > 0);
});

Deno.test("computeCna: gap clamps to zero when well covered", () => {
  const r = computeCna({
    annual_income: 60000,
    liabilities_total: 0,
    liquid_assets: 500000,
    life_cover: 2000000,
    ci_cover: 500000,
    has_medical: false,
    dependents: 0,
  });
  assertEquals(r.gaps.find((g) => g.key === "life")!.gap, 0);
  assertEquals(r.gaps.find((g) => g.key === "ci")!.gap, 0);
  assertEquals(r.gaps.find((g) => g.key === "medical")!.has_cover, false);
});

Deno.test("computeCna: null liabilities/liquid treated as 0 with assumption note", () => {
  const r = computeCna({
    annual_income: 48000,
    liabilities_total: null,
    liquid_assets: null,
    life_cover: 0,
    ci_cover: 0,
    has_medical: false,
    dependents: 1,
  });
  assertEquals(r.needs.liabilities, 0);
  assertEquals(r.resources.liquid_assets, 0);
  assert(r.assumptions.some((a) => a.includes("负债")));
  assert(r.assumptions.some((a) => a.includes("流动资产")));
});

Deno.test("computeCna: zero income marks insufficient but does not throw", () => {
  const r = computeCna({
    annual_income: 0,
    liabilities_total: 0,
    liquid_assets: 0,
    life_cover: 0,
    ci_cover: 0,
    has_medical: false,
    dependents: 0,
  });
  assertEquals(r.insufficient, true);
  assertEquals(r.needs.income_replacement, 0);
});

Deno.test("computeCna: estimated income adds estimation assumption", () => {
  const r = computeCna({
    annual_income: 78000,
    income_estimated: true,
    liabilities_total: 0,
    liquid_assets: 0,
    life_cover: 0,
    ci_cover: 0,
    has_medical: false,
    dependents: 0,
  });
  assert(r.assumptions.some((a) => a.includes("中值")));
});

Deno.test("incomeBandMidpoint maps all funnel bands", () => {
  assertEquals(incomeBandMidpoint("RM3,000 以下"), 2000);
  assertEquals(incomeBandMidpoint("RM3,000-5,000"), 4000);
  assertEquals(incomeBandMidpoint("RM5,000-8,000"), 6500);
  assertEquals(incomeBandMidpoint("RM8,000-12,000"), 10000);
  assertEquals(incomeBandMidpoint("RM12,000 以上"), 15000);
  assertEquals(incomeBandMidpoint("something else"), 0);
});

Deno.test("CNA_DEFAULTS are echoed into assumptions", () => {
  const r = computeCna({
    annual_income: 100000,
    liabilities_total: 0,
    liquid_assets: 0,
    life_cover: 0,
    ci_cover: 0,
    has_medical: false,
    dependents: 1,
  });
  assert(
    r.assumptions.some((a) =>
      a.includes(String(CNA_DEFAULTS.income_replacement_years))
    ),
  );
});
