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
      error: 'Server Config Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables in Vercel.' 
    });
  }

  try {
    // Get profile id - search by email or name in profiles table
    // Since names are split, we'll try email first
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`email.eq.${name},given_name.ilike.%${name}%,family_name.ilike.%${name}%`);

    if (profileError || !profiles || profiles.length === 0) {
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

    // Fetch related data using the profile_id (assuming fk is profile_id in assets, incomes, etc.)
    // Note: User's schema has 'profile_id' as the foreign key in 'assets'
    const [
      { data: assets },
      { data: incomes },
      { data: expenses },
      { data: investments },
      { data: insurances },
      { data: snapshots }
    ] = await Promise.all([
      supabaseAdmin.from('assets').select('*').eq('profile_id', profileId),
      supabaseAdmin.from('incomes').select('*').eq('profile_id', profileId),
      supabaseAdmin.from('expenses').select('*').eq('profile_id', profileId),
      supabaseAdmin.from('investments').select('*').eq('profile_id', profileId),
      supabaseAdmin.from('insurance_policies').select('*').eq('profile_id', profileId),
      supabaseAdmin.from('portfolio_snapshots').select('*').eq('profile_id', profileId)
    ]);

    // Transform rows for frontend
    // We filter assets into Asset and Liability based on 'kind' or 'value'
    // Note: User's assets table has 'kind'.
    const transformedAssets = (assets || []).filter(a => a.value >= 0).map(networthRowToFrontend);
    const transformedLiabilities = (assets || []).filter(a => a.value < 0).map(networthRowToFrontend);

    return res.status(200).json({
      assets: transformedAssets,
      liabilities: transformedLiabilities,
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
