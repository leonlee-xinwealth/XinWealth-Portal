import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CFP_SECTION_ORDER, SECTION_META } from '../sectionMeta';
import { RENDERERS } from '../renderers';

// The eight sections are declared in three places that must agree, and nothing
// has ever checked that they do:
//
//   supabase/functions/cfp-brain/types.ts  SECTION_ORDER — the order the
//       deterministic modules run in, which is a real dependency chain
//       (goals feed the insurance CNA, insurance feeds tax).
//   components/advisor/cfp/sectionMeta.ts  CFP_SECTION_ORDER — the order the
//       advisor generates and reviews in, and the order 一键生成 fires in.
//   components/advisor/cfp/renderers/index.ts + SECTION_META — what the
//       review UI can actually display.
//
// If the UI order stopped matching the module order, 一键生成 would generate a
// section before the one it depends on. The result is not an error: it is a
// section narrated against last run's numbers, which is the failure mode this
// whole review pipeline exists to prevent.
//
// The server list is read as text rather than imported: it lives in a Deno
// module tree with .ts import specifiers that this test runner does not
// resolve. Parsing is the cheap way to have the check at all.
function serverSectionOrder(): string[] {
  const file = path.resolve(__dirname, '../../../../supabase/functions/cfp-brain/types.ts');
  const src = readFileSync(file, 'utf8');
  const block = src.match(/export const SECTION_ORDER: SectionType\[\] = \[([\s\S]*?)\];/);
  if (!block) throw new Error('SECTION_ORDER not found in cfp-brain/types.ts');
  return [...block[1].matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
}

describe('the eight sections agree across the client and the server', () => {
  it('generates and reviews in the same order the modules compute in', () => {
    expect(serverSectionOrder()).toEqual([...CFP_SECTION_ORDER]);
  });

  it('can display every section it asks the advisor to review', () => {
    // A section in the order with no renderer shows raw JSON on the review
    // page, which nobody can meaningfully approve — and the export gate would
    // still demand an approval for it.
    for (const s of CFP_SECTION_ORDER) {
      expect(SECTION_META[s], `${s} has no metadata`).toBeTruthy();
      expect(RENDERERS[s], `${s} has no renderer`).toBeTruthy();
    }
  });
});
