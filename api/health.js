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

  // Tables — updated to match new Vercel env var names
  // Net Worth table contains BOTH assets and liabilities (distinguished by "Type" column)
  // Monthly Snapshot is the new standalone liabilities/installment tracking table
  const tables = {
      networth: (process.env.LARK_TABLE_NETWORTH || "").trim(),
      monthlySnapshot: (process.env.LARK_TABLE_MONTHLYSNAPSHOT || "").trim(),
      incomes: (process.env.LARK_TABLE_INCOMES || "").trim(),
      expenses: (process.env.LARK_TABLE_EXPENSES || "").trim(),
      investments: (process.env.LARK_TABLE_INVESTMENT || "").trim(),
      insurance: (process.env.LARK_TABLE_INSURANCE || "").trim()
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
        
        // Filter by Client name or email
        return data.data.items.filter(item => {
            const rawName = item.fields["Client"] || item.fields["Full Name"] || item.fields["Name"] || item.fields["Client Name"];
            const rawEmail = item.fields["Email Address"] || item.fields["Email"] || item.fields["email"];
            const rowName = extractLarkValue(rawName);
            const rowEmail = extractLarkValue(rawEmail);
            
            return rowName.trim() === String(name).trim() || 
                   (rowEmail && rowEmail.trim().toLowerCase() === String(name).trim().toLowerCase());
        });
    };

    const [networthRecords, monthlySnapshot, incomes, expenses, investments, insurance] = await Promise.all([
        fetchTable(tables.networth),
        fetchTable(tables.monthlySnapshot),
        fetchTable(tables.incomes),
        fetchTable(tables.expenses),
        fetchTable(tables.investments),
        fetchTable(tables.insurance)
    ]);

    // 3. Split the unified Net Worth table into assets vs liabilities by "Type" field
    const assets = networthRecords.filter(item => {
        const type = extractLarkValue(item.fields["Type"] || "");
        return type === "Asset";
    });

    const liabilities = networthRecords.filter(item => {
        const type = extractLarkValue(item.fields["Type"] || "");
        return type === "Liability";
    });

    return res.status(200).json({
        assets,
        liabilities,
        incomes,
        expenses,
        investments,
        insurance,
        monthlySnapshot
    });

  } catch (error) {
    console.error("Health Data API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
