# CFP P3 — 资产表现、估值历史与投资组合（设计 + 施工单）

- 日期：2026-09-23 · 上游：框架 spec §3.3、§4（D6 2×2）、§7 P3；P2b（常设项目 `linked_asset_id`）
- 现状（2026-09-23 调查）：投资分三处存 ——
  ① `assets`（净资产清单；LevelUp 用 `metadata.is_investment` 标投资）；
  ② `investment_accounts` + `portfolio_holdings`（顾问 PortfolioTab；`asset_id` 从未被写入；`api/health.js` 和 cfp-brain 把 holdings **另外加进**投资，与 assets 可能重复计算）；
  ③ `portfolios` + `portfolio_history`（顾问 MarketValues 录月度市值/追加；客户端 `Investment.tsx` 算 TWR/CAGR/XIRR；cfp-brain 不读）。
  资产没有估值历史（`valuation_date` 覆盖写），所以「价值变动」无从计算。风险等级：`clients.risk_profile` 手选；suitability 结果从不回写。

## 决策
1. **`assets` 是唯一的持仓清单**（净资产只加 assets）。其余两处变成挂在资产下面的明细/历史：
   - `investment_accounts.asset_id` 必填（没有的补建资产）；`portfolio_holdings` = 该资产的成分明细，**不再另外加进净资产或投资合计**。
   - `portfolios` → 一个投资资产（名称沿用，类型默认 `unit_trust`，顾问可改）；`portfolio_history` → 该资产的估值历史。
2. **新表 `asset_valuations`**：`asset_id, client_id, valuation_date, value, net_contribution`（期内追加 − 取出，TWR 用）, `source`（auto / manual / review / migrated）, `note`；
   `unique (asset_id, valuation_date)`。触发器：`assets` 新增或 `current_value` 变化时自动 upsert 一条（日期 = `valuation_date` 或今天，`source='auto'`）——
   不用改任何现有写入口，历史就开始积累。
3. **资产质量 2×2（D6）**：`_shared/finance/assetQuality.ts`：
   - 月净现金流 = Σ 生效中关联常设项目（流入 +、流出 −，月等值）− Σ 关联负债的估算月供（全额，P2a `estimateLoan`）。
   - 年价值变动 = 最新估值 − 约 12 个月前的估值 − 期间净追加，按天数年化；没有历史时：车辆默认 −10%/年，其余 0 并标注「缺少估值历史」。
   - 象限：净现金流 ≥ 0 且 价值 ≥ 0 → 生财资产；≥0 且 <0 → 收益但贬值；<0 且 ≥0 → 增值但吃现金；<0 且 <0 → 消耗型资产。A 类（流动）和 B 类（退休专户）不贴标签。
   - 同时给出 总回报/年 = 净现金流×12 + 价值变动，以及回报率 = 总回报 / 当前价值。
4. **投资组合视图**：配置（现金/固收/股票/房产/黄金/另类，沿用 `allocationBucketOf`）、流动性分布、每项资产的估值曲线与 TWR、
   对照风险等级的目标配置（`MODEL_PORTFOLIOS` 从 cfp-brain 移到 `_shared/finance/allocation.ts` 共用）与偏离。
   风险等级来源：最新 suitability 结果（STABLE→conservative、BALANCED→balanced、GROWTH→growth、AGGRESSIVE_GROWTH→aggressive）优先，否则 `clients.risk_profile`；界面注明来源。
5. **图表统一用 recharts**（已在用）。

## 施工单（Sonnet 执行，Opus 审）。不要 commit；只跑自己相关的测试。

### A · 共享逻辑 + 迁移脚本（先做）
- `_shared/finance/valuation.ts`（零 import）：`valueChangeAnnual(valuations, asOf, {assetType, currentValue})`、`twr(valuations)`（按 net_contribution 分段）。
- `_shared/finance/assetQuality.ts`：`assessAsset(asset, {items, liabilities, valuations}, asOf)`、`assessAssets(...)`、象限常量与中英文标签。
- `_shared/finance/allocation.ts`：`MODEL_PORTFOLIOS`、`riskBandFromSuitability`、`allocationOf(assets)`、`driftAgainst(model, allocation)`；cfp-brain `modules/investment/calc.ts` 改为从这里导入（输出不变）。
- `taxonomy/index.ts` 导出，重建 bundle。Deno 测试齐全（年化、净追加扣除、车辆默认折旧、四个象限、A/B 类不贴标签、TWR）。
- 迁移（Opus 执行）：`asset_valuations` 表 + RLS + 触发器；数据回填另一份（portfolios → 资产 + 估值、accounts 缺资产的补建、各资产当前值的首条估值）。

### B · 顾问端（A 之后）
- `NetworthTab.tsx`：每项资产显示象限徽章 + 月净现金流 + 年价值变动；页顶「资产质量」2×2 面板（四格各列资产与合计）。
- `PortfolioTab.tsx` 改为「投资组合」：配置甜甜圈、流动性条、目标配置偏离条、每项投资资产的估值曲线/TWR；账户与持仓明细作为资产下的子区块（保留增删改，账户必须选资产）。
- `MarketValues.tsx`：改为按资产录入月度估值（值 + 期内追加/取出）写 `asset_valuations`，最新一条同步 `assets.current_value`/`valuation_date`。

### C · 客户端与引擎（A 之后）
- `api/health.js`：净资产与投资只按 assets（holdings 不再另加）；返回每项资产的 2×2 结果。`api/portfolios.js` 改为读投资资产 + `asset_valuations`，
  `services/apiService.ts` 的 TWR/XIRR 计算沿用；`components/Investment.tsx`、`components/NetWorth.tsx` 适配。
- cfp-brain：`db.ts` 读 `asset_valuations`；holdings 不再叠加进投资合计；baseline/investment 模块输出 2×2 与组合偏离（新增字段）。
