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
  if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET || !process.env.LARK_BASE_TOKEN) {
    console.error("Missing Environment Variables");
    return res.status(500).json({ error: 'Server Config Error: Missing Lark Credentials in Environment Variables.' });
  }

  try {
    // 2. Get Token
    const tokenRes = await fetch("https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: process.env.LARK_APP_ID,
        app_secret: process.env.LARK_APP_SECRET
      })
    });
    
    const tokenData = await tokenRes.json();
    if (tokenData.code !== 0) {
        console.error("Token Error:", tokenData);
        return res.status(500).json({ error: `Lark Auth Failed: ${tokenData.msg}` });
    }
    const accessToken = tokenData.tenant_access_token;

    // 3. Fetch Records (Fetch ALL to avoid fragile filter formulas)
    // We fetch a larger page size to ensure we find the user
    const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_BASE_TOKEN}/tables/${process.env.LARK_TABLE_CLIENT}/records?page_size=500`;
    
    const searchRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const searchData = await searchRes.json();

    if (!searchData.data || !searchData.data.items) {
      console.error("Search Data Error:", searchData);
      return res.status(500).json({ error: 'Failed to search client table. Check Table ID.' });
    }

    const items = searchData.data.items;

    // 4. Debugging: Log available keys from the first record to help debugging
    if (items.length > 0) {
        console.log("Available Fields in Table:", Object.keys(items[0].fields));
    }

    // 5. Robust Find: Try exact match or case-insensitive match on keys
    const userRecord = items.find(item => {
        const itemEmail = item.fields["Email Address"] || item.fields["Email"] || item.fields["email"];
        if (!itemEmail) return false;
        // Trim and lowercase comparison
        return String(itemEmail).trim().toLowerCase() === String(email).trim().toLowerCase();
    });

    if (!userRecord) {
      return res.status(401).json({ error: `User not found: ${email}. Checked ${items.length} records.` });
    }
    
    // 6. Verify Password
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