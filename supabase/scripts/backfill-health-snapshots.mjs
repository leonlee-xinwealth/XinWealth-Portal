#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.migration') });

const MODE = process.argv[2] || 'dry-run';
const DRY_RUN = MODE !== 'run';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
);

const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const ratio = (a, b) => b > 0 ? a / b : null;
const toMonthly = (amount, frequency) => {
  const value = n(amount);
  switch (String(frequency || 'monthly').toLowerCase()) {
    case 'weekly': return value * 52 / 12;
    case 'biweekly': return value * 26 / 12;
    case 'quarterly': return value / 3;
    case 'semi_annual': return value / 6;
    case 'annual':
    case 'yearly': return value / 12;
    default: return value;
  }
};

async function all(table, columns, clientId) {
  const { data, error } = await supabase.from(table).select(columns).eq('client_id', clientId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

function firstDayOfCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

async function buildSnapshot(client) {
  const [assets, liabilities, cashflows, policies, holdings] = await Promise.all([
    all('assets', '*', client.id),
    all('liabilities', '*', client.id),
    all('cashflow_entries', '*', client.id),
    all('insurance_policies', '*', client.id),
    all('portfolio_holdings', '*', client.id),
  ]);

  const monthlyIncome = cashflows
    .filter((e) => String(e.direction || '').toLowerCase() === 'inflow')
    .reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
  const monthlyExpenses = cashflows
    .filter((e) => String(e.direction || '').toLowerCase() === 'outflow')
    .reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
  const monthlySavings = monthlyIncome - monthlyExpenses;

  const totalAssets = assets.reduce((sum, a) => sum + n(a.current_value ?? a.value), 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + n(l.outstanding_balance ?? l.balance), 0);
  const netWorth = totalAssets - totalLiabilities;

  const cashAndFD = assets
    .filter((a) => {
      const type = String(a.asset_type || a.kind || '').toLowerCase();
      const liquidity = String(a.liquidity || '').toLowerCase();
      return liquidity === 'high' || ['savings', 'fixed_deposit', 'money_market', 'money_market_fund'].includes(type);
    })
    .reduce((sum, a) => sum + n(a.current_value ?? a.value), 0);

  const totalMonthlyDebtRepayment = liabilities.reduce((sum, l) => sum + n(l.monthly_payment), 0);
  const consumerDebtRepayment = liabilities
    .filter((l) => !String(l.liability_type || l.kind || '').toLowerCase().includes('mortgage'))
    .reduce((sum, l) => sum + n(l.monthly_payment), 0);

  const activePolicies = policies.filter((p) => !p.end_date || p.end_date >= new Date().toISOString().slice(0, 10));
  const totalSumAssured = activePolicies
    .filter((p) => ['life', 'life_insurance', 'investment_linked'].includes(String(p.policy_type || '').toLowerCase()))
    .reduce((sum, p) => sum + n(p.sum_assured), 0);

  const investmentAssets = holdings.reduce((sum, h) => sum + n(h.market_value), 0)
    + assets
      .filter((a) => a.metadata?.is_investment)
      .reduce((sum, a) => sum + n(a.current_value ?? a.value), 0);

  const annualIncome = monthlyIncome * 12;
  const annualExpenses = monthlyExpenses * 12;
  const annualPassiveIncome = cashflows
    .filter((e) => {
      const category = String(e.category || '').toLowerCase();
      return String(e.direction || '').toLowerCase() === 'inflow'
        && (category.includes('rental') || category.includes('dividend') || category.includes('interest'));
    })
    .reduce((sum, e) => sum + toMonthly(e.amount, e.frequency) * 12, 0);

  return {
    client_id: client.id,
    snapshot_date: firstDayOfCurrentMonth(),
    basic_liquidity_ratio: ratio(cashAndFD, monthlyExpenses),
    liquid_asset_to_net_worth: ratio(cashAndFD, netWorth),
    solvency_ratio: ratio(netWorth, totalAssets),
    debt_service_ratio: ratio(totalMonthlyDebtRepayment, monthlyIncome),
    non_mortgage_dsr: ratio(consumerDebtRepayment, monthlyIncome),
    life_insurance_coverage: ratio(totalSumAssured, annualIncome),
    savings_ratio: ratio(monthlySavings, monthlyIncome),
    invest_assets_to_net_worth: ratio(investmentAssets, netWorth),
    passive_income_coverage: ratio(annualPassiveIncome, annualExpenses),
    net_worth: netWorth,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    raw_metrics: {
      cashAndFD,
      monthlyIncome,
      monthlyExpenses,
      monthlySavings,
      totalMonthlyDebtRepayment,
      consumerDebtRepayment,
      totalSumAssured,
      annualIncome,
      annualExpenses,
      investmentAssets,
      annualPassiveIncome,
    },
  };
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in supabase/scripts/.env.migration');
  }

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, email, full_name')
    .not('email', 'is', null);
  if (error) throw error;

  const snapshots = [];
  for (const client of clients || []) {
    const snapshot = await buildSnapshot(client);
    if (snapshot.total_assets > 0 || snapshot.total_liabilities > 0 || snapshot.raw_metrics.monthlyIncome > 0 || snapshot.raw_metrics.monthlyExpenses > 0) {
      snapshots.push(snapshot);
    }
  }

  console.log(`${DRY_RUN ? 'DRY RUN' : 'RUN'}: prepared ${snapshots.length} health snapshots from ${(clients || []).length} clients`);
  if (DRY_RUN) {
    console.log('Run: node supabase/scripts/backfill-health-snapshots.mjs run');
    return;
  }

  const { error: upsertError } = await supabase
    .from('health_snapshots')
    .upsert(snapshots, { onConflict: 'client_id,snapshot_date' });
  if (upsertError) throw upsertError;
  console.log(`Inserted/updated ${snapshots.length} health_snapshots for ${firstDayOfCurrentMonth()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
