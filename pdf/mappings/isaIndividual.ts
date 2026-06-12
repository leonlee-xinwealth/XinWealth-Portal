// pdf/mappings/isaIndividual.ts
// ISA Individual Suitability Assessment Form (INVESTOR SUITABILITY ASSESSMENT FORM - INDIVIDUAL)
// Template: public/forms/prs/isa-individual.pdf (3 pages, A4 595.44×841.92pt)
// Version: August 2025
//
// Coordinates extracted via scripts/extract_pdf_labels.py + pdfplumber rect/char analysis.
// pdf-lib coordinate origin is bottom-left; page H=841.92pt, W=595.44pt.
//
// ── Page 1 (index 0) ─────────────────────────────────────────────────────────
//   ISA Mode: '🗆' at x=41.3/x=121.0 y=647.3 → checkbox at x=43/x=123
//   Full Name: label y=613.4, fill row (underlines y=626.1–595.6) → fill x=160 y=597
//   NRIC/Passport: label y=587.3, fill row (underlines y=595.6–565.4) → fill x=160 y=578
//   Education '( )': open brackets x=187.8/275.2/375.3/471.8 y=565.0 → cx=195/283/383/479
//   Disposable Income '( )': open x=187.8/275.9/374.8/472.3 y=542.6 → cx=195/283/382/480
//   Monthly Commitment '( )': open x=187.8/275.9/374.8/472.3 y=520.3 → cx=195/283/382/480
//   Invest % rows 1-4: open x=187.8/275.2/376.5/473.9 y=497.7 → cx=195/283/384/481
//   Invest % rows 5-6: open x=187.8/274.4 y=484.3 → cx=195/282
//   Part2 Q1 expectation: open x=100.8/175.0/252.3 y=431.5 → cx=108/182/260
//   Part2 Q2 purpose row1: open x=100.8/213.7/351.7 y=408.7 → cx=108/221/359
//   Part2 Q2 purpose row2: open x=100.8/213.7 y=401.2 → cx=108/221
//   Part2 Q2 purpose_other text fill: after 'specify:' x=297.7 y=401.2 → fill x=312
//   Part2 Q3 reasons row1: open x=100.8/212.0 y=377.9 → cx=108/221
//   Part2 Q3 reasons row2: open x=100.8 y=370.5 → cx=108
//   Part2 Q4 experience years text fills: y=347.5 (unit trust/bond/equities/derivatives)
//                                         y=339.8 (prs/others)
//   Part3 Q1 age: open x=100.8/208.4/312.4 y=284.3 → cx=108/216/320
//   Part3 Q2 experience: open x=100.8/208.4/312.8 y=254.1 → cx=108/216/320
//   Part3 Q3 understanding: open x=100.8/207.9/314.0 y=223.6 → cx=108/216/321
//   Part3 Q4 objective: open x=100.8 y=200.5/193.1/186.4 (3 rows)
//   Part3 Q5 duration: open x=100.8/208.7/314.0 y=162.8 → cx=108/216/321
//   Part3 Q6 risk: open x=100.8 y=139.8/132.3/124.9 (3 rows)
//   TOTAL score: 'TOTAL' at x=495.3 y=107.9 → fill x=532 y=108
//
// ── Page 2 (index 1) ─────────────────────────────────────────────────────────
//   UTC category '🗆': x=237.0/364.7/490.5 y=692.6
//   UTC basis '🗆': x=181.3 y=670.1/655.7/641.3/628.8
//   UTC basis other text: '_' at x=259.3 y=629.5 → fill x=262
//   UTC funds 1-5: '1.' at x=181.3, y=587.8/572.6/557.7/542.9/524.9 → fill x=197
//   Part5 vulnerable investor-principal column (blank cells cx≈225):
//     elderly y=360.2, low_education y=337.1, no_experience y=325.9,
//     limited_means y=314.5, breadwinner_loss y=291.7, impairment y=280.5, none y=269.2
//
// ── Page 3 (index 2) ─────────────────────────────────────────────────────────
//   Part6 acks: 'YES' at x=523.7, 'NO' at x=539.5; rows y=782.8/754.9/727.1/699.0/671.1
//   Principal Holder signature area: Name x=75 y=595.2, Date x=75 y=587.8
//   UTC signature area: Name x=336 y=595.2, UTC Code x=352 y=587.8, Date x=336 y=580.3

import type { FormMapping, MappedField } from '../mappingTypes';
import type { PrsFormData } from '../../types/prs';

// ── Vulnerable customer rows (page 2, investor Principal Holder column) ───────
// Table RIGHT half x=175-559 has no explicit inner vertical separators.
// Investor Principal column estimated centre: cx≈225.
// UTC column pre-printed 'Yes' at x=407.0 / 'No' at x=405.3 per row (UTC assessment).
// Investor marks YES = attribute applies, NO = does not apply.
// Only YES is written (checkbox fires when attribute is in the isa_vulnerable array).
const VULN_YES_X = 225;
const VULN_ROWS: [string, number][] = [
  ['elderly',          360.2],
  ['low_education',    337.1],
  ['no_experience',    325.9],
  ['limited_means',    314.5],
  ['breadwinner_loss', 291.7],
  ['impairment',       280.5],
  ['none',             269.2],
];

function vulnerableFields(): MappedField[] {
  return VULN_ROWS.map(([attr, y]) => ({
    type: 'checkbox' as const,
    key: 'isa_vulnerable',
    page: 1,
    x: VULN_YES_X,
    y,
    when: (d: PrsFormData) => (d.isa_vulnerable as string[]).includes(attr),
  }));
}

// ── UTC fund lines (page 2) ───────────────────────────────────────────────────
const UTC_FUND_YS = [587.8, 572.6, 557.7, 542.9, 524.9];
function utcFundFields(): MappedField[] {
  return UTC_FUND_YS.map((y, i) => ({
    key: `utc_funds.${i}`,
    page: 1,
    x: 197,
    y,
    maxWidth: 310,
  } as MappedField));
}

export const isaIndividualMapping: FormMapping = {
  id: 'isa-individual',
  templateFile: 'isa-individual.pdf',
  labelEn: 'ISA Individual Suitability Assessment',
  labelZh: 'ISA 个人适当性评估',
  version: 'Version August 2025',
  recommendedKeys: [
    'full_name', 'nric', 'isa_mode', 'isa_education', 'isa_disposable_income',
    'isa_commitment', 'isa_invest_pct', 'isa_expectation', 'isa_purpose',
    'isa_reasons', 'isa_q1_age', 'isa_q2_experience', 'isa_q3_understanding',
    'isa_q4_objective', 'isa_q5_duration', 'isa_q6_risk',
    'isa_vulnerable', 'isa_acks',
    'utc_recommended_category', 'utc_basis', 'utc_funds',
    'consultant_name', 'consultant_code', 'sign_date',
  ],
  fields: [
    // ── Page 1 ────────────────────────────────────────────────────────────────

    // ISA Mode: '🗆' New Investor at x=41.3 y=647.3; '🗆' Review at x=121.0 y=647.3
    {
      type: 'checkbox', key: 'isa_mode', page: 0, x: 43, y: 648,
      when: (d: PrsFormData) => d.isa_mode === 'new',
    },
    {
      type: 'checkbox', key: 'isa_mode', page: 0, x: 123, y: 648,
      when: (d: PrsFormData) => d.isa_mode === 'review',
    },

    // ── Part 1: Personal Details ─────────────────────────────────────────────
    // Full Name: label 'Full Name of Principal Holder*' y=613.4, sub-label y=606.0
    // Fill row baseline y≈597 (row underline at y=595.6)
    { key: 'full_name', page: 0, x: 160, y: 597, maxWidth: 370 },

    // NRIC/Passport No.*: label y=587.3, fill row baseline y≈578 (row underline y=565.4)
    { key: 'nric', page: 0, x: 160, y: 578, maxWidth: 160 },

    // Highest Education: '( )' open brackets at x=187.8/275.2/375.3/471.8 y=565.0
    // centres: degree_above≈195, diploma≈283, stpm≈383, spm_below≈479
    {
      type: 'checkbox', key: 'isa_education', page: 0, x: 195, y: 565,
      when: (d: PrsFormData) => d.isa_education === 'degree_above',
    },
    {
      type: 'checkbox', key: 'isa_education', page: 0, x: 283, y: 565,
      when: (d: PrsFormData) => d.isa_education === 'diploma',
    },
    {
      type: 'checkbox', key: 'isa_education', page: 0, x: 383, y: 565,
      when: (d: PrsFormData) => d.isa_education === 'stpm',
    },
    {
      type: 'checkbox', key: 'isa_education', page: 0, x: 479, y: 565,
      when: (d: PrsFormData) => d.isa_education === 'spm_below',
    },

    // Monthly Disposable Income: open x=187.8/275.9/374.8/472.3 y=542.6
    {
      type: 'checkbox', key: 'isa_disposable_income', page: 0, x: 195, y: 542.6,
      when: (d: PrsFormData) => d.isa_disposable_income === 'below_5000',
    },
    {
      type: 'checkbox', key: 'isa_disposable_income', page: 0, x: 283, y: 542.6,
      when: (d: PrsFormData) => d.isa_disposable_income === '5001_8000',
    },
    {
      type: 'checkbox', key: 'isa_disposable_income', page: 0, x: 382, y: 542.6,
      when: (d: PrsFormData) => d.isa_disposable_income === '8001_15000',
    },
    {
      type: 'checkbox', key: 'isa_disposable_income', page: 0, x: 480, y: 542.6,
      when: (d: PrsFormData) => d.isa_disposable_income === 'above_15001',
    },

    // Total Monthly Commitment: open x=187.8/275.9/374.8/472.3 y=520.3
    {
      type: 'checkbox', key: 'isa_commitment', page: 0, x: 195, y: 520.3,
      when: (d: PrsFormData) => d.isa_commitment === 'below_2000',
    },
    {
      type: 'checkbox', key: 'isa_commitment', page: 0, x: 283, y: 520.3,
      when: (d: PrsFormData) => d.isa_commitment === '2001_5000',
    },
    {
      type: 'checkbox', key: 'isa_commitment', page: 0, x: 382, y: 520.3,
      when: (d: PrsFormData) => d.isa_commitment === '5001_10000',
    },
    {
      type: 'checkbox', key: 'isa_commitment', page: 0, x: 480, y: 520.3,
      when: (d: PrsFormData) => d.isa_commitment === 'above_10001',
    },

    // % of Investment in Total Asset (row 1: y=497.7; row 2: y=484.3)
    {
      type: 'checkbox', key: 'isa_invest_pct', page: 0, x: 195, y: 497.7,
      when: (d: PrsFormData) => d.isa_invest_pct === 'below_10',
    },
    {
      type: 'checkbox', key: 'isa_invest_pct', page: 0, x: 283, y: 497.7,
      when: (d: PrsFormData) => d.isa_invest_pct === '11_20',
    },
    {
      type: 'checkbox', key: 'isa_invest_pct', page: 0, x: 384, y: 497.7,
      when: (d: PrsFormData) => d.isa_invest_pct === '21_30',
    },
    {
      type: 'checkbox', key: 'isa_invest_pct', page: 0, x: 481, y: 497.7,
      when: (d: PrsFormData) => d.isa_invest_pct === '31_40',
    },
    {
      type: 'checkbox', key: 'isa_invest_pct', page: 0, x: 195, y: 484.3,
      when: (d: PrsFormData) => d.isa_invest_pct === '41_50',
    },
    {
      type: 'checkbox', key: 'isa_invest_pct', page: 0, x: 282, y: 484.3,
      when: (d: PrsFormData) => d.isa_invest_pct === 'above_50',
    },

    // ── Part 2: Investment Purpose & Knowledge ───────────────────────────────
    // Q1 Expectation: '( )' open x=100.8/175.0/252.3 y=431.5
    {
      type: 'checkbox', key: 'isa_expectation', page: 0, x: 108, y: 431.5,
      when: (d: PrsFormData) => d.isa_expectation === 'capital_growth',
    },
    {
      type: 'checkbox', key: 'isa_expectation', page: 0, x: 182, y: 431.5,
      when: (d: PrsFormData) => d.isa_expectation === 'regular_income',
    },
    {
      type: 'checkbox', key: 'isa_expectation', page: 0, x: 260, y: 431.5,
      when: (d: PrsFormData) => d.isa_expectation === 'capital_protection',
    },

    // Q2 Purpose (row 1: y=408.7; row 2: y=401.2)
    {
      type: 'checkbox', key: 'isa_purpose', page: 0, x: 108, y: 408.7,
      when: (d: PrsFormData) => d.isa_purpose === 'asset_accumulation',
    },
    {
      type: 'checkbox', key: 'isa_purpose', page: 0, x: 221, y: 408.7,
      when: (d: PrsFormData) => d.isa_purpose === 'children_education',
    },
    {
      type: 'checkbox', key: 'isa_purpose', page: 0, x: 359, y: 408.7,
      when: (d: PrsFormData) => d.isa_purpose === 'retirement',
    },
    {
      type: 'checkbox', key: 'isa_purpose', page: 0, x: 108, y: 401.2,
      when: (d: PrsFormData) => d.isa_purpose === 'regular_income',
    },
    {
      type: 'checkbox', key: 'isa_purpose', page: 0, x: 221, y: 401.2,
      when: (d: PrsFormData) => d.isa_purpose === 'others',
    },
    // Purpose other text: after 'Others. Please specify:' label at x=297.7 y=401.2
    { key: 'isa_purpose_other', page: 0, x: 312, y: 401.2, maxWidth: 230 },

    // Q3 Reasons (row 1: y=377.9; row 2: y=370.5)
    {
      type: 'checkbox', key: 'isa_reasons', page: 0, x: 108, y: 377.9,
      when: (d: PrsFormData) => d.isa_reasons.includes('meet_objective'),
    },
    {
      type: 'checkbox', key: 'isa_reasons', page: 0, x: 221, y: 377.9,
      when: (d: PrsFormData) => d.isa_reasons.includes('risk_return'),
    },
    {
      type: 'checkbox', key: 'isa_reasons', page: 0, x: 108, y: 370.5,
      when: (d: PrsFormData) => d.isa_reasons.includes('strategy'),
    },

    // Q4 Investment experience (years text fields)
    // Row y=347.5: 'Unit trust:' ends x≈127, 'years' at x=149.8 → fill x=130
    //              'Bond:' ends x≈195, 'years' at x=219 → fill x=199
    //              'Equities:' ends x≈274, 'years' at x=296 → fill x=276
    //              'Derivatives:' ends x≈359, 'years' at x=382 → fill x=362
    // Row y=339.8: 'PRS:' ends x≈114, 'years' at x=137 → fill x=117
    //              'Other investment(s):' ends x≈239, 'years' at x=261 → fill x=242
    { key: 'isa_exp_unit_trust',  page: 0, x: 130, y: 347.5, maxWidth: 18 },
    { key: 'isa_exp_bond',        page: 0, x: 199, y: 347.5, maxWidth: 18 },
    { key: 'isa_exp_equities',    page: 0, x: 276, y: 347.5, maxWidth: 18 },
    { key: 'isa_exp_derivatives', page: 0, x: 362, y: 347.5, maxWidth: 18 },
    { key: 'isa_exp_prs',         page: 0, x: 117, y: 339.8, maxWidth: 18 },
    { key: 'isa_exp_others',      page: 0, x: 242, y: 339.8, maxWidth: 18 },

    // ── Part 3: Risk Profiling (6 questions × score 1/3/5) ───────────────────
    // Q1 Age: '( )' at x=100.8/208.4/312.4 y=284.3
    {
      type: 'checkbox', key: 'isa_q1_age', page: 0, x: 108, y: 284.3,
      when: (d: PrsFormData) => d.isa_q1_age === '1',
    },
    {
      type: 'checkbox', key: 'isa_q1_age', page: 0, x: 216, y: 284.3,
      when: (d: PrsFormData) => d.isa_q1_age === '3',
    },
    {
      type: 'checkbox', key: 'isa_q1_age', page: 0, x: 320, y: 284.3,
      when: (d: PrsFormData) => d.isa_q1_age === '5',
    },

    // Q2 Experience: '( )' at x=100.8/208.4/312.8 y=254.1
    {
      type: 'checkbox', key: 'isa_q2_experience', page: 0, x: 108, y: 254.1,
      when: (d: PrsFormData) => d.isa_q2_experience === '1',
    },
    {
      type: 'checkbox', key: 'isa_q2_experience', page: 0, x: 216, y: 254.1,
      when: (d: PrsFormData) => d.isa_q2_experience === '3',
    },
    {
      type: 'checkbox', key: 'isa_q2_experience', page: 0, x: 320, y: 254.1,
      when: (d: PrsFormData) => d.isa_q2_experience === '5',
    },

    // Q3 Understanding: '( )' at x=100.8/207.9/314.0 y=223.6
    {
      type: 'checkbox', key: 'isa_q3_understanding', page: 0, x: 108, y: 223.6,
      when: (d: PrsFormData) => d.isa_q3_understanding === '1',
    },
    {
      type: 'checkbox', key: 'isa_q3_understanding', page: 0, x: 216, y: 223.6,
      when: (d: PrsFormData) => d.isa_q3_understanding === '3',
    },
    {
      type: 'checkbox', key: 'isa_q3_understanding', page: 0, x: 321, y: 223.6,
      when: (d: PrsFormData) => d.isa_q3_understanding === '5',
    },

    // Q4 Objective: 3 single-column rows at y=200.5/193.1/186.4
    {
      type: 'checkbox', key: 'isa_q4_objective', page: 0, x: 108, y: 200.5,
      when: (d: PrsFormData) => d.isa_q4_objective === '1',
    },
    {
      type: 'checkbox', key: 'isa_q4_objective', page: 0, x: 108, y: 193.1,
      when: (d: PrsFormData) => d.isa_q4_objective === '3',
    },
    {
      type: 'checkbox', key: 'isa_q4_objective', page: 0, x: 108, y: 186.4,
      when: (d: PrsFormData) => d.isa_q4_objective === '5',
    },

    // Q5 Duration: '( )' at x=100.8/208.7/314.0 y=162.8
    {
      type: 'checkbox', key: 'isa_q5_duration', page: 0, x: 108, y: 162.8,
      when: (d: PrsFormData) => d.isa_q5_duration === '1',
    },
    {
      type: 'checkbox', key: 'isa_q5_duration', page: 0, x: 216, y: 162.8,
      when: (d: PrsFormData) => d.isa_q5_duration === '3',
    },
    {
      type: 'checkbox', key: 'isa_q5_duration', page: 0, x: 321, y: 162.8,
      when: (d: PrsFormData) => d.isa_q5_duration === '5',
    },

    // Q6 Risk attitude: 3 single-column rows at y=139.8/132.3/124.9
    {
      type: 'checkbox', key: 'isa_q6_risk', page: 0, x: 108, y: 139.8,
      when: (d: PrsFormData) => d.isa_q6_risk === '1',
    },
    {
      type: 'checkbox', key: 'isa_q6_risk', page: 0, x: 108, y: 132.3,
      when: (d: PrsFormData) => d.isa_q6_risk === '3',
    },
    {
      type: 'checkbox', key: 'isa_q6_risk', page: 0, x: 108, y: 124.9,
      when: (d: PrsFormData) => d.isa_q6_risk === '5',
    },

    // TOTAL score: 'TOTAL' label at x=495.3 y=107.9 → fill at x=532, y=108
    // Uses derived key __isa_total (injected into data by generate-proofs.ts; returns ''
    // for normal PrsFormData via resolveValue — the field renders blank if unset)
    {
      key: '__isa_total',
      page: 0,
      x: 532,
      y: 108,
      maxWidth: 30,
    } as MappedField,

    // ── Page 2 ────────────────────────────────────────────────────────────────

    // ── Part 4: Fund/Portfolio Recommendation (UTC section) ──────────────────
    // UTC recommended category: '🗆' at x=237.0/364.7/490.5 y=692.6
    {
      type: 'checkbox', key: 'utc_recommended_category', page: 1, x: 239, y: 692.6,
      when: (d: PrsFormData) => d.utc_recommended_category === 'conservative',
    },
    {
      type: 'checkbox', key: 'utc_recommended_category', page: 1, x: 367, y: 692.6,
      when: (d: PrsFormData) => d.utc_recommended_category === 'moderate',
    },
    {
      type: 'checkbox', key: 'utc_recommended_category', page: 1, x: 493, y: 692.6,
      when: (d: PrsFormData) => d.utc_recommended_category === 'aggressive',
    },

    // Basis for recommendation (multiple allowed): '🗆' at x=181.3 y=670.1/655.7/641.3/628.8
    {
      type: 'checkbox', key: 'utc_basis', page: 1, x: 183, y: 670.1,
      when: (d: PrsFormData) => d.utc_basis.includes('risk_profile'),
    },
    {
      type: 'checkbox', key: 'utc_basis', page: 1, x: 183, y: 655.7,
      when: (d: PrsFormData) => d.utc_basis.includes('objectives_horizon'),
    },
    {
      type: 'checkbox', key: 'utc_basis', page: 1, x: 183, y: 641.3,
      when: (d: PrsFormData) => d.utc_basis.includes('complements_portfolio'),
    },
    {
      type: 'checkbox', key: 'utc_basis', page: 1, x: 183, y: 628.8,
      when: (d: PrsFormData) => d.utc_basis.includes('others'),
    },
    // Basis other text: '_' underscore at x=259.3 y=629.5 → fill at x=262
    { key: 'utc_basis_other', page: 1, x: 262, y: 629.5, maxWidth: 255, uppercase: false },

    // UTC Funds 1-5
    ...utcFundFields(),

    // ── Part 5: Vulnerable Customer Assessment ───────────────────────────────
    ...vulnerableFields(),

    // ── Page 3 ────────────────────────────────────────────────────────────────

    // ── Part 6: Acknowledgements (5 YES/NO items) ────────────────────────────
    // Form says "circle either YES / NO"; we place 'X' over the chosen word.
    // Pre-printed 'YES' at x=523.7, 'NO' at x=539.5 for each row.
    {
      type: 'checkbox', key: 'isa_acks', page: 2, x: 523.7, y: 782.8,
      when: (d: PrsFormData) => d.isa_acks[0] === 'yes',
    },
    {
      type: 'checkbox', key: 'isa_acks', page: 2, x: 539.5, y: 782.8,
      when: (d: PrsFormData) => d.isa_acks[0] === 'no',
    },
    {
      type: 'checkbox', key: 'isa_acks', page: 2, x: 523.7, y: 754.9,
      when: (d: PrsFormData) => d.isa_acks[1] === 'yes',
    },
    {
      type: 'checkbox', key: 'isa_acks', page: 2, x: 539.5, y: 754.9,
      when: (d: PrsFormData) => d.isa_acks[1] === 'no',
    },
    {
      type: 'checkbox', key: 'isa_acks', page: 2, x: 523.7, y: 727.1,
      when: (d: PrsFormData) => d.isa_acks[2] === 'yes',
    },
    {
      type: 'checkbox', key: 'isa_acks', page: 2, x: 539.5, y: 727.1,
      when: (d: PrsFormData) => d.isa_acks[2] === 'no',
    },
    {
      type: 'checkbox', key: 'isa_acks', page: 2, x: 523.7, y: 699.0,
      when: (d: PrsFormData) => d.isa_acks[3] === 'yes',
    },
    {
      type: 'checkbox', key: 'isa_acks', page: 2, x: 539.5, y: 699.0,
      when: (d: PrsFormData) => d.isa_acks[3] === 'no',
    },
    {
      type: 'checkbox', key: 'isa_acks', page: 2, x: 523.7, y: 671.1,
      when: (d: PrsFormData) => d.isa_acks[4] === 'yes',
    },
    {
      type: 'checkbox', key: 'isa_acks', page: 2, x: 539.5, y: 671.1,
      when: (d: PrsFormData) => d.isa_acks[4] === 'no',
    },

    // ── Signature area – Principal Holder ─────────────────────────────────
    // 'Name:' at x=42.5 y=595.2, 'Date:' at x=42.5 y=587.8
    { key: 'full_name',  page: 2, x: 75, y: 595.2, maxWidth: 210 },
    { key: 'sign_date',  page: 2, x: 75, y: 587.8, maxWidth: 180 },

    // ── Signature area – UTC / Consultant ────────────────────────────────
    // 'Name:' at x=304.2 y=595.2, 'UTC Code:' at x=304.2 y=587.8, 'Date:' at x=304.2 y=580.3
    { key: 'consultant_name', page: 2, x: 336, y: 595.2, maxWidth: 220 },
    { key: 'consultant_code', page: 2, x: 352, y: 587.8, maxWidth: 200 },
    { key: 'sign_date',       page: 2, x: 336, y: 580.3, maxWidth: 180 },
  ],
};
