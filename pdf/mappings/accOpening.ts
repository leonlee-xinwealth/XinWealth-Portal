// pdf/mappings/accOpening.ts
// PRS Account Opening Form
// Template: public/forms/prs/acc-opening.pdf (12 pages, A4 595×842pt)
// Version: Version Jan-2026
//
// Coordinates extracted via scripts/extract_pdf_labels.py + pdfplumber rect/char analysis.
// pdf-lib coordinate origin is bottom-left; page H=842pt, W=595pt.
//
// We map pages 1, 2, 3, 7 only (0-based: indices 0, 1, 2, 6).
// Pages 4-6 are terms. Pages 8-12 are appendix/signatures (left blank for wet ink).
//
// ── Page 1 (index 0) ─────────────────────────────────────────────────────────
//   Applicant Type checkboxes: 'Personal' at x≈75.4/y=696.1, 'Employee' at x≈75.4/y=696.1
//     - Small boxes (12x11): Personal x=75.4 y=696.1; Employee x=111.7 y=696.1
//   PPA Member: New x=75.4 y=733.1; Existing x=111.7 y=733.1
//   Employer PRS contract no: underline starting ~x=342 y=690
//   PPA Account No: '___' after 'P P A' label x=307.7 y=680.5 → fill x=345 y=681
//   NRIC: comb 12 cells starting x=63.8 y=641.6, cellWidth=12.0
//   DOB: D D / M M / Y Y Y Y at x=441,453,477,489,515,528,541,553 y=641.6
//   Other ID type: Old IC x=63.8, Police x=99.7, Army x=135.7, Passport x=171.6 — all y=607.8
//   Other ID No: label at x=200.6 y=606.2 → fill x=253 y=607
//   Passport Country: label at x=370.8 y=605.2 → fill x=456 y=605
//   Passport Expiry: D D / M M / Y Y Y Y at x=441,453 y=625.2 (base)
//   Salutation: Mr=x=75.8, Mrs=x=111.7, Ms=x=147.7 — all y=508
//   Full Name: label y=511.1 → fill x=200 y=508
//   DOB (salutation row): date-split same as NRIC row
//   Gender: Male x=75.8, Female x=111.7 — y=547
//   Race: Bumiputera x=183.6, Chinese x=219.5, Indian x=255.5, Others x=291.4 — y=547
//   Nationality: Malaysian x=75.8 y=528; Others x=111.7 y=528
//   Marital Status: Single x=339.3, Married x=375.3, Widowed x=411.2, Divorced x=447.1 — y=528
//   Mother's Maiden Name: label ends ~x=152 → fill x=153 y=390
//   Occupation: 2 rows of checkboxes y=464.7 and y=439.5
//     Row 1: Retiree x=75.0, Housewife x=123.4, Self-Employed x=163.0, Professional x=255.7,
//            Skilled Worker x=315.7, Government x=387.9 — y=464.7 (approx; labels at y≈459.6)
//     Actually from rect analysis: occupation checkboxes (12x11) y=439.5:
//       x=75.0, 123.4, 163.0, 255.7, 315.7, 387.9 (and more on row below)
//     Revised from words: occupation section at y~464.7 first row, y~439.5 second row
//   Nature of Occupation: 2 rows y=405.6 and y=391.0
//     Row 1: Agriculture x=75.0, Finance x=163.0, Construction x=255.7, Mining x=315.7,
//            Transport x=387.9 — y=424.3 (approx)
//     Row 2: Trading x=75.0, Electricity x=163.0, Manufacturing x=255.7, Education x=315.7,
//            Others x=387.9 — y=405.6
//   Employer Name: fill x=100 y=363.9
//   Staff No: fill x=215 y=336.4
//   Employment Date: D/M/Y cells at x=441,453 y=343.9
//   Monthly Income brackets: 5 on row 1 (y≈490.2), 5 on row 2 (y≈464.7) from rects
//     Row 1 (y=490.2): x=27.9, 63.8, 111.7, 159.6, 219.5 (→ up_to_1500 through 8001_15000)
//     Row 2 (y=464.7): x=75.8, 123.7, 171.6, 219.5, 267.4 — actually from word labels:
//       Up to 1500: x≈75.8 y=490.2; 1501-3000: x≈159.6; 3001-5000: x≈243.5; 5001-8000: x≈327.3
//       8001-15000: x≈411.2 all y=490.2
//     Row 2 (y=464.7): 15001-20000: x≈75.8, 20001-50000: x≈147.7, 50001-100000: x≈219.5,
//       100001-200000: x≈291.4, >200000: x≈363.3
//   Corr Address: fill x=28 y=310.6
//   Corr Postcode: fill x=28 y=281.5
//   Corr City: fill x=175 y=281.5
//   Corr State: fill x=28 y=263.5
//   Corr Country: fill x=285 y=263.5
//   Perm same as Corr: checkbox x=68.4 y=244.5
//   Perm Address: fill x=28 y=227.8
//   Perm Postcode: fill x=28 y=191.1
//   Perm City: fill x=175 y=191.1
//   Perm State: fill x=28 y=173.2
//   Perm Country: fill x=285 y=173.2
//   Tel House: fill x=112 y=157.6
//   Tel Office: fill x=345 y=157.6
//   Tel Mobile: fill x=112 y=139.3
//   Email: fill x=65 y=118.5
//
// ── Page 2 (index 1) ─────────────────────────────────────────────────────────
//   Purpose: Investment x=28.6 y=721.5; Retirement x=104.2 y=721.5;
//            Protection x=169.1 y=721.5; Others x=229.2 y=721.5
//   Purpose other text: after 'Specify' at x~306 → fill x=320 y=721.5
//   Source of Funds: Employment x=104.2 y=707.8; Sales of Assets x=169.1;
//     Inheritance x=230.0; Savings x=282.2; Business x=327.2; Others x=373.4 — y=707.8
//     (from rects: 10x10 boxes at y=142.1)
//   PEP Yes x=470.3 y=693.6; No x=502.8 y=693.6
//   Contribution Amount: fill x=134 y=573.9
//   Cheque No: fill x=360 y=573.9
//   RSP checkbox: x=34.4 y=551.5
//   RSP Bank: fill x=65 y=534.4
//   RSP Bank Account No: fill x=65 y=519.5
//   RSP Deduction Day: fill x=415 y=519.5
//   RSP Amount: fill x=448 y=519.5
//   EPF % checkboxes at y=465.5: 1%=x=50.9, 2%=x=98.9, 3%=x=146.9, 4%=x=194.9,
//     5%=x=242.9, 6%=x=290.9, 7%=x=338.9
//   Salary Deduction %: fill x=65 y=427.2
//   Salary Deduction RM: fill x=298 y=427.2
//   Contribution Direction: Do-It-For-Me x=34.4 y=297.0; Do-It-Myself x=34.4 y=256.3
//   DIFM PRS Plus scheme: x=92.8 y=221.3; Islamic PRS Plus: x=174.1 y=221.3
//   DIM fund % fields: left col x~155, right col x~388 — rows y=236/222/209/195/181/168/154/141/127/113
//
// ── Page 3 (index 2) ─────────────────────────────────────────────────────────
//   Consultant/Staff Code: fill x=100 y=276.0
//   Branch Name & Code: fill x=100 y=217.0
//   Distributor Code: fill x=393 y=143.1
//   Channel: PRS Consultant x=361.0 y=208.6; Corporate PRS Distributor x=249.0 y=208.6;
//            Institutional PRS Adviser x=361.0 y=190.2 (from rects at y=411.0)
//     Actually rect at y=411.0 two checkboxes x=249.0, x=361.0
//     and more channel words at y=207.6 PRS Consultant, y=172.4 Corporate PRS Distributor, y=190.2 Institutional
//   Class for Application A=x=113 y=121.2; X=x=148; C=x=180
//   Date (client): D D cells at x=56.1, 68.6, 92.3, 104.8, 130.6, 143.6, 156.3, 167.9 y=101.3
//
// ── Page 7 (index 6) ─────────────────────────────────────────────────────────
//   Full Name: label y=684.9 → fill x=110 y=685
//   Mailing/Corr Address: label y=642.3 → fill x=110 y=643
//   Postal Code/Zip: label y=577.6 → fill x=110 y=577 (left half)
//   Country (corr): label x=261.2 y=586.5 → fill x=305 y=577
//   Permanent Address: label y=554.7 → fill x=120 y=555
//   Perm Postal Code: fill x=110 y=489
//   Perm Country: fill x=305 y=489
//   DOB: label y=476.9 → fill x=160 y=467
//   Place of Birth: label x=261.2 y=476.9 → fill x=342 y=467
//   Country of Birth: fill x=342 y=457
//   Email: fill x=110 y=443.9
//   CRS rows (3 rows): row 1 y=176, row 2 y=153.6, row 3 y=131.3
//     Country col x~80, TIN col x~225, Reason col x~430

import type { FormMapping, MappedField } from '../mappingTypes';
import type { PrsFormData } from '../../types/prs';

// ── Fund slugs in PDF row order ───────────────────────────────────────────────
// Left half (Principal PRS Plus): rows 1-10
// Right half (Principal Islamic PRS Plus): same 10 rows
// Total 20 slugs; Task 11's buildDataForPdf will flatten dim_allocations into __dim_pct_<slug> keys.
export const FUND_ORDER = [
  // Left column (Principal PRS Plus)
  'principal_retireeasy_2060',
  'principal_retireeasy_2050',
  'principal_retireeasy_2040',
  'principal_retireeasy_2030',
  'principal_retireeasy_income',
  'principal_prs_plus_conservative',
  'principal_prs_plus_moderate',
  'principal_prs_plus_growth',
  'principal_prs_plus_equity',
  'principal_prs_plus_asia_pacific_ex_japan_equity',
  // Right column (Principal Islamic PRS Plus)
  'principal_islamic_retireeasy_2060',
  'principal_islamic_retireeasy_2050',
  'principal_islamic_retireeasy_2040',
  'principal_islamic_retireeasy_2030',
  'principal_islamic_retireeasy_income',
  'principal_islamic_prs_plus_conservative',
  'principal_islamic_prs_plus_moderate',
  'principal_islamic_prs_plus_growth',
  'principal_islamic_prs_plus_equity',
  'principal_islamic_prs_plus_asia_pacific_ex_japan_equity',
] as const;

// Fund row y-coordinates (page 2, bottom-left origin): 10 rows, one per fund pair
// Extracted from pdfplumber word positions for fund name labels
const DIM_ROW_YS: number[] = [
  236.3, // RetireEasy 2060
  222.7, // RetireEasy 2050
  209.1, // RetireEasy 2040
  195.5, // RetireEasy 2030
  181.9, // RetireEasy Income
  168.3, // PRS Plus Conservative
  154.7, // PRS Plus Moderate
  141.1, // PRS Plus Growth
  127.5, // PRS Plus Equity
  113.9, // PRS Plus Asia Pacific Ex Japan Equity
];

// Left column % input x≈155 (Principal PRS Plus); right column x≈388 (Islamic PRS Plus)
const DIM_LEFT_X = 155;
const DIM_RIGHT_X = 388;

function dimFields(): MappedField[] {
  const fields: MappedField[] = [];
  // Left column: fund indices 0-9
  for (let i = 0; i < 10; i++) {
    fields.push({
      key: `__dim_pct_${FUND_ORDER[i]}`,
      page: 1,
      x: DIM_LEFT_X,
      y: DIM_ROW_YS[i],
      maxWidth: 50,
    } as MappedField);
  }
  // Right column: fund indices 10-19
  for (let i = 0; i < 10; i++) {
    fields.push({
      key: `__dim_pct_${FUND_ORDER[10 + i]}`,
      page: 1,
      x: DIM_RIGHT_X,
      y: DIM_ROW_YS[i],
      maxWidth: 50,
    } as MappedField);
  }
  return fields;
}

export const accOpeningMapping: FormMapping = {
  id: 'acc-opening',
  templateFile: 'acc-opening.pdf',
  labelEn: 'PRS Account Opening Form',
  labelZh: 'PRS 开户申请表',
  version: 'Version Jan-2026',
  recommendedKeys: [
    'full_name', 'nric', 'date_of_birth', 'gender', 'race', 'marital_status',
    'mothers_maiden_name', 'occupation_category', 'monthly_income_bracket',
    'corr_address', 'phone_mobile', 'source_of_funds', 'purpose', 'pep_status',
    'contribution_amount', 'contribution_direction', 'tax_residency', 'place_of_birth',
  ],
  fields: [
    // ── PAGE 1 (page index 0) ──────────────────────────────────────────────────

    // PPA Member: New / Existing (top row — applicant_type)
    // Rect boxes (10×10) at y=683.7: x=74.4 (New), x=118.5 (Existing)
    {
      type: 'checkbox', key: 'applicant_type', page: 0, x: 74, y: 683,
      when: (d: PrsFormData) => d.applicant_type === 'new',
    },
    {
      type: 'checkbox', key: 'applicant_type', page: 0, x: 119, y: 683,
      when: (d: PrsFormData) => d.applicant_type === 'existing',
    },

    // Applicant Type: Personal / Employee (second row — applicant_category)
    // Rect boxes (10×10) at y=698.5: x=74.4 (Personal), x=118.5 (Employee)
    {
      type: 'checkbox', key: 'applicant_category', page: 0, x: 74, y: 698,
      when: (d: PrsFormData) => d.applicant_category === 'personal',
    },
    {
      type: 'checkbox', key: 'applicant_category', page: 0, x: 119, y: 698,
      when: (d: PrsFormData) => d.applicant_category === 'employee',
    },
    // Employer PRS Plus Partner Programme Contract No.
    { key: 'employer_prs_contract_no', page: 0, x: 345, y: 690, maxWidth: 180 },
    // PPA Account No (Existing PPA member only): fill x=345 y=673
    { key: 'existing_ppa_account_no', page: 0, x: 345, y: 673, maxWidth: 150 },

    // NRIC No: comb cells from rect data — 12 cells at y=641.6, x start=63.8, cellWidth=12
    {
      type: 'comb', key: 'nric', page: 0,
      x: 63, y: 641,
      cellWidth: 12, cells: 12,
      strip: /[\s-]/g,
    },

    // Date Of Birth: D D / M M / Y Y Y Y at y≈641.6
    // D cells: x=441.2, 453.7; M cells: 477.4, 489.9; Y cells: 515.7, 528.7, 541.4, 553.0
    { type: 'date-split', key: 'date_of_birth', page: 0, x: 441, y: 641, cellWidth: 12 },

    // Other ID Type (checkboxes at y≈607.8)
    // From rect analysis: at y=607.8 x=63.8 (Old IC), 99.7 (Police), 135.7 (Army), 171.6 (Passport)
    {
      type: 'checkbox', key: 'other_id_type', page: 0, x: 64, y: 607,
      when: (d: PrsFormData) => d.other_id_type === 'old_ic',
    },
    {
      type: 'checkbox', key: 'other_id_type', page: 0, x: 100, y: 607,
      when: (d: PrsFormData) => d.other_id_type === 'police_id',
    },
    {
      type: 'checkbox', key: 'other_id_type', page: 0, x: 136, y: 607,
      when: (d: PrsFormData) => d.other_id_type === 'army_id',
    },
    {
      type: 'checkbox', key: 'other_id_type', page: 0, x: 172, y: 607,
      when: (d: PrsFormData) => d.other_id_type === 'passport',
    },
    // Other ID No: label at x=200.6 y=606.2 → fill
    { key: 'other_id_no', page: 0, x: 253, y: 606, maxWidth: 110 },
    // Country Of Issuance (for Passport): label at x=370.8 y=605.2
    { key: 'passport_country', page: 0, x: 456, y: 605, maxWidth: 100 },
    // Passport Expiry: D D / M M / Y Y Y Y at y≈625.2
    { type: 'date-split', key: 'passport_expiry', page: 0, x: 441, y: 624, cellWidth: 12 },

    // Salutation: Mr / Mrs / Ms (from rects at y=508)
    // Rect boxes (12×11) at y=508: Mr x=75.8, Mrs x=111.7, Ms x=147.7
    {
      type: 'checkbox', key: 'salutation', page: 0, x: 76, y: 508,
      when: (d: PrsFormData) => d.salutation === 'Mr',
    },
    {
      type: 'checkbox', key: 'salutation', page: 0, x: 112, y: 508,
      when: (d: PrsFormData) => d.salutation === 'Mrs',
    },
    {
      type: 'checkbox', key: 'salutation', page: 0, x: 148, y: 508,
      when: (d: PrsFormData) => d.salutation === 'Ms',
    },
    // Salutation Others fill
    { key: 'salutation', page: 0, x: 260, y: 508, maxWidth: 110,
      // Only render text when not a standard salutation
    },
    // Full Name: label 'Name(as per NRIC/Passport...)' at y=582.2 → fill x=28 y=570
    { key: 'full_name', page: 0, x: 28, y: 570, maxWidth: 530 },

    // Gender: Male / Female (from words at y=547)
    // Rect boxes at y=552.2 area: Male x≈75.8, Female x≈111.7
    {
      type: 'checkbox', key: 'gender', page: 0, x: 76, y: 547,
      when: (d: PrsFormData) => d.gender === 'male',
    },
    {
      type: 'checkbox', key: 'gender', page: 0, x: 112, y: 547,
      when: (d: PrsFormData) => d.gender === 'female',
    },

    // Race: Bumiputera / Chinese / Indian / Others (from words at y=547)
    // Rect boxes at y=552.2: Bumiputera x≈183.6, Chinese x≈219.5, Indian x≈255.5, Others x≈291.4
    {
      type: 'checkbox', key: 'race', page: 0, x: 184, y: 547,
      when: (d: PrsFormData) => d.race === 'bumiputera',
    },
    {
      type: 'checkbox', key: 'race', page: 0, x: 220, y: 547,
      when: (d: PrsFormData) => d.race === 'chinese',
    },
    {
      type: 'checkbox', key: 'race', page: 0, x: 256, y: 547,
      when: (d: PrsFormData) => d.race === 'indian',
    },
    {
      type: 'checkbox', key: 'race', page: 0, x: 292, y: 547,
      when: (d: PrsFormData) => d.race === 'others',
    },
    { key: 'race_other', page: 0, x: 420, y: 547, maxWidth: 140 },

    // Nationality: Malaysian / Others (from words at y=529)
    // Rect boxes at y=534.9: Malaysian x≈75.8, Others x≈111.7
    {
      type: 'checkbox', key: 'nationality', page: 0, x: 76, y: 529,
      when: (d: PrsFormData) => d.nationality === 'Malaysian',
    },

    // Marital Status: Single / Married / Widowed / Divorced (from words at y=529)
    // Rect boxes at y=534.9: Single x≈339.3, Married x≈375.3, Widowed x≈411.2, Divorced x≈447.1
    {
      type: 'checkbox', key: 'marital_status', page: 0, x: 340, y: 529,
      when: (d: PrsFormData) => d.marital_status === 'single',
    },
    {
      type: 'checkbox', key: 'marital_status', page: 0, x: 376, y: 529,
      when: (d: PrsFormData) => d.marital_status === 'married',
    },
    {
      type: 'checkbox', key: 'marital_status', page: 0, x: 412, y: 529,
      when: (d: PrsFormData) => d.marital_status === 'widowed',
    },
    {
      type: 'checkbox', key: 'marital_status', page: 0, x: 448, y: 529,
      when: (d: PrsFormData) => d.marital_status === 'divorced',
    },

    // Mother's Maiden Name: label ends y=390.4 → fill
    { key: 'mothers_maiden_name', page: 0, x: 153, y: 390, maxWidth: 410 },

    // Occupation Category: 12 options in 2 rows
    // From rect analysis (12×11 boxes): rows at y=464.7 and y=439.5
    // Row 1 labels (y≈459.6): Retiree x≈75.0, Housewife x≈123.4, Self-Employed x≈163.0,
    //   Professional x≈255.7, Skilled Worker x≈315.7, Government x≈387.9
    // Row 2 labels (y≈445.1): Clerical x≈75.0, Executive x≈123.4, Management x≈163.0,
    //   Unemployed x≈255.7, Student x≈315.7, Others x≈387.9
    {
      type: 'checkbox', key: 'occupation_category', page: 0, x: 75, y: 464,
      when: (d: PrsFormData) => d.occupation_category === 'retiree',
    },
    {
      type: 'checkbox', key: 'occupation_category', page: 0, x: 123, y: 464,
      when: (d: PrsFormData) => d.occupation_category === 'housewife',
    },
    {
      type: 'checkbox', key: 'occupation_category', page: 0, x: 163, y: 464,
      when: (d: PrsFormData) => d.occupation_category === 'self_employed',
    },
    {
      type: 'checkbox', key: 'occupation_category', page: 0, x: 256, y: 464,
      when: (d: PrsFormData) => d.occupation_category === 'professional',
    },
    {
      type: 'checkbox', key: 'occupation_category', page: 0, x: 316, y: 464,
      when: (d: PrsFormData) => d.occupation_category === 'skilled_worker',
    },
    {
      type: 'checkbox', key: 'occupation_category', page: 0, x: 388, y: 464,
      when: (d: PrsFormData) => d.occupation_category === 'government',
    },
    {
      type: 'checkbox', key: 'occupation_category', page: 0, x: 75, y: 439,
      when: (d: PrsFormData) => d.occupation_category === 'clerical',
    },
    {
      type: 'checkbox', key: 'occupation_category', page: 0, x: 123, y: 439,
      when: (d: PrsFormData) => d.occupation_category === 'executive',
    },
    {
      type: 'checkbox', key: 'occupation_category', page: 0, x: 163, y: 439,
      when: (d: PrsFormData) => d.occupation_category === 'management',
    },
    {
      type: 'checkbox', key: 'occupation_category', page: 0, x: 256, y: 439,
      when: (d: PrsFormData) => d.occupation_category === 'unemployed',
    },
    {
      type: 'checkbox', key: 'occupation_category', page: 0, x: 316, y: 439,
      when: (d: PrsFormData) => d.occupation_category === 'student',
    },
    {
      type: 'checkbox', key: 'occupation_category', page: 0, x: 388, y: 439,
      when: (d: PrsFormData) => d.occupation_category === 'others',
    },
    { key: 'occupation_other', page: 0, x: 450, y: 445, maxWidth: 110 },

    // Nature of Occupation: 10 options in 2 rows
    // Row 1 (y≈426.2): Agriculture x≈75.0, Finance x≈163.0, Construction x≈255.7,
    //   Mining x≈315.7, Transport x≈387.9
    // Row 2 (y≈412.1): Trading x≈75.0, Electricity x≈163.0, Manufacturing x≈255.7,
    //   Education x≈315.7, Others x≈387.9
    // Rect boxes (12×11) at y=424.3 and y=405.6
    {
      type: 'checkbox', key: 'nature_of_occupation', page: 0, x: 75, y: 424,
      when: (d: PrsFormData) => d.nature_of_occupation === 'agriculture_forestry',
    },
    {
      type: 'checkbox', key: 'nature_of_occupation', page: 0, x: 163, y: 424,
      when: (d: PrsFormData) => d.nature_of_occupation === 'finance_insurance_property',
    },
    {
      type: 'checkbox', key: 'nature_of_occupation', page: 0, x: 256, y: 424,
      when: (d: PrsFormData) => d.nature_of_occupation === 'construction',
    },
    {
      type: 'checkbox', key: 'nature_of_occupation', page: 0, x: 316, y: 424,
      when: (d: PrsFormData) => d.nature_of_occupation === 'mining_quarrying',
    },
    {
      type: 'checkbox', key: 'nature_of_occupation', page: 0, x: 388, y: 424,
      when: (d: PrsFormData) => d.nature_of_occupation === 'transport_storage_communication',
    },
    {
      type: 'checkbox', key: 'nature_of_occupation', page: 0, x: 75, y: 405,
      when: (d: PrsFormData) => d.nature_of_occupation === 'trading_restaurant_hotel',
    },
    {
      type: 'checkbox', key: 'nature_of_occupation', page: 0, x: 163, y: 405,
      when: (d: PrsFormData) => d.nature_of_occupation === 'electricity_gas_water',
    },
    {
      type: 'checkbox', key: 'nature_of_occupation', page: 0, x: 256, y: 405,
      when: (d: PrsFormData) => d.nature_of_occupation === 'manufacturing',
    },
    {
      type: 'checkbox', key: 'nature_of_occupation', page: 0, x: 316, y: 405,
      when: (d: PrsFormData) => d.nature_of_occupation === 'education_health',
    },
    {
      type: 'checkbox', key: 'nature_of_occupation', page: 0, x: 388, y: 405,
      when: (d: PrsFormData) => d.nature_of_occupation === 'others',
    },
    { key: 'nature_other', page: 0, x: 450, y: 411, maxWidth: 110 },

    // Employer Name: label y=363.9 → fill
    { key: 'employer_name', page: 0, x: 100, y: 363, maxWidth: 455 },

    // For Employee section: Staff No, Employment Date
    { key: 'staff_no', page: 0, x: 215, y: 336, maxWidth: 155 },
    { type: 'date-split', key: 'employment_date', page: 0, x: 441, y: 335, cellWidth: 12 },

    // Monthly Income Brackets: 10 options in 2 rows
    // Row 1 (y≈490.2): Up to RM1,500 x≈75.8, 1501-3000 x≈159.6, 3001-5000 x≈243.5,
    //   5001-8000 x≈327.3, 8001-15000 x≈411.2
    // Row 2 (y≈464.7): 15001-20000 x≈75.8, 20001-50000 x≈147.7, 50001-100000 x≈219.5,
    //   100001-200000 x≈291.4, >200000 x≈363.3
    {
      type: 'checkbox', key: 'monthly_income_bracket', page: 0, x: 76, y: 490,
      when: (d: PrsFormData) => d.monthly_income_bracket === 'up_to_1500',
    },
    {
      type: 'checkbox', key: 'monthly_income_bracket', page: 0, x: 160, y: 490,
      when: (d: PrsFormData) => d.monthly_income_bracket === '1501_3000',
    },
    {
      type: 'checkbox', key: 'monthly_income_bracket', page: 0, x: 244, y: 490,
      when: (d: PrsFormData) => d.monthly_income_bracket === '3001_5000',
    },
    {
      type: 'checkbox', key: 'monthly_income_bracket', page: 0, x: 328, y: 490,
      when: (d: PrsFormData) => d.monthly_income_bracket === '5001_8000',
    },
    {
      type: 'checkbox', key: 'monthly_income_bracket', page: 0, x: 412, y: 490,
      when: (d: PrsFormData) => d.monthly_income_bracket === '8001_15000',
    },
    {
      type: 'checkbox', key: 'monthly_income_bracket', page: 0, x: 76, y: 464,
      when: (d: PrsFormData) => d.monthly_income_bracket === '15001_20000',
    },
    {
      type: 'checkbox', key: 'monthly_income_bracket', page: 0, x: 148, y: 464,
      when: (d: PrsFormData) => d.monthly_income_bracket === '20001_50000',
    },
    {
      type: 'checkbox', key: 'monthly_income_bracket', page: 0, x: 220, y: 464,
      when: (d: PrsFormData) => d.monthly_income_bracket === '50001_100000',
    },
    {
      type: 'checkbox', key: 'monthly_income_bracket', page: 0, x: 292, y: 464,
      when: (d: PrsFormData) => d.monthly_income_bracket === '100001_200000',
    },
    {
      type: 'checkbox', key: 'monthly_income_bracket', page: 0, x: 364, y: 464,
      when: (d: PrsFormData) => d.monthly_income_bracket === 'above_200000',
    },

    // Correspondence Address
    // Label 'Correspondence Address' y=327.4; 'Address' fill row y=317.1
    { key: 'corr_address', page: 0, x: 28, y: 310, maxWidth: 530 },
    { key: 'corr_postcode', page: 0, x: 28, y: 281, maxWidth: 120 },
    { key: 'corr_city', page: 0, x: 175, y: 281, maxWidth: 380 },
    { key: 'corr_state', page: 0, x: 28, y: 263, maxWidth: 225 },
    { key: 'corr_country', page: 0, x: 285, y: 263, maxWidth: 270 },

    // Permanent Address — 'Cross this box if same as Corr' checkbox at x=68.4 y=244.5
    {
      type: 'checkbox', key: 'perm_same_as_corr', page: 0, x: 68, y: 244,
      when: (d: PrsFormData) => d.perm_same_as_corr === true,
    },
    { key: 'perm_address', page: 0, x: 28, y: 227, maxWidth: 530 },
    { key: 'perm_postcode', page: 0, x: 28, y: 191, maxWidth: 120 },
    { key: 'perm_city', page: 0, x: 175, y: 191, maxWidth: 380 },
    { key: 'perm_state', page: 0, x: 28, y: 173, maxWidth: 225 },
    { key: 'perm_country', page: 0, x: 285, y: 173, maxWidth: 270 },

    // Tel / Email
    // House: after '-' at x=104.2 y=155.3 → fill x=112 y=157
    // Office: after '-' at x=332.2 y=155.3 → fill x=345 y=157
    // Mobile: after '-' at x=104.2 y=136.9 → fill x=112 y=139
    { key: 'phone_house', page: 0, x: 112, y: 157, maxWidth: 145 },
    { key: 'phone_office', page: 0, x: 345, y: 157, maxWidth: 205 },
    { key: 'phone_mobile', page: 0, x: 112, y: 139, maxWidth: 145 },
    { key: 'email', page: 0, x: 65, y: 118, maxWidth: 495, uppercase: false },

    // ── PAGE 2 (page index 1) ──────────────────────────────────────────────────

    // Purpose of Transaction (4 + other)
    // Checkboxes at y=721.5: Investment x=28.6, Retirement x=104.2, Protection x=169.1, Others x=229.2
    {
      type: 'checkbox', key: 'purpose', page: 1, x: 29, y: 721,
      when: (d: PrsFormData) => d.purpose === 'investment',
    },
    {
      type: 'checkbox', key: 'purpose', page: 1, x: 104, y: 721,
      when: (d: PrsFormData) => d.purpose === 'retirement',
    },
    {
      type: 'checkbox', key: 'purpose', page: 1, x: 169, y: 721,
      when: (d: PrsFormData) => d.purpose === 'protection',
    },
    {
      type: 'checkbox', key: 'purpose', page: 1, x: 229, y: 721,
      when: (d: PrsFormData) => d.purpose === 'others',
    },
    { key: 'purpose_other', page: 1, x: 320, y: 721, maxWidth: 235 },

    // Source of Funds (6 options + other)
    // From rect analysis at y=142.1: x=104.2, 169.1, 230.0, 282.2, 327.2, 373.4
    // Labels: Employment, Sales of Assets, Inheritance, Savings, Business, Others
    {
      type: 'checkbox', key: 'source_of_funds', page: 1, x: 104, y: 707,
      when: (d: PrsFormData) => d.source_of_funds === 'employment',
    },
    {
      type: 'checkbox', key: 'source_of_funds', page: 1, x: 169, y: 707,
      when: (d: PrsFormData) => d.source_of_funds === 'sales_of_assets',
    },
    {
      type: 'checkbox', key: 'source_of_funds', page: 1, x: 230, y: 707,
      when: (d: PrsFormData) => d.source_of_funds === 'inheritance',
    },
    {
      type: 'checkbox', key: 'source_of_funds', page: 1, x: 282, y: 707,
      when: (d: PrsFormData) => d.source_of_funds === 'savings',
    },
    {
      type: 'checkbox', key: 'source_of_funds', page: 1, x: 327, y: 707,
      when: (d: PrsFormData) => d.source_of_funds === 'business',
    },
    {
      type: 'checkbox', key: 'source_of_funds', page: 1, x: 373, y: 707,
      when: (d: PrsFormData) => d.source_of_funds === 'others',
    },
    { key: 'source_of_funds_other', page: 1, x: 460, y: 707, maxWidth: 100 },

    // PEP Declaration: Yes/No
    // Checkboxes at y=156.1: Yes x=470.3, No x=502.8
    {
      type: 'checkbox', key: 'pep_status', page: 1, x: 470, y: 693,
      when: (d: PrsFormData) => d.pep_status === 'yes',
    },
    {
      type: 'checkbox', key: 'pep_status', page: 1, x: 503, y: 693,
      when: (d: PrsFormData) => d.pep_status === 'no',
    },

    // Section 2: Contribution Details
    // Individual Contribution: checkbox at y=564.5 for RSP
    // Contribution Amount (RM): decimal dot at x=259.9 y=573.9 → fill x=134 y=573
    { key: 'contribution_amount', page: 1, x: 134, y: 573, maxWidth: 120 },
    // Cheque No: fill x=360 y=573
    { key: 'cheque_no', page: 1, x: 360, y: 573, maxWidth: 195 },

    // Regular Savings Plan: checkbox at x=34.4 y=551.5
    {
      type: 'checkbox', key: 'rsp_enabled', page: 1, x: 34, y: 551,
      when: (d: PrsFormData) => d.rsp_enabled === true,
    },
    // RSP Bank name: fill x=65 y=534
    { key: 'rsp_bank', page: 1, x: 65, y: 534, maxWidth: 300 },
    // RSP Bank Account No: fill x=65 y=519
    { key: 'rsp_bank_account_no', page: 1, x: 65, y: 519, maxWidth: 330 },
    // RSP Deduction Date (DD): fill x=415 y=519
    { key: 'rsp_deduction_day', page: 1, x: 415, y: 519, maxWidth: 30 },
    // RSP Amount (RM): fill x=448 y=519
    { key: 'rsp_amount', page: 1, x: 448, y: 519, maxWidth: 100 },

    // EPF Redirection % (1%-7% checkboxes at y=465.5)
    // Checkbox positions: 1%=x=50.9, 2%=x=98.9, 3%=x=146.9, 4%=x=194.9, 5%=x=242.9, 6%=x=290.9, 7%=x=338.9
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 1, x: 51, y: 465,
      when: (d: PrsFormData) => d.epf_redirection_percent === '1',
    },
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 1, x: 99, y: 465,
      when: (d: PrsFormData) => d.epf_redirection_percent === '2',
    },
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 1, x: 147, y: 465,
      when: (d: PrsFormData) => d.epf_redirection_percent === '3',
    },
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 1, x: 195, y: 465,
      when: (d: PrsFormData) => d.epf_redirection_percent === '4',
    },
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 1, x: 243, y: 465,
      when: (d: PrsFormData) => d.epf_redirection_percent === '5',
    },
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 1, x: 291, y: 465,
      when: (d: PrsFormData) => d.epf_redirection_percent === '6',
    },
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 1, x: 339, y: 465,
      when: (d: PrsFormData) => d.epf_redirection_percent === '7',
    },

    // Salary Deduction: % of salary at x=65 y=427; RM at x=298 y=427
    { key: 'salary_deduction_percent', page: 1, x: 65, y: 427, maxWidth: 100 },
    { key: 'salary_deduction_rm', page: 1, x: 298, y: 427, maxWidth: 100 },

    // Section 3: Contribution Direction
    // Do-It-For-Me: checkbox x=34.4 y=297.0
    // Do-It-Myself: checkbox x=34.4 y=256.3
    {
      type: 'checkbox', key: 'contribution_direction', page: 1, x: 34, y: 297,
      when: (d: PrsFormData) => d.contribution_direction === 'do_it_for_me',
    },
    {
      type: 'checkbox', key: 'contribution_direction', page: 1, x: 34, y: 256,
      when: (d: PrsFormData) => d.contribution_direction === 'do_it_myself',
    },

    // DIFM Scheme selection: Principal PRS Plus x=92.8 y=221.3; Islamic PRS Plus x=174.1 y=221.3
    {
      type: 'checkbox', key: 'difm_scheme', page: 1, x: 93, y: 221,
      when: (d: PrsFormData) => d.difm_scheme === 'prs_plus',
    },
    {
      type: 'checkbox', key: 'difm_scheme', page: 1, x: 174, y: 221,
      when: (d: PrsFormData) => d.difm_scheme === 'islamic_prs_plus',
    },

    // DIM fund allocation % fields (20 derived keys, 2 columns × 10 rows)
    ...dimFields(),

    // ── PAGE 3 (page index 2) ──────────────────────────────────────────────────

    // Consultant/Staff Code: label y=276.0, fill x=100 y=276
    { key: 'consultant_code', page: 2, x: 100, y: 276, maxWidth: 235 },

    // Branch Name & Code: label y=217.0, fill x=100 y=217
    { key: 'branch_name_code', page: 2, x: 100, y: 217, maxWidth: 235 },

    // Distributor Code: label at x=343.5 y=143.1, fill x=393 y=143
    { key: 'distributor_code', page: 2, x: 393, y: 143, maxWidth: 165 },

    // Channel (from rects at y=411.0: x=361.0 PRS Consultant, x=249.0 Corporate PRS Distributor)
    // and institutional PRS adviser from page 3 words at y=190.2
    // Rect checkboxes (11.3×11.3) at y=411.0: x=249.0, x=361.0
    // From page 3 layout: PRS Consultant y=207.6, Corporate PRS Distributor y=172.4,
    //   Institutional PRS Adviser y=190.2 (checkbox at x=361 y≈208.6 from channel label)
    // Revised mapping from actual words: channel checkboxes align with each label row
    {
      type: 'checkbox', key: 'channel', page: 2, x: 361, y: 208,
      when: (d: PrsFormData) => d.channel === 'prs_consultant',
    },
    {
      type: 'checkbox', key: 'channel', page: 2, x: 361, y: 190,
      when: (d: PrsFormData) => d.channel === 'institutional_prs_adviser',
    },
    {
      type: 'checkbox', key: 'channel', page: 2, x: 361, y: 172,
      when: (d: PrsFormData) => d.channel === 'corporate_prs_distributor',
    },

    // Class For Application: A/X/C from words at x=119.8/154.1/186.3 y=121.2
    { key: 'class_for_application', page: 2, x: 100, y: 121, maxWidth: 110 },

    // Date (from applicant): D D / M M / Y Y Y Y at y=101.3 (sign date)
    { type: 'date-split', key: 'sign_date', page: 2, x: 56, y: 101, cellWidth: 12 },

    // ── PAGE 7 (page index 6) ──────────────────────────────────────────────────
    // Individual Self-Certification Form (CRS) — Part 1 & Part 2

    // Full Name: label 'Full Name:' y=684.9 → fill x=110 y=685
    { key: 'full_name', page: 6, x: 110, y: 685, maxWidth: 445 },

    // Current Mailing Address: label y=642.3 → fill x=110 y=643
    { key: 'corr_address', page: 6, x: 110, y: 643, maxWidth: 445 },

    // Postal Code: label y=577.6 → fill x=110 y=577
    { key: 'corr_postcode', page: 6, x: 110, y: 577, maxWidth: 140 },
    // Country (corr): label x=261.2 y=586.5 → fill x=305 y=577
    { key: 'corr_country', page: 6, x: 305, y: 577, maxWidth: 245 },

    // Permanent Address: label y=554.7 → fill x=120 y=555
    { key: 'perm_address', page: 6, x: 120, y: 545, maxWidth: 435 },

    // Perm Postal Code / Country: y=489
    { key: 'perm_postcode', page: 6, x: 110, y: 489, maxWidth: 140 },
    { key: 'perm_country', page: 6, x: 305, y: 489, maxWidth: 245 },

    // Date of Birth: label y=476.9 → date-split x=160 y=467
    { type: 'date-split', key: 'date_of_birth', page: 6, x: 160, y: 467, cellWidth: 12 },

    // Place & Country of Birth: label x=261.2 y=476.9/467.1 → fill x=342 y=467 / y=457
    { key: 'place_of_birth', page: 6, x: 342, y: 467, maxWidth: 215 },
    { key: 'country_of_birth', page: 6, x: 342, y: 457, maxWidth: 215 },

    // Email Address: label y=443.9 → fill x=110 y=443
    { key: 'email', page: 6, x: 110, y: 443, maxWidth: 445, uppercase: false },

    // CRS Part 2: Tax Residence rows 1-3
    // Table 1 (CRS): 3 data rows; columns: Country (x=56.5-215.4), TIN (x=215.4-371.6),
    //   Reason A/B/C (x=371.6-538.7). Row midpoints: row1 y≈366, row2 y≈339, row3 y≈317.
    // Country column: header starts x=74.6, input x≈80
    // TIN column: header starts x=223.6, input x≈225
    // Reason column: text at x≈380 (single char A, B, or C)
    { key: 'crs_tax_residences.0.country',            page: 6, x: 80,  y: 366, maxWidth: 130 },
    { key: 'crs_tax_residences.0.tin',                page: 6, x: 225, y: 366, maxWidth: 140 },
    { key: 'crs_tax_residences.0.noTinReason',        page: 6, x: 380, y: 366, maxWidth: 50  },
    { key: 'crs_tax_residences.1.country',            page: 6, x: 80,  y: 339, maxWidth: 130 },
    { key: 'crs_tax_residences.1.tin',                page: 6, x: 225, y: 339, maxWidth: 140 },
    { key: 'crs_tax_residences.1.noTinReason',        page: 6, x: 380, y: 339, maxWidth: 50  },
    { key: 'crs_tax_residences.2.country',            page: 6, x: 80,  y: 317, maxWidth: 130 },
    { key: 'crs_tax_residences.2.tin',                page: 6, x: 225, y: 317, maxWidth: 140 },
    { key: 'crs_tax_residences.2.noTinReason',        page: 6, x: 380, y: 317, maxWidth: 50  },

    // Reason B explanation rows: Table 2 (index rows) at y=176.0, 153.6, 131.3
    // Column layout: row-number cell x=56.5-81.1; explanation cell x=81.1-538.7
    { key: 'crs_tax_residences.0.reasonBExplanation', page: 6, x: 85,  y: 176, maxWidth: 450 },
    { key: 'crs_tax_residences.1.reasonBExplanation', page: 6, x: 85,  y: 153, maxWidth: 450 },
    { key: 'crs_tax_residences.2.reasonBExplanation', page: 6, x: 85,  y: 131, maxWidth: 450 },
  ],
};
