# XinWealth Portal → Supabase 完整迁移指南

> 从零开始，手把手带你从 Lark Base 搬到 Supabase。\
> 按顺序一步一步做，每一步都有"为什么"和"检查点"。

---

## 目录

1. [Supabase 是什么（5 分钟版）](#1-supabase-是什么5-分钟版)
2. [Part 1：创建 Supabase 项目](#part-1创建-supabase-项目)
3. [Part 2：理解 RLS（最重要的概念）](#part-2理解-rls最重要的概念)
4. [Part 3：跑 Schema Migration](#part-3跑-schema-migration)
5. [Part 4：设置 Auth](#part-4设置-auth)
6. [Part 5：从 Lark 迁移数据](#part-5从-lark-迁移数据)
7. [Part 6：连接到 React 前端](#part-6连接到-react-前端)
8. [Part 7：以后怎么加新数据（最重要）](#part-7以后怎么加新数据最重要)
9. [常见坑 & FAQ](#常见坑--faq)

---

## 1. Supabase 是什么（5 分钟版）

**一句话：Supabase = PostgreSQL + 自动生成的 API + 用户登录 + 文件存储 + 实时推送**，全部集成在一个控制台里。

你可以把它想象成：

| 你需要的东西       | 自己搭要装        | Supabase 里                                 |
| ------------- | ------------ | ------------------------------------------ |
| 数据库           | PostgreSQL   | ✅ 已经给你了                                  |
| 后端 API        | Node/Express | ✅ 自动生成（`supabase.from('table').select()`） |
| 用户登录注册        | Passport/JWT | ✅ `supabase.auth.signUp()` 一行              |
| 权限控制          | 自己写 if/else | ✅ 用 SQL Policy 写在数据库里（RLS）                 |
| 上传图片          | S3 + SDK     | ✅ Supabase Storage                         |
| Websocket 实时  | Pusher/自己搭   | ✅ Realtime                                 |
| 定时任务 / 后端逻辑   | AWS Lambda   | ✅ Edge Functions                           |

**对你来说最直接的好处**：

- 不用再写 `/api/login`、`/api/data`、`/api/health` 这些 Vercel Serverless，前端直接查数据库。
- 不用再手写 JWT、不用再维护 localStorage。
- 权限（"顾问只能看自己客户"）一条 SQL 规则搞定，不会漏。
- 以后加新数据类型，不用改代码，只要在数据库加一张表。

---

## Part 1：创建 Supabase 项目

### 1.1 新建项目

1. 登录 <https://supabase.com/dashboard> → **New Project**
2. 填写：
   - **Name**：`xinwealth-portal`
   - **Database Password**：⚠️ **用密码管理器生成强密码并保存**，这是数据库的 root 密码
   - **Region**：`Southeast Asia (Singapore)`（离马来西亚最近）
   - **Pricing Plan**：Free（足够开发和早期几十个用户）
3. 点 Create，等 2 分钟

### 1.2 拿到三个关键值

项目建好后，左侧菜单 **Project Settings → API**，你会看到：

| 名字                          | 作用                    | 放哪里                   |
| --------------------------- | --------------------- | --------------------- |
| `Project URL`               | 所有 API 调用的基地址          | 前端 `.env.local` + 迁移脚本 |
| `anon public` key           | 前端用的公钥，受 RLS 保护        | 前端 `.env.local`      |
| `service_role secret` key  | 后端用的超级钥匙，**绕过所有 RLS** | 迁移脚本、服务器，绝不放前端       |

**✅ 检查点**：登录 Dashboard 看到你的项目，左下角有绿色的"Healthy"。

---

## Part 2：理解 RLS（最重要的概念）

Supabase 和传统后端最大的区别是 **RLS（Row Level Security）**。

### 传统方式
```js
// Express 后端
app.get('/api/my-incomes', authenticate, async (req, res) => {
  const rows = await db.query(
    'SELECT * FROM incomes WHERE user_id = $1',
    [req.user.id]   // ⚠️ 忘了加 WHERE 就漏了所有人的数据
  );
  res.json(rows);
});
```

### Supabase 的方式
```js
// 前端直接查
const { data } = await supabase.from('incomes').select('*');
// 不用写 WHERE！数据库自己知道"只给当前用户自己的数据"
```

怎么做到的？因为数据库里有一条 Policy：
```sql
CREATE POLICY "own_data" ON incomes FOR SELECT
  USING (profile_id = auth.uid());
```

**`auth.uid()`** 是 Supabase 内置函数，返回当前登录用户的 UUID。

> 💡 **黄金法则**：**每张存用户数据的表都必须开 RLS + 至少一条 policy**。没开 RLS 的表，等于裸奔。

你要记住的就这一点。我的 migration 文件里已经帮你把所有 policy 都写好了。

**✅ 检查点**：明白了 "写业务代码时不用再检查权限，数据库会自动过滤" 这件事。

---

## Part 3：跑 Schema Migration

我已经在 `supabase/migrations/` 下给你准备好了 4 个 SQL 文件，按数字顺序跑。

### 方法 A：用控制台 SQL Editor（最简单）

1. Supabase Dashboard → 左侧 **SQL Editor** → **New query**
2. **按顺序**一个一个文件复制粘贴进去，每个都点 **RUN**：

   ```
   1. 20260424000001_initial_schema.sql   ← 建所有表和 enum
   2. 20260424000002_triggers.sql         ← updated_at / 注册 / 审计
   3. 20260424000003_rls_policies.sql     ← 权限规则
   4. 20260424000004_views.sql            ← 方便的查询视图
   ```

3. 每跑一个，检查下面有没有红色报错

### 方法 B：用 Supabase CLI（推荐长期做法）

```bash
npm install -g supabase
supabase login
cd D:\XinWealth Portal App\XinWealth-Portal
supabase link --project-ref <你的-project-ref>
supabase db push
```

CLI 会自动识别 `supabase/migrations/` 下的所有文件并按时间戳顺序跑。

**✅ 检查点**：左侧 **Table Editor** 能看到 `profiles`、`incomes`、`assets`、`liabilities`、`investments`、`kyc_submissions` 等表，每张表右上角都有一个 **"RLS enabled"** 的绿盾牌。

---

## Part 4：设置 Auth

### 4.1 开启 Email 登录

Dashboard → **Authentication → Providers → Email** → 打开 `Enable Email provider`。

两个建议：
- **Confirm email**：开发阶段先关（否则每个测试用户都要收邮件确认）。上线前打开。
- **Secure email change**：开。

### 4.2 理解自动创建 profile

注意看 `20260424000002_triggers.sql` 里的 `handle_new_user()` trigger：

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

意思是：**用户一注册，自动在 `profiles` 表插入一行**。所以你前端只要调：

```js
await supabase.auth.signUp({
  email: 'leon@example.com',
  password: '...',
  options: { data: { family_name: 'Chen', given_name: 'Leon' } }
});
```

profiles 表会自动有对应的行。这样你就不用再写 `/api/register` 了。

**✅ 检查点**：
1. 在 Dashboard **Authentication → Users** 点 **Add user → Create new user**，手动创建一个测试账号。
2. 回到 **Table Editor → profiles**，应该看到这个用户的行已经自动出现了。

---

## Part 5：从 Lark 迁移数据

### 5.1 准备脚本

```bash
cd D:\XinWealth Portal App\XinWealth-Portal
npm install @supabase/supabase-js dotenv
```

### 5.2 填环境变量

把 `supabase/scripts/.env.migration.example` 复制成 `.env.migration`，填上：
- Lark 的 app_id / app_secret / app_token / 各个 table id
- Supabase 的 URL 和 **service_role** key（不是 anon！）

> 🔒 **把 `.env.migration` 加到 `.gitignore`**，绝不提交到 git。

### 5.3 先空跑

```bash
node supabase/scripts/migrate-from-lark.mjs --dry-run
```

这个模式只读 Lark、打印统计，**不会写 Supabase**。检查数据量对不对。

### 5.4 真跑

```bash
node supabase/scripts/migrate-from-lark.mjs
```

迁移顺序是：
1. Client → auth.users + profiles（先建用户账号）
2. Incomes（依赖 profile_id）
3. Expenses
4. Assets、Liabilities
5. Investments
6. Insurance

脚本是**幂等**的——跑一半断了，重跑不会重复插入（用 email 做去重）。

### 5.5 验证

```sql
-- 在 SQL Editor 跑
SELECT COUNT(*) FROM profiles;       -- 应该等于 Lark Client 表行数
SELECT COUNT(*) FROM incomes;        -- 对得上 Lark Incomes
SELECT * FROM v_current_net_worth LIMIT 10;   -- 用 view 抽检
```

**✅ 检查点**：三个数字对得上，`v_current_net_worth` 算出来的净值和原来 Dashboard 看到的一致。

> 💡 第一次迁移后，**保留 Lark Base 不要删**，让它当 backup 一段时间。

---

## Part 6：连接到 React 前端

### 6.1 装 SDK

```bash
npm install @supabase/supabase-js
```

### 6.2 新建 `lib/supabase.ts`

```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL!;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey);
```

### 6.3 `.env.local`

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 6.4 替换 Login.tsx

原来：
```ts
const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
```

改成：
```ts
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) { /* 显示错误 */ return; }
// data.session 自动存在 localStorage，不用手动管
// data.user.id 就是 profile_id
```

### 6.5 替换 larkService.ts 的读数据

原来：
```ts
const res = await fetch(`/api/data?name=${encodeURIComponent(session.name)}`);
```

改成：
```ts
const { data: investments } = await supabase
  .from('investments')
  .select('*, transactions:investment_transactions(*)');
// 不用传 name，RLS 自动帮你过滤成当前用户的
```

### 6.6 保护路由

```ts
// 检查是否登录
const { data: { session } } = await supabase.auth.getSession();
if (!session) navigate('/login');

// 监听登录状态变化（比如 token 过期）
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') navigate('/login');
});
```

**✅ 检查点**：前端登录、显示 Dashboard、提交 KYC 全部走 Supabase，`/api/*` 可以逐个删掉。

---

## Part 7：以后怎么加新数据（最重要）

你说"日后会有很多不同数据要录入"，这里是关键。**不要再用 Lark Base 那种'随便加列'的思路**，而是要养成"版本化 migration"的习惯。

### 7.1 新数据的三种情形

**情形 A：在现有表加字段**（比如给 `profiles` 加 `risk_tolerance`）

```sql
-- 新建 supabase/migrations/20260501000001_add_risk_tolerance.sql
ALTER TABLE profiles
  ADD COLUMN risk_tolerance TEXT
  CHECK (risk_tolerance IN ('conservative','moderate','aggressive'));
```

**情形 B：加一个全新数据类型**（比如"财务目标" financial_goals）

```sql
-- 新建 supabase/migrations/20260501000002_create_goals.sql
CREATE TABLE financial_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,       -- retirement / education / house...
  target_amount NUMERIC(18, 2),
  target_date DATE,
  progress NUMERIC(18, 2) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 别忘了这 4 步！
ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_all" ON financial_goals FOR ALL
  USING (profile_id = auth.uid() OR is_advisor_of(profile_id) OR is_admin())
  WITH CHECK (profile_id = auth.uid() OR is_advisor_of(profile_id) OR is_admin());

CREATE TRIGGER goals_updated_at BEFORE UPDATE ON financial_goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER audit_goals
  AFTER INSERT OR UPDATE OR DELETE ON financial_goals
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();
```

**情形 C：结构多变的弹性字段**（比如各种自定义 KPI）

用 JSONB：

```sql
UPDATE profiles
   SET preferences = preferences || '{"dashboard_theme":"dark"}'::jsonb
 WHERE id = auth.uid();
```

`metadata JSONB` 字段已经准备在 `assets`、`investments`、`insurance_policies` 里了——临时加字段不用改 schema。

### 7.2 migration 文件命名规则

```
supabase/migrations/YYYYMMDDHHMMSS_short_description.sql
```

**为什么加时间戳**：按字母顺序排就是执行顺序，团队协作不会冲突。

### 7.3 工作流（养成习惯）

每次要改数据库：

1. 在 `supabase/migrations/` 新建文件（不要在控制台直接改！）
2. 本地用 `supabase db reset` 起一个本地 Postgres 跑一遍，确认没问题
3. 提交 git
4. `supabase db push` 应用到线上
5. 前端代码同步更新

**永远不要**在 Dashboard 里直接改表结构——那会导致本地和线上不一致，下次别人拉代码跑不起来。

### 7.4 什么时候用新表，什么时候用 JSONB

| 场景                       | 用什么        |
| ------------------------ | ---------- |
| 要做 SUM/AVG/GROUP BY      | 新表 + 独立字段  |
| 要做外键引用                   | 新表         |
| 要做索引加速查询                 | 新表 + 独立字段  |
| 每个用户结构不一样的自由属性           | JSONB 字段   |
| 临时加一两个字段，还没决定是否长期保留      | JSONB 字段   |
| 第三方 API 返回的整包数据要存档       | JSONB 字段   |

**经验法则：先 JSONB 快速迭代，稳定下来后提取成独立列。**

---

## 常见坑 & FAQ

### Q1：我执行 SELECT 为什么返回空？
99% 是 RLS 没配。用 SQL Editor 跑 `SELECT * FROM your_table;` 是以 `postgres` 超级用户身份，会有数据；但前端用 anon key 查就要受 policy 限制。

**调试：** 在 SQL Editor 里模拟用户：
```sql
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"user-uuid-here"}';
SELECT * FROM profiles;   -- 现在会模拟这个用户查
RESET ROLE;
```

### Q2：Supabase 免费版够用吗？
- 500 MB 数据库、1 GB 文件存储、50,000 月活用户、2 GB 出口流量
- 7 天无活动自动暂停（点一下就恢复，开发期无所谓）
- 早期够用；几百个付费用户开始考虑 Pro（$25/月）

### Q3：要不要还留着 Vercel Serverless?
留着也行，但只处理**前端不能直接做的**：
- 调第三方 API 时要藏 secret key（比如 Gemini）→ 可以搬到 Supabase **Edge Functions**
- 定时任务（每日刷新 portfolio snapshot）→ Supabase **pg_cron** 或 Edge Function + Vercel Cron

### Q4：服务 role key 是不是不能用？
可以用，但**只在服务器**用（迁移脚本、后端定时任务）。
**绝对不能**放到前端、Vercel 环境变量里被前端读到、或 commit 到 git。

### Q5：数据库备份？
- Free 版每天自动备份，保留 7 天
- Dashboard → **Database → Backups** 可以下载
- 重要节点自己多跑一次 `pg_dump`

### Q6：怎么本地开发？
```bash
supabase init           # 初始化配置
supabase start          # 启动本地 Postgres + Studio（Docker）
supabase db reset       # 跑 migrations + seed
```
本地 Studio 在 <http://localhost:54323>。

---

## 一句话总结

**你的新工作流**：\
改数据 → 写 SQL migration 文件 → 提交 git → `supabase db push` → 前端 `supabase.from(...).select()`。

就这样。不用再写 `/api/xxx`，不用再手写 JWT，不用再怕忘了 `WHERE user_id=`。

---

下一步你想先做哪个？我可以帮你：
- 把 `Login.tsx` / `Register.tsx` 改成 Supabase Auth 版本
- 写把 `larkService.ts` 换成 `supabaseService.ts` 的具体代码
- 加一张新表（比如 financial_goals）作为练习
- 写一个 `portfolio_snapshots` 每日自动刷新的 Edge Function
