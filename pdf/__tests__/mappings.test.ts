// pdf/__tests__/mappings.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import type { FormMapping } from '../mappingTypes';
import { initialPrsFormData } from '../../types/prs';
import { declarationMapping } from '../mappings/declaration';

// Tasks 7-10 will append: ppaNominationMapping, topUpMapping, isaIndividualMapping, accOpeningMapping
const ALL_MAPPINGS: FormMapping[] = [declarationMapping];

describe.each(ALL_MAPPINGS.map(m => [m.id, m] as const))('mapping %s', (_id, mapping) => {
  it('all field keys root segment exists in PrsFormData', () => {
    const validRoots = new Set(Object.keys(initialPrsFormData));
    for (const f of mapping.fields) {
      expect(validRoots.has(f.key.split('.')[0]), `invalid key: ${f.key}`).toBe(true);
    }
  });

  it('all coordinates are within page bounds', async () => {
    const bytes = readFileSync(`public/forms/prs/${mapping.templateFile}`);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = doc.getPages();
    for (const f of mapping.fields) {
      const page = pages[f.page];
      expect(page, `${f.key}: page ${f.page} does not exist`).toBeDefined();
      const { width, height } = page.getSize();
      expect(f.x >= 0 && f.x <= width, `${f.key}: x=${f.x} out of page width ${width}`).toBe(true);
      expect(f.y >= 0 && f.y <= height, `${f.key}: y=${f.y} out of page height ${height}`).toBe(true);
    }
  });

  it('recommendedKeys are all valid keys', () => {
    const validRoots = new Set(Object.keys(initialPrsFormData));
    for (const k of mapping.recommendedKeys) {
      expect(validRoots.has(k.split('.')[0]), `invalid recommendedKey: ${k}`).toBe(true);
    }
  });
});
