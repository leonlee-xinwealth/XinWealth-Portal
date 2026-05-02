import { createClient } from '@supabase/supabase-js';

const url = (process.env.SUPABASE_URL || '').trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export const hasSupabaseEnv = Boolean(url && serviceKey);

export const supabaseAdmin = hasSupabaseEnv
  ? createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

export const supabaseServiceKeyRole = (() => {
  if (!serviceKey) return null;
  const parts = serviceKey.split('.');
  if (parts.length < 2) return null;
  try {
    const payloadBase64Url = parts[1];
    const base64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload?.role || null;
  } catch {
    return null;
  }
})();

export function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export async function getAuthUser(req) {
  if (!supabaseAdmin) return { user: null, error: 'Server not configured' };
  const token = getBearerToken(req);
  if (!token) return { user: null, error: 'Missing bearer token' };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { user: null, error: error?.message || 'Invalid token' };
  return { user: data.user, error: null };
}

export async function getClientForUser(userId) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('getClientForUser error:', error.message);
    return null;
  }
  return data;
}

export function configError(res) {
  return res.status(500).json({
    error:
      'Server Config Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
  });
}

export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}
