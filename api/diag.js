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

  const tablesToTest = ['clients', 'profiles', 'assets', 'networth', 'incomes'];
  const results = {};
  
  for (const table of tablesToTest) {
    const { error } = await supabaseAdmin.from(table).select('id').limit(1);
    results[table] = error ? error.message : 'EXISTS';
  }

  res.status(200).json({
    success: true,
    table_check: results,
    env_check: {
      has_url: !!process.env.SUPABASE_URL,
      has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      url_start: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.slice(0, 15) : 'none'
    }
  });
}
