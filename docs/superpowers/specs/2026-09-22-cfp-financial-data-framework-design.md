# 全方位财务规划（CFP）数据框架设计

- **日期**：2026-09-22
- **状态**：已定稿（D1–D6 已与规划师确认）
- **范围**：P0，即现金流、净资产、保险三大板块的分类框架、财富效应规则、联动规则和持续更新机制。各实施阶段（P1–P6）另写 spec 和 plan。

---

## 0. 目标

客户经过整个流程后，**看清自己真实的财务状况**：
- 钱从哪里来、到哪里去（现金流）
- 扣除负债后真正属于自己的有多少，并且是否真的在增长（净资产）
- 有多少保单、保障多少、缺口在哪里（保险）

所有后续决定都基于真实数据而不是感觉（If we can measure, we can manage）。规划师也能根据同一套数据做咨询，并**持续监控**，所以这不是一次性的规划。

## 1. 核心原则：每一笔钱都有"财富效应"

每个现金流分类有两个维度：

- **展示分组 `group`**：钱去了哪里，给客户看流向。
- **财富效应 `wealth_effect`**：对净资产的影响，用来计算比例和健康度。

| wealth_effect | 含义 | 例子 |
|---|---|---|
| `income` | 真实收入，净资产 ↑ | 薪水、租金、股息 |
| `expense` | 真实开销，净资产 ↓ | 吃饭、水电、利息、保费 |
| `transfer` | 资产转移，**不是开销也不是收入**，净资产不变 | 储蓄→定存/基金/黄金、卖股票得现金、提取 EPF、贷款拨款、信用卡还款 |
| `split` | 拆分：本金是 transfer（财富累积），利息是 expense | 房贷、车贷月供 |

**对账公式**（防止客户对自己的财务产生错觉）：

```
本期净资产变化 = Σ income − Σ expense + 资产市值变动（投资涨跌 + 房产重估 − 折旧）
未解释差额     = 实际净资产变化 − 上式
```

未解释差额过大，就代表有隐藏开销或数据错误，需要在复检时指出。

## 2. 现状差距（2026-09-22 代码审查）

| # | 问题 | 位置 |
|---|---|---|
| 1 | "转账不算开销"的规则已经写好，但没有任何界面能设置 `cashflow_entries.linked_asset_id`，所以转账永远是 0，`investment_contribution` 全部被当成开销 | `supabase/functions/_shared/cashflow/periods.ts:90-97`；`components/advisor/tabs/CashflowTab.tsx`（插入时不带 link） |
| 2 | 贷款算两次：`liabilities.monthly_payment` 算一次，现金流里的 "Loan Repayment" 行又算一次 | `supabase/functions/cfp-brain/baseline.ts:149-152` |
| 3 | 保费不会从保单自动进入现金流（只提示客户填进杂项） | `baseline.ts:104-111`；`components/kyc/steps/WelcomeStep.tsx:32` |
| 4 | KYC 收集了每个房产/车子的月流入和月流出，但写入时被丢弃 | `components/kyc/steps/AssetsStep.tsx:272-302` → `api/kyc.js:372-376` |
| 5 | 自住房和投资房都存成 `property`，用途丢失 | `api/kyc.js:96-104` |
| 6 | 黄金、加密货币、ASB、Tabung Haji、外汇都被归进 `other` | `api/levelUp.js:17-40` |
| 7 | 投资分散在三套互不对账的存储里，baseline 把 assets 和 holdings 相加，可能重复计算 | `assets` / `investment_accounts`+`portfolio_holdings` / `portfolios`+`portfolio_history`；`baseline.ts:143-144` |
| 8 | 没有逐项的估值历史；客户端 Net Worth Trend 图永远是空的 | `components/NetWorth.tsx:588`；`health_snapshots` 只存总数 |
| 9 | 保障缺口有三套互相矛盾的公式；客户端保险页面数字全是 0；没有受益人/提名 | `_shared/insurance/cna.ts`、`components/advisor/components/InsuranceGapPanel.tsx:104-107`、`components/Insurance.tsx:190-233`、`api/health.js:212-220` |
| 10 | "流动资产"有三种定义 | `baseline.ts:50`、`HealthScoreCard.tsx`、`supabase/scripts/backfill-health-snapshots.mjs` |
| 11 | KYC 的花红被 `is_recurring` 过滤掉；年度项目被存成每月 | `supabase/functions/cfp-brain/db.ts:43-49`、`api/kyc.js:490` |
| 12 | 实际在用的表（`clients`、`assets`、`liabilities`、`cashflow_entries`、`cashflow_categories`、`insurance_policies` 的线上版本……）不在 migrations 里 | `supabase/migrations/` |
| 13 | LevelUp 把 label 当成 category 存进去（等于自由文本） | `api/levelUp.js:92,105` |

## 3. 分类清单（会计科目表）

### 3.0 分类属性

| 属性 | 取值 | 说明 |
|---|---|---|
| `code` | snake_case | 唯一、稳定，数据库里存它，不存 label |
| `label_zh` / `label_en` | 文本 | 显示用 |
| `direction` | `inflow` / `outflow` | |
| `group` | `I1`–`I4`、`O1`–`O10` | 见下文 |
| `wealth_effect` | `income` / `expense` / `transfer` / `split` | 见第 1 节 |
| `recurrence` | `recurring` / `irregular` / `one_off` | irregular = 每年固定会发生但不是每月（路税、旅游）；one_off = 不计入经常性月均和比例 |
| `fixed_variable` | `fixed` / `variable` | 仅 outflow |
| `need_want` | `need` / `want` | 仅生活开销（O4–O8） |
| `link_to` | `asset` / `liability` / `policy` / `none` | 必须或建议关联的对象。只表示关联对象，**不决定**是否转移；是否转移只看分类的 `wealth_effect` |
| `auto_generated` | bool | 由负债、保单或薪水自动生成，不允许手动新增 |

**每一组都有一个 `<group>_other` 兜底分类**（例如 `housing_other`），用来接住无法细分的旧数据和少见项目。

### 3.1 现金流入

**I1 主动收入**（income，recurring）

| code | 中文 | 备注 |
|---|---|---|
| salary_basic | 基本薪水 | **记录税前总额**（D2） |
| fixed_allowance | 固定津贴 | |
| overtime | 加班费 | variable |
| bonus | 花红/奖金 | irregular |
| commission | 佣金/介绍费 | variable |
| director_fee | 董事费/顾问费/专业费 | |
| business_income | 生意/自雇净收入 | |
| side_income | 副业/兼职 | |
| employer_epf | 雇主公积金供款 | **非现金**，直接进 EPF；auto_generated（D2） |
| active_income_other | 其他主动收入 | |

**D2 薪水与 EPF 规则**
- 客户资料里有一个布尔字段 `has_epf`。自雇人士为 false，不计算任何 EPF。
- `has_epf = true` 时，系统从 `salary_basic` 自动生成三类行：
  - `epf_employee`（O1，transfer→EPF），默认 11%
  - `employer_epf`（I1，非现金→EPF），默认月薪 ≤ RM5,000 时 13%，否则 12%
  - SOCSO/EIS（`socso_eis`，O9，expense）
- 比例可以按客户覆盖，用于 60 岁以上、自愿提高供款、外籍员工等情况。
- PCB（`income_tax`，O9）优先填工资单上的实际数，没有就由税务模块估算。
- **实拿薪水 = 税前总额 − 各项扣除**，由系统算出来显示，不需要另外输入。
- 自雇人士如果自愿供款（i-Saraan），用 O1 的 `epf_voluntary`。

**I2 被动收入**（income，recurring）

| code | 中文 | link_to |
|---|---|---|
| rental_income | 租金收入 | asset（房产） |
| dividend_company | 自家公司股息 | asset（business_equity） |
| dividend_investment | 投资股息/基金派息 | asset |
| interest_income | 利息收入 | asset |
| royalty | 版税/授权费 | |
| pension_annuity | 退休金/年金 | |
| policy_cash_payout | 保单生存金/现金红利 | policy |
| passive_income_other | 其他被动收入 | |

**I3 其他收入**（income，one_off，不计入经常性收入比例）

| code | 中文 | link_to |
|---|---|---|
| government_aid | 政府援助（STR 等） | |
| family_support_in | 家人给的生活费 | （recurring） |
| gift_inheritance | 赠与/遗产 | |
| insurance_claim | 保险理赔 | policy |
| policy_surrender_maturity | 保单退保/满期所得 | policy（D3：拿到钱的那一刻才算收入） |
| tax_refund | 退税 | |
| other_income | 其他收入 | |

**I4 非收入流入**（transfer，不算收入）

| code | 中文 | link_to |
|---|---|---|
| asset_sale | 出售资产所得 | asset |
| savings_withdrawal | 从储蓄/定存/投资提取 | asset |
| epf_withdrawal | 公积金提取 | asset（EPF） |
| loan_drawdown | 贷款拨款 | liability |
| borrowing_family | 向亲友借钱 | liability |

### 3.2 现金流出

**O1 储蓄与投资（先付给自己）**（transfer，不算开销，link_to asset）

to_savings 转入储蓄/紧急基金 · fd_placement 存定期 · unit_trust_contribution 单位信托（一次性/定期定额）· stock_etf_purchase 股票/ETF · asnb_contribution ASB/ASNB · tabung_haji 朝圣基金 · gold_purchase 黄金/贵金属 · crypto_purchase 加密货币 · prs_contribution PRS · epf_voluntary EPF 自愿供款 · epf_employee 雇员 EPF（auto_generated，D2）· sspn SSPN 教育储蓄 · business_capital 注资生意 · lend_out 借钱给别人（→ receivable）· asset_purchase 购置资产首付/全款（one_off）· investment_other 其他储蓄投资

**O2 债务偿还**（split，link_to liability，auto_generated）

mortgage_installment 房贷月供 · car_installment 车贷月供 · personal_loan_installment 个人贷款 · study_loan_installment PTPTN/教育贷款 · renovation_loan_installment 装修贷款 · asb_financing_installment ASB 贷款 · business_loan_installment 生意贷款 · bnpl_payment 先买后付 · family_loan_repayment 还亲友借款 · debt_other 其他还款

例外：
- `credit_card_payment` 信用卡还款：**transfer**，不是 split。刷卡消费按实际用途归进各组，还款只是清偿负债。
- `finance_charges` 信用卡利息/逾期费/银行手续费、`share_margin_interest` 股票融资利息：**expense**（只有利息、没有本金摊还）。

**D1 月供估算规则**（求"大概"，不求百分百准确）
- 负债上的 4 个字段：`outstanding_balance`、`interest_rate`、`monthly_payment`、`remaining_months`。客户知道多少就填多少，缺的由系统推算：
  - 有余额、利率、剩余期数 → 用等额本息公式算月供
  - 有余额、月供、剩余期数 → 反推利率（数值求解）
  - 连利率都没有 → 用该贷款类型的**默认利率**（系统设置表，可以修改）
  - 只有余额，没有月供也没有剩余期数 → 再加上该贷款类型的**默认剩余年期**（系统设置表，可以修改），纸上演练里有客户的 6 笔负债都是这种情况
- 月供 < 当期利息（等于永远还不完）时，显示强提醒，要求顾问核对余额或利率。
- 每期利息 ≈ 余额 × 年利率 ÷ 12；本金 = 月供 − 利息。
- 车贷（hire purchase）是**平息**：利息 = 原始本金 × 平息率 × 年数，平均摊到每期。所以车贷要多存 `original_principal` 和 `rate_type = flat`。
- 推算出来的字段标记为 `estimated = true`，界面显示"估算"。顾问可以覆盖，覆盖后 `estimated = false`。
- 数据矛盾时（例如 月供 × 剩余期数 < 余额）显示提醒，但不阻止保存。
- 利率和余额在复检时更新，旧值进历史（见第 5 节）。

**O3 保障**（expense，link_to policy，auto_generated，所有保费都算支出，D3）

life_takaful 人寿/家庭保障 · medical_card 医药卡 · critical_illness 危疾 · personal_accident 个人意外 · savings_plan_premium 储蓄型/投资型保单保费 · protection_other 其他保费

车险和屋险**不放在 O3**，而是放进 O5、O4，并 link 到对应的车或房，这样才能算出该资产的持有成本。

**O4 住房**（expense）

| code | 中文 | fixed/variable | need/want | recurrence | link_to |
|---|---|---|---|---|---|
| rent | 房租 | fixed | need | recurring | |
| maintenance_fee | 管理费+偿债基金 | fixed | need | recurring | asset |
| quit_rent_assessment | 地税/门牌税 | fixed | need | irregular | asset |
| home_insurance | 房屋火险 | fixed | need | irregular | asset |
| utilities | 水电/排污/燃气 | variable | need | recurring | |
| telco | 电话/网络/电视/串流 | fixed | need | recurring | |
| home_repair | 房屋维修保养 | variable | need | irregular | asset |
| household_help | 女佣薪水/准证 | fixed | want | recurring | |
| housing_other | 其他住房开销 | variable | need | recurring | |

**O5 交通**（expense）

| code | 中文 | fixed/variable | need/want | recurrence | link_to |
|---|---|---|---|---|---|
| fuel | 油费 | variable | need | recurring | asset（车） |
| toll_parking | 过路费/停车 | variable | need | recurring | |
| public_transport_ehailing | 公共交通/Grab | variable | need | recurring | |
| road_tax | 路税 | fixed | need | irregular | asset（车） |
| motor_insurance | 汽车保险 | fixed | need | irregular | asset（车） |
| car_service_repair | 保养维修 | variable | need | irregular | asset（车） |
| transport_other | 其他交通 | variable | need | recurring | |

**O6 日常生活**（expense，variable）

groceries 杂货/菜市（need）· dining_out 外食/外卖（want）· personal_care 个人护理/理发/美容（need）· clothing 服装（want）· health_medical 看病/药物/牙科/眼科，自付部分（need）· fitness 健身/运动（want）· living_other 其他日常（need）

**O7 家庭与教育**（expense）

childcare 托儿/保姆（fixed/need）· school_fees 学费（fixed/need，可为 irregular）· tuition_enrichment 补习/才艺班（fixed/want）· child_expenses 孩子日常开销（variable/need）· parents_allowance 父母生活费（fixed/need）· other_dependants 其他受养人（fixed/need）· self_education 自我进修（variable/want）· pet_care 宠物（variable/want）· family_other 其他家庭开销

**O8 生活方式**（expense，variable，want）

entertainment 娱乐 · travel 旅游（irregular）· hobbies 兴趣爱好 · subscriptions 订阅服务（fixed）· shopping_gadgets 购物/电子产品 · lifestyle_other 其他

**O9 税务·宗教·人情**（expense）

income_tax 所得税 PCB/CP500（fixed）· socso_eis SOCSO/EIS（fixed，auto_generated）· zakat_tithe 天课/什一奉献（fixed）· donations 捐款/慈善（variable）· festive_angpao 节庆红包（irregular）· gifts_social 礼物/红白包（variable）· obligation_other 其他

**O10 其他**：professional_fees 专业服务费 · other_expense 其他支出

### 3.3 资产

资产由 `type`（是什么）和 `purpose`（为什么持有）两个字段描述，**大类由这两者推导出来**。

| 大类 | type |
|---|---|
| **A 流动资产**（算入紧急基金） | cash_on_hand 现金 · savings 储蓄/往来户口 · fixed_deposit 定期 · money_market 货币市场基金 · ewallet 电子钱包 · foreign_currency 外币存款 |
| **B 退休专户**（锁定） | epf_account_1 退休户口（Persaraan）· epf_account_2 福利户口（Sejahtera）· epf_account_3 灵活户口（Fleksibel）· prs |
| **C 投资资产** | stock 股票（`market` 标签：bursa/us/hk/other）· etf · unit_trust 单位信托 · bond 债券/伊斯兰债券 · reit · asnb ASB/ASM · tabung_haji · gold 黄金/贵金属 · crypto · forex · investment_property 投资房产 · land 土地 · business 企业股权 · receivable 借出的钱 · sspn · other 其他投资资产 |
| **D 自用资产** | own_residence 自住房 · vehicle 车 · jewelry 珠宝 · collectibles 收藏品 · personal_asset_other |

**code 沿用线上 enum 现有拼写**：`epf_account_1/2/3`、`bond`、`business`、`other` 只改显示名称，不改 code。原因：Postgres enum 改名会让所有已部署的读取方同时失效，而边缘函数和 Vercel 是分开部署的。`property` 只保留给旧数据（显示为"房产（待确认用途）"，按自用资产计），新数据用 `own_residence` / `investment_property`。

- `purpose`：`personal_use` / `income_producing` / `investment`，每个 type 都有默认值，可以覆盖。例如 vehicle 默认 personal_use，跑 Grab 的车改为 income_producing。
- 共同字段：当前价值、成本、估值日期、`ownership_pct`（夫妻共有，默认 100）、关联负债、关联现金流。
- **流动性只保留一个定义**：A 类 = 流动。C 类中上市、可以快速变现的（stock、etf、unit_trust、reit、asnb）= 半流动。其余 = 非流动。三处现有定义都改为读这一个函数。
- **保单现金价值不列为资产**（D3）。它只是保单上的参考字段，在保险页面显示为"未计入净资产"。

### 3.4 负债

| 大类 | type |
|---|---|
| **短期** | credit_card 信用卡欠款 · bnpl 先买后付 · overdraft 透支 · tax_payable 应缴税 · family_loan 亲友借款 |
| **长期** | mortgage 房贷 · car_loan 车贷 · personal_loan 个人贷款 · study_loan PTPTN · renovation_loan 装修贷款 · asb_financing ASB 贷款 · share_margin 股票融资 · policy_loan 保单贷款 · business_loan 生意贷款（个人担保）· other |

- 字段：`outstanding_balance`、`original_principal`、`interest_rate`、`rate_type`（reducing/flat）、`fixed_or_floating`、`monthly_payment`、`remaining_months`、`linked_asset_id`、`secured`、`lender`、`estimated_fields`。
- **月供只在负债上填一次**，O2 的现金流行由它自动生成，彻底消除重复计算。
- mortgage 可以关联 MRTA/MLTA 保单；policy_loan 关联保单。

### 3.5 保险

**保单字段**：保险公司、计划、保单号、`policy_type`、投保人、受保人、付款人、受益人/提名（`nomination_type`：trust / hibah / conditional / none）、生效日、保费+频率、缴费年期、保障年期、现金价值/基金价值（参考字段，不计入净资产）、保单贷款、`status`（in_force / lapsed / paid_up / surrendered / matured）。

**policy_type**：term 定期 · whole_life 终身 · endowment 储蓄 · ilp 投资型 · standalone_medical 独立医药卡 · pa 意外 · mrta_mlta 房贷保 · group_employer 公司团保 · takaful_family 家庭伊斯兰保险 · other

**保障项目**（沿用现有 `policy_riders` 结构）：death 身故 · tpd 完全残废 · ci_early 早期危疾 · ci_late 严重危疾 · cancer 癌症 · medical 医药（年限额/终身限额/房租/自付额）· hospital_income 住院津贴 · pa 意外 · disability_income 失能收入 · ltc 长期护理 · waiver_payor 豁免

**联动**
- 保费 → O3 行（auto_generated，所有类型都是 expense）
- 现金价值 → 不计入净资产；退保/满期所得 → I3 `policy_surrender_maturity`
- 保单贷款 → 负债 `policy_loan`
- MRTA/MLTA → 在身故需求中抵减所关联房贷的余额
- 团保：没有保费，保障计入缺口分析，但标注"离职即失效"
- **缺口公式统一成一个模块**，客户端、顾问面板和 PDF 都读同一个结果（取代现在的三套公式）

## 4. 资产质量 2×2（D6）

每个资产按年计算两个指标：
- **净现金流** = Σ 关联 inflow − Σ 关联 outflow。O2 的月供按全额计入，反映"从口袋里掏出多少"。
- **价值变动** = 本期估值 − 上期估值。没有估值历史时，自用车用默认折旧（−10%/年）；其他资产视为 0，并标注"缺少估值历史"。

| | 价值 ↑ 或持平 | 价值 ↓ |
|---|---|---|
| **净现金流 ≥ 0** | 🟢 生财资产 | 🟡 收益但贬值 |
| **净现金流 < 0** | 🔵 增值但吃现金 | 🔴 消耗型资产 |

A 类流动资产和 B 类退休专户不贴标签（它们的收益在利息或股息，价值变动就是余额变化）。

## 5. 持续更新机制（D4、D5）

**5.1 常设项目**
- 每个现金流项目只定义一次：分类、金额、`frequency`（monthly / quarterly / semi_annual / annual / one_off）、`effective_from`、`effective_to`。
- 按月的项目（水电）和按年的项目（路税、旅游、保费）各自用最自然的方式录入。系统换算成月均和年度两种视图：年度项目 ÷12，季度项目 ÷3，one_off 单独列出，不计入经常性月均和比例。
- 变化**不覆盖**旧数据。关闭旧版本（写入 `effective_to`），再新建一个版本。
- auto_generated 行（O2 月供、O3 保费、EPF/SOCSO）跟着来源对象的版本走。

**5.2 定期复检**
- **季度轻复检**：只更新余额，包括 A 类、B 类、C 类市值和负债余额/利率。所有字段预先填好上次的数字，没有变化就一键确认。
  - 由**客户在客户端完成**（改造现有 LevelUp），到期时发提醒。
  - 提交后状态为 `pending_review`，**顾问批准后才写入快照**。顾问也可以代客户填写。
- **年度全面复检**：逐项确认常设项目、保单（新增/失效）、目标和假设，然后生成新一版 CFP 报告。
- 每次复检（批准后）产生一个快照：
  - 每项资产的估值写进 `asset_valuations`，每项负债的余额写进对应的历史表
  - 净资产、各项比例和未解释差额写进 `health_snapshots`（扩充）
- 可选"实际数"：客户可以录入某个月的实际开销，与常设项目的预算对比。现有的"按月归属"功能保留在这里使用。

**5.3 顾问监控**
每位客户都有一条时间线：净资产的计划曲线 vs 实际曲线、各项比例走势、未解释差额。

自动提醒：
- 未解释差额超过阈值
- 紧急基金不足 3 个月
- 债务比率上升
- 复检到期或逾期
- 利率变化后月供需要更新
- 目标进度落后

**5.4 退休充足度**
- 沿用 `supabase/functions/cfp-brain/modules/retirement/calc.ts`。
- 退休资金来源 = B 类 + C 类中可提取变现的金融资产（股票、ETF、单位信托、REIT、债券、ASNB、朝圣基金、黄金、加密货币、外汇）。投资房以净租金计入退休收入流；土地、企业股权、借出款、SSPN（教育专用）、未识别的"其他"不计入本金。
- 投资房默认把净租金当作退休收入流；除非标记为"计划出售"，否则不把房价计入退休资金。
- D 类不计入。

## 6. 规则与默认值

**默认规则**
- 信用卡：刷卡消费按用途归类；还款 = transfer；利息/手续费 = expense；欠款余额 = 短期负债。
- 车险和屋险归到 O5/O4，并 link 到资产。
- 家庭报告沿用 `client_relationships` 的夫妻关联，资产按 `ownership_pct` 计入。

**已确认决策**
- D1：月供自动估算本金和利息，允许大概，可以覆盖，利率变化在复检时更新。
- D2：薪水记税前总额；`has_epf` 勾选后才计算 EPF。
- D3：所有保费都算支出；现金价值不计入净资产，退保或满期才算收入。
- D4：常设项目 + 季度轻复检 + 年度全面复检 + 顾问监控。
- D5：轻复检由客户在客户端完成，顾问审核后才生效。
- D6：资产质量 2×2 四个标签。

**参数默认值**（系统设置，可以按客户覆盖）
- 自用车每年折旧 −10%
- 预期寿命 85 岁，另外检验活到 100 岁
- 各贷款类型的默认利率
- EPF 比例（雇员 11%；雇主 13%/12%）
- 紧急基金目标 6 个月

## 7. 分阶段路线图

| 阶段 | 内容 |
|---|---|
| P0 | 本文件 + 给开发者的分类清单页面 |
| P1 数据地基 | 线上核心表结构参考快照 `supabase/schema/live-core-tables.sql`（可重放的 migration 链另立项）；按第 3 节重建 `cashflow_categories`（增加属性字段）；扩充 asset/liability enum，加上 `purpose`、`ownership_pct`、`has_epf`；流动性只保留一个函数；按附录 A 映射旧数据；修正 KYC/LevelUp 写入路径 |
| P2 单一数据源联动 | 常设项目的频率和生效日期、版本机制；负债/保单/薪水自动生成行（D1、D2）；资产持有成本关联；关联选择器；消除重复计算 |
| P3 资产表现 & 投资组合 | 资产质量 2×2；三套投资存储合并为一套；持仓视图，对照 suitability 风险等级 |
| P4 复检与监控 | 季度/年度复检流程，`asset_valuations`，计划 vs 实际，对账，监控面板和提醒 |
| P5 保险 | 统一缺口模块，受益人/提名，修好客户端保险页面 |
| P6 报告与客户端 | cfp-brain、29 页 PDF、客户端改为使用新模型 |

## 8. 纸上演练（2026-09-22，线上 3 位客户，只读）

按新规则手工重算，对照现有算法。客户以甲、乙、丙代称，金额为每月数字。

| 客户 | 现有系统看到的 | 按新框架 | 原因 |
|---|---|---|---|
| 乙 | 每月结余约 **+RM500～1,000**（视所选月份） | 每月**赤字约 −RM1,200** | 两笔贷款月供 RM1,420 和投资型保单年缴 RM10,000（约 RM833/月）都不在现金流里 |
| 甲 | 储蓄率约 **73%**，债务比率 **0%** | 储蓄率约 **40%**，债务比率约 **29%** | 6 笔负债（共约 RM77 万）都没有利率和月供，按默认利率和年期估算约 RM6,300/月；另有年缴 RM24,000 的保单保费；车贷藏在"车贷和油费"一行交通开销里 |
| 丙 | 支出约 RM3,500/月，紧急基金 **10.8 个月** | 支出约 RM9,600/月（含月供），紧急基金约 **4 个月** | 顾问把同一份常设清单分两个月录入（7 月和 8 月的项目互不重叠），系统按"有数据的月份"平均，所有数字减半；房贷月供也不在现金流里 |

另外发现的数据问题（顾问复检时处理）：
- 自由文本备注对不上 KYC 标准名称，例如"幼儿园学费"记在 personal、"孩子药物"记在杂项
- 一行混合了两种性质，例如"车贷+油费"
- 频率录错，例如季度股息记成每月、旅游费记成每月
- 性质不明的流入，例如一笔每月 RM2,000 的"结婚基金"，要确认是收入还是转移
- 先买后付记在个人开销，但没有对应的负债
- 有客户房贷余额高于房产价值（负资产）

结论：
1. D1 的"默认年期"和"月供不够付利息"两条规则是必需的（已补进第 3.2 节）。
2. D4 的常设项目模型能直接修正丙的减半问题。
3. 迁移时需要一个"待分类"审核清单（见附录 A）。

## 附录 A：旧分类 → 新分类映射（P1 数据迁移用）

**迁移总规则**
- 旧的按月记录转成常设项目：同一个（category, source_note）视为同一个项目，金额取**它出现过的那些月份**的平均值，**不是**所有有数据的月份的平均值（修正丙的减半问题）。
- `source_note` 用关键词模糊匹配，不要求完全相等。例如含"学费/School/Kindergarten/Tadika"→school_fees，含"药/Medic/Clinic"→health_medical。
- 匹配不到、或一行含两种性质的（例如"车贷+油费"），进入顾问的"待分类"清单，不自动猜测。
- 现有 `salary` 行不知道是税前还是实拿：迁移后先当作实拿，`has_epf = null`（待确认），下一次复检由顾问确认。

**现金流**（线上 `cashflow_categories` 的 20 个 code）。KYC 子项目存在 `source_note` 里，能匹配就用它细分，否则落进该组的兜底分类。

| 旧 code | 新 code |
|---|---|
| salary | salary_basic |
| bonus | bonus |
| director_fee | director_fee |
| commission | commission |
| rental_income | rental_income（待关联房产） |
| dividend | dividend_company |
| investment_return | dividend_investment |
| other_income | other_income |
| household | 按 note：Tel/Mobile/Internet→telco · Home Maintenance→home_repair · Utilities→utilities · Groceries→groceries · Maid→household_help · 其余→living_other |
| transportation | 按 note：Parking→toll_parking · Petrol→fuel · Bus/MRT/Taxi→public_transport_ehailing · Car Insurance→motor_insurance · 其余→transport_other |
| dependants | 按 note：Child Care→childcare · School Fee→school_fees · Upgrading Class→tuition_enrichment · Dependant Allowances→other_dependants · Child Expenses→child_expenses · Parent Allowance→parents_allowance · 其余→family_other |
| personal | 按 note：Entertainment→entertainment · Dining Out→dining_out · Personal Care/Clothing→personal_care · Vacation/Travel→travel · Donations→donations · Income Tax→income_tax · School Fees→self_education · 其余→lifestyle_other |
| insurance_premium | 能匹配保单的，由自动生成行取代；否则→protection_other |
| loan_repayment | 能匹配负债的，由自动生成行取代（去重）；否则→debt_other |
| investment_contribution | investment_other（transfer） |
| tax | income_tax |
| property_expense | housing_other（待关联房产） |
| property_maintenance | maintenance_fee（待关联房产） |
| miscellaneous | 按 note：Medical Cost→health_medical · 其余→other_expense |
| other_expense | 按 note：Loan Repayment→同 loan_repayment 规则 · 其余→other_expense |

**资产**：epf_account_1/2/3、bond、business 保持 code 不变（只改显示名称） · property → 按 KYC 来源（"own stay"→own_residence，"investment purpose"→investment_property），无法判断的标记"待顾问确认" · other → 按名称关键词（gold/黄金、crypto、forex、ASB/ASNB、Tabung Haji）细分，其余保持 other 并标记待确认 · 其余 type 不变。

**负债**：现有 8 个 type 全部保留，新增第 3.4 节所列的 type。

**保单**：现有 `investment_linked`→ilp、`life`→whole_life（待顾问确认是否为 term）、`medical`→standalone_medical。
