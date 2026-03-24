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
  const tableAssets = (process.env.LARK_TABLE_ASSETS || "").trim();
  const tableInvestment = (process.env.LARK_TABLE_INVESTMENT || "").trim();
  const tableLiabilities = (process.env.LARK_TABLE_LIABILITIES || "").trim();
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
        "Full Name": `${basic.givenName || ''} ${basic.familyName || ''}`.trim(),
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
      if (!tableName || !items || items.length === 0) return;
      
      const records = items.map(item => ({
        fields: {
          ...fieldMapper(item),
          "Client ID": submissionId
        }
      }));

      // Lark batch create limit is 500
      const res = await fetch(`https://open.larksuite.com/open-apis/bitable/v1/apps/${baseToken}/tables/${tableName}/records/batch_create`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ records })
      });
      const result = await res.json();
      if (result.code !== 0) console.error(`Batch create failed for ${tableName}:`, result.msg);
    };

    // 4. Create Income Records
    const allIncomes = [];
    if (income.monthlySalary) {
      allIncomes.push({
        category: "Monthly Salary",
        description: "Monthly Salary",
        amount: income.monthlySalary,
        period: getPeriod(income.salaryMonth, income.salaryYear),
        frequency: "Monthly"
      });
    }
    if (income.annualBonus) {
      allIncomes.push({
        category: "Annual Bonus",
        description: "Annual Bonus",
        amount: income.annualBonus,
        period: getPeriod(income.bonusMonth, income.bonusYear),
        frequency: "Yearly"
      });
    }
    // Dynamic income items
    const incomeTypes = { rentalIncome: "Rental Income", dividendIncome: "Dividend Income", otherIncome: "Other Income" };
    for (const [key, category] of Object.entries(incomeTypes)) {
      if (income[key] && income[key].length > 0) {
        income[key].forEach(item => {
          allIncomes.push({
            category,
            description: item.description || "",
            amount: item.amount,
            period: getPeriod(item.month, item.year),
            frequency: key === 'dividendIncome' ? 'Yearly' : 'Monthly'
          });
        });
      }
    }

    await createSubRecords(tableIncomes, allIncomes, item => ({
      "Category": item.category,
      "Description": item.description,
      "Amount": parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      "Period": item.period,
      "Frequency": item.frequency
    }));

    // 5. Create Asset Records
    const allAssets = [
      ...(assets.properties || []).map(p => ({ ...p, category: "Property" })),
      ...(assets.vehicles || []).map(v => ({ ...v, category: "Vehicle" })),
      ...(assets.otherAssets || []).map(o => ({ ...o, category: "Other" }))
    ];
    if (assets.savings) allAssets.push({ description: "Cash & Savings", amount: assets.savings, category: "Cash/Savings" });
    if (assets.epfPersaraan) allAssets.push({ description: "EPF Account 1 (Akaun Persaraan)", amount: assets.epfPersaraan, category: "EPF" });
    if (assets.epfSejahtera) allAssets.push({ description: "EPF Account 2 (Akaun Sejahtera)", amount: assets.epfSejahtera, category: "EPF" });
    if (assets.epfFleksibel) allAssets.push({ description: "EPF Account 3 (Akaun Fleksibel)", amount: assets.epfFleksibel, category: "EPF" });

    await createSubRecords(tableAssets, allAssets, item => ({
      "Category": item.category,
      "Description": item.description || "",
      "Value": parseFloat(String(item.amount).replace(/,/g, '')) || 0
    }));

    // 6. Create Investment Records
    const allInvestments = [
      ...(investments.etf || []).map(i => ({ ...i, category: "ETF" })),
      ...(investments.stocks || []).map(i => ({ ...i, category: "Stocks" })),
      ...(investments.bonds || []).map(i => ({ ...i, category: "Bonds" })),
      ...(investments.unitTrusts || []).map(i => ({ ...i, category: "Unit Trust" })),
      ...(investments.fixedDeposits || []).map(i => ({ ...i, category: "Fixed Deposit" })),
      ...(investments.forex || []).map(i => ({ ...i, category: "Forex" })),
      ...(investments.moneyMarket || []).map(i => ({ ...i, category: "Money Market" })),
      ...(investments.otherInvestments || []).map(i => ({ ...i, category: "Other" }))
    ];

    await createSubRecords(tableInvestment, allInvestments, item => ({
      "Category": item.category,
      "Description": item.description || "",
      "Amount": parseFloat(String(item.amount).replace(/,/g, '')) || 0
    }));

    // 7. Create Liability Records
    const allLiabilities = [
      ...(liabilities.mortgages || []).map(l => ({ ...l, category: "Mortgage" })),
      ...(liabilities.carLoans || []).map(l => ({ ...l, category: "Car Loan" })),
      ...(liabilities.studyLoans || []).map(l => ({ ...l, category: "Study Loan" })),
      ...(liabilities.interestOnlyLoans || []).map(l => ({ ...l, category: "Interest-Only Loan" })),
      ...(liabilities.renovationLoans || []).map(l => ({ ...l, category: "Renovation Loan" })),
      ...(liabilities.otherLoans || []).map(l => ({ ...l, category: "Other Loan" }))
    ];

    await createSubRecords(tableLiabilities, allLiabilities, item => ({
      "Category": item.category,
      "Description": item.description || "",
      "Outstanding Amount": parseFloat(String(item.amount).replace(/,/g, '')) || 0
    }));

    // 8. Create Expense Records (with month/year period)
    const allExpenses = [
      ...(expenses.household || []).map(e => ({ ...e, category: "Household" })),
      ...(expenses.transportation || []).map(e => ({ ...e, category: "Transportation" })),
      ...(expenses.dependants || []).map(e => ({ ...e, category: "Dependants" })),
      ...(expenses.personal || []).map(e => ({ ...e, category: "Personal" })),
      ...(expenses.miscellaneous || []).map(e => ({ ...e, category: "Miscellaneous" })),
      ...(expenses.otherExpenses || []).map(e => ({ ...e, category: "Other" }))
    ];

    await createSubRecords(tableExpenses, allExpenses, item => ({
      "Category": item.category,
      "Type": item.type || "",
      "Amount": parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      "Period": getPeriod(item.month, item.year),
      "Frequency": (item.type === 'Vacation/ Travel' || item.type === 'Income Tax Expense') ? 'Yearly' : 'Monthly'
    }));

    return res.status(200).json({ success: true, submissionId });

  } catch (error) {
    console.error("KYC Submission Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
