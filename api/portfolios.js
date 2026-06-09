// api/portfolios.js
import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseAdmin) return configError(res);

  const { user, error } = await getAuthUser(req);
  if (error || !user) {
    return res.status(401).json({ error: `Unauthorized: ${error || 'Invalid token'}` });
  }

  const email = (user.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Missing email on auth user' });

  const { data: clientRow, error: clientErr } = await supabaseAdmin
    .from('clients')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (clientErr) return res.status(500).json({ error: 'Error fetching client', details: clientErr.message });
  if (!clientRow?.id) return res.status(200).json({ portfolios: [] });

  const { data: portfolios, error: portErr } = await supabaseAdmin
    .from('portfolios')
    .select(`
      id,
      name,
      currency,
      capital_injection,
      injection_date,
      portfolio_history (
        snapshot_date,
        end_value,
        cashflow
      )
    `)
    .eq('client_id', clientRow.id)
    .order('injection_date', { ascending: true })
    .order('snapshot_date', { referencedTable: 'portfolio_history', ascending: true });

  if (portErr) {
    return res.status(500).json({ error: 'Failed to fetch portfolios', details: portErr.message });
  }

  // Sort history by snapshot_date ascending within each portfolio
  const result = (portfolios || []).map(p => ({
    ...p,
    portfolio_history: (p.portfolio_history || []).sort(
      (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    )
  }));

  return res.status(200).json({ portfolios: result });
}
