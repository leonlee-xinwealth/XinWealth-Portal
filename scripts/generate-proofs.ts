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
import { accOpeningMapping, FUND_ORDER } from '../pdf/mappings/accOpening';
import { isaTotalScore } from '../types/prs';

const mappings: FormMapping[] = [declarationMapping, ppaNominationMapping, topUpMapping, isaIndividualMapping, accOpeningMapping];

// Augmented data for ISA proof: inject computed __isa_total so it renders in the TOTAL field
const isaProofData = { ...samplePrsData, __isa_total: String(isaTotalScore(samplePrsData) ?? '') };

// Augmented data for acc-opening proof: inject sample __dim_pct_* keys for the DIM fund table.
// In production, buildDataForPdf (Task 11) will derive these from dim_allocations.
// For the proof we put '100' into the first fund (Principal RetireEasy 2060) as a sanity check.
const accOpeningProofData: Record<string, unknown> = { ...samplePrsData };
FUND_ORDER.forEach((slug, i) => {
  accOpeningProofData[`__dim_pct_${slug}`] = i === 0 ? '100' : '';
});

async function main() {
  mkdirSync('tmp/proofs', { recursive: true });
  for (const m of mappings) {
    const tpl = readFileSync(`public/forms/prs/${m.templateFile}`);
    let data: Record<string, unknown>;
    if (m.id === 'isa-individual') data = isaProofData as Record<string, unknown>;
    else if (m.id === 'acc-opening') data = accOpeningProofData;
    else data = samplePrsData as unknown as Record<string, unknown>;
    const { bytes, warnings } = await fillForm(tpl, m, data as typeof samplePrsData);
    writeFileSync(`tmp/proofs/${m.id}-proof.pdf`, bytes);
    console.log(`✓ tmp/proofs/${m.id}-proof.pdf${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
    warnings.forEach(w => console.log(`  ⚠ ${w}`));
  }
}
main();
