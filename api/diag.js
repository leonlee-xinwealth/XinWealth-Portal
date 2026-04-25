import { supabaseAdmin } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (!supabaseAdmin) {
    return res.status(200).json({
      success: false,
      error: 'supabaseAdmin is null',
      env: {
        has_url: !!process.env.SUPABASE_URL,
        has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    });
  }

  const { data: testRow, error: testError } = await supabaseAdmin.from('clients').select('*').limit(1).maybeSingle();

  res.status(200).json({
    success: !testError,
    db_test: { data: testRow, error: testError },
    env_check: {
      has_url: !!process.env.SUPABASE_URL,
      has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      url_start: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.slice(0, 15) : 'none'
    }
  });
}
