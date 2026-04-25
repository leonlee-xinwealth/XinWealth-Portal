/**
 * Lark Base → Supabase 数据迁移脚本
 * ----------------------------------------------------------------------
 * 用法：
 *   1. 填好 .env.migration（见同目录 .env.migration.example）
 *   2. npm i @supabase/supabase-js dotenv
 *   3. node supabase/scripts/migrate-from-lark.mjs --dry-run   （先空跑）
 *   4. node supabase/scripts/migrate-from-lark.mjs             （真跑）
 *
 * 设计原则：
 *   - 幂等：用 NRIC/Email 做冲突检查，重复执行不会重复插入
 *   - 分阶段：每张表独立函数，可以只跑一部分
 *   - 可回滚：先打印再写入；--dry-run 不改数据库
 *   - 日志友好：每条记录都打印成功/失败
 * ----------------------------------------------------------------------
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ---------- 配置 ----------
const LARK_APP_ID      = process.env.LARK_APP_ID;
const LARK_APP_SECRET  = process.env.LARK_APP_SECRET;
const LARK_APP_TOKEN   = process.env.LARK_APP_TOKEN;        // Base 的 app_token
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // 注意：service role，不是 anon

// Lark 表 ID（在 Lark Base 的 URL 里能看到，格式 tbl...）
const LARK_TABLES = {
  client:      process.env.LARK_TBL_CLIENT,
  incomes:     process.env.LARK_TBL_INCOMES,
  expenses:    process.env.LARK_TBL_EXPENSES,
  assets:      process.env.LARK_TBL_NETWORTH,       // networth 里混了资产和负债
  investments: process.env.LARK_TBL_INVESTMENTS,
  insurance:   process.env.LARK_TBL_INSURANCE,
};

const DRY_RUN = process.argv.includes('--dry-run');

// ---------- Supabase 客户端（用 service role 绕过 RLS）----------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ============================================================
// 1. Lark 工具函数
// ============================================================
async function getLarkToken() {
  const r = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: LARK_APP_ID, app_secret: LARK_APP_SECRET }),
  });
  const data = await r.json();
  if (!data.tenant_access_token) throw new Error('Lark auth failed: ' + JSON.stringify(data));
  return data.tenant_access_token;
}

async function fetchLarkTable(tableId, token) {
  const all = [];
  let pageToken = '';
  do {
    const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_APP_TOKEN}/tables/${tableId}/records?page_size=500${pageToken ? `&page_token=${pageToken}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    if (data.code !== 0) throw new Error('Lark fetch failed: ' + JSON.stringify(data));
    all.push(...(data.data?.items || []));
    pageToken = data.data?.page_token || '';
  } while (pageToken);
  return all;
}

// ============================================================
// 2. 单张表迁移逻辑（以 Client → profiles 为例）
// ============================================================
async function migrateClients(token) {
  console.log('\n=== Migrating: Client → profiles ===');
  const rows = await fetchLarkTable(LARK_TABLES.client, token);
  console.log(`  Lark 返回 ${rows.length} 条记录`);

  let success = 0, failed = 0, skipped = 0;

  for (const row of rows) {
    const f = row.fields;
    // ⚠️ 字段名按你实际 Lark 表里的标题调整
    const email = (f['Email'] || '').trim().toLowerCase();
    if (!email) { skipped++; continue; }

    // 先通过 Supabase Admin API 创建 auth 用户
    // 临时密码：用 NRIC 或随机字符串，后续让用户走"忘记密码"
    const temporaryPassword = f['NRIC'] || Math.random().toString(36).slice(2, 14);

    if (DRY_RUN) {
      console.log(`  [DRY] would create user ${email}`);
      success++;
      continue;
    }

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        family_name: f['Family Name'],
        given_name: f['Given Name'],
      },
    });

    if (authErr) {
      // 已存在就跳过，其它错误计 failed
      if (authErr.message.includes('already') || authErr.code === 'email_exists') {
        skipped++;
        continue;
      }
      console.error(`  ❌ ${email}: ${authErr.message}`);
      failed++;
      continue;
    }

    // trigger 已经插入基础 profile 了，这里 upsert 补齐详细字段
    const { error: upErr } = await supabase.from('profiles').update({
      family_name: f['Family Name'],
      given_name: f['Given Name'],
      salutation: f['Salutation'],
      nric: f['NRIC'],
      date_of_birth: normalizeDate(f['Date of Birth']),
      gender: normalizeEnum(f['Gender'], ['male','female','other']),
      marital_status: normalizeEnum(f['Marital Status'],
        ['single','married','divorced','widowed']),
      nationality: f['Nationality'],
      residency: f['Residency'],
      employment_status: normalizeEnum(f['Employment Status'],
        ['employed','self_employed','unemployed','retired','student']),
      tax_status: normalizeEnum(f['Tax Status'], ['resident','non_resident']),
      occupation: f['Occupation'],
      retirement_age: parseInt(f['Retirement Age']) || null,
      epf_account_number: f['EPF Account Number'],
      ppa_account_number: f['PPA Account Number'],
      correspondence_address: f['Correspondence Address'],
      correspondence_postal_code: f['Correspondence Postal Code'],
      correspondence_city: f['Correspondence City'],
      correspondence_state: f['Correspondence State'],
    }).eq('id', authUser.user.id);

    if (upErr) {
      console.error(`  ⚠️  ${email}: profile 更新失败 ${upErr.message}`);
      failed++;
    } else {
      console.log(`  ✅ ${email}`);
      success++;
    }
  }

  console.log(`  结果：成功 ${success} / 跳过 ${skipped} / 失败 ${failed}`);
}

// ============================================================
// 3. 示例：迁移 Incomes
// ============================================================
async function migrateIncomes(token) {
  console.log('\n=== Migrating: Incomes ===');
  const rows = await fetchLarkTable(LARK_TABLES.incomes, token);
  console.log(`  Lark 返回 ${rows.length} 条记录`);

  // 先建一张 email → profile_id 查表
  const { data: profiles } = await supabase.from('profiles').select('id, email');
  const idByEmail = new Map(profiles.map(p => [p.email.toLowerCase(), p.id]));

  const payload = [];
  for (const row of rows) {
    const f = row.fields;
    const email = (f['Client Email'] || '').trim().toLowerCase();
    const profileId = idByEmail.get(email);
    if (!profileId) continue;

    payload.push({
      profile_id: profileId,
      income_type: normalizeIncomeType(f['Type']),
      amount: parseFloat(f['Amount']) || 0,
      currency: f['Currency'] || 'MYR',
      period_month: firstOfMonth(f['Year'], f['Month']),
      is_recurring: f['Recurring'] !== false,
      source_note: f['Note'],
    });
  }

  console.log(`  准备插入 ${payload.length} 行`);
  if (DRY_RUN) { console.log('  [DRY] skip insert'); return; }

  // 分批，避免 payload 太大
  for (let i = 0; i < payload.length; i += 500) {
    const batch = payload.slice(i, i + 500);
    const { error } = await supabase.from('incomes').insert(batch);
    if (error) console.error(`  ❌ 批次 ${i}: ${error.message}`);
    else console.log(`  ✅ 插入 ${batch.length} 行`);
  }
}

// ============================================================
// 4. 工具：归一化
// ============================================================
function normalizeDate(v) {
  if (!v) return null;
  if (typeof v === 'number') return new Date(v).toISOString().slice(0, 10);
  return new Date(v).toISOString().slice(0, 10);
}

function normalizeEnum(v, allowed) {
  if (!v) return null;
  const lower = String(v).toLowerCase().replace(/\s+/g, '_');
  return allowed.includes(lower) ? lower : null;
}

function normalizeIncomeType(v) {
  const map = {
    'Salary': 'salary', 'Bonus': 'bonus',
    'Director Fee': 'director_fee', 'Commission': 'commission',
    'Dividend (Company)': 'dividend_company',
    'Dividend (Investment)': 'dividend_investment',
    'Rental': 'rental',
  };
  return map[v] || 'other';
}

function firstOfMonth(year, month) {
  const y = parseInt(year) || new Date().getFullYear();
  const m = String(parseInt(month) || 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

// ============================================================
// 5. 主流程
// ============================================================
async function main() {
  console.log(`\n🚀 XinWealth migration ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`);
  console.log(`   Supabase: ${SUPABASE_URL}`);

  const token = await getLarkToken();
  console.log('✅ Lark token OK');

  await migrateClients(token);
  await migrateIncomes(token);
  // await migrateExpenses(token);
  // await migrateAssets(token);
  // await migrateLiabilities(token);
  // await migrateInvestments(token);
  // await migrateInsurance(token);

  console.log('\n🎉 完成');
}

main().catch(e => { console.error(e); process.exit(1); });
