// scripts/generate-proofs.ts
// npm run proofs → outputs filled PDFs to tmp/proofs/ for visual calibration against printed forms
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fillForm } from '../pdf/fillEngine';
import { samplePrsData } from '../pdf/sampleData';
import type { FormMapping } from '../pdf/mappingTypes';
import { declarationMapping } from '../pdf/mappings/declaration';
import { ppaNominationMapping } from '../pdf/mappings/ppaNomination';
// Tasks 8-10 will append imports and add to array
const mappings: FormMapping[] = [declarationMapping, ppaNominationMapping];

async function main() {
  mkdirSync('tmp/proofs', { recursive: true });
  for (const m of mappings) {
    const tpl = readFileSync(`public/forms/prs/${m.templateFile}`);
    const { bytes, warnings } = await fillForm(tpl, m, samplePrsData);
    writeFileSync(`tmp/proofs/${m.id}-proof.pdf`, bytes);
    console.log(`✓ tmp/proofs/${m.id}-proof.pdf${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
    warnings.forEach(w => console.log(`  ⚠ ${w}`));
  }
}
main();
