# Retention & Marketing — Implementation Plan

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现两个模块 — (A) Retention 提醒：在 Dashboard 新增"需要关注"区块，显示生日 ≤3 天 + 超过 30 天未联系的活跃客户；(B) Marketing Broadcast：一个发群发邮件的页面（写内容、筛选收件人、立即发送/排程发送、发送记录）。

**架构：** Retention 基于 `clients.last_contacted_at`（每次写 `client_notes` 时由 DB trigger 自动更新）。Broadcast 存储到 `broadcasts` 表，通过 Supabase Edge Function 调用 Resend API 发送邮件。排程发送用 Supabase pg_cron 每小时触发一次 Edge Function 处理到期的排程广播。

**技术栈：** React 18 + TypeScript, Supabase (PostgreSQL + Edge Functions), Resend API, Tailwind CSS, lucide-react。**无新的前端依赖**（富文本编辑器用 `document.execCommand` contentEditable 实现）。

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `supabase/migrations/20260520000001_retention_and_broadcast.sql` | 创建 | `clients.last_contacted_at` 字段 + 触发器 + `broadcasts` 表 |
| `components/advisor/pages/Dashboard.tsx` | 修改 | 新增 Block C "需要关注" ActionCard |
| `components/advisor/pages/Broadcast.tsx` | 创建 | Broadcast 页面（Compose + History 两个 tab） |
| `supabase/functions/send-broadcast/index.ts` | 创建 | Edge Function：验证权限 → 取收件人 → Resend 批量发送 → 更新状态 |
| `components/advisor/AdvisorApp.tsx` | 修改 | 加 `/advisor/broadcast` 路由 |
| `components/advisor/AdvisorLayout.tsx` | 修改 | 加 Broadcast 侧边栏导航项 |

---

## Sprint 5 — Retention 基础

---

### 任务 1：DB Migration — `last_contacted_at` 字段 + 触发器

**文件：**
- 创建：`supabase/migrations/20260520000001_retention_and_broadcast.sql`

- [ ] **步骤 1：写 SQL migration 文件**

```sql
-- =========================================================================
-- Sprint 5/6: Retention & Broadcast
-- Migration: 20260520000001_retention_and_broadcast.sql
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- Part 1: last_contacted_at (Retention)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

-- Trigger: whenever a client_note is inserted, update last_contacted_at
CREATE OR REPLACE FUNCTION update_last_contacted_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE clients
    SET last_contacted_at = NOW()
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_client_note_inserted ON client_notes;
CREATE TRIGGER on_client_note_inserted
  AFTER INSERT ON client_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_last_contacted_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Part 2: broadcasts table (Sprint 6, defined here so it ships in one migration)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcasts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advisor_id       UUID NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,          -- stored as HTML
  recipient_filter JSONB NOT NULL DEFAULT '{"type":"all"}'::jsonb,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'sent', 'scheduled')),
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  recipient_count  INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_advisor
  ON broadcasts(advisor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled
  ON broadcasts(status, scheduled_at)
  WHERE status = 'scheduled';

-- updated_at trigger for broadcasts
CREATE TRIGGER broadcasts_updated_at
  BEFORE UPDATE ON broadcasts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **步骤 2：在 Supabase 执行这个 migration**

方法 A（推荐，用 Supabase MCP 工具）：
```
mcp__supabase__apply_migration({ name: "retention_and_broadcast", query: "<上面完整的 SQL>" })
```

方法 B（Dashboard SQL Editor）：复制完整 SQL → Supabase Dashboard → SQL Editor → Run。

预期：无报错，`clients` 表有 `last_contacted_at` 列，`broadcasts` 表存在。

- [ ] **步骤 3：验证**

在 Supabase SQL Editor 运行：
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'clients' AND column_name = 'last_contacted_at';

SELECT table_name FROM information_schema.tables
WHERE table_name = 'broadcasts';
```
预期：各返回 1 行。

- [ ] **步骤 4：Commit**

```bash
git add supabase/migrations/20260520000001_retention_and_broadcast.sql
git commit -m "feat(db): add last_contacted_at to clients, trigger, and broadcasts table"
```

---

### 任务 2：Dashboard — Block C "需要关注"

**文件：**
- 修改：`components/advisor/pages/Dashboard.tsx`

Block C 显示：
- 🎂 活跃客户中生日 **≤ 3 天**的（更紧急，已有的 30 天生日卡保留）
- 💬 活跃客户中 `last_contacted_at` 为 null 或 **超过 30 天**未联系的

- [ ] **步骤 1：在 clients select 加 `last_contacted_at`**

找到 Dashboard.tsx 第 34-38 行：
```typescript
const { data: cls } = await supabase
  .from('clients')
  .select('id, full_name, email, phone, status, date_of_birth, nric, risk_profile')
  .eq('advisor_id', adv.id)
  .order('full_name');
```

改为：
```typescript
const { data: cls } = await supabase
  .from('clients')
  .select('id, full_name, email, phone, status, date_of_birth, nric, risk_profile, last_contacted_at')
  .eq('advisor_id', adv.id)
  .order('full_name');
```

- [ ] **步骤 2：加 `notContacted` state 及计算**

在 `useState` 声明区（第 13-21 行附近）加：
```typescript
const [notContacted, setNotContacted] = useState<any[]>([]);
```

在 `load()` 函数最后（`setLoading(false)` 之前）加计算：
```typescript
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const notContactedList = (cls || [])
  .filter(c => c.status === 'active')
  .filter(c => {
    if (!c.last_contacted_at) return true;
    return new Date(c.last_contacted_at) < thirtyDaysAgo;
  })
  .map(c => ({
    ...c,
    daysSinceContact: c.last_contacted_at
      ? Math.floor((Date.now() - new Date(c.last_contacted_at).getTime()) / 86400000)
      : null,
  }))
  .sort((a, b) => (b.daysSinceContact ?? 999) - (a.daysSinceContact ?? 999));
setNotContacted(notContactedList);
```

- [ ] **步骤 3：计算 urgentBirthdays（生日 ≤ 3 天）**

在现有 `upcomingBirthdays` 计算（约第 132-147 行）之后加：
```typescript
const urgentBirthdays = upcomingBirthdays.filter(c => c.daysUntil <= 3);
```

- [ ] **步骤 4：渲染 Block C ActionCard**

在 Dashboard return 内，Prospect Actions 卡片（`<ActionCard title={t('Prospect Actions'...`）之后加：

```tsx
{/* Block C: Needs Attention */}
{(urgentBirthdays.length > 0 || notContacted.length > 0) && (
  <ActionCard
    title={t('Needs Attention', '需要关注')}
    icon="🔔"
    count={urgentBirthdays.length + notContacted.length}
    urgent={true}
    empty={false}
    emptyText=""
  >
    {urgentBirthdays.slice(0, 3).map(c => (
      <Link key={`bday-${c.id}`} to={`/advisor/clients/${c.id}`}
        className="flex items-center gap-2.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-4 px-4 transition-colors"
      >
        <Avatar name={c.full_name} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-xin-blue truncate">{c.full_name}</div>
          <div className="text-xs text-slate-500">{c.dobFormatted}</div>
        </div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 bg-pink-100 text-pink-600">
          🎂 {c.daysUntil === 0 ? t('Today!', '今天!') : `${c.daysUntil}d`}
        </span>
      </Link>
    ))}
    {notContacted.slice(0, 5).map(c => (
      <Link key={`nc-${c.id}`} to={`/advisor/clients/${c.id}`}
        className="flex items-center gap-2.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-4 px-4 transition-colors"
      >
        <Avatar name={c.full_name} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-xin-blue truncate">{c.full_name}</div>
          <div className="text-xs text-slate-500">
            {c.daysSinceContact === null
              ? t('Never contacted', '从未联系')
              : `${c.daysSinceContact}${t(' days no contact', ' 天没联系')}`}
          </div>
        </div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 bg-slate-100 text-slate-600">
          💬
        </span>
      </Link>
    ))}
    {(urgentBirthdays.length + notContacted.length) > 8 && (
      <div className="py-2.5 text-center text-xs text-slate-400">
        + {urgentBirthdays.length + notContacted.length - 8} {t('more', '更多')}
      </div>
    )}
  </ActionCard>
)}
```

- [ ] **步骤 5：手动测试**

启动 dev server：`npm run dev`

验证：
1. 打开 Dashboard，如果有活跃客户且 `last_contacted_at` 为 null，Block C 出现并显示 💬 条目
2. 点击条目 → 跳转到 ClientDetail 的 Activity tab
3. 在 ActivityTab 添加一条 Note → 回到 Dashboard → 该客户从 Block C 消失（需刷新页面，因为触发器已更新 DB）

- [ ] **步骤 6：Commit**

```bash
git add components/advisor/pages/Dashboard.tsx
git commit -m "feat(dashboard): add Block C retention reminders (birthday ≤3d + not-contacted >30d)"
```

---

## Sprint 6 — Broadcast 群发

---

### 任务 3：路由 + 导航 + 页面骨架

**文件：**
- 修改：`components/advisor/AdvisorApp.tsx`
- 修改：`components/advisor/AdvisorLayout.tsx`
- 创建：`components/advisor/pages/Broadcast.tsx`

- [ ] **步骤 1：在 AdvisorApp.tsx 加路由**

在现有 import 列表末尾加：
```typescript
import Broadcast from './pages/Broadcast';
```

在 Route 列表（`<Route path="settings" ...` 之前）加：
```tsx
<Route path="broadcast" element={<Broadcast />} />
```

- [ ] **步骤 2：在 AdvisorLayout.tsx 加导航项**

在现有 import 里 lucide-react 解构加 `Megaphone`：
```typescript
import { LayoutDashboard, Users, Settings, LogOut, Menu, X, ShieldCheck, Target, Briefcase, Megaphone } from 'lucide-react';
```

在 `navItems` 数组（`cases` 和 `clients` 之间）插入：
```typescript
{ to: '/advisor/broadcast', icon: <Megaphone size={18} />, label: language === 'zh' ? '群发' : 'Broadcast', badge: 0 },
```

- [ ] **步骤 3：创建 Broadcast.tsx 骨架**

```tsx
import React, { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';

type BroadcastTab = 'compose' | 'history';

export default function Broadcast() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [tab, setTab] = useState<BroadcastTab>('compose');

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-serif text-2xl font-bold text-xin-blue">
          {t('Broadcast', '群发邮件')}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {t('Send emails to your clients', '向客户发送群发邮件')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(['compose', 'history'] as BroadcastTab[]).map(tb => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === tb
                ? 'bg-white text-xin-blue shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tb === 'compose' ? t('Compose', '写邮件') : t('History', '发送记录')}
          </button>
        ))}
      </div>

      {tab === 'compose' ? <ComposeTab t={t} language={language} /> : <HistoryTab t={t} language={language} />}
    </div>
  );
}

function ComposeTab({ t, language }: { t: (en: string, zh: string) => string; language: string }) {
  return <div className="text-slate-400 text-sm">{t('Coming in next step...', '下一步实现...')}</div>;
}

function HistoryTab({ t, language }: { t: (en: string, zh: string) => string; language: string }) {
  return <div className="text-slate-400 text-sm">{t('Coming in next step...', '下一步实现...')}</div>;
}
```

- [ ] **步骤 4：验证路由可访问**

`npm run dev` → 访问 `/advisor/broadcast` → 看到 "群发邮件" 标题和两个 tab → 侧边栏有 Megaphone 图标。

- [ ] **步骤 5：Commit**

```bash
git add components/advisor/AdvisorApp.tsx components/advisor/AdvisorLayout.tsx components/advisor/pages/Broadcast.tsx
git commit -m "feat(broadcast): add route, nav item, and page skeleton"
```

---

### 任务 4：ComposeTab — 标题 + 富文本编辑器 + 收件人筛选

**文件：**
- 修改：`components/advisor/pages/Broadcast.tsx`

- [ ] **步骤 1：用完整 ComposeTab 替换占位符**

将 Broadcast.tsx 中的 `ComposeTab` 函数替换为以下完整实现。注意 `RichTextEditor` 是一个子组件，写在同一文件底部。

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Send, Clock, Eye, X } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

type RecipientFilter = 'all' | 'has_insurance' | 'has_investment';

interface ComposeForm {
  title: string;
  content: string;            // HTML string
  filter: RecipientFilter;
  scheduledAt: string;        // ISO datetime-local string, empty = send now
}

const EMPTY_FORM: ComposeForm = {
  title: '',
  content: '',
  filter: 'all',
  scheduledAt: '',
};

// ── ComposeTab ───────────────────────────────────────────────────────────────

function ComposeTab({ t, language }: { t: (en: string, zh: string) => string; language: string }) {
  const [form, setForm] = useState<ComposeForm>(EMPTY_FORM);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const FILTER_LABELS: Record<RecipientFilter, { en: string; zh: string }> = {
    all:            { en: 'All active clients',       zh: '所有活跃客户' },
    has_insurance:  { en: 'Clients with insurance',   zh: '有保单的客户' },
    has_investment: { en: 'Clients with investments', zh: '有投资的客户' },
  };

  // Count recipients whenever filter changes
  useEffect(() => {
    async function countRecipients() {
      setRecipientCount(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
      if (!adv) return;

      let query = supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('advisor_id', adv.id)
        .eq('status', 'active')
        .not('email', 'is', null);

      if (form.filter === 'has_insurance') {
        // Get client IDs that have insurance first, then count
        const { data: policyClients } = await supabase
          .from('insurance_policies')
          .select('client_id')
          .eq('advisor_id', adv.id);
        const ids = [...new Set((policyClients || []).map((r: any) => r.client_id))];
        if (ids.length === 0) { setRecipientCount(0); return; }
        query = query.in('id', ids);
      }

      if (form.filter === 'has_investment') {
        const { data: assetClients } = await supabase
          .from('assets')
          .select('client_id')
          .in('client_id',
            (await supabase.from('clients').select('id').eq('advisor_id', adv.id).eq('status', 'active')).data?.map((c: any) => c.id) || []
          );
        const ids = [...new Set((assetClients || []).map((r: any) => r.client_id))];
        if (ids.length === 0) { setRecipientCount(0); return; }
        query = query.in('id', ids);
      }

      const { count } = await query;
      setRecipientCount(count ?? 0);
    }
    countRecipients();
  }, [form.filter]);

  async function handleSend(isScheduled: boolean) {
    if (!form.title.trim() || !form.content.trim()) return;
    setSending(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
      if (!adv) throw new Error('Advisor not found');

      const payload: any = {
        advisor_id: adv.id,
        title: form.title.trim(),
        content: form.content,
        recipient_filter: { type: form.filter },
        status: isScheduled ? 'scheduled' : 'draft',
      };
      if (isScheduled && form.scheduledAt) {
        payload.scheduled_at = new Date(form.scheduledAt).toISOString();
      }

      const { data: broadcast, error: insertErr } = await supabase
        .from('broadcasts')
        .insert(payload)
        .select()
        .single();
      if (insertErr || !broadcast) throw insertErr || new Error('Insert failed');

      if (!isScheduled) {
        // Call Edge Function to send immediately
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('send-broadcast', {
          body: { broadcastId: broadcast.id },
        });
        if (fnErr) throw fnErr;
      }

      setSent(true);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      setError(e.message || t('Send failed. Please try again.', '发送失败，请重试。'));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 p-10 text-center">
        <div className="text-4xl mb-3">✅</div>
        <div className="font-semibold text-xin-blue text-lg mb-2">
          {t('Broadcast sent!', '群发已发送！')}
        </div>
        <button
          onClick={() => setSent(false)}
          className="mt-4 px-6 py-2.5 bg-xin-blue text-white font-semibold rounded-xl text-sm hover:bg-xin-blueLight transition-colors"
        >
          {t('Send another', '再发一封')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <label className="text-xs font-medium text-slate-400 mb-1.5 block">
          {t('Subject', '邮件标题')} <span className="text-red-400">*</span>
        </label>
        <input
          value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          placeholder={t('e.g. May Market Update', '例：五月市场动态')}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors"
        />
      </div>

      {/* Rich text editor */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 pt-4 pb-2 border-b border-slate-100">
          <label className="text-xs font-medium text-slate-400">
            {t('Content', '内容')} <span className="text-red-400">*</span>
          </label>
        </div>
        <RichTextEditor
          value={form.content}
          onChange={v => setForm(p => ({ ...p, content: v }))}
          t={t}
        />
      </div>

      {/* Recipient filter */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <label className="text-xs font-medium text-slate-400 mb-3 block">
          {t('Recipients', '收件人')}
        </label>
        <div className="space-y-2">
          {(Object.keys(FILTER_LABELS) as RecipientFilter[]).map(f => (
            <label key={f} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="recipient-filter"
                checked={form.filter === f}
                onChange={() => setForm(p => ({ ...p, filter: f }))}
                className="accent-xin-blue"
              />
              <span className="text-sm text-xin-blue">
                {language === 'zh' ? FILTER_LABELS[f].zh : FILTER_LABELS[f].en}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 text-xs text-slate-400">
          {recipientCount === null
            ? t('Counting...', '计算中...')
            : `${recipientCount} ${t('recipients (with email address)', '位收件人（有邮箱地址）')}`}
        </div>
      </div>

      {/* Schedule input (optional) */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <label className="text-xs font-medium text-slate-400 mb-1.5 block">
          {t('Schedule (leave blank to send now)', '排程发送（留空 = 立即发送）')}
        </label>
        <input
          type="datetime-local"
          value={form.scheduledAt}
          onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
          min={new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16)}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowPreview(true)}
          className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-colors"
        >
          <Eye size={15} />
          {t('Preview', '预览')}
        </button>

        {form.scheduledAt ? (
          <button
            onClick={() => handleSend(true)}
            disabled={sending || !form.title.trim() || !form.content.trim() || (recipientCount ?? 0) === 0}
            className="flex items-center gap-2 flex-1 justify-center py-3 bg-xin-blue text-white font-semibold rounded-xl text-sm hover:bg-xin-blueLight disabled:opacity-40 transition-colors"
          >
            <Clock size={15} />
            {sending ? t('Scheduling...', '排程中...') : t('Schedule', '排程发送')}
          </button>
        ) : (
          <button
            onClick={() => handleSend(false)}
            disabled={sending || !form.title.trim() || !form.content.trim() || (recipientCount ?? 0) === 0}
            className="flex items-center gap-2 flex-1 justify-center py-3 bg-xin-gold text-xin-blue font-semibold rounded-xl text-sm hover:bg-xin-gold/90 disabled:opacity-40 transition-colors"
          >
            <Send size={15} />
            {sending ? t('Sending...', '发送中...') : `${t('Send Now', '立即发送')}${recipientCount !== null ? ` (${recipientCount})` : ''}`}
          </button>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-xin-blue">{t('Email Preview', '邮件预览')}</h3>
              <button onClick={() => setShowPreview(false)} className="text-slate-300 hover:text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="text-xs text-slate-400 mb-1">{t('Subject', '主题')}</div>
              <div className="font-semibold text-xin-blue mb-5 text-lg">{form.title || t('(No subject)', '（无标题）')}</div>
              <div className="border-t border-slate-100 pt-5">
                <div
                  className="prose prose-sm max-w-none text-slate-700"
                  dangerouslySetInnerHTML={{ __html: form.content || `<p class="text-slate-400">${t('(No content)', '（无内容）')}</p>` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **步骤 2：验证 ComposeTab 渲染正常**

`npm run dev` → `/advisor/broadcast` → Compose tab：
- 标题 input 可输入
- 富文本编辑器有格式化工具栏（下一步加）
- 收件人筛选 radio 按钮
- 收件人数量显示（需要 DB 数据）
- "立即发送" 按钮在输入内容后 enabled

- [ ] **步骤 3：Commit**

```bash
git add components/advisor/pages/Broadcast.tsx
git commit -m "feat(broadcast): implement ComposeTab with recipient filter and preview"
```

---

### 任务 5：RichTextEditor 子组件

**文件：**
- 修改：`components/advisor/pages/Broadcast.tsx`（在文件底部添加）

- [ ] **步骤 1：在文件末尾加 RichTextEditor 组件**

```tsx
// ── RichTextEditor ───────────────────────────────────────────────────────────
// Uses document.execCommand (deprecated but universally supported for basic formatting)

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  t: (en: string, zh: string) => string;
}

function RichTextEditor({ value, onChange, t }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Initialise content only on first render to avoid cursor jumping
  useEffect(() => {
    if (isFirstRender.current && editorRef.current) {
      editorRef.current.innerHTML = value;
      isFirstRender.current = false;
    }
  }, []);

  function exec(command: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  const btnCls = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors';

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-2 border-b border-slate-100 bg-slate-50">
        <button type="button" onClick={() => exec('bold')} className={`${btnCls} font-bold`}>B</button>
        <button type="button" onClick={() => exec('italic')} className={`${btnCls} italic`}>I</button>
        <button type="button" onClick={() => exec('underline')} className={`${btnCls} underline`}>U</button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button type="button" onClick={() => exec('insertUnorderedList')} className={btnCls}>
          ≡ {t('List', '列表')}
        </button>
        <button type="button" onClick={() => exec('insertParagraph')} className={btnCls}>
          ¶
        </button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => {
            const url = window.prompt(t('Enter URL', '输入链接'));
            if (url) exec('createLink', url);
          }}
          className={btnCls}
        >
          🔗
        </button>
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
        className="min-h-[220px] px-5 py-4 text-sm text-slate-700 focus:outline-none"
        style={{ lineHeight: '1.7' }}
        data-placeholder={t('Write your email content here...', '在这里写邮件内容...')}
      />
    </div>
  );
}
```

Add CSS for placeholder to `index.html` or a global CSS file (if you have one). If no global CSS, add as inline style attribute placeholder workaround — the `data-placeholder` approach with a style tag:

In `index.html` or wherever global styles live, add:
```css
[contenteditable]:empty:before {
  content: attr(data-placeholder);
  color: #94a3b8;
  pointer-events: none;
}
```

If you don't have a global CSS injection point, skip the placeholder CSS — the editor works without it, it just won't show placeholder text.

- [ ] **步骤 2：验证编辑器功能**

- 点 **B** → 输入文字 → 文字加粗
- 点 **I** → 文字斜体
- 点 **≡ List** → 插入无序列表
- 预览 modal 里 HTML 正确渲染

- [ ] **步骤 3：Commit**

```bash
git add components/advisor/pages/Broadcast.tsx
git commit -m "feat(broadcast): add contentEditable rich text editor with formatting toolbar"
```

---

### 任务 6：HistoryTab — 发送记录

**文件：**
- 修改：`components/advisor/pages/Broadcast.tsx`

- [ ] **步骤 1：用完整 HistoryTab 替换占位符**

```tsx
function HistoryTab({ t, language }: { t: (en: string, zh: string) => string; language: string }) {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
      if (!adv) return setLoading(false);

      const { data } = await supabase
        .from('broadcasts')
        .select('id, title, status, sent_at, scheduled_at, recipient_count, created_at')
        .eq('advisor_id', adv.id)
        .order('created_at', { ascending: false });
      setBroadcasts(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const STATUS_STYLE: Record<string, string> = {
    sent:      'bg-emerald-50 text-emerald-700',
    scheduled: 'bg-amber-50 text-amber-700',
    draft:     'bg-slate-100 text-slate-500',
  };
  const STATUS_LABEL: Record<string, { en: string; zh: string }> = {
    sent:      { en: 'Sent',      zh: '已发送' },
    scheduled: { en: 'Scheduled', zh: '已排程' },
    draft:     { en: 'Draft',     zh: '草稿' },
  };

  if (loading) return <Loader />;

  if (broadcasts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
        <div className="text-3xl mb-3">📭</div>
        <div className="text-slate-400 text-sm">
          {t('No broadcasts yet. Write your first one!', '还没有群发记录，写第一封吧！')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {broadcasts.map(b => {
        const dateStr = b.status === 'sent' ? b.sent_at : b.status === 'scheduled' ? b.scheduled_at : b.created_at;
        const dateLabel = dateStr
          ? new Date(dateStr).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-MY', {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })
          : '—';
        return (
          <div key={b.id} className="flex items-center gap-4 px-5 py-4 border-b border-slate-50 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-xin-blue truncate">{b.title}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {b.status === 'sent'
                  ? `${t('Sent', '发送')} ${dateLabel} · ${b.recipient_count} ${t('recipients', '人')}`
                  : b.status === 'scheduled'
                  ? `${t('Scheduled for', '排程')} ${dateLabel}`
                  : `${t('Draft', '草稿')} · ${t('Created', '创建于')} ${dateLabel}`}
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md shrink-0 ${STATUS_STYLE[b.status] || STATUS_STYLE.draft}`}>
              {language === 'zh' ? STATUS_LABEL[b.status]?.zh : STATUS_LABEL[b.status]?.en}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" />
    </div>
  );
}
```

- [ ] **步骤 2：验证 History tab**

`npm run dev` → Broadcast 页面 → History tab → 显示"还没有群发记录"。
发送一条后（任务 8 完成后）再验证。

- [ ] **步骤 3：Commit**

```bash
git add components/advisor/pages/Broadcast.tsx
git commit -m "feat(broadcast): implement HistoryTab with broadcast records"
```

---

### 任务 7：Supabase Edge Function — 邮件发送

**文件：**
- 创建：`supabase/functions/send-broadcast/index.ts`

这个 Edge Function 用 Resend API 批量发送邮件，然后更新 `broadcasts` 表的状态。

- [ ] **步骤 1：在 Supabase 设置 Resend API Key**

1. 注册 [resend.com](https://resend.com) → 获取 API Key
2. 在 Supabase Dashboard → Settings → Edge Functions → Add secret：
   - `RESEND_API_KEY` = `re_xxxxx...`
   - `BROADCAST_FROM_EMAIL` = `no-reply@yourdomain.com`（需在 Resend 里验证域名）

- [ ] **步骤 2：创建函数目录和文件**

```bash
mkdir -p supabase/functions/send-broadcast
```

创建 `supabase/functions/send-broadcast/index.ts`：

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('BROADCAST_FROM_EMAIL') ?? 'no-reply@example.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // Verify caller is an authenticated advisor
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return jsonError('Unauthorized', 401)

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const body = await req.json()

    // Mode: process_scheduled — find and send all due scheduled broadcasts
    if (body.mode === 'process_scheduled') {
      const { data: due } = await serviceClient
        .from('broadcasts')
        .select('id')
        .eq('status', 'scheduled')
        .lte('scheduled_at', new Date().toISOString())
      for (const b of (due || [])) {
        await sendBroadcast(b.id, serviceClient)
      }
      return jsonOk({ processed: (due || []).length })
    }

    // Mode: send specific broadcast (caller must own it)
    const { broadcastId } = body
    if (!broadcastId) return jsonError('broadcastId required', 400)

    // Verify ownership
    const { data: adv } = await serviceClient
      .from('advisors')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!adv) return jsonError('Advisor not found', 403)

    const { data: broadcast } = await serviceClient
      .from('broadcasts')
      .select('advisor_id')
      .eq('id', broadcastId)
      .single()
    if (!broadcast || broadcast.advisor_id !== adv.id) return jsonError('Forbidden', 403)

    const result = await sendBroadcast(broadcastId, serviceClient)
    return jsonOk(result)

  } catch (e: any) {
    return jsonError(e.message, 500)
  }
})

async function sendBroadcast(broadcastId: string, db: any) {
  const { data: broadcast } = await db
    .from('broadcasts')
    .select('*')
    .eq('id', broadcastId)
    .single()
  if (!broadcast) throw new Error('Broadcast not found')

  // Get recipients
  let query = db
    .from('clients')
    .select('id, full_name, email')
    .eq('advisor_id', broadcast.advisor_id)
    .eq('status', 'active')
    .not('email', 'is', null)

  const filter = broadcast.recipient_filter?.type ?? 'all'

  if (filter === 'has_insurance') {
    const { data: policyClients } = await db
      .from('insurance_policies')
      .select('client_id')
      .eq('advisor_id', broadcast.advisor_id)
    const ids = [...new Set((policyClients || []).map((r: any) => r.client_id))]
    if (ids.length === 0) {
      await db.from('broadcasts').update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: 0 }).eq('id', broadcastId)
      return { sent: 0 }
    }
    query = query.in('id', ids)
  }

  if (filter === 'has_investment') {
    const { data: allClients } = await db
      .from('clients')
      .select('id')
      .eq('advisor_id', broadcast.advisor_id)
      .eq('status', 'active')
    const allIds = (allClients || []).map((c: any) => c.id)
    const { data: assetClients } = await db
      .from('assets')
      .select('client_id')
      .in('client_id', allIds)
    const ids = [...new Set((assetClients || []).map((r: any) => r.client_id))]
    if (ids.length === 0) {
      await db.from('broadcasts').update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: 0 }).eq('id', broadcastId)
      return { sent: 0 }
    }
    query = query.in('id', ids)
  }

  const { data: recipients } = await query
  if (!recipients || recipients.length === 0) {
    await db.from('broadcasts').update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: 0 }).eq('id', broadcastId)
    return { sent: 0 }
  }

  // Send via Resend batch API (max 100 per batch)
  const BATCH_SIZE = 100
  let sentCount = 0
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE)
    const emails = batch.map((r: any) => ({
      from: FROM_EMAIL,
      to: r.email,
      subject: broadcast.title,
      html: wrapEmailHtml(broadcast.content, r.full_name),
    }))

    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emails),
    })

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`Resend error ${res.status}: ${errBody}`)
    }
    sentCount += batch.length
  }

  await db
    .from('broadcasts')
    .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: sentCount })
    .eq('id', broadcastId)

  return { sent: sentCount }
}

function wrapEmailHtml(content: string, recipientName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-bottom: 2px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 24px;">
    <span style="font-size: 20px; font-weight: 700; color: #1e3a5f;">Xin<span style="color: #c9a227;">Wealth</span></span>
  </div>
  <div style="line-height: 1.7; font-size: 15px;">
    ${content}
  </div>
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
    You are receiving this because you are a XinWealth client. To unsubscribe, please contact your advisor.
  </div>
</body>
</html>`
}

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
```

- [ ] **步骤 3：部署 Edge Function**

方法 A（Supabase CLI）：
```bash
supabase functions deploy send-broadcast
```

方法 B（Supabase MCP 工具）：
```
mcp__supabase__deploy_edge_function({ name: "send-broadcast", files: [{ name: "index.ts", content: "<上面的代码>" }] })
```

- [ ] **步骤 4：设置 Supabase ANON KEY 环境变量**

Edge Function 需要 `SUPABASE_ANON_KEY`（用于验证调用方 JWT）。
在 Supabase Dashboard → Settings → Edge Functions → Secrets，确认存在 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`（自动注入），再加：
- `SUPABASE_ANON_KEY` = （从 Settings → API 复制 anon public key）

- [ ] **步骤 5：Commit**

```bash
git add supabase/functions/
git commit -m "feat(broadcast): add send-broadcast Edge Function with Resend integration"
```

---

### 任务 8：排程发送 — pg_cron 设置

**目标：** 每小时自动处理状态为 `scheduled` 且 `scheduled_at ≤ NOW()` 的广播。

- [ ] **步骤 1：在 Supabase 启用 pg_cron**

Supabase Dashboard → Database → Extensions → 搜 `pg_cron` → Enable。

- [ ] **步骤 2：添加 cron job**

在 Supabase SQL Editor 运行：

```sql
SELECT cron.schedule(
  'process-scheduled-broadcasts',      -- job name（唯一）
  '0 * * * *',                          -- 每小时整点
  $$
    SELECT net.http_post(
      url := (SELECT value FROM vault.secrets WHERE name = 'supabase_url') || '/functions/v1/send-broadcast',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'supabase_service_role_key')
      ),
      body := '{"mode":"process_scheduled"}'::jsonb
    );
  $$
);
```

**备选方案（如果 pg_cron + net.http_post 配置复杂）：**

可以使用 Supabase 的 Scheduled Functions 功能（Dashboard → Edge Functions → New Scheduled Function），设置 cron 表达式 `0 * * * *`，Function 选 `send-broadcast`，Body 填 `{"mode":"process_scheduled"}`。这个方式不需要 pg_cron 也不需要 vault。

- [ ] **步骤 3：测试排程发送**

1. 在 Broadcast Compose 页面设置一个 5 分钟后的排程时间 → Schedule
2. History tab 看到状态 "已排程"
3. 等排程时间到 → cron 触发 → History tab 刷新看到状态变 "已发送"

---

### 任务 9：整体验收测试

- [ ] **步骤 1：Retention 流程验收**

1. 登录 advisor 账号
2. 确认 DB 有 active 客户且 `last_contacted_at` 为 null
3. Dashboard 首页出现 Block C，显示这些客户
4. 进入某客户 ClientDetail → Activity tab → Add Note（随便写内容）→ Save
5. 回到 Dashboard → 刷新 → 该客户从 Block C 消失

- [ ] **步骤 2：Broadcast 立即发送验收**

1. Broadcast 页面 → Compose tab
2. 填写标题（例："五月市场动态"）和内容
3. 选"所有活跃客户"，确认显示收件人数量 > 0
4. 点"立即发送"
5. 页面显示"群发已发送！"
6. History tab 显示刚才这条记录，状态"已发送"
7. 检查 Resend Dashboard 确认邮件已发送

- [ ] **步骤 3：Broadcast 排程发送验收**

1. 设置排程时间（例：当前时间 + 1 小时）
2. 点"排程发送"
3. History tab 状态为"已排程"
4. 等 cron 触发后验证状态变"已发送"

- [ ] **步骤 4：最终 Commit**

```bash
git add -A
git commit -m "feat(retention-broadcast): complete Sprint 5 + 6 implementation"
```

---

## 自检

### 规格覆盖度检查

| 规格需求 | 对应任务 | 状态 |
|---------|---------|------|
| 生日前 3 天提醒 | 任务 2（Block C urgentBirthdays） | ✅ |
| 超过 30 天未联系提醒 | 任务 2（Block C notContacted） | ✅ |
| `last_contacted_at` 字段 | 任务 1（migration） | ✅ |
| 写 client_notes 自动更新 `last_contacted_at` | 任务 1（DB trigger） | ✅ |
| Dashboard Block C 点击进 ClientDetail | 任务 2（Link to） | ✅ |
| Broadcast 写标题 + 富文本内容 | 任务 4（ComposeTab） + 任务 5（RichTextEditor） | ✅ |
| 收件人筛选（全部 / 按产品类型） | 任务 4（filter radio） | ✅ |
| 邮件预览 | 任务 4（preview modal） | ✅ |
| 立即发送 | 任务 4（handleSend） + 任务 7（Edge Function） | ✅ |
| 排程发送 | 任务 4（scheduledAt input） + 任务 8（pg_cron） | ✅ |
| 发送记录（标题、日期、人数） | 任务 6（HistoryTab） | ✅ |
| `broadcasts` 表 | 任务 1（migration） | ✅ |
| 路由 `/advisor/broadcast` | 任务 3 | ✅ |
| 侧边栏导航项 | 任务 3 | ✅ |
| 保单到期提醒不在 Block C 重复 | 任务 2（Block C 不包含保单提醒） | ✅ |

### 注意事项

1. **Resend 域名验证**：`BROADCAST_FROM_EMAIL` 所用的域名必须在 Resend 后台验证（DNS TXT 记录）。测试阶段可用 `onboarding@resend.dev`（仅发给 Resend 账号邮箱）。

2. **`insurance_policies` 表的 `advisor_id` 字段**：Edge Function 的 `has_insurance` 筛选使用 `.eq('advisor_id', adv.id)` 来过滤。如果 `insurance_policies` 表没有 `advisor_id` 字段，改为 inner join via `client_id` 在 `clients` 表过滤：先取所有 clientIds，再 `.in('client_id', clientIds)`（前端 CountRecipients 已用这种方式，Edge Function 也需要对应修改）。

3. **pg_cron + vault**：如果 Supabase 项目没有 vault 扩展，用"Scheduled Functions"方式代替（Dashboard → Edge Functions → Schedule），无需写 SQL。
