export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { file_token, url } = req.query;

  if (!file_token && !url) {
    return res.status(400).json({ error: 'File token or url is required' });
  }

  const appId = (process.env.LARK_APP_ID || "").trim();
  const appSecret = (process.env.LARK_APP_SECRET || "").trim();

  if (!appId || !appSecret) {
    return res.status(500).json({ error: 'Server Config Error: Missing Lark Credentials.' });
  }

  try {
    // 1. Get Tenant Access Token
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

    // 2. Download File from Lark Drive API
    let downloadUrl = url || `https://open.larksuite.com/open-apis/drive/v1/medias/download?file_token=${encodeURIComponent(file_token)}`;
    
    const fileRes = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!fileRes.ok) {
      const errorText = await fileRes.text();
      console.error("Lark Download Error:", errorText);
      return res.status(fileRes.status).json({ 
        error: 'Failed to download file from Lark',
        details: errorText,
        url: downloadUrl
      });
    }

    // 3. Proxy the file back to the client
    const contentType = fileRes.headers.get('content-type') || 'application/pdf';
    const contentDisposition = fileRes.headers.get('content-disposition');
    
    res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
       res.setHeader('Content-Disposition', contentDisposition);
    } else {
       res.setHeader('Content-Disposition', `inline; filename="e-policy-${file_token || 'download'}.pdf"`);
    }

    // Send the buffer
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);

  } catch (error) {
    console.error("Download API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
