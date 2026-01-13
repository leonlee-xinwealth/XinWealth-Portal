// Vercel Serverless Function to handle Login
// Using ES Module syntax to match package.json "type": "module"

export default async function handler(req, res) {
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
    // Using strict filter on "Email Address" column
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
    
    // Safety check: ensure Password field exists
    const storedPassword = userRecord.fields["Password"];
    if (storedPassword === undefined) {
      console.error("Password field missing in Lark Client Table for user:", email);
      return res.status(500).json({ error: 'System configuration error' });
    }

    // 3. Verify Password
    // Direct string comparison as per requirements
    if (String(storedPassword) === String(password)) {
      return res.status(200).json({ 
        success: true, 
        name: userRecord.fields["Full Name"],
        recordId: userRecord.record_id
      });
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

  } catch (error) {
    console.error("Login API Error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}