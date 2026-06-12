// pdf/mappings/topUp.ts
// PRS Plus Top-Up / Change of Contribution Direction Form
// Template: public/forms/prs/top-up.pdf (2 pages, A4 595×842pt; page 2 is terms only)
//
// Coordinates extracted via scripts/extract_pdf_labels.py + pdfplumber rect analysis.
// pdf-lib coordinate origin is bottom-left; H=841.89.
// All coordinates are centre-of-cell or baseline for text fields.
//
// Page 1 field layout (top-down):
//   y_bl ~767: Checkboxes — Contribution (Top-up) at cx=340 | Change of Direction at cx=453.7
//   y_bl ~737: PPA Account No (comb 13 cells, L side) | PRS Plus Account No (comb 6 cells, R side)
//   y_bl ~722: NRIC No (comb 12 cells) | Other ID No (comb 11 cells, right side)
//   y_bl ~699: Name (comb 38 cells — treated as plain text, wide span)
//   y_bl ~684: Contact No (comb cells) | Email Address (comb cells)
//   y_bl ~629: Contribution Amount (comb 9 cells) | Cheque No (text underline)
//   y_bl ~618: Regular Savings Plan checkbox
//   y_bl ~599: RSP Bank name (comb 14 cells)
//   y_bl ~584: RSP Bank A/C No (comb) | Deduction Date DD (comb 2 cells) | Amount RM (comb 6 cells)
//   y_bl ~536: EPF redirection % checkboxes (1%–7%)
//   y_bl ~514: Salary deduction % (checkbox) | RM (checkbox)
//   y_bl ~713: Applicant Date (near Signature line)
//   y_bl  ~86: Consultant/Staff Code | Branch Name & Code
//   y_bl  ~74: Consultant/Staff Name
//   y_bl  ~61: Consultant H/P No | Date | Class For Application

import type { FormMapping } from '../mappingTypes';
import type { PrsFormData } from '../../types/prs';

export const topUpMapping: FormMapping = {
  id: 'top-up',
  templateFile: 'top-up.pdf',
  labelEn: 'PRS Top-Up / Change Direction',
  labelZh: 'PRS 追加供款 / 更改方向',
  version: 'v1',
  recommendedKeys: [
    'full_name', 'nric', 'ppa_account_no', 'prs_plus_account_no',
    'contribution_amount', 'topup_type',
  ],
  fields: [
    // ── §0 Form type checkboxes ──────────────────────────────────────────────
    // "Contribution (Top-up)" box: x0=335.3 at y_top=70.7 → cx=340.0 cy_bl=766.9
    {
      type: 'checkbox', key: 'topup_type', page: 0,
      x: 340.0, y: 766.9,
      when: (d: PrsFormData) => d.topup_type === 'topup',
    },
    // "Change of Contribution Direction" box: x0=449 y_top=70.4 → cx=453.7 cy_bl=767.2
    {
      type: 'checkbox', key: 'topup_type', page: 0,
      x: 453.7, y: 767.2,
      when: (d: PrsFormData) => d.topup_type === 'change_direction',
    },

    // ── §1 Particulars of Applicant ─────────────────────────────────────────
    // PPA Account No — left side comb (13 cells: 3+2+8 separated by pre-printed dashes)
    // First cell centre: x=102.8 y_bl=737.3, cellWidth=12.3
    // Layout: cells 0-2 (x=97-133), gap, cells 3-4 (x=145-170), gap, cells 5-12 (x=182-280)
    // Best filled as plain text starting at first cell
    { key: 'ppa_account_no', page: 0, x: 102, y: 737.3, maxWidth: 178 },

    // PRS Plus Account No — right side (6 cells starting at cx=408.8, y_bl=737.4)
    // cellWidth=12.3; cells at cx=408.8, 433.0, 445.3, 457.7, 470.1, 494.3
    {
      type: 'comb', key: 'prs_plus_account_no', page: 0,
      x: 408.8, y: 737.4, cellWidth: 12.3, cells: 6,
    },

    // NRIC No — left side (12 cells: 6+2+4, separated by pre-printed dashes)
    // First cell centre: x=65.1 y_bl=721.8, cellWidth=12.3
    // Strip hyphens so 900101-14-5678 → 900101145678 fills 12 cells
    {
      type: 'comb', key: 'nric', page: 0,
      x: 65.1, y: 721.8, cellWidth: 12.3, cells: 12,
      strip: /[\s-]/g,
    },

    // Other ID No — right side (11 cells: first at cx=420.8, then 10 at cx=445.4)
    // Treat as plain text starting at the first cell
    { key: 'other_id_no', page: 0, x: 420, y: 722.4, maxWidth: 140 },

    // Name — 38 comb cells spanning x=22–562; treat as wide plain text
    // First cell at x0=22.2, y_bl=699.0
    { key: 'full_name', page: 0, x: 28, y: 699.0, maxWidth: 530 },

    // Contact No — comb cells: 3 + 8 = 11 cells; '-' separator is pre-printed at x≈112
    // First cell centre: cx=76.9 y_bl=684.1, cellWidth=12.3
    {
      type: 'comb', key: 'phone_mobile', page: 0,
      x: 76.9, y: 684.1, cellWidth: 12.3, cells: 11,
      strip: /[\s-]/g,
    },

    // Email Address — comb cells starting x=291.9 y_bl=684.1 (10+7+3=20 cells visible)
    // Use plain text for email — too many cells, better as compact text
    { key: 'email', page: 0, x: 298, y: 684.1, maxWidth: 260, uppercase: false },

    // ── §2a Individual Contribution — Contribution Amount + Cheque No ────────
    // Contribution Amount (RM): 9 comb cells, first cx=191.4 y_bl=629.2, cellWidth=12.3
    {
      type: 'comb', key: 'contribution_amount', page: 0,
      x: 191.4, y: 629.2, cellWidth: 12.3, cells: 9,
    },

    // Cheque No.: underline starts at x=366.1 y_bl=630.5 (text baseline)
    { key: 'cheque_no', page: 0, x: 368, y: 630.5, maxWidth: 140 },

    // ── §2a — Regular Savings Plan (RSP) ─────────────────────────────────────
    // RSP checkbox at cx=45.4 y_bl=618.3
    {
      type: 'checkbox', key: 'rsp_enabled', page: 0,
      x: 45.4, y: 618.3,
      when: (d: PrsFormData) => d.rsp_enabled === true,
    },

    // RSP Bank name: 14 cells, first cx=103.4 y_bl=599.3, cellWidth=12.3
    {
      type: 'comb', key: 'rsp_bank', page: 0,
      x: 103.4, y: 599.3, cellWidth: 12.3, cells: 14,
    },

    // RSP Bank A/C No: same x-span as bank name row but y_bl=584.3
    // 6+1+4+3 = 14 cells, first cx=103.4
    {
      type: 'comb', key: 'rsp_bank_account_no', page: 0,
      x: 103.4, y: 584.3, cellWidth: 12.3, cells: 14,
      strip: /[\s-]/g,
    },

    // RSP Deduction Date (DD): 2 cells at cx=355.0 y_bl=584.4
    {
      type: 'comb', key: 'rsp_deduction_day', page: 0,
      x: 355.0, y: 584.4, cellWidth: 12.3, cells: 2,
    },

    // RSP Amount (RM): 6 cells at cx=434.3 y_bl=584.3
    {
      type: 'comb', key: 'rsp_amount', page: 0,
      x: 434.3, y: 584.3, cellWidth: 12.3, cells: 6,
    },

    // ── §2b EPF Contribution Fund Redirection — checkboxes 1%–7% ─────────────
    // Seven 10×9.4 boxes at y_bl~536.1; labels are to the right of each box
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 0,
      x: 73.1, y: 536.1,
      when: (d: PrsFormData) => d.epf_redirection_percent === '1',
    },
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 0,
      x: 113.9, y: 536.1,
      when: (d: PrsFormData) => d.epf_redirection_percent === '2',
    },
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 0,
      x: 155.3, y: 536.1,
      when: (d: PrsFormData) => d.epf_redirection_percent === '3',
    },
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 0,
      x: 196.1, y: 536.1,
      when: (d: PrsFormData) => d.epf_redirection_percent === '4',
    },
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 0,
      x: 237.2, y: 536.1,
      when: (d: PrsFormData) => d.epf_redirection_percent === '5',
    },
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 0,
      x: 278.6, y: 536.1,
      when: (d: PrsFormData) => d.epf_redirection_percent === '6',
    },
    {
      type: 'checkbox', key: 'epf_redirection_percent', page: 0,
      x: 319.4, y: 536.3,
      when: (d: PrsFormData) => d.epf_redirection_percent === '7',
    },

    // ── §2c Salary Deduction ─────────────────────────────────────────────────
    // Salary deduction % box at cx=71.8 y_bl=514.1; RM box at cx=233.6 y_bl=514.1
    // These are write-in boxes (9.2×8.7) — use plain text after the box
    // The dashed lines are: "_____ % of my salary" and "RM _____"
    // Write into the line area just after the label
    { key: 'salary_deduction_percent', page: 0, x: 78, y: 514.1, maxWidth: 50 },
    { key: 'salary_deduction_rm',      page: 0, x: 240, y: 514.1, maxWidth: 80 },

    // ── §4 General Declaration / Signature area ──────────────────────────────
    // "Date:" label at x=364.4 y_top=712.9 → y_bl=129.0; underline starts at x=381.5
    { key: 'sign_date', page: 0, x: 382, y: 129.0, maxWidth: 150 },

    // ── For PRS Consultant / Bank Use ────────────────────────────────────────
    // Consultant/Staff Code: fill after ":" underline starting x=112 y_bl=85.9
    { key: 'consultant_code', page: 0, x: 113, y: 85.9, maxWidth: 130 },

    // Branch Name & Code: underline at x=321.5 y_bl=86
    { key: 'branch_name_code', page: 0, x: 322, y: 86.0, maxWidth: 85 },

    // Consultant/Staff Name: underline at x=112 y_bl=73.8
    { key: 'consultant_name', page: 0, x: 113, y: 73.8, maxWidth: 130 },

    // Consultant H/P No: underline at x=112 y_bl=60.5
    { key: 'consultant_phone', page: 0, x: 113, y: 60.5, maxWidth: 130 },

    // Date (consultant): underline at x=272 y_bl=59.5
    // (also serves as the applicant submission date)
    // Note: sign_date already covers applicant date above; this is consultant sign date
    { key: 'sign_date', page: 0, x: 273, y: 59.5, maxWidth: 115 },

    // Class For Application: underline at x=489.1 y_bl=58.5
    { key: 'class_for_application', page: 0, x: 490, y: 58.5, maxWidth: 80 },
  ],
};
