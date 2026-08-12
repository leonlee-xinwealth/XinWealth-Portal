// Pre-bundles the suitability PDF renderer into api/_lib/suitabilityPdf.mjs.
//
// WHY THIS EXISTS
// @vercel/node builds a function by walking the static import graph and
// transpiling each file in place. It handles .ts fine — lib/suitability/*.ts
// ships correctly — but it does NOT emit .tsx dependencies, so
// SuitabilityReportPdf.tsx was traced yet never written as .js and every
// invocation died with:
//
//   ERR_MODULE_NOT_FOUND: Cannot find module
//   '/var/task/pdf/suitabilityReport/SuitabilityReportPdf.js'
//
// Bundling the JSX subtree ourselves removes Vercel's transpiler from the path
// entirely: the output is one self-contained ESM file with no relative imports,
// so there is nothing left for the tracer to miss.
//
// react and @react-pdf/renderer stay EXTERNAL — they are real dependencies that
// Vercel installs, and nft resolves bare specifiers from node_modules without
// trouble. Keeping them external also keeps this artifact small and reviewable.
//
// The output is COMMITTED, and pdf/suitabilityReport/__tests__/bundle.test.ts
// re-runs this script and fails if the committed file has drifted from source.
//
// Usage: node scripts/build-suitability-pdf.mjs [outfile]
import { build } from "esbuild";

export const ENTRY = "pdf/suitabilityReport/renderNode.ts";
export const OUTFILE = "api/_lib/suitabilityPdf.mjs";
export const EXTERNAL = ["react", "react/jsx-runtime", "@react-pdf/renderer"];

export async function buildSuitabilityPdfBundle(outfile = OUTFILE, write = true) {
  const result = await build({
    entryPoints: [ENTRY],
    outfile,
    bundle: true,
    write,
    format: "esm",
    platform: "node",
    target: "node18",
    jsx: "automatic",
    external: EXTERNAL,
    legalComments: "none",
    banner: {
      js:
        "// GENERATED FILE — do not edit.\n" +
        "// Source: pdf/suitabilityReport/** (entry: renderNode.ts)\n" +
        "// Rebuild: node scripts/build-suitability-pdf.mjs\n" +
        "// Committed because @vercel/node does not emit .tsx dependencies.",
    },
  });
  return result;
}

// pathToFileURL, not string concatenation: on Windows the path contains
// backslashes and percent-encoded spaces, so a naive `file://${argv[1]}` never
// matches import.meta.url and the script silently does nothing.
const { pathToFileURL } = await import("node:url");
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2] || OUTFILE;
  await buildSuitabilityPdfBundle(out);
  const { statSync } = await import("node:fs");
  console.log(`wrote ${out} (${statSync(out).size} bytes)`);
}
