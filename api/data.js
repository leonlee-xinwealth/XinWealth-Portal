// Vercel Serverless Function to fetch Investment Data
// Using ES Module syntax

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

    // 2. Fetch Investment Records
    // Filter by "Full Name" to match the logged-in user
    const filterFormula = `CurrentValue.["Full Name"]="${name}"`;

    const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_BASE_TOKEN}/tables/${process.env.LARK_TABLE_INVESTMENT}/records?filter=${encodeURIComponent(filterFormula)}&page_size=100`;

    const recordsRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    const recordsData = await recordsRes.json();

    if (!recordsData.data || !recordsData.data.items) {
       return res.status(200).json({ records: [] });
    }

    // 3. Sort Logic
    // Lark dates are usually returned as timestamps (ms) or strings. 
    // We convert to ensure accurate chronological order for the graph.
    const sortedRecords = recordsData.data.items.sort((a, b) => {
        const dateA = new Date(a.fields["Date"]).getTime();
        const dateB = new Date(b.fields["Date"]).getTime();
        return dateA - dateB;
    });

    return res.status(200).json({ records: sortedRecords });

  } catch (error) {
    console.error("Data API Error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}