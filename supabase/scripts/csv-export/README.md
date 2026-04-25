# CSV 方式迁移 XinWealth.xlsx → Supabase

这个目录里的 CSV 已经根据 Supabase 的表结构从 `XinWealth.xlsx` 生成好了。

## 文件清单

| CSV 文件 | 行数 | 对应 Supabase 表 | 来源 sheet |
|---------|------|----------------|-----------|
| `profiles.csv`              | 38 | profiles (+ auth.users)  | Client |
| `incomes.csv`               | 18 | incomes                  | Incomes |
| `expenses.csv`              | 26 | expenses                 | Expenses |
| `assets.csv`                | 12 | assets                   | Net Worth (Type=Asset) |
| `liabilities.csv`           | 8  | liabilities              | Net Worth (Type=Liability) |
| `investments.csv`           | 3  | investments              | Investment |
| `insurance_policies.csv`    | 1  | insurance_policies       | Insurance |
| `portfolio_snapshots.csv`   | 30 | portfolio_snapshots      | Monthly Portfolio Update |

> Leads / Cashflow / Monthly Snapshot 这三个 sheet 暂时没导入（schema 里没对应表，之后可以加）。

## 怎么用？

### 方案 A（推荐）：用脚本自动导入

```bash
# 1. 装依赖
npm install @supabase/supabase-js dotenv

# 2. 填凭证
cp supabase/scripts/.env.migration.example supabase/scripts/.env.migration
# 编辑 .env.migration，只需要填这两个：
#   SUPABASE_URL=https://xxxxx.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# 3. 先模拟，看有没有问题
node supabase/scripts/csv-to-supabase.mjs dry-run

# 4. 确认没问题再真跑
node supabase/scripts/csv-to-supabase.mjs run
```

脚本会：
1. 按 `profiles.csv` 里的 email 在 Supabase Auth 创建用户（临时密码：`ChangeMe123!`）
2. 自动触发 `handle_new_user` 建 profile 行
3. 补齐 profile 的 KYC 字段
4. 按 email → UUID 的映射插入 6 张子表

### 方案 B：手动在 Supabase 控制台导入

**不推荐**，因为 profiles 表的 id 必须等于 auth.users.id，你得：

1. 先在 Dashboard → Authentication → Users 一个一个手动 Add User（38 次...）
2. 然后导出一份 email → UUID 的对照表
3. 在 Excel 里把 client_email 列替换成 profile_id UUID
4. 再一张一张 Table Editor 导入

大约 1–2 小时手工活。走方案 A 只要 2 分钟。

## CSV 里的字段说明

### profiles.csv
- `client_code` — 你原来的 XW-000001 编号（只是给你对账用，不导入 Supabase）
- 其他字段对应 profiles 表各列
- `gender` / `marital_status` / `employment_status` / `tax_status` 已经映射成 Supabase enum 值

### 子表通用
- `client_email` — 用这一列找对应的客户（脚本会自动转成 profile_id UUID）
- `currency` 默认填 `MYR`（可以手动在 CSV 里改）

## 数据质量提示

我跑生成脚本时发现：
- **只有 3 个客户**有 Tax Status / Residency / Nationality（其他都是空）
- Insurance sheet 里只有 1 条有效记录（剩下都是空行）
- 很多子表行（incomes/expenses/...）的 Client 字段是空的，这些行会被跳过（属于 Lark 的 placeholder）

如果想导入更多数据，回 Excel 补齐这些字段再重跑脚本。

## 改字段后怎么重新生成 CSV？

这批 CSV 是我这边一次性生成的。如果你之后在 Excel 里补了新数据：
- 让我再跑一次生成脚本（把最新 xlsx 发给我）
- 或者用方案 A 的脚本，改成直读 xlsx 也行（告诉我就写）
