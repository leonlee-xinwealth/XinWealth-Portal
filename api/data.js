import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const monthName = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return MONTH_NAMES[d.getMonth()] || '';
};

const yearString = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return String(d.getFullYear());
};

const toMs = (dateStr) => {
  const d = new Date(dateStr);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
};

const record = (id, fields) => ({ id, record_id: id, fields });

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
  if (!clientRow?.id) return res.status(200).json({ records: [] });

  const { data: holdings, error: holdingsErr } = await supabaseAdmin
    .from('portfolio_holdings')
    .select('*')
    .eq('client_id', clientRow.id);

  if (holdingsErr) return res.status(500).json({ error: 'Failed to fetch holdings', details: holdingsErr.message });

  const byMonth = new Map();
  for (const h of holdings || []) {
    const date = h.snapshot_month || h.created_at;
    const key = String(date || '');
    const current = byMonth.get(key) || { id: key, date, marketValue: 0 };
    current.marketValue += Number(h.market_value || 0);
    byMonth.set(key, current);
  }

  const records = Array.from(byMonth.values()).map((row) => {
    const date = row.date;
    return record(row.id, {
      'Date': toMs(date),
      'End Value': Number(row.marketValue || 0),
      'Cashflow': 0,
      'FD': 0,
      'Month': monthName(date) || '',
      'Year': yearString(date) || ''
    });
  });

  return res.status(200).json({ records });
}

