import { supabaseAdmin } from './_lib/supabase.js';
import { investmentRowToFrontend } from './_lib/shape.js';

export default async function handler(req, res) {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'User name/email is required' });
  }

  try {
    // Optional: if frontend sends token, we could verify it here.
    // For now, we query the client by email or name using admin client
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, full_name, email')
      .or(`email.eq.${name},full_name.eq.${name}`);

    if (clientError || !clients || clients.length === 0) {
      return res.status(200).json({ records: [] });
    }

    const clientId = clients[0].id;

    // Fetch investments for this client
    const { data: investments, error: investError } = await supabaseAdmin
      .from('investments')
      .select('*')
      .eq('client_id', clientId)
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (investError) {
      throw investError;
    }

    const formattedRecords = investments.map(investmentRowToFrontend);

    // Map to the shape that frontend expects (data.records)
    return res.status(200).json({ records: formattedRecords });

  } catch (error) {
    console.error("Data API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
