# 投资力自测获客漏斗 — 设计规格

**日期：** 2026-06-13
**代号：** Invest-Check Funnel（投资力自测）
**目标仓库：** `xinwealth-website`（Homepage 仓库），少量改动 `XinWealth-Portal`
**状态：** 待实现

---

## 一、背景与目标

把陌生访客转化为「想找顾问谈、最终把资金交由顾问投资」的高质量预约线索，推动 AUM 增长。

手段：在官网 www.xinwealth.com 放一个 **2 分钟免费小测评**，主题**只聚焦「投资」**。访客测完看到自己的「投资力指数」与薄弱点，并直观看到「如果交给专业打理会差多少钱」，从而预约免费咨询。预约即生成一条线索，自动进入顾问 portal 的 Pipeline「新线索」，顾问通过 WhatsApp 跟进。

### 转化路径（漏斗）

```
陌生访客（FB/IG/小红书/WhatsApp）
  → 引导页（/invest-check）
  → 测评（8 题 / 4 维度）
  → 结果页（投资力指数 + 弱项 + 「如果交给我管会差多少」投影 + CTA）
  → 预约表单（提交即建线索）
  → 确认页 + 一键 WhatsApp 衔接
  → portal Pipeline「新线索」→ 顾问跟进 → 成交 → AUM
```

---

## 二、范围

本规格为「**先漏斗，后整站**」中的**第一子项目：漏斗**。

**在范围内：**
- Homepage 仓库新增 `/invest-check` 路由及其全部界面（引导页、测评、结果页、预约表、确认页）。
- 评分逻辑、结果文案、差距投影计算。
- Homepage 仓库新增 `api/lead` serverless，写线索进共享 Supabase。
- Supabase 一条枚举迁移（`lead_source` 增加 `website_quiz`）。
- Portal 仓库最小改动：`stages.ts` 增加线索来源选项；线索详情面板展示测评分数（可选增强）。
- 双语（cn/en），沿用 Homepage 现有 `content` 对象 + `lang` state 模式。

**明确不在范围内（YAGNI）：**
- 官网首页整体重设计（第二子项目，之后单独做）。
- 自动推送 WhatsApp 给顾问的 WhatsApp Business API 集成（v1 用 wa.me 点击衔接 + 线索兜底）。
- Email 收集、A/B 测试框架、测评数据后台分析面板。
- 登录/账号体系（漏斗全程匿名公开）。

---

## 三、架构总览

**两个仓库，一个 Supabase。** Homepage 写线索，Portal 管线索。

```
┌─ Homepage 仓库（Vite+React+TS+Tailwind，部署 www.xinwealth.com）──────┐
│  /                现有营销首页（本项目不动）                            │
│  /invest-check    新增漏斗（引导→测评→结果→预约→确认）                  │
│  api/lead.js      新增 serverless：校验+算分+写 Supabase                │
└───────────────────────────┬───────────────────────────────────────────┘
                            │ INSERT clients（service role key，仅在 serverless 内）
                            ▼
        ┌─ 共享 Supabase（portal 现有项目，唯一真相源）─────────┐
        │  clients 表：新线索 + metadata(测评数据)               │
        └───────────────────────────┬──────────────────────────┘
                            │ portal 读同一个库
                            ▼
┌─ XinWealth-Portal 仓库（portal.xinwealth.com）─────────────────────────┐
│  Pipeline 看板「新线索」自动出现该客户（lead_source=网站测评）          │
│  顾问看测评分数/答案 → WhatsApp 跟进 → 成交                              │
└────────────────────────────────────────────────────────────────────────┘
```

**为何放 Homepage 仓库**：它本就是 www（流量入口）；与官网同栈同设计 token（`xin-blue`/`xin-gold`/`xin-bg`），视觉天然统一；漏斗前端为主，唯一后端需求「建线索」用一个轻量 serverless 直连共享 Supabase 即可（复用 portal `api/prs-application.js` 同款模式）；portal 几乎不用动。

---

## 四、漏斗各步详述

### 4.1 引导页（/invest-check 首屏）

- 钩子标题（cn）：**「你的钱，真的在替你工作吗？」** 副标：1 分钟测出你的投资力，看看你和「专业打理」之间差了多少。
- 一个主 CTA：**「开始免费测评 →」**
- 信任要素：免费 · 无需注册 · 匿名 · 约 2 分钟。
- 底部含合规署名（见第九节）。

### 4.2 测评（8 题 / 4 维度）

- 单题单选，逐题推进，顶部进度指示（如「3 / 8」或进度条）。
- **分值仅供内部计算，前端不显示任何分数。**
- 维度归属：行动力(Q1,Q2)、配置力(Q3,Q4)、成长力(Q5,Q6)、掌控力(Q7,Q8)。

题目与选项分值（canonical 中文；英文在实现时按 Homepage `content` 模式补齐）：

**Q1（行动力）扣掉日常开销和应急金，你大概有多少比例的钱真正投入了投资（股票/基金/PRS/ETF 等）？**
- 几乎没有，大多是现金或定存 → 0
- 少部分，不到 25% → 35
- 一部分，25–50% → 70
- 大部分，超过 50% → 100

**Q2（行动力）你的定存/活期里，有没有一笔超过 6 个月生活费、却一直没拿去投资的「闲钱」？**
- 有，而且金额不小 → 0
- 有一点 → 50
- 没有，该投的基本都投了 → 100
- 不太确定 → 25

**Q3（配置力）你的资产/投资目前主要集中在哪里？**
- 我几乎没有投资 → 0
- 几乎只有定存/储蓄保险 → 25
- 几乎全压在房产 → 40
- 集中在少数几只本地股票/单一标的 → 45
- 跨股票、基金、债券等多类资产分散 → 100

**Q4（配置力）你的投资里，有没有「海外/全球」配置（而不只是马来西亚本地）？**
- 不清楚 / 我没投资 → 0
- 几乎全是本地 → 40
- 有少部分海外 → 70
- 有相当比例做了全球分散 → 100

**Q5（成长力）你知道自己的投资过去一年大概赚了多少 %（有没有跑赢通胀 ~4%）吗？**
- 完全不知道 / 没投资 → 0
- 大概知道，但跑不赢通胀 → 35
- 勉强跑赢一点 → 70
- 清楚知道，回报还不错 → 100

**Q6（成长力）除了 EPF，你有没有额外为退休做投资（例如 PRS、长期基金）？**
- 完全没有，退休只靠 EPF → 0
- 想过，但还没开始 → 35
- 有一点点 → 70
- 有在持续投入 → 100

**Q7（掌控力）你的投资有清晰的目标和时间表吗（例如「15 年后退休要存到 200 万」）？**
- 完全没有，凭感觉 → 0
- 有个模糊的想法 → 35
- 有大致方向 → 70
- 有明确目标和计划 → 100

**Q8（掌控力）你通常怎么做投资决定？**
- 听消息/朋友推荐就买 → 0
- 自己研究，但没什么系统 → 50
- 有定期定额、比较有纪律 → 80
- 有专业顾问帮我规划 → 100

### 4.3 评分逻辑

- 每个维度分 = 该维度两题分值的平均（四舍五入到整数）。
- **投资力总分** = 4 个维度分的平均（四舍五入，0–100）。
- **最弱维度** = 四个维度中分值最低者（并列时按固定优先序：成长力 > 配置力 > 行动力 > 掌控力，取靠前者作为主弱项）。

**分数段定性文案（结果页主标题，按总分）：**

| 总分 | 主标题（cn） | 语气 |
|------|------------|------|
| 0–39  | 你的钱，还没在好好替你工作 | 提示风险/缩水，提升空间大 |
| 40–59 | 起步了，但漏洞不少 | 有基础但缺口明显 |
| 60–79 | 基础不错，仍有提升空间 | 肯定 + 优化 |
| 80–100 | 投资力很强，可以锦上添花 | 赞许 + 进阶配置 |

**评分逻辑必须由服务端 `api/lead` 重新计算落库**（不信任前端传入的分数，防篡改）。前端展示用同一套逻辑，二者共享同一份评分映射（见第六节「共享模块」）。

### 4.4 结果页

自上而下分区：

1. **投资力指数环**（0–100），下方按分数段主标题 + 一句副标。
2. **四维度进度条**，自动高亮最弱维度（红色 + 「最弱」徽章）。
3. **「你最大的缺口」**：按最弱维度动态文案（见下方映射）。
4. **🔥 如果交给专业打理，会差多少？**（差距投影，转化核心）：
   - 可拖动「可投资金额」滑块：范围 RM 10,000 – 1,000,000，步进 10,000，默认 100,000。
   - 年限切换 chips：10 / 20 / 30 年，默认 20。
   - 两条对比柱：
     - 现状（钱继续躺着，定存 ~**3%**）= `P × (1.03)^Y`
     - 专业分散配置（参考 ~**8%**）= `P × (1.08)^Y`
   - 底部大号差额数字 = 专业 − 现状，实时更新。
   - 两个回报率（3% / 8%）为可配置常量。
   - **合规免责**小字必须紧随（见第九节）。
   - 滑块最终值用于**预填**预约表单的「可投资金额区间」（落到最接近的区间）。
5. **针对你的情况，我能帮你做 3 件事**：展示**最弱维度**对应的 3 条价值主张（见下方映射）。
6. **CTA**：「预约免费咨询，拿回这笔差距 →」+ 微文案「30 分钟 · 免费 · 不强迫购买」。

**最弱维度 → 缺口文案 + 3 件事 映射：**

- **行动力**
  - 缺口：大量资金闲置在现金/定存，正被通胀慢慢侵蚀，没有真正在增值。
  - 3 件事：① 把闲置/定存的钱挪进能增值的组合，先跑赢通胀；② 保留合理应急金，其余高效配置；③ 建立每月自动投资的现金流。
- **配置力**
  - 缺口：资产过度集中（房产/定存/单一标的），一旦该类资产波动，风险很大。
  - 3 件事：① 跨资产类别分散，降低单一资产风险；② 加入全球/海外配置，不再只押本地；③ 按风险承受度调到合适的攻守比例。
- **成长力**
  - 缺口：投资大概率跑不赢通胀，退休又几乎只靠 EPF，长期购买力在缩水。
  - 3 件事：① 构建能长期跑赢通胀的增值组合；② 用 PRS + 长期基金补上退休缺口；③ 用复利和时间，把「躺平的钱」变成会生钱的钱。
- **掌控力**
  - 缺口：投资凭感觉、没目标没纪律，容易追涨杀跌。
  - 3 件事：① 设定清晰的财务目标与时间表；② 建立定期定额的投资纪律；③ 由专业顾问定期检视、动态调整。

### 4.5 预约表单

点结果页 CTA 后进入。字段：

| 字段 | 控件 | 必填 | 说明 |
|------|------|------|------|
| 姓名 | 文本 | 是 | → clients.full_name |
| WhatsApp 号码 | 文本（电话） | 是 | → clients.phone |
| 可投资金额区间 | 单选 chips：<5万 / 5–20万 / 20–50万 / 50万+ / 还不确定 | 是 | → metadata；由结果页滑块预填 |
| 方便的日期 | 日期选择 | 是 | → metadata + clients.next_action_date |
| 方便的时段 | chips：上午 / 下午 / 晚上 | 是 | → metadata |

- 不收集 Email（降低摩擦，WhatsApp 已足够）。
- 表单下方 PDPA 同意微文案 + 不分享第三方声明。
- 含隐藏 honeypot 字段用于挡机器人。

### 4.6 确认页 + WhatsApp 衔接

提交成功后：
- ✓ 「预约已收到！」+ 引导文案。
- 绿色大按钮 **「用 WhatsApp 发送给 Leon」** = `https://wa.me/<ADVISOR_WA_NUMBER>?text=<urlencoded>`。
- 预填消息模板（cn）：
  > Hi Leon 👋 我刚做完「投资力自测」，得分 {score}，最弱项是{weakest}。想预约免费咨询：{date} {slot}。可投资范围：{range}。我是{name}，谢谢！
- 页面提示：你的预约已进入顾问跟进列表，Leon 也会主动 WhatsApp 你（双保险）。
- `ADVISOR_WA_NUMBER` 为配置项。

---

## 五、数据模型与落库

线索写入共享 Supabase 的 `clients` 表（portal Pipeline 读取的同一张表）。

**字段映射（INSERT）：**

| clients 列 | 值 |
|-----------|----|
| advisor_id | `LEON_ADVISOR_ID`（env，固定为 Leon 的 profiles.id） |
| full_name | 表单姓名 |
| phone | 表单 WhatsApp 号码 |
| status | `'prospect'` |
| pipeline_stage | `'new_lead'` |
| lead_source | `'website_quiz'`（需枚举迁移） |
| locale | `'cn'` / `'en'` |
| next_action | `'WhatsApp 跟进（网站测评）'` |
| next_action_date | 表单选的日期 |
| metadata | 见下方 JSON |

**`metadata` JSON 结构：**

```json
{
  "source": "invest_check",
  "score": 48,
  "dimensions": { "action": 43, "allocation": 40, "growth": 35, "control": 75 },
  "weakest": "growth",
  "answers": { "q1": 1, "q2": 1, "q3": 2, "q4": 1, "q5": 1, "q6": 1, "q7": 2, "q8": 2 },
  "investable_range": "20_50",
  "preferred_date": "2026-06-20",
  "preferred_time_slot": "afternoon",
  "projection_amount": 200000,
  "submitted_at": "2026-06-13T08:00:00Z"
}
```

`answers` 存**选项下标（0 起）**，非分值；`score`/`dimensions`/`weakest` 均由服务端按 scoring 表映射后计算并落库。

`kyc_payload` 与 `metadata` 均为 NOT NULL 但有 DEFAULT `'{}'`，PRS 插入已验证可只传部分列；本插入显式写 `metadata`，`kyc_payload` 留默认。

**枚举迁移（Supabase，单独一条，不能在事务块内与其他语句混用）：**

```sql
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'website_quiz';
```

---

## 六、Homepage 仓库改动清单

1. **依赖**：新增 `react-router-dom`、`@supabase/supabase-js`。
2. **路由**：引入 router，`/` 渲染现有首页（现有 `index.tsx` 内容抽成 `Home` 组件），新增 `/invest-check`。
3. **新目录** `src/invest-check/`（或现有结构对应位置）：
   - `IntroScreen`、`Quiz`、`ResultPage`、`BookingForm`、`ConfirmScreen` 组件 + 一个状态机容器 `InvestCheck`（intro → quiz → result → booking → confirm）。
   - `content.ts`：双语文案（题目、选项、结果文案、映射、模板），沿用现有 `content` 对象风格。
4. **共享评分模块** `lib/investCheck/scoring.ts`：题目分值表（每题为选项分值数组）、维度归属、`computeResult(answers)`（`answers` 为每题选项下标）→ `{ score, dimensions, weakest }`。**前端与 `api/lead` 同时引用此模块**（若构建无法跨 React/serverless 共享，则在 `api/` 内复制并加「必须与 scoring.ts 同步」注释，沿用 portal `prsSync.ts`/`prs-application.js` 的做法）。
5. **`api/_lib/supabase.js`**：镜像 portal 写法，用 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 创建 admin client。
6. **`api/lead.js`**：见第八节契约。
7. **环境变量（Homepage 的 Vercel 项目）**：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`LEON_ADVISOR_ID`、`ADVISOR_WA_NUMBER`、（可选）投影回报率常量。
8. **设计 token**：复用现有 Tailwind 配置中的 `xin-*`；结果页/投影沿用品牌深蓝 + 金色（原型中的 `#0f172a/#1d4ed8/#fbbf24` 在实现时对齐真实 `xin-blue`/`xin-gold`）。

---

## 七、Portal 仓库改动清单（最小）

1. **`components/advisor/pipeline/stages.ts`**：`LEAD_SOURCES` 增加
   `{ key: 'website_quiz', en: 'Website Quiz', zh: '网站测评' }`。
2. **（可选增强）线索详情**：在 `LeadDetailPanel.tsx` 中，当 `clients.metadata.source === 'invest_check'` 时，展示投资力总分、最弱维度、可投资金额区间、偏好时段，方便顾问开口前就掌握背景。
   - 该增强读取已落库的 `metadata`，不改 schema。

---

## 八、后端 API 契约：`POST /api/lead`

**Request body（JSON）：**

```json
{
  "name": "string (required)",
  "whatsapp": "string (required)",
  "investable_range": "lt5 | 5_20 | 20_50 | gt50 | unsure",
  "preferred_date": "YYYY-MM-DD",
  "preferred_time_slot": "morning | afternoon | evening",
  "locale": "cn | en",
  "projection_amount": 200000,
  "answers": { "q1": 1, "q2": 1, "q3": 2, "q4": 1, "q5": 1, "q6": 1, "q7": 2, "q8": 2 },
  "hp": ""
}
```

> `answers` 每题为**选项下标（0 起）**，由服务端经 scoring 表映射为分值后聚合，前端传入的任何分数一律不采信。

**服务端处理：**
1. CORS：同源即可（同仓库部署）；保留 OPTIONS 处理以备子域调用。
2. 校验：`name`、`whatsapp` 非空；`answers` 8 题齐全且为合法分值；honeypot `hp` 必须为空（非空则静默返回 200 但不落库）。
3. **重算分数**：用共享 `scoring` 逻辑由 `answers` 计算 `score/dimensions/weakest`（不信任前端）。
4. INSERT `clients`（字段见第五节）。
5. 返回 `{ "success": true }`；错误返回 `{ "error": "..." }` 及对应状态码。
6. 失败不可暴露内部细节；记录 `console.error`。

**安全：**
- service role key 只在 serverless 内使用，绝不进前端 bundle。
- 基础限流可依赖 Vercel 平台能力；honeypot 挡多数机器人；如需更强可后续接入 Vercel BotID（不在 v1 范围）。

---

## 九、合规与文案要求

Leon 为 Phillip Wealth Planners Sdn Bhd 持牌代表（eCMSRL/C2227/2022）。涉及回报的展示必须谨慎：

- 差距投影旁固定免责：「* 数字仅为示意，采用假设年化回报，非保证收益。实际结果因市场与产品而异。」（en 对应译文）
- 引导页/结果页/页脚保留品牌与监管署名（沿用 Homepage 现有 footer 文案）。
- 测评结果与投影**不构成具体投资建议**；文案以「自测/示意/邀请咨询」为定位。
- 3% / 8% 为可配置假设值，便于按合规要求调整或加注「基于历史长期参考」。

---

## 十、双语

- 全程支持 cn / en，沿用 Homepage 现有 `content[lang]` + `lang` state 模式与语言切换按钮。
- 中文为 canonical；英文文案在实现时一并产出（题目、选项、结果文案、映射、WhatsApp 模板、免责声明）。

---

## 十一、成功标准 / 验收

- [ ] `/invest-check` 在 www 域名可访问，移动端（FB/IG 流量为主）布局正常。
- [ ] 8 题逐题可答，进度可见，前端不出现任何分数。
- [ ] 结果页：环形总分、四维度条、最弱维度高亮、缺口文案、3 件事均按答案动态正确。
- [ ] 差距投影：拖动金额 + 切换年限，两柱与差额实时更新；含免责小字。
- [ ] 提交预约 → `clients` 新增一行：`lead_source='website_quiz'`、`pipeline_stage='new_lead'`、`status='prospect'`、`metadata` 含完整测评数据；分数由服务端重算。
- [ ] 该线索出现在 portal Pipeline「新线索」列，来源显示「网站测评」。
- [ ] 确认页 WhatsApp 按钮打开带预填消息的对话，变量正确填充。
- [ ] honeypot 非空时不落库；缺字段时返回 400。
- [ ] 评分纯函数有单元测试（边界：全 0、全满、并列最弱）。
- [ ] cn/en 切换全程文案完整。

---

## 十二、开放问题（实现前需 Leon 提供）

- `LEON_ADVISOR_ID`：Leon 在 `profiles` 表中的 id（落库 advisor_id 用）。
- `ADVISOR_WA_NUMBER`：用于 wa.me 的 WhatsApp 号码（国际格式，如 60123456789）。
- 确认 Homepage 的 Vercel 项目与 portal 连的是**同一个** Supabase 项目（共享 service role key）。
