// scripts/generate-proofs.ts
// npm run proofs → outputs filled PDFs to tmp/proofs/ for visual calibration against printed forms
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fillForm } from '../pdf/fillEngine';
import { samplePrsData } from '../pdf/sampleData';
import { buildDataForPdf } from '../pdf/generatePrsPack';
import type { FormMapping } from '../pdf/mappingTypes';
import { declarationMapping } from '../pdf/mappings/declaration';
import { ppaNominationMapping } from '../pdf/mappings/ppaNomination';
import { topUpMapping } from '../pdf/mappings/topUp';
import { isaIndividualMapping } from '../pdf/mappings/isaIndividual';
import { accOpeningMapping } from '../pdf/mappings/accOpening';

const mappings: FormMapping[] = [
  declarationMapping,
  ppaNominationMapping,
  topUpMapping,
  isaIndividualMapping,
  accOpeningMapping,
];

async function main() {
  mkdirSync('tmp/proofs', { recursive: true });
  const enriched = buildDataForPdf(samplePrsData);
  for (const m of mappings) {
    const tpl = readFileSync(`public/forms/prs/${m.templateFile}`);
    const { bytes, warnings } = await fillForm(tpl, m, enriched);
    writeFileSync(`tmp/proofs/${m.id}-proof.pdf`, bytes);
    console.log(`✓ tmp/proofs/${m.id}-proof.pdf${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
    warnings.forEach(w => console.log(`  ⚠ ${w}`));
  }
}
main();
