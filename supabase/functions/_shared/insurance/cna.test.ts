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

// ---------------------------------------------------------------------------
// P5 决策 1: death/tpd/ci/ci_early_cover/medical/pa + excluding_group.
// ---------------------------------------------------------------------------

Deno.test("computeCna: no `coverage` supplied still populates death/tpd/ci/medical from the legacy flat inputs", () => {
  const r = computeCna({
    annual_income: 120000,
    liabilities_total: 200000,
    liquid_assets: 100000,
    life_cover: 500000,
    ci_cover: 100000,
    has_medical: true,
    dependents: 2,
  });
  // death.gap must equal the legacy gaps[life].gap — same one formula either way.
  const legacyLife = r.gaps.find((g) => g.key === "life")!;
  assertEquals(r.death.gap, legacyLife.gap);
  assertEquals(r.death.cover, 500000);
  assertEquals(r.tpd.cover, 500000); // assumed from life — no separate TPD item
  assertEquals(r.tpd.gap, legacyLife.gap);
  assert(r.tpd.notes.some((n) => n.includes("TPD")));
  assertEquals(r.ci.cover, 100000);
  assertEquals(r.ci.need, r.needs.ci);
  assertEquals(r.ci_early_cover.cover, 0);
  assertEquals(r.ci_early_cover.need, undefined);
  assert(r.ci_early_cover.notes.length > 0);
  assertEquals(r.medical.has_cover, true);
  assertEquals(r.medical.annual_limit, 0);
  // No per-policy detail was supplied, so the annual limit is simply unknown
  // (0 means "nothing on file", not a genuine RM0 limit) — low_limit only
  // fires for a KNOWN figure under RM1,000,000 (决策 1 correction).
  assertEquals(r.medical.low_limit, false);
  assertEquals(r.medical.limit_unknown, true);
  assert(r.medical.notes.some((n) => n.includes("未记录年限额")));
  assertEquals(r.pa.cover, 0);
  // No group data at all -> excluding_group is identical to the main set.
  assertEquals(r.excluding_group.death, r.death);
  assertEquals(r.excluding_group.medical, r.medical);
});

Deno.test("computeCna: MRTA/MLTA offset nets the covered liability balance out of BOTH needs.total_life/gaps[life] and death/tpd", () => {
  const withoutOffset = computeCna({
    annual_income: 120000,
    liabilities_total: 400000,
    liquid_assets: 0,
    life_cover: 500000,
    ci_cover: 0,
    has_medical: false,
    dependents: 0,
  });
  const withOffset = computeCna({
    annual_income: 120000,
    liabilities_total: 400000,
    liquid_assets: 0,
    life_cover: 500000,
    ci_cover: 0,
    has_medical: false,
    dependents: 0,
    coverage: {
      death_cover: 500000,
      death_has_group: false,
      tpd_cover: 500000,
      tpd_has_group: false,
      tpd_assumed_from_life: true,
      ci_cover: 0,
      ci_has_group: false,
      ci_early_cover: 0,
      ci_early_has_group: false,
      has_medical: false,
      medical_annual_limit: 0,
      medical_has_group: false,
      pa_cover: 0,
      pa_has_group: false,
      liabilities_covered_by_policy: 300000,
    },
  });

  // 300k of the 400k mortgage is already covered by the MRTA policy, so the
  // liabilities need drops by exactly that much — on BOTH the legacy fields
  // and the new `death`/`tpd` ones ("只有一个公式").
  assertEquals(withoutOffset.needs.liabilities, 400000);
  assertEquals(withOffset.needs.liabilities, 100000);
  assertEquals(withOffset.needs.total_life, withoutOffset.needs.total_life - 300000);
  assertEquals(
    withOffset.gaps.find((g) => g.key === "life")!.need,
    withoutOffset.gaps.find((g) => g.key === "life")!.need! - 300000,
  );
  assert(withOffset.death.notes.some((n) => n.includes("MRTA")));
  assert(withOffset.tpd.notes.some((n) => n.includes("MRTA")));
});

Deno.test("computeCna: a dedicated TPD cover (tpd_assumed_from_life=false) carries no 'assumed from life' note", () => {
  const r = computeCna({
    annual_income: 100000,
    liabilities_total: 0,
    liquid_assets: 0,
    life_cover: 500000,
    ci_cover: 0,
    has_medical: false,
    dependents: 0,
    coverage: {
      death_cover: 500000, death_has_group: false,
      tpd_cover: 200000, tpd_has_group: false, tpd_assumed_from_life: false,
      ci_cover: 0, ci_has_group: false,
      ci_early_cover: 0, ci_early_has_group: false,
      has_medical: false, medical_annual_limit: 0, medical_has_group: false,
      pa_cover: 0, pa_has_group: false,
      liabilities_covered_by_policy: 0,
    },
  });
  assertEquals(r.tpd.cover, 200000);
  assert(!r.tpd.notes.some((n) => n.includes("TPD")));
});

Deno.test("computeCna: group-employer cover is included in the main breakdown (with a lapse-on-exit note) but excluded from `excluding_group`", () => {
  const coverage = {
    death_cover: 600000,
    death_has_group: true,
    tpd_cover: 600000,
    tpd_has_group: true,
    tpd_assumed_from_life: true,
    ci_cover: 0,
    ci_has_group: false,
    ci_early_cover: 0,
    ci_early_has_group: false,
    has_medical: false,
    medical_annual_limit: 0,
    medical_has_group: false,
    pa_cover: 0,
    pa_has_group: false,
    liabilities_covered_by_policy: 0,
  };
  const coverageExcludingGroup = { ...coverage, death_cover: 400000, death_has_group: false, tpd_cover: 400000, tpd_has_group: false };

  const r = computeCna({
    annual_income: 100000,
    liabilities_total: 0,
    liquid_assets: 0,
    life_cover: 600000,
    ci_cover: 0,
    has_medical: false,
    dependents: 0,
    coverage,
    coverage_excluding_group: coverageExcludingGroup,
  });

  assertEquals(r.death.cover, 600000);
  assert(r.death.notes.some((n) => n.includes("团保") || n.includes("group")));
  assertEquals(r.excluding_group.death.cover, 400000);
  assert(!r.excluding_group.death.notes.some((n) => n.includes("团保") || n.includes("group")));
  // Same need either way — only cover/gap move with group exclusion.
  assertEquals(r.death.need, r.excluding_group.death.need);
});

Deno.test("computeCna: medical annual_limit below RM1,000,000 is flagged low_limit; no cover is a separate note", () => {
  const base = {
    annual_income: 60000,
    liabilities_total: 0,
    liquid_assets: 0,
    life_cover: 0,
    ci_cover: 0,
    has_medical: false,
    dependents: 0,
  };
  const lowLimit = computeCna({
    ...base,
    has_medical: true,
    coverage: {
      death_cover: 0, death_has_group: false,
      tpd_cover: 0, tpd_has_group: false, tpd_assumed_from_life: true,
      ci_cover: 0, ci_has_group: false,
      ci_early_cover: 0, ci_early_has_group: false,
      has_medical: true, medical_annual_limit: 300000, medical_has_group: false,
      pa_cover: 0, pa_has_group: false,
      liabilities_covered_by_policy: 0,
    },
  });
  assertEquals(lowLimit.medical.low_limit, true);
  assertEquals(lowLimit.medical.limit_unknown, false);
  assert(lowLimit.medical.notes.some((n) => n.includes("偏低")));

  const noCover = computeCna(base);
  assertEquals(noCover.medical.has_cover, false);
  assertEquals(noCover.medical.low_limit, false);
  assertEquals(noCover.medical.limit_unknown, false); // no cover at all is its own note, not "unknown limit"
  assert(noCover.medical.notes.some((n) => n.includes("未见医疗卡")));

  const unknownLimit = computeCna({
    ...base,
    has_medical: true,
    coverage: {
      death_cover: 0, death_has_group: false,
      tpd_cover: 0, tpd_has_group: false, tpd_assumed_from_life: true,
      ci_cover: 0, ci_has_group: false,
      ci_early_cover: 0, ci_early_has_group: false,
      has_medical: true, medical_annual_limit: 0, medical_has_group: false,
      pa_cover: 0, pa_has_group: false,
      liabilities_covered_by_policy: 0,
    },
  });
  assertEquals(unknownLimit.medical.low_limit, false);
  assertEquals(unknownLimit.medical.limit_unknown, true);
  assert(unknownLimit.medical.notes.some((n) => n.includes("未记录年限额")));
});

Deno.test("computeCna education override replaces the per-child constant", () => {
  const base = {
    annual_income: 120000,
    liabilities_total: 0,
    liquid_assets: 0,
    life_cover: 0,
    ci_cover: 0,
    has_medical: false,
    dependents: 2,
  };
  const withOverride = computeCna({ ...base, education_need_override: 200000 });
  assertEquals(withOverride.needs.education, 200000);
  assertEquals(
    withOverride.assumptions.some((a) => a.includes("真实教育目标")),
    true,
  );
  const withoutOverride = computeCna(base);
  assertEquals(
    withoutOverride.needs.education,
    Math.round(2 * 80000 * Math.pow(1.04, 10) / 1000) * 1000,
  );
});
