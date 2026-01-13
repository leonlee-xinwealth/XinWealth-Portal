// Robust Data Handler
export default async function handler(req, res) {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'User name is required' });
  }

  try {
    // 1. Get Token
    const tokenRes = await fetch("https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: process.env.LARK_APP_ID,
        app_secret: process.env.LARK_APP_SECRET
      })
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.tenant_access_token;

    // 2. Fetch Records (No filter, filter in memory for safety)
    const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_BASE_TOKEN}/tables/${process.env.LARK_TABLE_INVESTMENT}/records?page_size=500`;

    const recordsRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    const recordsData = await recordsRes.json();

    if (!recordsData.data || !recordsData.data.items) {
       return res.status(200).json({ records: [] });
    }

    // 3. Filter by Name in memory
    const userRecords = recordsData.data.items.filter(item => {
        const rowName = item.fields["Full Name"] || item.fields["Name"] || item.fields["Client Name"];
        return String(rowName).trim() === String(name).trim();
    });

    // 4. Sort Logic
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