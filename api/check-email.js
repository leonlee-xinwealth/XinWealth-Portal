import { supabaseAdmin } from './_lib/supabase.js';

// Lightweight pre-check called by the KYC form before submitting.
// Returns { available: true } if the email is free, or
// { available: false, reason: 'DUPLICATE_EMAIL' } if a profile already exists.
//
// No auth required: same trust boundary as /api/kyc itself. We only
// reveal a yes/no — never any profile data.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabaseAdmin) {
    return res.status(500).json({
      error: 'Server Config Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    });
  }

  const raw = req.query?.email;
  const email = String(raw || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('check-email lookup error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (data) {
      return res.status(200).json({ available: false, reason: 'DUPLICATE_EMAIL' });
    }
    return res.status(200).json({ available: true });
  } catch (err) {
    console.error('check-email error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
