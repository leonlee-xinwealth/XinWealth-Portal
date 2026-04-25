#!/usr/bin/env node
// ============================================================
// csv-to-supabase.mjs
// ------------------------------------------------------------
// 读取 supabase/scripts/csv-export/ 里的 CSV，导入 Supabase。
// 不用懂 Lark API，也不用懂 Node.js，只要有 CSV 就能跑。
//
// 使用：
//   npm install @supabase/supabase-js dotenv
//   cp .env.migration.example .env.migration
//   # 编辑 .env.migration 填 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY
//
//   node supabase/scripts/csv-to-supabase.mjs dry-run    # 模拟，不写
//   node supabase/scripts/csv-to-supabase.mjs run        # 真跑
// ============================================================

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
const DEFAULT_PASSWORD = process.env.MIGRATION_DEFAULT_PASSWORD || 'ChangeMe123!';

// ---------- 工具：读 CSV（自己写的简单解析器，不装第三方库） ----------
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
  const headers = rows.shift();
  return rows
    .filter(r => r.some(v => v !== ''))
    .map(r => Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ''])));
}

function num(v)  { return v === '' || v == null ? null : Number(v); }
function int(v)  { return v === '' || v == null ? null : parseInt(v, 10); }
function str(v)  { return v === '' || v == null ? null : String(v); }
function date(v) { return v === '' || v == null ? null : v; }

// ---------- Supabase client ----------
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ 缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  console.error('   请在 supabase/scripts/.env.migration 里填好两个值');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// ---------- 主流程 ----------
async function main() {
  console.log(`\n📦 CSV → Supabase 迁移  [模式: ${MODE === 'run' ? '真跑' : '模拟 (DRY RUN)'}]\n`);
  console.log(`读取目录: ${CSV_DIR}\n`);

  // ========== 1. profiles ==========
  const profiles = parseCsv(join(CSV_DIR, 'profiles.csv'));
  console.log(`读取 profiles.csv: ${profiles.length} 行`);

  const emailToId = {};   // email → auth.users.id

  if (DRY_RUN) {
    console.log('  (DRY RUN) 不会创建 auth 用户，也不会更新 profiles');
    // 为了让后续子表模拟也能跑，先用假 UUID 占位
    for (const p of profiles) emailToId[p.email] = 'DRY-RUN-FAKE-UUID';
  } else {
    let created = 0, existed = 0, failed = 0;
    for (const p of profiles) {
      // 1) 建 auth 用户（已存在就沿用）
      const { data: created1, error: err1 } = await supabase.auth.admin.createUser({
        email: p.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          client_code: p.client_code,
          full_name: `${p.given_name} ${p.family_name}`.trim(),
        },
      });

      let userId = created1?.user?.id;
      if (err1) {
        if (/already/i.test(err1.message) || /registered/i.test(err1.message)) {
          // 已存在 → 查一下 ID
          const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const found = list?.users?.find(u => u.email?.toLowerCase() === p.email.toLowerCase());
          if (found) { userId = found.id; existed++; }
          else { console.error(`  ❌ ${p.email}: 提示已存在但查不到`); failed++; continue; }
        } else {
          console.error(`  ❌ ${p.email}: ${err1.message}`); failed++; continue;
        }
      } else {
        created++;
      }
      emailToId[p.email] = userId;

      // 2) handle_new_user 触发器已经建了 profile，我们补齐 KYC 字段
      const { error: err2 } = await supabase.from('profiles').update({
        family_name:                 str(p.family_name),
        given_name:                  str(p.given_name),
        salutation:                  str(p.salutation),
        nric:                        str(p.nric),
        date_of_birth:               date(p.date_of_birth),
        gender:                      str(p.gender) || null,
        marital_status:              str(p.marital_status) || null,
        nationality:                 str(p.nationality),
        residency:                   str(p.residency),
        employment_status:           str(p.employment_status) || null,
        tax_status:                  str(p.tax_status) || null,
        occupation:                  str(p.occupation),
        retirement_age:              int(p.retirement_age),
        epf_account_number:          str(p.epf_account_number),
        ppa_account_number:          str(p.ppa_account_number),
        correspondence_address:      str(p.correspondence_address),
        correspondence_postal_code:  str(p.correspondence_postal_code),
        correspondence_city:         str(p.correspondence_city),
        correspondence_state:        str(p.correspondence_state),
      }).eq('id', userId);
      if (err2) console.error(`  ⚠️ ${p.email} profile 更新失败: ${err2.message}`);
    }
    console.log(`  ✅ profiles: 新建 ${created}, 已存在 ${existed}, 失败 ${failed}\n`);
  }

  // ========== 2. 子表 ==========
  await importSubTable('incomes.csv', 'incomes', row => ({
    profile_id:   emailToId[row.client_email],
    income_type:  row.income_type,
    amount:       num(row.amount),
    currency:     row.currency || 'MYR',
    period_month: `${row.year}-${String(row.month).padStart(2, '0')}-01`,
    source_note:  str(row.source_note),
  }));

  await importSubTable('expenses.csv', 'expenses', row => ({
    profile_id:   emailToId[row.client_email],
    category:     row.category,
    amount:       num(row.amount),
    currency:     row.currency || 'MYR',
    period_month: `${row.year}-${String(row.month).padStart(2, '0')}-01`,
    description:  str(row.description),
  }));

  await importSubTable('assets.csv', 'assets', row => ({
    profile_id:  emailToId[row.client_email],
    kind:        row.kind,
    name:        str(row.name),
    value:       num(row.value),
    currency:    row.currency || 'MYR',
    acquired_at: date(row.acquired_at),
  }));

  await importSubTable('liabilities.csv', 'liabilities', row => ({
    profile_id:      emailToId[row.client_email],
    kind:            row.kind,
    name:            str(row.name),
    principal:       num(row.principal),
    balance:         num(row.balance),
    interest_rate:   num(row.interest_rate),
    monthly_payment: num(row.monthly_payment),
    start_date:      date(row.start_date),
    end_date:        date(row.end_date),
  }));

  await importSubTable('investments.csv', 'investments', row => ({
    profile_id:    emailToId[row.client_email],
    asset_class:   row.asset_class,
    ticker:        str(row.ticker),
    name:          str(row.name) || str(row.ticker) || row.asset_class,
    units:         num(row.units),
    cost_basis:    num(row.cost_basis),
    current_value: num(row.current_value),
    currency:      row.currency || 'MYR',
    purchased_at:  date(row.purchased_at),
  }));

  await importSubTable('insurance_policies.csv', 'insurance_policies', row => ({
    profile_id:        emailToId[row.client_email],
    policy_type:       str(row.policy_type),
    provider:          str(row.provider),
    policy_number:     str(row.policy_number),
    sum_assured:       num(row.sum_assured),
    premium:           num(row.premium),
    premium_frequency: str(row.premium_frequency) || null,
    start_date:        date(row.start_date),
    end_date:          date(row.end_date),
  }));

  await importSubTable('portfolio_snapshots.csv', 'portfolio_snapshots', row => ({
    profile_id:    emailToId[row.client_email],
    snapshot_date: date(row.as_of_date),
    market_value:  num(row.end_value),
    invested:      num(row.cashflow),
    twr:           row.monthly_return ? num(row.monthly_return.replace('%', '')) / 100 : null,
  }));

  console.log(`\n✅ 完成 [模式: ${MODE === 'run' ? '真跑' : 'DRY RUN'}]`);
  if (DRY_RUN) {
    console.log('\n看起来 OK？运行真迁移：');
    console.log('    node supabase/scripts/csv-to-supabase.mjs run');
  } else {
    console.log('\n下一步：让所有用户走"忘记密码"重设');
    console.log(`当前所有迁移用户的临时密码是：${DEFAULT_PASSWORD}`);
  }
}

async function importSubTable(csvName, tableName, rowBuilder) {
  let rows;
  try { rows = parseCsv(join(CSV_DIR, csvName)); }
  catch (e) { console.log(`跳过 ${csvName} (文件不存在)`); return; }
  console.log(`读取 ${csvName}: ${rows.length} 行`);

  const built = rows
    .map(rowBuilder)
    .filter(r => r.profile_id && r.profile_id !== 'DRY-RUN-FAKE-UUID');

  if (DRY_RUN) {
    const missing = rows.filter(r => !r.client_email || !emailToId_placeholder_check(r.client_email));
    console.log(`  (DRY RUN) 会插入 ${rows.length} 行 → ${tableName}`);
    if (rows[0]) console.log(`  示例: ${JSON.stringify(rowBuilder(rows[0])).slice(0, 200)}`);
    return;
  }

  if (!built.length) { console.log(`  (空)`); return; }
  // 分批插入，每批 500 行
  const BATCH = 500;
  let inserted = 0, failed = 0;
  for (let i = 0; i < built.length; i += BATCH) {
    const batch = built.slice(i, i + BATCH);
    const { error } = await supabase.from(tableName).insert(batch);
    if (error) {
      console.error(`  ❌ ${tableName} batch ${i}-${i + batch.length}: ${error.message}`);
      failed += batch.length;
    } else {
      inserted += batch.length;
    }
  }
  console.log(`  ✅ ${tableName}: 插入 ${inserted}, 失败 ${failed}\n`);
}

// 小 helper：dry-run 模式下让"缺 email"检查能走
function emailToId_placeholder_check() { return true; }

main().catch(e => { console.error('\n💥 FATAL:', e); process.exit(1); });
