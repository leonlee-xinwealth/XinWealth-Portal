// scripts/generate-proofs.ts
// npm run proofs → outputs filled PDFs to tmp/proofs/ for visual calibration against printed forms
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fillForm } from '../pdf/fillEngine';
import { samplePrsData } from '../pdf/sampleData';
import type { FormMapping } from '../pdf/mappingTypes';
import { declarationMapping } from '../pdf/mappings/declaration';
import { ppaNominationMapping } from '../pdf/mappings/ppaNomination';
import { topUpMapping } from '../pdf/mappings/topUp';
import { isaIndividualMapping } from '../pdf/mappings/isaIndividual';
import { isaTotalScore } from '../types/prs';
// Task 10 will append: accOpeningMapping
const mappings: FormMapping[] = [declarationMapping, ppaNominationMapping, topUpMapping, isaIndividualMapping];

// Augmented data for ISA proof: inject computed __isa_total so it renders in the TOTAL field
const isaProofData = { ...samplePrsData, __isa_total: String(isaTotalScore(samplePrsData) ?? '') };

async function main() {
  mkdirSync('tmp/proofs', { recursive: true });
  for (const m of mappings) {
    const tpl = readFileSync(`public/forms/prs/${m.templateFile}`);
    const data = m.id === 'isa-individual' ? isaProofData : samplePrsData;
    const { bytes, warnings } = await fillForm(tpl, m, data as typeof samplePrsData);
    writeFileSync(`tmp/proofs/${m.id}-proof.pdf`, bytes);
    console.log(`✓ tmp/proofs/${m.id}-proof.pdf${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
    warnings.forEach(w => console.log(`  ⚠ ${w}`));
  }
}
main();
