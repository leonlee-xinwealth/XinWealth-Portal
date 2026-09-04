import { describe, it, expect } from "vitest";
import { selectProfile, ageFromDob } from "../profile";
import type { CfpReportData } from "../../types";

const NOW = new Date("2026-08-20T00:00:00Z");

function payload(over: Partial<CfpReportData> = {}): CfpReportData {
  return {
    clientName: "WEI QI LEE", advisorName: "A", period: "2026", generatedDate: "x",
    language: "zh", hasUnapproved: false,
    client: {
      date_of_birth: "1990-03-15", marital_status: "married",
      number_of_dependants: 2, occupation: "Engineer",
      employment_status: "employed", retirement_age: 60,
    },
    baseline: null, sections: [], assets: [], liabilities: [],
    ...over,
  } as CfpReportData;
}

describe("age", () => {
  it("has not counted a birthday that has not happened yet this year", () => {
    expect(ageFromDob("1990-03-15", NOW)).toBe(36);
    expect(ageFromDob("1990-12-15", NOW)).toBe(35);
  });

  it("returns null rather than a number for missing or unusable dates", () => {
    expect(ageFromDob(null, NOW)).toBeNull();
    expect(ageFromDob("not a date", NOW)).toBeNull();
    expect(ageFromDob("2030-01-01", NOW)).toBeNull();
  });
});

describe("the profile page prints the client, not a placeholder", () => {
  it("takes every field from the record", () => {
    const v = selectProfile(payload(), NOW);
    const byLabel = Object.fromEntries(v.rows.map(r => [r.label, r.value]));
    expect(byLabel["姓名"]).toBe("WEI QI LEE");
    expect(byLabel["出生年份"]).toBe("1990（36 岁）");
    expect(byLabel["婚姻状况"]).toBe("已婚");
    expect(byLabel["受扶养人数"]).toBe("2 名");
    expect(byLabel["雇佣状态"]).toBe("受雇");
    expect(byLabel["预设退休年龄"]).toBe("60 岁");
  });

  it("prints the birth YEAR and age, never the full date of birth", () => {
    // The report is emailed, printed and handed over; a date of birth on it is
    // an identity-document field the page has no use for.
    const v = selectProfile(payload(), NOW);
    for (const r of v.rows) expect(r.value).not.toContain("03-15");
  });

  it("shows a dash for what the record does not have, rather than filling it in", () => {
    const v = selectProfile(payload({ client: {} }), NOW);
    const byLabel = Object.fromEntries(v.rows.map(r => [r.label, r.value]));
    expect(byLabel["出生年份"]).toBe("—");
    expect(byLabel["职业"]).toBe("—");
    expect(byLabel["受扶养人数"]).toBe("—");
  });

  it("passes an unmapped enum through instead of blanking it", () => {
    const v = selectProfile(
      payload({ client: { marital_status: "engaged", employment_status: "gig" } }), NOW);
    const byLabel = Object.fromEntries(v.rows.map(r => [r.label, r.value]));
    expect(byLabel["婚姻状况"]).toBe("engaged");
    expect(byLabel["雇佣状态"]).toBe("gig");
  });

  it("adds the spouse's own rows on a joint plan", () => {
    const v = selectProfile(payload({
      partnerName: "MEI LING TAN",
      partner: { date_of_birth: "1992-01-01", occupation: "Teacher" },
    }), NOW);
    const byLabel = Object.fromEntries(v.rows.map(r => [r.label, r.value]));
    expect(byLabel["配偶姓名"]).toBe("MEI LING TAN");
    expect(byLabel["配偶出生年份"]).toBe("1992（34 岁）");
  });

  it("never invents dependants — they are a count, not people", () => {
    // The page used to print "长子 8 岁 · 2038 年入学" for every client alive.
    const v = selectProfile(payload(), NOW);
    expect(v.family.map(m => m.role)).toEqual(["本人", "受扶养人"]);
    expect(v.family.find(m => m.role === "受扶养人")?.detail).toBe("2 名");
  });

  it("omits the dependants card when there are none", () => {
    const v = selectProfile(payload({ client: { number_of_dependants: 0 } }), NOW);
    expect(v.family.map(m => m.role)).toEqual(["本人"]);
  });

  it("reports an empty record so the page can say so", () => {
    const v = selectProfile(
      { ...payload(), clientName: "", client: {} } as CfpReportData, NOW);
    expect(v.hasData).toBe(false);
  });
});
