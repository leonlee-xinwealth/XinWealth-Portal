#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.migration') });

const CSV_DIR = join(__dirname, 'csv-export');
const MODE = process.argv[2] || 'dry-run';
const DRY_RUN = MODE !== 'run';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
);

function parseCsv(path) {
  const text = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '');
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.filter(r => r.some(v => v !== '')).map(r => Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ''])));
}

const num = (v) => v === '' || v == null ? null : Number(String(v).replace('%', ''));
const date = (v) => v || null;
const str = (v) => v === '' || v == null ? null : String(v);
const slug = (v) => String(v || 'investment').replace(/[^a-z0-9]+/gi, ' ').trim();

async function clientIdsByEmail() {
  const { data, error } = await supabase.from('clients').select('id,email');
  if (error) throw error;
  return new Map((data || []).filter(c => c.email).map(c => [String(c.email).toLowerCase(), c.id]));
}

async function insert(table, rows) {
  if (DRY_RUN || rows.length === 0) return { inserted: rows.length, failed: 0 };
  const { error } = await supabase.from(table).insert(rows);
  if (error) {
    console.error(`${table}: ${error.message}`);
    return { inserted: 0, failed: rows.length };
  }
  return { inserted: rows.length, failed: 0 };
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in supabase/scripts/.env.migration');
  }

  const emailToClientId = await clientIdsByEmail();
  const investmentRows = parseCsv(join(CSV_DIR, 'investments.csv'));
  const snapshotRows = parseCsv(join(CSV_DIR, 'portfolio_snapshots.csv'));
  const { data: existingAccounts, error: existingAccountsError } = await supabase
    .from('investment_accounts')
    .select('id,client_id,account_name,platform');
  if (existingAccountsError) throw existingAccountsError;
  const existingAccountKeys = new Set(
    (existingAccounts || []).map(a => `${a.client_id}:${a.platform || 'other'}:${a.account_name}`)
  );

  const accountRows = [];
  const accountKeyToClient = new Map();
  for (const row of investmentRows) {
    const clientId = emailToClientId.get(String(row.client_email || '').toLowerCase());
    if (!clientId) continue;
    const accountName = slug(row.name || row.ticker || row.asset_class || 'Investment Portfolio');
    const key = `${clientId}:${row.asset_class || 'other'}:${accountName}`;
    if (accountKeyToClient.has(key)) continue;
    accountKeyToClient.set(key, clientId);
    if (existingAccountKeys.has(key)) continue;
    accountRows.push({
      client_id: clientId,
      account_type: 'other',
      account_name: accountName,
      platform: str(row.asset_class),
      opened_date: date(row.purchased_at),
      currency: row.currency || 'MYR',
      status: 'active',
      notes: 'Imported from supabase/scripts/csv-export/investments.csv',
    });
  }

  console.log(`${DRY_RUN ? 'DRY RUN' : 'RUN'}: ${accountRows.length} investment_accounts from ${investmentRows.length} CSV rows`);
  const accountResult = await insert('investment_accounts', accountRows);
  console.log(`investment_accounts prepared/inserted=${accountResult.inserted} failed=${accountResult.failed}`);

  let accountIds = existingAccounts || [];
  if (!DRY_RUN) {
    const clientIds = Array.from(new Set([...accountRows.map(r => r.client_id), ...Array.from(accountKeyToClient.values())]));
    if (clientIds.length > 0) {
      const { data, error } = await supabase
        .from('investment_accounts')
        .select('id,client_id,account_name,platform')
        .in('client_id', clientIds);
      if (error) throw error;
      accountIds = data || [];
    }
  }

  const findAccountId = (clientId, sourceRow) => {
    if (DRY_RUN) return 'DRY-RUN-ACCOUNT-ID';
    const name = slug(sourceRow.name || sourceRow.ticker || sourceRow.asset_class || 'Investment Portfolio');
    return accountIds.find(a => a.client_id === clientId && a.account_name === name && (a.platform || '') === (sourceRow.asset_class || ''))?.id
      || accountIds.find(a => a.client_id === clientId)?.id
      || null;
  };

  const { data: existingHoldings, error: existingHoldingsError } = await supabase
    .from('portfolio_holdings')
    .select('client_id,account_id,snapshot_month,instrument_code,instrument_name,market_value');
  if (existingHoldingsError) throw existingHoldingsError;
  const existingHoldingKeys = new Set((existingHoldings || []).map(h =>
    `${h.client_id}:${h.account_id}:${h.snapshot_month}:${h.instrument_code}:${h.instrument_name}:${Number(h.market_value || 0)}`
  ));

  const holdingRows = investmentRows.map((row) => {
    const clientId = emailToClientId.get(String(row.client_email || '').toLowerCase());
    if (!clientId) return null;
    const units = num(row.units) || 1;
    const marketValue = num(row.current_value) || 0;
    const accountId = findAccountId(clientId, row);
    const holding = {
      client_id: clientId,
      account_id: accountId,
      snapshot_month: date(row.purchased_at) || new Date().toISOString().slice(0, 7) + '-01',
      instrument_code: str(row.ticker) || slug(row.name || row.asset_class || 'investment').toUpperCase().replace(/\s+/g, '_'),
      instrument_name: str(row.name) || str(row.ticker) || str(row.asset_class) || 'Investment',
      units_held: units,
      nav_per_unit: units ? marketValue / units : marketValue,
      market_value: marketValue,
      cost_basis: num(row.cost_basis),
    };
    const key = `${holding.client_id}:${holding.account_id}:${holding.snapshot_month}:${holding.instrument_code}:${holding.instrument_name}:${Number(holding.market_value || 0)}`;
    return holding.account_id && !existingHoldingKeys.has(key) ? holding : null;
  }).filter(Boolean);

  console.log(`${DRY_RUN ? 'DRY RUN' : 'RUN'}: ${holdingRows.length} portfolio_holdings`);
  const holdingResult = await insert('portfolio_holdings', holdingRows);
  console.log(`portfolio_holdings prepared/inserted=${holdingResult.inserted} failed=${holdingResult.failed}`);

  const { data: existingTransactions, error: existingTransactionsError } = await supabase
    .from('investment_transactions')
    .select('account_id,client_id,category_code,tx_date,amount,instrument_code,instrument_name,notes');
  if (existingTransactionsError) throw existingTransactionsError;
  const existingTransactionKeys = new Set((existingTransactions || []).map(tx =>
    `${tx.account_id}:${tx.client_id}:${tx.category_code}:${tx.tx_date}:${Number(tx.amount || 0)}:${tx.instrument_code || ''}:${tx.instrument_name || ''}:${tx.notes || ''}`
  ));

  const txRows = investmentRows.map((row) => {
    const clientId = emailToClientId.get(String(row.client_email || '').toLowerCase());
    if (!clientId) return null;
    const accountId = findAccountId(clientId, row);
    const tx = {
      account_id: accountId,
      client_id: clientId,
      category_code: 'deposit',
      tx_date: date(row.purchased_at) || new Date().toISOString().slice(0, 10),
      amount: num(row.cost_basis) || num(row.current_value) || 0,
      currency: row.currency || 'MYR',
      instrument_code: str(row.ticker),
      instrument_name: str(row.name) || str(row.ticker) || str(row.asset_class) || 'Investment',
      units_transacted: num(row.units),
      price_per_unit: num(row.units) ? (num(row.cost_basis) || num(row.current_value) || 0) / num(row.units) : null,
      notes: `Imported ${row.name || row.ticker || row.asset_class || 'investment'}`,
    };
    const key = `${tx.account_id}:${tx.client_id}:${tx.category_code}:${tx.tx_date}:${Number(tx.amount || 0)}:${tx.instrument_code || ''}:${tx.instrument_name || ''}:${tx.notes || ''}`;
    return tx.account_id && !existingTransactionKeys.has(key) ? tx : null;
  }).filter(Boolean);

  console.log(`${DRY_RUN ? 'DRY RUN' : 'RUN'}: ${txRows.length} investment_transactions`);
  const txResult = await insert('investment_transactions', txRows);
  console.log(`investment_transactions prepared/inserted=${txResult.inserted} failed=${txResult.failed}`);

  console.log(`portfolio_snapshots.csv rows available: ${snapshotRows.length}; current portal uses portfolio_holdings for monthly portfolio values.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
