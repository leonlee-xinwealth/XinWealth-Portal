import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeAll } from "./orchestrator.ts";
import { ORDERED_MODULES } from "./modules/registry.ts";
import { makeCfpData } from "./baseline.test.ts";
import { SEVERITY_VALUES } from "./narrativeBlocks.ts";
import type { SectionType } from "./types.ts";

// A declared slot that the prompt never asks for is the worst of both worlds:
// the schema demands the field, so Gemini invents something to fill it, and the
// report prints it. These tests pin schema and prompt to each other.

const NOW = new Date("2026-07-16T00:00:00Z");

function prompts() {
  const f = makeCfpData();
  const { baseline, det } = computeAll(ORDERED_MODULES, f, {}, NOW);
  return ORDERED_MODULES.map((m) => ({
    type: m.section_type,
    ...m.buildPrompt(det[m.section_type], baseline, f),
  }));
}

// deno-lint-ignore no-explicit-any
function props(schema: any) {
  return schema?.properties ?? {};
}

Deno.test("every section asks the model for a severity, and constrains it", () => {
  for (const p of prompts()) {
    const es = props(props(p.schema).executive_summary);
    assertEquals(
      es.severity?.enum,
      SEVERITY_VALUES,
      `${p.type}: severity must be an enum, or the model will invent its own words`,
    );
    assert(
      p.prompt.includes("SEVERITY (`executive_summary.severity`)"),
      `${p.type}: schema demands a severity the prompt never explains`,
    );
  }
});

const SLOTS: Array<[SectionType, string, string]> = [
  ["insurance_planning", "consequences", "CONSEQUENCE CARD"],
  ["insurance_planning", "solution", "SOLUTION CARD"],
  ["legacy_planning", "consequences", "CONSEQUENCE CARD"],
  ["legacy_planning", "solution", "SOLUTION CARD"],
  ["retirement_planning", "vision", "RETIREMENT VISION"],
  ["retirement_planning", "solution", "SOLUTION CARD"],
  ["tax_planning", "solution", "SOLUTION CARD"],
  ["goals_planning", "solution", "SOLUTION CARD"],
  ["financial_health", "swot", "swot —"],
];

Deno.test("every template slot is both declared and explained", () => {
  const bySection = new Map(prompts().map((p) => [p.type, p]));
  for (const [section, slot, marker] of SLOTS) {
    const p = bySection.get(section)!;
    assert(props(p.schema)[slot], `${section}: schema is missing ${slot}`);
    assert(
      p.prompt.includes(marker),
      `${section}: schema demands ${slot} but the prompt never asks for it`,
    );
  }
});

Deno.test("a consequence card can only name a gap the module actually has", () => {
  // An invented key renders as a missing figure on a full-page callout.
  const bySection = new Map(prompts().map((p) => [p.type, p]));
  for (const section of ["insurance_planning", "legacy_planning"] as SectionType[]) {
    const keys = props(bySection.get(section)!.schema).consequences.properties.headline_key.enum;
    assert(Array.isArray(keys) && keys.length > 0, `${section}: headline_key has no enum`);
    for (const k of keys) {
      assert(
        bySection.get(section)!.prompt.includes(k),
        `${section}: ${k} is allowed by the schema but never listed in the prompt`,
      );
    }
  }
});

Deno.test("the model is told not to write amounts into the callout headlines", () => {
  // The compliance rule the whole card shape exists to enforce: the model picks
  // which gap leads, the report prints the figure.
  const bySection = new Map(prompts().map((p) => [p.type, p]));
  for (const section of ["insurance_planning", "legacy_planning"] as SectionType[]) {
    assert(bySection.get(section)!.prompt.includes("NO amounts"), section);
  }
  assert(
    bySection.get("retirement_planning")!.prompt.includes("state NO amounts here"),
    "retirement vision",
  );
});

Deno.test("no new slot smuggles a figure past the deterministic boundary", () => {
  // Every new slot is prose or an enum. A NUMBER-typed narrative field would
  // mean the model producing an amount, which the IRON RULE forbids.
  for (const p of prompts()) {
    walk(props(p.schema), p.type, []);
  }
});

// deno-lint-ignore no-explicit-any
function walk(properties: Record<string, any>, section: string, path: string[]) {
  for (const [key, value] of Object.entries(properties)) {
    const here = [...path, key];
    if (value?.type === "OBJECT") walk(props(value), section, here);
    else if (value?.type === "ARRAY") {
      if (value.items?.type === "OBJECT") walk(props(value.items), section, here);
      else assertNotMoney(value.items?.type, section, here);
    } else assertNotMoney(value?.type, section, here);
  }
}

function assertNotMoney(type: string | undefined, section: string, path: string[]) {
  // `priority` and `index` are ordinals, not amounts — the only numbers the
  // model is allowed to emit, and neither can be mistaken for money.
  const leaf = path[path.length - 1];
  if (leaf === "priority" || leaf === "index") return;
  assert(
    type !== "NUMBER" && type !== "INTEGER",
    `${section}.${path.join(".")} is ${type}: the model must never produce a figure`,
  );
}
