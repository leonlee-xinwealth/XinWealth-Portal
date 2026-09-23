# CFP P2a — 月供与保费从源头进入现金流（设计 + 施工单）

- 日期：2026-09-24 · 上游 spec：`2026-09-22-cfp-financial-data-framework-design.md`（D1、§3.2 O2/O3、§3.4）
- 范围：P2a 只做「负债 → 月供」「保单 → 保费」自动计入现金流、D1 估算、去重、界面展示。
  常设项目/生效日期/EPF 自动生成/资产持有成本关联 = P2b，不在本单。

## 为什么
纸上演练：乙的两笔贷款月供和 ILP 保费不在现金流 → 结余 +RM500～1,000 实为赤字约 −RM1,200；
甲 6 笔负债没月供 → 债务比率显示 0%。根因：月供和保费只能手工在现金流里再录一遍。

## 决策
1. **计算，不存储。** 月供和保费在读取时由负债/保单推导（纯函数），不写进 `cashflow_entries`。唯一数据源，无同步问题。
2. **D1 估算器**（`_shared/finance/loans.ts`，零 import）。`interest_rate` 在库里是**百分数**（4.28 = 4.28%）。
   缺什么补什么：有余额+利率+期数→算月供；有余额+月供+期数→二分法反推利率；有余额+利率+月供→推期数；
   期数缺失时先用 `end_date` 推，再用默认值。推出来的字段记入 `estimated[]`。
   - 默认值（年利率% / 剩余月数 / 计息方式）：mortgage 4.2/300/reducing · car_loan 3.0/60/flat ·
     personal_loan 8/60 · study_loan 1/120 · renovation_loan 7/60 · business_loan 7/60 · asb_financing 4.5/120 ·
     family_loan 0/36 · bnpl 0/6 · tax_payable 0/12 · other 6/60（以上 reducing，除车贷）·
     credit_card 18/–/revolving（最低还款 max(5%余额, RM50)，不超过余额）·
     overdraft 8 / share_margin 6 = interest_only · policy_loan 不产生现金流。
   - flat（车贷平息）：利息/月 = (original_principal ?? 余额) × 年利率 / 12；缺月供时 = 余额/剩余月数 + 利息/月。
   - 警告（中文）：reducing 且 月供 ≤ 当期利息 →「月供不足以支付当期利息，余额或利率可能有误」；
     月供 × 剩余月数 < 余额 × 0.98 →「月供 × 剩余期数小于余额，数据可能有误」。
3. **推导项**（`_shared/finance/derived.ts`）：
   - 负债 → 类别 = taxonomy `installment_category`；金额 = 估算月供；带 interest/principal 拆分。
     信用卡只把**利息**记为 `finance_charges`（开销；刷卡消费已按用途记账，还款是转移），最低还款计入债务比率。
     interest_only 类型记利息（finance_charges / share_margin_interest）。
   - 保单（未过 end_date）→ 月额 = premium × 频次/12（monthly 12, quarterly 4, semi_annual 2, annual 1, single_premium 0）；
     类别按 policy_type：life→life_takaful · investment_linked→savings_plan_premium · medical→medical_card ·
     critical_illness→critical_illness · accident→personal_accident · property→home_insurance（O4）· 其余→protection_other。
     只用保单 premium，不加 rider premium（与现有税务/保险模块同口径）。
4. **去重**（按类别对应，不一刀切）：手工行在以下情况**不计入**总数（界面显示「已由负债/保单取代」）：
   - O2 split 类：客户有 installment_category 相同的负债；或该行是 `debt_other` 且客户有任何会产生月供的负债。
   - O3 类：客户有映射到同一类别的保单；或该行是 `protection_other` 且客户有任何保单。
   依据线上数据：甲的「车贷+油费」、NG Jimmy 的「Loan Repayment」被取代；丙的先买后付（无对应负债）保留。
5. **总数口径**：`planCashflow` = 保留的手工行（periods.annualizeCashflow，basis 同前）+ 推导项×12（转移类不计）。
   现金视角：月供全额计入开销（它真的离开口袋）；另给出 `monthly_principal`（财富累积）供之后使用。
   `monthly_debt_service` = 各负债估算月供之和（信用卡=最低还款，policy_loan 不计）。
6. **DB**：`liabilities` 加 `remaining_months int`（>0）、`rate_type text check in (reducing, flat, revolving, interest_only)`，可空。估算值不落库。

## 施工单（Sonnet 执行，Opus 审）

### A · 核心逻辑（先做，其余依赖它）
- `supabase/functions/_shared/finance/loans.ts`：`LOAN_DEFAULTS`、`estimateLoan(input, today?) → LoanEstimate`
  `{ monthly_payment, annual_rate_pct, remaining_months, rate_type, interest_monthly, principal_monthly, estimated[], warnings[] }`，零 import。
- `supabase/functions/_shared/finance/derived.ts`：`deriveLoanItems`、`derivePremiumItems`、`isSuperseded(row, liabilities, policies)`、
  `planCashflow({ rows, liabilities, policies, basis, today? }) → { totals, derived, superseded, monthly_debt_service, monthly_principal, monthly_interest, monthly_premiums }`。
  `DerivedItem = { key, source_type, source_id, source_name, category, direction:'outflow', monthly_amount, interest_monthly, principal_monthly, estimated[], warnings[] }`。
  import 只用带 `.ts` 扩展名的相对路径（taxonomy/balance.ts、taxonomy/cashflow.ts、cashflow/periods.ts、./loans.ts）。
- 测试：Deno（`*.test.ts` 同目录）覆盖每条默认值、反推利率、end_date 推期数、flat、revolving、两条警告、
  每种 policy_type 映射、单保费=0、过期保单跳过、三条去重用例（甲/NG/丙的形状）、totals = 手工 + 推导。
  以及用纸上演练的乙：工资 2,577；手工开销 1,548；车贷 10k@3% 月供 420；个人贷款 130k@12% 月供 1,000（应触发「月供不足以支付利息」警告）；
  ILP 年缴 10,000 → 月结余应为负约 −1,224。
- `taxonomy/index.ts` 加 `export * from "../finance/derived.ts"; export * from "../finance/loans.ts";`，重建 `api/_lib/taxonomy.mjs`，
  更新 `api/_lib/taxonomy.d.mts` 不用改（re-export index）。

### B · 计算引擎（A 之后，可与 C 并行）
- `cfp-brain/db.ts`：负债查询加 `id, name, original_principal, remaining_months, rate_type`；保单查询加 `id, plan_name`；`types.ts` 同步。
- `cfp-brain/baseline.ts`：用 `planCashflow` 取代 `annualizeCashflow` + `liabilities.monthly_payment` 求和；
  `FinancialBaseline` 加 `derived_items`、`superseded_manual`（数量）、`monthly_principal`；估算/警告写进 `baseline_notes`。
- `modules/cashflow/calc.ts`：expense_breakdown 把推导项按类别并入（同一分母，份额仍 ≤100%）。
- 其余读 `monthly_debt_service` 的地方随 baseline 自动正确；跑全部 Deno 测试，更新受影响断言并说明原因。

### C · 界面与 API（A 之后，可与 B 并行）
- `CashflowTab`：在支出表里列出推导项（只读，「自动」标记 + 来源名 + 月供拆「本金/利息」+「估算」标记 + 警告），计入合计；
  被取代的手工行加「已由负债/保单取代」标记，不计入合计。数据用 `planCashflow`。
- `NetworthTab`：负债表单加「剩余期数（月）」「计息方式」；列表显示估算月供（有「估算」标记）和警告。
- `HealthScoreCard`：月供、开销改用 `planCashflow`。
- `api/health.js`：把推导项作为 expense 记录加入（`Type` 用 portalLabels 规则：O2 → 'Loan Repayment'），被取代的手工行剔除。
- `api/kyc.js`：房产/车辆贷款有 `loanEndYear/loanEndMonth` 时写 `remaining_months`；`tenure` 与 `rate_type`（车贷 flat）。

### D · 上线（Opus）
迁移（只新增）→ 边缘函数（用户 CLI）→ PR 合并（用户）。验收：乙的现金流页出现两笔月供和 ILP 保费，合计为赤字；甲的债务比率 > 0。
