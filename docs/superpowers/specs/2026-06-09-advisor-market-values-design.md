# Advisor Market Values Page — Design Spec
Date: 2026-06-09

## Overview

Add a dedicated **Market Values** page to the Advisor Portal that lets advisors:
1. Record monthly portfolio market values for each client (into `portfolio_history`)
2. Record additional capital injections (top-ups)
3. Create new portfolios for clients (into `portfolios`)

Data entered here is immediately reflected in the Client Portal's Investment tab.

---

## Scope

- New sidebar nav item: **Market Values** (`/advisor/market-values`)
- New page component: `MarketValuesPage`
- Modal: **Record Monthly Value** (upsert into `portfolio_history`)
- Modal: **New Portfolio** (insert into `portfolios`)
- No changes to Client Portal code — it already reads from `portfolios` + `portfolio_history`

Out of scope:
- Deleting portfolios or history records
- Bulk CSV import (future)
- Portfolio editing (name/currency/capital changes)

---

## Database (already exists)

### `portfolios`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `client_id` | UUID FK → `clients.id` | |
| `name` | TEXT | e.g. "PGWA Quant Global" |
| `currency` | TEXT | "SGD" \| "MYR" \| "USD" |
| `capital_injection` | NUMERIC | Initial lump sum |
| `injection_date` | DATE | Month capital first entered |

### `portfolio_history`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `portfolio_id` | UUID FK → `portfolios.id` | |
| `snapshot_date` | DATE | End-of-month date (unique per portfolio) |
| `end_value` | NUMERIC | Total market value that month |
| `cashflow` | NUMERIC | Additional top-up this month (default 0) |

Unique constraint: `(portfolio_id, snapshot_date)` — safe to UPSERT on conflict.

---

## Page Layout — Three-Column

```
┌─────────────┬──────────────────┬────────────────────────────────────────┐
│  Advisor    │  Client List     │  Portfolio List (selected client)       │
│  Sidebar    │                  │                                          │
│             │  Chua Khai Chun  │  [+ New Portfolio]                      │
│  Dashboard  │  Lee Wei Ming    │                                          │
│  Clients    │  Tan Shu Fen     │  ● PGWA Quant Global   16,435  May ✓    │
│  Pipeline   │  Wong Jun Hao    │  ◐ Global Equity Fund  10,421  Apr ⚠    │
│ ▶ Market V  │  ...             │                                          │
│  Broadcast  │                  │                                          │
│  Settings   │                  │                                          │
└─────────────┴──────────────────┴────────────────────────────────────────┘
```

- **Column 1 — Sidebar**: existing advisor nav, new item `📊 Market Values`
- **Column 2 — Client List**: all clients belonging to advisor, sorted by name. Click to select.
- **Column 3 — Portfolio Panel**: portfolios for selected client. Each row shows name, latest market value, last updated month, and status indicator.

### Portfolio Row Status Indicators
| Colour | Meaning |
|---|---|
| 🟢 Green dot | Last `snapshot_date` is last month or newer (e.g. on June 9, last record ≥ May 31 = green) |
| 🟡 Amber dot | Last `snapshot_date` is 2+ months ago (e.g. on June 9, last record ≤ Apr 30 = amber) |

Logic: compare `last_date` to `startOfMonth(today - 1 month)`. If `last_date ≥` that threshold → green, else → amber.

---

## Modal 1 — Record Monthly Value

Triggered by: clicking **「录入市值」** button on any portfolio row.

### Fields
| Field | Type | Required | Notes |
|---|---|---|---|
| Portfolio | Display only | — | Pre-filled, read-only (name + currency) |
| Last recorded | Display only | — | Shows last snapshot date + value as reference |
| 月份 (Month) | `<input type="month">` | Yes | Defaults to next month after last record |
| 市值 (Market Value) | Number | Yes | End-of-month total portfolio value |
| 追加注资 (Top-up) | Number | No | Additional capital injected this month; defaults to 0 if left blank |

### Behaviour
- On **Save**: UPSERT into `portfolio_history` on `(portfolio_id, snapshot_date)`.
  - `snapshot_date` = last day of the selected month (e.g. `2026-06-30`)
  - `cashflow` = top-up value (0 if blank)
  - `end_value` = market value
- On **conflict** (same portfolio + month already exists): overwrite with new values (UPDATE).
- On success: close modal, refresh portfolio row to show updated last-recorded date.

---

## Modal 2 — New Portfolio

Triggered by: clicking **「+ New Portfolio」** button in the portfolio panel header.

### Fields
| Field | Type | Required | Notes |
|---|---|---|---|
| Client | Display only | — | Pre-filled from selected client, read-only |
| Portfolio Name | Text | Yes | e.g. "PGWA Quant Global" |
| Currency | Select | Yes | Options: SGD, MYR, USD. Default: SGD |
| 起始注资 (Capital) | Number | Yes | Initial lump sum amount |
| 注资日期 (Start Month) | `<input type="month">` | Yes | Month capital was first injected |

### Behaviour
- On **Save**: INSERT into `portfolios` with `client_id` = selected client's id.
  - `injection_date` = first day of selected month (e.g. `2026-01-01`)
  - Also INSERT the first `portfolio_history` row: `snapshot_date` = last day of that month, `end_value` = capital_injection, `cashflow` = capital_injection
- On success: close modal, new portfolio row appears in panel.

---

## Editing Historical Records

Portfolio rows are **expandable**. Clicking a portfolio row toggles a history sub-table showing all recorded months.

### Expanded Row Layout
```
▼ PGWA Quant Global   16,435.08   May ✓   [+ 录入]
  ┌────────────────────────────────────────────────┐
  │ 月份      市值 (SGD)   追加      │
  │ May 2026  16,435.08    —        ✏️ │
  │ Apr 2026  15,717.03    —        ✏️ │
  │ Mar 2026  14,990.66    —        ✏️ │
  │ Feb 2026  16,243.19    —        ✏️ │
  └────────────────────────────────────────────────┘
```

- Clicking ✏️ opens the **same Record Monthly Value modal**, pre-filled with that month's existing `end_value` and `cashflow`.
- The modal header changes to "修改市值 — May 2026" to make it clear this is an edit, not a new entry.
- On save: UPSERT (same logic — overwrites the existing row for that `portfolio_id` + `snapshot_date`).
- Only one portfolio row is expanded at a time (clicking another collapses the current).

---

## Data Access

The page is in the Advisor Portal and uses the existing `supabase` client (advisor session).

### Queries needed

**Load clients for advisor:**
```sql
SELECT id, full_name, email
FROM clients
WHERE advisor_id = <advisor_id>
ORDER BY full_name;
```

**Load portfolios for selected client (with latest snapshot + full history for expansion):**
```sql
SELECT p.id, p.name, p.currency, p.capital_injection, p.injection_date,
       h.snapshot_date AS last_date,
       h.end_value     AS last_value
FROM portfolios p
LEFT JOIN LATERAL (
  SELECT snapshot_date, end_value
  FROM portfolio_history
  WHERE portfolio_id = p.id
  ORDER BY snapshot_date DESC
  LIMIT 1
) h ON true
WHERE p.client_id = <client_id>
ORDER BY p.injection_date;
```

**UPSERT monthly value:**
```sql
INSERT INTO portfolio_history (portfolio_id, snapshot_date, end_value, cashflow)
VALUES (<portfolio_id>, <last_day_of_month>, <end_value>, <cashflow>)
ON CONFLICT (portfolio_id, snapshot_date)
DO UPDATE SET end_value = EXCLUDED.end_value, cashflow = EXCLUDED.cashflow;
```

**Insert new portfolio + first history row:**
Two sequential inserts — first `portfolios`, then `portfolio_history` using returned id.

---

## File Plan

| Action | File | Notes |
|---|---|---|
| New page | `components/advisor/pages/MarketValues.tsx` | Three-column layout; contains inline modal components (small, single-use) |
| Modify | `components/advisor/AdvisorApp.tsx` | Add route `/advisor/market-values` |
| Modify | `components/advisor/AdvisorLayout.tsx` | Add sidebar nav item |

No backend API changes needed — page talks to Supabase directly (same pattern as other advisor tabs).

---

**Load full history for expanded portfolio:**
```sql
SELECT snapshot_date, end_value, cashflow
FROM portfolio_history
WHERE portfolio_id = <portfolio_id>
ORDER BY snapshot_date DESC;
```
Loaded on demand when advisor expands a portfolio row (not on page load).

---

## Success Criteria

- Advisor can select any client and see all their portfolios with last-updated status
- Advisor can record a monthly market value (with optional top-up) — data immediately visible in Client Portal Investment tab
- Advisor can create a new portfolio — appears in both Advisor Portal and Client Portal
- UPSERT is safe: recording the same month twice overwrites without error
- Amber warning dot correctly highlights portfolios not updated for the current month
- Expanding a portfolio row loads and shows all historical months with ✏️ edit buttons
- Clicking ✏️ opens the modal pre-filled with the existing values; saving overwrites correctly
