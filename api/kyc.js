// KYC Submission Handler (Relational)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const formData = req.body;
  const { basic, income, assets, liabilities, expenses, investments } = formData;

  // 1. Env Var Check
  const appId = (process.env.LARK_APP_ID || "").trim();
  const appSecret = (process.env.LARK_APP_SECRET || "").trim();
  const baseToken = (process.env.LARK_BASE_TOKEN || "").trim();
  
  // Table IDs (Should be set in Vercel Environment Variables)
  const tableSubmissions = (process.env.LARK_TABLE_SUBMISSIONS || "").trim();
  const tableAssets = (process.env.LARK_TABLE_ASSETS || "").trim();
  const tableInvestments = (process.env.LARK_TABLE_INVESTMENTS || "").trim();
  const tableLiabilities = (process.env.LARK_TABLE_LIABILITIES || "").trim();
  const tableExpenses = (process.env.LARK_TABLE_EXPENSES || "").trim();

  if (!appId || !appSecret || !baseToken || !tableSubmissions) {
     return res.status(500).json({ error: 'Server Config Error: Missing Lark Credentials or Table IDs.' });
  }

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

    // 3. Create Main Submission Record
    const mainRecordData = {
      fields: {
        "Full Name": `${basic.givenName || ''} ${basic.familyName || ''}`.trim(),
        "Family Name": basic.familyName || "",
        "Given Name": basic.givenName || "",
        "Email": basic.email,
        "Phone": basic.phone,
        "Age": parseInt(basic.age) || 0,
        "Occupation": basic.occupation,
        "Monthly Income": parseFloat(income.totalIncome) || 0,
        "Annual Income": parseFloat(income.annualIncome) || 0,
        "Submission Date": new Date().toISOString(),
        "PDPA Accepted": formData.pdpaAccepted ? "Yes" : "No"
      }
    };

    const mainRes = await fetch(`https://open.larksuite.com/open-apis/bitable/v1/apps/${baseToken}/tables/${tableSubmissions}/records`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify(mainRecordData)
    });
    const mainResult = await mainRes.json();
    if (mainResult.code !== 0) throw new Error(`Failed to create main record: ${mainResult.msg}`);
    
    const submissionId = mainResult.data.record.record_id;

    // Helper function to batch create sub-records
    const createSubRecords = async (tableName, items, fieldMapper) => {
      if (!tableName || !items || items.length === 0) return;
      
      const records = items.map(item => ({
        fields: {
          ...fieldMapper(item),
          "Submission ID": [submissionId] // Link to the main record
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

    // 4. Create Related Records (Assets, Investments, etc.)
    
    // Assets: Flatten all categories (property, vehicle, cash, etc.)
    const allAssets = [
      ...(assets.properties || []).map(p => ({ ...p, category: "Property" })),
      ...(assets.vehicles || []).map(v => ({ ...v, category: "Vehicle" })),
      ...(assets.cash || []).map(c => ({ ...c, category: "Cash/Bank" })),
      ...(assets.others || []).map(o => ({ ...o, category: "Other" }))
    ];
    // Special handling for EPF and Insurance since they are individual fields in UI but items in DB
    if (assets.epfPersaraan) allAssets.push({ description: "EPF Account 1", amount: assets.epfPersaraan, category: "EPF" });
    if (assets.epfSejahtera) allAssets.push({ description: "EPF Account 2", amount: assets.epfSejahtera, category: "EPF" });
    if (assets.epfFleksibel) allAssets.push({ description: "EPF Account 3", amount: assets.epfFleksibel, category: "EPF" });

    await createSubRecords(tableAssets, allAssets, item => ({
      "Category": item.category,
      "Description": item.description || item.type || "",
      "Value": parseFloat(String(item.amount).replace(/,/g, '')) || 0
    }));

    // Investments
    const allInvestments = [
      ...(investments.etf || []).map(i => ({ ...i, category: "ETF" })),
      ...(investments.stocks || []).map(i => ({ ...i, category: "Stocks" })),
      ...(investments.bonds || []).map(i => ({ ...i, category: "Bonds" })),
      ...(investments.unitTrusts || []).map(i => ({ ...i, category: "Unit Trust" })),
      ...(investments.fixedDeposits || []).map(i => ({ ...i, category: "FD" })),
      ...(investments.forex || []).map(i => ({ ...i, category: "Forex" })),
      ...(investments.crypto || []).map(i => ({ ...i, category: "Crypto" })),
      ...(investments.otherInvestments || []).map(i => ({ ...i, category: "Other" }))
    ];

    await createSubRecords(tableInvestments, allInvestments, item => ({
      "Category": item.category,
      "Description": item.description || "",
      "Amount": parseFloat(String(item.amount).replace(/,/g, '')) || 0
    }));

    // Liabilities
    const allLiabilities = [
      ...(liabilities.loans || []).map(l => ({ ...l, category: "Loan" })),
      ...(liabilities.creditCards || []).map(c => ({ ...c, category: "Credit Card" })),
      ...(liabilities.others || []).map(o => ({ ...o, category: "Other" }))
    ];

    await createSubRecords(tableLiabilities, allLiabilities, item => ({
      "Category": item.category,
      "Description": item.description || item.type || "",
      "Outstanding Amount": parseFloat(String(item.amount).replace(/,/g, '')) || 0
    }));

    // Expenses
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
      "Description": item.type || "",
      "Amount": parseFloat(String(item.amount).replace(/,/g, '')) || 0
    }));

    return res.status(200).json({ success: true, submissionId });

  } catch (error) {
    console.error("KYC Submission Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
