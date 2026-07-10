# 保险佬 (Insurance Brain) 智能体 — 设计规格

日期：2026-07-10
状态：设计已确认，第一期实施中
运行平台：Supabase Edge Function（分析核心）+ 自托管 n8n（通讯/表单/页面/Telegram）+ Gemini API

## 背景：Paraplanner 智能体团队路线图

Leon（一人财务顾问团队）的 paraplanner 雏形由 4 个智能体组成，分期落地：

| 期数 | 智能体 | 职责 | 状态 |
|---|---|---|---|
| **1（本期）** | 保险佬 Insurance Brain | 保单分析 + Capital Need Analysis | 实施中 |
| 2 | 小助理 Little Assistant | 客户通讯、数据收集、自动跟进 | 未开始 |
| 3 | 资产达人 Asset Expert | 资产传承、遗嘱信托、债务盘点 | 未开始 |
| 4 | 投资大师 Investment Master | 组合审查、退休压力测试、财务自由度 | 未开始 |

团队级功能（完整财务计划生成、每月主动监控 red flag）在四个智能体就位后再泛化。

架构约定（对后续智能体同样适用）：
- **n8n 管通讯**（表单、Telegram、邮件、webhook 页面），**Edge Function 管分析**（确定性计算 + LLM 报告）。
- 每个智能体一个 edge function：`supabase/functions/<agent-name>/`。
- LLM：第一期 Gemini 免费额度；报告生成接口抽象（`generateReport(...)`），后期可换 Claude API。**所有金额数字由确定性代码计算，LLM 不做算术。**
- Vercel `api/` 已满 12 function 上限，一律不新增 `api/*.js`。

## 保险佬的两个战场

### 战场 1：陌生客保单初筛（漏斗已上线）

保单 Review 漏斗已在 n8n 全部上线（见 2026-07-09-policy-review-funnel-design.md）：WF1 收集与草稿、WF2 审核页+报告页、WF3 收款确认、PR-错误报警。分析部分已抽成独立子工作流 **「PR-分析引擎」(rVdk9tdey3ZyjKFC)** —— 保险佬的插槽：

- 输入契约：`{ policies: [{id, redacted_text, needs_human}], profile: {age, gender, smoker, monthly_income_band, dependents, concerns} }`
- 输出契约：`{ policy_summaries, gaps(六大类定性评级), recommendations, overall_comment, extractions, needs_human_ids, engine, usage_total }`

本期增强：现有缺口分析是纯定性的（Gemini 评级），补上**确定性简化 CNA 数字**——引擎在抽取后调用 edge function `mode:'prospect'`，把 `cna` 段合入输出契约（engine 升 `gemini-v2+cna`），报告页渲染缺口条形图。

### 战场 2：CFP 深度分析（本期重点）

Leon 开启 comprehensive financial planning 后，客户详细资料已进 portal DB（全部以 `client_id` 为中心）：

| 数据 | 来源表 | 用法 |
|---|---|---|
| 年收入 | `cashflow_entries`（direction='inflow'，最近 period_month，按 frequency 年化） | 收入替代、CI 倍数 |
| 未偿负债 | `liabilities.outstanding_balance` 合计 | 身故偿债需求 |
| 流动资产 | `assets`（asset_type ∈ savings/fixed_deposit/money_market）`current_value` 合计 | 抵扣需求 |
| 寿险保额 | `insurance_policies`（policy_type ∈ life/investment_linked）`sum_assured` 合计 | 现有保障 |
| CI 保额 | `insurance_policies`（policy_type = critical_illness）`sum_assured` 合计 | 现有保障 |
| 医疗保障 | `insurance_policies`（policy_type = medical）存在性 | 有无标记 |
| 受抚养人 | `clients.number_of_dependants` | 教育金估算 |
| 年龄 | `clients.date_of_birth` | 报告语境 |

流程：portal ClientDetail「保险深度分析」按钮 → edge function `mode:'cfp'` → 取数 → 确定性 CNA → Gemini 生成具体中文建议（缺口金额、加保方向与额度、保费预算占收入比、身故情景现金流说明；禁止推荐具体产品）→ 组装成与现有 `draft_json` 兼容的结构写入 `policy_review_requests`（source='cfp'，status='draft_ready'）→ POST n8n `/webhook/pr-notify` → Telegram 审核 → 同一条 WF2 审核/报告/收款通道。

## 确定性 CNA 规格

默认假设（`CNA_DEFAULTS`，回显在输出 `assumptions`）：

| 参数 | 值 |
|---|---|
| 收入替代年数 | 10 年 |
| 教育金 | RM80,000/孩，4%/年通胀，10 年期 |
| CI 需求倍数 | 3× 年收入 |
| 取整 | 最近 RM1,000 |

公式：
```
education_need  = 子女数 × 80000 × 1.04^10
total_life_need = 年收入×10 + Σ负债余额 + education_need
life_gap        = max(0, total_life_need − (现有寿险保额 + 流动资产))
ci_gap          = max(0, 年收入×3 − 现有CI保额)
```

两档输入精度共用一套公式：
- **prospect 档**：年收入 = `monthly_income_band` 区间中值 × 12（band 映射：RM3,000 以下→2000、3-5k→4000、5-8k→6500、8-12k→10000、12k 以上→15000）；负债/流动资产未知记 0；现有保额来自 Gemini 抽取结果（unknown 记 0）；assumptions 标注估算口径。
- **cfp 档**：全部取库内真实数据。

输出 JSON（喂报告 prompt + 报告页条形图）：
```json
{ "assumptions": [...], "inputs": {...}, 
  "needs": {"income_replacement":n, "liabilities":n, "education":n, "total_life":n, "ci":n},
  "resources": {"life_cover":n, "ci_cover":n, "liquid_assets":n},
  "gaps": [{"key":"life","label":"人寿保障","need":n,"covered":n,"gap":n},
           {"key":"ci",...}, {"key":"medical","flag_only":true,"has_cover":bool}] }
```

## Edge Function `insurance-brain`

文件：`index.ts`（路由/auth）、`cna.ts` + `cna.test.ts`（纯函数）、`db.ts`（cfp 取数）、`report.ts`（Gemini 报告，接口可换 Claude）。

- **auth 双通道**：部署 `--no-verify-jwt`；n8n 走 `x-agent-secret: AGENT_SHARED_SECRET`（constant-time 比较）；portal 走 advisor JWT（getUser + advisors 表校验，照 send-broadcast 模式）。
- **模式**：
  - `{mode:'prospect', profile, extracted_policies}` → 纯 CNA 计算，同步返回 `cna_json`（无 LLM）。
  - `{mode:'cfp', client_id}` → 取数 → CNA → Gemini 报告 → 写 policy_review_requests → 通知 n8n → 返回 `{request_id, review_token}`。
- **健壮性**：Gemini 重试 2 次；报告失败仍写入「需人工解读」占位草稿（不丢单）；致命错误 status='failed' + error；数据不足（无收入/无保单）产出「数据不足」说明而非报错。
- Secrets：`GEMINI_API_KEY`、`AGENT_SHARED_SECRET`、`N8N_NOTIFY_WEBHOOK_URL`。

## DB 变更（ALTER，表已存在于线上）

`policy_review_requests` 加列：`source` text default 'prospect'、`agent` text default 'insurance_brain'、`client_id` uuid nullable（FK clients）、`error` text；status CHECK 扩展 `processing`/`failed`；partial index：client_id、status。CNA 结果放 `draft_json.cna`（不加新列，WF2 直接渲染 draft_json）。

注：线上库无 `profiles` 表（repo 初始迁移未应用于此项目），一切以 `clients.id` 为准，不加 profile_id。

## n8n 改造

改动前先导出 workflow JSON 备份到 `D:\n8n\workflows-backup\`。

1. **PR-分析引擎 v2**：抽取/汇总节点不动；加 HTTP 节点调 edge function `mode:'prospect'`；输出契约合并 `cna` 段。
2. **WF2 审核页**：CNA 数字只读；文字段落仍可编辑。
3. **WF2 报告页**：`draft_json.cna` 存在时渲染缺口条形图 + 假设说明；无 cna 向后兼容。
4. **新增 WF-notify**：`/webhook/pr-notify`（校验 AGENT_SHARED_SECRET）→ Telegram 发 CFP 摘要 + 审核链接。

## 不做的事（第一期 YAGNI）

小助理/资产达人/投资大师；Claude API 接入（接口留好）；完整 goals 数据模型；portal 审核 UI；WhatsApp API；在线支付网关；日历预约；多 advisor 分单；`agent_runs` 泛化表（等第 2 个智能体）。

## 验收标准

1. 陌生客漏斗回归：报告页出现 CNA 条形图、数字与 cna_json 一致、模糊文件仍标「需人工解读」、旧记录（无 cna）正常打开。
2. CFP 全程：portal 按钮 → Telegram 审核通知 → 审核页（CNA 只读）→ 发布 → 报告页数字与库内数据推算一致、建议具体到金额与方向。
3. 负面：错 token/错 secret/非 advisor JWT 被拒；坏 GEMINI_API_KEY 仍产出占位草稿；数据不全客户得到「数据不足」说明。
4. `deno test` CNA 全绿；`npm run build` 通过；n8n 手动跑通无 error 报警。
