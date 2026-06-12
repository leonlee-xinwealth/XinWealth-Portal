// pdf/mappings/ppaNomination.ts
// PPA (Private Pension Administrator) Beneficiary Nomination Form.
// Template: public/forms/prs/ppa-nomination.pdf (2 pages, A4 595×842pt)
//
// Coordinates measured via scripts/extract_pdf_labels.py (bottom-left origin):
//   Page 1:
//     "NAME"             x=49.1  y=727.7  → fill x=120, y=727.7
//     "PPA ACCOUNT NO."  x=49.1  y=684.9  → plain text x=175, y=684.9
//     "MOBILE NO."       x=49.1  y=663.2  → fill x=130, y=663.2
//     "EMAIL ADDRESS"    x=49.1  y=641.6  → fill x=130, y=641.6
//     "Muslim" text      x=82.6  y=613.6  → checkbox x=70,  y=613.6
//     "Non-Muslim" text  x=82.6  y=599.6  → checkbox x=70,  y=599.6
//     NRIC in Part B sentence, inside "[  ]" starting x≈295, y=541.9
//     Nominee row 1 Name x=90.0  y=467.0  → fill x=120, y=467.0
//     Nominee row 2 Name x=90.0  y=418.4  → row spacing = 48.6
//     NRIC sub-row below Name: y=442.9 → offset = -24.1
//   Page 2 (FOR PRS CONSULTANT USE):
//     "Consultant Code:"  y=320.8 → fill x=155, y=320.8
//     "Consultant Name:"  y=308.2 → fill x=155, y=308.2
//     "Consultant NRIC:"  y=295.5 → fill x=155, y=295.5
//     "Consultant H/P No.:" y=282.8 → fill x=155, y=282.8
//     "Branch Name & Code:" y=257.8 → fill x=155, y=257.8
//     "Date:"             y=232.4 → fill x=95,  y=232.4
//
// Part C (member signature) and Part D (witness) are left blank for wet ink.

import type { FormMapping, MappedField } from '../mappingTypes';
import type { PrsFormData } from '../../types/prs';

// Nominee table constants (page 1):
//   Row 0 (first data row): Name at y=467.0
//   Row height (spacing between rows): 467.0 - 418.4 = 48.6
//   Each row has two sub-rows:
//     Top sub-row    (Name, Mobile, Percentage): y = ROW_0_Y - i * ROW_H
//     Bottom sub-row (NRIC, Email):             y = ROW_0_Y - i * ROW_H - 24.1
const NOMINEE_ROW_0_Y = 467.0; // y of row 1 Name/Mobile line
const NOMINEE_ROW_H   =  48.6; // vertical distance between successive rows
const NOMINEE_SUB_H   =  24.1; // offset from top sub-row to bottom sub-row (NRIC/Email)

const nomineeFields: MappedField[] = Array.from({ length: 6 }, (_, i) => {
  const yTop = NOMINEE_ROW_0_Y - i * NOMINEE_ROW_H;
  const yBot = yTop - NOMINEE_SUB_H;
  return [
    // Name — top sub-row, left column (after "Name :" label at x=90, ":"x=117)
    { key: `nominees.${i}.name`,       page: 0, x: 120, y: yTop, maxWidth: 170 } as MappedField,
    // NRIC — bottom sub-row, left column (after "NRIC No :" label ending ~x=130)
    { key: `nominees.${i}.nric`,       page: 0, x: 135, y: yBot, maxWidth: 155 } as MappedField,
    // Mobile — top sub-row, right column (after "Mobile :" label at x=298, ":"x=330)
    { key: `nominees.${i}.mobile`,     page: 0, x: 342, y: yTop, maxWidth: 165 } as MappedField,
    // Email — bottom sub-row, right column (after "Email :" label at x=298, ":"x=323)
    { key: `nominees.${i}.email`,      page: 0, x: 336, y: yBot, maxWidth: 165, uppercase: false } as MappedField,
    // Percentage — top sub-row, far right (column header PERCENT at x=512/524)
    { key: `nominees.${i}.percentage`, page: 0, x: 514, y: yTop, maxWidth:  40 } as MappedField,
  ];
}).flat();

export const ppaNominationMapping: FormMapping = {
  id: 'ppa-nomination',
  templateFile: 'ppa-nomination.pdf',
  labelEn: 'PPA Beneficiary Nomination',
  labelZh: 'PPA 受益人提名',
  version: 'v1',
  recommendedKeys: ['full_name', 'nric', 'religion_islam', 'nominees'],
  fields: [
    // ── Part A: Member Information ──────────────────────────────────────────
    // Full name (NAME label at y=727.7)
    { key: 'full_name',    page: 0, x: 120, y: 727.7, maxWidth: 380 },
    // PPA account number (plain text; field appears as a line, not comb cells)
    { key: 'ppa_account_no', page: 0, x: 175, y: 684.9, maxWidth: 340 },
    // Mobile number (MOBILE NO. label at y=663.2)
    { key: 'phone_mobile', page: 0, x: 130, y: 663.2, maxWidth: 180 },
    // Email address (EMAIL ADDRESS label at y=641.6)
    { key: 'email',        page: 0, x: 130, y: 641.6, maxWidth: 360, uppercase: false },
    // Religion checkboxes (tick mark "X")
    { type: 'checkbox', key: 'religion_islam', page: 0, x: 70, y: 613.6,
      when: (d: PrsFormData) => d.religion_islam === 'muslim' },
    { type: 'checkbox', key: 'religion_islam', page: 0, x: 70, y: 599.6,
      when: (d: PrsFormData) => d.religion_islam === 'non_muslim' },

    // ── Part B: NRIC inside the sentence ────────────────────────────────────
    // "I, the above-named member with NRIC/Passport number [ ___ - ___ - ___ ]"
    // The bracket "[" is at x=286.7, y=541.9; first dash at x=407.5
    { key: 'nric', page: 0, x: 295, y: 541.9, maxWidth: 200 },

    // ── Nominee table (6 rows) ───────────────────────────────────────────────
    ...nomineeFields,

    // ── Page 2: For PRS Consultant Use ──────────────────────────────────────
    { key: 'consultant_code',  page: 1, x: 155, y: 320.8, maxWidth: 135 },
    { key: 'consultant_name',  page: 1, x: 155, y: 308.2, maxWidth: 135 },
    { key: 'consultant_nric',  page: 1, x: 155, y: 295.5, maxWidth: 135 },
    { key: 'consultant_phone', page: 1, x: 155, y: 282.8, maxWidth: 135 },
    { key: 'branch_name_code', page: 1, x: 155, y: 257.8, maxWidth: 135 },
    // Consultant signature Date
    { key: 'sign_date',        page: 1, x:  95, y: 232.4, maxWidth: 195 },
  ],
};
