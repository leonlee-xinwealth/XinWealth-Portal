# Advisor Portal — Dashboard & Prospect Fixes

**Date:** 2026-05-20
**Scope:** 5 targeted fixes to advisor dashboard, client list filtering, and prospect conversion

---

## Background

Code review identified these gaps in the advisor portal:
- Prospect status has no actionable workflow (just a count)
- Dashboard stats cards are unclickable dead ends
- ClientList has no way to filter by status
- Language switch does not update incomplete-profile reasons (stale closure bug)
- `advisor.display_name` is accessed without null guard

---

## Changes

### 1. ClientList — Status Filter Tabs

**File:** `components/advisor/pages/ClientList.tsx`

Add a row of tab pills between the heading and the search box:

```
[ 全部 (12) ]  [ 活跃 (8) ]  [ 潜在 (3) ]  [ 非活跃 (1) ]
```

- Tabs read/write URL search param `?status=` via `useSearchParams`
- Counts are derived from the already-fetched `clients` array (no extra query)
- Active tab: `bg-xin-blue text-white`; inactive: `bg-slate-100 text-slate-500`
- Default: "全部" (no status param)
- Filtering is client-side (list is already loaded)

### 2. Dashboard Stats Cards — Clickable Links

**File:** `components/advisor/pages/Dashboard.tsx`

Wrap each stats card in a `<Link>` to `/advisor/clients?status=<value>`:

| Card | Link target |
|------|-------------|
| Total Clients | `/advisor/clients` |
| Active | `/advisor/clients?status=active` |
| Prospects | `/advisor/clients?status=prospect` |

Add `hover:shadow-md transition-shadow cursor-pointer` + a small `ChevronRight` icon (size 12, slate-300) in the bottom-right of each card.

### 3. ClientDetail Header — Convert to Active Button

**File:** `components/advisor/pages/ClientDetail.tsx`

When `client.status === 'prospect'`, render a green button in the header card next to the status badge:

```
[ 潜在客户 ]  [ ✓ 转为正式客户 ]
```

- Button style: `bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-700`
- On click: call `supabase.from('clients').update({ status: 'active' }).eq('id', client.id)`, then reload client
- Show a brief loading state on the button while saving
- After conversion: badge changes to green "活跃", button disappears

### 4. Dashboard useEffect — Language Bug Fix

**File:** `components/advisor/pages/Dashboard.tsx`

**Problem:** `calcMissing` uses `language` from closure, but `useEffect` deps is `[]`, so missing-reason labels stay in the language at mount time.

**Fix:**
- Remove the inner `miss` helper from inside `useEffect`
- Pass the outer `t` function (which already reads live `language`) into the missing-reasons logic, or move `calcMissing` outside the effect and memoize with `useCallback([language])`
- Add `language` to the `useEffect` dependency array

### 5. Dashboard Null Safety

**File:** `components/advisor/pages/Dashboard.tsx` line ~136

Change:
```tsx
advisor.display_name.split(' ')[0]
```
To:
```tsx
advisor.display_name?.split(' ')[0] ?? ''
```

---

## Data Flow

```
URL ?status=active
      ↓
ClientList tabs read param → filter clients array → render filtered rows
      ↑
Dashboard stats cards → Link → ClientList with param
```

No new Supabase queries needed. All filtering is client-side on the already-fetched `clients` array.

---

## What is NOT in scope

- Prospect pipeline stages (e.g. "contacted → qualified → converted")
- Bulk status changes
- Email/notification on conversion
- Global follow-ups page (separate feature)
