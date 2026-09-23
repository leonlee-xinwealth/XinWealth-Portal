# CFP P4 — 复检、快照、对账与监控（设计 + 施工单）

- 日期：2026-09-23 · 上游：框架 spec §5.2–5.3（D4、D5）；P2b（常设项目、法定扣款）；P3（`asset_valuations`）
- 目标：规划不是一次性的。客户每季度在客户端更新余额，顾问批准后写入；每年全面复检；每次批准留下快照；
  顾问看到净资产计划 vs 实际、各比例走势、未解释差额，并收到提醒。

## 决策
1. **`reviews` 表**：`client_id, kind (quarterly|annual), period_end date, status (draft|submitted|approved|rejected), submitted_by (client|advisor),
   submitted_at, approved_by, approved_at, payload jsonb, advisor_note`。
   `payload = { assets:[{asset_id, prev_value, value}], liabilities:[{liability_id, prev_balance, balance, prev_rate, interest_rate, monthly_payment}], notes }`。
   客户端通过 `api/levelUp.js`（Vercel 函数已满额，不新增文件）提交；顾问端直接写（RLS）。
2. **批准才生效（D5）。** 批准时：先 upsert `asset_valuations`（`source='review'`，日期 = `period_end`），再更新 `assets.current_value/valuation_date`
   （P3 触发器只覆盖 `auto` 行，所以复检值保留）；负债同理写 `liability_balances`（新表，结构同估值表，含利率/月供）后更新 `liabilities`；
   最后写一条 `health_snapshots`（加列 `review_id`、`unexplained_gap`；明细进 `raw_metrics`）。
3. **快照 = 一个共享函数** `_shared/finance/snapshot.ts` `computeSnapshot({assets, liabilities, items, policies, client, asOf})`：
   净资产、总资产/负债、流动性比率、偿债比率（DSR、非房贷 DSR）、储蓄率、紧急基金月数、寿险倍数、投资/净资产、被动收入覆盖率 ——
   与 HealthScoreCard / api/health.js 同一口径（都改为调用它）。
4. **对账** `_shared/finance/reconcile.ts` `reconcile(prev, curr, plan, months)`：
   - 可解释 = 月数 × (计划月结余 + 月供中的本金 + 雇主 EPF) + Σ 资产市场变动；
   - 资产市场变动 = 期间估值变化 − 关联到该资产的转移类常设项目 × 月数（EPF 账户合计扣雇员+雇主 EPF）；A 类不计市场变动；
   - 未解释差额 = ΔNW − 可解释；各分量都返回。存在未关联资产的转移项目时加说明「未关联的定期投入会让对账失真」。
5. **提醒** `_shared/finance/alerts.ts` `computeAlerts(...)`：未解释差额 > max(RM 5,000, 5% 净资产)；紧急基金 < 3 个月；
   DSR 比上次快照升高 ≥ 5 个百分点或 > 60%；季度复检距上次批准 > 92 天（到期）/ > 120 天（逾期）；年度 > 365 天；
   负债利率为估算（D1）→「复检时请更新利率」；有待审核的复检。每条 `{code, severity, message_zh, message_en, client_id}`。
6. **界面**
   - 客户端 LevelUp → 「季度复检」：预填当前资产/负债（值、利率、月供），无变化一键确认；可选填上月实际开销（仍写 `cashflow_entries` 实际数）；
     提交后显示「等待顾问审核」。到期时首页横幅提醒。
   - 顾问 ReviewTab：待审核复检（前后对比表、批准/退回+备注）、顾问代填、年度全面复检清单（逐项确认常设项目/保单/目标与假设 → 跳到 CFP 报告生成）。
   - 客户详情新增「监控」：净资产 实际（快照）vs 计划曲线（上次快照起按可解释月增量外推）、比例走势、各期未解释差额。
   - Dashboard：「需要关注」卡加入 alerts（按严重程度排序）。

## 施工单（Sonnet 执行，Opus 审）。不要 commit；禁止 git stash/checkout/reset/restore/clean。
### A · 共享逻辑 + 迁移（先做）
`snapshot.ts`、`reconcile.ts`、`alerts.ts` + Deno 测试；迁移 `20260927000001_reviews_snapshots.sql`（Opus 执行）：`reviews`、`liability_balances`（+ 负债余额变化时自动记录的触发器，同 P3）、
`health_snapshots` 加列、RLS。
### B · 顾问端（A 之后）
ReviewTab 审核 + 代填 + 年度清单；`components/advisor/tabs/MonitorTab.tsx`（recharts）并挂到客户详情；Dashboard alerts；HealthScoreCard 改用 `computeSnapshot`。
### C · 客户端（A 之后）
`components/LevelUp.tsx` → 季度复检；`api/levelUp.js` 加 `mode:'review'`（预填数据 GET、提交写 `reviews`）；首页到期横幅；`api/health.js` 改用 `computeSnapshot`。
