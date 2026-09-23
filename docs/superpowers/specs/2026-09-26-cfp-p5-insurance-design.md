# CFP P5 — 保险：统一缺口模块、保单状态与提名、修好客户端（设计 + 施工单）

- 日期：2026-09-23 · 上游：框架 spec §3.5、D3；P2a（保费 → 现金流）
- 现状（2026-09-23 调查）：三套缺口公式互相矛盾 —— 客户端 `components/Insurance.tsx`（死亡/TPD/意外 = 收入×10，重疾 3×/早期 1.5×，医药固定 1,000,000）、
  顾问 `InsuranceGapPanel.tsx`（寿险 = 收入×10，重疾 **4×**，不扣负债/流动资产）、共享 `_shared/insurance/cna.ts`（PDF/cfp-brain/insurance-brain：
  寿险 = 收入×10 + 负债 + 教育 − 已有保障 − 流动资产，重疾 3×，医药只看有没有）。客户端页面永远显示 0：`api/health.js` 返回 `insurances`，页面读 `insurance`，
  且只给 Insurer/Plan/Sum Assured/Premium，没有各保障项目。保单没有状态、提名、MRTA 关联、团保标记。

## 决策
1. **只有一个公式：`_shared/insurance/cna.ts`。** 顾问面板、客户端、PDF 都读它的输出，不再各算各的。数值口径沿用 PDF 已经在用的：
   - 身故需求 = 收入×10 + 负债（扣除被 MRTA/MLTA 覆盖的那笔房贷余额）+ 教育 − 流动资产；缺口 = 需求 − 身故保障。
   - TPD：需求同身故；保障 = TPD 附约/保额（没有单独 TPD 项目的寿险按身故保额计，标注「假设含 TPD」）。
   - 重疾 = 收入×3（顾问面板的 4× 改为 3×）；早期重疾只显示保障额，不单独算需求。
   - 医药：有/没有 + 年限额；年限额 < RM 1,000,000 时提示「年限额偏低」。
   - 意外：只显示保障额（补充性质，不算需求）。
   - 只计 `status = in_force`（或空）的保单；团保计入保障但标注「离职即失效」，并另给「不含团保」的缺口。
   - 收入 = 计划口径（P2b `planCashflow`，有常设项目用常设项目）的年收入。
2. **保单字段（只新增，不改 enum）**：`insurance_policies` 加 `status`（in_force / lapsed / paid_up / surrendered / matured，默认 in_force）、
   `nomination_type`（trust / hibah / conditional / none）、`is_group_employer` bool、`covers_liability_id`（MRTA/MLTA → 房贷）；
   `liabilities` 加 `linked_policy_id`（保单贷款 → 保单）。`beneficiaries jsonb` 沿用，格式 `[{name, relationship, share_pct}]`。
   `policy_type` enum 不改（改名会让已部署的读取方同时失效）；MRTA = life + `covers_liability_id`，团保 = 标记。
3. **联动**：非 in_force 的保单不产生保费（P2a `derivePremiumItems` 加状态过滤）；paid_up 保单保障仍计入、无保费。
   现金价值只在保险页显示为「参考 · 未计入净资产」（D3）。退保/满期：提示把所得记为一次性收入（I3 `policy_surrender_maturity`）。
4. **客户端保险页**：`api/health.js` 返回 `insurance`（修正 key）+ 统一模块的 `insurance_gap`；`Insurance.tsx` 改为渲染它，删掉页面里的公式。

## 施工单（Sonnet 执行，Opus 审）。不要 commit；只跑自己相关的测试。

### A · 共享模块 + DB（先做）
- 迁移 `20260926000001_insurance_policy_status.sql`（Opus 执行）。
- `cna.ts` / `mapping.ts`：按决策 1 扩充输出 `{ death, tpd, ci, ci_early_cover, medical, pa, excluding_group }`，每项 `{ need?, cover, gap?, notes[] }`；
  状态过滤、MRTA 抵减、团保。保持 PDF 与 cfp-brain 现有读取字段兼容（新增字段，不删旧字段）；更新受影响测试并注明原因。
- `derived.ts` `derivePremiumItems`：只计 in_force（或空）保单。
- 若 `cna.ts` 满足导入规则（零 import 或只 import 带 `.ts` 的相对路径），在 `taxonomy/index.ts` 导出并重建 `api/_lib/taxonomy.mjs`，供 `api/health.js` 使用。

### B · 顾问端（A 之后）
`InsuranceGapPanel.tsx` 改读统一模块；`InsuranceTab.tsx` 表单加状态、提名类型、受益人列表（姓名/关系/比例，合计须 100%）、团保、覆盖的房贷（负债选择器）；
列表显示状态 chip、现金价值「未计入净资产」；`NetworthTab.tsx` 保单贷款负债可选关联保单。

### C · 客户端（A 之后）
`api/health.js` + `services/apiService.ts` + `types.ts` + `components/Insurance.tsx`：修 key、返回并渲染 `insurance_gap`（各项需求/保障/缺口 + 说明），
删除页面内公式；`apiService.ts:636` 的 `totalSumAssured = 0` 改为真实合计。
