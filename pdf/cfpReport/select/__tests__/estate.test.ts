import { describe, it, expect } from "vitest";
import {
  selectEstate, estateRows, nominationRows, TESTATE_TRACK, INTESTATE_TRACK,
} from "../estate";
import type { CfpReportData } from "../../types";

function payload(content: Record<string, unknown> | null): CfpReportData {
  return {
    clientName: "T", advisorName: "A", period: "2026", generatedDate: "x",
    language: "zh", hasUnapproved: false, client: {}, baseline: null,
    sections: content ? [{ section_type: "legacy_planning", status: "approved", content }] : [],
    assets: [], liabilities: [],
  };
}

const CONTENT = {
  insufficient_data: false,
  life_cover_total: 300_000,
  gross_estate: 1_363_000,
  net_estate: 550_000,
  settlement_costs_est: 41_500,
  estate_obligations: 771_500,
  estate_liquidity: { available: 96_000, status: "shortfall", shortfall: 717_000 },
  distribution: {
    regime: "conventional",
    will_status: "no_will",
    faraid_flagged: false,
    intestate_conventional_split: [
      { beneficiary: "配偶", share: "1/4" },
      { beneficiary: "子女", share: "1/2" },
      { beneficiary: "父母", share: "1/4" },
    ],
  },
  nominations: { epf: true, insurance: false },
  trust_consideration: true,
  asset_isolation_flag: false,
};

describe("reading the section", () => {
  const v = selectEstate(payload(CONTENT));

  it("pulls the estate position", () => {
    expect(v.hasData).toBe(true);
    expect(v.grossEstate).toBe(1_363_000);
    expect(v.netEstate).toBe(550_000);
  });

  it("surfaces the liquidity shortfall the consequence card needs", () => {
    expect(v.liquidity).toEqual({ available: 96_000, status: "shortfall", shortfall: 717_000 });
  });

  it("carries the intestate split so the page can show who actually inherits", () => {
    expect(v.intestateSplit).toHaveLength(3);
    expect(v.intestateSplit[0]).toEqual({ beneficiary: "配偶", share: "1/4" });
  });

  it("keeps nomination state as a tri-state, not a boolean", () => {
    expect(v.nominations).toEqual({ epf: true, insurance: false });
    const unknown = selectEstate(payload({ ...CONTENT, nominations: {} }));
    expect(unknown.nominations).toEqual({ epf: null, insurance: null });
  });

  it("returns an empty view when the section is missing or unusable", () => {
    expect(selectEstate(payload(null)).hasData).toBe(false);
    expect(selectEstate(payload({ ...CONTENT, insufficient_data: true })).hasData).toBe(false);
  });

  it("defaults an unknown will status rather than assuming one exists", () => {
    const v2 = selectEstate(payload({ ...CONTENT, distribution: {} }));
    expect(v2.willStatus).toBe("unknown");
    expect(v2.intestateSplit).toEqual([]);
  });
});

describe("estate table", () => {
  const rows = estateRows(selectEstate(payload(CONTENT)));

  it("walks gross down to distributable net", () => {
    expect(rows.map((r) => r.label)).toEqual([
      "遗产总值", "应清偿债务", "遗产处理费用（估）", "可分配净遗产",
    ]);
  });

  it("prints deductions as accounting negatives", () => {
    expect(rows[1].value).toBe("(RM 771,500)");
    expect(rows[2].value).toBe("(RM 41,500)");
  });
});

describe("nomination checklist", () => {
  it("flags anything not actually nominated, including unknown", () => {
    const rows = nominationRows(selectEstate(payload(CONTENT)));
    expect(rows.find((r) => r.label.startsWith("EPF"))).toMatchObject({ value: "已提名", flag: undefined });
    expect(rows.find((r) => r.label.startsWith("保单"))).toMatchObject({ value: "未提名", flag: "bad" });
  });

  it("treats unknown as needing attention rather than as fine", () => {
    const rows = nominationRows(selectEstate(payload({ ...CONTENT, nominations: {} })));
    expect(rows.every((r) => r.flag === "bad")).toBe(true);
    expect(rows.every((r) => r.value === "待确认")).toBe(true);
  });
});

describe("the two tracks", () => {
  it("run the same number of steps so they can be read across", () => {
    expect(TESTATE_TRACK).toHaveLength(INTESTATE_TRACK.length);
  });

  it("every step carries a label and a detail", () => {
    for (const s of [...TESTATE_TRACK, ...INTESTATE_TRACK]) {
      expect(s.label).toBeTruthy();
      expect(s.detail).toBeTruthy();
    }
  });
});
