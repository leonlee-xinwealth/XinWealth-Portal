import { supabaseAdmin, supabaseServiceKeyRole } from './_lib/supabase.js';

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

  const tables = ['incomes', 'expenses', 'investments', 'insurance_policies', 'portfolio_snapshots'];
  const columnChecks = {};
  
  for (const table of tables) {
    // Attempt to query one row to see columns
    const { data, error } = await supabaseAdmin.from(table).select('*').limit(1).maybeSingle();
    if (error) {
       columnChecks[table] = { error: error.message };
    } else {
       columnChecks[table] = { 
         columns: data ? Object.keys(data) : 'TABLE_EMPTY_OR_NO_COLUMNS_FETCHED'
       };
    }
  }

  res.status(200).json({
    success: true,
    columnChecks,
    table_check: results,
    env_check: {
      has_url: !!process.env.SUPABASE_URL,
      has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    key_role: supabaseServiceKeyRole
  });
}
