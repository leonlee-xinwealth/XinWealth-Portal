import { supabase, findProfileByName } from './_supabase.js';

// Maps a portfolio_snapshots row → the shape larkService.ts expects for portfolio calculations
// (End Value, Cashflow, Date, FD are the four fields used for TWR / XIRR / chart)
const transformSnapshot = (row) => ({
  id:          `${row.profile_id}_${row.snapshot_date}`,
  create_time: new Date(row.snapshot_date).getTime(),
  fields: {
    "Date":      row.snapshot_date,
    "End Value": parseFloat(row.market_value) || 0,
    "Cashflow":  parseFloat(row.invested)     || 0,
    "FD":        parseFloat(row.fd_benchmark) || 0
  }
});

export default async function handler(req, res) {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'User name is required' });

  try {
    const profile = await findProfileByName(name);
    if (!profile) return res.status(200).json({ records: [] });

    const { data: snapshots, error } = await supabase
      .from('portfolio_snapshots')
      .select('profile_id, snapshot_date, market_value, invested, fd_benchmark')
      .eq('profile_id', profile.id)
      .order('snapshot_date', { ascending: true });

    if (error) {
      console.error('portfolio_snapshots query error:', error);
      return res.status(200).json({ records: [] });
    }

    return res.status(200).json({ records: (snapshots || []).map(transformSnapshot) });

  } catch (error) {
    console.error('Data API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
