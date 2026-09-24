import { describe, expect, it } from "vitest";
import {
  dedupeById, parseStrictAmount,
} from "../../api/_lib/reviewSubmission.js";

describe("dedupeById", () => {
  it("keeps a single entry per id, unchanged, when there are no duplicates", () => {
    const list = [{ asset_id: "a1", value: 100 }, { asset_id: "a2", value: 200 }];
    expect(dedupeById(list, "asset_id")).toEqual(list);
  });

  it("keeps the LAST entry when an id repeats", () => {
    const list = [
      { asset_id: "a1", value: 100 },
      { asset_id: "a2", value: 200 },
      { asset_id: "a1", value: 999 },
    ];
    const result = dedupeById(list, "asset_id");
    expect(result).toHaveLength(2);
    expect(result.find((r: any) => r.asset_id === "a1")?.value).toBe(999);
    expect(result.find((r: any) => r.asset_id === "a2")?.value).toBe(200);
  });

  it("drops entries with a missing, null or empty id", () => {
    const list = [
      { asset_id: "a1", value: 1 },
      { value: 2 },
      { asset_id: null, value: 3 },
      { asset_id: "", value: 4 },
      null,
      undefined,
    ];
    expect(dedupeById(list as any, "asset_id")).toEqual([{ asset_id: "a1", value: 1 }]);
  });

  it("returns an empty array for an empty/missing list", () => {
    expect(dedupeById([], "asset_id")).toEqual([]);
    expect(dedupeById(undefined as any, "asset_id")).toEqual([]);
    expect(dedupeById(null as any, "asset_id")).toEqual([]);
  });

  it("works with a different id key (liability_id)", () => {
    const list = [
      { liability_id: "l1", balance: 500 },
      { liability_id: "l1", balance: 400 },
    ];
    const result = dedupeById(list, "liability_id");
    expect(result).toEqual([{ liability_id: "l1", balance: 400 }]);
  });
});

describe("parseStrictAmount", () => {
  it("treats a missing or blank value as an explicit 0", () => {
    expect(parseStrictAmount(null)).toEqual({ ok: true, value: 0 });
    expect(parseStrictAmount(undefined)).toEqual({ ok: true, value: 0 });
    expect(parseStrictAmount("")).toEqual({ ok: true, value: 0 });
  });

  it("accepts a finite non-negative number", () => {
    expect(parseStrictAmount(1200)).toEqual({ ok: true, value: 1200 });
    expect(parseStrictAmount(0)).toEqual({ ok: true, value: 0 });
  });

  it("accepts a numeric string with RM prefix and thousands separators", () => {
    expect(parseStrictAmount("RM 12,000.50")).toEqual({ ok: true, value: 12000.5 });
  });

  it("rejects a negative value", () => {
    expect(parseStrictAmount(-500)).toEqual({ ok: false, value: null });
    expect(parseStrictAmount("-1")).toEqual({ ok: false, value: null });
  });

  it("rejects a non-numeric string", () => {
    expect(parseStrictAmount("abc")).toEqual({ ok: false, value: null });
  });

  it("rejects non-finite values", () => {
    expect(parseStrictAmount(Infinity)).toEqual({ ok: false, value: null });
    expect(parseStrictAmount(NaN)).toEqual({ ok: false, value: null });
  });
});
