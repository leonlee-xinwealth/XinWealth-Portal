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

// Parse a date string like '2026-04-01' into frontend Month/Year
export const parseDateToFrontend = (dateStr) => {
  if (!dateStr) return { month: '', year: '' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { month: '', year: '' };
  return {
    month: MONTH_NAMES[d.getMonth()],
    year: String(d.getFullYear())
  };
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
  const fullName = row.full_name || `${row.given_name || ''} ${row.family_name || ''}`.trim() || row.email;
  
  return {
    id: row.id,
    record_id: row.id,
    fields: {
      'Full Name': fullName,
      'Client': fullName,
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
      'Advisor': row.advisor || row.advisor_id || '',
      'EPF Account Number': row.epf_account_number || '',
      'PPA Account Number': row.ppa_account_number || '',
      'Correspondence Address': row.correspondence_address || '',
      'Correspondence City': row.correspondence_city || '',
      'Correspondence State': row.correspondence_state || '',
      'Correspondence Postal Code': row.correspondence_postal_code || '',
      'PDPA Accepted': (row.pdpa_accepted || row.pdpa_accepted_at) ? 'Yes' : 'No',
      'Submission Date': toMs(row.submission_date || row.created_at),
      ...spread(row.custom_fields || row.metadata)
    }
  };
};

export const incomeRowToFrontend = (row) => {
  const { month, year } = parseDateToFrontend(row.period_month || row.created_at);
  return {
    id: row.id,
    record_id: row.id,
    fields: {
      'Category': row.income_type || row.category || row.kind || '',
      'Description': row.description || row.source_note || row.name || '',
      'Amount': Number(row.amount || row.value) || 0,
      'Month': month || monthName(row.month),
      'Year': year || (row.year != null ? String(row.year) : ''),
      ...spread(row.custom_fields || row.metadata)
    }
  };
};

export const expenseRowToFrontend = (row) => {
  const { month, year } = parseDateToFrontend(row.period_month || row.created_at);
  return {
    id: row.id,
    record_id: row.id,
    fields: {
      'Category': row.category || row.kind || '',
      'Type': row.type || (row.is_fixed ? 'Fixed' : 'Variable'),
      'Description': row.description || row.name || '',
      'Amount': Number(row.amount || row.value) || 0,
      'Month': month || monthName(row.month),
      'Year': year || (row.year != null ? String(row.year) : ''),
      ...spread(row.custom_fields || row.metadata)
    }
  };
};

export const networthRowToFrontend = (row) => {
  // Logic for both Assets and Liabilities
  const isLiability = row.value < 0 || row.balance != null;
  const value = Math.abs(Number(row.value || row.balance || 0));
  const { month, year } = parseDateToFrontend(row.period_month || row.created_at);

  return {
    id: row.id,
    record_id: row.id,
    fields: {
      'Type': row.type || (isLiability ? 'Liability' : 'Asset'),
      'Category': row.category || row.kind || '',
      'Description': row.description || row.name || '',
      'Value': value,
      'Original Purchase Price/Principal':
        row.principal != null ? Number(row.principal) : (row.original_purchase_price != null ? Number(row.original_purchase_price) : null),
      'Original Loan Amount':
        row.original_loan_amount != null ? Number(row.original_loan_amount) : null,
      'Linked Asset': row.linked_asset_id ? [{ id: row.linked_asset_id }] : [],
      'Month': month || monthName(row.month),
      'Year': year || (row.year != null ? String(row.year) : ''),
      ...spread(row.custom_fields || row.metadata)
    }
  };
};

export const investmentRowToFrontend = (row) => {
  const { month, year } = parseDateToFrontend(row.purchased_at || row.created_at);
  return {
    id: row.id,
    record_id: row.id,
    fields: {
      'Category': row.asset_class || row.category || '',
      'Description': row.description || row.name || (row.ticker ? `${row.ticker} (${row.name})` : ''),
      'Amount': Number(row.amount || row.cost_basis) || 0,
      'End Value': row.end_value || row.current_value || 0,
      'Cashflow': row.cashflow != null ? Number(row.cashflow) : 0,
      'FD': row.fd_comparison != null ? Number(row.fd_comparison) : 0,
      'Date': toMs(row.purchased_at || row.invested_date),
      'Month': month || monthName(row.month),
      'Year': year || (row.year != null ? String(row.year) : ''),
      ...spread(row.custom_fields || row.metadata)
    }
  };
};

export const insuranceRowToFrontend = (row) => ({
  id: row.id,
  record_id: row.id,
  fields: {
    'Insurer': row.provider || row.insurer || '',
    'Plan Name': row.policy_type || row.plan_name || '',
    'Policy Number': row.policy_number || '',
    'Coverage': row.coverage || '',
    'Sum Assured': row.sum_assured != null ? Number(row.sum_assured) : 0,
    'Premium': row.premium != null ? Number(row.premium) : 0,
    'Personal Accident': row.personal_accident != null ? Number(row.personal_accident) : 0,
    ...spread(row.custom_fields || row.metadata)
  }
});

export const monthlySnapshotRowToFrontend = (row) => ({
  id: row.id || `${row.profile_id}-${row.snapshot_date}`,
  record_id: row.id || `${row.profile_id}-${row.snapshot_date}`,
  fields: {
    'Net Worth': row.networth_id ? [{ id: row.networth_id }] : [],
    'Date': toMs(row.snapshot_date),
    'Current Value': row.market_value || row.current_value || 0,
    'Cashflow': row.cashflow || 0,
    'Monthly Income': row.monthly_income || 0,
    'Monthly Expenses': row.monthly_expenses || 0,
    'Monthly Repayment': row.monthly_repayment || 0,
    ...spread(row.custom_fields || row.metadata)
  }
});

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
