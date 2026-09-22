// The page components the showcase renders, in order.
//
// Kept in its own module so __tests__/pageCount.test.ts can import the list
// without pulling in showcase.tsx, which registers fonts and renders a PDF at
// module scope. Now that the showcase covers the whole template this mirrors
// registry.ts's PAGE_ORDER exactly, and registry.test.ts asserts they agree.

export const SHOWCASE_PAGE_IDS = [
  "cover",
  "toc",
  "disclaimer",
  "exec-summary",
  "profile",
  "cashflow-overview",
  "cashflow-detail",
  "balance-overview",
  "assets-detail",
  "liabilities-detail",
  "ratios-1",
  "ratios-2",
  "insights",
  "insurance-concept",
  "insurance-gap",
  "insurance-plan",
  "estate-concept",
  "estate-findings",
  "estate-plan",
  "suitability",
  "portfolio",
  "retirement-vision",
  "retirement-runout",
  "retirement-plan",
  "tax-findings",
  "tax-plan",
  "goals-timeline",
  "goals-funding",
  "back-cover",
] as const;
