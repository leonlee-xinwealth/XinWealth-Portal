# Investment Tab Redesign — Design Spec
Date: 2026-06-09

## Overview

Redesign the Investment tab to support multiple portfolios per client, replace Lark as data source with Supabase, and improve data presentation with a story-driven layout (CAGR, XIRR, FD comparison, monthly timeline).

---

## Scope

1. **Remove all Lark references** — `/api/data` endpoint and all Lark field mappings deleted; all investment data read directly from Supabase.
2. **New Supabase schema** — `portfolios` + `portfolio_history` tables.
3. **Investment tab UI redesign** — Model A (single-page scroll) + Story B layout.
4. **New metrics** — CAGR added alongside existing XIRR (MWR) and TWR.
5. **FD comparison** — Computed client-side at 3% p.a. monthly compounding from `injection_date`.
6. **Multi-currency** — `currency` field per portfolio (SGD / MYR).

---

## Existing Database State

`portfolio_holdings` already exists in Supabase with columns:
`id, account_id, client_id, snapshot_month, instrument_code, instrument_name, units_held, nav_per_unit, market_value, cost_basis, notes, created_at`

`account_id` is a UUID used as a portfolio grouping key, but there is no corresponding metadata table. `api/data.js` already queries Supabase but returns data in a Lark-mimicking field format (`'End Value'`, `'Cashflow'`, `'FD'`).

## New Database Schema

### Table: `portfolios` (NEW)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Must match existing `account_id` values in `portfolio_holdings` |
| `client_id` | UUID FK → `clients.id` | RLS by advisor |
| `name` | TEXT | e.g. "PGWA Quant Global" |
| `currency` | TEXT | "SGD" or "MYR" |
| `capital_injection` | NUMERIC | Initial lump sum |
| `injection_date` | DATE | Month capital first entered |
| `created_at` | TIMESTAMPTZ | `now()` |

### Table: `portfolio_history` (NEW)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `portfolio_id` | UUID FK → `portfolios.id` | Cascade delete |
| `snapshot_date` | DATE | End-of-month date |
| `end_value` | NUMERIC | Total portfolio market value that month |
| `cashflow` | NUMERIC | Additional top-ups this month (default 0) |
| `created_at` | TIMESTAMPTZ | `now()` |

Unique constraint: `(portfolio_id, snapshot_date)`.

`portfolio_holdings` is kept as-is (instrument-level detail, future use). `portfolio_history` is the authoritative monthly rollup that the UI reads.

RLS: advisors see only their clients' records. Clients see only their own.

---

## FD Value Calculation (Client-Side)

Not stored in DB. Computed on every render:

```
monthlyRate = 0.03 / 12  // 3% p.a.
fdValue[0] = capital_injection  // injection_date month
fdValue[n] = fdValue[n-1] × (1 + monthlyRate)
```

For clients with additional cashflows (top-ups), each cashflow is added to the FD base at its month and compounds forward.

---

## Metrics Formulas

| Metric | Formula |
|---|---|
| **CAGR** | `(endValue / capital)^(12 / monthsElapsed) − 1` |
| **XIRR** | Newton-Raphson on cashflow stream (existing `calculateXIRR`) |
| **TWR** | Existing `calculateTWR` — chain-linked period returns |
| **Total Return %** | `(endValue / totalCashflow) − 1` |
| **vs FD (SGD)** | `endValue − fdValue[latest]` |
| **vs FD (%)** | `(endValue − fdValue[latest]) / fdValue[latest] × 100` |

`monthsElapsed` = months between `injection_date` and latest `snapshot_date` (inclusive).

---

## UI Layout — Investment Tab (Model A)

### Section 1 — Overview Banner (always visible)

- Background: dark blue gradient
- Shows: Total Value (all portfolios summed), Overall Return %, vs FD (combined SGD difference), count of active portfolios
- Mini aggregate sparkline (SVG, portfolio total vs combined FD)

### Section 2 — Portfolio Selector Cards (horizontal scroll)

- One card per portfolio
- Card shows: portfolio name, current value, Total Return %, CAGR %
- Selected card: dark blue background with gold text
- Tapping a card updates Section 3

### Section 3 — Portfolio Detail (Story B)

**Info Chips Row**
- Portfolio name, inception date, capital injection amount

**Hero Card**
- Headline: "Your portfolio is outperforming FD by"
- Large number: `SGD +{diff}` (green) or `SGD {diff}` (red)
- Sub-line: FD equivalent value vs actual portfolio value
- Status badge: "Outperforming ▲" or "Underperforming ▼"

**Monthly Timeline**
- One chip per month from injection_date to latest snapshot
- Shows: month label, portfolio end_value (abbreviated), colored diff badge (vs FD that month)
- Latest month chip has gold border highlight
- Scrollable horizontally if > 6 months

**Metrics Grid (2×2)**
- Top row (dark blue cards): CAGR, XIRR
- Bottom row (white cards): TWR, Total Return %

**Performance Chart**
- Portfolio area line (gold) vs FD dashed line (grey)
- Y-axis auto-scaled to data range
- X-axis: month labels
- Tooltip: both values on hover

---

## Files to Change

### Remove / Replace Lark-style field mapping

| File | Change |
|---|---|
| `api/data.js` | Rewrite to return clean JSON from `portfolios` + `portfolio_history`; remove Lark field name mapping |
| `services/apiService.ts` | Remove `fetchPortfolioHistory`, `fetchClientProfile` Lark field parsing; replace with `fetchPortfolios()` and `fetchPortfolioHistory(portfolioId)` using Supabase client directly |

### New / Modified Frontend

| File | Change |
|---|---|
| `components/Investment.tsx` | Full rewrite — Model A layout: Overview banner, portfolio selector cards, story detail |
| `services/apiService.ts` | Add `fetchPortfolios()`, `fetchPortfolioHistory(portfolioId)` returning typed data |
| `types.ts` | Add `Portfolio`, `PortfolioHistory` interfaces; deprecate old `PortfolioDataPoint`, `ClientProfile` |

### New Database Migration

| File | Purpose |
|---|---|
| `supabase/migrations/20260609_portfolios.sql` | Create `portfolios` + `portfolio_history` tables with RLS policies |

---

## Out of Scope

- Admin UI for advisors to enter portfolio data (manual Supabase dashboard entry for now)
- Portfolio creation / editing from client side
- Benchmark comparison other than FD (e.g. MSCI World)
- PDF export of portfolio report

---

## Success Criteria

- Client with 1+ portfolios can switch between them and see accurate metrics
- CAGR, XIRR, TWR, Total Return all display correctly for Chua Khai Chun case data
- FD comparison line on chart matches manual calculation at 3% p.a.
- No Lark API references remain in codebase
- Currency displays as SGD (or MYR per portfolio)
- Page loads without error when portfolio_history has 0 rows (empty state)
