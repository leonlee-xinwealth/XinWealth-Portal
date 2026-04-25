# Lark → Supabase 自动迁移教程

> 面向：完全没接触过 Lark Open API 的人
>
> 目标：**配置一次 → 一条命令把 Lark Base 所有数据搬到 Supabase**
>
> 所需时间：第一次约 30–40 分钟（主要是在 Lark 后台创建应用）

---

## 它是怎么工作的？

```
┌─────────────┐   HTTPS    ┌──────────────┐   HTTPS    ┌──────────────┐
│  Lark Base  │ ─────────▶ │ 迁移脚本     │ ─────────▶ │  Supabase    │
│ (多维表格)  │   读记录   │ (你的电脑)   │  插数据    │ (PostgreSQL) │
└─────────────┘            └──────────────┘            └──────────────┘
```

脚本分三个模式：
- **`inspect`** — 只读。列出 Lark Base 里所有表和字段，方便你填映射表。
- **`dry-run`** — 模拟跑。只读 Lark、不写 Supabase，告诉你"会搬多少行、有哪些字段对不上"。
- **`run`** — 真跑。把数据写进 Supabase。

**重要：所有模式都是只读 Lark 的**，不会改动你的 Lark Base。

---

## 开始前，你需要有：

- [x] 已经跑完 `supabase/migrations/` 里的 5 个 SQL（schema、triggers、RLS、views、secure_views）
- [x] Lark Base 的管理员权限（能创建应用）
- [x] Supabase 的 `service_role` key
- [x] Node.js 18+（`node --version` 检查）

---

## Step 1 — 装依赖（1 分钟）

在项目根目录开终端：

```bash
npm install @supabase/supabase-js dotenv
```

脚本用的就这两个库：
- `@supabase/supabase-js` — Supabase 官方 SDK
- `dotenv` — 读 `.env.migration` 文件

Lark 那边脚本直接用 Node 内置 `fetch`，不用装额外库。

---

## Step 2 — 在 Lark 开发者后台创建"自建应用"（10 分钟）

### 2.1 打开开发者后台

- 海外版（.larksuite.com）：https://open.larksuite.com
- 国内版（.feishu.cn）：https://open.feishu.cn

用你 Lark Base 所在的那个账号登录。**两个版本不通用**，你是哪个就进哪个。

> 不确定自己是哪个？看 Lark Base 的 URL：
> - `xxx.larksuite.com` → **海外版**（larksuite）
> - `xxx.feishu.cn` → **国内版**（feishu）
>
> `lark-mapping.json` 里的 `lark_region` 字段也要对应改成 `larksuite` 或 `feishu`。

### 2.2 创建自建应用

1. 左侧菜单：**开发者后台 → 创建企业自建应用**
2. 填：
   - 应用名称：`XinWealth 数据迁移`（随便取，自己看得懂就行）
   - 应用描述：`一次性迁移工具`
   - 图标：随便传一个
3. 点**创建**

### 2.3 拿到 App ID 和 App Secret

进入刚建好的应用 → 左侧 **凭证与基础信息**：

- **App ID**：形如 `cli_xxxxxxxxxxxxxxxx` → 记下来，待会填 `LARK_APP_ID`
- **App Secret**：点"显示"看到完整值 → 记下来，待会填 `LARK_APP_SECRET`

⚠️ App Secret 相当于密码，不要截图发人、不要提交 git。

### 2.4 开通 Bitable（多维表格）权限

这是**最容易漏**的一步。没开通权限的话脚本会报 99991672 / 1254030 这类错。

左侧菜单 → **权限管理 → 权限配置** → 搜索 `bitable`：

勾选这些权限（至少）：
- `bitable:app` — 查看、编辑多维表格
- `bitable:app:readonly` — 查看多维表格（有时叫这个）
- `base:record:retrieve` 或 `bitable:record` — 读记录

> 不同版本的后台名字可能略不同，**凡是和 "base" / "bitable" 有关的读权限全勾上**，反正你只是读。

勾完点**保存**。

### 2.5 发布应用

左侧菜单 → **版本管理与发布** → **创建版本**：

- 版本号：`1.0.0`
- 版本说明：`迁移脚本`
- 可用范围：**全部成员**（或至少包括你自己）
- 点**保存** → 再点**申请发布**

如果后台提示"需要管理员审核"，到 Lark 管理后台（不是开发者后台）批准一下，通常几秒钟就过。

> 校验是否发布成功：回到"凭证与基础信息"，"应用状态"应该是**已发布**（绿色）。

### 2.6 把应用加进 Lark Base

这一步也容易漏。应用发布了不代表能访问你那张具体的 Base。

1. 打开你的 Lark Base（浏览器）
2. 右上角 **⋯** → **更多 → 添加文档应用**（或 **API 权限管理 / 协作者**，名字随版本变）
3. 搜刚创建的应用名 → 加为**可编辑**（虽然只读就够了，加编辑更稳妥）

---

## Step 3 — 拿到 Base 的 App Token（1 分钟）

打开你的 Lark Base，看浏览器地址栏：

```
https://xxx.larksuite.com/base/bascnABCDEFG12345?table=tblXYZ&view=vewXYZ
                                └──────┬──────┘
                                这一段就是 APP_TOKEN
```

把 `bascn...` 那一段记下来，待会填 `LARK_APP_TOKEN`。

---

## Step 4 — 填 `.env.migration`（2 分钟）

到 `supabase/scripts/` 目录：

```bash
cp .env.migration.example .env.migration
```

用编辑器打开 `.env.migration`，填四个值：

```
LARK_APP_ID=cli_你的...
LARK_APP_SECRET=你的secret
LARK_APP_TOKEN=bascn你的appToken

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...（service_role，不是 anon）
```

> Supabase 的两个值：Dashboard → Project Settings → API 页。
> **务必用 service_role，不是 anon。** 它是 admin 级别，能绕过 RLS 创建用户，只能在这种服务端脚本里用。

---

## Step 5 — 跑 `inspect` 看 Lark 里的表和字段（30 秒）

```bash
node supabase/scripts/lark-migrate.mjs inspect
```

会输出类似这样：

```
📋 Lark Base 里的所有表：

[客户信息]   table_id = tbl1a2b3c4d5e
  字段：
    - Email (text)
    - Family Name (text)
    - Given Name (text)
    - Gender (singleSelect)  选项: [Male, Female, 男, 女]
    - Date of Birth (date)
    ...

[收入]   table_id = tbl9x8y7z6w5v
  字段：
    - Email (text)
    - Type (singleSelect)  选项: [Salary, Bonus, ...]
    - Amount (number)
    ...
```

**这是给你抄的。** 别手打，容易出错。

---

## Step 6 — 填 `lark-mapping.json`（5–10 分钟）

打开 `supabase/scripts/lark-mapping.json`，对着 inspect 的输出改：

### 6.1 填 `lark_region`

```json
"lark_region": "larksuite"   // 海外版
// 或
"lark_region": "feishu"      // 国内版
```

### 6.2 填每张表的 `lark_table_id`

把 `tblxxxxxxxxxxxx` 换成 inspect 输出的真实 ID：

```json
"clients": {
  "lark_table_id": "tbl1a2b3c4d5e",   // ← 从 inspect 抄过来
  ...
}
```

**没有对应 Lark 表的就把 `lark_table_id` 留空或整个表块删掉**，脚本会跳过。

### 6.3 核对字段名

`fields` 里左边是 Supabase 列名（别改），右边是 Lark 字段名（按你的 Base 改）：

```json
"fields": {
  "email":       "Email",            // ← 如果你 Lark 里叫"邮箱"，改成 "邮箱"
  "family_name": "Family Name",      // ← 如果叫"姓"，改成 "姓"
  ...
}
```

### 6.4 核对枚举值映射

如果你 Lark 单选里用的是中文，确保映射里有：

```json
"gender": {
  "Male": "male",
  "Female": "female",
  "男": "male",       // ← 保留这些中文映射
  "女": "female"
}
```

映射里**没有**的值会被当成 `null` 存（脚本会打印警告，你可以回头补）。

### 6.5 客户的默认密码

`clients.default_password` 是所有迁移用户的临时登录密码。迁移完**让每个用户走"忘记密码"重设**。

---

## Step 7 — 先 `dry-run`（30 秒）

```bash
node supabase/scripts/lark-migrate.mjs dry-run
```

脚本会：
- ✅ 从 Lark 读所有记录
- ✅ 按映射转换
- ❌ **不写** Supabase
- 📊 打印每张表会导入多少行 + 有哪些字段没映射上

**先看输出。典型的问题：**

| 警告 | 怎么办 |
|------|--------|
| `⚠️ Lark field "Email" not found in table "客户"` | 检查 `fields.email` 对应的 Lark 字段名是否拼错 |
| `⚠️ Enum value "男性" not in mapping for gender` | 在 `enum_mapping.gender` 加一条 `"男性": "male"` |
| `⚠️ Client email "xxx" not found, skipping row` | 这行 Lark 收入/资产找不到对应客户，检查 `client_link_field` |
| `❌ Invalid date format: "2020/13/45"` | Lark 里有脏数据，去 Lark 里修了再跑 |

修完 `lark-mapping.json` 再 `dry-run`，直到没有严重警告。

---

## Step 8 — 真跑 `run`

```bash
node supabase/scripts/lark-migrate.mjs run
```

脚本会按顺序：
1. 在 Supabase Auth 里创建用户（用默认密码）
2. 触发 `handle_new_user` 触发器自动建 profiles 行
3. 更新 profile 的所有 KYC 字段
4. 插 incomes / expenses / assets / liabilities / investments / insurance_policies
5. 打印一份总结：`✅ 63 rows → profiles, 142 rows → incomes, ...`

**脚本是幂等的**：
- 已存在的 email 不会重复建账户（会沿用原账户更新 profile）
- 子表数据每次跑都会 upsert（所以同一数据跑两次不会出现重复记录，只要你的 Lark 原记录有稳定字段）

---

## Step 9 — 验证

在 Supabase Dashboard：

1. **Authentication → Users** — 看到所有用户
2. **Table Editor → profiles** — 行数 = 客户数
3. **Table Editor → incomes** — 按 `profile_id` 筛选能看到每人的收入

或者跑这条 SQL：

```sql
SELECT
  p.email,
  p.family_name,
  (SELECT COUNT(*) FROM incomes WHERE profile_id = p.id)     AS incomes,
  (SELECT COUNT(*) FROM expenses WHERE profile_id = p.id)    AS expenses,
  (SELECT COUNT(*) FROM assets WHERE profile_id = p.id)      AS assets,
  (SELECT COUNT(*) FROM liabilities WHERE profile_id = p.id) AS liabs
FROM profiles p
ORDER BY p.email;
```

对一下和 Lark 里的数是否一致。

---

## Step 10 — 通知用户重设密码

迁移完你在 Supabase 有了账户，但用户不知道密码。两个做法：

**做法 A（推荐）**：每人发一封"忘记密码"链接
- Supabase Dashboard → Authentication → Users → 选中用户 → **Send password recovery**

**做法 B**：写一封 broadcast，让用户自己点登录页的"忘记密码"

---

## 常见错误速查

| 报错 | 原因 | 解法 |
|------|------|------|
| `99991663` invalid app_access_token | app_id / app_secret 填错 | 回开发者后台核对 |
| `99991672` permission denied | 没开 bitable 权限或应用没发布 | Step 2.4 / 2.5 |
| `1254030` app not authorized to this base | 应用没加进 Base | Step 2.6 |
| `1254045` table not found | `lark_table_id` 填错 | 重跑 `inspect` 对照 |
| `User already registered` | 这 email 的账户已存在 | 正常，脚本会跳过建用户、继续更新 profile |
| `permission denied for table profiles` | 用了 anon key 而不是 service_role | 改 `.env.migration` |
| `duplicate key value violates unique constraint` | 重跑时插了重复记录 | 看报错在哪张表，通常是 Lark 里有完全相同的两行 |

---

## 未来加新表怎么办？

比如日后你想加一张"子女"表：

1. 写新 migration：`supabase/migrations/YYYYMMDDHHMMSS_add_dependants.sql`
2. 在 `lark-mapping.json` 的 `tables` 里加一个 `dependants` 块
3. 在 `lark-migrate.mjs` 里加一个 `buildDependantRow` 函数（参考 `buildIncomeRow`）
4. 在 `migrate()` 里加一行 `await migrateSubTable('dependants', buildDependantRow, token, emailToId)`

就这三步，不用重写脚本。

---

## 文件对照

```
supabase/
├── LARK_MIGRATION.md              ← 本文件
├── MIGRATION_GUIDE.md             ← Supabase 总体教程
├── README.md                      ← 速查
├── migrations/                    ← 5 个 SQL（已跑完）
└── scripts/
    ├── lark-migrate.mjs           ← 迁移脚本本体
    ├── lark-mapping.json          ← 字段映射（你主要改这里）
    ├── .env.migration.example     ← 环境变量模板
    └── .env.migration             ← 你的真实凭证（.gitignore）
```
