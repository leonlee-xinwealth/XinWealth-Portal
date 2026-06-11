# PRS 开户自动化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收集 PRS 开户资料 → 录入 Supabase → 一键把资料按坐标填进 5 份 PRS PDF 模板下载打印；阶段二增加客户 token 链接自填。

**Architecture:** 一份申请数据（`prs_applications.form_data` jsonb）、两个入口（顾问后台编辑页 + `/prs/:token` 公开页）、一个 PDF 引擎（浏览器端 pdf-lib 坐标盖字）。共有字段同步回 `clients` 表。设计文档：`docs/superpowers/specs/2026-06-12-prs-account-opening-design.md`。

**Tech Stack:** Vite + React 18 + react-router v6 + Tailwind + Supabase（前端直连 + Vercel Functions service-role）+ pdf-lib + vitest + tsx。

**重要背景（执行者必读）：**
- 5 份 PDF 模板在 `D:\XinWealth Portal App\Forms\PRS\`，全部是**文字版平面 PDF（无 AcroForm 字段）**，填充方式只能是 `drawText` 坐标盖字。pdf-lib 坐标系**原点在左下角**。
- 顾问端代码模式参考 `components/advisor/pages/NewClient.tsx`（直连 supabase、`Card/Grid/Field/Inp/Sel` 小组件、`t(en, zh)` 双语 helper）。
- 公开 API 模式参考 `api/kyc.js` 的 handler 结构（CORS 头、supabaseAdmin），**但不要沿用它的表名**（profiles/incomes 是旧 schema 残留，当前库是 `clients`）。
- 数据库 enum 实际值：`gender_type`(male/female/other)、`marital_status`(single/married/divorced/widowed)、`tax_residency`(resident/non_resident)、`risk_profile`(conservative/moderate/balanced/growth/aggressive)、`client_status`(prospect/active/inactive)、`pipeline_stage`(new_lead/contacted/interested/proposal_sent/closed_won/closed_lost)。
- clients RLS 已存在（advisor 可对自己客户 ALL），advisor 端直连 supabase 增改 clients 是现有模式（NewClient.tsx 就这么做）。
- 项目没有任何测试基础设施——本计划引入 vitest（纯逻辑测试）；UI 组件不写测试（遵循项目现状）。
- 提交信息结尾固定加：`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

---

## 文件结构总览

```
新建：
  types/prs.ts                                   PrsFormData 类型 + initialPrsFormData + 派生函数
  pdf/textFit.ts                                 纯函数：fitTextSize / combChars / splitDateDDMMYYYY
  pdf/mappingTypes.ts                            FormMapping / MappedField 类型
  pdf/fillEngine.ts                              fillForm(templateBytes, mapping, data) → {bytes, warnings}
  pdf/prsTemplates.ts                            模板注册表 + fetchTemplate（浏览器）
  pdf/generatePrsPack.ts                         单份生成 + 合并打印包 + downloadBytes
  pdf/sampleData.ts                              校准用虚构样本数据
  pdf/mappings/declaration.ts                    5 个坐标映射文件
  pdf/mappings/ppaNomination.ts
  pdf/mappings/topUp.ts
  pdf/mappings/isaIndividual.ts
  pdf/mappings/accOpening.ts
  pdf/__tests__/textFit.test.ts
  pdf/__tests__/fillEngine.test.ts
  pdf/__tests__/mappings.test.ts                 坐标边界 + key 合法性 + UI 覆盖率检查
  components/advisor/prs/prsSync.ts              fromClient / toClientsPayload
  components/advisor/prs/__tests__/prsSync.test.ts
  components/advisor/prs/prsFields.ts            UI 分区/字段配置（双语）
  components/advisor/prs/PrsForm.tsx             共用表单组件（advisor/client 两种模式）
  components/advisor/pages/PrsApplicationList.tsx
  components/advisor/pages/PrsApplicationEditor.tsx
  components/prs/PrsPublicPage.tsx               阶段二公开填写页
  api/prs-application.js                         阶段二 token API
  scripts/extract_pdf_labels.py                  校准辅助（python + pdfplumber）
  scripts/generate-proofs.ts                     试填 PDF 生成（npm run proofs）
  supabase/migrations/20260612000001_prs_applications.sql
  public/forms/prs/{acc-opening,isa-individual,ppa-nomination,declaration,top-up}.pdf

修改：
  package.json                                   依赖 + scripts
  .gitignore                                     加 tmp/
  App.tsx                                        /prs/:token 路由（阶段二）
  components/advisor/AdvisorApp.tsx              prs 两条路由
  components/advisor/AdvisorLayout.tsx           侧边栏入口
  components/advisor/pages/ClientDetail.tsx      「PRS 开户」按钮
```

---

# 阶段一：PDF 引擎 + 顾问后台

### Task 1: 工具链与模板就位

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `public/forms/prs/*.pdf`（5 份模板复制改名）
- Create: `pdf/__tests__/smoke.test.ts`（临时，Task 4 删除）

- [ ] **Step 1: 安装依赖**

```powershell
npm install pdf-lib
npm install -D vitest tsx
```

- [ ] **Step 2: package.json 加 scripts**

在 `"scripts"` 中加两行（保留现有三条）：

```json
"test": "vitest run",
"proofs": "tsx scripts/generate-proofs.ts"
```

- [ ] **Step 3: .gitignore 加 `tmp/`**（若无 .gitignore 则创建；确认 `node_modules`、`dist` 已被忽略）

- [ ] **Step 4: 复制模板**

```powershell
New-Item -ItemType Directory -Force "public\forms\prs"
Copy-Item "D:\XinWealth Portal App\Forms\PRS\Copy of PRINCIPAL PRS ACC OPENING FORM.pdf" "public\forms\prs\acc-opening.pdf"
Copy-Item "D:\XinWealth Portal App\Forms\PRS\Copy of ISA INDIVIDUAL.pdf"                "public\forms\prs\isa-individual.pdf"
Copy-Item "D:\XinWealth Portal App\Forms\PRS\Copy of PPA NOMINATION FORM.pdf"           "public\forms\prs\ppa-nomination.pdf"
Copy-Item "D:\XinWealth Portal App\Forms\PRS\Copy of DECLARATION FORM.pdf"              "public\forms\prs\declaration.pdf"
Copy-Item "D:\XinWealth Portal App\Forms\PRS\Copy of PRINCIPAL PRS TOP UP FORM.pdf"     "public\forms\prs\top-up.pdf"
```

- [ ] **Step 5: vitest 冒烟测试**

```ts
// pdf/__tests__/smoke.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

describe('pdf-lib 能加载全部模板', () => {
  for (const f of ['acc-opening', 'isa-individual', 'ppa-nomination', 'declaration', 'top-up']) {
    it(f, async () => {
      const bytes = readFileSync(`public/forms/prs/${f}.pdf`);
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBeGreaterThan(0);
    });
  }
});
```

- [ ] **Step 6: 运行** `npm test` — 期望 5 个测试 PASS

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore public/forms/prs pdf/__tests__/smoke.test.ts
git commit -m "chore(prs): add pdf-lib/vitest tooling and PRS form templates"
```

---

### Task 2: 数据库迁移 `prs_applications`

**Files:**
- Create: `supabase/migrations/20260612000001_prs_applications.sql`

- [ ] **Step 1: 写迁移文件**

```sql
-- supabase/migrations/20260612000001_prs_applications.sql
-- PRS 开户申请：form_data 为所有表格答案的唯一数据源（见设计文档 §5）

create table public.prs_applications (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references public.clients(id) on delete set null,
  advisor_id       uuid not null references public.advisors(id),
  status           text not null default 'draft'
                     check (status in ('draft','awaiting_client','submitted','completed','cancelled')),
  token            uuid unique,
  token_expires_at timestamptz,
  form_data        jsonb not null default '{}'::jsonb,
  submitted_at     timestamptz,
  pdf_generated_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index prs_applications_advisor_idx on public.prs_applications (advisor_id, status);
create index prs_applications_client_idx  on public.prs_applications (client_id);

alter table public.prs_applications enable row level security;

-- 与 cases 表的 advisor_manage_cases 同模式
create policy advisor_manage_prs_applications on public.prs_applications
  for all
  using (advisor_id in (select id from public.advisors where user_id = auth.uid()))
  with check (advisor_id in (select id from public.advisors where user_id = auth.uid()));

create or replace function public.update_prs_applications_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger prs_applications_updated_at
  before update on public.prs_applications
  for each row execute function public.update_prs_applications_updated_at();
```

- [ ] **Step 2: 通过 Supabase MCP 应用迁移** — `apply_migration`，name=`prs_applications`，query 为上述 SQL 全文

- [ ] **Step 3: 验证** — `execute_sql`: `select count(*) from prs_applications;` 期望返回 0（表存在）；`select policyname from pg_policies where tablename='prs_applications';` 期望 1 条

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260612000001_prs_applications.sql
git commit -m "feat(prs): add prs_applications table with advisor RLS"
```

---

### Task 3: `types/prs.ts` — 表单数据类型与初始值

**Files:**
- Create: `types/prs.ts`

这是全功能的字段总纲。**key 一旦定下，mapping、UI、sync 全部引用它**，后续任务不得擅自改名。

- [ ] **Step 1: 写类型文件**（下方为完整内容，逐字段对应 5 份 PDF 的盘点结果）

```ts
// types/prs.ts
// PRS 开户申请的表单数据结构。form_data jsonb 的 TypeScript 形状。
// 字段命名与 clients 表重合的部分见 components/advisor/prs/prsSync.ts。

export interface PrsNominee {
  name: string;
  nric: string;
  mobile: string;
  email: string;
  percentage: string; // '50' 表示 50%
}

export interface CrsTaxResidence {
  country: string;
  tin: string;
  noTinReason: '' | 'A' | 'B' | 'C';
  reasonBExplanation: string;
}

export interface FundAllocation {
  fund: string;    // 基金名（如 'Principal RetireEasy 2050'）
  percent: string; // '100'
}

export interface PrsFormData {
  // ── 申请人类型（acc-opening 页1 顶部）
  applicant_type: '' | 'new' | 'existing';
  existing_ppa_account_no: string;
  applicant_category: '' | 'personal' | 'employee';
  employer_prs_contract_no: string; // Employee 时的 PRS Plus Partner Programme Contract No.
  staff_no: string;
  employment_date: string;          // YYYY-MM-DD

  // ── 个人资料
  salutation: string;               // Mr / Mrs / Ms / 其他
  full_name: string;
  nric: string;                     // 990101-14-1234（含或不含连字符均可，引擎会清洗）
  other_id_type: '' | 'old_ic' | 'police_id' | 'army_id' | 'passport';
  other_id_no: string;
  passport_country: string;
  passport_expiry: string;          // YYYY-MM-DD
  date_of_birth: string;            // YYYY-MM-DD
  gender: '' | 'male' | 'female';
  race: '' | 'bumiputera' | 'chinese' | 'indian' | 'others';
  race_other: string;
  nationality: string;              // 'Malaysian' 或其他
  marital_status: '' | 'single' | 'married' | 'widowed' | 'divorced';
  mothers_maiden_name: string;

  // ── 职业与收入（acc-opening 页1 勾选区）
  occupation_category: '' | 'executive' | 'management' | 'professional' | 'self_employed'
    | 'clerical' | 'skilled_worker' | 'government' | 'housewife' | 'retiree'
    | 'unemployed' | 'student' | 'others';
  occupation_other: string;
  nature_of_occupation: '' | 'agriculture_forestry' | 'construction' | 'education_health'
    | 'electricity_gas_water' | 'finance_insurance_property' | 'manufacturing'
    | 'mining_quarrying' | 'trading_restaurant_hotel' | 'transport_storage_communication' | 'others';
  nature_other: string;
  employer_name: string;
  monthly_income_bracket: '' | 'up_to_1500' | '1501_3000' | '3001_5000' | '5001_8000'
    | '8001_15000' | '15001_20000' | '20001_50000' | '50001_100000' | '100001_200000' | 'above_200000';

  // ── 联系与地址
  phone_mobile: string;
  phone_house: string;
  phone_office: string;
  email: string;
  corr_address: string;
  corr_postcode: string;
  corr_city: string;
  corr_state: string;
  corr_country: string;
  perm_same_as_corr: boolean;
  perm_address: string;
  perm_postcode: string;
  perm_city: string;
  perm_state: string;
  perm_country: string;

  // ── 资金来源与目的（acc-opening 页2）
  source_of_funds: '' | 'employment' | 'investment' | 'retirement' | 'sales_of_assets'
    | 'inheritance' | 'savings' | 'business' | 'others';
  source_of_funds_other: string;
  purpose: '' | 'investment' | 'retirement' | 'protection' | 'others';
  purpose_other: string;
  pep_status: '' | 'yes' | 'no';

  // ── 供款（acc-opening §2 / top-up 共用）
  contribution_amount: string;      // RM
  cheque_no: string;
  rsp_enabled: boolean;             // Regular Savings Plan
  rsp_bank: string;
  rsp_bank_account_no: string;
  rsp_amount: string;
  rsp_deduction_day: string;        // DD
  epf_redirection_percent: '' | '1' | '2' | '3' | '4' | '5' | '6' | '7';
  salary_deduction_rm: string;
  salary_deduction_percent: string;

  // ── 供款方向（acc-opening §3）
  contribution_direction: '' | 'do_it_for_me' | 'do_it_myself';
  difm_scheme: '' | 'prs_plus' | 'islamic_prs_plus';
  dim_allocations: FundAllocation[];

  // ── 账户号码
  ppa_account_no: string;           // 同步 clients.ppa_account_number
  prs_plus_account_no: string;
  epf_account_number: string;

  // ── Top Up 表专用
  topup_type: '' | 'topup' | 'change_direction';

  // ── 银行（个人账户）
  bank_name: string;
  bank_account_number: string;

  // ── 税务 / CRS（acc-opening 页7 自我声明）
  tax_residency: '' | 'resident' | 'non_resident';
  tin_number: string;
  place_of_birth: string;
  country_of_birth: string;
  crs_tax_residences: CrsTaxResidence[];   // 固定 3 行（可留空）

  // ── 受益人提名（ppa-nomination）
  religion_islam: '' | 'muslim' | 'non_muslim';
  nominees: PrsNominee[];                  // 固定 6 行（可留空）

  // ── ISA 适当性评估（isa-individual，客户作答部分）
  isa_mode: '' | 'new' | 'review';
  isa_education: '' | 'degree_above' | 'diploma' | 'stpm' | 'spm_below';
  isa_disposable_income: '' | 'below_5000' | '5001_8000' | '8001_15000' | 'above_15001';
  isa_commitment: '' | 'below_2000' | '2001_5000' | '5001_10000' | 'above_10001';
  isa_invest_pct: '' | 'below_10' | '11_20' | '21_30' | '31_40' | '41_50' | 'above_50';
  isa_expectation: '' | 'capital_growth' | 'regular_income' | 'capital_protection';
  isa_purpose: '' | 'asset_accumulation' | 'children_education' | 'retirement' | 'regular_income' | 'others';
  isa_purpose_other: string;
  isa_reasons: ('meet_objective' | 'risk_return' | 'strategy')[];
  isa_exp_unit_trust: string;   // 年数（字符串数字）
  isa_exp_bond: string;
  isa_exp_equities: string;
  isa_exp_derivatives: string;
  isa_exp_prs: string;
  isa_exp_others: string;
  // Part 3 风险评分题，值即分值
  isa_q1_age: '' | '1' | '3' | '5';
  isa_q2_experience: '' | '1' | '3' | '5';
  isa_q3_understanding: '' | '1' | '3' | '5';
  isa_q4_objective: '' | '1' | '3' | '5';
  isa_q5_duration: '' | '1' | '3' | '5';
  isa_q6_risk: '' | '1' | '3' | '5';
  // Part 5 弱势客户属性（多选；'none' 表示以上皆否）
  isa_vulnerable: ('elderly' | 'low_education' | 'no_experience' | 'limited_means' | 'breadwinner_loss' | 'impairment' | 'none')[];
  // Part 6 确认（5 题 YES/NO，按序）
  isa_acks: ('' | 'yes' | 'no')[];

  // ── 顾问专区（仅顾问端可见；token API 不下发、客户提交不可写）
  consultant_name: string;
  consultant_code: string;
  consultant_nric: string;
  consultant_phone: string;
  branch_name_code: string;
  distributor_code: string;
  channel: '' | 'prs_consultant' | 'corporate_prs_distributor' | 'institutional_prs_adviser';
  class_for_application: string;
  utc_recommended_category: '' | 'conservative' | 'moderate' | 'aggressive';
  utc_basis: ('risk_profile' | 'objectives_horizon' | 'complements_portfolio' | 'others')[];
  utc_basis_other: string;
  utc_funds: string[];          // 固定 5 行
  sign_date: string;            // YYYY-MM-DD，呈交日期，填到各表 Date 栏
}

/** 顾问专区字段（客户端不渲染、token API 剥除） */
export const ADVISOR_ONLY_KEYS: (keyof PrsFormData)[] = [
  'consultant_name', 'consultant_code', 'consultant_nric', 'consultant_phone',
  'branch_name_code', 'distributor_code', 'channel', 'class_for_application',
  'utc_recommended_category', 'utc_basis', 'utc_basis_other', 'utc_funds', 'sign_date',
];

export const initialPrsFormData: PrsFormData = {
  applicant_type: '', existing_ppa_account_no: '', applicant_category: '',
  employer_prs_contract_no: '', staff_no: '', employment_date: '',
  salutation: '', full_name: '', nric: '', other_id_type: '', other_id_no: '',
  passport_country: '', passport_expiry: '', date_of_birth: '', gender: '',
  race: '', race_other: '', nationality: 'Malaysian', marital_status: '', mothers_maiden_name: '',
  occupation_category: '', occupation_other: '', nature_of_occupation: '', nature_other: '',
  employer_name: '', monthly_income_bracket: '',
  phone_mobile: '', phone_house: '', phone_office: '', email: '',
  corr_address: '', corr_postcode: '', corr_city: '', corr_state: '', corr_country: 'Malaysia',
  perm_same_as_corr: true,
  perm_address: '', perm_postcode: '', perm_city: '', perm_state: '', perm_country: '',
  source_of_funds: '', source_of_funds_other: '', purpose: '', purpose_other: '', pep_status: '',
  contribution_amount: '', cheque_no: '',
  rsp_enabled: false, rsp_bank: '', rsp_bank_account_no: '', rsp_amount: '', rsp_deduction_day: '',
  epf_redirection_percent: '', salary_deduction_rm: '', salary_deduction_percent: '',
  contribution_direction: '', difm_scheme: '',
  dim_allocations: [],
  ppa_account_no: '', prs_plus_account_no: '', epf_account_number: '',
  topup_type: '', bank_name: '', bank_account_number: '',
  tax_residency: '', tin_number: '', place_of_birth: '', country_of_birth: '',
  crs_tax_residences: [
    { country: '', tin: '', noTinReason: '', reasonBExplanation: '' },
    { country: '', tin: '', noTinReason: '', reasonBExplanation: '' },
    { country: '', tin: '', noTinReason: '', reasonBExplanation: '' },
  ],
  religion_islam: '',
  nominees: Array.from({ length: 6 }, () => ({ name: '', nric: '', mobile: '', email: '', percentage: '' })),
  isa_mode: '', isa_education: '', isa_disposable_income: '', isa_commitment: '', isa_invest_pct: '',
  isa_expectation: '', isa_purpose: '', isa_purpose_other: '', isa_reasons: [],
  isa_exp_unit_trust: '', isa_exp_bond: '', isa_exp_equities: '', isa_exp_derivatives: '',
  isa_exp_prs: '', isa_exp_others: '',
  isa_q1_age: '', isa_q2_experience: '', isa_q3_understanding: '',
  isa_q4_objective: '', isa_q5_duration: '', isa_q6_risk: '',
  isa_vulnerable: [], isa_acks: ['', '', '', '', ''],
  consultant_name: '', consultant_code: '', consultant_nric: '', consultant_phone: '',
  branch_name_code: '', distributor_code: '', channel: '', class_for_application: '',
  utc_recommended_category: '', utc_basis: [], utc_basis_other: '',
  utc_funds: ['', '', '', '', ''],
  sign_date: '',
};

/** ISA Part 3 总分（任一题未答返回 null） */
export function isaTotalScore(d: PrsFormData): number | null {
  const answers = [d.isa_q1_age, d.isa_q2_experience, d.isa_q3_understanding,
    d.isa_q4_objective, d.isa_q5_duration, d.isa_q6_risk];
  if (answers.some(a => a === '')) return null;
  return answers.reduce((sum, a) => sum + parseInt(a, 10), 0);
}

/** 表格规则：6-13 conservative / 14-22 moderate / 23-30 aggressive */
export function riskProfileFromScore(score: number): 'conservative' | 'moderate' | 'aggressive' {
  if (score <= 13) return 'conservative';
  if (score <= 22) return 'moderate';
  return 'aggressive';
}

export interface PrsApplication {
  id: string;
  client_id: string | null;
  advisor_id: string;
  status: 'draft' | 'awaiting_client' | 'submitted' | 'completed' | 'cancelled';
  token: string | null;
  token_expires_at: string | null;
  form_data: PrsFormData;
  submitted_at: string | null;
  pdf_generated_at: string | null;
  created_at: string;
  updated_at: string;
  client_full_name?: string; // join 字段
}
```

- [ ] **Step 2: 编译检查** — `npx tsc --noEmit`，期望零错误

- [ ] **Step 3: Commit**

```bash
git add types/prs.ts
git commit -m "feat(prs): define PrsFormData schema and derived helpers"
```

---

### Task 4: `pdf/textFit.ts` 纯函数（TDD）

**Files:**
- Create: `pdf/__tests__/textFit.test.ts`
- Create: `pdf/textFit.ts`
- Delete: `pdf/__tests__/smoke.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// pdf/__tests__/textFit.test.ts
import { describe, it, expect } from 'vitest';
import { fitTextSize, combChars, splitDateDDMMYYYY, MIN_FONT_SIZE } from '../textFit';

describe('fitTextSize', () => {
  // 宽度模型：每字符 0.5*size pt
  const widthAt = (text: string) => (size: number) => text.length * 0.5 * size;

  it('放得下时返回原字号', () => {
    expect(fitTextSize(widthAt('abc'), 9, 100)).toBe(9);
  });
  it('放不下时逐级缩小', () => {
    // 40 字符 * 0.5 * 9 = 180 > 100 → 需要 size <= 5 → 低于下限
    expect(fitTextSize(widthAt('a'.repeat(40)), 9, 100)).toBeNull();
    // 24 字符: size=8.5 → 102 > 100; size=8 → 96 ✓
    expect(fitTextSize(widthAt('a'.repeat(24)), 9, 100)).toBe(8);
  });
  it('下限为 MIN_FONT_SIZE', () => {
    expect(MIN_FONT_SIZE).toBe(6);
  });
});

describe('combChars', () => {
  it('默认原样拆字符', () => {
    expect(combChars('AB12')).toEqual(['A', 'B', '1', '2']);
  });
  it('strip 清洗 NRIC 连字符与空格', () => {
    expect(combChars('990101-14-1234', /[\s-]/g)).toEqual([...'990101141234']);
  });
});

describe('splitDateDDMMYYYY', () => {
  it('ISO 日期转 DDMMYYYY 字符', () => {
    expect(splitDateDDMMYYYY('1990-01-05')).toBe('05011990');
  });
  it('非法输入返回 null', () => {
    expect(splitDateDDMMYYYY('')).toBeNull();
    expect(splitDateDDMMYYYY('05/01/1990')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败** — `npm test` 期望 FAIL（模块不存在）

- [ ] **Step 3: 实现**

```ts
// pdf/textFit.ts
export const MIN_FONT_SIZE = 6;

/** 从 startSize 起以 0.5 步长缩小直到 maxWidth 放得下；放不下返回 null */
export function fitTextSize(
  widthAt: (size: number) => number,
  startSize: number,
  maxWidth: number
): number | null {
  for (let s = startSize; s >= MIN_FONT_SIZE; s -= 0.5) {
    if (widthAt(s) <= maxWidth) return s;
  }
  return null;
}

/** 拆成单字符数组（一格一字）；strip 用于清洗连字符/空格 */
export function combChars(value: string, strip?: RegExp): string[] {
  const cleaned = strip ? value.replace(strip, '') : value;
  return [...cleaned];
}

/** 'YYYY-MM-DD' → 'DDMMYYYY'；非法返回 null */
export function splitDateDDMMYYYY(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return `${m[3]}${m[2]}${m[1]}`;
}
```

- [ ] **Step 4: 运行确认通过** — `npm test` 期望全 PASS；删除 `pdf/__tests__/smoke.test.ts`

- [ ] **Step 5: Commit**

```bash
git add pdf/textFit.ts pdf/__tests__/textFit.test.ts
git rm pdf/__tests__/smoke.test.ts
git commit -m "feat(prs): text fitting helpers for PDF overlay (TDD)"
```

---

### Task 5: 映射类型 + 填充引擎（TDD）

**Files:**
- Create: `pdf/mappingTypes.ts`
- Create: `pdf/fillEngine.ts`
- Test: `pdf/__tests__/fillEngine.test.ts`

- [ ] **Step 1: 写映射类型**

```ts
// pdf/mappingTypes.ts
import type { PrsFormData } from '../types/prs';

export interface TextField {
  type?: 'text';
  key: string;          // PrsFormData 键，支持点路径如 'nominees.0.name'
  page: number;         // 0-based
  x: number;            // pt，pdf-lib 坐标系原点在左下角
  y: number;
  size?: number;        // 默认 9
  maxWidth?: number;    // 超出则缩字号
  uppercase?: boolean;  // 默认 true（表格要求 BLOCK LETTERS）
}

export interface CombField {
  type: 'comb';
  key: string;
  page: number;
  x: number;            // 第一格中心
  y: number;
  cellWidth: number;    // 格距
  cells: number;        // 格数（超出截断并警告）
  size?: number;
  strip?: RegExp;       // 如 /[\s-]/g 清洗 NRIC
}

export interface CheckboxField {
  type: 'checkbox';
  key: string;          // 仅作标识/校验用
  page: number;
  x: number;
  y: number;
  size?: number;        // 默认 10
  when: (d: PrsFormData) => boolean;
}

export interface DateSplitField {
  type: 'date-split';   // DD MM YYYY 8 格
  key: string;
  page: number;
  x: number;
  y: number;
  cellWidth: number;
  size?: number;
}

export type MappedField = TextField | CombField | CheckboxField | DateSplitField;

export interface FormMapping {
  id: 'acc-opening' | 'isa-individual' | 'ppa-nomination' | 'declaration' | 'top-up';
  templateFile: string;       // 'declaration.pdf'
  labelEn: string;
  labelZh: string;
  /** 模板版本字符串，与 PDF 页脚一致；公司改版时据此提醒重校准 */
  version: string;
  fields: MappedField[];
  /** 生成前缺失警告用：建议填写的 PrsFormData 键 */
  recommendedKeys: string[];
}
```

- [ ] **Step 2: 写失败测试**

```ts
// pdf/__tests__/fillEngine.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { fillForm, resolveValue } from '../fillEngine';
import type { FormMapping } from '../mappingTypes';
import { initialPrsFormData, type PrsFormData } from '../../types/prs';

const data: PrsFormData = {
  ...initialPrsFormData,
  full_name: 'Tan Ah Kow',
  nric: '900101-14-5678',
  date_of_birth: '1990-01-01',
  gender: 'male',
  nominees: initialPrsFormData.nominees.map((n, i) =>
    i === 0 ? { ...n, name: 'Tan Mei Mei', percentage: '100' } : n),
};

const mapping: FormMapping = {
  id: 'declaration', templateFile: 'declaration.pdf',
  labelEn: 'Test', labelZh: '测试', version: 'test',
  recommendedKeys: ['full_name'],
  fields: [
    { key: 'full_name', page: 1, x: 100, y: 200, maxWidth: 200 },
    { type: 'comb', key: 'nric', page: 1, x: 100, y: 180, cellWidth: 14, cells: 12, strip: /[\s-]/g },
    { type: 'checkbox', key: 'gender', page: 1, x: 100, y: 160, when: d => d.gender === 'male' },
    { type: 'date-split', key: 'date_of_birth', page: 1, x: 100, y: 140, cellWidth: 14 },
    { key: 'nominees.0.name', page: 1, x: 100, y: 120 },
  ],
};

describe('resolveValue', () => {
  it('顶层键', () => expect(resolveValue(data, 'full_name')).toBe('Tan Ah Kow'));
  it('点路径', () => expect(resolveValue(data, 'nominees.0.percentage')).toBe('100'));
  it('空值返回空字符串', () => expect(resolveValue(data, 'email')).toBe(''));
});

describe('fillForm', () => {
  it('用真实模板填充不抛错且产出有效 PDF', async () => {
    const tpl = readFileSync('public/forms/prs/declaration.pdf');
    const { bytes, warnings } = await fillForm(tpl, mapping, data);
    expect(warnings).toEqual([]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it('页码越界产生警告而非抛错', async () => {
    const tpl = readFileSync('public/forms/prs/declaration.pdf');
    const bad: FormMapping = { ...mapping, fields: [{ key: 'full_name', page: 99, x: 0, y: 0 }] };
    const { warnings } = await fillForm(tpl, bad, data);
    expect(warnings.length).toBe(1);
  });

  it('文字超长且缩到下限仍放不下时警告', async () => {
    const tpl = readFileSync('public/forms/prs/declaration.pdf');
    const longData = { ...data, full_name: 'X'.repeat(200) };
    const tight: FormMapping = { ...mapping, fields: [{ key: 'full_name', page: 1, x: 100, y: 200, maxWidth: 30 }] };
    const { warnings } = await fillForm(tpl, tight, longData);
    expect(warnings.length).toBe(1);
  });
});
```

- [ ] **Step 3: 运行确认失败** — `npm test` 期望 fillEngine 不存在 FAIL

- [ ] **Step 4: 实现引擎**

```ts
// pdf/fillEngine.ts
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { FormMapping } from './mappingTypes';
import type { PrsFormData } from '../types/prs';
import { fitTextSize, combChars, splitDateDDMMYYYY, MIN_FONT_SIZE } from './textFit';

export interface FillResult {
  bytes: Uint8Array;
  warnings: string[];
}

/** 按点路径取值，任何缺段返回 '' */
export function resolveValue(data: PrsFormData, path: string): string {
  let cur: unknown = data;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[part];
  }
  if (cur == null || cur === false) return '';
  if (cur === true) return 'true';
  return String(cur);
}

export async function fillForm(
  templateBytes: Uint8Array | ArrayBuffer,
  mapping: FormMapping,
  data: PrsFormData
): Promise<FillResult> {
  const doc = await PDFDocument.load(templateBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const warnings: string[] = [];

  for (const f of mapping.fields) {
    const page = pages[f.page];
    if (!page) {
      warnings.push(`[${mapping.id}] ${f.key}: 页码 ${f.page} 不存在（共 ${pages.length} 页）`);
      continue;
    }
    const type = f.type ?? 'text';

    if (type === 'checkbox') {
      if (f.when(data)) {
        page.drawText('X', { x: f.x, y: f.y, size: f.size ?? 10, font });
      }
      continue;
    }

    const raw = resolveValue(data, f.key);
    if (!raw) continue; // 缺失字段留空，照样生成

    if (type === 'text') {
      const value = (f.uppercase ?? true) ? raw.toUpperCase() : raw;
      let size = f.size ?? 9;
      if (f.maxWidth) {
        const fitted = fitTextSize(s => font.widthOfTextAtSize(value, s), size, f.maxWidth);
        if (fitted == null) {
          warnings.push(`[${mapping.id}] ${f.key}: 文字超长，已用最小字号仍可能溢出`);
          size = MIN_FONT_SIZE;
        } else {
          size = fitted;
        }
      }
      page.drawText(value, { x: f.x, y: f.y, size, font });
    } else if (type === 'comb') {
      const chars = combChars(raw.toUpperCase(), f.strip);
      if (chars.length > f.cells) {
        warnings.push(`[${mapping.id}] ${f.key}: 内容 ${chars.length} 字超出 ${f.cells} 格，已截断`);
      }
      chars.slice(0, f.cells).forEach((ch, i) => {
        page.drawText(ch, { x: f.x + i * f.cellWidth, y: f.y, size: f.size ?? 9, font });
      });
    } else if (type === 'date-split') {
      const digits = splitDateDDMMYYYY(raw);
      if (!digits) {
        warnings.push(`[${mapping.id}] ${f.key}: 日期格式无效（${raw}）`);
        continue;
      }
      [...digits].forEach((ch, i) => {
        page.drawText(ch, { x: f.x + i * f.cellWidth, y: f.y, size: f.size ?? 9, font });
      });
    }
  }

  return { bytes: await doc.save(), warnings };
}
```

- [ ] **Step 5: 运行确认通过** — `npm test` 全 PASS

- [ ] **Step 6: Commit**

```bash
git add pdf/mappingTypes.ts pdf/fillEngine.ts pdf/__tests__/fillEngine.test.ts
git commit -m "feat(prs): coordinate-overlay PDF fill engine (TDD)"
```

---

### Task 6: 校准工具 + 样本数据 + declaration 映射（打样）

最小的表格先行，跑通「提取坐标 → 写映射 → 出试填 PDF」整条校准链路。

**Files:**
- Create: `scripts/extract_pdf_labels.py`
- Create: `pdf/sampleData.ts`
- Create: `pdf/prsTemplates.ts`
- Create: `pdf/mappings/declaration.ts`
- Create: `scripts/generate-proofs.ts`
- Test: `pdf/__tests__/mappings.test.ts`

- [ ] **Step 1: 写坐标提取脚本**（需要 `pip install pdfplumber`，输出已转换为 pdf-lib 的左下角坐标系）

```python
# scripts/extract_pdf_labels.py
# 用法: python scripts/extract_pdf_labels.py public/forms/prs/declaration.pdf [页码(1-based)]
# 输出每个文字片段的 x(左), y(基线,左下角原点), 文字 —— 直接用于 mapping 坐标参考。
import sys
import pdfplumber

path = sys.argv[1]
only_page = int(sys.argv[2]) if len(sys.argv) > 2 else None

with pdfplumber.open(path) as pdf:
    for i, page in enumerate(pdf.pages):
        if only_page and i + 1 != only_page:
            continue
        h = page.height
        print(f"=== Page {i+1} (w={page.width:.0f} h={h:.0f}) ===")
        for w in page.extract_words():
            x = w["x0"]
            y = h - w["bottom"]  # pdfplumber top-based -> pdf-lib bottom-based
            print(f"  x={x:7.1f} y={y:7.1f}  {w['text'][:60]}")
```

- [ ] **Step 2: 写模板注册表与样本数据**

```ts
// pdf/prsTemplates.ts
import type { FormMapping } from './mappingTypes';

/** 浏览器端取模板（vite public 目录） */
export async function fetchTemplate(mapping: FormMapping): Promise<ArrayBuffer> {
  const res = await fetch(`/forms/prs/${mapping.templateFile}`);
  if (!res.ok) throw new Error(`模板加载失败: ${mapping.templateFile} (${res.status})`);
  return res.arrayBuffer();
}
```

```ts
// pdf/sampleData.ts
// 校准打样用的虚构样本（切勿使用真实客户资料）
import { initialPrsFormData, type PrsFormData } from '../types/prs';

export const samplePrsData: PrsFormData = {
  ...initialPrsFormData,
  applicant_type: 'new',
  applicant_category: 'personal',
  salutation: 'Mr',
  full_name: 'Ahmad Sample Bin Test',
  nric: '900101-14-5678',
  date_of_birth: '1990-01-01',
  gender: 'male',
  race: 'chinese',
  nationality: 'Malaysian',
  marital_status: 'married',
  mothers_maiden_name: 'Lim Test',
  occupation_category: 'executive',
  nature_of_occupation: 'finance_insurance_property',
  employer_name: 'SAMPLE SDN BHD',
  monthly_income_bracket: '8001_15000',
  phone_mobile: '0123456789',
  email: 'sample@example.com',
  corr_address: '88 JALAN SAMPLE 1/2, TAMAN UJIAN',
  corr_postcode: '47000',
  corr_city: 'PETALING JAYA',
  corr_state: 'Selangor',
  source_of_funds: 'employment',
  purpose: 'retirement',
  pep_status: 'no',
  contribution_amount: '3000',
  contribution_direction: 'do_it_for_me',
  difm_scheme: 'prs_plus',
  epf_account_number: '12345678',
  bank_name: 'MAYBANK',
  bank_account_number: '1122334455667',
  tax_residency: 'resident',
  tin_number: 'IG12345678090',
  place_of_birth: 'KUALA LUMPUR',
  country_of_birth: 'MALAYSIA',
  crs_tax_residences: [
    { country: 'MALAYSIA', tin: 'IG12345678090', noTinReason: '', reasonBExplanation: '' },
    { country: '', tin: '', noTinReason: '', reasonBExplanation: '' },
    { country: '', tin: '', noTinReason: '', reasonBExplanation: '' },
  ],
  religion_islam: 'non_muslim',
  nominees: [
    { name: 'SITI SAMPLE BINTI TEST', nric: '920202-14-1234', mobile: '0198765432', email: 'siti@example.com', percentage: '60' },
    { name: 'ALI SAMPLE BIN TEST', nric: '150303-14-9876', mobile: '', email: '', percentage: '40' },
    ...Array.from({ length: 4 }, () => ({ name: '', nric: '', mobile: '', email: '', percentage: '' })),
  ],
  isa_mode: 'new',
  isa_education: 'degree_above',
  isa_disposable_income: '8001_15000',
  isa_commitment: '2001_5000',
  isa_invest_pct: '11_20',
  isa_expectation: 'capital_growth',
  isa_purpose: 'retirement',
  isa_reasons: ['meet_objective'],
  isa_exp_unit_trust: '5',
  isa_q1_age: '3', isa_q2_experience: '3', isa_q3_understanding: '3',
  isa_q4_objective: '3', isa_q5_duration: '5', isa_q6_risk: '3',
  isa_vulnerable: ['none'],
  isa_acks: ['yes', 'yes', 'yes', 'no', 'no'],
  topup_type: 'topup',
  consultant_name: 'LEON LEE',
  consultant_code: 'CON1234',
  branch_name_code: 'KL MAIN / 001',
  channel: 'prs_consultant',
  sign_date: '2026-06-15',
};
```

- [ ] **Step 3: 运行提取脚本拿到 declaration 页2 的标签坐标**

```powershell
pip install pdfplumber
python scripts/extract_pdf_labels.py public/forms/prs/declaration.pdf 2
```

在输出中找到 `Name:`、`NRIC No:`、`Date:` 三个标签的坐标。填写位置 = 标签右侧（x 加上标签宽度 + ~10pt 间距，y 取标签同一基线）。

- [ ] **Step 4: 写 declaration 映射**（坐标值以 Step 3 实测为准，以下 x/y 为占位示意，**执行时必须换成实测值**——这是本任务唯一允许"待定"的数值，由打样闭环验证）

```ts
// pdf/mappings/declaration.ts
import type { FormMapping } from '../mappingTypes';

// Phillip Mutual 账户开立声明表。只填页2 的 Name / NRIC / Date，签名留空（湿签）。
export const declarationMapping: FormMapping = {
  id: 'declaration',
  templateFile: 'declaration.pdf',
  labelEn: 'PMB Declaration Form',
  labelZh: 'PMB 声明表',
  version: 'Version 3.0 May 2024',
  recommendedKeys: ['full_name', 'nric', 'sign_date'],
  fields: [
    { key: 'full_name', page: 1, x: 0, y: 0, maxWidth: 220 },          // ← 实测替换
    { key: 'nric',      page: 1, x: 0, y: 0, maxWidth: 160 },          // ← 实测替换
    { key: 'sign_date', page: 1, x: 0, y: 0 },                          // ← 实测替换
  ],
};
```

- [ ] **Step 5: 写映射校验测试**（这个文件会随每个映射任务追加新映射）

```ts
// pdf/__tests__/mappings.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import type { FormMapping } from '../mappingTypes';
import { initialPrsFormData } from '../../types/prs';
import { declarationMapping } from '../mappings/declaration';

// Task 7-10 在此追加：ppaNominationMapping, topUpMapping, isaIndividualMapping, accOpeningMapping
const ALL_MAPPINGS: FormMapping[] = [declarationMapping];

describe.each(ALL_MAPPINGS.map(m => [m.id, m] as const))('mapping %s', (_id, mapping) => {
  it('所有字段 key 的根段存在于 PrsFormData', () => {
    const validRoots = new Set(Object.keys(initialPrsFormData));
    for (const f of mapping.fields) {
      expect(validRoots.has(f.key.split('.')[0]), `非法 key: ${f.key}`).toBe(true);
    }
  });

  it('所有坐标落在对应页边界内', async () => {
    const bytes = readFileSync(`public/forms/prs/${mapping.templateFile}`);
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPages();
    for (const f of mapping.fields) {
      const page = pages[f.page];
      expect(page, `${f.key}: 页 ${f.page} 不存在`).toBeDefined();
      const { width, height } = page.getSize();
      expect(f.x >= 0 && f.x <= width, `${f.key}: x=${f.x} 超出页宽 ${width}`).toBe(true);
      expect(f.y >= 0 && f.y <= height, `${f.key}: y=${f.y} 超出页高 ${height}`).toBe(true);
    }
  });

  it('recommendedKeys 全部是合法键', () => {
    const validRoots = new Set(Object.keys(initialPrsFormData));
    for (const k of mapping.recommendedKeys) {
      expect(validRoots.has(k.split('.')[0]), `非法 recommendedKey: ${k}`).toBe(true);
    }
  });
});
```

- [ ] **Step 6: 写试填脚本**

```ts
// scripts/generate-proofs.ts
// npm run proofs → tmp/proofs/ 下输出全套试填 PDF（样本数据），打印对照实体表格校准坐标。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fillForm } from '../pdf/fillEngine';
import { samplePrsData } from '../pdf/sampleData';
import type { FormMapping } from '../pdf/mappingTypes';
import { declarationMapping } from '../pdf/mappings/declaration';
// Task 7-10 在此追加 import 并加入数组
const mappings: FormMapping[] = [declarationMapping];

async function main() {
  mkdirSync('tmp/proofs', { recursive: true });
  for (const m of mappings) {
    const tpl = readFileSync(`public/forms/prs/${m.templateFile}`);
    const { bytes, warnings } = await fillForm(tpl, m, samplePrsData);
    writeFileSync(`tmp/proofs/${m.id}-proof.pdf`, bytes);
    console.log(`✓ tmp/proofs/${m.id}-proof.pdf${warnings.length ? `（警告 ${warnings.length} 条）` : ''}`);
    warnings.forEach(w => console.log(`  ⚠ ${w}`));
  }
}
main();
```

- [ ] **Step 7: 校准闭环** — 反复执行直到对位：
  1. `npm run proofs`
  2. 打开 `tmp/proofs/declaration-proof.pdf`，对照空白模板检查 Name/NRIC/Date 是否落在横线上方
  3. 偏移则微调映射坐标（x 左右、y 上下，单位 pt，1pt ≈ 0.35mm），回到 1

- [ ] **Step 8: 运行** `npm test` — 全 PASS

- [ ] **Step 9: Commit**

```bash
git add scripts/extract_pdf_labels.py scripts/generate-proofs.ts pdf/sampleData.ts pdf/prsTemplates.ts pdf/mappings/declaration.ts pdf/__tests__/mappings.test.ts
git commit -m "feat(prs): calibration toolchain and declaration form mapping"
```

---

### Task 7: `ppa-nomination` 映射

**Files:**
- Create: `pdf/mappings/ppaNomination.ts`
- Modify: `pdf/__tests__/mappings.test.ts`（数组加入新映射）
- Modify: `scripts/generate-proofs.ts`（同上）

字段一览（页1 = Part A/B，页2 = Consultant 区；Part C 签名、Part D 见证人**留空手填**——见证人必须在场签署）：

| key | 类型 | 位置 |
|---|---|---|
| `full_name` | text | Part A NAME |
| `ppa_account_no` | comb | Part A `P P A` 格子 |
| `phone_mobile` | comb 或 text | Part A MOBILE NO.（按实际格子定） |
| `email` | text | Part A EMAIL ADDRESS |
| `religion_islam` | checkbox ×2 | Muslim / Non-Muslim（`when: d => d.religion_islam === 'muslim'` 及 `=== 'non_muslim'`） |
| `nric` | comb | Part B 正文中的 NRIC 格子 |
| `nominees.{0..5}.name/nric/mobile/email/percentage` | text | Part B 表格 6 行（每行 5 字段，行高等距，写一行后其余 5 行用行距偏移推算再实测微调） |
| `consultant_code` `consultant_name` `consultant_nric` `consultant_phone` `branch_name_code` `sign_date` | text | 页2 FOR PRS CONSULTANT USE 区 |

- [ ] **Step 1: 提取坐标** — `python scripts/extract_pdf_labels.py public/forms/prs/ppa-nomination.pdf 1`（页2 同理）
- [ ] **Step 2: 写 `ppaNominationMapping`**（结构同 declarationMapping；`recommendedKeys: ['full_name', 'nric', 'religion_islam', 'nominees.0.name']`；6 行 nominee 用循环生成字段数组：）

```ts
// pdf/mappings/ppaNomination.ts 中 nominee 行的生成模式
const NOMINEE_ROW_0_Y = 0;   // ← 第 1 行实测 y
const NOMINEE_ROW_H = 0;     // ← 实测行距
const nomineeFields = Array.from({ length: 6 }, (_, i) => {
  const y = NOMINEE_ROW_0_Y - i * NOMINEE_ROW_H;
  return [
    { key: `nominees.${i}.name`,       page: 0, x: 0, y,            maxWidth: 180 },
    { key: `nominees.${i}.nric`,       page: 0, x: 0, y: y - 12,    maxWidth: 140 },
    { key: `nominees.${i}.mobile`,     page: 0, x: 0, y,            maxWidth: 110 },
    { key: `nominees.${i}.email`,      page: 0, x: 0, y: y - 12,    maxWidth: 110, uppercase: false },
    { key: `nominees.${i}.percentage`, page: 0, x: 0, y,            maxWidth: 40 },
  ];
}).flat();
```

- [ ] **Step 3: 测试与脚本登记** — `mappings.test.ts` 与 `generate-proofs.ts` 的数组各加入 `ppaNominationMapping`
- [ ] **Step 4: 校准闭环** — `npm run proofs` → 对照 → 微调 → 直到对位；`npm test` 全 PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(prs): PPA nomination form mapping"`

---

### Task 8: `top-up` 映射

**Files:**
- Create: `pdf/mappings/topUp.ts`
- Modify: `pdf/__tests__/mappings.test.ts`、`scripts/generate-proofs.ts`

字段一览（仅页1；页2 全是条款）：

| key | 类型 | 位置 |
|---|---|---|
| `topup_type` | checkbox ×2 | Contribution (Top-up) / Change of Contribution Direction |
| `full_name` | text | Name |
| `phone_mobile` | text/comb | Contact No. |
| `email` | text（`uppercase: false`） | Email Address |
| `prs_plus_account_no` | comb | PRS Plus Account No. |
| `nric` | comb（`strip: /[\s-]/g`） | NRIC No. |
| `other_id_no` | text | Other ID No. |
| `ppa_account_no` | comb | PPA Account No. |
| `contribution_amount` | text | Contribution Amount (RM) |
| `cheque_no` | text | Cheque No. |
| `rsp_enabled` | checkbox | Regular Savings Plan |
| `rsp_bank` `rsp_bank_account_no`(comb) `rsp_amount` `rsp_deduction_day` | 各自 | RSP 区 |
| `epf_redirection_percent` | checkbox ×7 | 1%~7%（`when: d => d.epf_redirection_percent === 'N'`） |
| `salary_deduction_rm` `salary_deduction_percent` | text | Salary Deduction 行 |
| `class_for_application` | text | Class For This Application |
| `consultant_name` `consultant_code` `consultant_phone` `sign_date` | text | §4 顾问区 |

- [ ] **Step 1-5: 同 Task 7 流程**（提取 → 写映射 → 登记 → 校准闭环 → `npm test` PASS → commit `"feat(prs): top-up contribution form mapping"`）

---

### Task 9: `isa-individual` 映射

**Files:**
- Create: `pdf/mappings/isaIndividual.ts`
- Modify: `pdf/__tests__/mappings.test.ts`、`scripts/generate-proofs.ts`

字段一览（3 页全要填；选项题全部是 checkbox，`when` 比对对应枚举值）：

| 区域 | key | 说明 |
|---|---|---|
| 页1 顶部 | `isa_mode` | New Investor / Review 两个勾选 |
| Part 1 | `full_name` `nric` | 文字 |
| Part 1 | `date_of_birth` → Age | 用 getter 思路：映射 key 仍为 `date_of_birth`，但 Age 栏需要算年龄——**改为在 UI 派生**：编辑器把年龄算好后无需入纸；Age 栏映射 key 用 `date_of_birth` 不合适，处理办法：fillEngine 不支持计算，所以在 `PrsFormData` 不加字段，**Age 直接由 mapping 字段 `key: 'date_of_birth'` 改为留空手填**（写入 recommendedKeys 提示即可——三页表格中 Age 非关键栏） |
| Part 1 | `isa_education` ×4 / `isa_disposable_income` ×4 / `isa_commitment` ×4 / `isa_invest_pct` ×6 | checkbox 组 |
| Part 2 | `isa_expectation` ×3 / `isa_purpose` ×5 + `isa_purpose_other`(text) / `isa_reasons` ×3（`when: d => d.isa_reasons.includes('...')`） | checkbox 组 |
| Part 2 Q4 | `isa_exp_unit_trust` `isa_exp_bond` `isa_exp_equities` `isa_exp_derivatives` `isa_exp_prs` `isa_exp_others` | text（年数） |
| Part 3 | `isa_q1_age`~`isa_q6_risk` 各 ×3 | checkbox 组；TOTAL 栏 text：映射额外用一个**计算值填法**——见 Step 2 |
| Part 4（顾问） | `utc_recommended_category` ×3 / `utc_basis` ×4 + `utc_basis_other` / `utc_funds.{0..4}` | checkbox + text |
| Part 5 | `isa_vulnerable` 各属性 Yes/No 两列 | checkbox（属性在数组中 → Yes 列画 X，否则 No 列画 X；`none` 单独一行） |
| Part 6 | `isa_acks.{0..4}` | 每题 YES/NO 圈选 → 用 checkbox 在 YES 或 NO 上画圈不可行，改为在对应词上方画 X（`when: d => d.isa_acks[N] === 'yes'` / `'no'`） |
| 页3 签名区 | `full_name`(Name) `sign_date`(Date) / 顾问列 `consultant_name` `consultant_code` `sign_date` | text |

- [ ] **Step 1: 提取三页坐标**
- [ ] **Step 2: TOTAL 分数的处理** — fillEngine 只认 PrsFormData 字符串路径，总分是派生值。约定：**`__` 前缀 = 派生键**，不进 `PrsFormData` 类型，由 `generatePrsPack` 的 `buildDataForPdf`（Task 11）在调用 fillForm 前注入 `__isa_total: String(isaTotalScore(formData) ?? '')`。ISA 映射 TOTAL 栏用 `key: '__isa_total'`。配套修改 `pdf/__tests__/mappings.test.ts` 的 key 合法性断言，放行派生键：

```ts
expect(f.key.startsWith('__') || validRoots.has(f.key.split('.')[0]), `非法 key: ${f.key}`).toBe(true);
```
- [ ] **Step 3: 写映射 + 登记 + 校准闭环**（checkbox 组多、页1 密集，预计是第二费时的校准）
- [ ] **Step 4: `npm test` 全 PASS**
- [ ] **Step 5: Commit** — `"feat(prs): ISA suitability assessment form mapping"`

---

### Task 10: `acc-opening` 映射（最大）

**Files:**
- Create: `pdf/mappings/accOpening.ts`
- Modify: `pdf/__tests__/mappings.test.ts`、`scripts/generate-proofs.ts`

只映射页 1、2、3、7（页脚版本 `Version Jan-2026`）。页 4-6 条款、页 8-12 说明/附录/签名声明（签名留空）。

| 页 | key | 类型 |
|---|---|---|
| p1 | `applicant_type` ×2（New / Existing）+ `existing_ppa_account_no`(comb) + `applicant_category` ×2 + `employer_prs_contract_no` | checkbox/text |
| p1 | `nric`(comb) `other_id_type` ×4 `other_id_no` `passport_country` `passport_expiry`(date-split) | |
| p1 | `salutation` ×3+other `full_name` `date_of_birth`(date-split) `gender` ×2 `race` ×3+other(`race_other`) `nationality` ×1+other `marital_status` ×4 `mothers_maiden_name` | |
| p1 | `occupation_category` ×12（11 勾选 + others text）`nature_of_occupation` ×10 `employer_name` `staff_no` `employment_date`(date-split) `monthly_income_bracket` ×10 | checkbox 组 |
| p1 | `corr_address` `corr_postcode` `corr_city` `corr_state` `corr_country` + `perm_same_as_corr`(checkbox) + `perm_*` 同构 | text |
| p1 | `phone_house` `phone_mobile` `phone_office` `email`(uppercase:false) | text |
| p2 | `source_of_funds` ×8 + other / `purpose` ×4 + other / `pep_status` ×2 | checkbox |
| p2 | `contribution_amount` `cheque_no` / `rsp_enabled` + `rsp_bank` `rsp_bank_account_no` `rsp_amount` `rsp_deduction_day` / `epf_redirection_percent` ×7 / `salary_deduction_rm` `salary_deduction_percent` | |
| p2 | `contribution_direction` ×2 / `difm_scheme` ×2 / Do-It-Myself 基金分配表：20 行基金 ×2 列（fund 名固定印在表上，只填 % → key 用 `dim_allocations` **不可行**——见下） | |
| p3 | `consultant_code`(Consultant/Staff Code) `branch_name_code` `distributor_code` `channel` ×3 `class_for_application` `sign_date` | |
| p7 | `full_name` `corr_address`(Mailing) `corr_postcode` `corr_country` `perm_address` `perm_postcode` `perm_country` `date_of_birth` `place_of_birth`+`country_of_birth` `email` / `crs_tax_residences.{0..2}.country/tin/noTinReason/reasonBExplanation` | text（CRS 三行表格） |

- [ ] **Step 1: Do-It-Myself 基金分配表的处理** — 表上 20 个基金名已印好，每行只填 % 数字。`dim_allocations: FundAllocation[]` 是动态数组，与固定行坐标对不上。解法：在 `pdf/mappings/accOpening.ts` 内定义基金顺序常量（与 PDF 行序一致，20 项，名称照抄 PDF：Principal RetireEasy 2060/2050/2040/2030/Income、Principal PRS Plus Conservative/Moderate/Growth/Equity/Asia Pacific Ex Japan Equity，及 Islamic 同构 10 项），生成 20 个 text 字段，key 形如 `__dim_pct_principal_retireeasy_2060`。沿用 Task 9 确立的 `__` 派生键约定（mappings.test 已放行），由 Task 11 的 `buildDataForPdf` 把 `dim_allocations` 摊平成这些键（fund 名 slug 化匹配，见 Task 11 的 `fundSlug`）。
- [ ] **Step 2: 提取页 1/2/3/7 坐标**（页1 约 60+ 字段，是全计划最费时的一页）
- [ ] **Step 3: 写映射 + 登记**（`recommendedKeys`: full_name, nric, date_of_birth, gender, race, marital_status, mothers_maiden_name, occupation_category, monthly_income_bracket, corr_address, phone_mobile, source_of_funds, purpose, pep_status, contribution_amount, contribution_direction, tax_residency, place_of_birth）
- [ ] **Step 4: 校准闭环 + `npm test` PASS**
- [ ] **Step 5: Commit** — `"feat(prs): PRS account opening form mapping (4 pages)"`

---

### Task 11: `generatePrsPack` — 单份 + 合并打印包 + 下载

**Files:**
- Create: `pdf/generatePrsPack.ts`
- Test: `pdf/__tests__/fillEngine.test.ts`（追加合并测试）

- [ ] **Step 1: 追加失败测试**

```ts
// pdf/__tests__/fillEngine.test.ts 追加
import { buildDataForPdf, mergePdfs, ALL_PRS_MAPPINGS } from '../generatePrsPack';
import { samplePrsData } from '../sampleData';

describe('buildDataForPdf', () => {
  it('注入 __isa_total 派生键', () => {
    const d = buildDataForPdf(samplePrsData);
    expect((d as any).__isa_total).toBe('20'); // 3+3+3+3+5+3
  });
  it('dim_allocations 摊平为 __dim_pct_* 键', () => {
    const withDim = { ...samplePrsData, dim_allocations: [{ fund: 'Principal RetireEasy 2050', percent: '100' }] };
    const d = buildDataForPdf(withDim);
    expect((d as any).__dim_pct_principal_retireeasy_2050).toBe('100');
  });
});

describe('mergePdfs', () => {
  it('5 份模板合并后页数等于各页数之和', async () => {
    const all = await Promise.all(ALL_PRS_MAPPINGS.map(async m => {
      const tpl = readFileSync(`public/forms/prs/${m.templateFile}`);
      return (await fillForm(tpl, m, buildDataForPdf(samplePrsData))).bytes;
    }));
    const merged = await mergePdfs(all);
    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(12 + 3 + 4 + 2 + 2); // 23
  });
});
```

- [ ] **Step 2: 运行确认失败**，然后实现

```ts
// pdf/generatePrsPack.ts
import { PDFDocument } from 'pdf-lib';
import type { FormMapping } from './mappingTypes';
import type { PrsFormData } from '../types/prs';
import { isaTotalScore } from '../types/prs';
import { fillForm, type FillResult } from './fillEngine';
import { fetchTemplate } from './prsTemplates';
import { accOpeningMapping } from './mappings/accOpening';
import { isaIndividualMapping } from './mappings/isaIndividual';
import { ppaNominationMapping } from './mappings/ppaNomination';
import { declarationMapping } from './mappings/declaration';
import { topUpMapping } from './mappings/topUp';

/** 打印顺序 */
export const ALL_PRS_MAPPINGS: FormMapping[] = [
  accOpeningMapping, isaIndividualMapping, ppaNominationMapping, declarationMapping, topUpMapping,
];

export function fundSlug(fund: string): string {
  return fund.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** 注入派生键（__isa_total、__dim_pct_*）供映射使用 */
export function buildDataForPdf(data: PrsFormData): PrsFormData {
  const derived: Record<string, string> = {
    __isa_total: String(isaTotalScore(data) ?? ''),
  };
  for (const a of data.dim_allocations) {
    if (a.fund && a.percent) derived[`__dim_pct_${fundSlug(a.fund)}`] = a.percent;
  }
  return { ...data, ...derived } as PrsFormData;
}

export interface GeneratedForm extends FillResult {
  mapping: FormMapping;
}

/** 浏览器端：生成单份 */
export async function generateOne(mapping: FormMapping, data: PrsFormData): Promise<GeneratedForm> {
  const tpl = await fetchTemplate(mapping);
  const result = await fillForm(tpl, mapping, buildDataForPdf(data));
  return { ...result, mapping };
}

export async function mergePdfs(all: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of all) {
    const src = await PDFDocument.load(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(p => out.addPage(p));
  }
  return out.save();
}

/** 浏览器端：生成全套打印包 */
export async function generatePack(data: PrsFormData): Promise<{ bytes: Uint8Array; warnings: string[] }> {
  const results = await Promise.all(ALL_PRS_MAPPINGS.map(m => generateOne(m, data)));
  const bytes = await mergePdfs(results.map(r => r.bytes));
  return { bytes, warnings: results.flatMap(r => r.warnings) };
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 生成前的缺失字段清单（按表格分组） */
export function missingFields(data: PrsFormData): { mapping: FormMapping; keys: string[] }[] {
  return ALL_PRS_MAPPINGS
    .map(mapping => ({
      mapping,
      keys: mapping.recommendedKeys.filter(k => {
        const v = (data as any)[k.split('.')[0]];
        if (Array.isArray(v)) return v.every(item => !item || Object.values(item).every(x => !x));
        return !v;
      }),
    }))
    .filter(g => g.keys.length > 0);
}
```

注意：`generate-proofs.ts` 在 node 环境跑，不能用 `fetchTemplate`——它已直接 `readFileSync`，本任务把它改为复用 `buildDataForPdf`（替换其 `fillForm(tpl, m, samplePrsData)` 为 `fillForm(tpl, m, buildDataForPdf(samplePrsData))`）。

- [ ] **Step 3: `npm test` 全 PASS**
- [ ] **Step 4: Commit** — `"feat(prs): print pack generation with derived field injection"`

---

### Task 12: `prsSync` — clients 双向同步（TDD）

**Files:**
- Create: `components/advisor/prs/__tests__/prsSync.test.ts`
- Create: `components/advisor/prs/prsSync.ts`

- [ ] **Step 1: 写失败测试**

```ts
// components/advisor/prs/__tests__/prsSync.test.ts
import { describe, it, expect } from 'vitest';
import { fromClient, toClientsPayload } from '../prsSync';
import { initialPrsFormData } from '../../../../types/prs';

describe('fromClient（clients 行 → 预填 form_data）', () => {
  it('映射重合字段', () => {
    const d = fromClient({
      full_name: 'Tan Ah Kow', nric: '900101-14-5678', date_of_birth: '1990-01-01',
      gender: 'male', race: 'Chinese', marital_status: 'married',
      phone: '0123456789', email: 'a@b.com',
      correspondence_address: '88 Jalan Test', correspondence_city: 'PJ',
      correspondence_state: 'Selangor', correspondence_postal_code: '47000',
      employer_name: 'ACME', tax_residency: 'resident', tin_number: 'IG123',
      epf_account_number: '888', ppa_account_number: 'PPA1',
      bank_name: 'MAYBANK', bank_account_number: '123', pep_status: false,
      source_of_funds: 'Employment',
    });
    expect(d.full_name).toBe('Tan Ah Kow');
    expect(d.race).toBe('chinese');             // 自由文本归一化到枚举
    expect(d.phone_mobile).toBe('0123456789');
    expect(d.corr_postcode).toBe('47000');
    expect(d.pep_status).toBe('no');
    expect(d.source_of_funds).toBe('employment');
    expect(d.ppa_account_no).toBe('PPA1');
  });
  it('未知 race 归 others 并保留原文', () => {
    const d = fromClient({ race: 'Eurasian' });
    expect(d.race).toBe('others');
    expect(d.race_other).toBe('Eurasian');
  });
  it('空行不产生键（保持 initial 值）', () => {
    expect(fromClient({})).toEqual({});
  });
});

describe('toClientsPayload（form_data → clients 更新）', () => {
  it('只输出非空字段且枚举合法', () => {
    const p = toClientsPayload({
      ...initialPrsFormData,
      full_name: 'Tan Ah Kow', nric: '900101-14-5678', gender: 'male',
      race: 'chinese', marital_status: 'married', phone_mobile: '012',
      pep_status: 'yes', tax_residency: 'resident',
      isa_q1_age: '3', isa_q2_experience: '3', isa_q3_understanding: '3',
      isa_q4_objective: '3', isa_q5_duration: '3', isa_q6_risk: '3', // 总分18 → moderate
    });
    expect(p.full_name).toBe('Tan Ah Kow');
    expect(p.phone).toBe('012');
    expect(p.pep_status).toBe(true);
    expect(p.risk_profile).toBe('moderate');
    expect(p).not.toHaveProperty('email');          // 空值不输出
    expect(p).not.toHaveProperty('date_of_birth');
  });
  it('race=others 时回写 race_other 原文', () => {
    const p = toClientsPayload({ ...initialPrsFormData, race: 'others', race_other: 'Eurasian' });
    expect(p.race).toBe('Eurasian');
  });
});
```

- [ ] **Step 2: 运行确认失败**，然后实现

```ts
// components/advisor/prs/prsSync.ts
// form_data ↔ clients 表的双向字段同步（设计文档 §5 同步规则）
import { initialPrsFormData, isaTotalScore, riskProfileFromScore, type PrsFormData } from '../../../types/prs';

const RACE_LABELS: Record<string, string> = {
  bumiputera: 'Bumiputera', chinese: 'Chinese', indian: 'Indian',
};
const SOURCE_LABELS: Record<string, string> = {
  employment: 'Employment', investment: 'Investment', retirement: 'Retirement',
  sales_of_assets: 'Sales of Assets', inheritance: 'Inheritance',
  savings: 'Savings', business: 'Business',
};
const MARITAL = ['single', 'married', 'divorced', 'widowed'];
const GENDERS = ['male', 'female'];
const TAX_RES = ['resident', 'non_resident'];

function normalizeKey(v: string | null | undefined, labels: Record<string, string>): string {
  if (!v) return '';
  const lower = v.trim().toLowerCase();
  const hit = Object.entries(labels).find(([k, label]) => k === lower || label.toLowerCase() === lower);
  return hit ? hit[0] : 'others';
}

/** clients 行 → 预填的 form_data 局部（只含有值的键） */
export function fromClient(client: Record<string, any>): Partial<PrsFormData> {
  const d: Partial<PrsFormData> = {};
  const direct: [keyof PrsFormData, string][] = [
    ['salutation', 'salutation'], ['full_name', 'full_name'], ['nric', 'nric'],
    ['date_of_birth', 'date_of_birth'], ['nationality', 'nationality'],
    ['phone_mobile', 'phone'], ['email', 'email'],
    ['corr_address', 'correspondence_address'], ['corr_city', 'correspondence_city'],
    ['corr_state', 'correspondence_state'], ['corr_postcode', 'correspondence_postal_code'],
    ['employer_name', 'employer_name'], ['tin_number', 'tin_number'],
    ['epf_account_number', 'epf_account_number'], ['ppa_account_no', 'ppa_account_number'],
    ['bank_name', 'bank_name'], ['bank_account_number', 'bank_account_number'],
  ];
  for (const [formKey, col] of direct) {
    if (client[col]) (d as any)[formKey] = String(client[col]);
  }
  if (client.gender && GENDERS.includes(client.gender)) d.gender = client.gender;
  if (client.marital_status && MARITAL.includes(client.marital_status)) d.marital_status = client.marital_status;
  if (client.tax_residency && TAX_RES.includes(client.tax_residency)) d.tax_residency = client.tax_residency;
  if (client.race) {
    const r = normalizeKey(client.race, RACE_LABELS);
    d.race = r as PrsFormData['race'];
    if (r === 'others') d.race_other = String(client.race);
  }
  if (client.source_of_funds) {
    const s = normalizeKey(client.source_of_funds, SOURCE_LABELS);
    d.source_of_funds = s as PrsFormData['source_of_funds'];
    if (s === 'others') d.source_of_funds_other = String(client.source_of_funds);
  }
  if (client.pep_status === true) d.pep_status = 'yes';
  if (client.pep_status === false) d.pep_status = 'no';
  if (client.occupation) d.occupation_other = String(client.occupation);
  return d;
}

/** form_data → clients 更新 payload（只含非空且枚举合法的列） */
export function toClientsPayload(d: PrsFormData): Record<string, any> {
  const p: Record<string, any> = {};
  const put = (col: string, v: string) => { if (v) p[col] = v; };
  put('salutation', d.salutation);
  put('full_name', d.full_name);
  put('nric', d.nric);
  put('date_of_birth', d.date_of_birth);
  if (GENDERS.includes(d.gender)) p.gender = d.gender;
  put('nationality', d.nationality);
  if (MARITAL.includes(d.marital_status)) p.marital_status = d.marital_status;
  if (d.race === 'others') put('race', d.race_other);
  else if (d.race) p.race = RACE_LABELS[d.race];
  put('phone', d.phone_mobile);
  put('email', d.email);
  put('correspondence_address', d.corr_address);
  put('correspondence_city', d.corr_city);
  put('correspondence_state', d.corr_state);
  put('correspondence_postal_code', d.corr_postcode);
  put('employer_name', d.employer_name);
  if (d.source_of_funds === 'others') put('source_of_funds', d.source_of_funds_other);
  else if (d.source_of_funds) p.source_of_funds = SOURCE_LABELS[d.source_of_funds];
  if (TAX_RES.includes(d.tax_residency)) p.tax_residency = d.tax_residency;
  put('tin_number', d.tin_number);
  put('epf_account_number', d.epf_account_number);
  put('ppa_account_number', d.ppa_account_no);
  put('bank_name', d.bank_name);
  put('bank_account_number', d.bank_account_number);
  if (d.pep_status === 'yes') p.pep_status = true;
  if (d.pep_status === 'no') p.pep_status = false;
  if (d.occupation_other) put('occupation', d.occupation_other);
  const score = isaTotalScore(d);
  if (score != null) p.risk_profile = riskProfileFromScore(score);
  return p;
}
```

- [ ] **Step 3: `npm test` 全 PASS**
- [ ] **Step 4: Commit** — `"feat(prs): bidirectional clients sync helpers (TDD)"`

---

### Task 13: `prsFields` UI 配置 + `PrsForm` 共用组件

**Files:**
- Create: `components/advisor/prs/prsFields.ts`
- Create: `components/advisor/prs/PrsForm.tsx`
- Modify: `pdf/__tests__/mappings.test.ts`（追加 UI 覆盖率测试）

- [ ] **Step 1: 写字段配置类型与分区**

```ts
// components/advisor/prs/prsFields.ts
import type { PrsFormData } from '../../../types/prs';

export type ControlType = 'text' | 'date' | 'select' | 'radio' | 'multicheck' | 'toggle';

export interface FieldDef {
  key: keyof PrsFormData | string;   // 嵌套数组由 section 的 repeat 处理
  labelEn: string;
  labelZh: string;
  control: ControlType;
  options?: { value: string; en: string; zh: string }[];  // select/radio/multicheck
  placeholder?: string;
  /** 仅当条件成立时显示（如 race_other） */
  showIf?: (d: PrsFormData) => boolean;
}

export interface SectionDef {
  key: string;
  titleEn: string;
  titleZh: string;
  advisorOnly?: boolean;
  fields: FieldDef[];
  /** 数组型子表（nominees / crs_tax_residences / dim_allocations / utc_funds / isa_acks） */
  repeat?: {
    key: 'nominees' | 'crs_tax_residences' | 'dim_allocations' | 'utc_funds' | 'isa_acks';
    rows: number;
    itemFields: FieldDef[];   // key 为子对象键（如 'name'）；utc_funds/isa_acks 为标量行，itemFields 单项 key 用 'value'
  };
}

export const PRS_SECTIONS: SectionDef[] = [/* 按下方分区清单完整列出 */];
```

分区清单（**每个 `PrsFormData` 键必须且只能出现在一个分区**，覆盖率由 Step 3 的测试强制）：

| section key | 标题（中） | 字段 |
|---|---|---|
| `applicant` | 申请人类型 | applicant_type(radio: 新开户/已有 PPA 账户), existing_ppa_account_no(showIf existing), applicant_category(radio: Personal/Employee), employer_prs_contract_no + staff_no + employment_date(showIf employee) |
| `personal` | 个人资料 | salutation(select Mr/Mrs/Ms/Dr), full_name, nric, other_id_type(select), other_id_no, passport_country + passport_expiry(showIf passport), date_of_birth(date), gender(radio), race(radio), race_other(showIf others), nationality, marital_status(radio), mothers_maiden_name |
| `occupation` | 职业与收入 | occupation_category(select 12 项), occupation_other(showIf others), nature_of_occupation(select 10 项), nature_other(showIf others), employer_name, monthly_income_bracket(select 10 档) |
| `contact` | 联系与地址 | phone_mobile, phone_house, phone_office, email, corr_address, corr_postcode, corr_city, corr_state(select 16 州，复用 NewClient 的 MY_STATES 列表), corr_country, perm_same_as_corr(toggle), perm_address/postcode/city/state/country(showIf !same) |
| `funds` | 资金来源与目的 | source_of_funds(radio 8 项), source_of_funds_other, purpose(radio 4 项), purpose_other, pep_status(radio yes/no) |
| `contribution` | 供款与银行 | contribution_amount, cheque_no, rsp_enabled(toggle), rsp_bank/rsp_bank_account_no/rsp_amount/rsp_deduction_day(showIf rsp), epf_redirection_percent(select 1-7%), salary_deduction_rm, salary_deduction_percent, bank_name, bank_account_number, epf_account_number, ppa_account_no, prs_plus_account_no, topup_type(radio), contribution_direction(radio), difm_scheme(radio, showIf do_it_for_me), repeat: dim_allocations 6 行 fund(select 20 基金)+percent(showIf do_it_myself) |
| `tax` | 税务与 CRS 声明 | tax_residency(radio), tin_number, place_of_birth, country_of_birth, repeat: crs_tax_residences 3 行 country/tin/noTinReason(select A/B/C)/reasonBExplanation |
| `nomination` | 受益人提名 | religion_islam(radio Muslim/Non-Muslim), repeat: nominees 6 行 name/nric/mobile/email/percentage |
| `isa` | 投资适当性评估 | isa_mode(radio), isa_education(radio), isa_disposable_income(radio), isa_commitment(radio), isa_invest_pct(radio), isa_expectation(radio), isa_purpose(radio), isa_purpose_other, isa_reasons(multicheck), isa_exp_*(6 个 text), isa_q1~q6(radio，选项文案抄 PDF 原文), isa_vulnerable(multicheck), repeat: isa_acks 5 行 radio yes/no（题干抄 PDF） |
| `advisor` | 顾问专区（advisorOnly） | consultant_name/code/nric/phone, branch_name_code, distributor_code, channel(radio 3 项), class_for_application, utc_recommended_category(radio), utc_basis(multicheck), utc_basis_other, repeat: utc_funds 5 行, sign_date(date) |

- [ ] **Step 2: 写 `PrsForm.tsx`**——受控组件，遍历 `PRS_SECTIONS` 渲染。沿用 NewClient.tsx 的 `Card/Grid/Field/Inp/Sel` 样式代码（复制到本文件作局部组件，加 radio/multicheck/toggle 三种控件）。Props：

```tsx
interface PrsFormProps {
  data: PrsFormData;
  onChange: (patch: Partial<PrsFormData>) => void;
  mode: 'advisor' | 'client';   // client 模式跳过 advisorOnly 分区
  language: 'en' | 'zh';
}
```

radio 渲染为按钮组（样式参考 FormKitTab 的 email type selector：选中 `bg-xin-blue text-white`，未选 `bg-slate-100 text-slate-500`）。repeat 子表渲染为带行号的紧凑网格。ISA 分区底部显示实时总分与风险等级：`isaTotalScore(data)` + `riskProfileFromScore`（参考 Part 3 表格的「TOTAL」行）。

- [ ] **Step 3: UI 覆盖率测试**（追加到 `pdf/__tests__/mappings.test.ts`）

```ts
import { PRS_SECTIONS } from '../../components/advisor/prs/prsFields';

it('PRS_SECTIONS 覆盖 PrsFormData 全部键且无重复', () => {
  const covered = new Set<string>();
  for (const s of PRS_SECTIONS) {
    for (const f of s.fields) {
      expect(covered.has(f.key as string), `重复键: ${f.key}`).toBe(false);
      covered.add(f.key as string);
    }
    if (s.repeat) covered.add(s.repeat.key);
  }
  const allKeys = Object.keys(initialPrsFormData).filter(k => !k.startsWith('__'));
  const missing = allKeys.filter(k => !covered.has(k));
  expect(missing, `未在 UI 出现的键: ${missing.join(', ')}`).toEqual([]);
});
```

- [ ] **Step 4: `npm test` 全 PASS + `npx tsc --noEmit` 零错误**
- [ ] **Step 5: Commit** — `"feat(prs): shared PRS form component with bilingual section config"`

---

### Task 14: 列表页 + 路由 + 侧边栏

**Files:**
- Create: `components/advisor/pages/PrsApplicationList.tsx`
- Modify: `components/advisor/AdvisorApp.tsx`
- Modify: `components/advisor/AdvisorLayout.tsx`

- [ ] **Step 1: 列表页**

```tsx
// components/advisor/pages/PrsApplicationList.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, FileText } from 'lucide-react';
import { initialPrsFormData, type PrsApplication } from '../../../types/prs';

const STATUS_BADGES: Record<string, { en: string; zh: string; cls: string }> = {
  draft:           { en: 'Draft',           zh: '草稿',     cls: 'bg-slate-100 text-slate-600' },
  awaiting_client: { en: 'Awaiting Client', zh: '待客户填写', cls: 'bg-blue-50 text-blue-700' },
  submitted:       { en: 'To Review',       zh: '待审核',   cls: 'bg-amber-50 text-amber-700' },
  completed:       { en: 'Completed',       zh: '已完成',   cls: 'bg-emerald-50 text-emerald-700' },
  cancelled:       { en: 'Cancelled',       zh: '已取消',   cls: 'bg-rose-50 text-rose-600' },
};

export default function PrsApplicationList() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const navigate = useNavigate();
  const [apps, setApps] = useState<PrsApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('prs_applications')
      .select('*, clients(full_name)')
      .order('updated_at', { ascending: false });
    setApps((data ?? []).map((r: any) => ({ ...r, client_full_name: r.clients?.full_name })));
    setLoading(false);
  }

  async function createNew() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
    if (!adv) return;
    const { data, error } = await supabase
      .from('prs_applications')
      .insert({ advisor_id: adv.id, form_data: initialPrsFormData })
      .select()
      .single();
    if (!error && data) navigate(`/advisor/prs/${data.id}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-xin-blue">{t('PRS Applications', 'PRS 开户申请')}</h1>
        <button onClick={createNew}
          className="flex items-center gap-1.5 bg-xin-blue text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blueLight transition-colors">
          <Plus size={15} /> {t('New Application', '新建申请')}
        </button>
      </div>

      {loading ? (
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xin-blue mx-auto mt-16" />
      ) : apps.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
          <FileText size={32} className="mx-auto mb-3 text-slate-300" />
          {t('No applications yet. Create one, or start from a client page.', '还没有申请。点击新建，或从客户详情页发起。')}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {apps.map(app => {
            const b = STATUS_BADGES[app.status] ?? STATUS_BADGES.draft;
            return (
              <button key={app.id} onClick={() => navigate(`/advisor/prs/${app.id}`)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-xin-blue truncate">
                    {app.client_full_name || app.form_data?.full_name || t('(New client)', '（新客户）')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('Updated', '更新于')} {new Date(app.updated_at).toLocaleString(language === 'zh' ? 'zh-MY' : 'en-MY')}
                  </p>
                </div>
                <span className={`${b.cls} text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ml-3`}>
                  {language === 'zh' ? b.zh : b.en}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 注册路由** — `AdvisorApp.tsx` 在 `cases/:id` 行后加：

```tsx
<Route path="prs" element={<PrsApplicationList />} />
<Route path="prs/:id" element={<PrsApplicationEditor />} />
```

（`PrsApplicationEditor` 在 Task 15 创建；本任务先建一个返回 `null` 的占位文件让编译通过，Task 15 实现。）

- [ ] **Step 3: 侧边栏** — `AdvisorLayout.tsx` 的 `navItems` 在 cases 之后插入：

```tsx
{ to: '/advisor/prs', icon: <FileText size={18} />, label: language === 'zh' ? '开户申请' : 'PRS Applications', badge: 0 },
```

（`FileText` 加入现有 lucide-react import。）

- [ ] **Step 4: 验证** — `npx tsc --noEmit` + `npm run build` 通过；`npm run dev` 打开 `/advisor/prs` 能看到空列表并能新建跳转
- [ ] **Step 5: Commit** — `"feat(prs): application list page with sidebar entry"`

---

### Task 15: 申请编辑页（核心页面）

**Files:**
- Create: `components/advisor/pages/PrsApplicationEditor.tsx`（替换 Task 14 占位）

- [ ] **Step 1: 实现编辑页**。结构与行为：

```tsx
// components/advisor/pages/PrsApplicationEditor.tsx —— 关键骨架（完整实现按此展开）
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { ChevronLeft, Printer, FileDown, CheckCircle2, FlaskConical } from 'lucide-react';
import PrsForm from '../prs/PrsForm';
import { fromClient, toClientsPayload } from '../prs/prsSync';
import { initialPrsFormData, type PrsApplication, type PrsFormData } from '../../../types/prs';
import { ALL_PRS_MAPPINGS, generateOne, generatePack, downloadBytes, missingFields } from '../../../pdf/generatePrsPack';
import { samplePrsData } from '../../../pdf/sampleData';

export default function PrsApplicationEditor() {
  const { id } = useParams();
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const navigate = useNavigate();
  const [app, setApp] = useState<PrsApplication | null>(null);
  const [data, setData] = useState<PrsFormData>(initialPrsFormData);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genWarnings, setGenWarnings] = useState<string[]>([]);

  // 载入：merge initial 防止旧数据缺新键
  useEffect(() => {
    (async () => {
      const { data: row } = await supabase.from('prs_applications').select('*').eq('id', id).single();
      if (row) {
        setApp(row);
        setData({ ...initialPrsFormData, ...row.form_data });
      }
    })();
  }, [id]);

  // 保存草稿：写 form_data + 同步 clients（有 client_id 时更新；无且有姓名时建档并回填）
  async function save(): Promise<boolean> { /* 实现见下方代码块 */ }

  // 生成：先 save，再生成；记录 pdf_generated_at
  async function handleGeneratePack() { /* 实现见下方代码块 */ }
  async function handleGenerateOne(mapping: FormMapping) { /* 实现见下方代码块 */ }
  // markCompleted 在 Task 21 实现

  const missing = missingFields(data);
  // 渲染：返回按钮 + 标题（客户名）+ 状态徽章 | 缺失警告（黄色，FormKitTab 样式）
  //   | <PrsForm data={data} onChange={p => setData(d => ({...d, ...p}))} mode="advisor" language={language} />
  //   | 底部操作栏（sticky）：保存草稿 / 生成打印包 / 各表单独下载下拉 / 标记完成 / 填入样本数据(仅 import.meta.env.DEV)
}
```

`save()` 实现要点（完整写出逻辑，不可省略）：

```ts
async function save(): Promise<boolean> {
  if (!app) return false;
  setSaving(true);
  try {
    let clientId = app.client_id;
    if (!clientId && data.full_name.trim()) {
      // 新客户建档：与 NewClient.tsx 相同模式 + 设计文档 §5（pipeline_stage='interested'）
      const { data: created, error } = await supabase.from('clients').insert({
        advisor_id: app.advisor_id,
        full_name: data.full_name.trim(),
        status: 'prospect',
        pipeline_stage: 'interested',
        ...toClientsPayload(data),
      }).select('id').single();
      if (error) throw error;
      clientId = created.id;
    } else if (clientId) {
      const payload = toClientsPayload(data);
      if (Object.keys(payload).length > 0) {
        const { error } = await supabase.from('clients').update(payload).eq('id', clientId);
        if (error) throw error;
      }
    }
    const { error: upErr } = await supabase.from('prs_applications')
      .update({ form_data: data, client_id: clientId })
      .eq('id', app.id);
    if (upErr) throw upErr;
    setApp(a => a ? { ...a, client_id: clientId } : a);
    return true;
  } catch (e: any) {
    alert(t('Save failed: ', '保存失败：') + e.message);
    return false;
  } finally {
    setSaving(false);
  }
}
```

`handleGeneratePack()`：

```ts
async function handleGeneratePack() {
  if (!(await save())) return;
  setGenerating(true);
  try {
    const { bytes, warnings } = await generatePack(data);
    setGenWarnings(warnings);
    const name = (data.full_name || 'prs').replace(/\s+/g, '-').toLowerCase();
    downloadBytes(bytes, `prs-pack-${name}.pdf`);
    await supabase.from('prs_applications')
      .update({ pdf_generated_at: new Date().toISOString() })
      .eq('id', app!.id);
  } finally {
    setGenerating(false);
  }
}
```

`handleGenerateOne(mapping)`（「单独下载」下拉里每份表格一项，下拉项来自 `ALL_PRS_MAPPINGS`）：

```ts
async function handleGenerateOne(mapping: FormMapping) {
  if (!(await save())) return;
  setGenerating(true);
  try {
    const { bytes, warnings } = await generateOne(mapping, data);
    setGenWarnings(warnings);
    const name = (data.full_name || 'prs').replace(/\s+/g, '-').toLowerCase();
    downloadBytes(bytes, `${mapping.id}-${name}.pdf`);
  } finally {
    setGenerating(false);
  }
}
```

（import 处补 `type FormMapping` 自 `../../../pdf/mappingTypes`。）

缺失警告块（生成按钮上方，黄色样式照抄 FormKitTab.tsx 第 268-281 行的结构）：列出 `missing` 中每个表格的 `labelZh/labelEn` 与缺字段的 UI label（从 PRS_SECTIONS 反查 labelEn/labelZh，查不到显示 key）。警告**不阻止生成**。

「填入样本数据」按钮：`onClick={() => setData(samplePrsData)}`，仅 `import.meta.env.DEV` 时渲染——校准对照用。

- [ ] **Step 2: 手动验证** — `npm run dev`：新建申请 → 填几个字段 → 保存 → 刷新数据还在 → 填入样本数据 → 生成打印包 → 下载的 PDF 与 `npm run proofs` 产物一致；clients 表出现新建档客户（Supabase 后台或客户列表确认）
- [ ] **Step 3: `npx tsc --noEmit` + `npm run build` 通过**
- [ ] **Step 4: Commit** — `"feat(prs): application editor with save/sync/generate"`

---

### Task 16: ClientDetail「发起 PRS 开户」入口

**Files:**
- Modify: `components/advisor/pages/ClientDetail.tsx`

- [ ] **Step 1: 加按钮** — 在「New Case」按钮（约 218-224 行）旁边加：

```tsx
<button
  onClick={startPrsApplication}
  disabled={startingPrs}
  className="flex items-center gap-1.5 bg-white border border-xin-blue/20 text-xin-blue text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blue/5 transition-colors shrink-0 disabled:opacity-50"
>
  <FileText size={15} />
  {startingPrs ? '...' : t('PRS Account', 'PRS 开户')}
</button>
```

处理函数（组件内）：

```tsx
const [startingPrs, setStartingPrs] = useState(false);

async function startPrsApplication() {
  setStartingPrs(true);
  const { data, error } = await supabase.from('prs_applications').insert({
    advisor_id: client.advisor_id,
    client_id: client.id,
    form_data: { ...initialPrsFormData, ...fromClient(client) },
  }).select('id').single();
  setStartingPrs(false);
  if (!error && data) navigate(`/advisor/prs/${data.id}`);
}
```

import：`FileText`（lucide）、`initialPrsFormData`（types/prs）、`fromClient`（prsSync）。

- [ ] **Step 2: 手动验证** — 从某客户详情点按钮 → 编辑页已预填该客户资料
- [ ] **Step 3: Commit** — `"feat(prs): start PRS application from client detail"`

---

### Task 17: 阶段一验收

- [ ] **Step 1: 全量检查** — `npm test` 全 PASS、`npx tsc --noEmit` 零错误、`npm run build` 成功
- [ ] **Step 2: 试填件终验** — `npm run proofs` 生成全套 5 份 + 在编辑页用样本数据生成打印包；**交用户打印对照实体表格逐页确认对位**（设计文档 §11 硬标准）。不对位 → 回到对应映射微调坐标，重复
- [ ] **Step 3: 真实数据走查** — 用户选一个现有客户发起申请 → 补全 → 生成 → 检查
- [ ] **Step 4: 用户确认后** — `git push` 部署（Vercel 自动）

---

# 阶段二：客户填写链接

### Task 18: `api/prs-application.js` token API

**Files:**
- Create: `api/prs-application.js`

- [ ] **Step 1: 实现**（handler 结构、CORS、supabaseAdmin 模式照抄 `api/kyc.js` 顶部；表操作全部针对 `prs_applications`/`clients`）

```js
// api/prs-application.js
import { supabaseAdmin } from './_lib/supabase.js';

// 顾问专区字段：客户提交不可写、GET 不下发（与 types/prs.ts 的 ADVISOR_ONLY_KEYS 保持一致）
const ADVISOR_ONLY_KEYS = [
  'consultant_name', 'consultant_code', 'consultant_nric', 'consultant_phone',
  'branch_name_code', 'distributor_code', 'channel', 'class_for_application',
  'utc_recommended_category', 'utc_basis', 'utc_basis_other', 'utc_funds', 'sign_date',
];

const GENDERS = ['male', 'female'];
const MARITAL = ['single', 'married', 'divorced', 'widowed'];
const TAX_RES = ['resident', 'non_resident'];
const RACE_LABELS = { bumiputera: 'Bumiputera', chinese: 'Chinese', indian: 'Indian' };
const SOURCE_LABELS = {
  employment: 'Employment', investment: 'Investment', retirement: 'Retirement',
  sales_of_assets: 'Sales of Assets', inheritance: 'Inheritance',
  savings: 'Savings', business: 'Business',
};

// 与 components/advisor/prs/prsSync.ts 的 toClientsPayload 同逻辑（JS 版）。
// 注意：api/ 是独立的 Vercel Functions 环境，无法 import TS 模块，故此处复制实现；
// 两边若改动必须同步（见文件头注释）。
function toClientsPayload(d) {
  const p = {};
  const put = (col, v) => { if (v) p[col] = v; };
  put('salutation', d.salutation); put('full_name', d.full_name); put('nric', d.nric);
  put('date_of_birth', d.date_of_birth);
  if (GENDERS.includes(d.gender)) p.gender = d.gender;
  put('nationality', d.nationality);
  if (MARITAL.includes(d.marital_status)) p.marital_status = d.marital_status;
  if (d.race === 'others') put('race', d.race_other);
  else if (d.race && RACE_LABELS[d.race]) p.race = RACE_LABELS[d.race];
  put('phone', d.phone_mobile); put('email', d.email);
  put('correspondence_address', d.corr_address);
  put('correspondence_city', d.corr_city);
  put('correspondence_state', d.corr_state);
  put('correspondence_postal_code', d.corr_postcode);
  put('employer_name', d.employer_name);
  if (d.source_of_funds === 'others') put('source_of_funds', d.source_of_funds_other);
  else if (d.source_of_funds && SOURCE_LABELS[d.source_of_funds]) p.source_of_funds = SOURCE_LABELS[d.source_of_funds];
  if (TAX_RES.includes(d.tax_residency)) p.tax_residency = d.tax_residency;
  put('tin_number', d.tin_number);
  put('epf_account_number', d.epf_account_number);
  put('ppa_account_number', d.ppa_account_no);
  put('bank_name', d.bank_name);
  put('bank_account_number', d.bank_account_number);
  if (d.pep_status === 'yes') p.pep_status = true;
  if (d.pep_status === 'no') p.pep_status = false;
  if (d.occupation_other) put('occupation', d.occupation_other);
  const answers = [d.isa_q1_age, d.isa_q2_experience, d.isa_q3_understanding,
    d.isa_q4_objective, d.isa_q5_duration, d.isa_q6_risk];
  if (answers.every(a => a === '1' || a === '3' || a === '5')) {
    const score = answers.reduce((s, a) => s + parseInt(a, 10), 0);
    p.risk_profile = score <= 13 ? 'conservative' : score <= 22 ? 'moderate' : 'aggressive';
  }
  return p;
}

async function findValidApplication(token) {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return { error: 404 };
  const { data: app } = await supabaseAdmin
    .from('prs_applications').select('*').eq('token', token).maybeSingle();
  if (!app) return { error: 404 };
  if (app.status !== 'awaiting_client') return { error: 410 };
  if (app.token_expires_at && new Date(app.token_expires_at) < new Date()) return { error: 410 };
  return { app };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server config error' });

  try {
    if (req.method === 'GET') {
      const { app, error } = await findValidApplication(req.query.token);
      if (error) return res.status(error).json({ error: error === 404 ? 'INVALID_TOKEN' : 'LINK_EXPIRED' });
      const formData = { ...app.form_data };
      for (const k of ADVISOR_ONLY_KEYS) delete formData[k];
      return res.status(200).json({ form_data: formData });
    }

    if (req.method === 'POST') {
      const { token, form_data: incoming } = req.body || {};
      const { app, error } = await findValidApplication(token);
      if (error) return res.status(error).json({ error: error === 404 ? 'INVALID_TOKEN' : 'LINK_EXPIRED' });
      if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'form_data required' });
      if (!String(incoming.full_name || '').trim()) return res.status(400).json({ error: 'FULL_NAME_REQUIRED' });

      // 剥除顾问字段，保留申请单上已有的顾问字段值
      const cleaned = { ...incoming };
      for (const k of ADVISOR_ONLY_KEYS) delete cleaned[k];
      const merged = { ...app.form_data, ...cleaned };

      // clients 同步：有 client_id 更新；无则建档（设计文档 §5）
      let clientId = app.client_id;
      const payload = toClientsPayload(merged);
      if (clientId) {
        if (Object.keys(payload).length > 0) {
          const { error: e } = await supabaseAdmin.from('clients').update(payload).eq('id', clientId);
          if (e) throw new Error(`Failed to update client: ${e.message}`);
        }
      } else {
        const { data: created, error: e } = await supabaseAdmin.from('clients').insert({
          advisor_id: app.advisor_id,
          status: 'prospect',
          pipeline_stage: 'interested',
          ...payload,
        }).select('id').single();
        if (e) throw new Error(`Failed to create client: ${e.message}`);
        clientId = created.id;
      }

      const { error: upErr } = await supabaseAdmin.from('prs_applications').update({
        form_data: merged,
        client_id: clientId,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        token: null,
        token_expires_at: null,
      }).eq('id', app.id);
      if (upErr) throw new Error(`Failed to submit: ${upErr.message}`);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('PRS application API error:', e);
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
```

- [ ] **Step 2: 在 prsSync.ts 与本文件头部互加注释**：「此逻辑在 api/prs-application.js / prsSync.ts 各有一份，修改须同步」
- [ ] **Step 3: 本地冒烟**（`vercel dev` 或部署 preview 后）：`GET /api/prs-application?token=00000000-0000-0000-0000-000000000000` → 404
- [ ] **Step 4: Commit** — `"feat(prs): token API for client form access and submission"`

---

### Task 19: 编辑页「发给客户填写」

**Files:**
- Modify: `components/advisor/pages/PrsApplicationEditor.tsx`

- [ ] **Step 1: 加发送区块**（操作栏新增按钮 + 弹出卡片）：

```tsx
const [shareOpen, setShareOpen] = useState(false);
const [copied, setCopied] = useState(false);

async function sendToClient() {
  if (!(await save())) return;
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  const { error } = await supabase.from('prs_applications')
    .update({ token, token_expires_at: expires, status: 'awaiting_client' })
    .eq('id', app!.id);
  if (!error) {
    setApp(a => a ? { ...a, token, token_expires_at: expires, status: 'awaiting_client' } : a);
    setShareOpen(true);
  }
}

const shareUrl = app?.token ? `${window.location.origin}/prs/${app.token}` : '';
const waText = t(
  `Hi ${data.full_name || ''}, please fill in your PRS account opening details here (valid 14 days): ${shareUrl}`,
  `${data.full_name || ''} 您好，请通过以下链接填写您的 PRS 开户资料（14 天内有效）：${shareUrl}`
);
```

分享卡片：显示链接 + 「复制链接」/「复制 WhatsApp 话术」两个按钮（剪贴板模式照抄 FormKitTab 的 `useClipboard`）+ 「重新生成链接」（再次调用 `sendToClient`，旧 token 被覆盖即失效）。状态为 `awaiting_client` 时编辑页顶部显示蓝色提示条「链接已发出，客户提交后状态会变为待审核」。

- [ ] **Step 2: 手动验证** — 点发送 → 状态变 awaiting_client → 链接可复制
- [ ] **Step 3: Commit** — `"feat(prs): send-to-client share link with WhatsApp template"`

---

### Task 20: 公开填写页 `/prs/:token`

**Files:**
- Create: `components/prs/PrsPublicPage.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: 实现公开页**——手机优先，复用 `PrsForm`（`mode="client"`）。页面骨架照抄 `components/kyc/KYCLayout.tsx` 的 header（logo + EN/中文切换）：

```tsx
// components/prs/PrsPublicPage.tsx —— 关键骨架
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import PrsForm from '../advisor/prs/PrsForm';
import { initialPrsFormData, type PrsFormData } from '../../types/prs';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'invalid' | 'expired' | 'error';

export default function PrsPublicPage() {
  const { token } = useParams();
  const { language, setLanguage } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<PrsFormData>(initialPrsFormData);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/prs-application?token=${token}`);
      if (res.ok) {
        const body = await res.json();
        setData({ ...initialPrsFormData, ...body.form_data });
        setState('ready');
      } else if (res.status === 410) setState('expired');
      else setState('invalid');
    })().catch(() => setState('error'));
  }, [token]);

  async function submit() {
    if (!data.full_name.trim()) {
      setError(t('Please fill in your full name.', '请填写您的全名。'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setState('submitting');
    const res = await fetch('/api/prs-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, form_data: data }),
    });
    if (res.ok) { setState('success'); window.scrollTo({ top: 0 }); }
    else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || t('Submission failed, please try again.', '提交失败，请重试。'));
      setState('ready');
    }
  }

  // invalid/expired/success 三个全屏状态页 + ready 状态渲染：
  //   header（同 KYCLayout：logo + EN/中文）
  //   说明卡（「请填写后提交给您的顾问」）
  //   <PrsForm data={data} onChange={p => setData(d => ({...d, ...p}))} mode="client" language={language} />
  //   底部「提交」按钮（submitting 时 Loader2 旋转）
  // invalid: AlertCircle + 「链接无效，请联系您的顾问」
  // expired: 「链接已过期或已提交，请联系您的顾问获取新链接」
  // success: CheckCircle2 + 「提交成功！您的顾问会跟进后续手续。」
}
```

- [ ] **Step 2: 注册路由** — `App.tsx`：

```tsx
const PrsPublicPage = lazy(() => import('./components/prs/PrsPublicPage'));
// Routes 中，在 /kyc/* 之后加：
<Route path="/prs/:token" element={<PrsPublicPage />} />
```

- [ ] **Step 3: 手动验证全流程** — 编辑页发送链接 → 无痕窗口打开 `/prs/<token>` → 预填可见、顾问分区不可见 → 提交 → 成功页；再次打开同链接 → 「已过期/已提交」页；编辑页刷新 → 状态「待审核」、客户填的数据已合并、顾问字段未被覆盖
- [ ] **Step 4: `npm run build` 通过；Commit** — `"feat(prs): public client form page via token link"`

---

### Task 21: 状态闭环（待审核徽章 + 标记完成）

**Files:**
- Modify: `components/advisor/AdvisorLayout.tsx`
- Modify: `components/advisor/pages/PrsApplicationEditor.tsx`

- [ ] **Step 1: 侧边栏徽章** — `AdvisorLayout.tsx` 的 `loadBadge()` 中追加查询，把数量绑定到「开户申请」nav 项的 badge：

```ts
const [prsToReviewCount, setPrsToReviewCount] = useState(0);
// loadBadge() 内：
const { count: prsCount } = await supabase
  .from('prs_applications')
  .select('id', { count: 'exact', head: true })
  .eq('advisor_id', adv.id)
  .eq('status', 'submitted');
setPrsToReviewCount(prsCount ?? 0);
```

- [ ] **Step 2: 编辑页完成动作** — 状态为 `submitted` 或 `draft` 时显示「标记完成」按钮：

```ts
async function markCompleted() {
  const { error } = await supabase.from('prs_applications')
    .update({ status: 'completed' }).eq('id', app!.id);
  if (!error) setApp(a => a ? { ...a, status: 'completed' } : a);
}
```

`completed` 状态下编辑页只读提示条（仍可重新生成 PDF），并提供「重新打开」按钮（status 改回 draft）。

- [ ] **Step 3: 手动验证** — 提交一单 → 侧边栏出现红点数字 → 审核 → 生成 → 标记完成 → 徽章消失
- [ ] **Step 4: Commit** — `"feat(prs): review badge and completion flow"`

---

### Task 22: 阶段二验收

- [ ] **Step 1: 自动检查** — `npm test` 全 PASS、`npx tsc --noEmit` 零错误、`npm run build` 成功
- [ ] **Step 2: token 四情形回归**（设计文档 §11.4）：有效 token 正常 / 过期 token（手动把 token_expires_at 改为过去）→ expired 页 / 已提交 token → expired 页 / 乱写 token → invalid 页
- [ ] **Step 3: 同步规则回归**（§11.5）：现有客户提交 → clients 字段更新；全新客户提交 → clients 新行、status=prospect、pipeline_stage=interested、Pipeline 看板可见
- [ ] **Step 4: 用户验收后 push 部署**

---

## Self-Review 记录

- **Spec coverage**: 设计文档 §5 数据模型→Task 2/3；§6 PDF 引擎→Task 4/5/6/11，校准流程→Task 6-10；§7 后台→Task 13-16；§8 客户链接→Task 18-20，审核闭环→Task 21；§9 安全（token 校验/顾问字段剥除/RLS）→Task 2/18；§10 错误处理（留空生成/缩字号/token 友好页）→Task 5/11/20；§11 验收→Task 17/22。
- **坐标占位说明**: 映射文件中的 x/y 数值只能由校准闭环实测得出（设计文档 §6 已确认此流程），计划提供了完整的提取工具、打样脚本与逐表字段清单——这是受控的实测流程，不是未决设计。
- **类型一致性**: `ADVISOR_ONLY_KEYS`（types/prs.ts ↔ api/prs-application.js）、`toClientsPayload`（prsSync.ts ↔ api）两处重复实现均有同步注释要求；`__isa_total`/`__dim_pct_*` 派生键的注入（Task 11 `buildDataForPdf`）与放行（Task 10 修改 key 校验测试）已对齐。
