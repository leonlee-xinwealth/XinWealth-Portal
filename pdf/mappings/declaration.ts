// pdf/mappings/declaration.ts
import type { FormMapping } from '../mappingTypes';

// PMB Declaration Form — fills page 2 signing section only.
// Signature fields left blank for wet ink.
//
// Coordinates measured via scripts/extract_pdf_labels.py on declaration.pdf page 2
// (A4 595x842pt, pdf-lib bottom-origin):
//   "Name:"    x=47.3  y=414.4  → fill x=85,  y=414.4
//   "NRIC No:" x=47.3  y=399.8  → fill x=100, y=399.8
//   "Date:"    x=47.3  y=385.4  → fill x=80,  y=385.4
export const declarationMapping: FormMapping = {
  id: 'declaration',
  templateFile: 'declaration.pdf',
  labelEn: 'PMB Declaration Form',
  labelZh: 'PMB 声明表',
  version: 'Version 3.0 May 2024',
  recommendedKeys: ['full_name', 'nric', 'sign_date'],
  fields: [
    { key: 'full_name', page: 1, x: 85,  y: 414.4, maxWidth: 220 },
    { key: 'nric',      page: 1, x: 100, y: 399.8, maxWidth: 160 },
    { key: 'sign_date', page: 1, x: 80,  y: 385.4 },
  ],
};
