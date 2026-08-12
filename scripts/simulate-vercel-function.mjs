// Faithfully simulates how @vercel/node builds a TypeScript serverless function:
// TRANSPILE each file in place (no bundling, import specifiers preserved), then
// load the entrypoint with real Node ESM resolution.
//
// This exists because `esbuild --bundle` does NOT reproduce Vercel's behaviour —
// bundling rewrites every specifier, so it hides the ERR_MODULE_NOT_FOUND that
// extensionless relative imports cause in a `"type": "module"` package at
// runtime. That exact gap shipped a broken /api/suitability to production once.
//
// Usage: node scripts/simulate-vercel-function.mjs [api/suitability.ts]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const entry = process.argv[2] || "api/suitability.ts";
const OUT = ".simbuild";

fs.rmSync(OUT, { recursive: true, force: true });

// Transpile the whole server-reachable surface, mirroring the source tree.
const sources = [
  "api/suitability.ts",
  "lib/suitability/types.ts",
  "lib/suitability/questions.ts",
  "lib/suitability/rules.ts",
  "lib/suitability/scoring.ts",
  "pdf/cjkWrap.ts",
  "pdf/insuranceReport/fonts.ts",
  "pdf/insuranceReport/theme.ts",
  "pdf/suitabilityReport/model.ts",
  "pdf/suitabilityReport/renderNode.ts",
  "pdf/suitabilityReport/SuitabilityReportPdf.tsx",
];

execFileSync(
  "npx",
  [
    "esbuild",
    ...sources,
    `--outdir=${OUT}`,
    "--outbase=.",
    "--format=esm",
    "--platform=node",
    "--target=node18",
    "--jsx=automatic",
    "--log-level=warning",
  ],
  { stdio: "inherit", shell: true },
);

// Vercel ships the plain-.js helpers as-is.
fs.mkdirSync(path.join(OUT, "api/_lib"), { recursive: true });
for (const f of fs.readdirSync("api/_lib")) {
  if (f.endsWith(".js")) fs.copyFileSync(path.join("api/_lib", f), path.join(OUT, "api/_lib", f));
}
// Same module system as the real runtime.
fs.writeFileSync(path.join(OUT, "package.json"), JSON.stringify({ type: "module" }, null, 2));

const target = path.join(OUT, entry.replace(/\.tsx?$/, ".js"));
console.log(`\nloading ${target} with Node ESM resolution...`);

const probe = `
import(${JSON.stringify("./" + target.split(path.sep).join("/"))})
  .then(m => {
    console.log('MODULE LOADED OK. default export is', typeof m.default);
    process.exit(typeof m.default === 'function' ? 0 : 1);
  })
  .catch(e => {
    console.error('MODULE LOAD FAILED:', e.code || '', e.message);
    if (e.url) console.error('  unresolved url:', e.url);
    process.exit(1);
  });
`;
execFileSync("node", ["--input-type=module", "-e", probe], { stdio: "inherit" });
