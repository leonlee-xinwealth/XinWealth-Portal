# CFP 七大板块多智能体报告系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `financial_reports`/`report_sections` 之上落地 8 个 section 的 CFP 报告智能体（7 板块 + synthesis），以 `FinancialBaseline` 共享基线消除模块间双算，以 synthesis 预算对账避免顾此失彼。

**Architecture:** 单一 `cfp-brain` edge function + 模块注册表。**每次调用**：取数 → `computeAll()` 纯函数一次性重算 baseline + 全部 8 个模块的确定性输出（廉价，无 LLM）→ 持久化 baseline → 仅为请求的 section 调 Gemini 叙述 → assemble → 写 report_sections。跨模块依赖因此退化为纯函数组合，无跨调用状态、无超时风险。`insurance-brain` 保留 prospect 漏斗，其 CFP 分支迁入 cfp-brain。

**Tech Stack:** Supabase Edge Functions (Deno), Gemini flash-lite (JSON schema output), React/TS + Tailwind, react-pdf。

**Spec:** `docs/superpowers/specs/2026-07-16-cfp-multi-agent-report-design.md`（公式、content shape、合规纪律以 spec 为准）

---

## 文件结构总览

```
supabase/migrations/20260716000001_cfp_reports_foundation.sql   # 新
supabase/functions/
  _shared/
    llm/gemini.ts                       # callGeminiJson（从 insurance-brain/section.ts 抽出）
    insurance/cna.ts (+cna.test.ts)     # 从 insurance-brain 移入，接口不变
    insurance/mapping.ts (+mapping.test.ts)  # 移入 + buildCfpCnaInput 加 baseline 参数
  insurance-brain/                      # 只剩 prospect 模式；import 改 _shared
  cfp-brain/
    deno.json, index.ts, types.ts, db.ts, baseline.ts (+test),
    orchestrator.ts (+test), sectionLifecycle.ts, clientView.ts
    modules/registry.ts
    modules/{cashflow,goals,insurance,investment,retirement,tax,legacy,synthesis}/
      calc.ts + calc.test.ts + section.ts     # section.ts = prompt + response schema + assemble
components/advisor/cfp/
  types.ts, primitives.tsx, SectionCard.tsx, sectionMeta.ts
  renderers/{Insurance,Cashflow,Goals,Investment,Retirement,Tax,Legacy,Synthesis}Renderer.tsx
components/advisor/tabs/CfpTab.tsx      # 瘦身为报告选择器 + section 列表
```

## 核心接口（所有任务共用的契约）

```ts
// cfp-brain/types.ts
export type SectionType =
  | "cashflow_planning" | "insurance_planning" | "investment_planning"
  | "retirement_planning" | "tax_planning" | "legacy_planning"
  | "goals_planning" | "financial_health";

export interface FinancialBaseline { /* spec §2，version: 1 */ }

export interface CfpModule<TDet = unknown, TContent = unknown> {
  section_type: SectionType;
  agent: string;
  compute(f: CfpFinancials, b: FinancialBaseline, prior: Partial<Record<SectionType, unknown>>): TDet;
  buildPrompt(det: TDet, b: FinancialBaseline, f: CfpFinancials): { prompt: string; schema: unknown };
  assemble(det: TDet, narrative: unknown, f: CfpFinancials): TContent;
}

// orchestrator.ts — 纯函数，固定顺序执行 compute（cashflow→goals→insurance→investment→retirement→tax→legacy→synthesis）
export function computeAll(f: CfpFinancials, inputs: PlanningInputs):
  { baseline: FinancialBaseline; det: Record<SectionType, unknown> };
```

编排规则：`compute` 阶段 goals 的教育金合计与 insurance 的当前保费通过 orchestrator 写回 baseline 副本（`goal_education_need`、`annual_premium_current`）后再传给后续模块；synthesis 最后运行，只读全部 `det`，不回写。

---

## Phase 0 — 地基

### Task 1: 迁移 SQL

**Files:** Create `supabase/migrations/20260716000001_cfp_reports_foundation.sql`

- [ ] Step 1: 写迁移（约束扩展 + 两列 + client_goals + RLS）

```sql
-- CFP multi-agent foundation: 8 section types, report-level baseline &
-- planning inputs, and client_goals for goal-based planning.

alter table public.report_sections drop constraint report_sections_section_type_check;
alter table public.report_sections add constraint report_sections_section_type_check
  check (section_type in (
    'cashflow_planning','insurance_planning','investment_planning',
    'retirement_planning','tax_planning','legacy_planning',
    'goals_planning','financial_health'));

alter table public.financial_reports
  add column baseline jsonb,
  add column planning_inputs jsonb not null default '{}'::jsonb;

create table public.client_goals (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id) on delete cascade,
  advisor_id         uuid not null references public.advisors(id),
  goal_type          text not null check (goal_type in ('education','house','business','other')),
  name               text not null,
  target_amount      numeric not null check (target_amount >= 0),
  target_year        int not null,
  current_saved      numeric not null default 0,
  monthly_contribution numeric not null default 0,
  inflation_override numeric,
  priority           int not null default 1,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index client_goals_client_idx on public.client_goals (client_id);
alter table public.client_goals enable row level security;
create policy advisor_manage_client_goals on public.client_goals
  for all
  using (advisor_id in (select id from public.advisors where user_id = auth.uid()))
  with check (advisor_id in (select id from public.advisors where user_id = auth.uid()));
create trigger client_goals_updated_at
  before update on public.client_goals
  for each row execute function public.update_financial_reports_updated_at();
```

- [ ] Step 2: 确认线上 `report_sections` 无 `asset_allocation`/`investment_planning` 历史行（有则先迁移）。检查命令：`select section_type, count(*) from report_sections group by 1;`
- [ ] Step 3: Commit `feat(cfp): foundation migration — 8 section types, baseline, client_goals`。**不 apply 到生产**（部署清单见 Task 15）。

### Task 2: `_shared` 抽取（唯一触及已测试代码的动作）

**Files:** Create `_shared/llm/gemini.ts`, `_shared/insurance/{cna,cna.test,mapping,mapping.test}.ts`; Modify `insurance-brain/{index,section,mapping 引用方}.ts`

- [ ] Step 1: `git mv` insurance-brain 的 cna.ts/cna.test.ts/mapping.ts/mapping.test.ts → `_shared/insurance/`；修 insurance-brain 内部 import 路径（`../_shared/insurance/...`）。
- [ ] Step 2: 从 section.ts 抽出通用 `callGeminiJson(prompt, responseSchema, apiKey, {temperature=0.3, retries=3})` → `_shared/llm/gemini.ts`；section.ts 改为调用它。
- [ ] Step 3: `cd supabase/functions/insurance-brain && deno test` 全绿（零回归）。注意 deno.json importMap 相对路径。
- [ ] Step 4: Commit `refactor(insurance-brain): extract cna/mapping/gemini to _shared`。

### Task 3: cfp-brain 骨架 — types + db + baseline (TDD)

**Files:** Create `cfp-brain/{deno.json,types.ts,db.ts,baseline.ts,baseline.test.ts}`

- [ ] Step 1: types.ts 按上方契约 + spec §2 的 FinancialBaseline 完整字段。
- [ ] Step 2: db.ts `fetchCfpData(db, clientId)`：clients（含 risk_profile/tax_residency/epf·ppa 号存在性布尔，**不取号码本身**）、cashflow_entries（inflow+outflow，最近 period_month）、assets（含 liquidity/asset_type/current_value/linked）、liabilities、insurance_policies+policy_riders、investment_accounts（prs_sub_account_a/b）、portfolio_holdings（最近 snapshot_month）、client_goals、health_snapshots（最近一行）、financial_reports.planning_inputs。
- [ ] Step 3: baseline.test.ts 先写失败用例：年化收入（monthly×12 + yearly 混合频率）、必要支出口径、紧急预备金 need/actual/after、无收入客户全零不抛错、assumptions 常量回显、planning_inputs.assumption_overrides 覆盖生效。
- [ ] Step 4: 实现 `computeBaseline(f, inputs)` 使测试通过；`deno test` 绿。
- [ ] Step 5: Commit `feat(cfp-brain): types, data fetch, deterministic FinancialBaseline`。

### Task 4: sectionLifecycle + registry + index 路由

**Files:** Create `cfp-brain/{sectionLifecycle.ts,orchestrator.ts,orchestrator.test.ts,modules/registry.ts,index.ts}`

- [ ] Step 1: sectionLifecycle.ts：`upsertGenerating(db, reportId, sectionType, agent)` / `saveDraft(db, sectionId, content)` / `markFailed(db, sectionId, message)`（照 insurance-brain/index.ts:142 模式）。
- [ ] Step 2: registry.ts：`ORDERED_MODULES: CfpModule[]`（先注册占位空数组，后续任务逐个填入）。orchestrator.ts：`computeAll` 按序执行、baseline 回填规则（education_need、annual_premium_current）；orchestrator.test.ts 用两个 stub module 验证顺序与回填。
- [ ] Step 3: index.ts：auth 双通道照抄 insurance-brain；modes：`generate_section {report_id, section_type}`、`client_view {report_id, section_type, language}`；流程 = fetch → computeAll → `update financial_reports set baseline` → lifecycle → LLM → assemble → draft。未知 section_type → 400。
- [ ] Step 4: `deno test` 绿；Commit `feat(cfp-brain): section lifecycle, orchestrator, routing`。

## Phase 1 — cashflow + goals(教育最小版) + insurance 迭代

### Task 5: cashflow 模块 (TDD)

**Files:** Create `modules/cashflow/{calc.ts,calc.test.ts,section.ts}`

- [ ] calc 测试用例：收支分类汇总、盈余、储蓄率、紧急预备金 months_covered/status(sufficient|partial|insufficient)/shortfall、优先复用 health_snapshots 比率、无数据回退。
- [ ] section.ts：prompt（PII 白名单：只给分类金额/比率/人口统计）+ response schema（executive_summary 四字段 + budget_commentary + emergency_fund_plan + recommendations[]，风格照 insurance section.ts）+ assemble。
- [ ] registry 注册；`deno test` 绿；Commit `feat(cfp-brain): cashflow_planning module (现金流管家)`。

### Task 6: goals 模块 (TDD)

**Files:** Create `modules/goals/{calc.ts,calc.test.ts,section.ts}`

- [ ] calc 测试：`future_cost = target×(1+infl)^n`、`projected = saved×(1+r)^n + FV(monthly_contribution)`、gap、`required_monthly = PMT`、on_track 判定、education 合计供 baseline 回填、无目标 → 空输出不报错。PMT 公式：`gap × r/12 / ((1+r/12)^m − 1)`，m 为月数。
- [ ] section.ts：prompt + schema（per-goal commentary + recommendations）+ assemble。
- [ ] 注册 + 测试绿 + Commit `feat(cfp-brain): goals_planning module (目标规划师)`。

### Task 7: insurance 模块迁移 + 迭代

**Files:** Create `modules/insurance/section.ts`（复用 `_shared/insurance` + insurance-brain 现有 section/assemble/clientView 逻辑迁入）; Modify `_shared/insurance/mapping.ts`, `insurance-brain/index.ts`

- [ ] Step 1: `mapping.buildCfpCnaInput(financials, baselineOverrides?)`：可选参数 `{liquid_assets, education_need}`；prospect 路径不传参数行为不变（既有测试守护）。新增测试：传 overrides 时 CNA 用 `liquid_assets_after_emergency` 与真实教育金。
- [ ] Step 2: cfp-brain/modules/insurance：compute = computeCna(buildCfpCnaInput(f, {来自 baseline}))；buildPrompt/assemble 从 insurance-brain 的 section.ts/assemble.ts 迁入（内容 shape 不变，含 scenarios）；输出 `recommended_premium_range` 供 synthesis。
- [ ] Step 3: insurance-brain/index.ts 删除 `cfp_section`/`cfp_client_view` 分支（注释指向 cfp-brain）；其测试同步清理。
- [ ] Step 4: 双函数 `deno test` 全绿；Commit `feat(cfp-brain): insurance_planning migrated with baseline coupling fixes`。

### Task 8: 通用 clientView

**Files:** Create `cfp-brain/clientView.ts`（泛化 insurance-brain/clientView.ts：入参 section content + section 中文/英文标签 → data_gathering/finding/recommendation 三段式 + disclaimer；数字 verbatim 纪律不变）

- [ ] 迁入 + 泛化 + 针对 cashflow content 的用例测试；`client_view` mode 接通；Commit。

## Phase 0.5(UI) — schema 驱动 SectionCard

### Task 9: UI 原语 + SectionCard 外壳

**Files:** Create `components/advisor/cfp/{types.ts,primitives.tsx,SectionCard.tsx,sectionMeta.ts}`

- [ ] primitives：`GapBar, RatioTile, KVTable, NarrativeBlock(可编辑 textarea), AssumptionsList, ScenarioCards, RecommendationList`（从现有 CfpTab JSX 提炼，编辑规则：叙述可改、数字只读）。
- [ ] sectionMeta.ts：`{section_type → {emoji, nameEn, nameZh, agent, invokeBody}}` 8 项全登记。
- [ ] SectionCard.tsx：状态机（empty/failed/stale→Generate；generating→spinner；draft/approved→children + Save/Approve/Regenerate/ClientView/PDF 按钮），行为照现有 InsuranceSectionCard，回调走 `supabase.functions.invoke('cfp-brain', …)`。
- [ ] `npm run build` 过；Commit `feat(cfp-ui): schema-driven SectionCard shell + primitives`。

### Task 10: InsuranceRenderer + CfpTab 重构

**Files:** Create `renderers/InsuranceRenderer.tsx`; Modify `CfpTab.tsx`

- [ ] 现有 insurance JSX 平移进 renderer（零视觉变化）；CfpTab 改为遍历 sectionMeta 渲染 8 张卡（未生成的显示 Generate）；旧 InsuranceSectionCard 删除。
- [ ] build 过 + Commit。

### Task 11: CashflowRenderer + GoalsRenderer + goals CRUD 小表单

**Files:** Create `renderers/{Cashflow,Goals}Renderer.tsx`；GoalsRenderer 顶部带 client_goals 增删改（advisor RLS 直写 supabase）。

- [ ] build 过 + Commit。

## Phase 2-4 — 其余模块（每个模块一个 Task，结构与 Task 5 完全相同：calc TDD → section → registry → renderer → commit）

### Task 12: investment 模块 + Renderer
按 spec §4：risk band 模型组合常量表（conservative 20/60/20/0 … aggressive 80/10/5/5 equity/bond/cash/alt）、当前配置来自 portfolio_holdings+assets 分类、drift、rebalancing_actions、期望回报取 baseline。测试：无持仓回退到"起步配置"建议。

### Task 13: retirement 模块 + Renderer
spec §4 公式（replacement 0.66、withdrawal 4%、EPF 5.5% 投影 + 年缴费 FV、PRS 投影、PMT topup）。测试：已过退休年龄、无 EPF 数据、gap≤0 三个边界。

### Task 14: tax 模块 + Renderer
LHDN relief 常量表 + 累进税表（0–30%）做成 `tax/rates2026.ts` 单文件便于年度更新；chargeable income 估算 = 年化 inflow(工资类 category) − EPF 雇员缴费近似(11%)；headroom 与 tax_saving = headroom × marginal_rate。测试：三档收入的税额、PRS 顶满节税、免责声明常量存在。

### Task 15: legacy 模块 + Renderer
净遗产、estate_liquidity（liquid+life_cover vs liabilities+估算费用 5%）、regime 分支（syariah→faraid 标记不计算；conventional→Distribution Act 1958 份额表；unknown→提示确认）、nomination/will 状态来自 planning_inputs.estate。测试：三种 regime 输出形状。

### Task 16: synthesis 模块 + Renderer
预算对账：required 各项取自 prior det（premium_topup、emergency shortfall/12、retirement topup、goals required_monthly 合计、结余投资建议）；固定优先级瀑布分配；health_score = 比率得分(50%) + 缺口覆盖度(50%) 加权，0-100。测试：over-budget 时瀑布截断顺序、无缺口满分、prioritized_plan 完整性。

### Task 17: 部署清单（用户确认后执行）
- [ ] `mcp apply_migration` 20260716000001
- [ ] `supabase functions deploy cfp-brain --no-verify-jwt`（照 insurance-brain 部署方式）
- [ ] `supabase functions deploy insurance-brain`（CFP 分支移除版）
- [ ] 生产冒烟：对一个测试客户逐 section 生成 → clientView → PDF 导出

## 验证命令

```
cd supabase/functions && deno test --allow-env   # 或逐目录
npm run build
```
