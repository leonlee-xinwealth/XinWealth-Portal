import { getVercelOidcToken } from '@vercel/functions/oidc';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { pdfBase64, fileName } = req.body ?? {};
  if (!pdfBase64 || !fileName) {
    return res.status(400).json({ error: 'Missing pdfBase64 or fileName' });
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return res.status(500).json({ error: 'GOOGLE_DRIVE_FOLDER_ID not configured' });

  try {
    const accessToken = await getGoogleAccessToken();

    // Multipart upload to Google Drive
    const boundary = `pmb-${Date.now()}`;
    const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/pdf\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([header, pdfBuffer, footer]);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        body,
      }
    );

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`Drive upload failed (${uploadRes.status}): ${text}`);
    }

    const file = await uploadRes.json();
    return res.status(200).json({ success: true, fileId: file.id, fileName: file.name });
  } catch (err) {
    console.error('[submit-phillip-form]', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

async function getGoogleAccessToken() {
  const provider = process.env.GOOGLE_WIF_PROVIDER;
  if (!provider) throw new Error('GOOGLE_WIF_PROVIDER not configured');

  const oidcToken = await getVercelOidcToken();

  // Exchange Vercel OIDC token for Google federated access token
  const stsRes = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audience: `//iam.googleapis.com/${provider}`,
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
      subjectToken: oidcToken,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
    }),
  });

  if (!stsRes.ok) throw new Error(`STS exchange failed: ${await stsRes.text()}`);
  const { access_token: federatedToken } = await stsRes.json();

  // Impersonate the service account to get Drive-scoped credentials
  const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!saEmail) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL not configured');

  const impRes = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:generateAccessToken`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${federatedToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scope: ['https://www.googleapis.com/auth/drive.file'],
      }),
    }
  );

  if (!impRes.ok) throw new Error(`SA impersonation failed: ${await impRes.text()}`);
  const { accessToken } = await impRes.json();
  return accessToken;
}

// getVercelOidcToken is imported from @vercel/functions/oidc above
