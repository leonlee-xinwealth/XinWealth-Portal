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

  // Query for all tables in public schema
  const { data: tables, error: tableError } = await supabaseAdmin.rpc('get_tables_info'); 
  
  // If RPC fails (likely), try a raw query to postgrest directly
  const { data: tablesRaw, error: rawError } = await supabaseAdmin.from('pg_catalog.pg_tables').select('tablename').eq('schemaname', 'public');

  res.status(200).json({
    success: false,
    tables: tablesRaw || [],
    error: rawError,
    hint: 'Checking schema cache...',
    db_test: { error: testError },
    env_check: {
      has_url: !!process.env.SUPABASE_URL,
      has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      url_start: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.slice(0, 15) : 'none'
    }
  });
}
