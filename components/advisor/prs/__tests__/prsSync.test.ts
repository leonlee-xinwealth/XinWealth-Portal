// components/advisor/prs/__tests__/prsSync.test.ts
import { describe, it, expect } from 'vitest';
import { fromClient, toClientsPayload } from '../prsSync';
import { initialPrsFormData } from '../../../../types/prs';

describe('fromClient (clients row → prefilled form_data)', () => {
  it('maps overlapping fields', () => {
    const d = fromClient({
      full_name: 'Tan Ah Kow', nric: '900101-14-5678', date_of_birth: '1990-01-01',
      gender: 'male', race: 'Chinese', marital_status: 'married',
      phone: '0123456789', email: 'a@b.com',
      correspondence_address: '88 Jalan Test', correspondence_city: 'PJ',
      correspondence_state: 'Selangor', correspondence_postal_code: '47000',
      employer_name: 'ACME', tax_residency: 'resident', tin_number: 'IG123',
      epf_account_number: '888', ppa_account_number: 'PPA1',
      bank_name: 'MAYBANK', bank_account_number: '123', pep_status: false,
      source_of_funds: 'Employment',
    });
    expect(d.full_name).toBe('Tan Ah Kow');
    expect(d.race).toBe('chinese');             // free text normalized to enum
    expect(d.phone_mobile).toBe('0123456789');
    expect(d.corr_postcode).toBe('47000');
    expect(d.pep_status).toBe('no');
    expect(d.source_of_funds).toBe('employment');
    expect(d.ppa_account_no).toBe('PPA1');
  });
  it('unknown race goes to others and preserves original text', () => {
    const d = fromClient({ race: 'Eurasian' });
    expect(d.race).toBe('others');
    expect(d.race_other).toBe('Eurasian');
  });
  it('empty input returns empty object (preserves initial values)', () => {
    expect(fromClient({})).toEqual({});
  });
});

describe('toClientsPayload (form_data → clients update)', () => {
  it('outputs only non-empty fields with valid enums', () => {
    const p = toClientsPayload({
      ...initialPrsFormData,
      full_name: 'Tan Ah Kow', nric: '900101-14-5678', gender: 'male',
      race: 'chinese', marital_status: 'married', phone_mobile: '012',
      pep_status: 'yes', tax_residency: 'resident',
      isa_q1_age: '3', isa_q2_experience: '3', isa_q3_understanding: '3',
      isa_q4_objective: '3', isa_q5_duration: '3', isa_q6_risk: '3', // total 18 → moderate
    });
    expect(p.full_name).toBe('Tan Ah Kow');
    expect(p.phone).toBe('012');
    expect(p.pep_status).toBe(true);
    expect(p.risk_profile).toBe('moderate');
    expect(p).not.toHaveProperty('email');          // empty values not output
    expect(p).not.toHaveProperty('date_of_birth');
  });
  it('race=others writes back race_other text', () => {
    const p = toClientsPayload({ ...initialPrsFormData, race: 'others', race_other: 'Eurasian' });
    expect(p.race).toBe('Eurasian');
  });
});
