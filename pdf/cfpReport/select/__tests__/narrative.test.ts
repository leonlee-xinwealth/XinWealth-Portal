import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  consequenceOf,
  retirementVisionOf,
  severityOf,
  solutionOf,
  swotOf,
} from "../narrative";
import { INSURANCE_GAP_KEYS } from "../insurance";
import { ESTATE_EXPOSURE_KEYS } from "../estate";
import type { CfpReportData } from "../../types";

function payload(sectionType: string, content: unknown): CfpReportData {
  return {
    clientName: "Test", advisorName: "A", period: "2026", generatedDate: "x",
    language: "zh", hasUnapproved: false, client: {}, baseline: null,
    sections: [{ section_type: sectionType, status: "draft", content }],
    assets: [], liabilities: [],
  } as CfpReportData;
}

const CARD = { headline: "H", body: "B", bullets: ["one", "two", "three"] };

describe("solution cards", () => {
  it("returns the card when the section carries one", () => {
    expect(solutionOf(payload("tax_planning", { solution: CARD }), "tax_planning"))
      .toEqual(CARD);
  });

  it("returns null for a section that has not been generated", () => {
    expect(solutionOf(payload("goals_planning", {}), "tax_planning")).toBeNull();
  });

  it("returns null for a section generated before the slot existed", () => {
    // No migration and no backfill: this is the normal state of every report
    // that already exists, and the page must show its empty state, not a box.
    expect(solutionOf(payload("tax_planning", { overview: "old" }), "tax_planning"))
      .toBeNull();
  });

  it("rejects a half-written card rather than printing a floating heading", () => {
    expect(solutionOf(payload("tax_planning", { solution: { headline: "H" } }), "tax_planning"))
      .toBeNull();
    expect(solutionOf(payload("tax_planning", { solution: { body: "B" } }), "tax_planning"))
      .toBeNull();
  });

  it("drops empty bullets instead of rendering blank rows", () => {
    const r = solutionOf(
      payload("tax_planning", { solution: { ...CARD, bullets: ["a", "", "  ", null, 7] } }),
      "tax_planning",
    );
    expect(r?.bullets).toEqual(["a"]);
  });
});

describe("consequence cards", () => {
  const withKey = (key: unknown) =>
    consequenceOf(
      payload("insurance_planning", { consequences: { ...CARD, headline_key: key } }),
      "insurance_planning",
      INSURANCE_GAP_KEYS,
    );

  it("passes through a key the module actually has", () => {
    expect(withKey("life")?.headlineKey).toBe("life");
  });

  it("refuses a key outside the module's own set", () => {
    // The key drives a figure lookup; an unknown one would render a headline
    // with no number beside it on a full-page callout.
    expect(withKey("critical_illness")?.headlineKey).toBeNull();
    expect(withKey("")?.headlineKey).toBeNull();
    expect(withKey(42)?.headlineKey).toBeNull();
  });

  it("keeps the prose even when the key is unusable", () => {
    expect(withKey("nonsense")?.body).toBe("B");
  });
});

describe("severity", () => {
  const sev = (v: unknown) =>
    severityOf(payload("cashflow_planning", { executive_summary: { severity: v } }), "cashflow_planning");

  it("accepts the three defined levels", () => {
    expect(sev("critical")).toBe("critical");
    expect(sev("attention")).toBe("attention");
    expect(sev("on_track")).toBe("on_track");
  });

  it("rejects anything else, so the dot falls back to neutral", () => {
    expect(sev("urgent")).toBeNull();
    expect(sev(undefined)).toBeNull();
    expect(severityOf(payload("cashflow_planning", {}), "cashflow_planning")).toBeNull();
  });
});

describe("retirement vision", () => {
  it("needs both halves, because the page sets them against each other", () => {
    const both = { depletion_body: "a", passive_body: "b" };
    expect(retirementVisionOf(payload("retirement_planning", { vision: both })))
      .toEqual({ depletionBody: "a", passiveBody: "b" });
    expect(retirementVisionOf(payload("retirement_planning", { vision: { depletion_body: "a" } })))
      .toBeNull();
  });
});

describe("swot board", () => {
  it("keeps a partly-filled board — a missing column just has nothing to say", () => {
    const r = swotOf(payload("financial_health", {
      swot: { strengths: ["s"], warnings: [], opportunities: ["o"] },
    }));
    expect(r).toEqual({ strengths: ["s"], warnings: [], opportunities: ["o"] });
  });

  it("treats an entirely empty board as no board", () => {
    expect(swotOf(payload("financial_health", {
      swot: { strengths: [], warnings: [], opportunities: [] },
    }))).toBeNull();
    expect(swotOf(payload("financial_health", {}))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The cross-boundary check: the keys the PDF will accept have to be exactly the
// keys the model is allowed to emit. These live in two repos-worth of code that
// never import each other, and a mismatch is silent — the model returns a
// perfectly valid key, the PDF rejects it, and a full-page callout prints
// without its figure.
// ---------------------------------------------------------------------------
function serverEnum(file: string, constName: string): string[] {
  const src = readFileSync(path.resolve(__dirname, "../../../..", file), "utf8");
  const block = src.match(new RegExp(`export const ${constName} = \\[([\\s\\S]*?)\\] as const;`));
  if (!block) throw new Error(`${constName} not found in ${file}`);
  return [...block[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

describe("the PDF accepts exactly the keys the model may emit", () => {
  it("insurance gap keys match cfp-brain's CNA_GAP_KEYS", () => {
    expect(
      serverEnum("supabase/functions/cfp-brain/modules/insurance/section.ts", "CNA_GAP_KEYS"),
    ).toEqual([...INSURANCE_GAP_KEYS]);
  });

  it("estate exposure keys match cfp-brain's LEGACY_EXPOSURE_KEYS", () => {
    expect(
      serverEnum("supabase/functions/cfp-brain/modules/legacy/section.ts", "LEGACY_EXPOSURE_KEYS"),
    ).toEqual([...ESTATE_EXPOSURE_KEYS]);
  });
});
