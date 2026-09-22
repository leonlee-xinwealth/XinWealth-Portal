// Pre-bundles supabase/functions/_shared/taxonomy/** into api/_lib/taxonomy.mjs.
//
// WHY: api/*.js are plain-JS Vercel functions. @vercel/node transpiles .ts files
// it traces from .ts entries, but a .js entry importing .ts is not a path we
// have proven to ship (see scripts/simulate-vercel-function.mjs). One
// self-contained ESM file with no relative imports leaves nothing to miss.
//
// The output is COMMITTED; scripts/__tests__/taxonomyBundle.test.ts rebuilds it
// in memory and fails if the committed file has drifted from source.
//
// Usage: node scripts/build-taxonomy.mjs [outfile]
import { build } from "esbuild";

export const ENTRY = "supabase/functions/_shared/taxonomy/index.ts";
export const OUTFILE = "api/_lib/taxonomy.mjs";

export async function buildTaxonomyBundle(outfile = OUTFILE, write = true) {
  return build({
    entryPoints: [ENTRY],
    outfile,
    bundle: true,
    write,
    format: "esm",
    platform: "node",
    target: "node18",
    legalComments: "none",
    banner: {
      js:
        "// GENERATED FILE — do not edit.\n" +
        "// Source: supabase/functions/_shared/taxonomy/** (entry: index.ts)\n" +
        "// Rebuild: node scripts/build-taxonomy.mjs\n" +
        "// Committed so the plain-JS Vercel functions share the chart of accounts.",
    },
  });
}

// pathToFileURL, not string concatenation: on Windows the path contains
// backslashes and percent-encoded spaces.
const { pathToFileURL } = await import("node:url");
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2] || OUTFILE;
  await buildTaxonomyBundle(out);
  const { statSync } = await import("node:fs");
  console.log(`wrote ${out} (${statSync(out).size} bytes)`);
}
