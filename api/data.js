// Vercel Serverless Function to fetch Investment Data

module.exports = async (req, res) => {
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

    // 2. Fetch Investment Records filtered by "Full Name"
    // Using the "Investment" table from your screenshot
    // Formula: CurrentValue.["Full Name"] = "Name"
    const filterFormula = `CurrentValue.["Full Name"]="${name}"`;

    // We also sort by Date ascending to ensure the graph draws correctly (1 = Ascending)
    // Note: You might need to check the exact Sort syntax for Lark API, usually "sort" param: ["Date DESC"] or similar in payload
    // Here we fetch and sort in JS to be safe and simple
    const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_BASE_TOKEN}/tables/${process.env.LARK_TABLE_INVESTMENT}/records?filter=${encodeURIComponent(filterFormula)}&page_size=100`;

    const recordsRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    const recordsData = await recordsRes.json();

    if (!recordsData.data || !recordsData.data.items) {
       return res.status(200).json({ records: [] });
    }

    // Sort items by Date (field "Date" is a timestamp in Lark usually, or YYYY/MM/DD string)
    // We convert to timestamp to sort correctly
    const sortedRecords = recordsData.data.items.sort((a, b) => {
        const dateA = new Date(a.fields["Date"]).getTime();
        const dateB = new Date(b.fields["Date"]).getTime();
        return dateA - dateB;
    });

    return res.status(200).json({ records: sortedRecords });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};