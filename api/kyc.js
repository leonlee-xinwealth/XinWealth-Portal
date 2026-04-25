import { supabaseAdmin } from './_lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, custom_fields')
      .eq('user_id', user.id)
      .single();

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const clientId = client.id;

    const { income, assets, liabilities, expenses, investments, ...basic } = req.body;

    // Update Client Record
    const KNOWN_CLIENT_FIELDS = [
      'familyName', 'givenName', 'salutation', 'email', 'dateOfBirth', 'nationality',
      'residency', 'maritalStatus', 'retirementAge', 'employmentStatus', 'taxStatus',
      'occupation', 'pdpaAccepted', 'globalMonth', 'globalYear'
    ];

    const customFields = { ...client.custom_fields };
    Object.entries(basic).forEach(([k, v]) => {
      if (!KNOWN_CLIENT_FIELDS.includes(k)) {
        customFields[k] = v;
      }
    });

    const updateClientData = {
      family_name: basic.familyName || "",
      given_name: basic.givenName || "",
      date_of_birth: basic.dateOfBirth ? new Date(basic.dateOfBirth).toISOString().split('T')[0] : null,
      nationality: basic.nationality || "",
      residency: basic.residency || "",
      marital_status: basic.maritalStatus || "",
      retirement_age: parseInt(basic.retirementAge) || 55,
      employment_status: basic.employmentStatus || "",
      tax_status: basic.taxStatus || "",
      occupation: basic.occupation || "",
      pdpa_accepted: !!basic.pdpaAccepted,
      custom_fields: customFields
    };

    await supabaseAdmin.from('clients').update(updateClientData).eq('id', clientId);

    const month = parseInt(basic.globalMonth || new Date().getMonth(), 10) + 1; // 1-12
    const year = parseInt(basic.globalYear || new Date().getFullYear(), 10);

    const mapToTable = (items, knownKeys, mapper) => {
      if (!items || !items.length) return [];
      return items.map(item => {
        const mapped = mapper(item);
        const custom_fields = {};
        Object.keys(item).forEach(k => {
          if (!knownKeys.includes(k)) custom_fields[k] = item[k];
        });
        return { ...mapped, custom_fields };
      });
    };

    // Incomes
    const allIncomes = [];
    const incomeMappings = [
      { key: 'salary', category: 'Salary', desc: 'Monthly Base Pay' },
      { key: 'bonus', category: 'Bonus / One-off Incentives', desc: 'Bonus/Incentive' },
      { key: 'directorFee', category: 'Director / Advisory / Professional Fees', desc: 'Director/Advisory/Professional Fee' },
      { key: 'commission', category: 'Commission / Referral Fee', desc: 'Commission/Referral Fee' },
      { key: 'dividendCompany', category: 'Dividend from Own Company', desc: 'Dividend from Own Company' },
      { key: 'dividendInvestment', category: 'Investment Dividends / Interest', desc: 'Investment Dividends/Interest' },
      { key: 'rentalIncome', category: 'Rental Income', desc: 'Rental Income' }
    ];
    for (const mapping of incomeMappings) {
      if (income && income[mapping.key]) {
        allIncomes.push({
          category: mapping.category,
          description: mapping.desc,
          amount: income[mapping.key],
          month, year
        });
      }
    }
    const incomeRecords = mapToTable(allIncomes, ['category', 'description', 'amount', 'month', 'year'], item => ({
      client_id: clientId,
      category: item.category,
      description: item.description,
      amount: parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      month: item.month,
      year: item.year
    }));

    // NetWorth items
    const allNetWorthItems = [
      ...(assets?.properties || []).map(p => ({ ...p, mainType: "Asset", n_category: "Property" })),
      ...(assets?.vehicles || []).map(v => ({ ...v, mainType: "Asset", n_category: "Vehicle" })),
      ...(assets?.otherAssets || []).map(o => ({ ...o, mainType: "Asset", n_category: "Other" })),
      
      ...(investments?.etf || []).map(i => ({ ...i, mainType: "Investment", n_category: "ETF" })),
      ...(investments?.stocks || []).map(i => ({ ...i, mainType: "Investment", n_category: "Stocks" })),
      ...(investments?.bonds || []).map(i => ({ ...i, mainType: "Investment", n_category: "Bonds" })),
      ...(investments?.unitTrusts || []).map(i => ({ ...i, mainType: "Investment", n_category: "Unit Trust" })),
      ...(investments?.fixedDeposits || []).map(i => ({ ...i, mainType: "Investment", n_category: "Investment Properties" })),
      ...(investments?.forex || []).map(i => ({ ...i, mainType: "Investment", n_category: "Forex" })),
      ...(investments?.moneyMarket || []).map(i => ({ ...i, mainType: "Investment", n_category: "Money Market" })),
      ...(investments?.otherInvestments || []).map(i => ({ ...i, mainType: "Investment", n_category: "Other" })),
      
      ...(liabilities?.studyLoans || []).map(l => ({ ...l, mainType: "Liability", n_category: "Study Loan" })),
      ...(liabilities?.personalLoans || []).map(l => ({ ...l, mainType: "Liability", n_category: "Personal Loan" })),
      ...(liabilities?.renovationLoans || []).map(l => ({ ...l, mainType: "Liability", n_category: "Renovation Loan" })),
      ...(liabilities?.otherLoans || []).map(l => ({ ...l, mainType: "Liability", n_category: "Other Loan" }))
    ];

    const pushSimpleAsset = (val, desc, cat) => {
        if (val) allNetWorthItems.push({ description: desc, amount: val, mainType: "Asset", n_category: cat });
    };
    pushSimpleAsset(assets?.savingsAccount, "Savings/Current Account", "Savings");
    pushSimpleAsset(assets?.fixedDeposit, "Fixed Deposit", "Savings");
    pushSimpleAsset(assets?.moneyMarketFund, "Money Market Fund For Savings", "Savings");
    pushSimpleAsset(assets?.epfPersaraan, "EPF Account 1 (Akaun Persaraan)", "EPF");
    pushSimpleAsset(assets?.epfSejahtera, "EPF Account 2 (Akaun Sejahtera)", "EPF");
    pushSimpleAsset(assets?.epfFleksibel, "EPF Account 3 (Akaun Fleksibel)", "EPF");

    const allLiabilityDupes = [
      ...(assets?.properties || []).filter(p => p.isUnderLoan).map(p => ({ ...p, isDuplicateLiability: true, amount: p.outstandingBalance, mainType: "Liability", n_category: "Mortgage" })),
      ...(assets?.vehicles || []).filter(v => v.isUnderLoan).map(v => ({ ...v, isDuplicateLiability: true, amount: v.outstandingBalance, mainType: "Liability", n_category: "Car Loan" })),
      ...(investments?.fixedDeposits || []).filter(i => i.isUnderLoan).map(i => ({ ...i, isDuplicateLiability: true, amount: i.outstandingBalance, mainType: "Liability", n_category: "Mortgage" }))
    ];

    const combinedNetWorthItems = [...allNetWorthItems, ...allLiabilityDupes];

    const knownNwKeys = ['mainType', 'n_category', 'description', 'amount', 'purchasePrice', 'originalLoanAmount', 'month', 'year', 'isUnderLoan', 'outstandingBalance', 'monthlyIncome', 'monthlyExpenses', 'monthlyInstallment', 'isDuplicateLiability'];

    const nwRecords = mapToTable(combinedNetWorthItems, knownNwKeys, item => ({
      client_id: clientId,
      type: item.mainType,
      category: item.n_category,
      description: item.description || "",
      value: parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      original_purchase_price: item.purchasePrice ? parseFloat(String(item.purchasePrice).replace(/,/g, '')) : null,
      original_loan_amount: item.originalLoanAmount ? parseFloat(String(item.originalLoanAmount).replace(/,/g, '')) : null,
      month: item.month || month,
      year: item.year || year
    }));

    // Standard Expenses
    const allExpenses = [
      ...(expenses?.household || []).map(e => ({ ...e, category: "Household" })),
      ...(expenses?.transportation || []).map(e => ({ ...e, category: "Transportation" })),
      ...(expenses?.dependants || []).map(e => ({ ...e, category: "Dependants" })),
      ...(expenses?.personal || []).map(e => ({ ...e, category: "Personal" })),
      ...(expenses?.miscellaneous || []).map(e => ({ ...e, category: "Miscellaneous" })),
      ...(expenses?.otherExpenses || []).map(e => ({ ...e, category: "Other" }))
    ];

    const expRecords = mapToTable(allExpenses, ['category', 'type', 'amount', 'month', 'year'], item => ({
      client_id: clientId,
      category: item.category,
      type: item.type || "",
      amount: parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      month: item.month || month,
      year: item.year || year
    }));

    // Perform inserts
    if (incomeRecords.length > 0) await supabaseAdmin.from('incomes').insert(incomeRecords);
    if (expRecords.length > 0) await supabaseAdmin.from('expenses').insert(expRecords);
    
    if (nwRecords.length > 0) {
      const { data: insertedNw, error: nwError } = await supabaseAdmin.from('networth').insert(nwRecords).select();
      if (nwError) throw nwError;

      // Snapshots
      const snapshotsToCreate = [];
      combinedNetWorthItems.forEach((item, index) => {
          if (!item.isDuplicateLiability && insertedNw[index]) {
              const outBal = parseFloat(String(item.outstandingBalance || '0').replace(/,/g, ''));
              const mInc = parseFloat(String(item.monthlyIncome || '0').replace(/,/g, ''));
              const mExp = parseFloat(String(item.monthlyExpenses || '0').replace(/,/g, ''));
              const mRepay = parseFloat(String(item.monthlyInstallment || '0').replace(/,/g, ''));
              
              if (outBal > 0 || mInc > 0 || mExp > 0 || mRepay > 0) {
                  const snapDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
                  snapshotsToCreate.push({
                      client_id: clientId,
                      networth_id: insertedNw[index].id,
                      snapshot_date: snapDate,
                      current_value: outBal,
                      monthly_income: mInc,
                      monthly_expenses: mExp,
                      monthly_repayment: mRepay
                  });
              }
          }
      });

      if (snapshotsToCreate.length > 0) {
        await supabaseAdmin.from('monthly_snapshots').insert(snapshotsToCreate);
      }
    }

    return res.status(200).json({ success: true, submissionId: clientId });

  } catch (error) {
    console.error("KYC Submission Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
