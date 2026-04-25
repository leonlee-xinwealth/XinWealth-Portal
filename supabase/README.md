# supabase/

XinWealth Portal 的 Supabase 配置和迁移工具。

## 目录结构

```
supabase/
├── MIGRATION_GUIDE.md              ← Supabase 总体教程（先从这里看）
├── LARK_MIGRATION.md               ← Lark API 自动搬运教程（傻瓜版）
├── README.md                       ← 本文件（速查）
├── migrations/                     ← 数据库 schema 演进（按时间戳排序）
│   ├── 20260424000001_initial_schema.sql   ← 全部表 & enum
│   ├── 20260424000002_triggers.sql         ← 自动化：updated_at / 注册 / 审计
│   ├── 20260424000003_rls_policies.sql     ← 权限规则（RLS）
│   ├── 20260424000004_views.sql            ← 查询视图（净值、月现金流等）
│   └── 20260424000005_secure_views.sql     ← 给 views 加 security_invoker
└── scripts/
    ├── lark-migrate.mjs            ← Lark → Supabase 迁移脚本（配置驱动）
    ├── lark-mapping.json           ← 字段映射配置（主要改这里）
    ├── migrate-from-lark.mjs       ← 旧版 CSV 脚本（可忽略）
    └── .env.migration.example      ← 脚本需要的环境变量模板
```

## 快速开始

1. **读完 `MIGRATION_GUIDE.md`**（Supabase 基础）
2. 在 Supabase 控制台按顺序跑 `migrations/` 里的 5 个 SQL 文件
3. **读完 `LARK_MIGRATION.md`**（Lark API 迁移教程）
4. `npm install @supabase/supabase-js dotenv`
5. 填好 `scripts/.env.migration` + `scripts/lark-mapping.json`
6. `node supabase/scripts/lark-migrate.mjs inspect` → 看字段
7. `node supabase/scripts/lark-migrate.mjs dry-run` → 模拟
8. `node supabase/scripts/lark-migrate.mjs run` → 真跑
9. 装完后改前端连 Supabase

## 加新表 / 新字段时

**不要**在控制台直接改。**要**新建一个 migration 文件：

```bash
# 文件名：YYYYMMDDHHMMSS_描述.sql
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_add_something.sql
```

然后在文件里写 `CREATE TABLE` / `ALTER TABLE` / `CREATE POLICY`，提交 git，执行 `supabase db push`。

详见 MIGRATION_GUIDE.md Part 7。

## 环境变量清单

**前端**（`.env.local`）：
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**迁移脚本**（`supabase/scripts/.env.migration`，**加到 .gitignore**）：
```
LARK_APP_ID=...
LARK_APP_SECRET=...
LARK_APP_TOKEN=...
LARK_TBL_CLIENT=...
...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```
