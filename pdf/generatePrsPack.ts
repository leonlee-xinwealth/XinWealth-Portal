// pdf/generatePrsPack.ts
// Print pack generation: derived field injection + multi-form merge.
import { PDFDocument } from 'pdf-lib';
import type { FormMapping } from './mappingTypes';
import type { PrsFormData } from '../types/prs';
import { isaTotalScore } from '../types/prs';
import { fillForm, type FillResult } from './fillEngine';
import { fetchTemplate } from './prsTemplates';
import { accOpeningMapping } from './mappings/accOpening';
import { isaIndividualMapping } from './mappings/isaIndividual';
import { ppaNominationMapping } from './mappings/ppaNomination';
import { declarationMapping } from './mappings/declaration';
import { topUpMapping } from './mappings/topUp';

export const ALL_PRS_MAPPINGS: FormMapping[] = [
  accOpeningMapping,
  isaIndividualMapping,
  ppaNominationMapping,
  declarationMapping,
  topUpMapping,
];

/** Convert a fund display name into the snake_case slug used as a key suffix. */
export function fundSlug(fund: string): string {
  return fund.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Enrich raw PrsFormData with derived synthetic keys before passing to fillForm:
 *   __isa_total         — sum of ISA Part 3 scores (string)
 *   __dim_pct_<slug>    — DIM fund allocation percentages keyed by fund slug
 */
export function buildDataForPdf(data: PrsFormData): PrsFormData {
  const derived: Record<string, string> = {
    __isa_total: String(isaTotalScore(data) ?? ''),
  };
  for (const a of data.dim_allocations) {
    if (a.fund && a.percent) {
      derived[`__dim_pct_${fundSlug(a.fund)}`] = a.percent;
    }
  }
  return { ...data, ...derived } as PrsFormData;
}

export interface GeneratedForm extends FillResult {
  mapping: FormMapping;
}

/** Fill a single form using the browser fetch path (client-side use). */
export async function generateOne(mapping: FormMapping, data: PrsFormData): Promise<GeneratedForm> {
  const tpl = await fetchTemplate(mapping);
  const result = await fillForm(tpl, mapping, buildDataForPdf(data));
  return { ...result, mapping };
}

/** Merge an array of filled PDF byte arrays into a single PDF, in order. */
export async function mergePdfs(all: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of all) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(p => out.addPage(p));
  }
  return out.save();
}

/**
 * Generate all 5 PRS forms and merge into one download-ready PDF.
 * All forms use buildDataForPdf enrichment automatically.
 */
export async function generatePack(data: PrsFormData): Promise<{ bytes: Uint8Array; warnings: string[] }> {
  const results = await Promise.all(ALL_PRS_MAPPINGS.map(m => generateOne(m, data)));
  const bytes = await mergePdfs(results.map(r => r.bytes));
  return { bytes, warnings: results.flatMap(r => r.warnings) };
}

/** Trigger a browser download of the merged PDF. */
export function downloadBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Return the recommended keys that are missing from data, grouped by form.
 * Used to show a preflight warning UI before generating the pack.
 */
export function missingFields(data: PrsFormData): { mapping: FormMapping; keys: string[] }[] {
  return ALL_PRS_MAPPINGS
    .map(mapping => ({
      mapping,
      keys: mapping.recommendedKeys.filter(k => {
        const v = (data as any)[k.split('.')[0]];
        if (Array.isArray(v)) return v.every(item => !item || Object.values(item).every(x => !x));
        return !v;
      }),
    }))
    .filter(g => g.keys.length > 0);
}
