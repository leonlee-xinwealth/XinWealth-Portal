// Robust Data Handler
export default async function handler(req, res) {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'User name is required' });
  }

  // 1. Env Var Check & Sanitize
  const appId = (process.env.LARK_APP_ID || "").trim();
  const appSecret = (process.env.LARK_APP_SECRET || "").trim();
  const baseToken = (process.env.LARK_BASE_TOKEN || "").trim();
  const tableInvestment = (process.env.LARK_TABLE_INVESTMENT || "").trim();

  if (!appId || !appSecret || !baseToken) {
     return res.status(500).json({ error: 'Server Config Error: Missing Lark Credentials.' });
  }

  try {
    // 2. Get Token
    const tokenRes = await fetch("https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret
      })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.code !== 0) {
        return res.status(500).json({ error: `Lark Auth Failed: ${tokenData.msg}` });
    }
    const accessToken = tokenData.tenant_access_token;

    // 3. Fetch Records
    const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${baseToken}/tables/${tableInvestment}/records?page_size=500`;

    const recordsRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    const recordsData = await recordsRes.json();

    if (!recordsData.data || !recordsData.data.items) {
       return res.status(200).json({ records: [] });
    }

    // 4. Filter by Name in memory
    const userRecords = recordsData.data.items.filter(item => {
        const rowName = item.fields["Full Name"] || item.fields["Name"] || item.fields["Client Name"];
        return String(rowName).trim() === String(name).trim();
    });

    // 5. Sort Logic
    const sortedRecords = userRecords.sort((a, b) => {
        const dateFieldA = a.fields["Date"] || a.fields["date"] || 0;
        const dateFieldB = b.fields["Date"] || b.fields["date"] || 0;
        const dateA = new Date(dateFieldA).getTime();
        const dateB = new Date(dateFieldB).getTime();
        return dateA - dateB;
    });

    return res.status(200).json({ records: sortedRecords });

  } catch (error) {
    console.error("Data API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}