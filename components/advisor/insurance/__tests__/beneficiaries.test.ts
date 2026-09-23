import { describe, expect, it } from 'vitest';
import {
  beneficiariesTotal, beneficiaryFromRecord, emptyBeneficiary, isBeneficiaryFilled,
  toBeneficiaryRecords, validateBeneficiaries, type BeneficiaryForm,
} from '../beneficiaries';

const row = (name: string, relationship: string, share_pct: string): BeneficiaryForm => ({
  key: name || Math.random().toString(36), name, relationship, share_pct,
});

describe('validateBeneficiaries', () => {
  it('is valid when the list is entirely empty', () => {
    expect(validateBeneficiaries([])).toEqual({ valid: true, total: 0, hasEntries: false });
  });

  it('is valid when every row is blank (e.g. a freshly-added row)', () => {
    const v = validateBeneficiaries([emptyBeneficiary(), emptyBeneficiary()]);
    expect(v.valid).toBe(true);
    expect(v.hasEntries).toBe(false);
  });

  it('is valid when filled rows sum to exactly 100%', () => {
    const v = validateBeneficiaries([
      row('Spouse', 'spouse', '60'),
      row('Child', 'child', '40'),
    ]);
    expect(v.valid).toBe(true);
    expect(v.total).toBe(100);
    expect(v.hasEntries).toBe(true);
  });

  it('rejects a total under 100%', () => {
    const v = validateBeneficiaries([row('Spouse', 'spouse', '50')]);
    expect(v.valid).toBe(false);
    expect(v.total).toBe(50);
  });

  it('rejects a total over 100%', () => {
    const v = validateBeneficiaries([
      row('Spouse', 'spouse', '70'),
      row('Child', 'child', '50'),
    ]);
    expect(v.valid).toBe(false);
    expect(v.total).toBe(120);
  });

  it('tolerates floating point rounding (e.g. 33.34 + 33.33 + 33.33)', () => {
    const v = validateBeneficiaries([
      row('A', 'child', '33.34'),
      row('B', 'child', '33.33'),
      row('C', 'child', '33.33'),
    ]);
    expect(v.valid).toBe(true);
  });

  it('ignores blank rows mixed in with filled ones', () => {
    const v = validateBeneficiaries([
      row('Spouse', 'spouse', '100'),
      emptyBeneficiary(),
    ]);
    expect(v.valid).toBe(true);
    expect(v.total).toBe(100);
  });

  it('treats a row with only a name (no share_pct) as filled, so it still blocks an incomplete total', () => {
    const v = validateBeneficiaries([row('Spouse', '', '')]);
    expect(v.hasEntries).toBe(true);
    expect(v.valid).toBe(false);
    expect(v.total).toBe(0);
  });
});

describe('isBeneficiaryFilled', () => {
  it('is false for an all-blank row', () => {
    expect(isBeneficiaryFilled(emptyBeneficiary())).toBe(false);
  });
  it('is true once any field has content', () => {
    expect(isBeneficiaryFilled(row('', 'spouse', ''))).toBe(true);
  });
});

describe('beneficiariesTotal', () => {
  it('sums only filled rows, treating unparseable share_pct as 0', () => {
    expect(beneficiariesTotal([row('A', 'x', '30'), row('B', 'x', 'abc'), emptyBeneficiary()])).toBe(30);
  });
});

describe('toBeneficiaryRecords / beneficiaryFromRecord round-trip', () => {
  it('drops blank rows and coerces share_pct to a number', () => {
    const records = toBeneficiaryRecords([
      row('Spouse', 'spouse', '60'),
      row('Child', 'child', '40'),
      emptyBeneficiary(),
    ]);
    expect(records).toEqual([
      { name: 'Spouse', relationship: 'spouse', share_pct: 60 },
      { name: 'Child', relationship: 'child', share_pct: 40 },
    ]);
  });

  it('trims whitespace from name/relationship', () => {
    const records = toBeneficiaryRecords([row('  Spouse  ', ' spouse ', '100')]);
    expect(records).toEqual([{ name: 'Spouse', relationship: 'spouse', share_pct: 100 }]);
  });

  it('rebuilds form rows from saved jsonb records', () => {
    const form = beneficiaryFromRecord({ name: 'Spouse', relationship: 'spouse', share_pct: 60 });
    expect(form.name).toBe('Spouse');
    expect(form.relationship).toBe('spouse');
    expect(form.share_pct).toBe('60');
    expect(typeof form.key).toBe('string');
  });

  it('handles a null/undefined record gracefully', () => {
    const form = beneficiaryFromRecord(null);
    expect(form.name).toBe('');
    expect(form.relationship).toBe('');
    expect(form.share_pct).toBe('');
  });
});
