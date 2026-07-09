import crypto from 'crypto';
import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';

const N8N_BASE_URL = (process.env.N8N_SSO_BASE_URL || 'https://n8n.xinwealth.com').replace(/\/$/, '');

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function signSsoToken(secret, payload) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseAdmin) return configError(res);

  const secret = (process.env.N8N_SSO_SECRET || '').trim();
  if (!secret) {
    return res.status(503).json({ error: 'Automation platform is not configured yet (missing N8N_SSO_SECRET)' });
  }

  const { user, error } = await getAuthUser(req);
  if (error || !user) {
    return res.status(401).json({ error: `Unauthorized: ${error || 'Invalid token'}` });
  }

  // Only registered advisors may enter n8n
  const { data: advisor, error: advErr } = await supabaseAdmin
    .from('advisors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (advErr) {
    return res.status(500).json({ error: 'Error verifying advisor', details: advErr.message });
  }
  if (!advisor) {
    return res.status(403).json({ error: 'Access denied: advisors only' });
  }

  const token = signSsoToken(secret, {
    aud: 'n8n-sso',
    sub: user.id,
    email: user.email || '',
    exp: Math.floor(Date.now() / 1000) + 60
  });

  return res.status(200).json({ success: true, url: `${N8N_BASE_URL}/sso?token=${token}` });
}
