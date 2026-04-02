import jwt from 'jsonwebtoken';

// Update Client API Endpoint
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = (process.env.LARK_APP_ID || "").trim();
  const appSecret = (process.env.LARK_APP_SECRET || "").trim();
  const baseToken = (process.env.LARK_BASE_TOKEN || "").trim();
  const tableClient = (process.env.LARK_TABLE_CLIENT || "").trim();

  // 1. Authentication & Authorization (Verify JWT)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  
  const token = authHeader.split(' ')[1];
  let jwtPayload;
  try {
    const jwtSecret = process.env.JWT_SECRET || appSecret || 'fallback_secret_xinwealth';
    jwtPayload = jwt.verify(token, jwtSecret);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }

  // Use the recordId from the verified token, NEVER trust the frontend's recordId
  const targetRecordId = jwtPayload.recordId;
  const { fields } = req.body;

  if (!targetRecordId || !fields) {
    return res.status(400).json({ error: 'Missing target record or fields' });
  }

  // 2. Backend Validation (Sanitize and validate inputs)
  const sanitizedFields = {};
  
  // Define allowed fields and validation rules
  const allowedFields = {
    'Family Name': 'string',
    'Given Name': 'string',
    'NRIC': 'string',
    'Date of Birth': 'date', // We'll validate date format
    'Age': 'numberString',
    'Gender': 'string',
    'Marital Status': 'string',
    'Nationality': 'string',
    'Residency': 'string',
    'EPF Account Number': 'string',
    'PPA Account Number': 'string',
    'Correspondence Address': 'string',
    'Correspondence Postal Code': 'numberString', // Should be numeric
    'Correspondence City': 'string',
    'Correspondence State': 'string'
  };

  for (const [key, val] of Object.entries(fields)) {
    if (!allowedFields[key]) continue; // Ignore unauthorized fields to enforce minimum privilege

    let cleanVal = String(val).trim();
    if (cleanVal === '') {
      sanitizedFields[key] = null; // Clear field in Lark if empty
      continue;
    }

    if (allowedFields[key] === 'numberString') {
      if (!/^\d+$/.test(cleanVal)) {
        return res.status(400).json({ error: `Validation Error: ${key} must contain only numbers.` });
      }
    } else if (allowedFields[key] === 'date') {
      const dateObj = new Date(cleanVal);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ error: `Validation Error: Invalid date format for ${key}.` });
      }
      if (dateObj > new Date()) {
        return res.status(400).json({ error: `Validation Error: ${key} cannot be in the future.` });
      }
      // Note: We'll send the string to Lark or let Lark parse it. 
      // Depending on Lark's configuration, it might require milliseconds timestamp.
      // Usually, YYYY/MM/DD works well. We will pass cleanVal directly.
    }
    
    // Add length constraint to prevent abuse
    if (cleanVal.length > 500) {
      return res.status(400).json({ error: `Validation Error: ${key} exceeds maximum length.` });
    }

    sanitizedFields[key] = cleanVal;
  }

  // Auto-calculate Age in backend to enforce consistency
  if (sanitizedFields['Date of Birth']) {
    const dob = new Date(sanitizedFields['Date of Birth']);
    if (!isNaN(dob.getTime())) {
      const ageDiffMs = Date.now() - dob.getTime();
      const ageDate = new Date(ageDiffMs);
      const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
      sanitizedFields['Age'] = String(calculatedAge);
    }
  }

  if (Object.keys(sanitizedFields).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update.' });
  }

  if (!appId || !appSecret || !baseToken || !tableClient) {
    return res.status(500).json({ error: 'Server Config Error: Missing Lark Credentials.' });
  }

  try {
    // 3. Get Token
    const tokenRes = await fetch("https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.code !== 0) {
        return res.status(500).json({ error: `Lark Auth Failed: ${tokenData.msg}` });
    }
    const accessToken = tokenData.tenant_access_token;

    // 4. Update Record
    const updateRes = await fetch(`https://open.larksuite.com/open-apis/bitable/v1/apps/${baseToken}/tables/${tableClient}/records/${targetRecordId}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({ fields: sanitizedFields })
    });
    
    const updateData = await updateRes.json();
    if (updateData.code !== 0) {
      return res.status(500).json({ error: `Lark Update Failed: ${updateData.msg}` });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Update Client API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
