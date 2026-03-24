// Health Data API Endpoint
const extractLarkValue = (field) => {
    if (!field) return "";
    if (typeof field === 'string' || typeof field === 'number') return String(field);
    if (Array.isArray(field)) {
        if (field.length === 0) return "";
        const first = field[0];
        if (typeof first === 'object' && first !== null && first.text) return first.text;
        return String(first);
    }
    if (typeof field === 'object' && field.text) return field.text;
    return String(field);
};

export default async function handler(req, res) {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'User name is required' });
  }

  const appId = (process.env.LARK_APP_ID || "").trim();
  const appSecret = (process.env.LARK_APP_SECRET || "").trim();
  const baseToken = (process.env.LARK_BASE_TOKEN || "").trim();

  // Tables
  const tables = {
      assets: (process.env.LARK_TABLE_ASSETS || "").trim(),
      liabilities: (process.env.LARK_TABLE_LIABILITIES || "").trim(),
      incomes: (process.env.LARK_TABLE_INCOMES || "").trim(),
      expenses: (process.env.LARK_TABLE_EXPENSES || "").trim(),
      investments: (process.env.LARK_TABLE_INVESTMENT || "").trim()
  };

  if (!appId || !appSecret || !baseToken) {
     return res.status(500).json({ error: 'Server Config Error: Missing Lark Credentials.' });
  }

  try {
    // 1. Get Token
    const tokenRes = await fetch("https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.code !== 0) {
        return res.status(500).json({ error: `Lark Auth Failed: ${tokenData.msg}` });
    }
    const accessToken = tokenData.tenant_access_token;

    // 2. Fetch Records from all tables concurrently
    const fetchTable = async (tableName) => {
        if (!tableName) return [];
        const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${baseToken}/tables/${tableName}/records?page_size=500`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json();
        if (!data.data || !data.data.items) return [];
        
        // Filter by Client name
        return data.data.items.filter(item => {
            const rawName = item.fields["Client"] || item.fields["Full Name"] || item.fields["Name"] || item.fields["Client Name"];
            const rowName = extractLarkValue(rawName);
            return rowName.trim() === String(name).trim();
        });
    };

    const [assets, liabilities, incomes, expenses, investments] = await Promise.all([
        fetchTable(tables.assets),
        fetchTable(tables.liabilities),
        fetchTable(tables.incomes),
        fetchTable(tables.expenses),
        fetchTable(tables.investments)
    ]);

    return res.status(200).json({
        assets,
        liabilities,
        incomes,
        expenses,
        investments
    });

  } catch (error) {
    console.error("Health Data API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
