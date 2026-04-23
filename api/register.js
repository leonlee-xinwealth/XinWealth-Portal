const extractLarkValue = (field) => {
    if (!field) return "";
    if (typeof field === 'string' || typeof field === 'number') return String(field);
    if (Array.isArray(field)) {
        if (field.length === 0) return "";
        const first = field[0];
        if (typeof first === 'object' && first !== null && first.text) {
            return first.text;
        }
        return String(first);
    }
    if (typeof field === 'object' && field.text) return field.text;
    return String(field);
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    fullName,
    icNumber,
    contactNumber,
    emailAddress,
    nationality,
    maritalStatus,
    occupation,
    employmentStatus,
    taxStatus
  } = req.body;

  const cleanFullName = String(fullName || '').trim();
  const cleanIcNumber = String(icNumber || '').trim();
  const cleanContactNumber = String(contactNumber || '').trim();
  const cleanEmailAddress = String(emailAddress || '').trim();
  const cleanNationality = String(nationality || '').trim();
  const cleanMaritalStatus = String(maritalStatus || '').trim();
  const cleanOccupation = String(occupation || '').trim();
  const cleanEmploymentStatus = String(employmentStatus || '').trim();
  const cleanTaxStatus = String(taxStatus || '').trim();

  if (!cleanIcNumber || !cleanFullName || !cleanContactNumber || !cleanEmailAddress) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  const appId = (process.env.LARK_APP_ID || "").trim();
  const appSecret = (process.env.LARK_APP_SECRET || "").trim();
  const baseToken = (process.env.LARK_BASE_TOKEN || "").trim();
  const tableClient = (process.env.LARK_TABLE_CLIENT || "").trim();

  if (!appId || !appSecret || !baseToken || !tableClient) {
    return res.status(500).json({ error: 'Server Config Error: Missing Lark Credentials.' });
  }

  try {
    // 1. Get Lark Tenant Access Token
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

    // 2. Fetch existing records to check for duplicates
    const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${baseToken}/tables/${tableClient}/records?page_size=500`;
    const searchRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json();

    if (!searchData.data || !searchData.data.items) {
      return res.status(500).json({ error: 'Failed to fetch client table to verify IC Number.' });
    }

    const items = searchData.data.items;

    // 3. Check for existing IC Number
    const existingClient = items.find(item => {
        const rawIC = item.fields["NRIC"] || item.fields["IC"] || item.fields["IC Number"];
        const itemIC = extractLarkValue(rawIC);
        return itemIC.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIcNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    });

    if (existingClient) {
      return res.status(409).json({ error: 'Existing Client: Already have an account with this IC Number. No need to apply again.' });
    }

    // 4. Create new record in Lark
    const newRecordFields = {
      "Full Name": cleanFullName,
      "IC Number": cleanIcNumber,
      "Contact Number": cleanContactNumber,
      "Email Address": cleanEmailAddress,
      "Nationality": cleanNationality || "",
      "Marital Status": cleanMaritalStatus || "",
      "Occupation": cleanOccupation || "",
      "Employment Status": cleanEmploymentStatus || "",
      "Tax Status": cleanTaxStatus || ""
    };

    // Remove empty fields
    Object.keys(newRecordFields).forEach(key => {
      if (newRecordFields[key] === "") {
        delete newRecordFields[key];
      }
    });

    const createRes = await fetch(`https://open.larksuite.com/open-apis/bitable/v1/apps/${baseToken}/tables/${tableClient}/records`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ fields: newRecordFields })
    });

    const createData = await createRes.json();
    if (createData.code !== 0) {
      return res.status(500).json({ error: `Failed to create client record in Lark: ${createData.msg}` });
    }

    return res.status(200).json({ success: true, message: 'Account Registration Successful', recordId: createData.data.record.record_id });

  } catch (error) {
    console.error("Register API Logic Error:", error);
    return res.status(500).json({ error: `Internal Logic Error: ${error.message}` });
  }
}
