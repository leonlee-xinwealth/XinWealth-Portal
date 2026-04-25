import { supabaseAdmin } from './_lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
    }

    const { targetMonth, targetYear, incomes, expenses, assets, liabilities, investments } = req.body;

    if (!targetMonth || !targetYear) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get client ID from user ID
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const clientId = client.id;
    const month = parseInt(targetMonth, 10);
    const year = parseInt(targetYear, 10);

    const mapToTable = (items, knownKeys, mapper) => {
      if (!items || !items.length) return [];
      return items.map(item => {
        const mapped = mapper(item);
        const custom_fields = {};
        Object.keys(item).forEach(k => {
          if (!knownKeys.includes(k)) {
            custom_fields[k] = item[k];
          }
        });
        return { ...mapped, custom_fields };
      });
    };

    // Prepare Incomes
    const incomeRecords = mapToTable(incomes, ['category', 'description', 'amount', 'month', 'year'], item => ({
      client_id: clientId,
      category: item.category,
      description: item.description || "",
      amount: parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      month: item.month || month,
      year: item.year || year
    }));

    // Prepare Expenses
    const expenseRecords = mapToTable(expenses, ['type', 'description', 'amount', 'month', 'year'], item => ({
      client_id: clientId,
      category: item.type, 
      type: item.description || "", 
      amount: parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      month: item.month || month,
      year: item.year || year
    }));

    // Prepare Assets (networth table)
    const assetRecords = mapToTable(assets, ['category', 'description', 'amount', 'month', 'year'], item => ({
      client_id: clientId,
      type: 'Asset',
      category: item.category,
      description: item.description || "",
      value: parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      month: item.month || month,
      year: item.year || year
    }));

    // Prepare Liabilities (networth table)
    const liabilityRecords = mapToTable(liabilities, ['category', 'description', 'amount', 'month', 'year'], item => ({
      client_id: clientId,
      type: 'Liability',
      category: item.category,
      description: item.description || "",
      value: parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      month: item.month || month,
      year: item.year || year
    }));

    // Prepare Investments
    const investmentRecords = mapToTable(investments, ['category', 'description', 'amount', 'month', 'year'], item => ({
      client_id: clientId,
      category: item.category,
      description: item.description || "",
      amount: parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      month: item.month || month,
      year: item.year || year
    }));

    // Insert all
    const inserts = [];
    if (incomeRecords.length > 0) inserts.push(supabaseAdmin.from('incomes').insert(incomeRecords));
    if (expenseRecords.length > 0) inserts.push(supabaseAdmin.from('expenses').insert(expenseRecords));
    if (assetRecords.length > 0) inserts.push(supabaseAdmin.from('networth').insert(assetRecords));
    if (liabilityRecords.length > 0) inserts.push(supabaseAdmin.from('networth').insert(liabilityRecords));
    if (investmentRecords.length > 0) inserts.push(supabaseAdmin.from('investments').insert(investmentRecords));

    if (inserts.length > 0) {
      await Promise.all(inserts);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Level Up Submission Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
