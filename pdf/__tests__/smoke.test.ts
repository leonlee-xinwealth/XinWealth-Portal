import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

describe('pdf-lib 能加载全部模板', () => {
  for (const f of ['acc-opening', 'isa-individual', 'ppa-nomination', 'declaration', 'top-up']) {
    it(f, async () => {
      const bytes = readFileSync(`public/forms/prs/${f}.pdf`);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      // Verify file exists and has content
      expect(doc).toBeDefined();
      expect(bytes.length).toBeGreaterThan(0);
    });
  }
});
