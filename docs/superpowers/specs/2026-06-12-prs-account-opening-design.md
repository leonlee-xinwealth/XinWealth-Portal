# PRS 开户自动化 — 设计文档

日期：2026-06-12
状态：已与顾问（用户）逐节确认通过

## 1. 背景与目标

顾问目前的 PRS 开户流程是手动的：向客户收集资料 → 手工把资料抄写/复制粘贴到公司的 5 份 PDF 表格（现有 FormKitTab 即"逐字段复制"的参考面板）→ 打印 → 客户湿签 → 呈交 hard copy 给公司 admin。

本功能把"收集资料 → 录入数据库 → 自动填充 PDF"这一段完全自动化：

1. 一个表单界面收集开户资料（两种场景：全新客户从零填起；现有客户由顾问发起、预填已有资料只补缺）
2. 资料录入 Supabase，供顾问个人记录与日后使用
3. 一键把资料按坐标"盖字"到 5 份 PRS PDF 模板上，下载打印

## 2. 范围

### 本期做（分两个阶段交付）

- **阶段一**：PDF 引擎 + 顾问后台「开户申请」编辑页 + 一键生成 PDF（顾问先用起来）
- **阶段二**：客户专属填写链接（token 链接，WhatsApp 发送，客户/秘书自填）

### 明确排除（下期或以后）

- 电子签名 —— PRS 要求 wet ink 湿签，本期签名环节保持线下
- 邮件自动发送 —— PRS 呈交 hard copy，不需要发 admin；链接由顾问自己通过 WhatsApp 发出
- PDF 云端存储 —— 数据在库里，按需重新生成即可
- Cases 系统联动 —— 以后需要时容易加
- PMF（Private Mandate Fund）等其他表格 —— 下一期按相同套路复制

## 3. 表格清单

模板位于 `D:\XinWealth Portal App\Forms\PRS`，实施时复制空白模板进项目 `public/forms/prs/`（无客户数据，约 2.8MB）：

| 文件 | 页数 | 说明 |
|---|---|---|
| PRINCIPAL PRS ACC OPENING FORM.pdf | 12 | 主开户表；需填页约为 1–3（申请人/供款/顾问区）和 7–9（CRS 自我声明），其余为条款页 |
| ISA INDIVIDUAL.pdf | 3 | Phillip Mutual 个人投资服务账户 |
| PPA NOMINATION FORM.pdf | 4 | 受益人提名 |
| DECLARATION FORM.pdf | 2 | 声明表 |
| PRINCIPAL PRS TOP UP FORM.pdf | 2 | 供款表 |

已验证的事实：5 份全部是**文字版平面 PDF**（有可提取文本、无 AcroForm 表单字段）→ 填充方式只能是坐标盖字；文字版意味着可程序化提取标签坐标辅助校准。

填写内容全部为英文/马来文（拉丁字母），**不需要中文字体**。表格要求 BLOCK LETTERS，文字字段自动转大写。

## 4. 架构总览

核心思路：**一份申请数据，两个入口，一个 PDF 引擎。**

```
┌─ 阶段一 ────────────────────────┐   ┌─ 阶段二 ─────────────────────────┐
│ 顾问后台「PRS 开户申请」编辑页     │   │ 客户专属链接 /prs/:token          │
│ （顾问/助理直接填）               │   │ （客户/秘书填，手机优先，EN/中文）  │
└────────────┬───────────────────┘   └────────────┬────────────────────┘
             ▼                                     ▼
       ┌─────────────────────────────────────────────────┐
       │ prs_applications 表（Supabase）                   │
       │ form_data jsonb = 所有表格答案的唯一数据源          │
       └────────────┬──────────────────────┬─────────────┘
                    ▼                      ▼
          共有字段同步回 clients 表    PDF 引擎（浏览器端 pdf-lib）
          （NRIC、银行、TIN 等）       → 坐标盖字到 5 份模板
                                      → 合并「打印包」下载
```

技术栈沿用现状：Vite + React 18 + react-router + Tailwind + Supabase + Vercel Functions。新增依赖：`pdf-lib`（浏览器端 PDF 填充）。

## 5. 数据模型

### 新表 `prs_applications`

```sql
create table prs_applications (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references clients(id),          -- 可空：全新客户提交后建档回填
  advisor_id       uuid not null references advisors(id),
  status           text not null default 'draft',         -- draft | awaiting_client | submitted | completed | cancelled
  token            uuid unique,                           -- 客户链接钥匙，发送时生成
  token_expires_at timestamptz,                           -- 默认 14 天
  form_data        jsonb not null default '{}',
  submitted_at     timestamptz,
  pdf_generated_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
```

RLS：顾问只能读写自己的申请（与现有表一致）。客户端 token 访问不经 RLS，走 Vercel function + service role（与现有 `api/` 模式一致）。

### 状态机

```
draft ──发送链接──▶ awaiting_client ──客户提交──▶ submitted ──顾问审核+生成PDF──▶ completed
  │                      │ (可重新生成 token)
  └──顾问直接填完──────────┴────────────────────────▶ (顾问任何状态都可编辑、生成)
任何状态 ──▶ cancelled
```

### form_data 结构（jsonb）

包含 5 份表格所需全部答案。两类字段：

1. **与 `clients` 重合的字段**：full_name、nric、date_of_birth、gender、race、nationality、marital_status、phone、email、correspondence_address/city/state/postal_code、occupation、employer_name、source_of_funds、tax_residency、tin_number、epf_account_number、ppa_account_number、bank_name、bank_account_number、pep_status、risk_profile 等
2. **表格特有字段**（clients 放不下的）：受益人提名（数组：姓名/NRIC/关系/比例）、供款金额与方式、扣款日期、出生地与出生国、CRS 多国税务居民明细（国家/TIN/无 TIN 理由，数组）、雇主 PRS Plus Partner 合约号、申请人类型（PPA Member 新/旧）、宗教等
3. **顾问专区字段**：Consultant/Staff Code、Branch Name & Code、Distributor Code、Channel 等（只在顾问端可见可填）

字段的精确清单在实施阶段做 5 份 PDF 的逐页字段盘点时定稿（见 §6 校准流程），设计上 form_data 为自由 jsonb，由 TypeScript 类型 `PrsFormData` 约束。

### 同步规则

保存/提交时，把 form_data 中与 `clients` 重合的字段写回 `clients` 表，保证资料页、FormKitTab、Pipeline 显示一致：

- 现有客户：更新对应字段（form_data 中非空值覆盖）
- 全新客户：客户提交时自动 `insert into clients`（进入 Pipeline，`pipeline_stage = 'interested'`——既然在填开户表，已属"有意向"阶段），并回填 `prs_applications.client_id`

## 6. PDF 引擎

### 选型与原则

- `pdf-lib`（MIT）在**浏览器端**完成模板加载与填充：客户敏感数据不经第三方服务器，不需要后端存储 PDF
- 空白模板放 `public/forms/prs/`，fetch 后填充

### 坐标映射

每份表格一个 TS 配置文件（`pdf/mappings/*.ts`），记录表格版本号（如 "Version 3.0 May 2024"，公司改版时据此提醒重校准）。字段定义：

```ts
{ key: 'full_name',   page: 0, x: 95,  y: 612, size: 9, maxWidth: 320, uppercase: true }
{ key: 'nric',        page: 0, x: 95,  y: 585, type: 'comb', cellWidth: 18, cells: 12 }   // 一格一字
{ key: 'gender_male', page: 0, x: 301, y: 558, type: 'checkbox' }                          // 画 X
{ key: 'dob',         page: 0, x: 95,  y: 540, type: 'date-split', format: 'DD/MM/YYYY' } // 日期分格
```

四种填法：普通文字（自动大写、超长自动缩字号、缩到下限仍超出则进警告清单）、逐格 comb、勾选 X、日期分格。条款页/附录页跳过。

### 校准流程（实施阶段最大工作量，约 23 页中需填的 ~10 页）

1. 程序提取各页标签文字坐标 → 推算填写位置 → 生成初版映射
2. 用样本客户数据生成全套 5 份"试填 PDF"，交顾问打印对照实体表格
3. 反馈偏差 → 微调 → 重复至全部对位
4. 辅助：开发期可输出带坐标网格的调试版 PDF

### 输出

- 每份表格单独生成下载
- 一键「打印包」：5 份按顺序合并为一个 PDF，一次打印全套
- 生成前显示缺失字段警告清单（沿用 FormKitTab 黄色警告样式）；缺失字段留空照样生成，打印后手填，不阻塞

## 7. 阶段一：顾问后台

### 入口与列表

- 顾问侧边栏新增「开户申请」（路由 `/advisor/prs`）：申请列表（客户名、状态徽章、最后更新），可新建申请（选现有客户 → 预填；不选 → 全新客户空白单）
- ClientDetail 页加快捷按钮「发起 PRS 开户」

### 申请编辑页（`/advisor/prs/:id`）

按表格逻辑分区：申请人资料 → 联系地址 → 职业与资金来源 → 银行与供款 → CRS 税务声明 → 受益人提名 → 顾问专区。

- 选定现有客户时全部预填，只补缺
- 顶部常驻「生成 PDF」（单份 / 打印包）+ 缺失字段警告
- 表单组件设计为**顾问端与阶段二客户端共用**（顾问专区 section 仅顾问端渲染）

现有 FormKitTab 保留不动。

## 8. 阶段二：客户填写链接

### 发送

编辑页「发给客户填写」按钮：生成 token（uuid v4，14 天过期）、状态转 `awaiting_client`、展示链接 + 一键复制 + 预设 WhatsApp 话术（顾问自己粘贴发送，不需要邮件服务）。token 可重新生成（旧的即刻失效）。

### 客户填写页（`/prs/:token`，公开路由）

- 复用现有 KYC 分步表单（KYCStepper）的视觉风格与组件模式：手机优先、EN/中文界面切换（填写内容为英文）
- 打开时经 API 按 token 取预填数据；逐步填写；提交前总览确认
- 提交后：form_data 落库、状态转 `submitted`、token 失效、执行 §5 同步规则（新客户建档）
- token 无效/过期/已提交 → 友好提示页（联系顾问）

### API（Vercel Functions，沿用现有 `api/` service-role 模式）

- `GET /api/prs-application?token=` —— 仅当状态为 `awaiting_client` 且未过期时返回该申请的 form_data（含预填），否则返回相应错误码
- `POST /api/prs-application` —— 校验 token、写入 form_data、状态转 submitted、同步 clients、token 失效

注：现有 `api/kyc.js` 写的是 `profiles`/`incomes` 等旧表名，与当前数据库（`clients` 表 + `kyc_payload` 列）不一致，疑为旧版残留。新 API 一律按当前 `clients` 模式实现，不沿用 kyc.js 的表结构。

### 审核闭环

顾问列表看到「待审核」（submitted）→ 打开同一编辑页核对修改 → 生成 PDF → 标记 completed（写 `pdf_generated_at`）。

## 9. 安全考虑

- token 为 uuid v4 不可枚举；14 天过期；提交后立即失效；可由顾问主动重置
- token API 只返回该申请单条数据；不暴露 client_id 之外的任何客户列表信息
- 顾问专区字段（Consultant Code 等）不通过 token API 下发
- PDF 在浏览器本地生成，不上传、不存储
- prs_applications 启用 RLS，顾问只见自己的申请

## 10. 错误处理

| 情形 | 处理 |
|---|---|
| 必填字段缺失 | 照样生成 PDF（留空手填），生成前列警告清单 |
| 文字超出格子宽度 | 自动缩字号；到下限仍超出 → 警告清单 |
| token 过期/已用/无效 | 友好提示页，引导联系顾问 |
| 客户重复提交 | token 已失效，自然挡住 |
| 表格改版 | 映射文件记录版本号，README 注明重校准流程 |

## 11. 验收标准

1. **坐标验收（阶段一完成的硬标准）**：样本客户数据生成全套 5 份试填 PDF，顾问打印对照实体表格逐页确认对位
2. TypeScript 编译零错误 + `vite build` 通过
3. 映射配置自动检查：每个字段坐标落在对应页边界内、key 与 `PrsFormData` 类型一致
4. token 流程：有效/过期/已提交/无效四种情形行为正确
5. 同步规则：现有客户字段更新、全新客户自动建档并进 Pipeline，均验证通过

## 12. 未来扩展（不在本期）

- 下一种表格（PMF）：复制"模板 + 映射文件"套路即可
- 电子签名 + softcopy 流转（接受电子签的表格类型再做）：网页签名板 → 签名图贴入 PDF → 一键 email 给 admin
- 一键发送 admin 的邮件基础设施（届时再选 Resend / Gmail API）
- 与 Cases 系统联动（开户申请自动生成 case + checklist）
