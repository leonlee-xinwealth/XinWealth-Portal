// KYC Submission Handler (Relational)
// Maps to Vercel env vars: LARK_TABLE_CLIENT, LARK_TABLE_INCOMES, LARK_TABLE_ASSETS,
// LARK_TABLE_INVESTMENT, LARK_TABLE_LIABILITIES, LARK_TABLE_EXPENSES

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { income, assets, liabilities, expenses, investments, ...basic } = req.body;

  // 1. Env Var Check
  const appId = (process.env.LARK_APP_ID || "").trim();
  const appSecret = (process.env.LARK_APP_SECRET || "").trim();
  const baseToken = (process.env.LARK_BASE_TOKEN || "").trim();
  
  // Table IDs (matches user's Vercel env var names)
  const tableClient = (process.env.LARK_TABLE_CLIENT || "").trim();
  const tableIncomes = (process.env.LARK_TABLE_INCOMES || "").trim();
  const tableNetWorth = (process.env.LARK_TABLE_NETWORTH || "").trim();
  const tableInvestment = (process.env.LARK_TABLE_INVESTMENT || "").trim();
  const tableExpenses = (process.env.LARK_TABLE_EXPENSES || "").trim();

  if (!appId || !appSecret || !baseToken || !tableClient) {
     return res.status(500).json({ error: 'Server Config Error: Missing Lark Credentials or Table IDs.' });
  }

  // Helper: convert month index "0"-"11" to readable name
  const getMonthName = (monthIdx) => {
    const idx = parseInt(monthIdx);
    return (!isNaN(idx) && idx >= 0 && idx <= 11) ? MONTH_NAMES[idx] : '';
  };

  // Helper: build period string like "March 2026"
  const getPeriod = (month, year) => {
    const m = getMonthName(month);
    return m && year ? `${m} ${year}` : (year || '');
  };

  try {
    // 2. Get Access Token
    const tokenRes = await fetch("https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.code !== 0) throw new Error(`Lark Auth Failed: ${tokenData.msg}`);
    const accessToken = tokenData.tenant_access_token;

    const authHeader = { 
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    };

    // 3. Create Main Client Record
    const mainRecordData = {
      fields: {
        "Client": `${basic.givenName || ''} ${basic.familyName || ''}`.trim(),
        "Family Name": basic.familyName || "",
        "Given Name": basic.givenName || "",
        "Salutation": basic.salutation || "",
        "Email Address": basic.email || "",
        "DOB": basic.dateOfBirth ? new Date(basic.dateOfBirth).getTime() : null,
        "Nationality": basic.nationality || "",
        "Residency": basic.residency || "",
        "Marital Status": basic.maritalStatus || "",
        "Retirement Age": parseInt(basic.retirementAge) || 0,
        "Employment": basic.employmentStatus || "",
        "Tax Status": basic.taxStatus || "",
        "Occupation": basic.occupation || "",
        "PDPA Accepted": basic.pdpaAccepted ? "Yes" : "No",
        "Submission Date": new Date().getTime()
      }
    };

    const mainRes = await fetch(`https://open.larksuite.com/open-apis/bitable/v1/apps/${baseToken}/tables/${tableClient}/records`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify(mainRecordData)
    });
    const mainResult = await mainRes.json();
    if (mainResult.code !== 0) throw new Error(`Failed to create client record: ${mainResult.msg}`);
    
    const submissionId = mainResult.data.record.record_id;

    // Helper function to batch create sub-records
    const createSubRecords = async (tableName, items, fieldMapper) => {
      if (!tableName || !items || items.length === 0) return [];
      
      const records = items.map(item => ({
        fields: {
          ...fieldMapper(item),
          "Client": [submissionId]
        }
      }));

      // Lark batch create limit is 500
      const res = await fetch(`https://open.larksuite.com/open-apis/bitable/v1/apps/${baseToken}/tables/${tableName}/records/batch_create`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ records })
      });
      const result = await res.json();
      if (result.code !== 0) {
          console.error(`Batch create failed for ${tableName}:`, result.msg);
          return [];
      }
      return result.data.records;
    };

    // 4. Create Income Records
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
      if (income[mapping.key]) {
        allIncomes.push({
          category: mapping.category,
          description: mapping.desc,
          amount: income[mapping.key],
          month: income[`${mapping.key}Month`],
          year: income[`${mapping.key}Year`]
        });
      }
    }

    await createSubRecords(tableIncomes, allIncomes, item => {
      const fieldData = {
        "Category": item.category,
        "Description": item.description,
        "Amount": parseFloat(String(item.amount).replace(/,/g, '')) || 0
      };
      if (item.month != null) fieldData["Month"] = getMonthName(item.month);
      if (item.year) fieldData["Year"] = String(item.year);
      return fieldData;
    });

    // 5. Build Net Worth Items
    const allNetWorthItems = [
      // Assets
      ...(assets.properties || []).map(p => ({ ...p, mainType: "Asset", n_category: "Property" })),
      ...(assets.vehicles || []).map(v => ({ ...v, mainType: "Asset", n_category: "Vehicle" })),
      ...(assets.otherAssets || []).map(o => ({ ...o, mainType: "Asset", n_category: "Other" })),
      
      // Investments
      ...(investments.etf || []).map(i => ({ ...i, mainType: "Investment", n_category: "ETF" })),
      ...(investments.stocks || []).map(i => ({ ...i, mainType: "Investment", n_category: "Stocks" })),
      ...(investments.bonds || []).map(i => ({ ...i, mainType: "Investment", n_category: "Bonds" })),
      ...(investments.unitTrusts || []).map(i => ({ ...i, mainType: "Investment", n_category: "Unit Trust" })),
      ...(investments.fixedDeposits || []).map(i => ({ ...i, mainType: "Investment", n_category: "Investment Properties" })),
      ...(investments.forex || []).map(i => ({ ...i, mainType: "Investment", n_category: "Forex" })),
      ...(investments.moneyMarket || []).map(i => ({ ...i, mainType: "Investment", n_category: "Money Market" })),
      ...(investments.otherInvestments || []).map(i => ({ ...i, mainType: "Investment", n_category: "Other" })),
      
      // Liabilities (standalone)
      ...(liabilities.studyLoans || []).map(l => ({ ...l, mainType: "Liability", n_category: "Study Loan" })),
      ...(liabilities.personalLoans || []).map(l => ({ ...l, mainType: "Liability", n_category: "Personal Loan" })),
      ...(liabilities.renovationLoans || []).map(l => ({ ...l, mainType: "Liability", n_category: "Renovation Loan" })),
      ...(liabilities.otherLoans || []).map(l => ({ ...l, mainType: "Liability", n_category: "Other Loan" }))
    ];

    const pushSimpleAsset = (val, desc, cat, m, y) => {
        if (val) allNetWorthItems.push({ description: desc, amount: val, mainType: "Asset", n_category: cat, month: m, year: y });
    };
    pushSimpleAsset(assets.savingsAccount, "Savings/Current Account", "Savings", assets.savingsAccountMonth, assets.savingsAccountYear);
    pushSimpleAsset(assets.fixedDeposit, "Fixed Deposit", "Savings", assets.fixedDepositMonth, assets.fixedDepositYear);
    pushSimpleAsset(assets.moneyMarketFund, "Money Market Fund For Savings", "Savings", assets.moneyMarketFundMonth, assets.moneyMarketFundYear);
    pushSimpleAsset(assets.epfPersaraan, "EPF Account 1 (Akaun Persaraan)", "EPF", assets.epfPersaraanMonth, assets.epfPersaraanYear);
    pushSimpleAsset(assets.epfSejahtera, "EPF Account 2 (Akaun Sejahtera)", "EPF", assets.epfSejahteraMonth, assets.epfSejahteraYear);
    pushSimpleAsset(assets.epfFleksibel, "EPF Account 3 (Akaun Fleksibel)", "EPF", assets.epfFleksibelMonth, assets.epfFleksibelYear);

    // Create duplicate Liability rows for Assets/Investments that have loans, so Net Worth formula works correctly.
    // We flag these with isDuplicateLiability = true so we don't accidentally create a second snapshot for them.
    const allLiabilityDupes = [
      ...(assets.properties || []).filter(p => p.isUnderLoan).map(p => ({ ...p, isDuplicateLiability: true, amount: p.outstandingBalance, mainType: "Liability", n_category: "Mortgage" })),
      ...(assets.vehicles || []).filter(v => v.isUnderLoan).map(v => ({ ...v, isDuplicateLiability: true, amount: v.outstandingBalance, mainType: "Liability", n_category: "Car Loan" })),
      ...(investments.fixedDeposits || []).filter(i => i.isUnderLoan).map(i => ({ ...i, isDuplicateLiability: true, amount: i.outstandingBalance, mainType: "Liability", n_category: "Mortgage" }))
    ];

    const combinedNetWorthItems = [...allNetWorthItems, ...allLiabilityDupes];

    const createdNetWorthRecords = await createSubRecords(tableNetWorth, combinedNetWorthItems, item => {
      const fieldData = {
        "Type": item.mainType,
        "Category": item.n_category,
        "Description": item.description || "",
        "Value": parseFloat(String(item.amount).replace(/,/g, '')) || 0
      };
      if (item.purchasePrice) fieldData["Original Purchase Price/Principal"] = parseFloat(String(item.purchasePrice).replace(/,/g, '')) || 0;
      if (item.originalLoanAmount) fieldData["Original Loan Amount"] = parseFloat(String(item.originalLoanAmount).replace(/,/g, '')) || 0;
      if (item.month != null) fieldData["Month"] = getMonthName(item.month);
      if (item.year) fieldData["Year"] = String(item.year);
      return fieldData;
    });

    // 6. Create Monthly Snapshots
    // Map the created record_ids back to the robust items.
    const snapshotsToCreate = [];
    combinedNetWorthItems.forEach((item, index) => {
        if (!item.isDuplicateLiability && createdNetWorthRecords[index]) {
            const outBal = parseFloat(String(item.outstandingBalance || '0').replace(/,/g, ''));
            const mInc = parseFloat(String(item.monthlyIncome || '0').replace(/,/g, ''));
            const mExp = parseFloat(String(item.monthlyExpenses || '0').replace(/,/g, ''));
            const mRepay = parseFloat(String(item.monthlyInstallment || '0').replace(/,/g, ''));
            
            // If they have any snapshot-worthy metrics:
            if (outBal > 0 || mInc > 0 || mExp > 0 || mRepay > 0) {
                // Ensure Date logic matches user expectations. We use the month/year of the asset itself as the snapshot period.
                const fallbackTime = new Date().getTime();
                const snapYear = parseInt(item.year || new Date().getFullYear().toString());
                const snapMonth = parseInt(item.month || new Date().getMonth().toString());
                const snapshotDate = new Date(snapYear, snapMonth, 1).getTime() || fallbackTime;

                snapshotsToCreate.push({
                    linkId: createdNetWorthRecords[index].record_id,
                    date: snapshotDate,
                    currentValue: outBal,
                    monthlyIncome: mInc,
                    monthlyExpenses: mExp,
                    monthlyRepayment: mRepay
                });
            }
        }
    });

    const tableMonthlySnapshot = (process.env.LARK_TABLE_MONTHLY_SNAPSHOT || "").trim();
    if (tableMonthlySnapshot && snapshotsToCreate.length > 0) {
        await createSubRecords(tableMonthlySnapshot, snapshotsToCreate, snap => ({
            "Link to Net Worth": [snap.linkId],
            "Date": snap.date,
            "Current Value": snap.currentValue,
            "Monthly Income": snap.monthlyIncome,
            "Monthly Expenses": snap.monthlyExpenses,
            "Monthly Repayment": snap.monthlyRepayment
        }));
    }

    // 7. Create Standard Expenses (Standalone ones)
    const allExpenses = [
      ...(expenses.household || []).map(e => ({ ...e, category: "Household" })),
      ...(expenses.transportation || []).map(e => ({ ...e, category: "Transportation" })),
      ...(expenses.dependants || []).map(e => ({ ...e, category: "Dependants" })),
      ...(expenses.personal || []).map(e => ({ ...e, category: "Personal" })),
      ...(expenses.miscellaneous || []).map(e => ({ ...e, category: "Miscellaneous" })),
      ...(expenses.otherExpenses || []).map(e => ({ ...e, category: "Other" }))
    ];

    await createSubRecords(tableExpenses, allExpenses, item => {
      const fieldData = {
        "Category": item.category,
        "Type": item.type || "",
        "Amount": parseFloat(String(item.amount).replace(/,/g, '')) || 0
      };
      if (item.month != null) fieldData["Month"] = getMonthName(item.month);
      if (item.year) fieldData["Year"] = String(item.year);
      return fieldData;
    });

    return res.status(200).json({ success: true, submissionId });

  } catch (error) {
    console.error("KYC Submission Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
