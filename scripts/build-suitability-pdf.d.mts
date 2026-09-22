// Types for the plain-JS build script so bundle.test.ts can import it under
// `strict` without falling back to an implicit `any` module.
import type { BuildResult } from 'esbuild';

export declare const ENTRY: string;
export declare const OUTFILE: string;
export declare const EXTERNAL: string[];

/** Bundles the suitability PDF renderer. `write=false` returns the output in
 * memory (BuildResult.outputFiles) instead of writing to disk. */
export declare function buildSuitabilityPdfBundle(
  outfile?: string,
  write?: boolean,
): Promise<BuildResult>;
