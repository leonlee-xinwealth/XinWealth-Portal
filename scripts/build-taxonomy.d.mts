// Types for the plain-JS build script so taxonomyBundle.test.ts can import it
// under `strict` without falling back to an implicit `any` module.
import type { BuildResult } from 'esbuild';

export declare const ENTRY: string;
export declare const OUTFILE: string;

/** Bundles the taxonomy for the Vercel functions. `write=false` returns the
 * output in memory (BuildResult.outputFiles) instead of writing to disk. */
export declare function buildTaxonomyBundle(
  outfile?: string,
  write?: boolean,
): Promise<BuildResult>;
