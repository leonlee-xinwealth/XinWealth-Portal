import { supabaseAdmin } from './_lib/supabase.js';
import {
  networthRowToFrontend,
  monthlySnapshotRowToFrontend,
  incomeRowToFrontend,
  expenseRowToFrontend,
  investmentRowToFrontend,
  insuranceRowToFrontend
} from './_lib/shape.js';

export default async function handler(req, res) {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'User name/email is required' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ 
      error: 'Server Config Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.' 
    });
  }

  try {
    // 1. Get profile id - search by email or split names
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`email.eq.${name},given_name.ilike.%${name}%,family_name.ilike.%${name}%`);

    if (profileError || !profiles || profiles.length === 0) {
      console.log(`No profile found for search term: ${name}`);
      return res.status(200).json({
        assets: [],
        liabilities: [],
        incomes: [],
        expenses: [],
        investments: [],
        insurances: [],
        snapshots: []
      });
    }

    const profileId = profiles[0].id;

    // 2. Fetch all related data in parallel using the correct 'profile_id' FK
    const [
      { data: assets },
      { data: liabilities },
      { data: incomes },
      { data: expenses },
      { data: investments },
      { data: insurances },
      { data: snapshots }
    ] = await Promise.all([
      supabaseAdmin.from('assets').select('*').eq('profile_id', profileId),
      supabaseAdmin.from('liabilities').select('*').eq('profile_id', profileId),
      supabaseAdmin.from('incomes').select('*').eq('profile_id', profileId),
      supabaseAdmin.from('expenses').select('*').eq('profile_id', profileId),
      supabaseAdmin.from('investments').select('*').eq('profile_id', profileId),
      supabaseAdmin.from('insurance_policies').select('*').eq('profile_id', profileId),
      supabaseAdmin.from('portfolio_snapshots').select('*').eq('profile_id', profileId)
    ]);

    // 3. Transform and return
    return res.status(200).json({
      assets: (assets || []).map(networthRowToFrontend),
      liabilities: (liabilities || []).map(networthRowToFrontend),
      incomes: (incomes || []).map(incomeRowToFrontend),
      expenses: (expenses || []).map(expenseRowToFrontend),
      investments: (investments || []).map(investmentRowToFrontend),
      insurances: (insurances || []).map(insuranceRowToFrontend),
      snapshots: (snapshots || []).map(monthlySnapshotRowToFrontend)
    });

  } catch (error) {
    console.error('Health API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
