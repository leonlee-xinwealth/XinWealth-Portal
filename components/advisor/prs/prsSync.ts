// components/advisor/prs/prsSync.ts
// form_data ↔ clients table bidirectional field sync (design doc §5 sync rules)
// NOTE: toClientsPayload logic is duplicated in api/prs-application.js (JS version).
// Both files must be kept in sync when field mappings change.
import { isaTotalScore, riskProfileFromScore, type PrsFormData } from '../../../types/prs';

const RACE_LABELS: Record<string, string> = {
  bumiputera: 'Bumiputera', chinese: 'Chinese', indian: 'Indian',
};
const SOURCE_LABELS: Record<string, string> = {
  employment: 'Employment', investment: 'Investment', retirement: 'Retirement',
  sales_of_assets: 'Sales of Assets', inheritance: 'Inheritance',
  savings: 'Savings', business: 'Business',
};
const MARITAL = ['single', 'married', 'divorced', 'widowed'];
const GENDERS = ['male', 'female'];
const TAX_RES = ['resident', 'non_resident'];

function normalizeKey(v: string | null | undefined, labels: Record<string, string>): string {
  if (!v) return '';
  const lower = v.trim().toLowerCase();
  const hit = Object.entries(labels).find(([k, label]) => k === lower || label.toLowerCase() === lower);
  return hit ? hit[0] : 'others';
}

/** clients row → partial form_data prefill (only keys with values) */
export function fromClient(client: Record<string, any>): Partial<PrsFormData> {
  const d: Partial<PrsFormData> = {};
  const direct: [keyof PrsFormData, string][] = [
    ['salutation', 'salutation'], ['full_name', 'full_name'], ['nric', 'nric'],
    ['date_of_birth', 'date_of_birth'], ['nationality', 'nationality'],
    ['phone_mobile', 'phone'], ['email', 'email'],
    ['corr_address', 'correspondence_address'], ['corr_city', 'correspondence_city'],
    ['corr_state', 'correspondence_state'], ['corr_postcode', 'correspondence_postal_code'],
    ['employer_name', 'employer_name'], ['tin_number', 'tin_number'],
    ['epf_account_number', 'epf_account_number'], ['ppa_account_no', 'ppa_account_number'],
    ['bank_name', 'bank_name'], ['bank_account_number', 'bank_account_number'],
  ];
  for (const [formKey, col] of direct) {
    if (client[col]) (d as any)[formKey] = String(client[col]);
  }
  if (client.gender && GENDERS.includes(client.gender)) d.gender = client.gender;
  if (client.marital_status && MARITAL.includes(client.marital_status)) d.marital_status = client.marital_status;
  if (client.tax_residency && TAX_RES.includes(client.tax_residency)) d.tax_residency = client.tax_residency;
  if (client.race) {
    const r = normalizeKey(client.race, RACE_LABELS);
    d.race = r as PrsFormData['race'];
    if (r === 'others') d.race_other = String(client.race);
  }
  if (client.source_of_funds) {
    const s = normalizeKey(client.source_of_funds, SOURCE_LABELS);
    d.source_of_funds = s as PrsFormData['source_of_funds'];
    if (s === 'others') d.source_of_funds_other = String(client.source_of_funds);
  }
  if (client.pep_status === true) d.pep_status = 'yes';
  if (client.pep_status === false) d.pep_status = 'no';
  if (client.occupation) d.occupation_other = String(client.occupation);
  return d;
}

/** form_data → clients update payload (only non-empty, enum-valid columns) */
export function toClientsPayload(d: PrsFormData): Record<string, any> {
  const p: Record<string, any> = {};
  const put = (col: string, v: string) => { if (v) p[col] = v; };
  put('salutation', d.salutation);
  put('full_name', d.full_name);
  put('nric', d.nric);
  put('date_of_birth', d.date_of_birth);
  if (GENDERS.includes(d.gender)) p.gender = d.gender;
  put('nationality', d.nationality);
  if (MARITAL.includes(d.marital_status)) p.marital_status = d.marital_status;
  if (d.race === 'others') put('race', d.race_other);
  else if (d.race) p.race = RACE_LABELS[d.race];
  put('phone', d.phone_mobile);
  put('email', d.email);
  put('correspondence_address', d.corr_address);
  put('correspondence_city', d.corr_city);
  put('correspondence_state', d.corr_state);
  put('correspondence_postal_code', d.corr_postcode);
  put('employer_name', d.employer_name);
  if (d.source_of_funds === 'others') put('source_of_funds', d.source_of_funds_other);
  else if (d.source_of_funds) p.source_of_funds = SOURCE_LABELS[d.source_of_funds];
  if (TAX_RES.includes(d.tax_residency)) p.tax_residency = d.tax_residency;
  put('tin_number', d.tin_number);
  put('epf_account_number', d.epf_account_number);
  put('ppa_account_number', d.ppa_account_no);
  put('bank_name', d.bank_name);
  put('bank_account_number', d.bank_account_number);
  if (d.pep_status === 'yes') p.pep_status = true;
  if (d.pep_status === 'no') p.pep_status = false;
  if (d.occupation_other) put('occupation', d.occupation_other);
  const score = isaTotalScore(d);
  if (score != null) p.risk_profile = riskProfileFromScore(score);
  return p;
}
