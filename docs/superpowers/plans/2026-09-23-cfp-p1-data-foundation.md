# CFP P1 数据地基 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让系统里每一笔现金流、每一项资产和负债都按 spec 的会计科目表分类，并且让计算引擎、报告、顾问界面、KYC/LevelUp 写入全部读同一份分类，而不是各自猜。

**Architecture:** 在 `supabase/functions/_shared/taxonomy/` 建一个纯 TS 的分类模块（cashflow / balance / legacy 三个文件），它是唯一的真相来源：
- 浏览器和 Deno 边缘函数直接 import 它。
- Vercel 的纯 JS 函数用预打包、已提交的 `api/_lib/taxonomy.mjs`，由一个测试防止打包产物与源码漂移。
- 数据库分类表的 seed 由同一模块生成，同样有防漂移测试。
- 旧数据通过从快照生成、审阅后执行的 SQL 迁移过来。

**Tech Stack:** TypeScript, Deno 2 (edge functions, `npm run test:deno`), Vite + vitest 4 (`npm test`), React 18, Supabase Postgres (migrations applied via Supabase MCP `apply_migration`), esbuild 0.18, tsx.

**Spec:** `docs/superpowers/specs/2026-09-22-cfp-financial-data-framework-design.md`（下称 spec）

---

## 执行前须知

1. **测试基线（2026-09-23）**：`npm test` → 29 files / 360 passed；`npm run test:deno` → 406 passed。每个任务结束时两条命令都要全绿。
2. **没有 Supabase CLI**。迁移通过 Supabase MCP `apply_migration` 执行，项目 `lqnnboepevcivcxvkoct`。**任何对线上数据库的写入、边缘函数部署、推送分支，都集中在 Task 13，执行前必须先得到用户确认。** Task 1–12 只改本地文件。
3. **共享模块的 import 规则**：
   - `supabase/functions/_shared/cashflow/periods.ts` 必须**零 import**（见它的文件头）。
   - taxonomy 目录内的文件可以互相 import，但必须写 `.ts` 扩展名。Deno、Vite/vitest（tsconfig 已开 `allowImportingTsExtensions`）、esbuild、tsx 都能解析这种写法。
   - 浏览器只 import `cashflow.ts` 和 `balance.ts`，这两个文件零 import。
   - 前端（`components/`、`pdf/`）import taxonomy 时**不写扩展名**，与现有 `periods` 的 import 方式一致。
4. **Vercel 函数**（`api/*.js`）不能直接 import `.ts`，只能 import 已提交的 `api/_lib/taxonomy.mjs`（Task 5）。任何 taxonomy 源码改动后都要运行 `node scripts/build-taxonomy.mjs`。
5. **与 spec 的一处刻意偏差**（Task 13 同步回 spec）：资产 code **沿用线上 enum 现有拼写**，即 `epf_account_1/2/3`、`bond`、`business`、`other`，只改显示名称。原因是 Postgres enum 改名会让所有已部署的读取方同时失效，而边缘函数和 Vercel 是分开部署的。`property` 保留为旧值，只用于旧数据；新数据用 `own_residence` / `investment_property`。
6. **"关联 ≠ 转移"**：从本计划起，一笔现金流是不是资产转移**只看分类**，不再看 `linked_asset_id`。线上目前 0 行带 link（2026-09-23 已查），所以这条改动不影响现有数据。

## 文件结构

**新建**
- `supabase/functions/_shared/taxonomy/cashflow.ts`：现金流科目、分组、旧 code 映射、查找函数（零 import）
- `supabase/functions/_shared/taxonomy/balance.ts`：资产类型/大类/流动性/退休资金/配置桶，负债类型（零 import）
- `supabase/functions/_shared/taxonomy/legacy.ts`：把旧数据、KYC 子项、LevelUp 标签归类到新 code（import 上面两个）
- `supabase/functions/_shared/taxonomy/index.ts`：打包入口
- `supabase/functions/_shared/taxonomy/cashflow.test.ts`、`balance.test.ts`、`legacy.test.ts`：Deno 测试
- `scripts/build-taxonomy.mjs` → 生成 `api/_lib/taxonomy.mjs`（提交）
- `scripts/build-category-seed.ts` → 生成 `supabase/migrations/20260923000002_cashflow_categories_seed.sql`（提交）
- `scripts/build-legacy-remap.ts` → 生成 `supabase/migrations/20260923000003_legacy_taxonomy_remap.sql`（提交）
- `scripts/__tests__/taxonomyBundle.test.ts`、`categorySeed.test.ts`、`legacyRemap.test.ts`：vitest 防漂移和单元测试
- `supabase/migrations/20260923000001_cfp_taxonomy_foundation.sql`：只做新增的 DDL
- `supabase/schema/live-core-tables.sql`：线上核心表结构参考快照（不是 migration）

**修改**
- `supabase/functions/_shared/cashflow/periods.ts`（+ `periods.cases.json`、`periods.test.ts`、`components/advisor/__tests__/cashflowPeriods.test.ts`）
- `supabase/functions/_shared/insurance/mapping.ts`
- `supabase/functions/cfp-brain/baseline.ts`、`modules/{retirement,investment,synthesis,tax,cashflow}/calc.ts` 及对应测试
- `pdf/cfpReport/labels/enums.ts`、`pdf/cfpReport/select/cashflow.ts` 及对应测试
- `components/advisor/tabs/CashflowTab.tsx`、`NetworthTab.tsx`、`components/advisor/components/HealthScoreCard.tsx`
- `supabase/scripts/backfill-health-snapshots.mjs`
- `api/kyc.js`、`api/levelUp.js`、`api/health.js`

---

### Task 1: 现金流科目表模块

**Files:**
- Create: `supabase/functions/_shared/taxonomy/cashflow.ts`
- Test: `supabase/functions/_shared/taxonomy/cashflow.test.ts`

- [ ] **Step 1: Write the failing test**

`supabase/functions/_shared/taxonomy/cashflow.test.ts`:

```ts
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  CASHFLOW_CATEGORIES,
  CASHFLOW_GROUPS,
  CATEGORY_BY_CODE,
  LEGACY_CATEGORY_MAP,
  TRANSFER_CATEGORY_CODES,
  categoryLabel,
  groupOf,
  resolveCategory,
  wealthEffectOf,
} from "./cashflow.ts";

Deno.test("codes are unique snake_case", () => {
  const codes = CASHFLOW_CATEGORIES.map((c) => c.code);
  assertEquals(new Set(codes).size, codes.length);
  for (const c of codes) assert(/^[a-z][a-z0-9_]*$/.test(c), c);
});

Deno.test("every group is populated and all but I4 have a catch-all", () => {
  const catchAll = (code: string) =>
    code.endsWith("_other") || code === "other_income" || code === "other_expense";
  for (const g of CASHFLOW_GROUPS) {
    const inGroup = CASHFLOW_CATEGORIES.filter((c) => c.group === g.id);
    assert(inGroup.length > 0, g.id);
    for (const c of inGroup) assertEquals(c.direction, g.direction, c.code);
    // I4 has no catch-all on purpose: a non-income inflow must be named.
    if (g.id !== "I4") assert(inGroup.some((c) => catchAll(c.code)), `${g.id} lacks a catch-all`);
  }
});

Deno.test("outflows carry fixed/variable; living costs (O4–O8) carry need/want", () => {
  for (const c of CASHFLOW_CATEGORIES) {
    if (c.direction === "outflow") assert(c.fixed_variable !== null, c.code);
    else assertEquals(c.fixed_variable, null, c.code);
    if (/^O[4-8]$/.test(c.group)) assert(c.need_want !== null, c.code);
    else assertEquals(c.need_want, null, c.code);
  }
});

Deno.test("wealth effects follow spec §1", () => {
  const fx = (code: string) => CATEGORY_BY_CODE[code].wealth_effect;
  assertEquals(fx("salary_basic"), "income");
  assertEquals(fx("rental_income"), "income");
  assertEquals(fx("policy_surrender_maturity"), "income");
  assertEquals(fx("asset_sale"), "transfer");
  assertEquals(fx("loan_drawdown"), "transfer");
  assertEquals(fx("unit_trust_contribution"), "transfer");
  assertEquals(fx("credit_card_payment"), "transfer");
  assertEquals(fx("mortgage_installment"), "split");
  assertEquals(fx("finance_charges"), "expense");
  assertEquals(fx("share_margin_interest"), "expense");
  assertEquals(fx("savings_plan_premium"), "expense");
  assertEquals(fx("groceries"), "expense");
});

Deno.test("legacy codes resolve to current categories", () => {
  for (const [legacy, current] of Object.entries(LEGACY_CATEGORY_MAP)) {
    assert(CATEGORY_BY_CODE[current], `${legacy} → ${current} is not a category`);
    assert(!CATEGORY_BY_CODE[legacy], `${legacy} is still a live code`);
    assertEquals(resolveCategory(legacy)?.code, current);
  }
  assertEquals(resolveCategory("nonsense"), null);
  assertEquals(resolveCategory(null), null);
  assertEquals(resolveCategory(undefined), null);
});

Deno.test("wealthEffectOf falls back by direction for unknown codes", () => {
  assertEquals(wealthEffectOf("nonsense", "inflow"), "income");
  assertEquals(wealthEffectOf("nonsense", "outflow"), "expense");
  assertEquals(wealthEffectOf("investment_contribution", "outflow"), "transfer");
});

Deno.test("labels and groups", () => {
  assertEquals(categoryLabel("groceries", "zh"), "杂货/菜市");
  assertEquals(categoryLabel("household", "en"), "Other daily living");
  assertEquals(categoryLabel("mystery", "zh"), "mystery");
  assertEquals(categoryLabel(null, "zh"), "");
  assertEquals(groupOf("rental_income")?.id, "I2");
  assertEquals(groupOf("dividend")?.id, "I2");
  assertEquals(groupOf("mystery"), null);
});

Deno.test("transfer list = transfer categories + legacy aliases, sorted", () => {
  assert(TRANSFER_CATEGORY_CODES.includes("investment_contribution"));
  assert(TRANSFER_CATEGORY_CODES.includes("credit_card_payment"));
  assert(TRANSFER_CATEGORY_CODES.includes("asset_sale"));
  assert(!TRANSFER_CATEGORY_CODES.includes("mortgage_installment"));
  assert(!TRANSFER_CATEGORY_CODES.includes("rental_income"));
  assertEquals([...TRANSFER_CATEGORY_CODES], [...TRANSFER_CATEGORY_CODES].sort());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --no-check --allow-env supabase/functions/_shared/taxonomy/cashflow.test.ts`
Expected: FAIL — `Module not found "file:///…/taxonomy/cashflow.ts"`

- [ ] **Step 3: Write the module**

`supabase/functions/_shared/taxonomy/cashflow.ts`:

```ts
// 现金流会计科目表 — spec 2026-09-22 §3.0–3.2
// (docs/superpowers/specs/2026-09-22-cfp-financial-data-framework-design.md)
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS FILE MUST HAVE NO IMPORTS — the same contract as ../cashflow/periods.ts.
// It is loaded by Deno edge functions, the Vite browser bundle, tsx scripts,
// and (through the committed api/_lib/taxonomy.mjs bundle) Vercel functions.
// ─────────────────────────────────────────────────────────────────────────────
//
// Every category carries a WEALTH EFFECT — what the money does to net worth:
//   income    net worth up          salary, rent, dividends
//   expense   net worth down        food, utilities, interest, premiums
//   transfer  net worth unchanged   savings → FD / fund / gold, selling shares,
//                                   EPF withdrawal, loan drawdown, card repayment
//   split     loan installment      principal is a transfer, interest an expense.
//                                   Until the P2 estimator splits it, the whole
//                                   installment still counts as spending.
//
// `link_to` names the object a row SHOULD be linked to (asset / liability /
// policy) so an asset's own cash flow can be summed. It does NOT decide whether
// a row is a transfer — the category does. Rental income linked to its condo is
// still income.

export type CashflowDirection = "inflow" | "outflow";
export type WealthEffect = "income" | "expense" | "transfer" | "split";
export type Recurrence = "recurring" | "irregular" | "one_off";
export type FixedVariable = "fixed" | "variable";
export type NeedWant = "need" | "want";
export type LinkTo = "asset" | "liability" | "policy" | "none";
export type CashflowGroupId =
  | "I1" | "I2" | "I3" | "I4"
  | "O1" | "O2" | "O3" | "O4" | "O5" | "O6" | "O7" | "O8" | "O9" | "O10";

export interface CashflowGroup {
  id: CashflowGroupId;
  direction: CashflowDirection;
  label_zh: string;
  label_en: string;
}

export interface CashflowCategory {
  code: string;
  label_zh: string;
  label_en: string;
  direction: CashflowDirection;
  group: CashflowGroupId;
  wealth_effect: WealthEffect;
  recurrence: Recurrence;
  /** outflows only */
  fixed_variable: FixedVariable | null;
  /** living costs (O4–O8) only */
  need_want: NeedWant | null;
  link_to: LinkTo;
  /** produced from a liability / policy / salary (P2); never keyed by hand then */
  auto_generated: boolean;
}

export const CASHFLOW_GROUPS: readonly CashflowGroup[] = [
  { id: "I1", direction: "inflow", label_zh: "主动收入", label_en: "Active income" },
  { id: "I2", direction: "inflow", label_zh: "被动收入", label_en: "Passive income" },
  { id: "I3", direction: "inflow", label_zh: "其他收入", label_en: "Other income" },
  { id: "I4", direction: "inflow", label_zh: "非收入流入", label_en: "Non-income inflows" },
  { id: "O1", direction: "outflow", label_zh: "储蓄与投资", label_en: "Saving & investing" },
  { id: "O2", direction: "outflow", label_zh: "债务偿还", label_en: "Debt service" },
  { id: "O3", direction: "outflow", label_zh: "保障", label_en: "Protection" },
  { id: "O4", direction: "outflow", label_zh: "住房", label_en: "Housing" },
  { id: "O5", direction: "outflow", label_zh: "交通", label_en: "Transport" },
  { id: "O6", direction: "outflow", label_zh: "日常生活", label_en: "Daily living" },
  { id: "O7", direction: "outflow", label_zh: "家庭与教育", label_en: "Family & education" },
  { id: "O8", direction: "outflow", label_zh: "生活方式", label_en: "Lifestyle" },
  { id: "O9", direction: "outflow", label_zh: "税务·宗教·人情", label_en: "Tax, religious & social" },
  { id: "O10", direction: "outflow", label_zh: "其他", label_en: "Other" },
];

type Traits = Pick<
  CashflowCategory,
  "wealth_effect" | "recurrence" | "fixed_variable" | "need_want" | "link_to" | "auto_generated"
>;

const GROUP_DEFAULTS: Record<CashflowGroupId, Traits> = {
  I1: { wealth_effect: "income", recurrence: "recurring", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  I2: { wealth_effect: "income", recurrence: "recurring", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  I3: { wealth_effect: "income", recurrence: "one_off", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  I4: { wealth_effect: "transfer", recurrence: "one_off", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  O1: { wealth_effect: "transfer", recurrence: "recurring", fixed_variable: "fixed", need_want: null, link_to: "asset", auto_generated: false },
  O2: { wealth_effect: "split", recurrence: "recurring", fixed_variable: "fixed", need_want: null, link_to: "liability", auto_generated: true },
  O3: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: "fixed", need_want: null, link_to: "policy", auto_generated: true },
  O4: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  O5: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  O6: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: "variable", need_want: null, link_to: "none", auto_generated: false },
  O7: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  O8: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: "variable", need_want: "want", link_to: "none", auto_generated: false },
  O9: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  O10: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: "variable", need_want: null, link_to: "none", auto_generated: false },
};

type Row = [code: string, label_zh: string, label_en: string, group: CashflowGroupId, overrides?: Partial<Traits>];

const ROWS: readonly Row[] = [
  // I1 主动收入
  ["salary_basic", "基本薪水", "Basic salary (gross)", "I1"],
  ["fixed_allowance", "固定津贴", "Fixed allowance", "I1"],
  ["overtime", "加班费", "Overtime pay", "I1"],
  ["bonus", "花红/奖金", "Bonus", "I1", { recurrence: "irregular" }],
  ["commission", "佣金/介绍费", "Commission / referral fee", "I1"],
  ["director_fee", "董事费/顾问费/专业费", "Director / advisory / professional fee", "I1"],
  ["business_income", "生意/自雇净收入", "Business / self-employed net income", "I1"],
  ["side_income", "副业/兼职", "Side income", "I1"],
  ["employer_epf", "雇主公积金供款", "Employer EPF contribution", "I1", { link_to: "asset", auto_generated: true }],
  ["active_income_other", "其他主动收入", "Other active income", "I1"],
  // I2 被动收入
  ["rental_income", "租金收入", "Rental income", "I2", { link_to: "asset" }],
  ["dividend_company", "自家公司股息", "Dividend from own company", "I2", { link_to: "asset" }],
  ["dividend_investment", "投资股息/基金派息", "Investment dividend / distribution", "I2", { link_to: "asset" }],
  ["interest_income", "利息收入", "Interest income", "I2", { link_to: "asset" }],
  ["royalty", "版税/授权费", "Royalty / licensing", "I2"],
  ["pension_annuity", "退休金/年金", "Pension / annuity", "I2"],
  ["policy_cash_payout", "保单生存金/现金红利", "Policy cash payout / survival benefit", "I2", { link_to: "policy" }],
  ["passive_income_other", "其他被动收入", "Other passive income", "I2"],
  // I3 其他收入 (non-recurring: kept out of recurring-income ratios)
  ["government_aid", "政府援助", "Government aid (STR etc.)", "I3"],
  ["family_support_in", "家人给的生活费", "Family support received", "I3", { recurrence: "recurring" }],
  ["gift_inheritance", "赠与/遗产", "Gift / inheritance", "I3"],
  ["insurance_claim", "保险理赔", "Insurance claim payout", "I3", { link_to: "policy" }],
  ["policy_surrender_maturity", "保单退保/满期所得", "Policy surrender / maturity proceeds", "I3", { link_to: "policy" }],
  ["tax_refund", "退税", "Tax refund", "I3"],
  ["other_income", "其他收入", "Other income", "I3"],
  // I4 非收入流入
  ["asset_sale", "出售资产所得", "Asset sale proceeds", "I4", { link_to: "asset" }],
  ["savings_withdrawal", "从储蓄/定存/投资提取", "Withdrawal from savings / FD / investments", "I4", { link_to: "asset" }],
  ["epf_withdrawal", "公积金提取", "EPF withdrawal", "I4", { link_to: "asset" }],
  ["loan_drawdown", "贷款拨款", "Loan drawdown", "I4", { link_to: "liability" }],
  ["borrowing_family", "向亲友借钱", "Borrowing from family / friends", "I4", { link_to: "liability" }],
  // O1 储蓄与投资
  ["to_savings", "转入储蓄/紧急基金", "Transfer to savings / emergency fund", "O1"],
  ["fd_placement", "存定期", "Fixed deposit placement", "O1"],
  ["unit_trust_contribution", "单位信托供款", "Unit trust contribution", "O1"],
  ["stock_etf_purchase", "股票/ETF 买入", "Stock / ETF purchase", "O1", { fixed_variable: "variable" }],
  ["asnb_contribution", "ASB/ASNB 存入", "ASB / ASNB contribution", "O1"],
  ["tabung_haji", "朝圣基金存入", "Tabung Haji deposit", "O1"],
  ["gold_purchase", "黄金/贵金属", "Gold / precious metals", "O1", { fixed_variable: "variable" }],
  ["crypto_purchase", "加密货币", "Crypto purchase", "O1", { fixed_variable: "variable" }],
  ["prs_contribution", "PRS 供款", "PRS contribution", "O1"],
  ["epf_voluntary", "EPF 自愿供款", "EPF voluntary contribution (i-Saraan)", "O1"],
  ["epf_employee", "雇员 EPF 供款", "Employee EPF contribution", "O1", { auto_generated: true }],
  ["sspn", "SSPN 教育储蓄", "SSPN education savings", "O1"],
  ["business_capital", "注资生意", "Business capital injection", "O1", { recurrence: "one_off", fixed_variable: "variable" }],
  ["lend_out", "借钱给别人", "Lending to others", "O1", { recurrence: "one_off", fixed_variable: "variable" }],
  ["asset_purchase", "购置资产首付/全款", "Asset purchase / down payment", "O1", { recurrence: "one_off", fixed_variable: "variable" }],
  ["investment_other", "其他储蓄投资", "Other saving & investing", "O1"],
  // O2 债务偿还
  ["mortgage_installment", "房贷月供", "Mortgage installment", "O2"],
  ["car_installment", "车贷月供", "Car loan (hire purchase) installment", "O2"],
  ["personal_loan_installment", "个人贷款月供", "Personal loan installment", "O2"],
  ["study_loan_installment", "教育贷款月供", "Study loan (PTPTN) installment", "O2"],
  ["renovation_loan_installment", "装修贷款月供", "Renovation loan installment", "O2"],
  ["asb_financing_installment", "ASB 贷款月供", "ASB financing installment", "O2"],
  ["business_loan_installment", "生意贷款月供", "Business loan installment", "O2"],
  ["bnpl_payment", "先买后付还款", "BNPL payment", "O2"],
  ["family_loan_repayment", "还亲友借款", "Family / friend loan repayment", "O2"],
  ["debt_other", "其他还款", "Other debt repayment", "O2", { auto_generated: false }],
  ["credit_card_payment", "信用卡还款", "Credit card payment", "O2", { wealth_effect: "transfer", fixed_variable: "variable", auto_generated: false }],
  ["finance_charges", "利息/逾期费/银行手续费", "Finance charges", "O2", { wealth_effect: "expense", fixed_variable: "variable", auto_generated: false }],
  ["share_margin_interest", "股票融资利息", "Share margin interest", "O2", { wealth_effect: "expense", fixed_variable: "variable", auto_generated: false }],
  // O3 保障 (all premiums are spending — D3)
  ["life_takaful", "人寿/家庭保障", "Life / family takaful", "O3"],
  ["medical_card", "医药卡", "Medical card", "O3"],
  ["critical_illness", "危疾", "Critical illness", "O3"],
  ["personal_accident", "个人意外", "Personal accident", "O3"],
  ["savings_plan_premium", "储蓄型/投资型保单保费", "Savings / investment-linked plan premium", "O3"],
  ["protection_other", "其他保费", "Other premiums", "O3", { auto_generated: false }],
  // O4 住房
  ["rent", "房租", "Rent", "O4", { fixed_variable: "fixed", need_want: "need" }],
  ["maintenance_fee", "管理费+偿债基金", "Maintenance fee & sinking fund", "O4", { fixed_variable: "fixed", need_want: "need", link_to: "asset" }],
  ["quit_rent_assessment", "地税/门牌税", "Quit rent & assessment tax", "O4", { fixed_variable: "fixed", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["home_insurance", "房屋火险", "Houseowner / fire insurance", "O4", { fixed_variable: "fixed", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["utilities", "水电/排污/燃气", "Utilities", "O4", { fixed_variable: "variable", need_want: "need" }],
  ["telco", "电话/网络/电视/串流", "Phone, internet, TV & streaming", "O4", { fixed_variable: "fixed", need_want: "need" }],
  ["home_repair", "房屋维修保养", "Home repair & upkeep", "O4", { fixed_variable: "variable", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["household_help", "女佣薪水/准证", "Domestic helper salary & levy", "O4", { fixed_variable: "fixed", need_want: "want" }],
  ["housing_other", "其他住房开销", "Other housing", "O4", { fixed_variable: "variable", need_want: "need" }],
  // O5 交通
  ["fuel", "油费", "Fuel", "O5", { fixed_variable: "variable", need_want: "need", link_to: "asset" }],
  ["toll_parking", "过路费/停车", "Tolls & parking", "O5", { fixed_variable: "variable", need_want: "need" }],
  ["public_transport_ehailing", "公共交通/Grab", "Public transport & e-hailing", "O5", { fixed_variable: "variable", need_want: "need" }],
  ["road_tax", "路税", "Road tax", "O5", { fixed_variable: "fixed", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["motor_insurance", "汽车保险", "Motor insurance", "O5", { fixed_variable: "fixed", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["car_service_repair", "保养维修", "Car servicing & repair", "O5", { fixed_variable: "variable", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["transport_other", "其他交通", "Other transport", "O5", { fixed_variable: "variable", need_want: "need" }],
  // O6 日常生活
  ["groceries", "杂货/菜市", "Groceries", "O6", { need_want: "need" }],
  ["dining_out", "外食/外卖", "Dining out & delivery", "O6", { need_want: "want" }],
  ["personal_care", "个人护理/理发/美容", "Personal care", "O6", { need_want: "need" }],
  ["clothing", "服装", "Clothing", "O6", { need_want: "want" }],
  ["health_medical", "看病/药物/牙科/眼科", "Medical, dental & optical (out of pocket)", "O6", { need_want: "need" }],
  ["fitness", "健身/运动", "Fitness & sports", "O6", { need_want: "want" }],
  ["living_other", "其他日常", "Other daily living", "O6", { need_want: "need" }],
  // O7 家庭与教育
  ["childcare", "托儿/保姆", "Childcare", "O7", { fixed_variable: "fixed", need_want: "need" }],
  ["school_fees", "学费", "School fees", "O7", { fixed_variable: "fixed", need_want: "need" }],
  ["tuition_enrichment", "补习/才艺班", "Tuition & enrichment", "O7", { fixed_variable: "fixed", need_want: "want" }],
  ["child_expenses", "孩子日常开销", "Children's daily expenses", "O7", { fixed_variable: "variable", need_want: "need" }],
  ["parents_allowance", "父母生活费", "Allowance to parents", "O7", { fixed_variable: "fixed", need_want: "need" }],
  ["other_dependants", "其他受养人", "Other dependants", "O7", { fixed_variable: "fixed", need_want: "need" }],
  ["self_education", "自我进修", "Self-education", "O7", { fixed_variable: "variable", need_want: "want" }],
  ["pet_care", "宠物", "Pet care", "O7", { fixed_variable: "variable", need_want: "want" }],
  ["family_other", "其他家庭开销", "Other family", "O7", { fixed_variable: "variable", need_want: "need" }],
  // O8 生活方式
  ["entertainment", "娱乐", "Entertainment", "O8"],
  ["travel", "旅游", "Travel", "O8", { recurrence: "irregular" }],
  ["hobbies", "兴趣爱好", "Hobbies", "O8"],
  ["subscriptions", "订阅服务", "Subscriptions", "O8", { fixed_variable: "fixed" }],
  ["shopping_gadgets", "购物/电子产品", "Shopping & gadgets", "O8"],
  ["lifestyle_other", "其他生活方式", "Other lifestyle", "O8"],
  // O9 税务·宗教·人情
  ["income_tax", "所得税", "Income tax (PCB / CP500)", "O9", { fixed_variable: "fixed" }],
  ["socso_eis", "SOCSO/EIS", "SOCSO / EIS", "O9", { fixed_variable: "fixed", auto_generated: true }],
  ["zakat_tithe", "天课/什一奉献", "Zakat / tithe", "O9", { fixed_variable: "fixed" }],
  ["donations", "捐款/慈善", "Donations & charity", "O9", { fixed_variable: "variable" }],
  ["festive_angpao", "节庆红包", "Festive ang pao / duit raya", "O9", { fixed_variable: "variable", recurrence: "irregular" }],
  ["gifts_social", "礼物/红白包", "Gifts & social obligations", "O9", { fixed_variable: "variable" }],
  ["obligation_other", "其他义务", "Other obligations", "O9", { fixed_variable: "variable" }],
  // O10 其他
  ["professional_fees", "专业服务费", "Professional fees", "O10"],
  ["other_expense", "其他支出", "Other expense", "O10"],
];

const GROUP_BY_ID = Object.fromEntries(
  CASHFLOW_GROUPS.map((g) => [g.id, g]),
) as Record<CashflowGroupId, CashflowGroup>;

function build([code, label_zh, label_en, group, overrides = {}]: Row): CashflowCategory {
  const g = GROUP_BY_ID[group];
  const t: Traits = { ...GROUP_DEFAULTS[group], ...overrides };
  return {
    code,
    label_zh,
    label_en,
    direction: g.direction,
    group,
    wealth_effect: t.wealth_effect,
    recurrence: t.recurrence,
    fixed_variable: g.direction === "outflow" ? t.fixed_variable : null,
    need_want: /^O[4-8]$/.test(group) ? t.need_want : null,
    link_to: t.link_to,
    auto_generated: t.auto_generated,
  };
}

export const CASHFLOW_CATEGORIES: readonly CashflowCategory[] = ROWS.map(build);

export const CATEGORY_BY_CODE: Readonly<Record<string, CashflowCategory>> = Object.fromEntries(
  CASHFLOW_CATEGORIES.map((c) => [c.code, c]),
);

/**
 * Codes the live cashflow_categories table held before 2026-09-23 that are no
 * longer offered, and the category each is now read as. Codes that survived
 * unchanged (bonus, commission, director_fee, rental_income, other_income,
 * other_expense) are ordinary categories and need no entry here.
 */
export const LEGACY_CATEGORY_MAP: Readonly<Record<string, string>> = {
  salary: "salary_basic",
  dividend: "dividend_company",
  investment_return: "dividend_investment",
  household: "living_other",
  transportation: "transport_other",
  dependants: "family_other",
  personal: "lifestyle_other",
  insurance_premium: "protection_other",
  loan_repayment: "debt_other",
  investment_contribution: "investment_other",
  tax: "income_tax",
  property_expense: "housing_other",
  property_maintenance: "maintenance_fee",
  miscellaneous: "other_expense",
};

/** The category a stored code means today — current or legacy — or null. */
export function resolveCategory(code: string | null | undefined): CashflowCategory | null {
  if (!code) return null;
  return CATEGORY_BY_CODE[code] ?? CATEGORY_BY_CODE[LEGACY_CATEGORY_MAP[code] ?? ""] ?? null;
}

/** Unknown codes read as plain income / spending, the pre-taxonomy behaviour. */
export function wealthEffectOf(
  code: string | null | undefined,
  direction: CashflowDirection,
): WealthEffect {
  return resolveCategory(code)?.wealth_effect ?? (direction === "inflow" ? "income" : "expense");
}

/** Display label; an unknown code falls back to itself rather than a blank. */
export function categoryLabel(code: string | null | undefined, lang: "zh" | "en"): string {
  const c = resolveCategory(code);
  if (!c) return code ?? "";
  return lang === "zh" ? c.label_zh : c.label_en;
}

export function groupOf(code: string | null | undefined): CashflowGroup | null {
  const c = resolveCategory(code);
  return c ? GROUP_BY_ID[c.group] : null;
}

export function categoriesOf(group: CashflowGroupId): CashflowCategory[] {
  return CASHFLOW_CATEGORIES.filter((c) => c.group === group);
}

/**
 * Every stored code — current or legacy — whose money stays the client's own.
 * ../cashflow/periods.ts keeps an inline copy because it may not import; a test
 * there pins the two lists together.
 */
export const TRANSFER_CATEGORY_CODES: readonly string[] = [
  ...CASHFLOW_CATEGORIES.filter((c) => c.wealth_effect === "transfer").map((c) => c.code),
  ...Object.keys(LEGACY_CATEGORY_MAP).filter(
    (k) => CATEGORY_BY_CODE[LEGACY_CATEGORY_MAP[k]].wealth_effect === "transfer",
  ),
].sort();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --no-check --allow-env supabase/functions/_shared/taxonomy/cashflow.test.ts`
Expected: PASS — `ok | 8 passed | 0 failed`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/taxonomy/cashflow.ts supabase/functions/_shared/taxonomy/cashflow.test.ts
git commit -m "feat(taxonomy): cash-flow chart of accounts with wealth effects"
```

---

### Task 2: 资产与负债分类模块

**Files:**
- Create: `supabase/functions/_shared/taxonomy/balance.ts`
- Test: `supabase/functions/_shared/taxonomy/balance.test.ts`

- [ ] **Step 1: Write the failing test**

`supabase/functions/_shared/taxonomy/balance.test.ts`:

```ts
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  ASSET_TYPES,
  EPF_ASSET_TYPES,
  LIABILITY_TYPES,
  LIQUID_ASSET_TYPES,
  allocationBucketOf,
  assetClassOf,
  assetTypeLabel,
  assetTypeMeta,
  isLiquid,
  isRetirementCapital,
  liabilityTypeLabel,
  liquidityLevel,
} from "./balance.ts";
import { CATEGORY_BY_CODE } from "./cashflow.ts";

// The live Postgres enums on 2026-09-23. Every one must still resolve.
const LIVE_ASSET_ENUM = [
  "savings", "fixed_deposit", "money_market", "epf_account_1", "epf_account_2",
  "epf_account_3", "unit_trust", "stock", "bond", "etf", "property", "vehicle",
  "business", "other",
];
const LIVE_LIABILITY_ENUM = [
  "mortgage", "car_loan", "personal_loan", "study_loan", "renovation_loan",
  "credit_card", "business_loan", "other",
];

Deno.test("every live enum value is still a known type", () => {
  for (const t of LIVE_ASSET_ENUM) assert(assetTypeMeta(t), t);
  for (const t of LIVE_LIABILITY_ENUM) assert(LIABILITY_TYPES.some((l) => l.code === t), t);
});

Deno.test("codes are unique", () => {
  const a = ASSET_TYPES.map((x) => x.code);
  assertEquals(new Set(a).size, a.length);
  const l = LIABILITY_TYPES.map((x) => x.code);
  assertEquals(new Set(l).size, l.length);
});

Deno.test("class A is exactly the liquid set", () => {
  assertEquals(
    [...LIQUID_ASSET_TYPES].sort(),
    ["cash_on_hand", "ewallet", "fixed_deposit", "foreign_currency", "money_market", "savings"],
  );
  for (const t of LIQUID_ASSET_TYPES) {
    assert(isLiquid(t), t);
    assertEquals(liquidityLevel(t), "high");
  }
  assert(!isLiquid("stock"));
  assertEquals(liquidityLevel("stock"), "medium");
  assertEquals(liquidityLevel("own_residence"), "low");
  assertEquals(liquidityLevel("mystery"), "low");
});

Deno.test("classes and purposes", () => {
  assertEquals(assetClassOf("epf_account_1"), "B");
  assertEquals(assetClassOf("investment_property"), "C");
  assertEquals(assetClassOf("own_residence"), "D");
  assertEquals(assetClassOf("property"), "D");
  assertEquals(assetClassOf("mystery"), "D");
  assertEquals(assetTypeMeta("vehicle")?.default_purpose, "personal_use");
  assertEquals(assetTypeMeta("investment_property")?.default_purpose, "income_producing");
  assertEquals(assetTypeMeta("property")?.offered, false);
});

Deno.test("retirement capital: B plus drawable C, never property or the home", () => {
  for (const t of EPF_ASSET_TYPES) assert(isRetirementCapital(t), t);
  for (const t of ["prs", "stock", "etf", "unit_trust", "bond", "reit", "asnb", "gold"]) {
    assert(isRetirementCapital(t), t);
  }
  for (const t of ["investment_property", "land", "business", "sspn", "other", "own_residence", "vehicle", "savings"]) {
    assert(!isRetirementCapital(t), t);
  }
});

Deno.test("allocation buckets keep today's equity/bond/alternatives split", () => {
  assertEquals(allocationBucketOf("stock"), "equity");
  assertEquals(allocationBucketOf("unit_trust"), "equity");
  assertEquals(allocationBucketOf("bond"), "bond");
  assertEquals(allocationBucketOf("business"), "alternatives");
  assertEquals(allocationBucketOf("gold"), "alternatives");
  assertEquals(allocationBucketOf("own_residence"), null);
  assertEquals(allocationBucketOf("other"), null);
});

Deno.test("every liability installment category exists in the cash-flow taxonomy", () => {
  for (const l of LIABILITY_TYPES) {
    if (l.installment_category) assert(CATEGORY_BY_CODE[l.installment_category], `${l.code} → ${l.installment_category}`);
  }
});

Deno.test("labels", () => {
  assertEquals(assetTypeLabel("epf_account_1", "zh"), "公积金 退休户口");
  assertEquals(assetTypeLabel("epf_account_1", "en"), "EPF Akaun Persaraan");
  assertEquals(assetTypeLabel("mystery", "en"), "mystery");
  assertEquals(liabilityTypeLabel("mortgage", "zh"), "房屋贷款");
  assertEquals(liabilityTypeLabel("mystery", "zh"), "mystery");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --no-check --allow-env supabase/functions/_shared/taxonomy/balance.test.ts`
Expected: FAIL — module `./balance.ts` not found

- [ ] **Step 3: Write the module**

`supabase/functions/_shared/taxonomy/balance.ts`:

```ts
// 资产与负债分类 — spec 2026-09-22 §3.3–3.4, §5.4.
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS FILE MUST HAVE NO IMPORTS (see cashflow.ts).
// ─────────────────────────────────────────────────────────────────────────────
//
// Codes keep the live `asset_type` / `liability_type` enum spellings wherever the
// meaning did not change (epf_account_1, bond, business, other): renaming a
// Postgres enum value breaks every deployed reader at the same instant, and the
// edge functions and Vercel ship separately. Only the labels moved.
//
// `property` survives solely so rows written before 2026-09-23 still resolve —
// it is read as a personal-use asset (the conservative reading) until an
// advisor confirms it. New rows use own_residence / investment_property.

export type AssetClass = "A" | "B" | "C" | "D";
export type AssetPurpose = "personal_use" | "income_producing" | "investment";
export type Liquidity = "liquid" | "semi" | "illiquid";
export type LiquidityLevel = "high" | "medium" | "low";
export type AllocationBucket = "equity" | "bond" | "alternatives";
export type LiabilityTerm = "short" | "long";

export interface AssetClassMeta {
  id: AssetClass;
  label_zh: string;
  label_en: string;
}

export const ASSET_CLASSES: readonly AssetClassMeta[] = [
  { id: "A", label_zh: "流动资产", label_en: "Liquid assets" },
  { id: "B", label_zh: "退休专户", label_en: "Retirement accounts" },
  { id: "C", label_zh: "投资资产", label_en: "Investment assets" },
  { id: "D", label_zh: "自用资产", label_en: "Personal-use assets" },
];

export interface AssetTypeMeta {
  code: string;
  label_zh: string;
  label_en: string;
  class: AssetClass;
  /** null for A/B: purpose only matters where holding reasons differ */
  default_purpose: AssetPurpose | null;
  liquidity: Liquidity;
  /**
   * Counts toward retirement capital (spec §5.4): class B plus the class C
   * holdings that can actually be drawn down. Investment property contributes
   * its net rent as an income stream instead (P3), and land, business equity,
   * receivables, SSPN (earmarked for education) and unidentified `other` are
   * left out rather than guessed at.
   */
  retirement_capital: boolean;
  /** the investment module's allocation bucket; null = outside the portfolio */
  allocation: AllocationBucket | null;
  /** offered when adding a new asset; false = legacy spelling kept for old rows */
  offered: boolean;
}

type AssetRow = [
  code: string, label_zh: string, label_en: string, cls: AssetClass,
  purpose: AssetPurpose | null, liquidity: Liquidity, retirement: boolean,
  allocation: AllocationBucket | null, offered?: boolean,
];

const ASSET_ROWS: readonly AssetRow[] = [
  // A 流动资产
  ["savings", "储蓄/往来户口", "Savings / current account", "A", null, "liquid", false, null],
  ["fixed_deposit", "定期存款", "Fixed deposit", "A", null, "liquid", false, null],
  ["money_market", "货币市场基金", "Money market fund", "A", null, "liquid", false, null],
  ["cash_on_hand", "现金", "Cash on hand", "A", null, "liquid", false, null],
  ["ewallet", "电子钱包", "E-wallet", "A", null, "liquid", false, null],
  ["foreign_currency", "外币存款", "Foreign currency deposit", "A", null, "liquid", false, null],
  // B 退休专户
  ["epf_account_1", "公积金 退休户口", "EPF Akaun Persaraan", "B", null, "illiquid", true, null],
  ["epf_account_2", "公积金 福利户口", "EPF Akaun Sejahtera", "B", null, "illiquid", true, null],
  ["epf_account_3", "公积金 灵活户口", "EPF Akaun Fleksibel", "B", null, "illiquid", true, null],
  ["prs", "私人退休计划 PRS", "Private Retirement Scheme", "B", null, "illiquid", true, null],
  // C 投资资产
  ["stock", "股票", "Stocks", "C", "investment", "semi", true, "equity"],
  ["etf", "ETF", "ETF", "C", "investment", "semi", true, "equity"],
  ["unit_trust", "单位信托", "Unit trust", "C", "investment", "semi", true, "equity"],
  ["reit", "房地产投资信托", "REIT", "C", "income_producing", "semi", true, "equity"],
  ["bond", "债券/伊斯兰债券", "Bond / sukuk", "C", "investment", "illiquid", true, "bond"],
  ["asnb", "ASB/ASNB", "ASNB (ASB / ASM)", "C", "investment", "semi", true, "bond"],
  ["tabung_haji", "朝圣基金", "Tabung Haji", "C", "investment", "illiquid", true, "bond"],
  ["gold", "黄金/贵金属", "Gold / precious metals", "C", "investment", "illiquid", true, "alternatives"],
  ["crypto", "加密货币", "Crypto", "C", "investment", "illiquid", true, "alternatives"],
  ["forex", "外汇", "Forex", "C", "investment", "illiquid", true, "alternatives"],
  ["investment_property", "投资房产", "Investment property", "C", "income_producing", "illiquid", false, null],
  ["land", "土地", "Land", "C", "investment", "illiquid", false, null],
  ["business", "企业股权", "Business equity", "C", "investment", "illiquid", false, "alternatives"],
  ["receivable", "借出的钱", "Loan receivable", "C", "investment", "illiquid", false, null],
  ["sspn", "SSPN 教育储蓄", "SSPN", "C", "investment", "illiquid", false, null],
  ["other", "其他投资资产", "Other investment asset", "C", "investment", "illiquid", false, null],
  // D 自用资产
  ["own_residence", "自住房", "Own residence", "D", "personal_use", "illiquid", false, null],
  ["vehicle", "车", "Vehicle", "D", "personal_use", "illiquid", false, null],
  ["jewelry", "珠宝", "Jewelry", "D", "personal_use", "illiquid", false, null],
  ["collectibles", "收藏品", "Collectibles", "D", "personal_use", "illiquid", false, null],
  ["personal_asset_other", "其他自用资产", "Other personal-use asset", "D", "personal_use", "illiquid", false, null],
  ["property", "房产（待确认用途）", "Property (purpose unconfirmed)", "D", "personal_use", "illiquid", false, null, false],
];

export const ASSET_TYPES: readonly AssetTypeMeta[] = ASSET_ROWS.map(
  ([code, label_zh, label_en, cls, purpose, liquidity, retirement, allocation, offered = true]) => ({
    code,
    label_zh,
    label_en,
    class: cls,
    default_purpose: purpose,
    liquidity,
    retirement_capital: retirement,
    allocation,
    offered,
  }),
);

const ASSET_BY_CODE: Readonly<Record<string, AssetTypeMeta>> = Object.fromEntries(
  ASSET_TYPES.map((a) => [a.code, a]),
);

export const EPF_ASSET_TYPES: readonly string[] = ["epf_account_1", "epf_account_2", "epf_account_3"];

/** Emergency-fund-eligible: class A. */
export const LIQUID_ASSET_TYPES: readonly string[] = ASSET_TYPES
  .filter((a) => a.class === "A")
  .map((a) => a.code);

export function assetTypeMeta(code: string | null | undefined): AssetTypeMeta | null {
  return code ? ASSET_BY_CODE[code] ?? null : null;
}

/** Unknown types count nowhere, so they fall into D (personal use). */
export function assetClassOf(code: string | null | undefined): AssetClass {
  return assetTypeMeta(code)?.class ?? "D";
}

export function isLiquid(code: string | null | undefined): boolean {
  return assetClassOf(code) === "A";
}

/** The value to store in assets.liquidity (the liquidity_level enum). */
export function liquidityLevel(code: string | null | undefined): LiquidityLevel {
  const l = assetTypeMeta(code)?.liquidity ?? "illiquid";
  return l === "liquid" ? "high" : l === "semi" ? "medium" : "low";
}

export function isRetirementCapital(code: string | null | undefined): boolean {
  return assetTypeMeta(code)?.retirement_capital ?? false;
}

export function allocationBucketOf(code: string | null | undefined): AllocationBucket | null {
  return assetTypeMeta(code)?.allocation ?? null;
}

export function assetTypeLabel(code: string | null | undefined, lang: "zh" | "en"): string {
  const a = assetTypeMeta(code);
  if (!a) return code ?? "";
  return lang === "zh" ? a.label_zh : a.label_en;
}

export interface LiabilityTypeMeta {
  code: string;
  label_zh: string;
  label_en: string;
  term: LiabilityTerm;
  /** revolving consumer debt — the report highlights these as 高息负债 */
  high_interest: boolean;
  /** secured against an asset */
  secured: boolean;
  /** the O2 cash-flow category its repayment belongs to (auto-generated in P2) */
  installment_category: string | null;
}

type LiabilityRow = [
  code: string, label_zh: string, label_en: string, term: LiabilityTerm,
  high_interest: boolean, secured: boolean, installment_category: string | null,
];

const LIABILITY_ROWS: readonly LiabilityRow[] = [
  ["credit_card", "信用卡欠款", "Credit card balance", "short", true, false, "credit_card_payment"],
  ["bnpl", "先买后付", "Buy now, pay later", "short", true, false, "bnpl_payment"],
  ["overdraft", "透支", "Overdraft", "short", true, false, "finance_charges"],
  ["tax_payable", "应缴税款", "Tax payable", "short", false, false, "income_tax"],
  ["family_loan", "亲友借款", "Loan from family / friends", "short", false, false, "family_loan_repayment"],
  ["mortgage", "房屋贷款", "Mortgage", "long", false, true, "mortgage_installment"],
  ["car_loan", "汽车贷款", "Car loan (hire purchase)", "long", false, true, "car_installment"],
  ["personal_loan", "个人贷款", "Personal loan", "long", true, false, "personal_loan_installment"],
  ["study_loan", "教育贷款", "Study loan (PTPTN)", "long", false, false, "study_loan_installment"],
  ["renovation_loan", "装修贷款", "Renovation loan", "long", false, false, "renovation_loan_installment"],
  ["asb_financing", "ASB 贷款", "ASB financing", "long", false, true, "asb_financing_installment"],
  ["share_margin", "股票融资", "Share margin financing", "long", false, true, "share_margin_interest"],
  ["policy_loan", "保单贷款", "Policy loan", "long", false, true, null],
  ["business_loan", "商业贷款", "Business loan", "long", false, false, "business_loan_installment"],
  ["other", "其他负债", "Other liability", "long", false, false, "debt_other"],
];

export const LIABILITY_TYPES: readonly LiabilityTypeMeta[] = LIABILITY_ROWS.map(
  ([code, label_zh, label_en, term, high_interest, secured, installment_category]) => ({
    code, label_zh, label_en, term, high_interest, secured, installment_category,
  }),
);

const LIABILITY_BY_CODE: Readonly<Record<string, LiabilityTypeMeta>> = Object.fromEntries(
  LIABILITY_TYPES.map((l) => [l.code, l]),
);

export function liabilityTypeMeta(code: string | null | undefined): LiabilityTypeMeta | null {
  return code ? LIABILITY_BY_CODE[code] ?? null : null;
}

export function liabilityTypeLabel(code: string | null | undefined, lang: "zh" | "en"): string {
  const l = liabilityTypeMeta(code);
  if (!l) return code ?? "";
  return lang === "zh" ? l.label_zh : l.label_en;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --no-check --allow-env supabase/functions/_shared/taxonomy/balance.test.ts`
Expected: PASS — `ok | 8 passed | 0 failed`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/taxonomy/balance.ts supabase/functions/_shared/taxonomy/balance.test.ts
git commit -m "feat(taxonomy): asset classes A-D and liability types"
```

---

### Task 3: 旧数据与表单的归类规则

**Files:**
- Create: `supabase/functions/_shared/taxonomy/legacy.ts`
- Test: `supabase/functions/_shared/taxonomy/legacy.test.ts`

The note strings in the tests below are the real `source_note` values found in production on 2026-09-23 (the private ones are left out).

- [ ] **Step 1: Write the failing test**

`supabase/functions/_shared/taxonomy/legacy.test.ts`:

```ts
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  classifyAsset,
  classifyCashflowRow,
  levelUpAsset,
  levelUpLiabilityType,
} from "./legacy.ts";
import { CATEGORY_BY_CODE } from "./cashflow.ts";
import { assetTypeMeta } from "./balance.ts";

const out = (category: string, source_note: string | null, extra = {}) =>
  classifyCashflowRow({ direction: "outflow", category, source_note, frequency: "monthly", is_recurring: true, ...extra });
const inn = (category: string, source_note: string | null, extra = {}) =>
  classifyCashflowRow({ direction: "inflow", category, source_note, frequency: "monthly", is_recurring: true, ...extra });

Deno.test("KYC sub-items land in their exact category without review", () => {
  const cases: Array<[string, string, string]> = [
    ["household", "Tel/ Mobile/ Internet", "telco"],
    ["household", "Home Maintenance", "home_repair"],
    ["household", "Utilities Bills", "utilities"],
    ["household", "Groceries/Marketing", "groceries"],
    ["household", "Maid's Levy/ Salary", "household_help"],
    ["transportation", "Parking Fee", "toll_parking"],
    ["transportation", "Petrol", "fuel"],
    ["transportation", "Bus/ MRT/ Taxi/ Car Share", "public_transport_ehailing"],
    ["transportation", "Car Insurance", "motor_insurance"],
    ["dependants", "Child Care", "childcare"],
    ["dependants", "Children's School Fee", "school_fees"],
    ["dependants", "Upgrading Class", "tuition_enrichment"],
    ["dependants", "Dependant Allowances", "other_dependants"],
    ["dependants", "Child Expenses", "child_expenses"],
    ["dependants", "Parent Allowance", "parents_allowance"],
    ["personal", "Entertainment", "entertainment"],
    ["personal", "Dining Out", "dining_out"],
    ["personal", "Personal Care/ Clothing", "personal_care"],
    ["personal", "Donations/ Charity/ Gifts", "donations"],
    ["personal", "School Fees", "self_education"],
    ["miscellaneous", "Medical Cost", "health_medical"],
  ];
  for (const [cat, note, want] of cases) {
    const c = out(cat, note);
    assertEquals(c.code, want, `${cat} / ${note}`);
    assertEquals(c.needs_review, false, `${cat} / ${note}: ${c.review_reason}`);
  }
});

Deno.test("free-text notes seen in production", () => {
  assertEquals(out("household", "Indah Water").code, "utilities");
  assertEquals(out("household", "Mobile data").code, "telco");
  assertEquals(out("household", "Pet's Food").code, "pet_care");
  assertEquals(out("household", "Senior Livings").code, "parents_allowance");
  assertEquals(out("personal", "Kindergarden Fees").code, "school_fees");
  assertEquals(out("personal", "Youtube Subscription").code, "subscriptions");
  assertEquals(out("personal", "iCloud").code, "subscriptions");
  assertEquals(out("other_expense", "Software Subscriptions").code, "subscriptions");
  assertEquals(out("transportation", "Grab").code, "public_transport_ehailing");
  assertEquals(out("transportation", "Road Tax").code, "road_tax");
  assertEquals(out("transportation", "Servicing").code, "car_service_repair");
  assertEquals(out("personal", "Gym Membership").code, "fitness");
  // a weak rule (child) never outvotes a specific one (medical)
  const meds = out("miscellaneous", "Children Medication & Supplement");
  assertEquals(meds.code, "health_medical");
  assertEquals(meds.needs_review, false);
});

Deno.test("a row that mixes two kinds of spending goes to review", () => {
  for (const note of ["Car Loan & Petrol", "Groceries & Utilities", "Dining & Entertainment"]) {
    const c = out("household", note);
    assert(c.needs_review, note);
    assert(c.review_reason?.includes("多个项目"), note);
  }
});

Deno.test("group-level 'All - X' rows fall back to the catch-all without review", () => {
  assertEquals(out("household", "All - Household").code, "living_other");
  assertEquals(out("transportation", "All - Transport").code, "transport_other");
  assertEquals(out("personal", "All - Personal").code, "lifestyle_other");
  assertEquals(out("miscellaneous", "All - Miscellaneous").code, "other_expense");
  assertEquals(out("household", "All - Household").needs_review, false);
  // "Dependant" in the group line must not trigger the other_dependants rule
  assertEquals(out("dependants", "All - Dependants").code, "family_other");
  // "Road Tax" is one item, not road tax + income tax
  assertEquals(out("transportation", "Road Tax").needs_review, false);
});

Deno.test("an unmatched free-text note falls back but asks for review", () => {
  const c = out("household", "Something odd");
  assertEquals(c.code, "living_other");
  assert(c.needs_review);
});

Deno.test("KYC yearly items entered as monthly are corrected to annual", () => {
  const travel = out("personal", "Vacation/ Travel");
  assertEquals(travel.code, "travel");
  assertEquals(travel.frequency, "annual");
  assert(travel.needs_review);
  const tax = out("personal", "Income Tax Expense");
  assertEquals(tax.code, "income_tax");
  assertEquals(tax.frequency, "annual");
  // already annual → untouched, no review
  const ok = out("personal", "Vacation/ Travel", { frequency: "annual" });
  assertEquals(ok.frequency, null);
  assertEquals(ok.needs_review, false);
});

Deno.test("loans and premiums are flagged for the P2 de-duplication", () => {
  const loan = out("other_expense", "Loan Repayment");
  assertEquals(loan.code, "debt_other");
  assert(loan.needs_review);
  assertEquals(out("personal", "Shopee Pay Later").code, "bnpl_payment");
  assertEquals(out("insurance_premium", null).code, "protection_other");
  assert(out("insurance_premium", null).needs_review);
});

Deno.test("current, specific codes are left alone", () => {
  const c = out("groceries", "Jaya Grocer");
  assertEquals(c.code, "groceries");
  assertEquals(c.needs_review, false);
  assertEquals(c.frequency, null);
});

Deno.test("inflows: legacy codes, LevelUp labels, bonus, unclear other income", () => {
  assertEquals(inn("salary", null).code, "salary_basic");
  assertEquals(inn("dividend", "Annual Dividend Q1").code, "dividend_company");
  assertEquals(inn("investment_return", "Fixed Deposit & Bonds").code, "dividend_investment");
  assertEquals(inn("Salary", null).code, "salary_basic");
  assertEquals(inn("Investment Dividends / Interest", null).code, "dividend_investment");
  assertEquals(inn("Other", null).code, "other_income");
  const bonus = inn("bonus", null, { is_recurring: false });
  assertEquals(bonus.frequency, "annual");
  assertEquals(bonus.is_recurring, true);
  assert(bonus.needs_review);
  const unclear = inn("other_income", "Marriage Fund");
  assertEquals(unclear.code, "other_income");
  assert(unclear.needs_review);
  assertEquals(inn("rental_income", "Subang Jaya Condo").needs_review, false);
});

Deno.test("LevelUp outflow labels map to the group catch-alls", () => {
  assertEquals(out("Household", null).code, "living_other");
  assertEquals(out("Other Expenses", null).code, "other_expense");
  assertEquals(out("Transportation", "Petrol").code, "fuel");
});

Deno.test("every code the classifier can emit is a real category", () => {
  const notes = ["Petrol", "Loan Repayment", "x", "All - Household", "Medical Cost", "Car Insurance"];
  for (const cat of ["household", "transportation", "dependants", "personal", "miscellaneous", "other_expense", "insurance_premium", "loan_repayment", "investment_contribution", "tax", "property_expense", "property_maintenance"]) {
    for (const n of notes) assert(CATEGORY_BY_CODE[out(cat, n).code], `${cat}/${n}`);
  }
});

Deno.test("assets: property purpose and 'other' by name", () => {
  assertEquals(classifyAsset({ asset_type: "property", name: "Arte Cheras (Own stay)" }).asset_type, "own_residence");
  assertEquals(classifyAsset({ asset_type: "property", name: "Own House (Sendayan)" }).asset_type, "own_residence");
  assertEquals(classifyAsset({ asset_type: "property", name: "Shop lot for rent" }).asset_type, "investment_property");
  const unknown = classifyAsset({ asset_type: "property", name: "Landed Semi-D Damansara Jaya" });
  assertEquals(unknown.asset_type, "own_residence");
  assert(unknown.needs_review);
  assertEquals(classifyAsset({ asset_type: "other", name: "Maybank Gold (MIGA)" }).asset_type, "gold");
  const mixed = classifyAsset({ asset_type: "other", name: "Gold Bars & Jewellery" });
  assertEquals(mixed.asset_type, "gold");
  assert(mixed.needs_review);
  assertEquals(classifyAsset({ asset_type: "other", name: "ASB" }).asset_type, "asnb");
  const odd = classifyAsset({ asset_type: "other", name: "Something" });
  assertEquals(odd.asset_type, "other");
  assert(odd.needs_review);
  assertEquals(classifyAsset({ asset_type: "stock", name: "Maybank shares" }).asset_type, "stock");
  assertEquals(classifyAsset({ asset_type: "stock", name: "x" }).needs_review, false);
});

Deno.test("LevelUp asset and liability labels", () => {
  assertEquals(levelUpAsset("Cash/Savings").asset_type, "savings");
  assertEquals(levelUpAsset("EPF").asset_type, "epf_account_1");
  assertEquals(levelUpAsset("Gold/Precious Metals").asset_type, "gold");
  assertEquals(levelUpAsset("Crypto").asset_type, "crypto");
  assertEquals(levelUpAsset("Forex").asset_type, "forex");
  assertEquals(levelUpAsset("Properties", "My condo (own stay)").asset_type, "own_residence");
  assertEquals(levelUpAsset("Other Investments", "ASB").asset_type, "asnb");
  assertEquals(levelUpAsset("nonsense").asset_type, "other");
  for (const l of ["Cash/Savings", "Fixed Deposit", "EPF", "Properties", "Vehicles", "Other Assets", "ETF", "Stocks", "Unit Trusts", "Bonds", "Forex", "Gold/Precious Metals", "Crypto", "Other Investments"]) {
    assert(assetTypeMeta(levelUpAsset(l).asset_type), l);
  }
  assertEquals(levelUpLiabilityType("Mortgage / Property Loan"), "mortgage");
  assertEquals(levelUpLiabilityType("Vehicle Loan"), "car_loan");
  assertEquals(levelUpLiabilityType("Other Loans"), "other");
  assertEquals(levelUpLiabilityType("nonsense"), "other");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --no-check --allow-env supabase/functions/_shared/taxonomy/legacy.test.ts`
Expected: FAIL — module `./legacy.ts` not found

- [ ] **Step 3: Write the module**

`supabase/functions/_shared/taxonomy/legacy.ts`:

```ts
// Reading pre-2026-09-23 data, and the KYC / LevelUp forms that still speak the
// old vocabulary, into the new chart of accounts — spec 附录 A.
//
// Used by: the one-off remap generator (scripts/build-legacy-remap.ts), and the
// api/kyc.js + api/levelUp.js write paths via api/_lib/taxonomy.mjs.
//
// Imports stay inside this folder and carry the `.ts` extension, which Deno,
// Vite/vitest (allowImportingTsExtensions) and esbuild all resolve. The browser
// bundle never loads this file.

import { CATEGORY_BY_CODE, LEGACY_CATEGORY_MAP, type CashflowDirection } from "./cashflow.ts";
import { assetTypeMeta } from "./balance.ts";

export interface LegacyRow {
  direction: CashflowDirection;
  category: string;
  source_note?: string | null;
  frequency?: string | null;
  is_recurring?: boolean | null;
}

export interface Classified {
  code: string;
  /** set only when the stored frequency must change */
  frequency: string | null;
  /** set only when the stored is_recurring must change */
  is_recurring: boolean | null;
  needs_review: boolean;
  review_reason: string | null;
}

interface NoteRule {
  to: string;
  pattern: RegExp;
  /** only for rows whose (legacy) category is one of these */
  from?: readonly string[];
  /** generic: never outvotes a specific match, never counts as a second item */
  weak?: boolean;
}

// First match wins, so specific rules sit above the generic ones they overlap.
const OUTFLOW_NOTE_RULES: readonly NoteRule[] = [
  { to: "self_education", pattern: /^school fees$/i, from: ["personal"] },
  { to: "motor_insurance", pattern: /car insurance|motor insurance/i },
  { to: "road_tax", pattern: /road tax/i },
  { to: "car_installment", pattern: /car loan|hire purchase|车贷/i },
  { to: "bnpl_payment", pattern: /pay ?later|bnpl|atome/i },
  { to: "subscriptions", pattern: /subscription|icloud|youtube|netflix|spotify|software|订阅/i },
  { to: "telco", pattern: /tel\/|mobile|internet|phone|\bdata\b|astro|unifi|wifi|电话|网络/i },
  { to: "utilities", pattern: /utilit|electric|water|\btnb\b|sewer|水电/i },
  { to: "groceries", pattern: /grocer|marketing|supermarket|买菜|杂货/i },
  { to: "home_repair", pattern: /home maintenance|repair|renovat|维修/i },
  { to: "household_help", pattern: /maid|helper|女佣/i },
  { to: "toll_parking", pattern: /parking|toll|停车/i },
  { to: "fuel", pattern: /petrol|fuel|diesel|汽油/i },
  { to: "public_transport_ehailing", pattern: /\bbus\b|mrt|lrt|taxi|car share|grab|e-hailing|train/i },
  { to: "car_service_repair", pattern: /servic|workshop|tyre|tire/i },
  { to: "health_medical", pattern: /medic|clinic|hospital|doctor|dental|optical|supplement|pharma|医/i },
  { to: "childcare", pattern: /child ?care|nursery|babysit|托儿/i },
  { to: "school_fees", pattern: /school|kindergar|tadika|university|college|学费/i },
  { to: "tuition_enrichment", pattern: /upgrading class|tuition|enrichment|补习/i },
  { to: "parents_allowance", pattern: /parent|mother|father|\bmum\b|\bdad\b|senior living|父母/i },
  { to: "other_dependants", pattern: /dependant/i },
  { to: "pet_care", pattern: /\bpets?\b|宠物/i },
  { to: "fitness", pattern: /gym|fitness|sport|健身/i },
  { to: "dining_out", pattern: /dining|restaurant|food delivery|foodpanda|外食/i },
  { to: "entertainment", pattern: /entertain|movie|cinema|karaoke|娱乐/i },
  { to: "personal_care", pattern: /personal care|clothing|salon|haircut|cosmetic|beauty/i },
  { to: "travel", pattern: /vacation|travel|holiday|trip|旅游/i },
  { to: "zakat_tithe", pattern: /zakat|tithe|天课/i },
  { to: "donations", pattern: /donation|charity|gift|捐/i },
  { to: "income_tax", pattern: /income tax|\bpcb\b|cp500|所得税/i },
  { to: "child_expenses", pattern: /child|\bkid|孩子|子女/i, weak: true },
  { to: "debt_other", pattern: /loan|repayment|installment|还款|贷款/i, weak: true },
  { to: "protection_other", pattern: /insurance|takaful|premium|保险|保费/i, weak: true },
  { to: "investment_other", pattern: /invest|unit trust|fixed deposit|\basb\b|\bprs\b|储蓄|投资/i, weak: true },
];

/** The KYC form collects these two per YEAR even though it stored them monthly. */
const KYC_YEARLY_NOTES = new Set(["Vacation/ Travel", "Income Tax Expense"]);

/** LevelUp wrote its option labels straight into `category`. */
const LEVELUP_INFLOW_LABELS: Readonly<Record<string, string>> = {
  "salary": "salary_basic",
  "bonus / one-off incentives": "bonus",
  "director fee": "director_fee",
  "commission / referral fee": "commission",
  "dividend from own company": "dividend_company",
  "investment dividends / interest": "dividend_investment",
  "rental income": "rental_income",
  "other": "other_income",
  "income": "other_income",
};
const LEVELUP_OUTFLOW_LABELS: Readonly<Record<string, string>> = {
  "household": "household",
  "transportation": "transportation",
  "dependants": "dependants",
  "personal": "personal",
  "miscellaneous": "miscellaneous",
  "other expenses": "other_expense",
  "expense": "other_expense",
};

const norm = (s: string) => s.trim().toLowerCase();

/** A current code that is itself a catch-all still gets its note read. */
const isCatchAll = (code: string) =>
  code.endsWith("_other") || code === "other_expense" || code === "other_income";

function withReason(c: Classified, reason: string): Classified {
  return {
    ...c,
    needs_review: true,
    review_reason: c.review_reason ? `${c.review_reason}；${reason}` : reason,
  };
}

function classifyInflow(row: LegacyRow): Classified {
  const raw = row.category ?? "";
  const known = CATEGORY_BY_CODE[raw]
    ? raw
    : LEGACY_CATEGORY_MAP[raw] ?? LEVELUP_INFLOW_LABELS[norm(raw)] ?? null;
  let c: Classified = {
    code: known ?? "other_income",
    frequency: null,
    is_recurring: null,
    needs_review: false,
    review_reason: null,
  };
  if (!known) c = withReason(c, "无法识别的收入分类");
  if (c.code === "bonus" && row.is_recurring === false) {
    c = withReason(
      { ...c, frequency: "annual", is_recurring: true },
      "花红已改为按年计算，请确认金额是全年总额",
    );
  }
  if (c.code === "other_income" && row.source_note) {
    c = withReason(c, "请确认这笔流入是收入，还是资产变现或借款（不算收入）");
  }
  return c;
}

function classifyOutflow(row: LegacyRow): Classified {
  const raw = row.category ?? "";
  const legacy = LEVELUP_OUTFLOW_LABELS[norm(raw)] ?? raw;
  const current = CATEGORY_BY_CODE[legacy] ? legacy : null;
  const fallback = LEGACY_CATEGORY_MAP[legacy] ?? current;
  const note = (row.source_note ?? "").trim();

  // A specific current code is already where it belongs.
  if (current && !isCatchAll(current)) {
    return { code: current, frequency: null, is_recurring: null, needs_review: false, review_reason: null };
  }

  // "All - Household" is the form's own group-level line: it names the group,
  // not an item, so no note rule applies.
  const isGroupLine = /^all\s*-/i.test(note);
  const matched = isGroupLine ? [] : OUTFLOW_NOTE_RULES.filter(
    (r) => (!r.from || r.from.includes(legacy)) && r.pattern.test(note),
  );
  // A category-scoped rule is a deliberate override ("School Fees" under
  // personal is the client's own course), so it wins outright.
  const scoped = matched.find((r) => r.from);
  const hits = scoped ? [scoped] : matched;
  const strong = hits.filter((r) => !r.weak);
  const pick = strong[0] ?? hits[0] ?? null;

  let c: Classified = {
    code: pick?.to ?? fallback ?? "other_expense",
    frequency: null,
    is_recurring: null,
    needs_review: false,
    review_reason: null,
  };

  if (new Set(strong.map((r) => r.to)).size > 1) {
    c = withReason(c, "一行包含多个项目，请拆分后分别归类");
  }
  if (!pick && !fallback) c = withReason(c, "无法识别的支出分类");
  if (!pick && fallback && note && !isGroupLine) {
    c = withReason(c, "备注未能自动归类，请选择具体分类");
  }
  if (KYC_YEARLY_NOTES.has(note) && (row.frequency ?? "monthly") === "monthly") {
    c = withReason({ ...c, frequency: "annual" }, "KYC 中该项按年填写，已改为按年");
  }
  const cat = CATEGORY_BY_CODE[c.code];
  if (cat?.group === "O2" && cat.wealth_effect === "split") {
    c = withReason(c, "还款行：第二阶段会由负债自动生成月供，届时去重");
  }
  if (cat?.group === "O3") {
    c = withReason(c, "保费行：第二阶段会由保单自动生成，届时去重");
  }
  return c;
}

/** One stored cash-flow row → where it belongs now. */
export function classifyCashflowRow(row: LegacyRow): Classified {
  return row.direction === "inflow" ? classifyInflow(row) : classifyOutflow(row);
}

export interface ClassifiedAsset {
  asset_type: string;
  needs_review: boolean;
  review_reason: string | null;
}

const ASSET_NAME_RULES: readonly NoteRule[] = [
  { to: "own_residence", pattern: /own ?stay|own house|自住|residence|my home/i, from: ["property"] },
  { to: "investment_property", pattern: /invest|for rent|rental|出租|投资/i, from: ["property"] },
  { to: "gold", pattern: /gold|emas|黄金|\bmiga\b/i, from: ["other"] },
  { to: "jewelry", pattern: /jewel|珠宝/i, from: ["other"] },
  { to: "asnb", pattern: /\basb\b|\basm\b|asnb|amanah saham/i, from: ["other"] },
  { to: "tabung_haji", pattern: /tabung haji/i, from: ["other"] },
  { to: "crypto", pattern: /crypto|bitcoin|\bbtc\b|\beth\b|加密/i, from: ["other"] },
  { to: "forex", pattern: /forex|\bfx\b|外汇/i, from: ["other"] },
  { to: "collectibles", pattern: /watch|\bart\b|collect|收藏/i, from: ["other"] },
];

/** Reads `property` and `other` rows by name; every other type is kept. */
export function classifyAsset(a: { asset_type: string; name?: string | null }): ClassifiedAsset {
  if (a.asset_type !== "property" && a.asset_type !== "other") {
    return { asset_type: a.asset_type, needs_review: false, review_reason: null };
  }
  const name = a.name ?? "";
  const hits = ASSET_NAME_RULES.filter((r) => r.from!.includes(a.asset_type) && r.pattern.test(name));
  if (a.asset_type === "property") {
    if (hits.length === 1) return { asset_type: hits[0].to, needs_review: false, review_reason: null };
    return {
      asset_type: "own_residence",
      needs_review: true,
      review_reason: "请确认这项房产是自住还是投资",
    };
  }
  if (hits.length === 0) {
    return { asset_type: "other", needs_review: true, review_reason: "请选择具体的资产类型" };
  }
  const distinct = new Set(hits.map((h) => h.to));
  return distinct.size > 1
    ? { asset_type: hits[0].to, needs_review: true, review_reason: "名称包含多种资产，请拆分或确认类型" }
    : { asset_type: hits[0].to, needs_review: false, review_reason: null };
}

const LEVELUP_ASSET_LABELS: Readonly<Record<string, string>> = {
  "cash/savings": "savings",
  "fixed deposit": "fixed_deposit",
  "epf": "epf_account_1",
  "properties": "property",
  "vehicles": "vehicle",
  "other assets": "other",
  "etf": "etf",
  "stocks": "stock",
  "unit trusts": "unit_trust",
  "bonds": "bond",
  "forex": "forex",
  "gold/precious metals": "gold",
  "crypto": "crypto",
  "other investments": "other",
};

/** A LevelUp asset / investment option label (plus the typed description). */
export function levelUpAsset(label: string | null | undefined, description?: string | null): ClassifiedAsset {
  const mapped = LEVELUP_ASSET_LABELS[norm(label ?? "")] ?? "other";
  const c = classifyAsset({ asset_type: mapped, name: description ?? label ?? "" });
  return assetTypeMeta(c.asset_type) ? c : { asset_type: "other", needs_review: true, review_reason: "请选择具体的资产类型" };
}

const LEVELUP_LIABILITY_LABELS: Readonly<Record<string, string>> = {
  "mortgage / property loan": "mortgage",
  "vehicle loan": "car_loan",
  "study loan": "study_loan",
  "personal loan": "personal_loan",
  "renovation loan": "renovation_loan",
  "other loans": "other",
};

export function levelUpLiabilityType(label: string | null | undefined): string {
  return LEVELUP_LIABILITY_LABELS[norm(label ?? "")] ?? "other";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --no-check --allow-env supabase/functions/_shared/taxonomy/legacy.test.ts`
Expected: PASS — `ok | 13 passed | 0 failed`. If a note case fails, fix the rule order or pattern in `OUTFLOW_NOTE_RULES` — never weaken the test — and re-run.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/taxonomy/legacy.ts supabase/functions/_shared/taxonomy/legacy.test.ts
git commit -m "feat(taxonomy): legacy / KYC / LevelUp classifier with review flags"
```

---

### Task 4: `periods.ts` — 转移由分类决定 + 按分类年化

`isAssetTransfer` stops looking at `linked_asset_id` (0 live rows carry one) and reads the category instead. New `annualizeByCategory` gives per-category figures on the **same divisor** as the totals, so the categories add up to the whole. Today the cashflow breakdown and the tax scan re-annualise row by row, and their shares can exceed 100%.

**Files:**
- Modify: `supabase/functions/_shared/cashflow/periods.ts`
- Modify: `supabase/functions/_shared/cashflow/periods.cases.json`
- Test: `supabase/functions/_shared/cashflow/periods.test.ts`, `components/advisor/__tests__/cashflowPeriods.test.ts`

- [ ] **Step 1: Update the shared cases (they become the failing tests)**

In `periods.cases.json`, replace the case named `"transfers into the client's own assets are not spending"` with:

```json
    {
      "name": "saving and investing is not spending",
      "why": "O1 储蓄与投资 is a transfer by CATEGORY (spec 2026-09-22 §1). Before 2026-09-23 this was decided by linked_asset_id, which would also have removed a condo's rent from income the moment it was linked.",
      "rows": [
        { "direction": "outflow", "amount": 1000, "frequency": "monthly", "period_month": "2026-06-01", "category": "unit_trust_contribution" },
        { "direction": "outflow", "amount": 500, "frequency": "monthly", "period_month": "2026-06-01", "category": "groceries" }
      ],
      "basis": { "year": 2026, "from_month": 6, "to_month": 6 },
      "expect": {
        "monthly_income": 0,
        "monthly_expenses": 500,
        "annual_income": 0,
        "annual_expenses": 6000,
        "basis_months": 1,
        "months_with_data": [6],
        "annual_items_income": 0,
        "annual_items_expenses": 0
      },
      "ytd": { "year": 2026, "income": 0, "expenses": 500, "surplus": -500, "months_with_data": [6] }
    },
    {
      "name": "rent linked to its property is still income",
      "why": "link_to is for asset-quality maths; it never turns income into a transfer.",
      "rows": [
        { "direction": "inflow", "amount": 1800, "frequency": "monthly", "period_month": "2026-06-01", "category": "rental_income", "linked_asset_id": "a-1" }
      ],
      "basis": { "year": 2026, "from_month": 6, "to_month": 6 },
      "expect": {
        "monthly_income": 1800,
        "monthly_expenses": 0,
        "annual_income": 21600,
        "annual_expenses": 0,
        "basis_months": 1,
        "months_with_data": [6],
        "annual_items_income": 0,
        "annual_items_expenses": 0
      },
      "ytd": { "year": 2026, "income": 1800, "expenses": 0, "surplus": 1800, "months_with_data": [6] }
    },
    {
      "name": "selling an asset is not income",
      "why": "I4 非收入流入: the cash was already the client's; only its form changed.",
      "rows": [
        { "direction": "inflow", "amount": 50000, "frequency": "monthly", "period_month": "2026-06-01", "category": "asset_sale" },
        { "direction": "inflow", "amount": 6000, "frequency": "monthly", "period_month": "2026-06-01", "category": "salary_basic" }
      ],
      "basis": { "year": 2026, "from_month": 6, "to_month": 6 },
      "expect": {
        "monthly_income": 6000,
        "monthly_expenses": 0,
        "annual_income": 72000,
        "annual_expenses": 0,
        "basis_months": 1,
        "months_with_data": [6],
        "annual_items_income": 0,
        "annual_items_expenses": 0
      },
      "ytd": { "year": 2026, "income": 6000, "expenses": 0, "surplus": 6000, "months_with_data": [6] }
    },
```

In the case named `"a loan repayment IS spending"`, change its row to carry the installment category (keep everything else):

```json
        { "direction": "outflow", "amount": 900, "frequency": "monthly", "period_month": "2026-06-01", "category": "mortgage_installment", "linked_liability_id": "l-1" }
```

and its `"why"` to `"O2 债务偿还 is 'split'; until P2 estimates the principal, the whole installment counts as spending."`.

Add a new top-level key after `"defaultBasis"` (keep valid JSON — add the comma after the `defaultBasis` array):

```json
  "byCategory": [
    {
      "name": "categories add up to the totals even when months hold different items",
      "why": "A standing list typed in over two sessions (June: groceries; July: utilities). Each category uses the SAME divisor as the total, so the breakdown can never exceed 100%.",
      "rows": [
        { "direction": "inflow", "amount": 5000, "frequency": "monthly", "period_month": "2026-06-01", "category": "salary_basic" },
        { "direction": "outflow", "amount": 1000, "frequency": "monthly", "period_month": "2026-06-01", "category": "groceries" },
        { "direction": "outflow", "amount": 200, "frequency": "monthly", "period_month": "2026-07-01", "category": "utilities" },
        { "direction": "outflow", "amount": 1200, "frequency": "annual", "period_month": "2026-03-01", "category": "road_tax" },
        { "direction": "outflow", "amount": 300, "frequency": "monthly", "period_month": "2026-06-01", "category": "to_savings" }
      ],
      "basis": { "year": 2026, "from_month": 6, "to_month": 7 },
      "expect": {
        "salary_basic": { "monthly_income": 2500, "monthly_expenses": 0 },
        "groceries": { "monthly_income": 0, "monthly_expenses": 500 },
        "utilities": { "monthly_income": 0, "monthly_expenses": 100 },
        "road_tax": { "monthly_income": 0, "monthly_expenses": 100 }
      },
      "expectWithTransfers": {
        "to_savings": { "monthly_income": 0, "monthly_expenses": 150 }
      }
    }
  ]
```

- [ ] **Step 2: Add the runtime tests**

Append to `supabase/functions/_shared/cashflow/periods.test.ts` (and add `annualizeByCategory, TRANSFER_CATEGORIES_INLINE` to its existing `./periods.ts` import):

```ts
import { TRANSFER_CATEGORY_CODES } from "../taxonomy/cashflow.ts";

Deno.test("periods.ts's inline transfer list is the taxonomy's", () => {
  assertEquals([...TRANSFER_CATEGORIES_INLINE].sort(), [...TRANSFER_CATEGORY_CODES]);
});

Deno.test("shared cases: annualizeByCategory", async (t) => {
  for (const c of CASES.byCategory) {
    await t.step(c.name, () => {
      const rows = c.rows as PeriodRow[];
      const basis = c.basis as CashflowBasis;
      const by = Object.fromEntries(annualizeByCategory(rows, basis).map((x) => [x.category, x]));
      for (const [cat, want] of Object.entries(c.expect)) {
        assertAlmostEquals(by[cat]?.monthly_income ?? 0, want.monthly_income, 1e-6, `${cat} income`);
        assertAlmostEquals(by[cat]?.monthly_expenses ?? 0, want.monthly_expenses, 1e-6, `${cat} expenses`);
      }
      assertEquals(by["to_savings"], undefined);
      const total = annualizeCashflow(rows, basis);
      const sum = annualizeByCategory(rows, basis).reduce((s, x) => s + x.monthly_expenses, 0);
      assertAlmostEquals(sum, total.monthly_expenses, 1e-6);
      const withT = Object.fromEntries(
        annualizeByCategory(rows, basis, { includeTransfers: true }).map((x) => [x.category, x]),
      );
      for (const [cat, want] of Object.entries(c.expectWithTransfers)) {
        assertAlmostEquals(withT[cat]?.monthly_expenses ?? 0, want.monthly_expenses, 1e-6, cat);
      }
    });
  }
});
```

Append to `components/advisor/__tests__/cashflowPeriods.test.ts` (and add `annualizeByCategory, TRANSFER_CATEGORIES_INLINE` to its periods import):

```ts
import { TRANSFER_CATEGORY_CODES } from '../../../supabase/functions/_shared/taxonomy/cashflow';

describe('shared cases — annualizeByCategory', () => {
  it('uses the taxonomy transfer list', () => {
    expect([...TRANSFER_CATEGORIES_INLINE].sort()).toEqual([...TRANSFER_CATEGORY_CODES]);
  });
  for (const c of CASES.byCategory) {
    it(c.name, () => {
      const rows = c.rows as PeriodRow[];
      const basis = c.basis as CashflowBasis;
      const by = Object.fromEntries(annualizeByCategory(rows, basis).map((x) => [x.category, x]));
      for (const [cat, want] of Object.entries(c.expect)) {
        expect(by[cat]?.monthly_income ?? 0, cat).toBeCloseTo(want.monthly_income, 6);
        expect(by[cat]?.monthly_expenses ?? 0, cat).toBeCloseTo(want.monthly_expenses, 6);
      }
      expect(by.to_savings).toBeUndefined();
      const total = annualizeCashflow(rows, basis);
      const sum = annualizeByCategory(rows, basis).reduce((s, x) => s + x.monthly_expenses, 0);
      expect(sum).toBeCloseTo(total.monthly_expenses, 6);
      const withT = Object.fromEntries(
        annualizeByCategory(rows, basis, { includeTransfers: true }).map((x) => [x.category, x]),
      );
      for (const [cat, want] of Object.entries(c.expectWithTransfers)) {
        expect(withT[cat]?.monthly_expenses ?? 0, cat).toBeCloseTo(want.monthly_expenses, 6);
      }
    });
  }
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `deno test --no-check --allow-env supabase/functions/_shared/cashflow/periods.test.ts` then `npx vitest run components/advisor/__tests__/cashflowPeriods.test.ts`
Expected: FAIL — `annualizeByCategory` / `TRANSFER_CATEGORIES_INLINE` not exported; "saving and investing is not spending" reports `monthly_expenses` 1500 ≠ 500.

- [ ] **Step 4: Implement in `periods.ts`**

Replace the `linked_asset_id` / `linked_liability_id` field comments in `PeriodRow` with:

```ts
  /** the asset this row belongs to (rent → its condo). Relational only: it
   *  does NOT make the row a transfer — the category does. */
  linked_asset_id?: string | null;
  linked_liability_id?: string | null;
```

Replace the `isAssetTransfer` doc comment and function with:

```ts
/**
 * Category codes whose money stays the client's own — savings into an FD or a
 * fund, selling an asset, an EPF withdrawal, a loan drawdown, a card repayment.
 * A verbatim mirror of TRANSFER_CATEGORY_CODES in ../taxonomy/cashflow.ts: this
 * file may not import it, so periods.test.ts and cashflowPeriods.test.ts pin
 * the two lists together.
 */
export const TRANSFER_CATEGORIES_INLINE: readonly string[] = [
  "asnb_contribution", "asset_purchase", "asset_sale", "borrowing_family",
  "business_capital", "credit_card_payment", "crypto_purchase", "epf_employee",
  "epf_voluntary", "epf_withdrawal", "fd_placement", "gold_purchase",
  "investment_contribution", "investment_other", "lend_out", "loan_drawdown",
  "prs_contribution", "savings_withdrawal", "sspn", "stock_etf_purchase",
  "tabung_haji", "to_savings", "unit_trust_contribution",
];
const TRANSFER_SET = new Set(TRANSFER_CATEGORIES_INLINE);

/**
 * 小会计口径: a transfer moves the client's own money between pockets — it is
 * neither income nor spending. Decided by CATEGORY (spec 2026-09-22 §1). Loan
 * installments are 'split' and still count as spending until P2 separates the
 * principal.
 */
export function isAssetTransfer(r: PeriodRow): boolean {
  return isTransferCode(r.category);
}

/** The same test for a bare category code (e.g. a per-category total). */
export function isTransferCode(code: string | null | undefined): boolean {
  return code != null && TRANSFER_SET.has(code);
}
```

Add after `annualizeCashflow`:

```ts
export interface CategoryTotals {
  category: string;
  annual_income: number;
  annual_expenses: number;
  monthly_income: number;
  monthly_expenses: number;
}

/**
 * annualizeCashflow, split by category. Monthly rows are divided by the SAME
 * number of months as the totals (months in the basis holding any
 * non-transfer data), so the categories add up exactly to annualizeCashflow's
 * figures and no share can exceed 100%.
 *
 * `includeTransfers` adds transfer categories (e.g. SSPN and PRS deposits for
 * the tax-relief scan); they share the same divisor.
 */
export function annualizeByCategory(
  rows: PeriodRow[],
  basis: CashflowBasis | null,
  opts: { includeTransfers?: boolean } = {},
): CategoryTotals[] {
  const b = normalise(basis, new Date().getFullYear());
  const divisor = annualizeCashflow(rows, basis).months_with_data.length || 1;
  const acc = new Map<string, { mi: number; me: number; ai: number; ae: number }>();

  for (const r of rows ?? []) {
    if (!opts.includeTransfers && isAssetTransfer(r)) continue;
    if (yearOf(r.period_month) !== b.year) continue;
    const key = r.category ?? "uncategorised";
    const a = acc.get(key) ?? { mi: 0, me: 0, ai: 0, ae: 0 };
    const amount = amountOf(r);
    const inflow = r.direction === "inflow";
    if (isMonthlyActual(r)) {
      const m = monthOf(r.period_month);
      if (m == null || m < b.from_month || m > b.to_month) continue;
      if (inflow) a.mi += amount;
      else a.me += amount;
    } else {
      const annual = amount * (ANNUAL_OCCURRENCES[r.frequency] ?? 12);
      if (inflow) a.ai += annual;
      else a.ae += annual;
    }
    acc.set(key, a);
  }

  return [...acc.entries()].map(([category, a]) => {
    const annual_income = (a.mi / divisor) * 12 + a.ai;
    const annual_expenses = (a.me / divisor) * 12 + a.ae;
    return {
      category,
      annual_income,
      annual_expenses,
      monthly_income: annual_income / 12,
      monthly_expenses: annual_expenses / 12,
    };
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `deno test --no-check --allow-env supabase/functions/_shared/cashflow/periods.test.ts` and `npx vitest run components/advisor/__tests__/cashflowPeriods.test.ts`
Expected: PASS. Then run both full suites. **Expected new failures** (they encode the old link-based rule and are fixed in Task 7): `cfp-brain/baseline.test.ts`, `modules/cashflow/calc.test.ts`, `modules/synthesis/calc.test.ts`. Nothing else may fail.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/cashflow/ components/advisor/__tests__/cashflowPeriods.test.ts
git commit -m "feat(cashflow): transfers are decided by category; per-category annualisation"
```

---

### Task 5: 给 Vercel 函数用的预打包

**Files:**
- Create: `supabase/functions/_shared/taxonomy/index.ts`
- Create: `scripts/build-taxonomy.mjs`
- Create (generated, committed): `api/_lib/taxonomy.mjs`
- Create: `scripts/build-taxonomy.d.mts` (types for the builder, same shape as `scripts/build-suitability-pdf.d.mts`) and `api/_lib/taxonomy.d.mts` (`export * from '../../supabase/functions/_shared/taxonomy/index.ts';`), so `npx tsc --noEmit` stays at 0 errors
- Test: `scripts/__tests__/taxonomyBundle.test.ts`

- [ ] **Step 1: Write the failing test**

`scripts/__tests__/taxonomyBundle.test.ts`:

```ts
// Drift guard for the committed taxonomy bundle.
//
// api/*.js are plain-JS Vercel functions: they cannot import the .ts taxonomy,
// so they import api/_lib/taxonomy.mjs, a GENERATED, COMMITTED bundle of
// supabase/functions/_shared/taxonomy/**. A source edit is invisible to KYC,
// LevelUp and the client portal until the bundle is rebuilt — this test fails
// until it is. Fix: node scripts/build-taxonomy.mjs
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OUTFILE, buildTaxonomyBundle } from "../build-taxonomy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const norm = (s: string) => s.replace(/\r\n/g, "\n");

describe("committed taxonomy bundle", () => {
  it("exists and has no relative imports left", () => {
    const committed = fs.readFileSync(path.join(ROOT, OUTFILE), "utf8");
    expect(committed).toContain("GENERATED FILE");
    expect(committed.match(/from\s*["']\.[^"']*["']/g) ?? []).toEqual([]);
  });

  it("is up to date with the taxonomy sources", async () => {
    const committed = fs.readFileSync(path.join(ROOT, OUTFILE), "utf8");
    const rebuilt = (await buildTaxonomyBundle(undefined, false)).outputFiles![0].text;
    expect(norm(rebuilt) === norm(committed), "api/_lib/taxonomy.mjs is stale. Run: node scripts/build-taxonomy.mjs").toBe(true);
  });

  it("works when loaded the way a Vercel function loads it", async () => {
    const t = await import("../../api/_lib/taxonomy.mjs");
    expect(t.resolveCategory("household")?.code).toBe("living_other");
    expect(t.isTransferCategory("to_savings")).toBe(true);
    expect(t.classifyAsset({ asset_type: "other", name: "Maybank Gold (MIGA)" }).asset_type).toBe("gold");
    expect(t.liquidityLevel("savings")).toBe("high");
  });
});
```

`isTransferCategory` is exported by `index.ts` (below). The browser does not need it; the api does.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/taxonomyBundle.test.ts`
Expected: FAIL — `Cannot find module '../build-taxonomy.mjs'`

- [ ] **Step 3: Write the entry, the builder, and build**

`supabase/functions/_shared/taxonomy/index.ts`:

```ts
// Bundle entry for api/_lib/taxonomy.mjs (scripts/build-taxonomy.mjs).
// Deno and the browser import the individual modules, not this file.
import { wealthEffectOf, type CashflowDirection } from "./cashflow.ts";

export * from "./cashflow.ts";
export * from "./balance.ts";
export * from "./legacy.ts";

/** True when the stored code is a transfer, in either direction. */
export function isTransferCategory(code: string | null | undefined, direction: CashflowDirection = "outflow"): boolean {
  return wealthEffectOf(code, direction) === "transfer";
}
```

`scripts/build-taxonomy.mjs`:

```js
// Pre-bundles supabase/functions/_shared/taxonomy/** into api/_lib/taxonomy.mjs.
//
// WHY: api/*.js are plain-JS Vercel functions. @vercel/node transpiles .ts files
// it traces from .ts entries, but a .js entry importing .ts is not a path we
// have proven to ship (see scripts/simulate-vercel-function.mjs). One
// self-contained ESM file with no relative imports leaves nothing to miss.
//
// The output is COMMITTED; scripts/__tests__/taxonomyBundle.test.ts rebuilds it
// in memory and fails if the committed file has drifted from source.
//
// Usage: node scripts/build-taxonomy.mjs [outfile]
import { build } from "esbuild";

export const ENTRY = "supabase/functions/_shared/taxonomy/index.ts";
export const OUTFILE = "api/_lib/taxonomy.mjs";

export async function buildTaxonomyBundle(outfile = OUTFILE, write = true) {
  return build({
    entryPoints: [ENTRY],
    outfile,
    bundle: true,
    write,
    format: "esm",
    platform: "node",
    target: "node18",
    legalComments: "none",
    banner: {
      js:
        "// GENERATED FILE — do not edit.\n" +
        "// Source: supabase/functions/_shared/taxonomy/** (entry: index.ts)\n" +
        "// Rebuild: node scripts/build-taxonomy.mjs\n" +
        "// Committed so the plain-JS Vercel functions share the chart of accounts.",
    },
  });
}

// pathToFileURL, not string concatenation: on Windows the path contains
// backslashes and percent-encoded spaces.
const { pathToFileURL } = await import("node:url");
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2] || OUTFILE;
  await buildTaxonomyBundle(out);
  const { statSync } = await import("node:fs");
  console.log(`wrote ${out} (${statSync(out).size} bytes)`);
}
```

Run: `node scripts/build-taxonomy.mjs`
Expected: `wrote api/_lib/taxonomy.mjs (NNNNN bytes)`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/taxonomyBundle.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/taxonomy/index.ts scripts/build-taxonomy.mjs api/_lib/taxonomy.mjs scripts/__tests__/taxonomyBundle.test.ts
git commit -m "build(taxonomy): committed bundle for the plain-JS Vercel functions"
```

---

### Task 6: 数据库迁移 — 只新增的结构 + 分类表 seed

Two migration files, **written here and applied in Task 13**:
- `…000001` only adds things, so the code that is live today keeps working against it.
- `…000002` is generated from the taxonomy and upserts every category.

New enum values cannot be used in the transaction that adds them, which is why the data remap is a third, later migration (Task 11).

**Files:**
- Create: `supabase/migrations/20260923000001_cfp_taxonomy_foundation.sql`
- Create: `scripts/build-category-seed.ts`
- Create (generated, committed): `supabase/migrations/20260923000002_cashflow_categories_seed.sql`
- Test: `scripts/__tests__/categorySeed.test.ts`

- [ ] **Step 1: Write the DDL migration**

`supabase/migrations/20260923000001_cfp_taxonomy_foundation.sql`:

```sql
-- CFP data framework P1 — additive only.
-- Spec: docs/superpowers/specs/2026-09-22-cfp-financial-data-framework-design.md
--
-- Safe against the code that is live today: nothing here renames or removes
-- anything a deployed reader depends on. New enum values cannot be used in the
-- transaction that adds them, so the data remap is a separate migration
-- (20260923000003_legacy_taxonomy_remap.sql).

-- 1. New asset kinds. Existing spellings (epf_account_1..3, bond, business,
--    other, property) stay: renaming an enum value breaks every reader at once.
alter type public.asset_type add value if not exists 'cash_on_hand';
alter type public.asset_type add value if not exists 'ewallet';
alter type public.asset_type add value if not exists 'foreign_currency';
alter type public.asset_type add value if not exists 'prs';
alter type public.asset_type add value if not exists 'reit';
alter type public.asset_type add value if not exists 'asnb';
alter type public.asset_type add value if not exists 'tabung_haji';
alter type public.asset_type add value if not exists 'gold';
alter type public.asset_type add value if not exists 'crypto';
alter type public.asset_type add value if not exists 'forex';
alter type public.asset_type add value if not exists 'investment_property';
alter type public.asset_type add value if not exists 'land';
alter type public.asset_type add value if not exists 'receivable';
alter type public.asset_type add value if not exists 'sspn';
alter type public.asset_type add value if not exists 'own_residence';
alter type public.asset_type add value if not exists 'jewelry';
alter type public.asset_type add value if not exists 'collectibles';
alter type public.asset_type add value if not exists 'personal_asset_other';

-- 2. New liability kinds.
alter type public.liability_type add value if not exists 'bnpl';
alter type public.liability_type add value if not exists 'overdraft';
alter type public.liability_type add value if not exists 'tax_payable';
alter type public.liability_type add value if not exists 'family_loan';
alter type public.liability_type add value if not exists 'asb_financing';
alter type public.liability_type add value if not exists 'share_margin';
alter type public.liability_type add value if not exists 'policy_loan';

-- 3. assets: why it is held, how much of it is the client's, and the
--    advisor's triage flag for rows the remap could not place.
alter table public.assets
  add column if not exists purpose text
    check (purpose is null or purpose in ('personal_use', 'income_producing', 'investment')),
  add column if not exists ownership_pct numeric(5, 2) not null default 100
    check (ownership_pct > 0 and ownership_pct <= 100),
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text;

-- 4. clients: whether salary carries statutory EPF (D2). null = not yet confirmed.
alter table public.clients
  add column if not exists has_epf boolean;

-- 5. cashflow_entries: the same triage flag.
alter table public.cashflow_entries
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text;

-- 6. cashflow_categories: the chart-of-accounts attributes (spec §3.0).
alter table public.cashflow_categories
  add column if not exists category_group text,
  add column if not exists wealth_effect text
    check (wealth_effect is null or wealth_effect in ('income', 'expense', 'transfer', 'split')),
  add column if not exists recurrence text
    check (recurrence is null or recurrence in ('recurring', 'irregular', 'one_off')),
  add column if not exists fixed_variable text
    check (fixed_variable is null or fixed_variable in ('fixed', 'variable')),
  add column if not exists need_want text
    check (need_want is null or need_want in ('need', 'want')),
  add column if not exists link_to text
    check (link_to is null or link_to in ('asset', 'liability', 'policy', 'none')),
  add column if not exists auto_generated boolean not null default false,
  add column if not exists is_active boolean not null default true;

-- 7. The advisor's "待分类" queue is read per client.
create index if not exists cashflow_entries_needs_review_idx
  on public.cashflow_entries (client_id) where needs_review;
create index if not exists assets_needs_review_idx
  on public.assets (client_id) where needs_review;
```

- [ ] **Step 2: Write the failing seed test**

`scripts/__tests__/categorySeed.test.ts`:

```ts
// The cashflow_categories seed is GENERATED from the taxonomy. If this fails,
// run: npx tsx scripts/build-category-seed.ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { OUTFILE, categorySeedSql } from "../build-category-seed.ts";
import { CASHFLOW_CATEGORIES } from "../../supabase/functions/_shared/taxonomy/cashflow";

const norm = (s: string) => s.replace(/\r\n/g, "\n");

describe("cashflow_categories seed", () => {
  it("is up to date with the taxonomy", () => {
    const committed = fs.readFileSync(OUTFILE, "utf8");
    expect(norm(committed) === norm(categorySeedSql()), `${OUTFILE} is stale`).toBe(true);
  });

  it("upserts every category exactly once", () => {
    const sql = categorySeedSql();
    for (const c of CASHFLOW_CATEGORIES) {
      expect(sql.split(`('${c.code}',`).length - 1, c.code).toBe(1);
    }
  });

  it("escapes apostrophes", () => {
    expect(categorySeedSql()).toContain("'Children''s daily expenses'");
  });
});
```

Run: `npx vitest run scripts/__tests__/categorySeed.test.ts`
Expected: FAIL — `Cannot find module '../build-category-seed.ts'`

- [ ] **Step 3: Write the generator and generate**

`scripts/build-category-seed.ts`:

```ts
// Generates supabase/migrations/20260923000002_cashflow_categories_seed.sql from
// the taxonomy, so the database table the FK points at can never disagree with
// the code that reads it. scripts/__tests__/categorySeed.test.ts fails when the
// committed file is stale.
//
// Usage: npx tsx scripts/build-category-seed.ts
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { CASHFLOW_CATEGORIES } from "../supabase/functions/_shared/taxonomy/cashflow.ts";

export const OUTFILE = "supabase/migrations/20260923000002_cashflow_categories_seed.sql";

const q = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);

export function categorySeedSql(): string {
  const rows = CASHFLOW_CATEGORIES.map((c, i) =>
    "  (" + [
      q(c.code), q(c.label_en), q(c.label_zh), q(c.direction), "true", String((i + 1) * 10),
      q(c.group), q(c.wealth_effect), q(c.recurrence), q(c.fixed_variable), q(c.need_want),
      q(c.link_to), String(c.auto_generated), "true",
    ].join(", ") + ")"
  );
  return [
    "-- GENERATED FILE — do not edit.",
    "-- Source: supabase/functions/_shared/taxonomy/cashflow.ts",
    "-- Rebuild: npx tsx scripts/build-category-seed.ts",
    "-- Upserts every current category. Legacy codes are retired in 20260923000003.",
    "insert into public.cashflow_categories",
    "  (code, label, label_zh, direction, is_system, sort_order, category_group, wealth_effect,",
    "   recurrence, fixed_variable, need_want, link_to, auto_generated, is_active)",
    "values",
    rows.join(",\n"),
    "on conflict (code) do update set",
    "  label = excluded.label,",
    "  label_zh = excluded.label_zh,",
    "  direction = excluded.direction,",
    "  sort_order = excluded.sort_order,",
    "  category_group = excluded.category_group,",
    "  wealth_effect = excluded.wealth_effect,",
    "  recurrence = excluded.recurrence,",
    "  fixed_variable = excluded.fixed_variable,",
    "  need_want = excluded.need_want,",
    "  link_to = excluded.link_to,",
    "  auto_generated = excluded.auto_generated,",
    "  is_active = excluded.is_active;",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fs.writeFileSync(OUTFILE, categorySeedSql());
  console.log(`wrote ${OUTFILE} (${CASHFLOW_CATEGORIES.length} categories)`);
}
```

Run: `npx tsx scripts/build-category-seed.ts`
Expected: `wrote supabase/migrations/20260923000002_cashflow_categories_seed.sql (112 categories)`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/categorySeed.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260923000001_cfp_taxonomy_foundation.sql supabase/migrations/20260923000002_cashflow_categories_seed.sql scripts/build-category-seed.ts scripts/__tests__/categorySeed.test.ts
git commit -m "feat(db): taxonomy columns, new enum values, generated category seed"
```

---

### Task 7: 计算引擎改读分类

Every place that hard-codes an asset-type list, or guesses from a category keyword, switches to the taxonomy:
- liquid assets: baseline and insurance
- retirement capital
- allocation buckets
- passive income
- tax-relief detection
- the cash-flow breakdown

**Files:**
- Modify: `supabase/functions/cfp-brain/baseline.ts:50`, note at `:128`
- Modify: `supabase/functions/_shared/insurance/mapping.ts:71,233`
- Modify: `supabase/functions/cfp-brain/modules/retirement/calc.ts:10-11,179`
- Modify: `supabase/functions/cfp-brain/modules/investment/calc.ts:81-91`
- Modify: `supabase/functions/cfp-brain/modules/synthesis/calc.ts:113-140`
- Modify: `supabase/functions/cfp-brain/modules/tax/calc.ts:8,55-100,110`
- Modify: `supabase/functions/cfp-brain/modules/cashflow/calc.ts:8,46-66,93-103`
- Test: `cfp-brain/baseline.test.ts`, `modules/cashflow/calc.test.ts`, `modules/synthesis/calc.test.ts`, `modules/tax/calc.test.ts`

- [ ] **Step 1: Update the tests to taxonomy codes (they fail until Step 3)**

`cfp-brain/baseline.test.ts`, test `"asset transfers are excluded from income and expenses (小会计口径)"`: replace its three linked rows with:

```ts
        // saving into a fund — a transfer by category, not spending
        { direction: "outflow", amount: 2000, frequency: "monthly", category: "unit_trust_contribution", period_month: "2026-06-01" },
        // drawing on an FD — a transfer by category, not income
        { direction: "inflow", amount: 5000, frequency: "monthly", category: "savings_withdrawal", period_month: "2026-06-01" },
        // the mortgage installment is 'split' and still counts as spending (P1)
        { direction: "outflow", amount: 1500, frequency: "monthly", category: "mortgage_installment", linked_liability_id: "l-1", period_month: "2026-06-01" },
```

`modules/cashflow/calc.test.ts`, test `"asset transfers surface separately, never inside expense breakdown"`: replace the `invest_transfer` row and the last assertion with:

```ts
      { direction: "outflow", amount: 2000, frequency: "monthly", category: "unit_trust_contribution", period_month: "2026-06-01" },
```

```ts
  assertEquals(d.expense_breakdown.some((e) => e.category === "unit_trust_contribution"), false);
```

and append this test to the same file:

```ts
Deno.test("the expense breakdown adds up to the total even when months hold different items", () => {
  const d = det({
    cashflow: [
      { direction: "inflow", amount: 5000, frequency: "monthly", category: "salary_basic", period_month: "2026-06-01" },
      { direction: "outflow", amount: 1000, frequency: "monthly", category: "groceries", period_month: "2026-06-01" },
      { direction: "outflow", amount: 200, frequency: "monthly", category: "utilities", period_month: "2026-07-01" },
    ],
  });
  const sum = d.expense_breakdown.reduce((s, e) => s + e.monthly_amount, 0);
  assertEquals(sum, d.monthly_expenses);
  const shares = d.expense_breakdown.reduce((s, e) => s + (e.share ?? 0), 0);
  assert(shares <= 1.0001, `shares add to ${shares}`);
});
```

(`assert` is already imported there; if not, add it to the std import.)

`modules/synthesis/calc.test.ts`: replace the test `"passive income matches keyword categories, excluding transfers"` with:

```ts
Deno.test("passive income is the I2 group, excluding transfers", () => {
  const f = makeCfpData({
    cashflow: [
      { direction: "inflow", amount: 10000, frequency: "monthly", category: "salary_basic", period_month: "2026-06-01" },
      { direction: "inflow", amount: 1200, frequency: "monthly", category: "rental_income", period_month: "2026-06-01" },
      // a legacy code still resolves: dividend → dividend_company (I2)
      { direction: "inflow", amount: 6000, frequency: "annual", category: "dividend", period_month: "2026-06-01" },
      { direction: "inflow", amount: 500, frequency: "monthly", category: "interest_income", period_month: "2026-06-01" },
      // drawing on savings is a transfer, never passive income
      { direction: "inflow", amount: 900, frequency: "monthly", category: "savings_withdrawal", period_month: "2026-06-01" },
      { direction: "outflow", amount: 6000, frequency: "monthly", category: "household", period_month: "2026-06-01" },
    ],
  });
  // 1200 + 500 + 500(=6000/12) = 2200
  assertEquals(passiveIncomeMonthly(f), 2200);
});
```

`modules/tax/calc.test.ts`: change the categories and the direct call. Everything else stays as it is:
- `"Clinic bills"` → `"health_medical"`
- `"Medical Insurance premium"` → `"medical_card"`
- `"Hospital bills"` → `"health_medical"`
- the test name `"detected relief keyword hit is annualized and capped"` → `"detected relief category is annualized and capped"`
- in `"detectReliefsFromCashflow sums matched categories across frequencies"`, replace the rows and the call with:

```ts
      { direction: "outflow", amount: 100, frequency: "weekly", category: "fitness", period_month: "2026-06-01" },
      { direction: "outflow", amount: 500, frequency: "quarterly", category: "sspn", period_month: "2026-06-01" },
      { direction: "outflow", amount: 50, frequency: "monthly", category: "groceries", period_month: "2026-06-01" },
```

```ts
  const detected = detectReliefsFromCashflow(f, { year: 2026, from_month: 1, to_month: 12 });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:deno`
Expected: FAIL on exactly these tests:
- tax `"medical insurance category is claimed under medical_insurance…"` — the old keyword rule reads `medical_card` as medical expenses
- tax `"detectReliefsFromCashflow sums matched categories…"` — `fitness` matches no keyword
- cashflow `"the expense breakdown adds up to the total…"` — the shares add to 2.0

- [ ] **Step 3: Implement**

`cfp-brain/baseline.ts` — add to the imports:

```ts
import { LIQUID_ASSET_TYPES as TAXONOMY_LIQUID } from "../_shared/taxonomy/balance.ts";
```

replace line 49–50:

```ts
/** Emergency-fund-eligible liquid assets: taxonomy class A. */
export const LIQUID_ASSET_TYPES: readonly string[] = TAXONOMY_LIQUID;
```

and replace the note `"与自有资产挂钩的现金流视为资产转移，不计入收入或支出（还贷除外）"` with:

```ts
  notes.push("储蓄/投资转入、资产变现与借入视为资产转移，不计入收入或支出；贷款月供仍计入支出");
```

`_shared/insurance/mapping.ts` — add `import { isLiquid } from "../taxonomy/balance.ts";` below the `./cna.ts` import, delete `const LIQUID_ASSET_TYPES = ["savings", "fixed_deposit", "money_market"];`, and change the filter at line 233 to:

```ts
      .filter((a) => isLiquid(a.asset_type))
```

`modules/retirement/calc.ts` — replace lines 10–11 with:

```ts
import { EPF_ASSET_TYPES, isRetirementCapital } from "../../../_shared/taxonomy/balance.ts";
```

(put it with the other imports) and change the "other investable" filter (line 179) to:

```ts
      .filter((a) => isRetirementCapital(a.asset_type) && !EPF_ASSET_TYPES.includes(a.asset_type))
```

`modules/investment/calc.ts` — add

```ts
import { allocationBucketOf, type AllocationBucket as TaxonomyBucket } from "../../../_shared/taxonomy/balance.ts";
```

and replace the `equity` / `bond` / `cash` / `alternatives` block (lines 81–91) with:

```ts
  const sumBucket = (bucket: TaxonomyBucket) =>
    f.assets
      .filter((a) => allocationBucketOf(a.asset_type) === bucket)
      .reduce((s, a) => s + (a.current_value ?? 0), 0);
  const equity = sumBucket("equity") +
    f.holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
  const bond = sumBucket("bond");
  const cash = b.liquid_assets_after_emergency;
  const alternatives = sumBucket("alternatives");
```

`modules/synthesis/calc.ts` — add `import { groupOf } from "../../../_shared/taxonomy/cashflow.ts";`, delete `PASSIVE_KEYWORDS`, and replace the `passive` filter in `passiveIncomeMonthly` with:

```ts
  const passive = f.cashflow.filter((r) =>
    r.direction === "inflow" && groupOf(r.category)?.id === "I2"
  );
```

Also change the first line of its doc comment to `Passive income per month: the taxonomy's I2 被动收入 group (rent, dividends, interest, royalties, pensions, policy payouts), on the SAME basis as every other cashflow figure.`

`modules/tax/calc.ts` — replace `import { CASHFLOW_ANNUALIZE } from "../../baseline.ts";` with:

```ts
import { annualizeByCategory, type CashflowBasis } from "../../../_shared/cashflow/periods.ts";
import { resolveCategory } from "../../../_shared/taxonomy/cashflow.ts";
```

Replace everything from the `// Order matters:` comment through the end of `detectReliefsFromCashflow` with:

```ts
// Which cash-flow categories evidence which relief. Codes, not keywords: the
// category column is a foreign key into the taxonomy, so a guess is never
// needed. SSPN and PRS deposits are transfers, so the scan includes transfers.
const RELIEF_BY_CATEGORY: Readonly<Record<string, DetectableReliefKey>> = {
  medical_card: "medical_insurance",
  health_medical: "medical_expenses",
  sspn: "sspn",
  prs_contribution: "prs",
  fitness: "lifestyle",
  self_education: "lifestyle",
  telco: "lifestyle",
  subscriptions: "lifestyle",
};

/** Annual amounts per detectable relief, on the plan's own basis. Caller
 * still applies the relief cap; this only sums the matched amounts. */
export function detectReliefsFromCashflow(
  f: CfpData,
  basis: CashflowBasis | null = null,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const t of annualizeByCategory(f.cashflow, basis, { includeTransfers: true })) {
    const key = RELIEF_BY_CATEGORY[resolveCategory(t.category)?.code ?? ""];
    if (!key || t.annual_expenses <= 0) continue;
    totals[key] = (totals[key] ?? 0) + t.annual_expenses;
  }
  return totals;
}
```

and at line 110 pass the basis:

```ts
  const detected = detectReliefsFromCashflow(f, b.cashflow_basis);
```

`modules/cashflow/calc.ts` — replace the import on line 8 with:

```ts
import { annualizeByCategory, isTransferCode } from "../../../_shared/cashflow/periods.ts";
```

replace `breakdown` with:

```ts
function breakdown(
  rows: CfpData["cashflow"],
  basis: FinancialBaseline["cashflow_basis"],
  direction: "inflow" | "outflow",
  monthlyTotal: number,
): CategoryBreakdown[] {
  // Same divisor as the totals, so the categories add up to the whole.
  return annualizeByCategory(rows, basis)
    .map((t) => ({
      category: t.category,
      monthly: direction === "inflow" ? t.monthly_income : t.monthly_expenses,
    }))
    .filter((t) => t.monthly > 0)
    .map(({ category, monthly }) => ({
      category,
      monthly_amount: round(monthly),
      share: monthlyTotal > 0 ? Number((monthly / monthlyTotal).toFixed(4)) : null,
    }))
    .sort((a, b) => b.monthly_amount - a.monthly_amount);
}
```

and in `computeCashflow` replace the two `breakdown(...)` calls and the `asset_transfers_monthly` expression with:

```ts
    income_breakdown: breakdown(f.cashflow, b.cashflow_basis, "inflow", monthlyIncome),
    expense_breakdown: breakdown(f.cashflow, b.cashflow_basis, "outflow", monthlyExpenses),
    asset_transfers_monthly: round(
      annualizeByCategory(f.cashflow, b.cashflow_basis, { includeTransfers: true })
        .filter((t) => isTransferCode(t.category))
        .reduce((s, t) => s + t.monthly_expenses, 0),
    ),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:deno`
Expected: PASS, 0 failed.

Run: `npm test`
Expected: PASS except `pdf/cfpReport/labels/__tests__/enums.test.ts`, which is fixed in Task 8. If it already passes, fine.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/
git commit -m "refactor(cfp-brain): read liquidity, retirement, allocation, passive income and reliefs from the taxonomy"
```

---

### Task 8: 报告标签改读分类

The report prints asset/liability labels from `pdf/cfpReport/labels/enums.ts` and prints cash-flow categories **raw** (`household`). Both switch to the taxonomy.

**Files:**
- Modify: `pdf/cfpReport/labels/enums.ts:13-92`
- Modify: `pdf/cfpReport/select/cashflow.ts:55-65`
- Test: `pdf/cfpReport/labels/__tests__/enums.test.ts`, `pdf/cfpReport/select/__tests__/cashflow.test.ts`

- [ ] **Step 1: Update the tests**

In `enums.test.ts`:
- Replace the test `"carries no label for a type the UI cannot produce"` with:

```ts
  it("carries no label for a type the taxonomy does not define", () => {
    const known = new Set(TAXONOMY_ASSETS.map((a) => a.code));
    expect(Object.keys(ASSET_TYPES).filter((k) => !known.has(k))).toEqual([]);
  });
```

  and add `import { ASSET_TYPES as TAXONOMY_ASSETS } from "../../../../supabase/functions/_shared/taxonomy/balance";` to the imports.
- Change the label expectations `"公积金 户口一"` → `"公积金 退休户口"` and `"EPF Account 1"` → `"EPF Akaun Persaraan"`.
- Append:

```ts
describe("cash-flow category labels", () => {
  it("prints the taxonomy label, resolving legacy codes", () => {
    expect(cashflowCategoryLabel("groceries", "zh")).toBe("杂货/菜市");
    expect(cashflowCategoryLabel("household", "zh")).toBe("其他日常");
    expect(cashflowCategoryLabel("mystery", "zh")).toBe("mystery");
  });
});
```

  and add `cashflowCategoryLabel` to the `../enums` import.

In `select/__tests__/cashflow.test.ts` the existing fixtures use Chinese free text (`薪资`, `房贷`…), which an unknown-code lookup passes through unchanged, so they stay as they are. Add, after the `"labels a blank category…"` test:

```ts
  it("prints the Chinese label for a taxonomy code, not the raw code", () => {
    const v2 = selectCashflow(payload({
      ...CONTENT,
      expense_breakdown: [
        { category: "groceries", monthly_amount: 100, share: 0.6 },
        { category: "household", monthly_amount: 50, share: 0.3 },
      ],
    }));
    expect(v2.expenses.map((r) => r.category)).toEqual(["杂货/菜市", "其他日常"]);
  });
```

Run: `npx vitest run pdf/cfpReport`
Expected: FAIL — `cashflowCategoryLabel` is not exported; label mismatches.

- [ ] **Step 2: Implement `enums.ts`**

Add imports after the existing `import type { CfpReportLanguage }` line:

```ts
import {
  ASSET_TYPES as TAXONOMY_ASSETS,
  LIABILITY_TYPES as TAXONOMY_LIABILITIES,
  type AssetClass,
} from "../../../supabase/functions/_shared/taxonomy/balance";
import { categoryLabel } from "../../../supabase/functions/_shared/taxonomy/cashflow";
```

Replace the two literal maps `ASSET_TYPES` and `LIABILITY_TYPES` with:

```ts
/** Report grouping per taxonomy class (spec §3.3). */
const GROUP_BY_CLASS: Record<AssetClass, AssetGroup> = {
  A: "liquid",
  B: "retirement",
  C: "investment",
  D: "fixed",
};

// Derived from the taxonomy so the report can never print a type the
// database holds but this file forgot. `enums.test.ts` keeps them honest.
export const ASSET_TYPES: Record<string, AssetTypeMeta> = Object.fromEntries(
  TAXONOMY_ASSETS.map((a) => [a.code, { zh: a.label_zh, en: a.label_en, group: GROUP_BY_CLASS[a.class] }]),
);

export const LIABILITY_TYPES: Record<string, LiabilityTypeMeta> = Object.fromEntries(
  TAXONOMY_LIABILITIES.map((l) => [
    l.code,
    { zh: l.label_zh, en: l.label_en, highInterest: l.high_interest, secured: l.secured },
  ]),
);
```

Change `ASSET_GROUP_LABELS.fixed` to `{ zh: "自用资产", en: "Personal-use Assets" }` (the group now means class D).

Add after `isHighInterest`:

```ts
/** A cash-flow category code as the client should read it. */
export function cashflowCategoryLabel(code: string | null | undefined, lang: CfpReportLanguage): string {
  return categoryLabel(code, lang === "en" ? "en" : "zh");
}
```

- [ ] **Step 3: Implement `select/cashflow.ts`**

Add `import { cashflowCategoryLabel } from "../labels/enums";` and in `rows()` replace the `category:` line with:

```ts
      category: String(r?.category ?? "").trim()
        ? cashflowCategoryLabel(String(r.category).trim(), "zh")
        : "未分类",
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run pdf/cfpReport`
Expected: PASS. If another `pdf/` test fails only because it expects the old EPF / "固定资产" wording, update that expected string to the taxonomy label — do not change the taxonomy to fit an old snapshot.

Run: `npm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add pdf/cfpReport/
git commit -m "feat(cfp-pdf): asset, liability and cash-flow labels come from the taxonomy"
```

---

### Task 9: 顾问界面

Five changes in the advisor UI:
1. **Category picker grouped by I1–O10.** The current picker is a flat list from the DB table.
2. **Transfers are marked and kept out of the totals.**
3. **A "待分类" chip** on rows the remap flagged. Saving the row clears the flag.
4. **Asset/liability pickers grouped by class, plus purpose and ownership %.**
5. **Two widgets** (health score and insurance gap) that did not load `category` now do. Without it, the category-based transfer rule cannot see transfers.

**Files:**
- Modify: `components/advisor/tabs/CashflowTab.tsx`
- Modify: `components/advisor/tabs/NetworthTab.tsx`
- Modify: `components/advisor/components/HealthScoreCard.tsx:48-50,72-74`
- Modify: `components/advisor/components/InsuranceGapPanel.tsx:40`
- Modify: `supabase/scripts/backfill-health-snapshots.mjs:56-63`

These are UI changes, verified in the browser in Step 6; the logic they call is already unit-tested (Tasks 1, 2, 4).

- [ ] **Step 1: `CashflowTab.tsx`**

Add to the imports:

```tsx
import {
  CASHFLOW_CATEGORIES, CASHFLOW_GROUPS, categoryLabel, wealthEffectOf,
} from '../../../supabase/functions/_shared/taxonomy/cashflow';
```

In `load()`, drop the `cashflow_categories` query (the taxonomy is now the source) and its state:

```tsx
  async function load() {
    const { data: e } = await supabase.from('cashflow_entries').select('*')
      .eq('client_id', clientId).order('direction').order('category');
    setEntries(e || []); setLoading(false);
  }
```

Delete `const [categories, setCategories] = useState<any[]>([]);` and replace lines 171–173 (`catLabel`, `inflowCats`, `outflowCats`) with:

```tsx
  const catLabel = (code: string) => categoryLabel(code, language === 'zh' ? 'zh' : 'en');
```

In `saveEdit`, add to the update payload:

```tsx
      // an advisor saving the row is the review — clear the migration's flag
      needs_review: false,
      review_reason: null,
```

Replace the add-modal category `<select>` (the block inside `<Fr label={t('Category','类别')}>` around line 286) with:

```tsx
            <CategorySelect direction={modal} value={form.category} onChange={v => set('category', v)} language={language} allowEmpty />
```

At both `EntryTable` call sites replace `cats={inflowCats}` / `cats={outflowCats}` with `direction="inflow"` / `direction="outflow"`.

In `EntryTable`: change the props destructuring `cats` → `direction`; replace the edit-row `<select>` inside `<Fr label={t('Category','类别')}>` with:

```tsx
                  <CategorySelect direction={direction} value={editForm.category} onChange={(v: string) => setEdit('category', v)} language={language} />
```

replace the `total` line with:

```tsx
  // Transfers move the client's own money between pockets (spec §1): shown,
  // but kept out of the income / spending total.
  const isTransfer = (e: any) => wealthEffectOf(e.category, e.direction) === 'transfer';
  const total = entries.filter((e: any) => !isTransfer(e)).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
  const transferTotal = entries.filter(isTransfer).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
```

replace `<div className="text-sm font-medium text-xin-blue">{catLabel(e.category)}</div>` with:

```tsx
                  <div className="text-sm font-medium text-xin-blue flex items-center gap-1.5 flex-wrap">
                    {catLabel(e.category)}
                    {isTransfer(e) && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{t('Transfer','资产转移')}</span>}
                    {e.needs_review && <span title={e.review_reason || ''} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{t('Needs review','待分类')}</span>}
                  </div>
```

and after the existing total row add:

```tsx
          {transferTotal > 0 && (
            <div className="flex items-center justify-between px-5 py-2 bg-slate-50 text-xs text-slate-500">
              <span>{t('Transfers (not in total)','资产转移（不计入合计）')}</span>
              <span>RM {fmt(transferTotal)}</span>
            </div>
          )}
```

Add the component at the bottom of the file, next to `Fr`:

```tsx
// Grouped by the chart of accounts (I1–I4 / O1–O10). A legacy code that is no
// longer offered still shows as the current value, so opening an old row never
// silently re-files it.
function CategorySelect({ direction, value, onChange, language, allowEmpty }: {
  direction: 'inflow' | 'outflow'; value: string; onChange: (v: string) => void; language: string; allowEmpty?: boolean;
}) {
  const zh = language === 'zh';
  const known = CASHFLOW_CATEGORIES.some(c => c.code === value);
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={inp}>
      {allowEmpty && <option value="">—</option>}
      {value && !known && <option value={value}>{categoryLabel(value, zh ? 'zh' : 'en')} ({value})</option>}
      {CASHFLOW_GROUPS.filter(g => g.direction === direction).map(g => (
        <optgroup key={g.id} label={`${g.id} · ${zh ? g.label_zh : g.label_en}`}>
          {CASHFLOW_CATEGORIES.filter(c => c.group === g.id).map(c => (
            <option key={c.code} value={c.code}>{zh ? c.label_zh : c.label_en}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: `NetworthTab.tsx`**

Replace the two exported option lists (lines 7–8) with:

```tsx
import {
  ASSET_CLASSES, ASSET_TYPES, LIABILITY_TYPES, assetTypeLabel, assetTypeMeta,
  liabilityTypeLabel, liquidityLevel,
} from '../../../supabase/functions/_shared/taxonomy/balance';

// Exported so pdf/cfpReport/labels/__tests__/enums.test.ts can assert the
// report has a display label for every type this UI can create.
export const ASSET_OPTS: [string, string][] = ASSET_TYPES.filter(a => a.offered).map(a => [a.code, a.label_en]);
export const LIAB_OPTS: [string, string][] = LIABILITY_TYPES.map(l => [l.code, l.label_en]);

const PURPOSES: Array<[string, string, string]> = [
  ['', 'Default', '按类型默认'],
  ['personal_use', 'Personal use', '自用'],
  ['income_producing', 'Income-producing', '生财'],
  ['investment', 'Investment', '投资'],
];
```

(the `import` goes with the other imports at the top of the file).

In the component: add `const lang: 'zh' | 'en' = language === 'zh' ? 'zh' : 'en';` after `t`. In both `aForm` initial states (the `useState` and the reset inside `addAsset`) add `purpose:'', ownership_pct:'100'`.

Replace the `insert` in `addAsset` with:

```tsx
    const type = aForm.asset_type || 'other';
    await supabase.from('assets').insert({
      client_id: clientId, asset_type: type, name: aForm.name, institution: aForm.institution || null,
      current_value: parseFloat(aForm.current_value), cost_value: aForm.cost_value ? parseFloat(aForm.cost_value) : null,
      ownership_type: aForm.ownership_type,
      liquidity: liquidityLevel(type),
      purpose: aForm.purpose || assetTypeMeta(type)?.default_purpose || null,
      ownership_pct: parseFloat(aForm.ownership_pct) || 100,
    });
```

In `startEditAsset` add `purpose: a.purpose || '', ownership_pct: String(a.ownership_pct ?? 100)` to the edit form. Replace the assets branch of `payload` in `saveEdit` with:

```tsx
      ? {
          asset_type: editForm.asset_type || 'other', name: editForm.name, institution: editForm.institution || null,
          current_value: parseFloat(editForm.current_value), cost_value: editForm.cost_value ? parseFloat(editForm.cost_value) : null,
          ownership_type: editForm.ownership_type,
          liquidity: liquidityLevel(editForm.asset_type || 'other'),
          purpose: editForm.purpose || assetTypeMeta(editForm.asset_type)?.default_purpose || null,
          ownership_pct: parseFloat(editForm.ownership_pct) || 100,
          needs_review: false, review_reason: null,
        }
```

Delete the `typeLabel` helper. In the asset `Item`, use `sub={assetTypeLabel(a.asset_type, lang) + (a.institution ? \` · ${a.institution}\` : '') + (Number(a.ownership_pct ?? 100) < 100 ? \` · ${Number(a.ownership_pct)}%\` : '')}` and add `flag={a.needs_review ? (a.review_reason || t('Needs review','待确认')) : null}`. In the liability `Item`, replace `typeLabel(l.liability_type,LIAB_OPTS)` with `liabilityTypeLabel(l.liability_type, lang)`.

In the add-asset modal and `AssetEditRow` replace the asset-type `<Sel … opts={…ASSET_OPTS}>` with `<AssetTypeSel value={…} onChange={…} lang={lang} allowEmpty />` (no `allowEmpty` in the edit row) and add, after the value field:

```tsx
          <div className="grid grid-cols-2 gap-3">
            <Fr label={t('Purpose','持有目的')}><Sel value={aForm.purpose} onChange={v => setAForm(p => ({...p,purpose:v}))} opts={PURPOSES.map(([v, en, zh]) => [v, lang === 'zh' ? zh : en] as [string, string])} /></Fr>
            <Fr label={t('Ownership %','持有比例 %')}><Inp type="number" value={aForm.ownership_pct} onChange={v => setAForm(p => ({...p,ownership_pct:v}))} placeholder="100" /></Fr>
          </div>
```

(in `AssetEditRow` the same block with `form.purpose` / `form.ownership_pct` / `set(...)`; pass `lang` into `AssetEditRow` as a prop). In the add-liability modal and `LiabilityEditRow` replace the liability `<Sel>` with `<LiabilityTypeSel value={…} onChange={…} lang={lang} allowEmpty />` (no `allowEmpty` in the edit row; pass `lang` into `LiabilityEditRow`).

Change `Item` to show the flag:

```tsx
const Item = ({ title, sub, value, color, onEdit, onDel, flag }: any) => (
  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0">
    <div>
      <div className="text-sm font-medium text-xin-blue flex items-center gap-1.5">
        {title}
        {flag && <span title={flag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">待确认</span>}
      </div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
    <div className="flex items-center gap-3">
      <span className={`text-sm font-semibold ${color}`}>RM {value}</span>
      <button onClick={onEdit} className="text-slate-300 hover:text-xin-blue"><Pencil size={14} /></button>
      <button onClick={onDel} className="text-slate-300 hover:text-red-400"><X size={14} /></button>
    </div>
  </div>
);
```

Add at the bottom, next to `Sel`:

```tsx
const SEL_CLS = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold bg-white';

// Grouped by class A–D. The legacy `property` type is only listed while it is
// the current value, so an unconfirmed row can be opened and re-filed.
const AssetTypeSel = ({ value, onChange, lang, allowEmpty }: { value: string; onChange: (v: string) => void; lang: 'zh' | 'en'; allowEmpty?: boolean }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className={SEL_CLS}>
    {allowEmpty && <option value="">—</option>}
    {ASSET_CLASSES.map(k => (
      <optgroup key={k.id} label={`${k.id} · ${lang === 'zh' ? k.label_zh : k.label_en}`}>
        {ASSET_TYPES.filter(a => a.class === k.id && (a.offered || a.code === value)).map(a => (
          <option key={a.code} value={a.code}>{lang === 'zh' ? a.label_zh : a.label_en}</option>
        ))}
      </optgroup>
    ))}
  </select>
);

const LiabilityTypeSel = ({ value, onChange, lang, allowEmpty }: { value: string; onChange: (v: string) => void; lang: 'zh' | 'en'; allowEmpty?: boolean }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className={SEL_CLS}>
    {allowEmpty && <option value="">—</option>}
    {(['short', 'long'] as const).map(term => (
      <optgroup key={term} label={term === 'short' ? (lang === 'zh' ? '短期负债' : 'Short-term') : (lang === 'zh' ? '长期负债' : 'Long-term')}>
        {LIABILITY_TYPES.filter(l => l.term === term).map(l => (
          <option key={l.code} value={l.code}>{lang === 'zh' ? l.label_zh : l.label_en}</option>
        ))}
      </optgroup>
    ))}
  </select>
);
```

- [ ] **Step 3: `HealthScoreCard.tsx` and `InsuranceGapPanel.tsx`**

HealthScoreCard: add `import { isLiquid } from '../../../supabase/functions/_shared/taxonomy/balance';`, change the assets select to `.select('current_value, asset_type')`, the cashflow select to `.select('amount, frequency, direction, period_month, category')`, and the liquid filter to:

```tsx
      const liquidAssets = (assets || [])
        .filter((a: any) => isLiquid(a.asset_type))
        .reduce((s: number, a: any) => s + safeNumber(a.current_value), 0);
```

InsuranceGapPanel line 40: change the select to `'amount, frequency, direction, period_month, category'`.

- [ ] **Step 4: `backfill-health-snapshots.mjs`**

Add `import { isLiquid } from '../functions/_shared/taxonomy/balance.ts';` under the periods import, and replace the `cashAndFD` filter body with:

```js
    .filter((a) => isLiquid(String(a.asset_type || a.kind || '')))
```

- [ ] **Step 5: Run the suites and the build**

Run: `npm test` → all green (the enums test now also covers the new `ASSET_OPTS`).
Run: `npx vite build` → `✓ built in …` with no errors.

- [ ] **Step 6: Browser check — deferred to Task 13 Step 5**

This UI writes `purpose`, `ownership_pct` and `needs_review`, and picks category codes that do not exist in production until migrations 000001/000002 are applied. Before that, saving from the browser against the live database would fail, so the browser check runs after the migrations.

- [ ] **Step 7: Commit**

```bash
git add components/advisor/ supabase/scripts/backfill-health-snapshots.mjs
git commit -m "feat(advisor-ui): grouped chart-of-accounts pickers, transfer and review chips"
```

---

### Task 10: 写入入口 — KYC、LevelUp、客户端 API

Fixes for the four write paths:
- **KYC stops dropping data.** The per-asset monthly inflow/outflow now become rows linked to the asset. The bonus and the two yearly items are stored as annual. Own-stay and investment property stay distinct.
- **LevelUp writes codes, not labels.** Its cash-flow inserts currently fail the FK, and amounts of 0 fail the amount check.
- **Gold, crypto and forex get real types.**
- **The client portal** (`api/health.js`) labels from the taxonomy and leaves transfers out of income and spending.

The pure mapping moves into two small `api/_lib` modules so it can be tested.

**Files:**
- Create: `api/_lib/kycMapping.js`, `api/_lib/portalLabels.js`
- Modify: `api/kyc.js`, `api/levelUp.js`, `api/health.js`
- Test: `scripts/__tests__/kycMapping.test.ts`, `scripts/__tests__/portalLabels.test.ts`

- [ ] **Step 1: Write the failing tests**

`scripts/__tests__/kycMapping.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  assetCashflowEntries, kycAssetFields, kycExpenseEntry, kycIncomeEntry,
} from "../../api/_lib/kycMapping.js";

describe("KYC expenses", () => {
  it("files each sub-item under its exact category", () => {
    expect(kycExpenseEntry("household", { type: "Utilities Bills" }).category).toBe("utilities");
    expect(kycExpenseEntry("transportation", { type: "Car Insurance" }).category).toBe("motor_insurance");
    expect(kycExpenseEntry("household", { type: "All - Household" }).category).toBe("living_other");
  });
  it("stores the two yearly items as annual, without a review flag", () => {
    const e = kycExpenseEntry("personal", { type: "Vacation/ Travel" });
    expect(e).toMatchObject({ category: "travel", frequency: "annual", needs_review: false });
  });
  it("flags loan repayments for the P2 de-duplication", () => {
    const e = kycExpenseEntry("otherExpenses", { type: "Loan Repayment" });
    expect(e.category).toBe("debt_other");
    expect(e.needs_review).toBe(true);
  });
});

describe("KYC income", () => {
  it("uses current codes and makes the bonus annual", () => {
    expect(kycIncomeEntry("salary")).toEqual({ category: "salary_basic", frequency: "monthly" });
    expect(kycIncomeEntry("bonus")).toEqual({ category: "bonus", frequency: "annual" });
    expect(kycIncomeEntry("dividendCompany").category).toBe("dividend_company");
  });
});

describe("KYC assets", () => {
  it("reads 'other' by name and fills purpose and liquidity", () => {
    expect(kycAssetFields("other", "Gold bar 100g")).toMatchObject({
      asset_type: "gold", purpose: "investment", liquidity: "low", needs_review: false,
    });
    expect(kycAssetFields("own_residence", "Condo")).toMatchObject({
      asset_type: "own_residence", purpose: "personal_use", liquidity: "low",
    });
    expect(kycAssetFields("savings", "Maybank")).toMatchObject({ asset_type: "savings", liquidity: "high", purpose: null });
  });
  it("turns an asset's monthly inflow and outflow into linked rows", () => {
    const rows = assetCashflowEntries({ assetType: "investment_property", name: "Condo", monthlyIncome: 1800, monthlyExpenses: 300 });
    expect(rows).toEqual([
      { direction: "inflow", category: "rental_income", amount: 1800, needs_review: false, review_reason: null, source_note: "Condo (KYC)" },
      { direction: "outflow", category: "housing_other", amount: 300, needs_review: false, review_reason: null, source_note: "Condo (KYC)" },
    ]);
    const other = assetCashflowEntries({ assetType: "unit_trust", name: "Fund", monthlyIncome: 0, monthlyExpenses: 50 });
    expect(other).toEqual([
      { direction: "outflow", category: "other_expense", amount: 50, needs_review: true, review_reason: "请确认这笔资产相关支出的类别", source_note: "Fund (KYC)" },
    ]);
  });
});
```

`scripts/__tests__/portalLabels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assetCategory, cashflowLabel } from "../../api/_lib/portalLabels.js";

describe("client-portal labels", () => {
  it("keeps the exact strings services/apiService.ts keys off", () => {
    expect(cashflowLabel("inflow", "bonus")).toBe("Annual Bonus");
    expect(cashflowLabel("inflow", "rental_income")).toBe("Rental Income");
    expect(cashflowLabel("inflow", "dividend_investment")).toBe("Dividend Income");
    expect(cashflowLabel("outflow", "travel")).toBe("Vacation/ Travel");
    expect(cashflowLabel("outflow", "income_tax")).toBe("Income Tax Expense");
    expect(cashflowLabel("outflow", "mortgage_installment")).toBe("Loan Repayment");
    expect(cashflowLabel("outflow", "loan_repayment")).toBe("Loan Repayment");
  });
  it("labels everything else from the taxonomy", () => {
    expect(cashflowLabel("outflow", "groceries")).toBe("Groceries");
    expect(cashflowLabel("outflow", "household")).toBe("Other daily living");
    expect(cashflowLabel("outflow", "mystery")).toBe("mystery");
    expect(cashflowLabel("outflow", null)).toBe("Expense");
  });
  it("labels assets, keeping the portal's EPF wording", () => {
    expect(assetCategory("epf_account_1")).toBe("EPF Account 1 (Akaun Persaraan)");
    expect(assetCategory("gold")).toBe("Gold / precious metals");
    expect(assetCategory(null)).toBe("Other");
  });
});
```

Run: `npx vitest run scripts/__tests__/kycMapping.test.ts scripts/__tests__/portalLabels.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 2: Write the two modules**

`api/_lib/kycMapping.js`:

```js
// Pure mapping from the KYC form's vocabulary to the chart of accounts
// (spec 2026-09-22 附录 A). Kept out of api/kyc.js so it can be tested.
import { assetTypeMeta, classifyAsset, classifyCashflowRow, liquidityLevel } from './taxonomy.mjs';

/** KYC income field → cash-flow category. */
export const INCOME_CATEGORY_MAP = {
  salary: 'salary_basic',
  bonus: 'bonus',
  directorFee: 'director_fee',
  commission: 'commission',
  dividendCompany: 'dividend_company',
  dividendInvestment: 'dividend_investment',
  rentalIncome: 'rental_income',
};

/** KYC expense card → the legacy group code the classifier reads notes under. */
const EXPENSE_GROUP_CODES = {
  household: 'household',
  transportation: 'transportation',
  dependants: 'dependants',
  personal: 'personal',
  miscellaneous: 'miscellaneous',
  otherExpenses: 'other_expense',
};

/** The form asks for these two per YEAR (see ExpensesStep getSuffixForType). */
export const KYC_YEARLY_ITEMS = new Set(['Vacation/ Travel', 'Income Tax Expense']);

export function kycIncomeEntry(kycKey) {
  // The form's bonus is the year's bonus; recorded monthly it would be
  // multiplied by twelve.
  return { category: INCOME_CATEGORY_MAP[kycKey], frequency: kycKey === 'bonus' ? 'annual' : 'monthly' };
}

export function kycExpenseEntry(groupKey, item) {
  const note = item?.type || item?.description || null;
  const frequency = KYC_YEARLY_ITEMS.has(item?.type) ? 'annual' : 'monthly';
  const placed = classifyCashflowRow({
    direction: 'outflow',
    category: EXPENSE_GROUP_CODES[groupKey] ?? 'other_expense',
    source_note: note,
    frequency,
    is_recurring: true,
  });
  return {
    category: placed.code,
    frequency: placed.frequency || frequency,
    source_note: note,
    needs_review: placed.needs_review,
    review_reason: placed.review_reason,
  };
}

export function kycAssetFields(assetType, description) {
  const placed = classifyAsset({ asset_type: assetType, name: description });
  return {
    asset_type: placed.asset_type,
    purpose: assetTypeMeta(placed.asset_type)?.default_purpose ?? null,
    liquidity: liquidityLevel(placed.asset_type),
    needs_review: placed.needs_review,
    review_reason: placed.review_reason,
  };
}

const ASSET_INFLOW_CATEGORY = {
  own_residence: 'rental_income',
  investment_property: 'rental_income',
  vehicle: 'side_income',
};
const ASSET_OUTFLOW_CATEGORY = {
  own_residence: 'housing_other',
  investment_property: 'housing_other',
  vehicle: 'transport_other',
};

/**
 * The "Monthly Cash Inflow / Outflow (Maintenance, Tax, etc.)" the form collects
 * per asset, as rows the caller links to the inserted asset. Before
 * 2026-09-23 these figures were collected and then discarded.
 */
export function assetCashflowEntries({ assetType, name, monthlyIncome, monthlyExpenses }) {
  const rows = [];
  if (monthlyIncome > 0) {
    rows.push({
      direction: 'inflow',
      category: ASSET_INFLOW_CATEGORY[assetType] || 'dividend_investment',
      amount: monthlyIncome,
      needs_review: false,
      review_reason: null,
      source_note: `${name} (KYC)`,
    });
  }
  if (monthlyExpenses > 0) {
    const known = ASSET_OUTFLOW_CATEGORY[assetType];
    rows.push({
      direction: 'outflow',
      category: known || 'other_expense',
      amount: monthlyExpenses,
      needs_review: !known,
      review_reason: known ? null : '请确认这笔资产相关支出的类别',
      source_note: `${name} (KYC)`,
    });
  }
  return rows;
}
```

`api/_lib/portalLabels.js`:

```js
// Labels for the client portal payload (api/health.js). services/apiService.ts
// computes a few figures by matching these exact strings ('Annual Bonus',
// 'Loan Repayment', 'Vacation/ Travel', …), so the codes behind them keep those
// strings; everything else shows its taxonomy label.
import { assetTypeLabel, resolveCategory } from './taxonomy.mjs';

const PORTAL_CASHFLOW_LABELS = {
  salary_basic: 'Salary',
  bonus: 'Annual Bonus',
  rental_income: 'Rental Income',
  dividend_company: 'Dividend Income',
  dividend_investment: 'Dividend Income',
  interest_income: 'Dividend Income',
  income_tax: 'Income Tax Expense',
  travel: 'Vacation/ Travel',
};

export function cashflowLabel(direction, category) {
  const c = resolveCategory(category);
  if (!c) return category || (direction === 'inflow' ? 'Income' : 'Expense');
  if (PORTAL_CASHFLOW_LABELS[c.code]) return PORTAL_CASHFLOW_LABELS[c.code];
  if (c.group === 'O2' && c.wealth_effect === 'split') return 'Loan Repayment';
  return c.label_en;
}

const PORTAL_ASSET_LABELS = {
  savings: 'Savings/Current Account',
  fixed_deposit: 'Fixed Deposit',
  money_market: 'Money Market Fund For Savings',
  epf_account_1: 'EPF Account 1 (Akaun Persaraan)',
  epf_account_2: 'EPF Account 2 (Akaun Sejahtera)',
  epf_account_3: 'EPF Account 3 (Akaun Fleksibel)',
};

export function assetCategory(assetType) {
  if (!assetType) return 'Other';
  return PORTAL_ASSET_LABELS[assetType] || assetTypeLabel(assetType, 'en') || 'Other';
}
```

Run: `npx vitest run scripts/__tests__/kycMapping.test.ts scripts/__tests__/portalLabels.test.ts`
Expected: PASS

- [ ] **Step 3: Wire `api/kyc.js`**

- Add `import { assetCashflowEntries, INCOME_CATEGORY_MAP, kycAssetFields, kycExpenseEntry, kycIncomeEntry } from './_lib/kycMapping.js';`
- Delete the local `INCOME_CATEGORY_MAP`, `LIQUIDITY_BY_TYPE` and `liquidityFor`. Keep `EXPENSE_CATEGORY_MAP`'s **keys**; it is only iterated for `kycKey`.
- `ASSET_LIST_TYPES`: `['properties', 'own_residence', 'mortgage']` (the KYC wording is "for own stay only"); leave vehicles and otherAssets as they are.
- `INVESTMENT_ASSET_TYPE_MAP`: `fixedDeposits: 'investment_property'` (labelled "Properties (for investment purpose only)"), `forex: 'forex'`.
- Add `const assetCashMeta = [];` next to `linkedLoanMeta`.
- In all three asset loops, replace `asset_type: assetType,` … `liquidity: liquidityFor(assetType),` with a spread of the placed fields:

```js
        const placed = kycAssetFields(assetType, it.description || name);
        // …inside the push:
          ...placed,
```

  In the simple-fields loop there is no `it`: use `kycAssetFields(assetType, name)`. The spread supplies `asset_type`, `purpose`, `liquidity`, `needs_review` and `review_reason`.
- In the list-asset and investment loops, after pushing the asset, record its cash flow:

```js
        assetCashMeta.push({
          rowIndex: assetRows.length - 1,
          assetType: placed.asset_type,
          name: it.description || placed.asset_type,
          monthlyIncome: parseAmount(it.monthlyIncome),
          monthlyExpenses: parseAmount(it.monthlyExpenses),
        });
```

- Income loop: replace the `category`, `is_recurring` and `frequency` lines with:

```js
          ...kycIncomeEntry(kycKey),
          is_recurring: true,
```

  and iterate `Object.keys(INCOME_CATEGORY_MAP)` instead of `Object.entries(...)`.
- Expense loop: replace `category`, `frequency` and `source_note` with `...kycExpenseEntry(kycKey, it),` and pass the **card key** (`kycKey`) rather than the old category.
- After the expense loop, append the asset-linked rows:

```js
    for (const m of assetCashMeta) {
      for (const e of assetCashflowEntries(m)) {
        cashflowRows.push({
          client_id: clientId, currency: 'MYR', period_month: periodMonth,
          is_recurring: true, frequency: 'monthly',
          linked_asset_id: insertedAssets[m.rowIndex]?.id || null,
          ...e,
        });
      }
    }
```

- [ ] **Step 4: Wire `api/levelUp.js`**

- Add `import { classifyCashflowRow, levelUpAsset, levelUpLiabilityType, liquidityLevel, assetTypeMeta } from './_lib/taxonomy.mjs';` and delete `assetTypeFromCategory` / `liabilityTypeFromCategory`.
- Build each income / expense row through the classifier and skip empty amounts (`cashflow_entries.amount` is `CHECK (amount > 0)`):

```js
  const cashRow = (direction, label, description, amount) => {
    const placed = classifyCashflowRow({
      direction, category: label, source_note: description || null,
      frequency: 'monthly', is_recurring: true,
    });
    return {
      client_id: clientId, direction, amount, currency: 'MYR', period_month: monthDate,
      is_recurring: placed.is_recurring ?? true, frequency: placed.frequency || 'monthly',
      category: placed.code, source_note: description || null,
      needs_review: placed.needs_review, review_reason: placed.review_reason,
    };
  };
  const cashflowRows = [
    ...(incomes || []).map((i) => cashRow('inflow', i.category || 'Other', i.description, parseAmount(i.amount))),
    ...(expenses || []).map((e) => cashRow('outflow', e.type || e.category || 'Other Expenses', e.description, parseAmount(e.amount))),
  ].filter((r) => r.amount > 0);
```

- For assets and investments, replace `asset_type: assetTypeFromCategory(…)` and `liquidity: 'medium'` with:

```js
    const placed = levelUpAsset(a.category, a.description);
    // …inside the push:
      asset_type: placed.asset_type,
      liquidity: liquidityLevel(placed.asset_type),
      purpose: assetTypeMeta(placed.asset_type)?.default_purpose ?? null,
      needs_review: placed.needs_review,
      review_reason: placed.review_reason,
```

  (use `inv` in place of `a` in the investments loop).
- For liabilities: `liability_type: levelUpLiabilityType(l.category),`.

- [ ] **Step 5: Wire `api/health.js`**

- Add `import { assetCategory, cashflowLabel } from './_lib/portalLabels.js';` and `import { categoryLabel, isTransferCategory } from './_lib/taxonomy.mjs';`; delete the local `assetCategory` and `cashflowLabel`.
- `incomeRecords`: filter `c.direction === 'inflow' && !isTransferCategory(c.category, 'inflow')`.
- `expenseRecords`: filter `c.direction === 'outflow' && !isTransferCategory(c.category, 'outflow')`, and set `'Category': categoryLabel(c.category, 'en'),` so the portal no longer shows raw codes.

- [ ] **Step 6: Run the suites and simulate the Vercel load**

Run: `npm test` → all green.
Run: `node --check api/kyc.js && node --check api/levelUp.js && node --check api/health.js` → no output.
Run: `node -e "import('./api/kyc.js').then(()=>console.log('kyc ok'));import('./api/levelUp.js').then(()=>console.log('levelUp ok'));import('./api/health.js').then(()=>console.log('health ok'))"`
Expected: three `ok` lines. The modules load under real Node ESM resolution, which proves the relative `.js` / `.mjs` specifiers resolve. A missing env var may log a config warning; that is fine.

- [ ] **Step 7: Commit**

```bash
git add api/ scripts/__tests__/kycMapping.test.ts scripts/__tests__/portalLabels.test.ts
git commit -m "fix(write-paths): KYC keeps asset cash flows, LevelUp writes codes, portal labels from taxonomy"
```

---

### Task 11: 旧数据迁移 SQL（从快照生成，审阅后执行）

The remap is generated by the **same classifier** the write paths use, run over a read-only snapshot of the live rows. It is committed as a migration and applied in Task 13.

The snapshot JSON contains client notes, so it is **never committed**: it lives in the session scratchpad. The generated SQL contains only row ids, codes and fixed review reasons.

**Files:**
- Create: `scripts/build-legacy-remap.ts`
- Create (generated, reviewed, committed): `supabase/migrations/20260923000003_legacy_taxonomy_remap.sql`
- Test: `scripts/__tests__/legacyRemap.test.ts`

- [ ] **Step 1: Write the failing test**

`scripts/__tests__/legacyRemap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { remapSql } from "../build-legacy-remap.ts";

describe("legacy remap SQL", () => {
  const sql = remapSql(
    [
      { id: "c1", direction: "outflow", category: "household", source_note: "Utilities Bills", frequency: "monthly", is_recurring: true },
      { id: "c2", direction: "outflow", category: "groceries", source_note: null, frequency: "monthly", is_recurring: true },
      { id: "c3", direction: "outflow", category: "personal", source_note: "Vacation/ Travel", frequency: "monthly", is_recurring: true },
      { id: "c4", direction: "inflow", category: "bonus", source_note: null, frequency: "monthly", is_recurring: false },
      { id: "c5", direction: "outflow", category: "household", source_note: "O'Brien's shop", frequency: "monthly", is_recurring: true },
    ],
    [
      { id: "a1", asset_type: "other", name: "Maybank Gold (MIGA)" },
      { id: "a2", asset_type: "savings", name: "Maybank" },
    ],
  );

  it("backs the tables up before touching anything", () => {
    expect(sql.indexOf("archive.cashflow_entries_20260923")).toBeGreaterThan(-1);
    expect(sql.indexOf("archive.cashflow_entries_20260923")).toBeLessThan(sql.indexOf("update public.cashflow_entries"));
  });

  it("updates only rows that change, each guarded by its old category", () => {
    expect(sql).toContain("update public.cashflow_entries set category = 'utilities', needs_review = false, review_reason = null where id = 'c1' and category = 'household';");
    expect(sql).not.toContain("id = 'c2'");
    expect(sql).toMatch(/set category = 'travel', .*frequency = 'annual' where id = 'c3' and category = 'personal';/);
    expect(sql).toMatch(/frequency = 'annual', is_recurring = true where id = 'c4' and category = 'bonus';/);
  });

  it("reclassifies guessed assets and leaves the rest", () => {
    expect(sql).toContain("update public.assets set asset_type = 'gold', needs_review = false, review_reason = null where id = 'a1' and asset_type = 'other';");
    expect(sql).not.toContain("id = 'a2'");
  });

  it("catches late legacy rows and retires the legacy categories", () => {
    expect(sql).toContain("where category = 'household';");
    expect(sql).toContain("update public.cashflow_categories set is_active = false where code in ('salary',");
  });

  it("never lets a client's note into the SQL", () => {
    expect(sql).not.toContain("Brien");
    expect(sql).not.toContain("Utilities Bills");
  });
});
```

Run: `npx vitest run scripts/__tests__/legacyRemap.test.ts`
Expected: FAIL — `Cannot find module '../build-legacy-remap.ts'`

- [ ] **Step 2: Write the generator**

`scripts/build-legacy-remap.ts`:

```ts
// Generates supabase/migrations/20260923000003_legacy_taxonomy_remap.sql from a
// snapshot of the live rows, using the classifier the KYC / LevelUp write paths
// use (supabase/functions/_shared/taxonomy/legacy.ts) — spec 附录 A.
//
// The snapshot JSON holds client notes and is NOT committed: keep it in the
// session scratchpad. The SQL holds only row ids, codes and fixed reasons.
//
// Usage: npx tsx scripts/build-legacy-remap.ts <cashflow.json> <assets.json> [out.sql]
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { classifyAsset, classifyCashflowRow } from "../supabase/functions/_shared/taxonomy/legacy.ts";
import { LEGACY_CATEGORY_MAP } from "../supabase/functions/_shared/taxonomy/cashflow.ts";
import { ASSET_TYPES, liquidityLevel } from "../supabase/functions/_shared/taxonomy/balance.ts";

export const OUTFILE = "supabase/migrations/20260923000003_legacy_taxonomy_remap.sql";

export interface SnapshotCashflowRow {
  id: string;
  direction: "inflow" | "outflow";
  category: string;
  source_note: string | null;
  frequency: string;
  is_recurring: boolean;
}

export interface SnapshotAssetRow {
  id: string;
  asset_type: string;
  name: string | null;
}

const q = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);

export function remapSql(cashflow: SnapshotCashflowRow[], assets: SnapshotAssetRow[]): string {
  const out: string[] = [
    "-- GENERATED FILE — review before applying.",
    "-- Source: scripts/build-legacy-remap.ts over a snapshot of cashflow_entries and assets.",
    "-- Spec 附录 A. Needs 20260923000001/000002 committed first (new enum values, new codes).",
    "",
    "-- 0. Keep the pre-remap rows. The archive schema is not exposed through the API.",
    "create schema if not exists archive;",
    "revoke all on schema archive from anon, authenticated;",
    "create table if not exists archive.cashflow_entries_20260923 as table public.cashflow_entries;",
    "create table if not exists archive.assets_20260923 as table public.assets;",
    "alter table archive.cashflow_entries_20260923 enable row level security;",
    "alter table archive.assets_20260923 enable row level security;",
    "",
    "-- 1. Cash-flow rows from the snapshot. The `and category = …` guard turns an",
    "--    update into a no-op if the row was edited after the snapshot.",
  ];
  for (const r of [...cashflow].sort((a, b) => a.id.localeCompare(b.id))) {
    const c = classifyCashflowRow(r);
    if (c.code === r.category && !c.needs_review && c.frequency === null && c.is_recurring === null) continue;
    const sets = [
      `category = ${q(c.code)}`,
      `needs_review = ${c.needs_review}`,
      `review_reason = ${q(c.review_reason)}`,
    ];
    if (c.frequency) sets.push(`frequency = ${q(c.frequency)}`);
    if (c.is_recurring !== null) sets.push(`is_recurring = ${c.is_recurring}`);
    out.push(`update public.cashflow_entries set ${sets.join(", ")} where id = ${q(r.id)} and category = ${q(r.category)};`);
  }

  out.push("", "-- 2. Assets whose type was a guess (property / other).");
  for (const a of [...assets].sort((x, y) => x.id.localeCompare(y.id))) {
    const c = classifyAsset(a);
    if (c.asset_type === a.asset_type && !c.needs_review) continue;
    out.push(
      `update public.assets set asset_type = ${q(c.asset_type)}, needs_review = ${c.needs_review}, ` +
        `review_reason = ${q(c.review_reason)} where id = ${q(a.id)} and asset_type = ${q(a.asset_type)};`,
    );
  }

  out.push("", "-- 3. Any legacy code written after the snapshot: plain mapping, flagged.");
  for (const [legacy, current] of Object.entries(LEGACY_CATEGORY_MAP)) {
    out.push(
      `update public.cashflow_entries set category = ${q(current)}, needs_review = true, ` +
        `review_reason = '迁移后写入的旧分类，请确认具体分类' where category = ${q(legacy)};`,
    );
  }

  out.push("", "-- 4. Purpose (where unset) and liquidity for every asset, from the taxonomy.");
  const purposes = ASSET_TYPES.filter((t) => t.default_purpose)
    .map((t) => `when ${q(t.code)} then ${q(t.default_purpose)}`).join(" ");
  out.push(`update public.assets set purpose = case asset_type::text ${purposes} else null end where purpose is null;`);
  const levels = ASSET_TYPES.map((t) => `when ${q(t.code)} then ${q(liquidityLevel(t.code))}`).join(" ");
  out.push(`update public.assets set liquidity = (case asset_type::text ${levels} else 'low' end)::public.liquidity_level;`);

  out.push("", "-- 5. Retire the legacy categories. Rows no longer use them; the FK keeps them.");
  out.push(
    `update public.cashflow_categories set is_active = false where code in (${Object.keys(LEGACY_CATEGORY_MAP).map(q).join(", ")});`,
  );
  return out.join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cfPath, assetPath, outPath = OUTFILE] = process.argv.slice(2);
  if (!cfPath || !assetPath) {
    console.error("usage: npx tsx scripts/build-legacy-remap.ts <cashflow.json> <assets.json> [out.sql]");
    process.exit(1);
  }
  const sql = remapSql(
    JSON.parse(fs.readFileSync(cfPath, "utf8")),
    JSON.parse(fs.readFileSync(assetPath, "utf8")),
  );
  fs.writeFileSync(outPath, sql);
  console.log(`wrote ${outPath} (${sql.split("\n").filter((l) => l.startsWith("update")).length} updates)`);
}
```

Run: `npx vitest run scripts/__tests__/legacyRemap.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 3: Snapshot the live rows (read-only)**

Run via Supabase MCP `execute_sql`:

```sql
select coalesce(json_agg(json_build_object(
  'id', id, 'direction', direction, 'category', category,
  'source_note', source_note, 'frequency', frequency, 'is_recurring', is_recurring
) order by id), '[]'::json) from public.cashflow_entries;
```

Save **only the JSON array** from the result (not the untrusted-data wrapper) to `<scratchpad>/remap-cashflow.json`. Then:

```sql
select coalesce(json_agg(json_build_object('id', id, 'asset_type', asset_type, 'name', name) order by id), '[]'::json)
from public.assets where asset_type in ('property', 'other');
```

→ `<scratchpad>/remap-assets.json`.

- [ ] **Step 4: Generate and review**

Run: `npx tsx scripts/build-legacy-remap.ts <scratchpad>/remap-cashflow.json <scratchpad>/remap-assets.json`
Expected: `wrote supabase/migrations/20260923000003_legacy_taxonomy_remap.sql (N updates)`, where N ≈ 60–80 on 2026-09-23 data (77 cash-flow rows + 5 assets + 14 catch-alls + 2 asset-wide + 1 retire, minus the rows already on a specific code).

Review the file by hand:
- Every `update public.cashflow_entries … where id = …` carries `and category = '<old>'`.
- Spot-check against the paper drill (spec §8): the `Vacation/ Travel` row → `travel` + `frequency = 'annual'`; `Car Loan & Petrol` → `needs_review = true`; `Marriage Fund` → `needs_review = true`; `Maybank Gold (MIGA)` → `gold`; `Landed Semi-D …` → `own_residence` + `needs_review = true`.
- `grep -c "Indah Water\|Marriage\|Senior" supabase/migrations/20260923000003_legacy_taxonomy_remap.sql` → `0` (no notes leaked).

- [ ] **Step 5: Commit (the SQL only)**

```bash
git add scripts/build-legacy-remap.ts scripts/__tests__/legacyRemap.test.ts supabase/migrations/20260923000003_legacy_taxonomy_remap.sql
git commit -m "feat(db): generated legacy-to-taxonomy remap with archive backup"
```

---

### Task 12: 线上核心表结构参考快照

Spec gap #12: the live tables (`clients`, `assets`, `cashflow_entries` …) have no `create table` in the repo. Turning them into a replayable migration chain is its own project, because the 2026-04 initial migration defines an older, conflicting model. P1 ships an accurate **reference snapshot** instead, which a developer can read and diff.

**Files:**
- Create: `supabase/schema/live-core-tables.sql`

- [ ] **Step 1: Generate the DDL (read-only)**

Run via Supabase MCP `execute_sql`:

```sql
with t(name) as (values ('advisors'), ('clients'), ('assets'), ('liabilities'), ('cashflow_entries'),
  ('cashflow_categories'), ('insurance_policies'), ('policy_riders'), ('investment_accounts'),
  ('portfolio_holdings'), ('health_snapshots'), ('insurers'), ('plans'), ('riders'), ('rider_tiers')),
parts(ord, k, ddl) as (
  select 1, t2.typname::text,
    format('create type public.%I as enum (%s);', t2.typname,
      string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder))
  from pg_type t2 join pg_enum e on e.enumtypid = t2.oid
  where t2.typnamespace = 'public'::regnamespace group by t2.typname
  union all
  select 2, c.relname::text,
    format(E'create table public.%I (\n%s\n);', c.relname,
      string_agg(format('  %I %s%s%s', a.attname, format_type(a.atttypid, a.atttypmod),
        case when a.attnotnull then ' not null' else '' end,
        coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')), E',\n' order by a.attnum))
  from pg_class c join t on t.name = c.relname
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' group by c.relname
  union all
  select 3, conrelid::regclass::text || '.' || conname,
    format('alter table %s add constraint %I %s;', conrelid::regclass, conname, pg_get_constraintdef(oid))
  from pg_constraint where connamespace = 'public'::regnamespace
    and conrelid::regclass::text in (select name from t)
  union all
  select 4, i.indexrelid::regclass::text, pg_get_indexdef(i.indexrelid) || ';'
  from pg_index i join pg_class c on c.oid = i.indrelid join t on t.name = c.relname
  where c.relnamespace = 'public'::regnamespace
    and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid)
  union all
  select 5, c.relname::text, format('alter table public.%I enable row level security;', c.relname)
  from pg_class c join t on t.name = c.relname
  where c.relnamespace = 'public'::regnamespace and c.relrowsecurity
  union all
  select 6, p.tablename || '.' || p.policyname,
    format('create policy %I on public.%I as %s for %s to %s%s%s;', p.policyname, p.tablename,
      p.permissive, p.cmd, array_to_string(p.roles, ', '),
      coalesce(' using (' || p.qual || ')', ''), coalesce(' with check (' || p.with_check || ')', ''))
  from pg_policies p join t on t.name = p.tablename where p.schemaname = 'public'
)
select string_agg(ddl, E'\n\n' order by ord, k) from parts;
```

- [ ] **Step 2: Write the file**

Write `supabase/schema/live-core-tables.sql` as this header followed by the query result verbatim:

```sql
-- REFERENCE SNAPSHOT of the live core tables — NOT a migration, never applied.
-- Generated 2026-09-23 from the production catalog (query: docs/superpowers/plans/
-- 2026-09-23-cfp-p1-data-foundation.md, Task 12). The repo's migration chain does
-- not create these tables; this file is what they actually look like.
-- Regenerate with the same query after any schema change to them.
```

- [ ] **Step 3: Sanity-check and commit**

Check that the file contains `create table public.cashflow_entries`, `create table public.clients`, the `cashflow_entries_category_fkey` constraint, and `create type public.asset_type`.

```bash
git add supabase/schema/live-core-tables.sql
git commit -m "docs(db): reference snapshot of the live core tables"
```

> Run Task 12 **after** Task 13 Step 4, so the snapshot already includes the new columns and enum values.

---

### Task 13: 同步 spec、全量验证、部署（需要用户确认）

**Files:**
- Modify: `docs/superpowers/specs/2026-09-22-cfp-financial-data-framework-design.md`

- [ ] **Step 1: Sync the spec with what was built**

Make these edits in the spec:
- **§3.3, under the table:** add "**code 沿用线上 enum 现有拼写**：`epf_account_1/2/3`（显示为 退休/福利/灵活户口）、`bond`（债券/伊斯兰债券）、`business`（企业股权）、`other`（其他投资资产）；`property` 只保留给旧数据（显示为'房产（待确认用途）'），新数据用 `own_residence` / `investment_property`。原因：enum 改名会让已部署的读取方同时失效。" Also change the codes in the table (`bond_sukuk` → `bond`, `business_equity` → `business`, `epf_persaraan/sejahtera/fleksibel` → `epf_account_1/2/3`, `investment_asset_other` → `other`).
- **§5.4:** replace "退休资金来源只算 B 类和 C 类" with "退休资金来源 = B 类 + C 类中可提取变现的金融资产（股票、ETF、单位信托、REIT、债券、ASNB、朝圣基金、黄金、加密货币、外汇）；投资房以净租金计入退休收入流，土地、企业股权、借出款、SSPN、未识别的'其他'不计入本金。"
- **§3.0:** add a row explanation under `link_to`: "只表示关联对象，**不决定**是否转移；是否转移只看分类的 `wealth_effect`。"
- **§7 P1 row:** replace "补齐线上表的建表 migration" with "线上核心表结构参考快照 `supabase/schema/live-core-tables.sql`（可重放的 migration 链另立项）".
- **附录 A:** "线上 `cashflow_categories` 的 21 个 code" → "20 个 code"; the asset line "epf_account_1/2/3 → epf_persaraan/…" → "epf_account_1/2/3、bond、business 保持 code 不变".

Commit:

```bash
git add docs/superpowers/specs/2026-09-22-cfp-financial-data-framework-design.md
git commit -m "docs(cfp): sync framework spec with the P1 implementation"
```

- [ ] **Step 2: Full local verification**

Run, all must pass:
- `npm test` → 0 failed
- `npm run test:deno` → 0 failed
- `npx vite build` → built, no errors
- `node scripts/build-taxonomy.mjs && git status --porcelain api/_lib/taxonomy.mjs` → empty (the bundle is current)
- `npx tsx scripts/build-category-seed.ts && git status --porcelain supabase/migrations` → empty

- [ ] **Step 3: CHECKPOINT — ask the user before touching production**

Stop and ask for explicit confirmation of the four production actions, in this order, stating what each changes:
1. Apply migrations `…000001` (additive DDL) and `…000002` (category seed) to project `lqnnboepevcivcxvkoct`. Safe for the live code: nothing is renamed or removed.
2. Redeploy the edge functions `cfp-brain` and `insurance-brain`. Both import `_shared`, which now includes the taxonomy. The new code reads both old and new codes.
3. Push `feat/cfp-data-framework` and open a PR to `main`. The user merges it, and Vercel deploys the frontend and api. The new KYC / LevelUp / UI need step 1 applied first.
4. After the merge is live: apply `…000003` (archive backup + remap + retire legacy categories).

Do not proceed on any step the user has not approved.

- [ ] **Step 4: Apply migrations 000001 and 000002 (after approval)**

Via Supabase MCP `apply_migration`: `name` = `cfp_taxonomy_foundation`, `query` = the full contents of `…000001…sql`; then `name` = `cashflow_categories_seed`, `query` = `…000002…sql`.

Verify:

```sql
select
  (select count(*) from cashflow_categories where wealth_effect is not null) as typed,   -- 112
  (select count(*) from cashflow_categories) as total,                                   -- 126 (112 + 14 legacy)
  (select count(*) from information_schema.columns
     where table_name = 'assets' and column_name in ('purpose','ownership_pct','needs_review','review_reason')) as asset_cols, -- 4
  (select count(*) from pg_enum where enumtypid = 'public.asset_type'::regtype) as asset_enum; -- 32
```

Then run Task 12.

- [ ] **Step 5: Browser check (deferred from Task 9)**

Start the dev server (`preview_start`; if `.claude/launch.json` has no entry, add `{"name":"portal","runtimeExecutable":"npm","runtimeArgs":["run","dev"],"port":5173}`). If the pane is not signed in, ask the user to sign in themselves; never type credentials. Open a **test** client (not a real client) and check:
- Cash flow tab: the category picker is grouped I1–O10; an O1 row shows the 资产转移 chip and is left out of 合计.
- Net worth tab: the type pickers are grouped A–D / 短期·长期; purpose and ownership % save and re-open correctly.
- `read_console_messages` shows no errors.

Take one screenshot of each tab and delete the test rows afterwards.

- [ ] **Step 6: Deploy edge functions (after approval)**

List each function's local module graph: `deno info --json supabase/functions/cfp-brain/index.ts`, and the same for `insurance-brain`. Take every `file://` module under `supabase/functions/`. Read the currently deployed layout with MCP `get_edge_function` so the file paths match. Deploy with MCP `deploy_edge_function`, passing every file of the graph, the same entrypoint and `verify_jwt: false` (pinned in `supabase/config.toml`). Verify with `list_edge_functions` that both versions incremented, and that `get_logs` (edge-function) shows no boot errors after one advisor-triggered report generation.

- [ ] **Step 7: Push and open the PR (after approval)**

```bash
git push -u origin feat/cfp-data-framework
gh pr create --base main --title "CFP P1: chart of accounts, taxonomy-driven engine, legacy remap" --body-file <scratchpad>/pr-body.md
```

The PR body covers:
- the taxonomy
- the transfer rule change
- the three migrations and their order
- what the user must do: merge; then Task 13 Step 8 runs
- the test counts
- ending with the Claude Code attribution line

- [ ] **Step 8: After the merge is live — apply 000003 (after approval)**

1. Re-run Task 11 Steps 3–4 against current data.
2. If the regenerated SQL differs from the committed file, commit the new one first.
3. Apply it with `apply_migration` (`name` = `legacy_taxonomy_remap`).

Verify:

```sql
select
  (select count(*) from cashflow_entries where category in ('salary','dividend','investment_return','household','transportation','dependants','personal','insurance_premium','loan_repayment','investment_contribution','tax','property_expense','property_maintenance','miscellaneous')) as legacy_rows,  -- 0
  (select count(*) from cashflow_entries where needs_review) as cf_review,
  (select count(*) from assets where needs_review) as asset_review,
  (select count(*) from cashflow_categories where is_active) as active_categories,     -- 112
  (select count(*) from assets where asset_type in ('property','other')) as guessed_assets,
  (select count(*) from archive.cashflow_entries_20260923) as backed_up;               -- = rows before remap
```

Report `cf_review` / `asset_review` to the user: that is the advisor's "待分类" queue.

---

## 完成标准（P1 Definition of Done）

- `npm test` and `npm run test:deno` are green. The drift tests prove that the committed `api/_lib/taxonomy.mjs` and the category seed match the taxonomy.
- Production has the three migrations applied:
  - 112 active categories, each with a wealth effect
  - 0 cash-flow rows on a legacy code
  - `archive.*_20260923` backups present
  - the advisor's "待分类" queue counted and reported
- `cfp-brain` / `insurance-brain` run the taxonomy-aware code; the frontend and api are deployed from the merged PR.
- Saving into an investment (O1) no longer counts as spending anywhere:
  - the advisor tabs
  - the health score
  - the CFP report
  - the client portal
- A property's rent linked to the property is still income.
- KYC keeps each asset's monthly inflow/outflow, and stores the bonus, travel and income tax as annual.

**Out of P1** (next plans):
- P2: installments / premiums / EPF auto-generated from their source, standing items with effective dates.
- P3–P6 per spec §7.
