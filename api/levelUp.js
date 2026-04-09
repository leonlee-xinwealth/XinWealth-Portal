import jwt from 'jsonwebtoken';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = (process.env.LARK_APP_ID || "").trim();
  const appSecret = (process.env.LARK_APP_SECRET || "").trim();
  const baseToken = (process.env.LARK_BASE_TOKEN || "").trim();
  const tableIncomes = (process.env.LARK_TABLE_INCOMES || "").trim();
  const tableAssets = (process.env.LARK_TABLE_ASSETS || "").trim();
  const tableLiabilities = (process.env.LARK_TABLE_LIABILITIES || "").trim();
  const tableExpenses = (process.env.LARK_TABLE_EXPENSES || "").trim();
  const tableInvestments = (process.env.LARK_TABLE_INVESTMENT || "").trim();

  // 1. Authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  
  const token = authHeader.split(' ')[1];
  let jwtPayload;
  try {
    const jwtSecret = process.env.JWT_SECRET || appSecret || 'fallback_secret_xinwealth';
    jwtPayload = jwt.verify(token, jwtSecret);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }

  const clientId = jwtPayload.recordId;
  const { targetMonth, targetYear, incomes, expenses, assets, liabilities } = req.body;

  if (!clientId || !targetMonth || !targetYear) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const getMonthName = (index) => {
    const idx = parseInt(index);
    return isNaN(idx) ? index : MONTH_NAMES[idx] || index;
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
    const authHeaderObj = { 
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    };

    // Helper for batch creation
    const createSubRecords = async (tableName, items) => {
      if (!tableName || !items || items.length === 0) return;
      const records = items.map(item => ({
        fields: {
          ...item,
          "Client": [clientId]
        }
      }));

      const res = await fetch(`https://open.larksuite.com/open-apis/bitable/v1/apps/${baseToken}/tables/${tableName}/records/batch_create`, {
        method: "POST",
        headers: authHeaderObj,
        body: JSON.stringify({ records })
      });
      const result = await res.json();
      if (result.code !== 0) throw new Error(`Batch create failed for ${tableName}: ${result.msg}`);
    };

    // Prepare Incomes
    const incomeRecords = (incomes || []).map(item => ({
      "Category": item.category,
      "Description": item.description || "",
      "Amount": parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      "Month": getMonthName(item.month || targetMonth),
      "Year": String(item.year || targetYear)
    }));

    // Prepare Expenses
    const expenseRecords = (expenses || []).map(item => ({
      "Category": item.type, 
      "Type": item.description || "", 
      "Amount": parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      "Month": getMonthName(item.month || targetMonth),
      "Year": String(item.year || targetYear)
    }));

    // Prepare Assets
    const assetRecords = (assets || []).map(item => ({
      "Category": item.category,
      "Description": item.description || "",
      "Value": parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      "Month": getMonthName(item.month || targetMonth),
      "Year": String(item.year || targetYear)
    }));

    // Prepare Liabilities
    const liabilityRecords = (liabilities || []).map(item => ({
      "Category": item.category,
      "Description": item.description || "",
      "Value": parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      "Month": getMonthName(item.month || targetMonth),
      "Year": String(item.year || targetYear)
    }));

    // Prepare Investments
    const investmentRecords = (investments || []).map(item => ({
      "Category": item.category,
      "Description": item.description || "",
      "Value": parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      "Month": getMonthName(item.month || targetMonth),
      "Year": String(item.year || targetYear)
    }));

    // Execute in parallel
    await Promise.all([
      createSubRecords(tableIncomes, incomeRecords),
      createSubRecords(tableExpenses, expenseRecords),
      createSubRecords(tableAssets, assetRecords),
      createSubRecords(tableLiabilities, liabilityRecords),
      createSubRecords(tableInvestments, investmentRecords)
    ]);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Level Up Submission Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
