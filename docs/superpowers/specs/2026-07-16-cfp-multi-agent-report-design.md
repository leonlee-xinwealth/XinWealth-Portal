# CFP 七大板块多智能体报告系统 — 设计规格

日期：2026-07-16
状态：设计确认，分期实施
运行平台：Supabase Edge Function（Deno）+ Gemini flash-lite + Portal（React/TS）

## 背景与目标

全方位财务诊断的七个功能模块，协同产出交付给客户的财务规划报告（CFP 框架）：

1. 现金流规划与财务预算（紧急预备金 3–6 个月生活费）
2. 风险管理与保险规划（已有 insurance-brain，本期迭代）
3. 投资规划与资产配置（风险属性 + 股债搭配）
4. 退休规划（EPF/PRS/年金养老金缺口测算）
5. 税务筹划（马来西亚 LHDN reliefs 合法节税）
6. 财富传承与遗产规划（遗嘱、信托、保险；遗产流动性）
7. 特定目标规划（子女教育金、购房、创业）

核心要求：**模块间相互协同，避免顾此失彼**。

## 关键耦合点（架构必须解决）

现有 `insurance-brain/cna.ts` 已暴露两处真实耦合：

1. **紧急预备金 vs 保险 CNA**：`buildCfpCnaInput` 把全部流动资产算作人寿缺口抵扣资源。若现金流模块又把这些流动资产划作紧急预备金，同一笔钱被双算。
2. **教育金 vs 寿险需求**：CNA 用固定 `education_per_child: 80000` 常量估教育金。有真实教育目标后应由目标模块驱动。

另一个全局约束：**总预算** —— 保费加保 + 紧急预备金补足 + 退休储蓄 + 目标储蓄 + 投资 ≤ 年度盈余，超出时必须显式排优先级，而不是各模块各说各话。

## 架构决策

### 1. Function 拓扑：单一 `cfp-brain` + 模块注册表

新建一个 edge function `cfp-brain`，内部 module registry 承载全部 7 个板块 + synthesis + 共享 baseline。`insurance-brain` 保留但仅负责 n8n 陌生客漏斗（`mode:'prospect'`）；其 `cfp_section`/`cfp_client_view` 分支迁入 cfp-brain 后删除。

理由：一次取数、一次 auth、一次 baseline、一套 section 生命周期、一次 clientView 通道；跨模块协同必须集中编排；Gemini 免费额度要求顺序生成，单 function 内串行天然合适。

已测试的纯计算抽到 `supabase/functions/_shared/`：

```
supabase/functions/
  _shared/
    llm/gemini.ts            # callGemini + schema helper（从 section.ts 抽出）
    insurance/{cna,mapping}.ts + tests   # 从 insurance-brain 移入
  insurance-brain/           # 仅保留 prospect 漏斗
  cfp-brain/
    index.ts                 # auth + 路由（generate_section / client_view / baseline）
    orchestrator.ts          # baseline + 依赖顺序编排
    baseline.ts (+test)      # computeBaseline 纯函数
    db.ts                    # 扩展取数（+goals/planning_inputs）
    sectionLifecycle.ts      # upsert generating→draft→failed helper
    clientView.ts            # 通用化二次改写 pass
    modules/
      registry.ts
      cashflow/ insurance/ investment/ retirement/
      tax/ legacy/ goals/ synthesis/
        每个：{calc,section,content}.ts + calc 单测
```

模块统一接口：

```ts
interface CfpModule {
  section_type: SectionType;
  agent: string;                       // persona
  dependsOn: SectionType[];            // 拓扑排序
  compute(f: CfpFinancials, b: FinancialBaseline, prior: ModuleOutputs): Deterministic;
  buildPrompt(det: Deterministic, ctx: PromptCtx): string;   // PII 白名单
  assemble(det: Deterministic, narrative: unknown, f: CfpFinancials): SectionContent;
}
```

**铁律不变**：所有金额由确定性 TypeScript 纯函数计算（带单测）；LLM 只叙述，不算数。PII 白名单纪律沿用（不给 LLM 姓名/保单号/机构名）。

### 2. 协同机制：FinancialBaseline + 拓扑编排 + synthesis 对账

#### FinancialBaseline

每份报告生成前由 `computeBaseline(financials)` 一次算出，存 `financial_reports.baseline jsonb`，是所有模块 calculator 的第二入参：

```ts
interface FinancialBaseline {
  version: 1;
  // 现金流
  annual_income; annual_expenses; monthly_essential_expenses; annual_surplus;
  // 紧急预备金（解决耦合 #1）
  emergency_fund_need_low;        // 月必要支出 × 3
  emergency_fund_need_high;       // × 6
  emergency_fund_actual;          // savings + FD + MM
  liquid_assets_total;
  liquid_assets_after_emergency;  // ← 保险 CNA 用它，不再用 raw liquid
  // 负债与比率（优先复用 health_snapshots，缺则重算）
  total_liabilities; monthly_debt_service; debt_service_ratio; savings_ratio; solvency_ratio;
  // 人口
  age; retirement_age; years_to_retirement; dependents; marital_status;
  // 统一经济假设（单一真相）
  assumptions: {
    epf_dividend: 0.055; inflation: 0.035; education_inflation: 0.04;
    retirement_replacement_ratio: 0.66; withdrawal_rate: 0.04; life_expectancy: 85;
    investment_return_by_band: { conservative: 0.04, ..., aggressive: 0.09 };
    client_investment_return: number;   // 按 risk_profile 选定
  };
  // 由前序模块回填
  goal_education_need?; annual_premium_current?;
}
```

#### 生成依赖顺序（拓扑，无环）

```
Pass A: cashflow → goals        # goals 产出 education_need 回填 baseline
Pass B: insurance               # CNA 用 liquid_after_emergency + goal_education_need
        investment
        retirement              # 用 baseline.client_investment_return
        tax                     # 消费 EPF/PRS(retirement) + 保费(insurance) + SSPN(goals)
Pass C: synthesis               # 预算对账 + 整体健康度
```

无环关键：各 section 只陈述自身独立需求；synthesis 作为最后一步只做优先级排序与可负担性对账，**绝不回写任何 section 的数字**；没有模块被二次运行。顾问改输入 → 整份重算（顺序、便宜）。

#### synthesis 预算约束（「避免顾此失彼」的显式落点）

确定性对账表：

```
required = premium_topup + emergency_topup + retirement_topup + goal_savings + recommended_investment
if required > annual_surplus:
  按固定优先级分配盈余：1 保障缺口 → 2 紧急预备金 → 3 退休 → 4 目标 → 5 财富增值
  输出 prioritized_plan[] + 明确标注被推迟/削减的项
```

LLM 只叙述这张表和 top-3 优先动作。

### 3. Section 注册表（2026-07-17 人设对齐后）

| section_type | persona (agent) | 人设职责一句话 |
|---|---|---|
| `cashflow_planning` | 小会计 `little_accountant` | 现金流监控与开销觉察（不带评判）；真支出 vs 资产转移；紧急预备金 |
| `goals_planning` | 目标规划师 `goal_planner` | 教育/购房/创业目标资金测算，教育金回填保险 CNA |
| `insurance_planning` | 保险佬 `insurance_brain` | 风险管控与保单分析，CNA 结合人生目标与负债 |
| `investment_planning` | 投资大师 `investment_master` | 闲置资金诊断、风险配置、10-15 年财富投射 |
| `retirement_planning` | 投资大师 `investment_master`（兼管） | 养老缺口、EPF/PRS 投影、极限压力测试（撑到 85/100）、部分提款策略 |
| `tax_planning` | 税务专家 `tax_expert` | LHDN reliefs 合法节税；从开销记录自动抓 relief |
| `legacy_planning` | 资产达人 `asset_expert` | 遗产流动性、分配就绪度、信托/绝对转让的债权隔离指引 |
| `financial_health` | 首席规划师 `chief_planner` | 预算对账瀑布、健康分、财务自由四阶段（被动收入 vs 2× 月支出） |

弃用 `asset_allocation`（资产配置属于投资规划的一部分，单人顾问无需两个重叠 section）。

**智能体对话**：每个板块支持顾问 ↔ 智能体聊天（`mode:'chat'`）与指示改稿（`mode:'revise'`，只重写叙述、数字锁定），聊天记录存 `cfp_chat_messages`；脱敏三重防线（确定性上下文无 PII、模块级 chatContext 白名单、服务端 NRIC/账号正则遮蔽）。

### 4. 各模块确定性 calculator 规格

统一 content 骨架（与现有 insurance 一致）：`{version, section_type, agent, ...typed_body, narrative 字段, assumptions[], client_view?}`。

**cashflow（现金流管家）** — 入：cashflow_entries、assets.liquidity、health_snapshots。算：分类支出、盈余、储蓄率、紧急预备金 need(×3/×6)/actual/months_covered/shortfall。出：`{monthly_income, expense_breakdown[], surplus, savings_ratio, emergency_fund:{need_low,need_high,actual,months_covered,status,shortfall}, ratios, …narrative}`。

**insurance（保险佬，迭代）** — 保留 `InsuranceSectionContent` 结构与 PII/scenarios/测试。改动仅三处：
1. `buildCfpCnaInput` 接受 baseline：`liquid_assets = baseline.liquid_assets_after_emergency`；
2. 教育金需求改用 `baseline.goal_education_need`（有真实目标时替代 80k 常量，无目标时保留常量回退）；
3. 建议保费区间输出给 synthesis（`annual_premium_current` + 加保测算）。

**investment（投资大师）** — 入：`clients.risk_profile`、portfolio_holdings 月度快照、investment_accounts、盈余、目标时间轴。**Markowitz 落地为按 risk band 的模型组合**（5 档目标 equity/bond/cash/alt 配比），不做实时均值方差优化——单人顾问 + 月度快照跑真 MVO 不负责任，且马来西亚法规禁止具体产品推荐。算：当前配置、与目标配置的漂移、再平衡动作；期望回报/波动取 baseline band 假设。出：`{risk_profile, target_allocation, current_allocation, drift[], expected_return, expected_vol, rebalancing_actions[], …narrative}`。

**retirement（退休规划师）** — 入：age/retirement_age、EPF（assets.epf_account_1/2/3）、PRS（investment_accounts.prs_sub_account_a/b）、收入支出。算：`income_need = 当前年支出 × replacement_ratio × (1+inflation)^n`；`capital_needed = income_need / withdrawal_rate`（4% 法则，寿命至 85）；EPF 投影 `bal × 1.055^n + FV(年缴费)`；PRS 同理；gap；`required_monthly_topup = PMT(gap, return, n)`。出：`{years_to_retirement, income_need_at_retirement, capital_needed, projected:{epf,prs,other}, gap, required_monthly_topup, assumptions, …narrative}`。

**tax（税务师）** — 入：应课税收入估算（cashflow inflow 年化）、EPF 缴费、保费、PRS、dependants、顾问录入 reliefs（planning_inputs.tax）。LHDN reliefs 做代码常量表（个人 RM9,000；人寿/takaful RM3,000 + EPF RM4,000；医疗/教育保险 RM3,000；PRS RM3,000；lifestyle RM2,500；SSPN、配偶、子女等；累进 0–30%），便于每年更新。算：chargeable income、每项 relief 已用 vs 上限 vs headroom、顶满 PRS/医疗保险的边际税省。出：`{chargeable_income_est, reliefs:[{name,claimed,cap,headroom}], tax_estimate, marginal_rate, optimization_opportunities:[{relief,additional_claimable,tax_saving}], …narrative, disclaimer}`。必须带「非税务代理」免责声明。

**legacy（传承顾问）** — 入：assets、liabilities、marital_status、dependents、保险（遗产流动性）、顾问录入 `planning_inputs.estate`（regime conventional/syariah/unknown、will/nomination 状态）。马来西亚无遗产税，聚焦：净遗产、**遗产流动性**（liquid + life_cover 能否覆盖即时债务/费用）、分配就绪度、EPF/保险 nomination、未成年子女信托需求。**faraid 只标记不计算份额**（宗教敏感，需 Syariah 确权）；非穆斯林可确定性展示 Distribution Act 1958 法定份额。出：`{net_estate, estate_liquidity:{obligations,available,status}, distribution:{regime,will_status,intestate_note}, nominations:{epf,insurance}, trust_recommendation, …narrative}`。

**goals（目标规划师）** — 入：新表 `client_goals`。每目标：`future_cost = target × (1+inflation)^n`（教育 4%、房产 4%、创业自定义）、`projected = current_saved × (1+return)^n`、gap、`required_monthly = PMT(...)`。教育目标合计回填 `baseline.goal_education_need`。出：`{goals:[{type,name,target_year,future_cost,projected_savings,gap,required_monthly,on_track}], total_required_monthly, …narrative}`。

**synthesis（首席规划师）** — 入：全部模块输出 + baseline。算：预算对账表 + 固定优先级分配 + 加权健康分（比率 + 各缺口覆盖度）。出：`{health_score, ratios_summary, budget_reconciliation:{surplus, required, over_budget, prioritized_plan[]}, top_priorities[], …narrative}`。

### 5. 数据缺口决策

- **目标**：新建关系表 `client_goals`（需 CRUD、多行、喂计算，不塞 metadata）。列：`id, client_id, advisor_id, goal_type(education/house/business/other), name, target_amount, target_year, current_saved, monthly_contribution, inflation_override, priority, metadata jsonb, created_at, updated_at` + advisor RLS（照现有 policy 模式）。
- **风险问卷**：`clients.risk_profile` enum 足够（模型组合按 band 选择）。不建问卷引擎（YAGNI）。
- **税务/遗产输入**：`financial_reports.planning_inputs jsonb`，结构 `{tax:{reliefs…}, estate:{regime,will_status,epf_nomination,…}, assumption_overrides:{…}}`。

### 6. UI 策略：schema 驱动 SectionCard + 渲染器注册表

CfpTab 现有 765 行手写一个 card；8 个 section 不能线性膨胀。改为：

- 通用 `<SectionCard>` 外壳：persona 名、状态徽章、generate/regenerate/approve/clientView/PDF、generated_at、折叠。
- 共享原语：`<GapBar>`、`<RatioTile>`、`<KVTable>`、`<NarrativeBlock>`、`<AssumptionsList>`、`<ScenarioCards>`。
- `renderers` 映射（section_type → 渲染组件）；现有 insurance JSX 重构成第一个 `InsuranceRenderer`。
- 编辑规则不变：叙述文字可改，数字锁定（改客户数据后重算）。

### 7. 分期（每期可独立部署）

- **Phase 0 地基**：迁移 + cfp-brain 骨架（auth、扩展取数、computeBaseline+单测、sectionLifecycle、registry、通用 clientView）+ UI schema 驱动改造 + insurance 转 renderer。
- **Phase 1**：insurance 迭代 + cashflow + goals 最小版（仅教育目标 → baseline 回填），三者绑定发布（互为依赖）。
- **Phase 2**：goals 完整版 + investment。
- **Phase 3**：retirement + tax。
- **Phase 4**：legacy + synthesis (financial_health)。

### 8. 迁移计划（SQL）

1. `report_sections.section_type` check 约束扩展为 8 值（drop + add；`asset_allocation` 弃用，历史行如有先处理）。
2. `financial_reports` 加列：`baseline jsonb`、`planning_inputs jsonb`。
3. 新表 `client_goals` + RLS。

baseline 存 `financial_reports.baseline` 列而非 report_sections 行：它是编排共享输入，不是面向客户的 section。

## 下一轮 Roadmap（已确认顺延）

- 每月第一个工作日主动监控 + red flag 汇报：cfp-brain `mode:'monitor'`（复用 computeAll、对比上期 baseline）+ n8n 定时工作流 + Telegram；red flag 规则清单届时另行设计。
- 保险佬「三家保司报价比较」（复用库内 insurers/plans/plan_tiers/riders 表）与全天候保险问答。
- 税务专家 M form 生成、企业主薪酬结构专项。
- 资产达人资产分配导图 (illustration) 与规划前后 Before/After 对比报告。
- 小会计月度存款目标监督（依赖主动监控链路）。

## 风险与合规

- **Gemini 免费额度**：整份报告 8+ 次调用（含 clientView 16+）。orchestrator 逐 section 落库，失败单 section 重试（现有 lifecycle 已支持），不整份重来。
- **合规纪律**：不推荐具体产品；税务模块带非税务代理免责；faraid 只标记不计算；全部报告带 licensed-advisor disclaimer；PII 白名单进 LLM。
- **`_shared` 抽取**是唯一触及已测试代码的动作：迁移后先跑 insurance 现有测试确认零回归。

## 验收标准

1. `deno test` 全绿（baseline + 各模块 calc + 既有 insurance 测试零回归）。
2. `npm run build` 通过。
3. 每个 section 可单独生成/重试/定稿；报告级 baseline 在首个 section 生成时落库。
4. synthesis 的预算对账在 `required > surplus` 时输出显式优先级计划。
5. insurance CNA 不再双算紧急预备金；有教育目标时寿险需求引用真实目标数字。
6. 生产部署（migrations + edge function deploy）由 Leon 确认后执行。
