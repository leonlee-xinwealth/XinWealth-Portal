import { supabaseAdmin } from './_lib/supabase';
import {
  networthRowToFrontend,
  monthlySnapshotRowToFrontend,
  incomeRowToFrontend,
  expenseRowToFrontend,
  investmentRowToFrontend,
  insuranceRowToFrontend
} from './_lib/shape';

export default async function handler(req, res) {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'User name/email is required' });
  }

  try {
    // Get client id
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .or(`email.eq.${name},full_name.eq.${name}`);

    if (clientError || !clients || clients.length === 0) {
      return res.status(200).json({
        assets: [],
        liabilities: [],
        incomes: [],
        expenses: [],
        investments: [],
        insurance: [],
        monthlySnapshot: []
      });
    }

    const clientId = clients[0].id;

    // Fetch all tables concurrently
    const [
      { data: networthData },
      { data: monthlySnapshotData },
      { data: incomesData },
      { data: expensesData },
      { data: investmentsData },
      { data: insuranceData }
    ] = await Promise.all([
      supabaseAdmin.from('networth').select('*').eq('client_id', clientId),
      supabaseAdmin.from('monthly_snapshots').select('*').eq('client_id', clientId),
      supabaseAdmin.from('incomes').select('*').eq('client_id', clientId),
      supabaseAdmin.from('expenses').select('*').eq('client_id', clientId),
      supabaseAdmin.from('investments').select('*').eq('client_id', clientId),
      supabaseAdmin.from('insurance').select('*').eq('client_id', clientId)
    ]);

    const networth = (networthData || []).map(networthRowToFrontend);
    
    // Split networth into assets and liabilities based on 'Type'
    const assets = networth.filter(item => item.fields['Type'] === 'Asset');
    const liabilities = networth.filter(item => item.fields['Type'] === 'Liability');

    const monthlySnapshot = (monthlySnapshotData || []).map(monthlySnapshotRowToFrontend);
    const incomes = (incomesData || []).map(incomeRowToFrontend);
    const expenses = (expensesData || []).map(expenseRowToFrontend);
    const investments = (investmentsData || []).map(investmentRowToFrontend);
    const insurance = (insuranceData || []).map(insuranceRowToFrontend);

    return res.status(200).json({
        assets,
        liabilities,
        incomes,
        expenses,
        investments,
        insurance,
        monthlySnapshot
    });

  } catch (error) {
    console.error("Health Data API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
