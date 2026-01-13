// Vercel Serverless Function to handle Login
// This runs on the server, keeping your LARK_APP_SECRET safe.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  try {
    // 1. Get Tenant Access Token
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

    // 2. Search Client Table for Email
    // Note: We use the "filter" parameter to find the user
    // Assumes columns: "Email Address", "Password", "Full Name"
    const filterFormula = `CurrentValue.["Email Address"]="${email}"`;
    
    const searchRes = await fetch(
      `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_BASE_TOKEN}/tables/${process.env.LARK_TABLE_CLIENT}/records?filter=${encodeURIComponent(filterFormula)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    
    const searchData = await searchRes.json();

    if (!searchData.data || !searchData.data.items || searchData.data.items.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const userRecord = searchData.data.items[0];
    const storedPassword = userRecord.fields["Password"]; // Ensure this column name matches Lark exactly

    // 3. Verify Password
    // In production, passwords should be hashed. Since Lark Base stores text, we compare directly.
    if (storedPassword === password) {
      return res.status(200).json({ 
        success: true, 
        name: userRecord.fields["Full Name"],
        recordId: userRecord.record_id
      });
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};