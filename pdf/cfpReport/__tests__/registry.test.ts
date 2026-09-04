import { describe, it, expect } from "vitest";
import {
  PAGE_ORDER, CFP_PAGE_COUNT, MODULE_TITLES, pageNumberOf, tocEntries, isModuleOpener,
  type ModuleNo,
} from "../registry";
import { SHOWCASE_PAGE_IDS } from "../showcase.pages";

describe("the fixed template's shape", () => {
  it("is 29 pages", () => {
    expect(CFP_PAGE_COUNT).toBe(29);
    expect(PAGE_ORDER).toHaveLength(29);
  });

  it("has unique ids", () => {
    const ids = PAGE_ORDER.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never moves backwards through the modules", () => {
    // The blueprint's narrative is 诊断 → 防守 → 进攻 → 优化; interleaving modules
    // would break the argument the report is making.
    const mods = PAGE_ORDER.map((p) => p.module);
    for (let i = 1; i < mods.length; i++) {
      expect(mods[i], `page ${i + 1} (${PAGE_ORDER[i].id})`).toBeGreaterThanOrEqual(mods[i - 1]);
    }
  });

  it("covers all ten modules, each with a title", () => {
    const present = new Set(PAGE_ORDER.map((p) => p.module));
    for (let m = 1 as ModuleNo; m <= 10; m = (m + 1) as ModuleNo) {
      expect(present.has(m), `module ${m}`).toBe(true);
      expect(MODULE_TITLES[m].zh, `module ${m}`).toBeTruthy();
      expect(MODULE_TITLES[m].en, `module ${m}`).toBeTruthy();
    }
  });

  it("matches the blueprint's page allocation per module", () => {
    const counts = PAGE_ORDER.reduce<Record<number, number>>((acc, p) => {
      acc[p.module] = (acc[p.module] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ 1: 5, 2: 5, 3: 3, 4: 3, 5: 3, 6: 2, 7: 3, 8: 2, 9: 2, 10: 1 });
  });
});

describe("front and back matter sit where a booklet expects them", () => {
  it("opens on the cover, table of contents, disclaimer", () => {
    expect(PAGE_ORDER.slice(0, 3).map((p) => p.id)).toEqual(["cover", "toc", "disclaimer"]);
  });

  it("closes on the back cover", () => {
    expect(PAGE_ORDER[PAGE_ORDER.length - 1].id).toBe("back-cover");
  });

  it("keeps covers, TOC and disclaimer out of the table of contents", () => {
    const navless = PAGE_ORDER.filter((p) => !("nav" in p && p.nav)).map((p) => p.id);
    expect(navless).toEqual(["cover", "toc", "disclaimer", "back-cover"]);
  });
});

describe("page numbers", () => {
  it("are 1-based and derived from position", () => {
    expect(pageNumberOf("cover")).toBe(1);
    expect(pageNumberOf("exec-summary")).toBe(4);
    expect(pageNumberOf("back-cover")).toBe(CFP_PAGE_COUNT);
  });

  it("throw rather than silently returning a wrong page for a bad id", () => {
    // @ts-expect-error deliberately outside the union
    expect(() => pageNumberOf("nope")).toThrow(/unknown page id/);
  });

  it("agree with each page's index", () => {
    PAGE_ORDER.forEach((p, i) => expect(pageNumberOf(p.id)).toBe(i + 1));
  });
});

describe("module openers", () => {
  it("gives every module exactly one opening page", () => {
    const openers = PAGE_ORDER.filter((p) => isModuleOpener(p.id));
    expect(openers.map((p) => p.module)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("opens on the first page of each module, never mid-module", () => {
    expect(PAGE_ORDER.filter((p) => isModuleOpener(p.id)).map((p) => p.id)).toEqual([
      "cover", "cashflow-overview", "ratios-1", "insurance-concept",
      "estate-concept", "suitability", "retirement-vision", "tax-findings",
      "goals-timeline", "back-cover",
    ]);
  });

  it("treats the very first page as an opener", () => {
    expect(isModuleOpener("cover")).toBe(true);
  });

  it("does not flag a page whose predecessor shares its module", () => {
    expect(isModuleOpener("cashflow-detail")).toBe(false);
    expect(isModuleOpener("insurance-gap")).toBe(false);
  });
});

describe("the showcase covers the whole template", () => {
  it("renders every registry page, in registry order", () => {
    // pageCount.test.ts only proves one sheet per declared component. This is
    // what proves the declared list is the template itself rather than an
    // arbitrary subset that drifted.
    expect([...SHOWCASE_PAGE_IDS]).toEqual(PAGE_ORDER.map((p) => p.id));
  });
});

describe("table of contents", () => {
  const toc = tocEntries();

  it("lists every page that declares a nav entry", () => {
    expect(toc).toHaveLength(CFP_PAGE_COUNT - 4);
  });

  it("carries both languages and a real page number", () => {
    for (const e of toc) {
      expect(e.zh, e.id).toBeTruthy();
      expect(e.en, e.id).toBeTruthy();
      expect(e.page, e.id).toBeGreaterThan(0);
      expect(e.page, e.id).toBeLessThanOrEqual(CFP_PAGE_COUNT);
    }
  });

  it("is in ascending page order", () => {
    const pages = toc.map((e) => e.page);
    expect([...pages].sort((a, b) => a - b)).toEqual(pages);
  });

  it("points at the right page for the blueprint's centrepiece", () => {
    // The retirement run-out chart is the page the user singled out; if the
    // registry ever drifts, this is the entry that should shout.
    const runout = toc.find((e) => e.id === "retirement-runout")!;
    expect(runout.page).toBe(pageNumberOf("retirement-runout"));
    expect(runout.zh).toBe("退休资金寿命推演");
  });
});
