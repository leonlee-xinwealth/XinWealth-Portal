// Builds the developer-facing chart of accounts (docs/cfp-taxonomy.html) from
// the committed taxonomy bundle, so the page can never drift from what the
// portal, the Vercel functions and cfp-brain actually use.
//
//   node scripts/build-taxonomy-page.mjs            → docs/cfp-taxonomy.html
//   node scripts/build-taxonomy-page.mjs out.html   → a custom path
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const t = await import(new URL("../api/_lib/taxonomy.mjs", import.meta.url).href);

const POLICY_TYPES = ["life", "investment_linked", "medical", "critical_illness", "accident", "disability", "property", "other"];

const data = {
  groups: t.CASHFLOW_GROUPS,
  categories: t.CASHFLOW_CATEGORIES,
  assetClasses: t.ASSET_CLASSES,
  assetTypes: t.ASSET_TYPES,
  liabilityTypes: t.LIABILITY_TYPES,
  loanDefaults: t.LOAN_DEFAULTS,
  legacy: t.LEGACY_CATEGORY_MAP,
  premium: Object.fromEntries(POLICY_TYPES.map((p) => [p, t.premiumCategoryOf(p)])),
  quadrants: t.QUADRANTS,
  statutory: {
    EPF_EMPLOYEE_RATE: t.EPF_EMPLOYEE_RATE,
    EPF_EMPLOYER_RATE_LOW: t.EPF_EMPLOYER_RATE_LOW,
    EPF_EMPLOYER_RATE_HIGH: t.EPF_EMPLOYER_RATE_HIGH,
    EPF_EMPLOYER_WAGE_THRESHOLD: t.EPF_EMPLOYER_WAGE_THRESHOLD,
    EPF_EMPLOYEE_RATE_SENIOR: t.EPF_EMPLOYEE_RATE_SENIOR,
    EPF_EMPLOYER_RATE_SENIOR: t.EPF_EMPLOYER_RATE_SENIOR,
    SOCSO_EMPLOYEE_RATE: t.SOCSO_EMPLOYEE_RATE,
    EIS_EMPLOYEE_RATE: t.EIS_EMPLOYEE_RATE,
    SOCSO_EIS_WAGE_CEILING: t.SOCSO_EIS_WAGE_CEILING,
    STATUTORY_SENIOR_AGE: t.STATUTORY_SENIOR_AGE,
  },
};

const template = fs.readFileSync(path.join(here, "taxonomy-page", "template.html"), "utf8");
if (!template.includes("/*DATA*/")) throw new Error("template is missing the /*DATA*/ placeholder");
// `<` is escaped so a label can never close the inline <script>.
const html = template.replace("/*DATA*/", JSON.stringify(data).replace(/</g, "\u003c"));

const out = path.resolve(root, process.argv[2] ?? "docs/cfp-taxonomy.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(root, out)} (${data.categories.length} categories, ${data.assetTypes.length} asset types, ${data.liabilityTypes.length} liability types)`);
