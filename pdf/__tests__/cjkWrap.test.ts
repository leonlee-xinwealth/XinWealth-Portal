// Guards the CJK line-breaking callback shared by every client PDF.
//
// If this regresses, long Chinese paragraphs become one unbreakable "word" and
// run straight off the page instead of wrapping — the 文字跑位 bug.
import { describe, expect, it } from "vitest";
import { isCjkChar, splitForCjkWrap } from "../cjkWrap";

describe("splitForCjkWrap", () => {
  it("breaks CJK per character so a paragraph can wrap", () => {
    expect(splitForCjkWrap("投资组合")).toEqual(["投", "资", "组", "合"]);
  });

  it("keeps Latin runs and formatted numbers intact", () => {
    expect(splitForCjkWrap("投资组合RM500,000配置")).toEqual([
      "投", "资", "组", "合", "RM500,000", "配", "置",
    ]);
  });

  it("leaves a pure-Latin word untouched so it never splits mid-token", () => {
    expect(splitForCjkWrap("diversification")).toEqual(["diversification"]);
    expect(splitForCjkWrap("RM1,250,000")).toEqual(["RM1,250,000"]);
  });

  it("handles the empty string without throwing", () => {
    expect(splitForCjkWrap("")).toEqual([""]);
  });

  it("splits full-width punctuation, which also carries line-break opportunities", () => {
    expect(splitForCjkWrap("稳健型，平衡型")).toEqual(["稳", "健", "型", "，", "平", "衡", "型"]);
  });

  it("round-trips: joining the parts reproduces the input exactly", () => {
    for (const s of ["投资组合RM500,000配置", "diversification", "稳健型，平衡型", "4–6% p.a.成长"]) {
      expect(splitForCjkWrap(s).join("")).toBe(s);
    }
  });
});

describe("isCjkChar", () => {
  it("recognises ideographs and full-width punctuation, not Latin or digits", () => {
    expect(isCjkChar("投")).toBe(true);
    expect(isCjkChar("，")).toBe(true);
    expect(isCjkChar("A")).toBe(false);
    expect(isCjkChar("5")).toBe(false);
    expect(isCjkChar("%")).toBe(false);
  });
});
