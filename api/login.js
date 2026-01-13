// Robust Login Handler
export default async function handler(req, res) {
  // CORS handling for local dev if needed
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  // 1. Env Var Check
  const appId = (process.env.LARK_APP_ID || "").trim();
  const appSecret = (process.env.LARK_APP_SECRET || "").trim();
  const baseToken = (process.env.LARK_BASE_TOKEN || "").trim();
  const tableClient = (process.env.LARK_TABLE_CLIENT || "").trim();

  if (!appId || !appSecret || !baseToken) {
    console.error("Missing Environment Variables");
    return res.status(500).json({ error: 'Server Config Error: Missing Lark Credentials (LARK_APP_ID, LARK_APP_SECRET) in Environment Variables.' });
  }

  try {
    // 2. Get Token
    console.log(`Attempting Lark Auth with App ID: ${appId}`); // Debug log (safe, no secret)

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
        console.error("Lark Token Error:", tokenData);
        // Specifically catch the invalid secret error to give better advice
        if (tokenData.msg && tokenData.msg.includes("app secret invalid")) {
            return res.status(500).json({ error: `Lark Auth Failed: Invalid App Secret. Please check LARK_APP_SECRET in Vercel Settings.` });
        }
        return res.status(500).json({ error: `Lark Auth Failed: ${tokenData.msg} (Code: ${tokenData.code})` });
    }
    const accessToken = tokenData.tenant_access_token;

    // 3. Fetch Records
    // Using explicit page size and no filter to ensure we get data
    const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${baseToken}/tables/${tableClient}/records?page_size=500`;
    
    const searchRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const searchData = await searchRes.json();

    if (!searchData.data || !searchData.data.items) {
      console.error("Search Data Error:", searchData);
      return res.status(500).json({ error: 'Failed to search client table. Check LARK_TABLE_CLIENT ID.' });
    }

    const items = searchData.data.items;

    // 4. Robust Find
    const userRecord = items.find(item => {
        const itemEmail = item.fields["Email Address"] || item.fields["Email"] || item.fields["email"];
        if (!itemEmail) return false;
        return String(itemEmail).trim().toLowerCase() === String(email).trim().toLowerCase();
    });

    if (!userRecord) {
      // Don't expose this detailed info to client in production, but helpful for your debugging
      console.log(`User ${email} not found in ${items.length} records.`);
      return res.status(401).json({ error: `User email not found in records.` });
    }
    
    // 5. Verify Password
    const storedPassword = userRecord.fields["Password"] || userRecord.fields["password"] || userRecord.fields["Pass"];
    
    if (String(storedPassword).trim() === String(password).trim()) {
      return res.status(200).json({ 
        success: true, 
        name: userRecord.fields["Full Name"] || userRecord.fields["Name"],
        recordId: userRecord.record_id
      });
    } else {
      return res.status(401).json({ error: 'Invalid password' });
    }

  } catch (error) {
    console.error("Login API Logic Error:", error);
    return res.status(500).json({ error: `Internal Logic Error: ${error.message}` });
  }
}