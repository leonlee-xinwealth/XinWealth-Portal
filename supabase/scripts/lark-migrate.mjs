/**
 * ==========================================================================
 * Lark Base → Supabase 自动迁移脚本（配置驱动）
 * ==========================================================================
 *
 * 3 种模式：
 *   node lark-migrate.mjs inspect  → 列出 Lark 所有表的字段名（用来填 mapping）
 *   node lark-migrate.mjs dry-run  → 空跑一遍，不改 Supabase
 *   node lark-migrate.mjs run      → 真跑，把数据写进 Supabase
 *
 * 所有字段映射都在 lark-mapping.json，改那个就好，别改脚本。
 * ==========================================================================
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- 读配置 ----------
const mapping = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'lark-mapping.json'), 'utf-8')
);

const LARK_BASE = mapping.lark_region === 'feishu'
  ? 'https://open.feishu.cn'
  : 'https://open.larksuite.com';

const env = {
  LARK_APP_ID:     process.env.LARK_APP_ID,
  LARK_APP_SECRET: process.env.LARK_APP_SECRET,
  LARK_APP_TOKEN:  process.env.LARK_APP_TOKEN,
  SUPABASE_URL:    process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

for (const [k, v] of Object.entries(env)) {
  if (!v) { console.error(`❌ .env.migration 缺少 ${k}`); process.exit(1); }
}

const MODE = process.argv[2] || 'help';

// ==========================================================
// Lark API 封装
// ==========================================================
async function getLarkToken() {
  const r = await fetch(`${LARK_BASE}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET }),
  });
  const data = await r.json();
  if (!data.tenant_access_token) {
    throw new Error('Lark 认证失败: ' + JSON.stringify(data));
  }
  return data.tenant_access_token;
}

async function listLarkTables(token) {
  const r = await fetch(
    `${LARK_BASE}/open-apis/bitable/v1/apps/${env.LARK_APP_TOKEN}/tables?page_size=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await r.json();
  if (data.code !== 0) throw new Error('列表表失败: ' + JSON.stringify(data));
  return data.data?.items || [];
}

async function fetchLarkRecords(tableId, token) {
  const all = [];
  let pageToken = '';
  do {
    const url = `${LARK_BASE}/open-apis/bitable/v1/apps/${env.LARK_APP_TOKEN}`
              + `/tables/${tableId}/records?page_size=500`
              + (pageToken ? `&page_token=${pageToken}` : '');
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    if (data.code !== 0) throw new Error(`取 ${tableId} 失败: ${JSON.stringify(data)}`);
    all.push(...(data.data?.items || []));
    pageToken = data.data?.page_token || '';
  } while (pageToken);
  return all;
}

// ==========================================================
// Supabase 客户端（service role → 绕过 RLS）
// ==========================================================
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ==========================================================
// 工具：从 Lark 一行记录中取值（处理各种 Lark 字段类型）
// ==========================================================
function getValue(fields, larkFieldName) {
  const v = fields[larkFieldName];
  if (v === undefined || v === null || v === '') return null;

  // Lark 文本字段常常返回 [{type:'text', text:'xxx'}]
  if (Array.isArray(v) && v[0]?.text) return v.map(x => x.text).join('').trim();

  // Lark 单选字段返回字符串或对象
  if (typeof v === 'object' && v.text) return v.text;

  // Lark 附件/链接等先简单转字符串
  if (typeof v === 'object') return JSON.stringify(v);

  return v;
}

function applyEnum(value, map) {
  if (!value || !map) return value;
  return map[value] || map[String(value).trim()] || null;
}

function toDate(v) {
  if (!v) return null;
  const d = typeof v === 'number' ? new Date(v) : new Date(v);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function firstOfMonth(year, month) {
  const y = parseInt(year) || new Date().getFullYear();
  const m = String(parseInt(month) || 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

// ==========================================================
// 模式 1: INSPECT —— 列出 Lark 所有表和字段
// ==========================================================
async function inspect() {
  console.log('🔍 连接 Lark 中...');
  const token = await getLarkToken();
  console.log('✅ Lark 认证成功\n');

  const tables = await listLarkTables(token);
  console.log(`📋 在这个 Base 里找到 ${tables.length} 张表：\n`);

  for (const t of tables) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📑 表名: ${t.name}`);
    console.log(`   table_id: ${t.table_id}     ← 把这个填进 lark-mapping.json`);

    // 取 3 行样本数据看字段
    const sample = await fetchLarkRecords(t.table_id, token);
    if (sample.length === 0) {
      console.log('   (空表)\n');
      continue;
    }
    const fieldNames = Object.keys(sample[0].fields);
    console.log(`   字段列表（共 ${fieldNames.length} 个）:`);
    fieldNames.forEach(f => {
      const sampleVal = sample[0].fields[f];
      const preview = JSON.stringify(sampleVal).slice(0, 60);
      console.log(`     · "${f}"  →  ${preview}`);
    });
    console.log(`   总行数: ${sample.length}\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📝 下一步：');
  console.log('  1. 打开 supabase/scripts/lark-mapping.json');
  console.log('  2. 对每张要搬的表，把 table_id 和字段名按上面的输出改好');
  console.log('  3. 跑  node lark-migrate.mjs dry-run  测试');
}

// ==========================================================
// 模式 2/3: 迁移（dry-run 或 run）
// ==========================================================
const DRY = MODE === 'dry-run';

async function migrate() {
  console.log(`🚀 模式: ${DRY ? 'DRY RUN（不写数据）' : 'LIVE（真跑）'}\n`);
  const token = await getLarkToken();
  console.log('✅ Lark 认证成功\n');

  // 第 1 步：迁移客户到 auth.users + profiles
  const emailToProfileId = await migrateClients(token);

  // 第 2 步：迁移所有子表
  const subTables = [
    ['incomes',             buildIncomeRow],
    ['expenses',            buildExpenseRow],
    ['assets',              buildAssetRow],
    ['liabilities',         buildLiabilityRow],
    ['investments',         buildInvestmentRow],
    ['insurance_policies',  buildInsuranceRow],
  ];

  for (const [key, builder] of subTables) {
    if (!mapping.tables[key]) { console.log(`⏭️  跳过 ${key}（mapping 里没配）\n`); continue; }
    await migrateSubTable(key, builder, token, emailToProfileId);
  }

  console.log('\n🎉 完成');
}

// ----------------------------------------------------------
// 客户 → auth.users + profiles
// ----------------------------------------------------------
async function migrateClients(token) {
  const cfg = mapping.tables.clients;
  const fm = cfg.fields;

  console.log(`━━━ 迁移 clients → profiles ━━━`);
  const rows = await fetchLarkRecords(cfg.lark_table_id, token);
  console.log(`  Lark 返回 ${rows.length} 条记录`);

  const emailToId = new Map();
  let ok = 0, skip = 0, fail = 0;

  for (const row of rows) {
    const f = row.fields;
    const email = String(getValue(f, fm.email) || '').trim().toLowerCase();
    if (!email) { skip++; continue; }

    if (DRY) {
      console.log(`  [DRY] ${email}`);
      emailToId.set(email, 'dry-run-fake-uuid');
      ok++;
      continue;
    }

    // 1. 在 auth 建用户
    let userId;
    const { data: created, error: cErr } = await supabase.auth.admin.createUser({
      email,
      password: cfg.default_password || 'ChangeMe123!',
      email_confirm: true,
      user_metadata: {
        family_name: getValue(f, fm.family_name),
        given_name:  getValue(f, fm.given_name),
      },
    });

    if (cErr) {
      // 已存在 → 找出现有 id
      if (/already|exists/i.test(cErr.message)) {
        const { data: list } = await supabase.auth.admin.listUsers();
        userId = list?.users?.find(u => u.email === email)?.id;
        if (!userId) { console.error(`  ❌ ${email} 已存在但找不到 id`); fail++; continue; }
        skip++;
      } else {
        console.error(`  ❌ ${email}: ${cErr.message}`); fail++; continue;
      }
    } else {
      userId = created.user.id;
    }

    // 2. 更新 profiles（trigger 已经帮我们插了基础行）
    const update = {
      family_name:        getValue(f, fm.family_name),
      given_name:         getValue(f, fm.given_name),
      salutation:         getValue(f, fm.salutation),
      nric:               getValue(f, fm.nric),
      date_of_birth:      toDate(getValue(f, fm.date_of_birth)),
      gender:             applyEnum(getValue(f, fm.gender), cfg.enum_mapping?.gender),
      marital_status:     applyEnum(getValue(f, fm.marital_status), cfg.enum_mapping?.marital_status),
      nationality:        getValue(f, fm.nationality),
      residency:          getValue(f, fm.residency),
      employment_status:  applyEnum(getValue(f, fm.employment_status), cfg.enum_mapping?.employment_status),
      tax_status:         applyEnum(getValue(f, fm.tax_status), cfg.enum_mapping?.tax_status),
      occupation:         getValue(f, fm.occupation),
      retirement_age:     toNumber(getValue(f, fm.retirement_age)),
      epf_account_number: getValue(f, fm.epf_account_number),
      ppa_account_number: getValue(f, fm.ppa_account_number),
      correspondence_address:     getValue(f, fm.correspondence_address),
      correspondence_postal_code: getValue(f, fm.correspondence_postal_code),
      correspondence_city:        getValue(f, fm.correspondence_city),
      correspondence_state:       getValue(f, fm.correspondence_state),
    };
    // 去掉 null，不覆盖已有数据
    Object.keys(update).forEach(k => update[k] == null && delete update[k]);

    const { error: uErr } = await supabase.from('profiles').update(update).eq('id', userId);
    if (uErr) { console.error(`  ⚠️  ${email}: ${uErr.message}`); fail++; }
    else      { console.log(`  ✅ ${email}`); ok++; }

    emailToId.set(email, userId);
  }

  console.log(`  结果: 成功 ${ok} / 已存在 ${skip} / 失败 ${fail}\n`);
  return emailToId;
}

// ----------------------------------------------------------
// 通用子表迁移
// ----------------------------------------------------------
async function migrateSubTable(tableKey, rowBuilder, token, emailToId) {
  const cfg = mapping.tables[tableKey];
  console.log(`━━━ 迁移 ${tableKey} ━━━`);
  const rows = await fetchLarkRecords(cfg.lark_table_id, token);
  console.log(`  Lark 返回 ${rows.length} 条记录`);

  const payload = [];
  let noOwner = 0;
  for (const row of rows) {
    const f = row.fields;
    const clientKey = String(getValue(f, cfg.client_link_field) || '').trim().toLowerCase();
    const profileId = emailToId.get(clientKey);
    if (!profileId) { noOwner++; continue; }

    const built = rowBuilder(f, cfg, profileId);
    if (built) payload.push(built);
  }

  console.log(`  准备插入 ${payload.length} 行，跳过无主 ${noOwner} 行`);
  if (DRY) { console.log('  [DRY] 不写'); console.log(); return; }

  // 分批插入
  for (let i = 0; i < payload.length; i += 500) {
    const batch = payload.slice(i, i + 500);
    const { error } = await supabase.from(tableKey).insert(batch);
    if (error) console.error(`  ❌ 批次 ${i}: ${error.message}`);
    else console.log(`  ✅ 插入 ${batch.length}`);
  }
  console.log();
}

// ----------------------------------------------------------
// 每张子表的行构造器（对应 lark-mapping.json 的 fields）
// ----------------------------------------------------------
function buildIncomeRow(f, cfg, profile_id) {
  const fm = cfg.fields;
  return {
    profile_id,
    income_type:  applyEnum(getValue(f, fm.income_type), cfg.enum_mapping?.income_type) || 'other',
    amount:       toNumber(getValue(f, fm.amount)) || 0,
    currency:     getValue(f, fm.currency) || 'MYR',
    period_month: firstOfMonth(getValue(f, fm.year), getValue(f, fm.month)),
    source_note:  getValue(f, fm.source_note),
  };
}

function buildExpenseRow(f, cfg, profile_id) {
  const fm = cfg.fields;
  return {
    profile_id,
    category:     applyEnum(getValue(f, fm.category), cfg.enum_mapping?.category) || 'other',
    amount:       toNumber(getValue(f, fm.amount)) || 0,
    currency:     getValue(f, fm.currency) || 'MYR',
    period_month: firstOfMonth(getValue(f, fm.year), getValue(f, fm.month)),
    description:  getValue(f, fm.description),
  };
}

function buildAssetRow(f, cfg, profile_id) {
  const fm = cfg.fields;
  return {
    profile_id,
    kind:        applyEnum(getValue(f, fm.kind), cfg.enum_mapping?.kind) || 'other',
    name:        getValue(f, fm.name) || 'Unnamed',
    value:       toNumber(getValue(f, fm.value)) || 0,
    currency:    getValue(f, fm.currency) || 'MYR',
    acquired_at: toDate(getValue(f, fm.acquired_at)),
  };
}

function buildLiabilityRow(f, cfg, profile_id) {
  const fm = cfg.fields;
  return {
    profile_id,
    kind:            applyEnum(getValue(f, fm.kind), cfg.enum_mapping?.kind) || 'other',
    name:            getValue(f, fm.name) || 'Unnamed',
    principal:       toNumber(getValue(f, fm.principal)),
    balance:         toNumber(getValue(f, fm.balance)) || 0,
    interest_rate:   toNumber(getValue(f, fm.interest_rate)),
    monthly_payment: toNumber(getValue(f, fm.monthly_payment)),
    start_date:      toDate(getValue(f, fm.start_date)),
    end_date:        toDate(getValue(f, fm.end_date)),
  };
}

function buildInvestmentRow(f, cfg, profile_id) {
  const fm = cfg.fields;
  return {
    profile_id,
    asset_class:   applyEnum(getValue(f, fm.asset_class), cfg.enum_mapping?.asset_class) || 'other',
    ticker:        getValue(f, fm.ticker),
    name:          getValue(f, fm.name) || 'Unnamed',
    units:         toNumber(getValue(f, fm.units)),
    cost_basis:    toNumber(getValue(f, fm.cost_basis)),
    current_value: toNumber(getValue(f, fm.current_value)),
    currency:      getValue(f, fm.currency) || 'MYR',
    purchased_at:  toDate(getValue(f, fm.purchased_at)),
  };
}

function buildInsuranceRow(f, cfg, profile_id) {
  const fm = cfg.fields;
  return {
    profile_id,
    policy_type:       getValue(f, fm.policy_type) || 'other',
    provider:          getValue(f, fm.provider),
    policy_number:     getValue(f, fm.policy_number),
    sum_assured:       toNumber(getValue(f, fm.sum_assured)),
    premium:           toNumber(getValue(f, fm.premium)),
    premium_frequency: applyEnum(getValue(f, fm.premium_frequency), cfg.enum_mapping?.premium_frequency),
    start_date:        toDate(getValue(f, fm.start_date)),
    end_date:          toDate(getValue(f, fm.end_date)),
  };
}

// ==========================================================
// 主入口
// ==========================================================
function printHelp() {
  console.log(`
用法:
  node lark-migrate.mjs inspect   # 先跑这个，看你 Lark 里有哪些表和字段
  node lark-migrate.mjs dry-run   # 空跑一遍检查
  node lark-migrate.mjs run       # 真跑，写进 Supabase
`);
}

try {
  if (MODE === 'inspect')   await inspect();
  else if (MODE === 'dry-run' || MODE === 'run') await migrate();
  else printHelp();
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
}
