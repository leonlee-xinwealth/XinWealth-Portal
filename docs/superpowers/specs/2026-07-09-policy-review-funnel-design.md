# 保单 Review 自动化漏斗 — 设计规格

日期：2026-07-09
状态：设计已确认，待实施
运行平台：自托管 n8n（https://n8n.xinwealth.com，本机 Docker）+ Supabase + Gemini API

## 背景与目标

小红书私信有「保单 review」询问。目标：把「收集资料 → 分析 → 出报告 → 转化付费咨询 → 收款 → 约时间」做成半自动流水线，advisor（Leon）只在三个点人工介入：**发起（发链接）、审核（改草稿）、确认收款与约时间**。其余全自动。总运行成本 RM0（Gemini 免费层、n8n 自托管、DuitNow 零手续费）。

## 已确认的关键决策

| 决策点 | 选择 |
|---|---|
| 触达渠道 | 混合：Leon 手动发链接（小红书/WhatsApp），客户进表单后全自动 |
| 报告产出 | Gemini 生成草稿 → Leon 审核/修改 → 发布（不发未审核内容） |
| 收集表单 | V1 用 n8n Form（支持文件上传）；验证转化后迁 portal 精美版 |
| 报告交付 | 网页版专属链接（token 保护、30 天有效、手机优先），Leon 手动转发给客户 |
| 收款 | DuitNow QR / 银行转账，Leon 在 Telegram 点「✅ 确认收款」人工确认 |
| AI 引擎 | Google Gemini（免费额度起步，AI 节点可随时切换供应商） |
| 预约 | 手动：确认收款后 Leon 自己在 WhatsApp 和客户约时间 |

## 数据模型（Supabase）

新表 `policy_review_requests`：

- `id` uuid PK、`token` text unique（报告/审核链接用）
- 客户资料：`name`、`whatsapp`、`email`、`age`、`gender`、`smoker`、`monthly_income`、`dependents`、`concerns`
- `policy_files` jsonb（Supabase Storage `policy-reviews` 私有桶的文件路径数组）
- `draft_json` jsonb（AI 草稿：保单摘要 + 缺口分析 + 建议）
- `final_report` jsonb（审核后的定稿）
- `status` text：`submitted → draft_ready → approved → viewed → payment_claimed → paid`
- 时间戳：`created_at`、`approved_at`、`paid_at`

状态流转全部由 n8n 更新；将来 advisor portal 可直接读这张表做看板。

## 工作流设计（3 条 n8n workflow）

### WF1 收集与草稿（n8n Form Trigger）

1. 表单字段：姓名、WhatsApp、Email、年龄、性别、是否吸烟、月收入、受抚养人、现有保单上传（多文件 PDF/图片）、最关心的问题（单选：保费太贵/保障够不够/理赔担忧/其他）
2. 提交 → 写入 Supabase + 文件传 Storage
3. Gemini 两步调用：(a) 逐份读保单文件，提取险种/保额/保费/期限（读不出则标注「需人工解读」）；(b) 结合财务数据生成中文报告草稿（保单总览表、六大类保障缺口、2-3 条建议方向、不含具体产品推荐）
4. 草稿存库，状态 `draft_ready`
5. Telegram 通知 Leon：客户摘要 + 审核链接

### WF2 审核页 + 报告页（Webhook 渲染 HTML）

- **审核页** `GET /webhook/pr-review?t=<token>`：手机友好，草稿各段落可编辑（textarea），底部「✅ 通过并发布」→ POST 保存定稿、状态 `approved`、Telegram 把**客户报告链接**发给 Leon（由 Leon 手动转发客户，顺势聊天）
- **报告页** `GET /webhook/pr-report?t=<token>`：XinWealth 品牌样式、手机优先。结构：保单总览 → 缺口分析（可视化条形）→ 建议 → **付费规划咨询介绍（价格+内容）→ DuitNow QR → 「我已付款」按钮 → WhatsApp 直达按钮**。首次访问记状态 `viewed`
- 「我已付款」→ 状态 `payment_claimed` + Telegram 通知 Leon，消息带「✅ 确认收款」inline 按钮

### WF3 收款确认（Telegram Trigger）

- Leon 核对银行入账后点「✅ 确认收款」→ 状态 `paid` + `paid_at`
- 自动给客户发确认邮件（Gmail 节点）：「已收到款项，顾问将在 24 小时内与您联系安排咨询时间」
- Telegram 回执提醒 Leon：「记得 WhatsApp 客户约时间」（时间由 Leon 手动约，不接日历系统）

## 安全与门禁

- 报告/审核页走 `/webhook/*` 路径（SSO 网关已放行），靠**不可猜测 token**（uuid v4+）保护；审核页与报告页 token 分开
- 报告链接 30 天过期（页面检查 `created_at`）
- 保单文件在私有桶，页面不直接外链原文件

## 异常处理

- Gemini 调用失败 → 重试 2 次 → 仍失败则 Telegram 报警，状态停在 `submitted` 不丢单
- 文件不可读 → 草稿相应段落标「此保单需人工解读」，照常进入审核
- 所有 workflow 配置 error workflow：任何节点报错 → Telegram 通知

## Leon 需准备的材料

1. Telegram Bot token + 自己的 chat ID（可复用营销站现有 bot）
2. Gemini API key（aistudio.google.com 免费申请）
3. DuitNow QR 图片、付费咨询的定价与介绍文案
4. 报告页免责声明文案（分析仅供教育参考，不构成具体产品建议）

## 隐私与 Token 策略（2026-07-10 补充，已实现）

免费层 Gemini 的数据会被 Google 用于产品改进，且保单动辄几十页、含大量 PII。统一原则：**原始文件永不出本地**。

```
客户上传（PDF/照片）→ 全部存本地 Supabase 私有桶（到此为止）
  → 本地文字提取：PDF 文字层用 n8n Extract From File；照片用 Tesseract OCR 边车（compose 内网）
  → 本地关键页筛选：15 行窗口按关键词打分（Sum Assured/保额/Premium…），只保留相关段落
  → 本地正则脱敏：姓名/IC/电话/邮箱/地址/保单号 → «占位符»，映射表只存本地库
  → Gemini 只收到化名后的关键段文本；报告渲染时本地还原真名
```

- OCR 读不出（模糊照片/扫描 PDF）→ 标 `needs_human`，审核页内嵌原图（本地代理 `/webhook/pr-file`）供顾问人工补充，绝不降级直传图片
- 收入以档位收集（不存精确数字）
- 实测：单客户 3 份保单全流程约 2,000 tokens；隐私审计（姓名/NRIC/电话/邮箱/保单号五项）零泄漏

## 实现偏差记录（2026-07-10）

- **分析引擎为可插拔子工作流 `PR-分析引擎`**（为 Leon 未来的保单分析智能体预留插槽）：契约=输入 `{policies[], profile}`（已脱敏）→ 输出 `{policy_summaries, gaps, recommendations, overall_comment, engine, usage_total}`。保单摘要由代码从抽取 JSON 确定性生成（防 LLM 数字幻觉/循环退化），Gemini 只做缺口评估与建议
- 表单地址为 n8n UUID 路径（v2.6 formTrigger 不支持自定义路径），网关提供短链接 **https://n8n.xinwealth.com/apply** 302 跳转
- 收款确认后不发客户邮件（Gmail OAuth 配置成本高，YAGNI）：Telegram 回执提醒 Leon 手动 WhatsApp 客户
- 预约手动进行（Leon 决策），不接日历系统

## 不做的事（YAGNI）

- 不做在线支付网关（V1 手动确认足够）
- 不做日历预约系统（手动约）
- 不做多 advisor 分单（目前只有 Leon 用）
- 不改 portal 代码（V1 完全跑在 n8n + Supabase）

## 验收标准

1. 用测试资料走完全程：填表 → 收到 Telegram 草稿通知 → 审核页改稿发布 → 打开报告页 → 点「我已付款」→ Telegram 确认收款 → 客户收到确认邮件，Supabase 状态逐步流转正确
2. 无 token / 错 token 访问审核页与报告页 → 拒绝
3. 上传一张模糊图片 → 草稿出现「需人工解读」标注且流程不中断
