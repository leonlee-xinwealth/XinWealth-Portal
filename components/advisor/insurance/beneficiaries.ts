// P5 (2026-09-26-cfp-p5-insurance-design.md, Task B / 施工单 §B): pure helpers
// for the InsuranceTab beneficiary list editor. `insurance_policies.beneficiaries`
// is `jsonb` shaped `[{name, relationship, share_pct}]` — kept as-is (决策 2),
// this module only validates/(de)serialises the editable form rows.

/** One editable beneficiary row — form values stay strings, same convention
 *  as every other numeric field in InsuranceTab's form state. */
export interface BeneficiaryForm {
  key: string;
  name: string;
  relationship: string;
  share_pct: string;
}

/** The persisted jsonb shape. */
export interface BeneficiaryRecord {
  name: string;
  relationship: string;
  share_pct: number;
}

const TOLERANCE = 0.01;

export function emptyBeneficiary(): BeneficiaryForm {
  return { key: Math.random().toString(36).slice(2), name: '', relationship: '', share_pct: '' };
}

export function beneficiaryFromRecord(r: any): BeneficiaryForm {
  return {
    key: Math.random().toString(36).slice(2),
    name: r?.name != null ? String(r.name) : '',
    relationship: r?.relationship != null ? String(r.relationship) : '',
    share_pct: r?.share_pct != null ? String(r.share_pct) : '',
  };
}

/** A row counts as "entered" once any field has content — an all-blank row
 *  (e.g. one just added by the "+" button) never blocks save or joins the total. */
export function isBeneficiaryFilled(b: BeneficiaryForm): boolean {
  return b.name.trim() !== '' || b.relationship.trim() !== '' || b.share_pct.trim() !== '';
}

export function beneficiariesTotal(list: BeneficiaryForm[]): number {
  return list
    .filter(isBeneficiaryFilled)
    .reduce((sum, b) => sum + (parseFloat(b.share_pct) || 0), 0);
}

export interface BeneficiaryValidation {
  /** true when there is nothing to validate, or the filled rows sum to 100%. */
  valid: boolean;
  /** sum of share_pct across filled rows only. */
  total: number;
  /** true when at least one row has content (so a total is meaningful). */
  hasEntries: boolean;
}

/** 施工单 §B: "shares must total 100% when any beneficiary is entered — show
 *  an inline error, block save." An entirely empty list (no beneficiaries
 *  recorded yet) is valid — nothing to sum. */
export function validateBeneficiaries(list: BeneficiaryForm[]): BeneficiaryValidation {
  const filled = list.filter(isBeneficiaryFilled);
  if (filled.length === 0) return { valid: true, total: 0, hasEntries: false };
  const total = beneficiariesTotal(list);
  return { valid: Math.abs(total - 100) <= TOLERANCE, total, hasEntries: true };
}

/** Form rows -> the jsonb payload saved to `insurance_policies.beneficiaries`.
 *  Blank rows are dropped. */
export function toBeneficiaryRecords(list: BeneficiaryForm[]): BeneficiaryRecord[] {
  return list.filter(isBeneficiaryFilled).map((b) => ({
    name: b.name.trim(),
    relationship: b.relationship.trim(),
    share_pct: parseFloat(b.share_pct) || 0,
  }));
}
