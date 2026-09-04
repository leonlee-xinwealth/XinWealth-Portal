# 交接文档 · CFP 多智能体财务规划报告系统

**日期**：2026-07-20
**状态**：核心系统已上线；PDF 贵宾级美学重塑进行中（等用户选定方向，尚未 push）
**线上 commit**：`898d96b`（Vercel 生产 READY）
**Supabase 项目**：`lqnnboepevcivcxvkoct`（团队 `leonlee-xinwealth`）

---

## 1. 一句话概述

在 XinWealth Portal（Supabase + React/Vite + Vercel）里，为一人顾问团队实现了**七大 CFP 板块 + 首席统筹的多智能体财务规划系统**：每个板块一个「人设」智能体，确定性数字由 TypeScript 纯函数算出、Gemini 只负责叙述；八个板块通过**共享基线 + 统一预算瀑布**相互联动（避免顾此失彼），最终合成**一份贵宾级 PDF 报告**交付客户。顾问可就任一板块与其智能体**对话/指示改稿**。

---

## 2. 已上线（生产可用）

### 数据库（迁移 `supabase/migrations/20260716000001_cfp_reports_foundation.sql`，已 apply）
- `report_sections.section_type` 约束扩展为 8 值
- `financial_reports` 加 `baseline jsonb` + `planning_inputs jsonb`
- 新表 `client_goals`（目标规划数据，advisor RLS）
- 新表 `cfp_chat_messages`（板块级 顾问↔智能体 聊天，RLS）

### Edge Functions（Supabase，均 `--no-verify-jwt`，自带 auth）
- **`cfp-brain`**：8 板块模块 + 编排 + `generate_section` / `client_view` / `chat` / `revise` 四个 mode
- **`insurance-brain`**：精简为仅 n8n 陌生客漏斗（`mode:'prospect'`）

### 前端（Vercel `xin-wealth-portal`，commit 898d96b READY）
- CFP 工作台 `components/advisor/tabs/CfpTab.tsx`：报告选择器 + 目标 CRUD + 8 张 section 卡 + 「导出完整报告」按钮
- Schema 驱动 `components/advisor/cfp/`：SectionCard 外壳 + 8 个 renderer + ChatPanel + primitives（含 TwoStepButton 两步确认）
- 统一报告导出 `pdf/cfpReport/`（react-pdf，CJK 字体）

### 测试
- `cd supabase/functions/cfp-brain && deno test` → **167 passed**
- `cd supabase/functions/_shared/insurance && deno test` → 16 passed
- `npm run build` 通过

---

## 3. 八个人设智能体（section_type → agent → 职责）

| section_type | agent | 人设 | 核心产出 |
|---|---|---|---|
| cashflow_planning | little_accountant | 小会计 | 收支/储蓄率/紧急预备金；**真支出 vs 资产转移**（linked_asset_id 剔除）；觉察不评判 |
| goals_planning | goal_planner | 目标规划师 | 目标资金测算（PMT）；教育金回填保险 CNA |
| insurance_planning | insurance_brain | 保险佬 | CNA（用**预留紧急预备金后**的流动资产 + 真实教育金）；场景化 |
| investment_planning | investment_master | 投资大师 | 风险五档模型组合、漂移/再平衡、10-15 年财富投射 |
| retirement_planning | investment_master | 投资大师（兼管） | EPF/PRS 投影、4% 法则、逐年提款压力测试（撑到 85/100） |
| tax_planning | tax_expert | 税务专家 | LHDN reliefs、从开销自动抓 relief、节税机会 |
| legacy_planning | asset_expert | 资产达人 | 遗产流动性、分配就绪、破产隔离/绝对转让 flag |
| financial_health | chief_planner | 首席规划师 | 预算对账瀑布、健康分、财务自由四阶段 |

---

## 4. 核心机制（务必理解）

### 4.1 确定性铁律
所有金额由 `supabase/functions/cfp-brain/modules/*/calc.ts`（纯函数 + 单测）算出；LLM（`section.ts` 的 prompt）**只叙述、不算数**。PII 白名单：姓名/保单号/机构名绝不进 prompt。

### 4.2 共享基线 + 联动预算（「避免顾此失彼」的落点）
- `baseline.ts` `computeBaseline()` 一次算出 `FinancialBaseline`（收入/支出/紧急预备金/预留后流动资产/统一经济假设）
- `orchestrator.ts` `computeAll()` 按 `SECTION_ORDER` 跑全部模块；synthesis 的预算瀑布回填 `baseline.budget_summary`
- `budgetContext.ts`：每个板块 prompt 收到**自己那一行的分配额/顺延额** + 统一指令（建议必须落在分配额内、超出明说顺延、优先级 保障→紧急→退休→目标→增值）
- 效果：不会出现「保险叫加 500、退休又叫存 500 而盈余不够」

### 4.3 对话/改稿（`chat.ts` + index.ts 的 chat/revise mode）
- 脱敏三重防线：det/baseline 无 PII → 模块 `chatContext` 白名单 → 服务端 NRIC/账号正则遮蔽
- revise 只重写叙述字段，确定性数字由 assemble 重新盖章、不变

---

## 5. ⚠️ 进行中：PDF 贵宾级美学重塑（T14，尚未 push）

**用户诉求**：报告要「呈现给贵宾客户、要有质感」。**约束：视觉定稿前不 git push**（本地迭代）。

### 已完成
- 下载高端字体到 `public/fonts/`：`NotoSerifSC-VF.ttf`（衬线标题，25MB）、`NotoSansSC-VF.ttf`（无衬线，17MB）——**均未提交 git**
- 字体渲染验证通过（可变字体在 react-pdf 正常，中英文无乱码）
- **三个方向样张已渲染**（各 封面 + 整体健康页），脚本 `pdf/cfpReport/samples.tsx`：
  - **A 私人银行经典**：象牙白纸底 + 衬线标题 + 金色小型大写字母 + 水印大数字 + 金发丝线 —— **AI 推荐**（最贴合贵宾定位）
  - **B 现代轻奢**：近白 + 大留白 + 巨大轻量数字 + 单一金点
  - **C 杂志编辑风**：深蓝色块 + 衬线 + 金色引言拉框
- 样张 PDF/PNG 在临时目录 `…/scratchpad/sample-A|B|C.pdf`

### ⏭️ 下一步（用户选定方向后）
1. 把选定方向应用到全 22 页报告（改 `pdf/cfpReport/CfpReportPdf.tsx` + `viz.tsx`）
2. 已确认一并做：**封面深度重做、目录页、每页页眉页脚、孤儿页修复、税务/传承补图、枚举本地化+千分位**（详见 `~/.claude/plans/1-little-modular-conway.md` 的 T14.B）
3. 语言：正文默认英文；**生成时询问语言**，需中文再产中文正文（模块中文 narrative 属较大改动，本轮先留 hook）
4. 验证：renderSmoke 三 fixture → pypdfium2 全页 PNG 逐页目检 → `npm run build`
5. **用户视觉签字后**才 `git add public/fonts pdf/cfpReport && commit && push`

### 设计审核已发现、待本轮修的问题
- 🔴 退休页后有**孤儿空白页**（AssumptionsList 尾行被挤到新页）→ 加 `wrap={false}`/`minPresenceAhead`
- 🟡 税务、传承两页**纯文字无图**（其它 6 页都有图）→ 补减免条形 / 遗产流动性覆盖条
- 🟡 传承叙述**裸数字**（791500 应为 RM 791,500）→ PDF 显示层千分位兜底
- 🟡 表格用原始枚举（epf_account_1/mortgage/property；列头 Type）→ 中文标签映射

### 临时文件（本地，需清理或纳入）
- `pdf/cfpReport/samples.tsx`（样张脚本，可留作参考或删）
- `pdf/cfpReport/_fontprobe.tsx`（字体探针，**删**）
- `pdf/cfpReport/renderSmoke.tsx`（无头渲染 harness，**保留**——迭代靠它）

---

## 6. 关键文件地图

```
supabase/functions/
  _shared/insurance/{cna,mapping}.ts   # 确定性 CNA（insurance-brain 与 cfp-brain 共用）
  _shared/llm/gemini.ts                # callGeminiJson（provider 可换）
  cfp-brain/
    index.ts            # auth + 四 mode 路由
    baseline.ts         # FinancialBaseline
    orchestrator.ts     # computeAll（联动核心）
    budgetContext.ts    # 预算对齐 prompt 块
    chat.ts             # 对话/改稿 + 脱敏
    db.ts               # 取数（PII-free）
    modules/<8个>/{calc,calc.test,section}.ts + registry.ts
components/advisor/
  tabs/CfpTab.tsx
  cfp/{SectionCard,ChatPanel,primitives,sectionMeta}.tsx + renderers/*
pdf/cfpReport/          # 统一报告 PDF（本轮重塑对象）
pdf/insuranceReport/    # 保险单章 PDF + fonts.ts（字体注册）
docs/superpowers/specs/2026-07-16-cfp-multi-agent-report-design.md   # 设计规格
~/.claude/plans/1-little-modular-conway.md                            # 全程实施计划（T1-T14）
```

---

## 7. 常用命令

```bash
# 测试
cd supabase/functions/cfp-brain && deno test
cd ../_shared/insurance && deno test
npm run build

# 部署（CLI 已 login + link 到 lqnnboepevcivcxvkoct）
npx supabase functions deploy cfp-brain --no-verify-jwt
npx supabase functions deploy insurance-brain --no-verify-jwt

# PDF 无头渲染 + 目检
npx tsx pdf/cfpReport/renderSmoke.tsx long <out.pdf>   # long/normal fixture
# 真实数据：先 node 拉 report_sections/baseline/assets/liabilities → JSON，再 tsx 渲染
# PNG 目检：python + pypdfium2（scale 1.3）
```

---

## 8. 已知问题 / Backlog

- **旧存 synthesis 内容含 `over_budget` 字样**：净化 prompt 已部署，但存量数据需**重新生成该板块**才消失
- **正文全英文**：中文客户版需各模块 prompt 支持 language 参数产中文 narrative（较大）
- **assumptions 常量双语化**：模块 assemble 输出 {en,zh}
- **下一轮 roadmap**：每月第一个工作日主动监控 + red flag（cfp-brain `mode:'monitor'` + n8n + Telegram）；保险佬三家保司报价比较；税务 M-form；资产达人分配导图 + Before/After

---

## 9. Git 状态

- `origin/main` = `898d96b`（全部已推，Vercel 绿）
- 未提交（**T14 本地work，勿误提交无关项**）：
  - 新增待纳入：`public/fonts/NotoSerifSC-VF.ttf`、`NotoSansSC-VF.ttf`、`pdf/cfpReport/{samples,_fontprobe,renderSmoke}.tsx`（定稿时选择性提交）
  - 会话前既有、与本任务无关：`components/Cashflow.tsx`、`components/LevelUp.tsx`、`.claude/*`、`skills-lock.json`、`deno.lock` —— **提交时用精确 `git add <path>`，勿 `git add -A`**
```
