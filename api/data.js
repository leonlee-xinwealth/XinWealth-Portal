import { supabaseAdmin } from './_lib/supabase.js';
import { investmentRowToFrontend } from './_lib/shape.js';

export default async function handler(req, res) {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'User email is required' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    // Search for profile
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', name)
      .maybeSingle();

    if (profileError || !profiles) {
      return res.status(200).json([]);
    }

    const profileId = profiles.id;

    // Fetch investments
    const { data: investments, error: invError } = await supabaseAdmin
      .from('investments')
      .select('*')
      .eq('profile_id', profileId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (invError) throw invError;

    return res.status(200).json((investments || []).map(investmentRowToFrontend));
  } catch (error) {
    console.error('Data API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
