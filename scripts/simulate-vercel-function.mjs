// Faithfully simulates how @vercel/node builds a TypeScript serverless function,
// so runtime-only failures are caught before a deploy instead of after one.
//
// Vercel does NOT bundle. It walks the STATIC import graph with @vercel/nft,
// transpiles each file in place (specifiers preserved), and ships the tree. Two
// classes of bug follow from that, and both shipped broken functions once:
//
//   1. RESOLUTION — package.json is `"type": "module"`, so Node's ESM resolver
//      needs a real file extension. Extensionless relative imports work under
//      Vite / vitest / tsx and throw ERR_MODULE_NOT_FOUND in the function.
//
//   2. INCLUSION — a build-time tracer only follows STATIC imports. A dynamic
//      `await import("./X.js")` where only X.tsx exists on disk cannot be
//      resolved at build time, so X is never shipped and the render fails.
//
// This script reproduces both: it DISCOVERS the graph by following static
// imports from the entrypoint (never dynamic ones — that is the point),
// transpiles only what it found, then loads the entrypoint with real Node ESM
// resolution. `esbuild --bundle` cannot surface either bug, because bundling
// rewrites every specifier and inlines everything it can see.
//
// Usage: node scripts/simulate-vercel-function.mjs [api/suitability.ts]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const entry = (process.argv[2] || "api/suitability.ts").replace(/\\/g, "/");
const OUT = ".simbuild";

/** Resolve a relative specifier to a real source file, mirroring TS's .js -> .ts mapping. */
function resolveSource(fromFile, spec) {
  const base = path.posix.join(path.posix.dirname(fromFile), spec);
  const candidates = base.endsWith(".js")
    ? [base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx"), base]
    : [`${base}.ts`, `${base}.tsx`, base, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

// Only STATIC imports/exports. Dynamic import() is deliberately NOT matched —
// reproducing the tracer's blindness to it is the whole point of this script.
// Matching on the `from` clause rather than the statement head keeps multi-line
// `import {\n  A,\n  B,\n} from "./x.js"` blocks in the graph; an earlier
// line-bounded regex silently dropped them and reported a false failure.
// `import("./x")` has no `from`, so it stays correctly invisible here.
const STATIC_IMPORT = /\bfrom\s*["']([^"']+)["']/g;
const BARE_IMPORT = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;

// A relative dynamic import is invisible to the build-time tracer, so its target
// never ships. Loading the entrypoint does NOT surface this (the import only
// runs when the code path executes), so we flag it statically instead.
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

const found = new Set();
const missing = [];
const dynamic = [];

/**
 * Strip comments before scanning. Without this, prose in a comment that mentions
 * `import("./X.js")` — for example the note explaining this very rule — is
 * reported as a real dependency.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

function walk(file) {
  if (found.has(file)) return;
  found.add(file);
  if (!/\.tsx?$/.test(file)) return; // plain .js helpers ship as-is
  const src = stripComments(fs.readFileSync(file, "utf8"));
  for (const re of [STATIC_IMPORT, BARE_IMPORT]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue; // node builtins + npm deps
      const target = resolveSource(file, spec);
      if (target) walk(target);
      else missing.push({ from: file, spec });
    }
  }
  DYNAMIC_IMPORT.lastIndex = 0;
  let d;
  while ((d = DYNAMIC_IMPORT.exec(src))) {
    if (d[1].startsWith(".")) dynamic.push({ from: file, spec: d[1] });
  }
}

walk(entry);

const tsSources = [...found].filter((f) => /\.tsx?$/.test(f));
const jsSources = [...found].filter((f) => f.endsWith(".js"));

console.log(`static graph from ${entry}: ${tsSources.length} TS/TSX + ${jsSources.length} JS files`);
if (missing.length) {
  console.error("\nUNRESOLVED STATIC IMPORTS (these would break the deployed function):");
  for (const m of missing) console.error(`  ${m.from} -> ${m.spec}`);
  process.exit(1);
}
if (dynamic.length) {
  console.error(
    "\nRELATIVE DYNAMIC IMPORTS — @vercel/nft cannot trace these at build time,\n" +
      "so the target is never shipped and the render fails at runtime with\n" +
      "ERR_MODULE_NOT_FOUND. Make them static imports:",
  );
  for (const d of dynamic) console.error(`  ${d.from} -> import("${d.spec}")`);
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
execFileSync(
  "npx",
  [
    "esbuild",
    ...tsSources,
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

// Plain-.js helpers are shipped verbatim by Vercel.
for (const f of jsSources) {
  const dest = path.join(OUT, f);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(f, dest);
}
fs.writeFileSync(path.join(OUT, "package.json"), JSON.stringify({ type: "module" }, null, 2));

const target = `./${OUT}/${entry.replace(/\.tsx?$/, ".js")}`;
console.log(`\nloading ${target} with real Node ESM resolution...`);

const probe = `
import(${JSON.stringify(target)})
  .then(m => {
    if (typeof m.default !== 'function') { console.error('NO DEFAULT EXPORT'); process.exit(1); }
    console.log('MODULE LOADED OK — handler is a function');
    process.exit(0);
  })
  .catch(e => {
    console.error('MODULE LOAD FAILED:', e.code || '', e.message);
    if (e.url) console.error('  unresolved url:', e.url);
    process.exit(1);
  });
`;
execFileSync("node", ["--input-type=module", "-e", probe], { stdio: "inherit" });
