# CFP P2b — 常设项目（计划）与法定扣款（设计 + 施工单）

- 日期：2026-09-23 · 上游：`2026-09-22-cfp-financial-data-framework-design.md` §5.1、D2、§7 P2；P2a：`2026-09-24-cfp-p2a-linked-obligations-design.md`
- 范围：常设项目表 + 版本机制、旧月度行迁移、EPF/SOCSO/EIS 自动生成（D2）、资产关联选择器、所有读取方切换。
  季度/年度复检、快照、计划 vs 实际曲线 = P4；资产 2×2 = P3。

## 为什么
现在每一行 = 某个月的实际数，计划靠「选几个月求平均」。客户每月都要重录，年缴项目（路税、旅游）只能塞进某个月，
加薪也没有「从何时起」。§5.1：每个项目只定义一次（金额 + 频率 + 生效期），变化不覆盖旧数据。

## 决策
1. **两张表，两种含义。** 新表 `cashflow_items` = 计划（常设项目）；`cashflow_entries` 保持原样 = 按月实际数
   （LevelUp 继续写它，§5.2「可选实际数」）。计划只读 items；客户**没有任何 item** 时退回旧的「实际数 + basis」算法（`source='actuals'`）。
2. **生效期按月。** `effective_from` / `effective_to` 都存当月 1 日；`effective_to` 含当月，null = 持续。
   `one_off` 的 `effective_to = effective_from`（DB check）。在 `asOf` 月份生效 = `from ≤ 月(asOf) ≤ (to ?? ∞)`。
3. **两种修改。** 「更正」= 原地改（录错了）；「变更」= 从 M 月起：旧版 `effective_to = M−1 月`，新版 `effective_from = M`、`previous_id = 旧版`。
   M ≤ 旧版 `effective_from` 时只能更正。「结束」= 写 `effective_to`。删除只用于录错的项目。
4. **换算**（沿用 `ANNUAL_OCCURRENCES`）：weekly×52、monthly×12、quarterly×4、semi_annual×2、annual×1；one_off 不计入经常性合计，
   在 `one_off_items` 单独列出（asOf 前 11 个月到后 12 个月）。转移类不计入收入/开销（同 P1）。
5. **迁移：每个项目取它最近一次的数值（不取平均）。** 线上数据显示，多月客户的「几个月」其实是**同一个财务状况被拆到几个月录入**
   （Jane：薪水只在 7 月、先买后付只在 8 月；乙：电话费单独落在 7 月）。平均会把薪水 9,600 变成 4,800 ——
   这正是现金流页「某月只有一笔」警告所说的低估。改成常设项目时顺便纠正：
   - 窗口 = 该客户最新有数据的年份的**全部月份**（不再用保存的 basis，它只为旧的平均算法服务）。
   - 按（方向、类别、频率、备注规范化、关联资产/负债）分组；金额 = 该组**最后出现的月份**里的合计；
     `effective_from` = 该组在该年最早出现的月份；one_off 行变为 one_off 项目（`effective_to = effective_from`）。
   - 更早年份的行不迁移（仍是实际数）。`needs_review` 取组内任一，`review_reason` 取第一个非空。
   - 不变式（测试）：只有一个月数据的客户，迁移后的计划合计 = `annualizeCashflow`；互补的多月 = 各月之和；重复的月份 = 最新值。
   - 迁移会改变多月客户的计划数字（向上纠正），逐客户前后对照写进 PR。
   - 迁移 SQL 由脚本从快照生成，只含 uuid、类别码、除数、日期；金额和名称在 SQL 里从 `cashflow_entries` 读取。快照含客户备注，**不入库**。
6. **法定扣款（D2），计算不存储。** 仅当 `clients.has_epf = true`：
   - EPF 工资基数 = 生效中的 salary_basic + fixed_allowance + commission + bonus 的月等值（不含 overtime）。
   - 雇员 11%（≥60 岁 0%）→ `epf_employee`（O1 转移，不是开销）。雇主：常规月薪（不含 bonus）≤ 5,000 为 13%，否则 12%；≥60 岁 4%。
   - 雇主部分不经过客户口袋：**不计入现金流合计**，单独给出 `monthly_employer_epf`（P4 净资产对账时算作收入）。
   - SOCSO 雇员 0.5%、EIS 雇员 0.2%，基数 = salary_basic + fixed_allowance + commission + overtime，封顶 6,000；≥60 岁两者为 0 → `socso_eis`（O9 开销）。
   - EPF 按月向上取整到 RM1；其余保留 2 位小数；全部标注「按法定比例估算」。
   - 可支配结余：`annual_disposable_surplus = annual_surplus − 12 × 雇员 EPF`；预算瀑布用它（强制储蓄不能再分配）。
     退休模块：有法定项时 `annual_epf_contribution = 12 × (雇员 + 雇主)`，否则沿用旧规则。税务模块：有法定项时 EPF 减免用 12 × 雇员 EPF。
7. **关联。** item 可关联资产（租金 → 公寓，路税/车险 → 车）；表单只给一个可选的「关联资产」选择器
   （O2/O3 本来就由负债/保单自动生成）。净资产页每项资产显示关联项目的月净现金流（为 P3 的 2×2 铺路）。
8. **去重沿用 P2a**：`isSuperseded` 同样作用于 items。

## 数据库（Opus 已执行）
`20260925000001_cashflow_items.sql`：表、索引、RLS（与 cashflow_entries 相同：顾问全部权限、客户只读）、`set_updated_at`、`write_audit_log`。
字段：id, client_id, direction, category→cashflow_categories, name, amount>0, currency, frequency, effective_from, effective_to,
linked_asset_id, linked_liability_id, linked_policy_id, previous_id, source(advisor/kyc/client/migrated), needs_review, review_reason,
metadata, created_by, created_at, updated_at。`20260925000002_cashflow_items_backfill.sql` 由脚本生成（任务 A）。

## 施工单（Sonnet 执行，Opus 审）。**不要 commit**；只跑自己相关的测试，全量验证由 Opus 做。

### A · 核心逻辑（先做）
- `supabase/functions/_shared/cashflow/items.ts`（只 import `./periods.ts`）：`StandingItem` 类型、`monthStart`、`isActiveAt`、`activeItems`、
  `itemMonthlyAmount`、`annualizeItems(items, asOf) → CashflowTotals & { one_off_items }`、
  `reviseItem(item, changes, fromMonth) → { mode:'correct'|'version', update?, close?, insert? }`、`endItem`、
  `itemsFromMonthRows(rows, basis) → MigratedItem[]`（含 `source_ids`、`divisor`）。
- `supabase/functions/_shared/finance/statutory.ts`：常量 + `deriveStatutoryItems(items, { has_epf, date_of_birth }, asOf)`
  → `{ items: DerivedItem[], employee_epf_monthly, employer_epf_monthly, socso_eis_monthly, epf_wage_monthly, notes[] }`。
- `derived.ts`：`DerivedItem.source_type` 加 `'statutory'`；`planCashflow` 输入加 `items?`、`client?: { has_epf?, date_of_birth? }`；
  有 items 走决策 1/4/6/8，输出加 `source`、`monthly_employee_epf`、`monthly_employer_epf`、`monthly_socso_eis`、`one_off_items`。旧路径不变。
- `taxonomy/index.ts` 导出 items/statutory；重建 `api/_lib/taxonomy.mjs`（漂移测试要过）。
- `scripts/build-items-migration.ts`（读快照 JSON：`{ rows:[…], bases:{client_id: basis|null}, checksum:{count,sum} }`，输出 backfill SQL，
  开头校验 `count(*)`/`sum(amount)` 与快照一致且还没有 `source='migrated'` 的行，否则 raise）+ vitest 测试（合成数据）。
- Deno 测试：每种频率、生效期边界、one_off、两种修改、迁移不变式（含 Lim/Jane 形状：多月、年缴 bonus、转移行）、
  法定扣款（≤5k/>5k、≥60 岁、封顶 6,000、has_epf false/null → 无）、planCashflow 两条路径。

### C · 计算引擎（A 之后，与 D1/D2 并行）
`cfp-brain/db.ts`（读 items + `has_epf`）、`types.ts`、`baseline.ts`（`cashflow_source`、法定字段、`annual_disposable_surplus`、依据写进 notes）、
`household.ts`（items 合并）、`modules/retirement/calc.ts`、`modules/tax/calc.ts`、`modules/synthesis/calc.ts`（瀑布用可支配结余）、
`_shared/insurance/mapping.ts`（收入读计划）。现有测试不应变化（没有 items 时走旧路径）；新增 items 路径测试。

### D1 · 现金流页（A 之后）
`components/advisor/tabs/CashflowTab.tsx`（可拆子组件到 `components/advisor/tabs/cashflow/`）：
上方「常设项目（计划）」：收入/开销两表，行 = 类别、名称、金额+频率、月等值、「自 2026-04 起」、关联资产、待分类/已取代标记、自动项（P2a + 法定）；
操作 更正 / 变更（选生效月）/ 结束 / 删除；「显示已结束/历史版本」开关；月收入/月开销/月结余合计；one_off 单独列出。
表头勾选「受雇，有 EPF/SOCSO 扣款」写 `clients.has_epf`。新增表单：分组类别选择器（沿用）、金额、频率、生效月、名称、关联资产。
下方可折叠「实际记录（按月）」= 现有月度界面，加一行「本月计划 vs 实际」。

### D2 · 其余读取方与 API（A 之后）
`HealthScoreCard.tsx`、`NetworthTab.tsx`（资产行显示关联项目月净现金流）、`pages/Dashboard.tsx`（有 items 也算有现金流）、
`ReviewTab.tsx`（items 的 needs_review 也进待分类队列）、`utils/finance.ts`、`InsuranceGapPanel.tsx`、
`cfp/CashflowBasisPicker.tsx`（有 items 时显示「依据：常设项目」并隐藏月份选择）、`api/health.js`（当前比例用计划，月度历史仍用实际数）、
`api/kyc.js` + `api/_lib/kycMapping.js`（KYC 写 items，`source='kyc'`，`effective_from` = 提交月；资产现金流带 `linked_asset_id`）。

### E · 上线（Opus）
快照 → 生成 backfill → MCP 执行 → 逐客户核对计划合计与迁移前一致 → 全量测试 → PR（用户合并）→ 边缘函数（用户 CLI）。
