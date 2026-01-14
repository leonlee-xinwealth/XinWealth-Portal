// Robust Login Handler

// Helper to handle Lark Field types (Text, Lookup Array, Link Object)
const extractLarkValue = (field) => {
    if (!field) return "";
    // If it's a simple string or number
    if (typeof field === 'string' || typeof field === 'number') return String(field);
    
    // If it's an array (Lookup field or Link field)
    if (Array.isArray(field)) {
        if (field.length === 0) return "";
        const first = field[0];
        // If array of objects (Link), extract text
        if (typeof first === 'object' && first !== null && first.text) {
            return first.text;
        }
        // If array of strings (Lookup)
        return String(first);
    }
    
    // If single object (uncommon but possible)
    if (typeof field === 'object' && field.text) return field.text;
    
    return String(field);
};

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
        // Robust extraction for Email field (handles Link/Lookup arrays)
        const rawEmail = item.fields["Email Address"] || item.fields["Email"] || item.fields["email"];
        const itemEmail = extractLarkValue(rawEmail);
        
        return itemEmail.trim().toLowerCase() === String(email).trim().toLowerCase();
    });

    if (!userRecord) {
      console.log(`User ${email} not found in ${items.length} records.`);
      return res.status(401).json({ error: `User email not found in records.` });
    }
    
    // 5. Verify Password
    const storedPassword = extractLarkValue(userRecord.fields["Password"] || userRecord.fields["password"] || userRecord.fields["Pass"]);
    const userName = extractLarkValue(userRecord.fields["Full Name"] || userRecord.fields["Name"]);
    
    if (storedPassword.trim() === String(password).trim()) {
      return res.status(200).json({ 
        success: true, 
        name: userName,
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