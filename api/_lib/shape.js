export const clientRowToFrontend = (row) => ({
  id: row.id,
  recordId: row.id,
  fields: {
    'Full Name': row.full_name,
    'Family Name': row.family_name,
    'Given Name': row.given_name,
    'Email Address': row.email,
    'NRIC': row.nric,
    'Contact Number': row.contact_number,
    'Date of Birth': row.date_of_birth,
    'Age': row.age,
    'Retirement Age': row.retirement_age,
    'Gender': row.gender,
    'Marital Status': row.marital_status,
    'Nationality': row.nationality,
    'Residency': row.residency,
    'Occupation': row.occupation,
    'Employment Status': row.employment_status,
    'Tax Status': row.tax_status,
    'Advisor': row.advisor,
    'EPF Account Number': row.epf_account_number,
    'PPA Account Number': row.ppa_account_number,
    'Correspondence Address': row.correspondence_address,
    'Correspondence City': row.correspondence_city,
    'Correspondence State': row.correspondence_state,
    'Correspondence Postal Code': row.correspondence_postal_code,
    ...row.custom_fields,
  },
});

export const incomeRowToFrontend = (row) => ({
  id: row.id,
  fields: {
    'Category': row.category,
    'Description': row.description,
    'Amount': row.amount,
    'Month': row.month?.toString(),
    'Year': row.year?.toString(),
    ...row.custom_fields,
  }
});

export const networthRowToFrontend = (row) => ({
  id: row.id,
  fields: {
    'Type': row.type,
    'Category': row.category,
    'Description': row.description,
    'Value': row.value,
    'Original Purchase Price/Principal': row.original_purchase_price,
    'Original Loan Amount': row.original_loan_amount,
    'Month': row.month?.toString(),
    'Year': row.year?.toString(),
    ...row.custom_fields,
  }
});

export const investmentRowToFrontend = (row) => ({
  id: row.id,
  fields: {
    'Category': row.category,
    'Description': row.description,
    'Amount': row.amount,
    'End Value': row.end_value,
    'Cashflow': row.cashflow,
    'FD': row.fd_comparison,
    'Date': row.invested_date,
    'Month': row.month?.toString(),
    'Year': row.year?.toString(),
    ...row.custom_fields,
  }
});

export const expenseRowToFrontend = (row) => ({
  id: row.id,
  fields: {
    'Category': row.category,
    'Type': row.type,
    'Amount': row.amount,
    'Month': row.month?.toString(),
    'Year': row.year?.toString(),
    ...row.custom_fields,
  }
});

export const insuranceRowToFrontend = (row) => ({
  id: row.id,
  fields: {
    'Coverage': row.coverage,
    'Sum Assured': row.sum_assured,
    'Premium': row.premium,
    ...row.custom_fields,
  }
});

export const monthlySnapshotRowToFrontend = (row) => ({
  id: row.id,
  fields: {
    'Net Worth': row.networth_id,
    'Current Value': row.current_value,
    'Cashflow': row.cashflow,
    'Monthly Income': row.monthly_income,
    'Monthly Expenses': row.monthly_expenses,
    'Monthly Repayment': row.monthly_repayment,
    'Date': row.snapshot_date,
    ...row.custom_fields,
  }
});
