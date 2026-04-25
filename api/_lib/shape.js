// Convert Supabase rows → the { id, fields: {...} } shape the frontend expects.
// Field names mirror the original Lark schema so existing UI code stays untouched.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const monthName = (idx) => {
  const i = parseInt(idx, 10);
  return Number.isFinite(i) && i >= 0 && i <= 11 ? MONTH_NAMES[i] : '';
};

export const monthIndex = (val) => {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && val >= 0 && val <= 11) return val;
  const s = String(val).trim();
  const asNum = parseInt(s, 10);
  if (Number.isFinite(asNum) && asNum >= 0 && asNum <= 11) return asNum;
  const found = MONTH_NAMES.findIndex(
    (m) => m.toLowerCase() === s.toLowerCase()
  );
  return found >= 0 ? found : null;
};

export const toMs = (date) => {
  if (!date) return null;
  const t = new Date(date).getTime();
  return Number.isFinite(t) ? t : null;
};

const spread = (custom) =>
  custom && typeof custom === 'object' ? custom : {};

export const clientRowToFrontend = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    record_id: row.id,
    fields: {
      'Full Name': row.full_name || '',
      'Client': row.full_name || '',
      'Family Name': row.family_name || '',
      'Given Name': row.given_name || '',
      'Salutation': row.salutation || '',
      'Email Address': row.email || '',
      'Email': row.email || '',
      'NRIC': row.nric || '',
      'IC Number': row.nric || '',
      'Contact Number': row.contact_number || '',
      'Date of Birth': toMs(row.date_of_birth),
      'DOB': toMs(row.date_of_birth),
      'Age': row.age != null ? String(row.age) : '',
      'Retirement Age': row.retirement_age != null ? row.retirement_age : '',
      'Gender': row.gender || '',
      'Marital Status': row.marital_status || '',
      'Nationality': row.nationality || '',
      'Residency': row.residency || '',
      'Occupation': row.occupation || '',
      'Employment': row.employment_status || '',
      'Employment Status': row.employment_status || '',
      'Tax Status': row.tax_status || '',
      'Advisor': row.advisor || '',
      'EPF Account Number': row.epf_account_number || '',
      'PPA Account Number': row.ppa_account_number || '',
      'Correspondence Address': row.correspondence_address || '',
      'Correspondence City': row.correspondence_city || '',
      'Correspondence State': row.correspondence_state || '',
      'Correspondence Postal Code': row.correspondence_postal_code || '',
      'PDPA Accepted': row.pdpa_accepted ? 'Yes' : 'No',
      'Submission Date': toMs(row.submission_date),
      ...spread(row.custom_fields)
    }
  };
};

export const incomeRowToFrontend = (row) => ({
  id: row.id,
  record_id: row.id,
  fields: {
    'Category': row.category || '',
    'Description': row.description || '',
    'Amount': Number(row.amount) || 0,
    'Month': monthName(row.month),
    'Year': row.year != null ? String(row.year) : '',
    ...spread(row.custom_fields)
  }
});

export const expenseRowToFrontend = (row) => ({
  id: row.id,
  record_id: row.id,
  fields: {
    'Category': row.category || '',
    'Type': row.type || '',
    'Description': row.description || '',
    'Amount': Number(row.amount) || 0,
    'Month': monthName(row.month),
    'Year': row.year != null ? String(row.year) : '',
    ...spread(row.custom_fields)
  }
});

export const networthRowToFrontend = (row) => ({
  id: row.id,
  record_id: row.id,
  fields: {
    'Type': row.type || '',
    'Category': row.category || '',
    'Description': row.description || '',
    'Value': Number(row.value) || 0,
    'Original Purchase Price/Principal':
      row.original_purchase_price != null ? Number(row.original_purchase_price) : null,
    'Original Loan Amount':
      row.original_loan_amount != null ? Number(row.original_loan_amount) : null,
    'Linked Asset': row.linked_asset_id ? [{ id: row.linked_asset_id }] : [],
    'Month': monthName(row.month),
    'Year': row.year != null ? String(row.year) : '',
    ...spread(row.custom_fields)
  }
});

export const investmentRowToFrontend = (row) => ({
  id: row.id,
  record_id: row.id,
  fields: {
    'Category': row.category || '',
    'Description': row.description || '',
    'Amount': Number(row.amount) || 0,
    'End Value': row.end_value != null ? Number(row.end_value) : 0,
    'Cashflow': row.cashflow != null ? Number(row.cashflow) : 0,
    'FD': row.fd_comparison != null ? Number(row.fd_comparison) : 0,
    'Date': toMs(row.invested_date),
    'Month': monthName(row.month),
    'Year': row.year != null ? String(row.year) : '',
    ...spread(row.custom_fields)
  }
});

export const insuranceRowToFrontend = (row) => ({
  id: row.id,
  record_id: row.id,
  fields: {
    'Insurer': row.insurer || '',
    'Plan Name': row.plan_name || '',
    'Policy Number': row.policy_number || '',
    'Coverage': row.coverage || '',
    'Sum Assured': row.sum_assured != null ? Number(row.sum_assured) : 0,
    'Premium': row.premium != null ? Number(row.premium) : 0,
    'Personal Accident': row.personal_accident != null ? Number(row.personal_accident) : 0,
    'Medical Annual limit':
      row.medical_annual_limit != null ? Number(row.medical_annual_limit) : 0,
    'Advance Critical Illness':
      row.advance_critical_illness != null ? Number(row.advance_critical_illness) : 0,
    'Early Critical Illness':
      row.early_critical_illness != null ? Number(row.early_critical_illness) : 0,
    'TPD': row.tpd != null ? Number(row.tpd) : 0,
    'Death': row.death != null ? Number(row.death) : 0,
    'E-policy': row.policy_url ? [{ link: row.policy_url, text: row.policy_url }] : [],
    ...spread(row.custom_fields)
  }
});

export const snapshotRowToFrontend = (row) => ({
  id: row.id,
  record_id: row.id,
  fields: {
    'Net Worth': row.networth_id ? [{ id: row.networth_id }] : [],
    'Date': toMs(row.snapshot_date),
    'Current Value': row.current_value != null ? Number(row.current_value) : 0,
    'Cashflow': row.cashflow != null ? Number(row.cashflow) : 0,
    'Monthly Income': row.monthly_income != null ? Number(row.monthly_income) : 0,
    'Monthly Expenses': row.monthly_expenses != null ? Number(row.monthly_expenses) : 0,
    'Monthly Repayment':
      row.monthly_repayment != null ? Number(row.monthly_repayment) : 0,
    ...spread(row.custom_fields)
  }
});

// Helper: split an arbitrary input object into known columns + custom_fields.
// Pass a list of allowed keys; everything else gets routed to custom_fields.
export const partitionCustom = (input, knownKeys) => {
  const known = {};
  const custom = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (v === undefined) continue;
    if (knownKeys.includes(k)) known[k] = v;
    else custom[k] = v;
  }
  return { known, custom };
};

export const parseAmount = (val) => {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/RM/gi, '').replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};
