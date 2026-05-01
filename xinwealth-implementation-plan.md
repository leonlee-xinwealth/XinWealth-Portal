# XinWealth Advisor Portal — Implementation Plan
**Version:** 1.0  
**Date:** May 2026  
**Project:** `leonlee-xinwealth/XinWealth-Portal` (GitHub)  
**Stack:** React + Vite + TypeScript, Supabase (PostgreSQL + Auth + RLS), Tailwind CSS (CDN), React Router v6  
**Advisor Portal Path:** `/advisor/*` within the existing XinWealth-Portal monorepo  
**Supabase Project:** `lqnnboepevcivcxvkoct` (ap-southeast-1)

---

## Context — What Has Already Been Built

Before starting, understand the current state. Do **not** rebuild any of the following:

| Feature | Status | Location |
|---|---|---|
| Advisor login / logout (Supabase Auth) | ✅ Done | `components/advisor/AdvisorLogin.tsx` |
| Sidebar navigation with EN/中文 toggle | ✅ Done | `components/advisor/AdvisorLayout.tsx` |
| Client list with search | ✅ Done | `components/advisor/pages/ClientList.tsx` |
| New client form | ✅ Done | `components/advisor/pages/NewClient.tsx` |
| Client detail with 6 tabs | ✅ Done | `components/advisor/pages/ClientDetail.tsx` |
| Profile tab (view + edit all personal fields) | ✅ Done | `components/advisor/tabs/ProfileTab.tsx` |
| Cash Flow tab (income/expense entries) | ✅ Done | `components/advisor/tabs/CashflowTab.tsx` |
| Net Worth tab (assets + liabilities) | ✅ Done | `components/advisor/tabs/NetworthTab.tsx` |
| Insurance tab (policy records) | ✅ Done | `components/advisor/tabs/InsuranceTab.tsx` |
| Activity tab (notes + follow-up with dates) | ✅ Done | `components/advisor/tabs/ActivityTab.tsx` |
| Form Kit tab (PRS, PMF, Life Ins, GI email gen) | ✅ Done | `components/advisor/tabs/FormKitTab.tsx` |
| Smart Dashboard (follow-ups, birthdays, expiring policies) | ✅ Done | `components/advisor/pages/Dashboard.tsx` |
| Advisor settings page | ✅ Done | `components/advisor/pages/Settings.tsx` |
| `client_notes` table with RLS | ✅ Done | Supabase migration |
| Regulatory fields (race, TIN, bank, PEP, source_of_funds) | ✅ Done | Added to `clients` table |

---

## Database Schema Reference

### Key Tables (public schema)

```
advisors          → advisor profiles, rank (AWP/WP/SWP/WPD), upline_id
clients           → client profiles, all personal/financial fields
assets            → client assets (savings, EPF, unit trust, property, etc.)
liabilities       → client liabilities (loans, credit card, etc.)
cashflow_entries  → recurring income/expense entries, linked to cashflow_categories
cashflow_categories → lookup table, already seeded (20 categories, bilingual)
insurance_policies → insurance/takaful policy records
investment_accounts → unit trust / PMF / PRS accounts
investment_transactions → buy/sell/switch transactions
portfolio_holdings → monthly snapshot of holdings per account
portfolio_snapshots → monthly total market value per account
health_snapshots  → computed financial ratios (not yet populated by app)
client_notes      → meeting notes + follow-up dates
user_profiles     → maps auth.users to role (advisor/client) + entity IDs
audit_log         → change history
```

### Supabase Client Usage

All advisor components use:
```typescript
import { supabase } from '../../../lib/supabaseClient';
// VITE_ env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

RLS helper functions already in DB:
- `is_advisor()` — checks user_profiles.role = 'advisor'
- `my_advisor_client_ids()` — returns array of client IDs owned by current advisor
- `my_downline_advisor_ids()` — returns direct downline advisor IDs

---

## Design System

| Token | Value |
|---|---|
| Primary blue | `#0A2540` (`xin-blue`) |
| Gold accent | `#C8A97E` (`xin-gold`) |
| Background | `#F4F7F9` (`xin-bg`) |
| Font sans | Inter |
| Font serif | Playfair Display |
| Border radius cards | `rounded-2xl` |
| Card shadow | `shadow-sm border border-slate-100` |

Language hook pattern used throughout:
```typescript
const { language } = useLanguage(); // from context/LanguageContext
const t = (en: string, zh: string) => language === 'zh' ? zh : en;
```

---

---

# PHASE 1 — Make Data Useful

## Feature 1.1 — Financial Health Score Card

### What it does
A summary card displayed at the top of every client detail page (above the tabs). Computes financial health ratios from existing data and displays a colour-coded score per category.

### Business logic — Ratios to compute

| Ratio | Formula | Healthy | Warning | Critical |
|---|---|---|---|---|
| Savings Rate | `(monthly_surplus / monthly_income) × 100` | ≥ 20% | 10–20% | < 10% |
| Debt Service Ratio (DSR) | `(total_monthly_loan_repayment / monthly_income) × 100` | < 40% | 40–60% | > 60% |
| Emergency Fund | `liquid_assets / monthly_expenses` (months) | ≥ 6 months | 3–6 months | < 3 months |
| Life Insurance Coverage | `total_life_sum_assured / annual_income` (multiplier) | ≥ 10× | 5–10× | < 5× |
| Net Worth Trend | `total_assets - total_liabilities` | Positive | 0 | Negative |

Where:
- `monthly_income` = sum of all cashflow_entries WHERE direction = 'inflow', normalised to monthly
- `monthly_expenses` = sum of all cashflow_entries WHERE direction = 'outflow', normalised to monthly
- `monthly_surplus` = monthly_income - monthly_expenses
- `total_monthly_loan_repayment` = sum of liabilities.monthly_payment WHERE NOT NULL
- `liquid_assets` = sum of assets.current_value WHERE liquidity = 'high'
- `total_life_sum_assured` = sum of insurance_policies.sum_assured WHERE policy_type IN ('life', 'investment_linked')
- `annual_income` = monthly_income × 12

### Normalise cashflow to monthly
```typescript
function toMonthly(amount: number, frequency: string): number {
  const map: Record<string, number> = {
    monthly: 1, quarterly: 1/3, semi_annual: 1/6,
    annual: 1/12, one_off: 0, weekly: 4.33
  };
  return amount * (map[frequency] ?? 1);
}
```

### Save computed ratios to health_snapshots
After computing, upsert into `health_snapshots`:
```sql
INSERT INTO health_snapshots (
  client_id, snapshot_date, net_worth, total_assets, total_liabilities,
  savings_ratio, debt_service_ratio, basic_liquidity_ratio,
  life_insurance_coverage, raw_metrics
) VALUES (...) ON CONFLICT (client_id, snapshot_date) DO UPDATE SET ...;
```
Use `snapshot_date = current month's first day` (e.g., `2026-05-01`).

### UI Component
**File:** `components/advisor/components/HealthScoreCard.tsx`

```
┌─────────────────────────────────────────────────────────┐
│  Financial Health Overview                    [Refresh] │
├──────────┬──────────┬──────────┬──────────┬────────────┤
│ Savings  │   DSR    │Emergency │  Life    │  Net Worth │
│  Rate    │          │  Fund    │Insurance │            │
│          │          │          │Coverage  │            │
│  🟡 12%  │ 🟢 35%  │ 🔴 2mo  │ 🔴 3×   │RM 120,000  │
│ (Low)    │(Healthy) │(Critical)│(Low)     │ (Positive) │
└──────────┴──────────┴──────────┴──────────┴────────────┘
  ℹ️  Data as of May 2026 · Based on entries in Cash Flow, Assets & Insurance tabs
```

Colour coding:
- 🟢 Green = healthy
- 🟡 Amber = warning
- 🔴 Red = critical
- ⚫ Grey = insufficient data (less than 1 cashflow entry)

**Usage in ClientDetail.tsx:**
```tsx
// Insert above the tab row
<HealthScoreCard clientId={client.id} />
<div className="flex gap-1 bg-slate-100 p-1 ..."> {/* tab row */}
```

### Data fetching
Single component, loads its own data:
```typescript
const [assets, liabilities, cashflow, policies] = await Promise.all([
  supabase.from('assets').select('current_value, liquidity').eq('client_id', clientId),
  supabase.from('liabilities').select('outstanding_balance, monthly_payment').eq('client_id', clientId),
  supabase.from('cashflow_entries').select('amount, frequency, direction').eq('client_id', clientId),
  supabase.from('insurance_policies').select('sum_assured, policy_type').eq('client_id', clientId),
]);
```

---

## Feature 1.2 — Insurance Gap Analysis

### What it does
A new section at the top of the Insurance tab showing recommended coverage vs actual coverage, with a clear gap amount.

### Business logic

**Life Insurance**
- Recommended = `annual_income × 10`
- Source of annual_income: sum of inflow cashflow_entries normalised × 12
- Actual = sum of insurance_policies.sum_assured WHERE policy_type IN ('life', 'investment_linked')
- Gap = MAX(0, Recommended - Actual)

**Medical / Hospitalisation**
- Binary check: does client have ANY active policy with policy_type = 'medical'?
- If no → show "No medical card"

**Critical Illness**
- Recommended = `annual_income × 4` (standard industry practice)
- Actual = sum of sum_assured WHERE policy_type = 'critical_illness'
- Gap = MAX(0, Recommended - Actual)

### UI Component
**File:** `components/advisor/components/InsuranceGapPanel.tsx`
Insert at the **top** of `InsuranceTab.tsx`, above the policy cards grid.

```
┌─────────────────────────────────────────────────────────────┐
│  Coverage Analysis                                          │
├──────────────────┬────────────────┬──────────┬────────────┤
│                  │   Recommended  │  Actual  │    Gap     │
├──────────────────┼────────────────┼──────────┼────────────┤
│ Life Insurance   │ RM 960,000     │RM 200,000│RM 760,000 🔴│
│ Critical Illness │ RM 384,000     │RM 0      │RM 384,000 🔴│
│ Medical Card     │ Required       │ None     │ Missing   🔴│
└──────────────────┴────────────────┴──────────┴────────────┘
  * Based on annual income of RM 96,000 from Cash Flow tab
  * Life insurance: 10× annual income recommended
  * Critical illness: 4× annual income recommended
```

If cashflow data is insufficient (no income entries):
```
ℹ️  Add income entries in Cash Flow tab to compute recommended coverage.
```

---

## Feature 1.3 — Dashboard: Incomplete Profiles Panel

### What it does
A 4th action card on the Dashboard showing clients with missing critical data, so the advisor knows who needs to be followed up for data collection.

### What counts as "incomplete"
A client profile is considered incomplete if ANY of these are missing:
- `date_of_birth`
- `phone`
- `nric`
- `risk_profile`
- No cashflow entries at all (no income recorded)
- No assets at all
- No insurance policies at all

### Implementation
**File:** `components/advisor/pages/Dashboard.tsx`

Add a 4th query in the `useEffect`:
```typescript
// Check completeness: clients missing key data
const { data: allClients } = await supabase
  .from('clients')
  .select('id, full_name, date_of_birth, phone, nric, risk_profile')
  .eq('advisor_id', adv.id);

// For cashflow/assets/insurance counts, query aggregates or just check existence
const incompleteClients = allClients.filter(c =>
  !c.date_of_birth || !c.phone || !c.nric || !c.risk_profile
);
```

For checking missing financial data, use a Supabase RPC or query each table:
```typescript
// Alternatively: use a database function (see DB section below)
```

### Optional: Create a DB function for completeness
```sql
CREATE OR REPLACE FUNCTION public.client_completeness(p_client_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'has_dob',        (SELECT date_of_birth IS NOT NULL FROM clients WHERE id = p_client_id),
    'has_nric',       (SELECT nric IS NOT NULL FROM clients WHERE id = p_client_id),
    'has_phone',      (SELECT phone IS NOT NULL FROM clients WHERE id = p_client_id),
    'has_risk',       (SELECT risk_profile IS NOT NULL FROM clients WHERE id = p_client_id),
    'has_cashflow',   (SELECT EXISTS(SELECT 1 FROM cashflow_entries WHERE client_id = p_client_id)),
    'has_assets',     (SELECT EXISTS(SELECT 1 FROM assets WHERE client_id = p_client_id)),
    'has_insurance',  (SELECT EXISTS(SELECT 1 FROM insurance_policies WHERE client_id = p_client_id))
  );
$$;
```

### UI: 4th Dashboard card
Add after the 3 existing action cards (follow-ups, birthdays, expiring policies):
```
┌─────────────────────────────────┐
│ ⚠️  Incomplete Profiles  (8)    │
├─────────────────────────────────┤
│ 👤 Tan Ah Kow   Missing: DOB, IC│
│ 👤 Lee Mei Ling Missing: IC     │
│ 👤 Ahmad Bin... No insurance    │
│ + 5 more                        │
└─────────────────────────────────┘
```

Each row links to `/advisor/clients/:id` and opens on the relevant tab (profile or insurance).

---

---

# PHASE 2 — CRM Features

## Feature 2.1 — Notes & Follow-up (Already Built)

**Status: ✅ Fully implemented.** See `ActivityTab.tsx`. No further work needed.

Summary of what's built:
- 5 note types: Meeting, Call, Email, Task, Reminder
- Optional follow-up date per note
- Mark follow-up as done (with line-through)
- Dashboard shows all pending follow-ups due within 7 days
- Red badge on Activity tab when there are pending items
- Overdue items shown in red

---

## Feature 2.2 — Investment Portfolio Tab

### What it does
A new tab in the client detail page showing the client's Unit Trust / Private Mandate holdings. Advisor can add accounts and holdings, and record transactions.

### Tab placement
Add `portfolio` tab to the tab list in `ClientDetail.tsx`:
```tsx
{ key: 'portfolio', en: 'Portfolio', zh: '投资组合', icon: '📊' }
```

### Database tables (already exist, no migration needed)
```
investment_accounts    → account per platform (unit_trust, private_mandate, prs, etc.)
portfolio_holdings     → monthly holdings snapshot (instrument, units, NAV, market value)
investment_transactions → buy/sell/switch records
investment_tx_categories → lookup (22 categories, bilingual, already seeded)
```

### New file: `components/advisor/tabs/PortfolioTab.tsx`

#### Section 1 — Account List
Display all investment accounts for the client. Each account shows:
- Account name, platform, account type, account number
- Latest total market value (from most recent portfolio_holdings group by snapshot_month)
- Status badge (active/closed)
- Expandable to show holdings detail

#### Section 2 — Add Account
Modal with fields:
```
account_type: [unit_trust | private_mandate | prs | wrap_account | other]
account_name: text (e.g., "Phillip Capital - Cash Account")
platform: text (e.g., "Phillip Invest", "iFAST")
account_number: text
opened_date: date
currency: default MYR
notes: text
```

#### Section 3 — Holdings (per account, expandable)
After selecting an account, show its most recent holdings:
```
┌────────────────────────────────────────────────────────┐
│ Phillip Capital - Cash Account              RM 45,230  │
│ Last updated: Apr 2026                                  │
├──────────────────────┬────────┬──────────┬────────────┤
│ Fund Name            │ Units  │  NAV     │   Value    │
├──────────────────────┼────────┼──────────┼────────────┤
│ PMB Dana Al-Aiman    │ 12,500 │ RM 1.234 │ RM 15,425  │
│ Phillip Money Market │  8,200 │ RM 1.002 │ RM  8,216  │
│ Kenanga Growth       │  5,100 │ RM 4.195 │ RM 21,395  │
└──────────────────────┴────────┴──────────┴────────────┘
```

#### Section 4 — Add Holdings Snapshot
Monthly data entry. Modal fields:
```
snapshot_month: month picker (default: current month)
instrument_code: text
instrument_name: text
units_held: number
nav_per_unit: number
market_value: auto-computed (units × NAV) or manual override
cost_basis: number (optional)
```

#### Section 5 — Transaction Log (optional, Phase 2.5)
If time allows, a scrollable log of investment_transactions per account. Otherwise defer.

### Portfolio Summary Card
At the top of PortfolioTab, show total portfolio value across all accounts:
```
Total Portfolio Value: RM 125,400
Accounts: 3 active
As of: Apr 2026
```

### Data queries
```typescript
// Get all accounts
const { data: accounts } = await supabase
  .from('investment_accounts')
  .select('*')
  .eq('client_id', clientId)
  .eq('status', 'active')
  .order('account_name');

// Get latest holdings per account
const { data: holdings } = await supabase
  .from('portfolio_holdings')
  .select('*')
  .eq('client_id', clientId)
  .order('snapshot_month', { ascending: false });
```

---

---

# PHASE 3 — Automation

## Feature 3.1 — AI Financial Summary

### What it does
A button on the client detail page labelled "Generate AI Summary". When clicked, it calls the Anthropic Claude API and returns a plain-English/Chinese financial summary of the client's situation, including:
- Key financial health observations
- Identified needs / gaps
- Suggested next steps / talking points for the advisor

### Implementation approach

**Using Claude API in the frontend** (same pattern as other Claude-in-Artifact features in this project):

```typescript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: buildPrompt(client, cashflow, assets, liabilities, policies, language)
    }]
  })
});
```

**Prompt builder function:**
```typescript
function buildPrompt(client: any, cashflow: any[], assets: any[], liabilities: any[], policies: any[], lang: string): string {
  const monthlyIncome = cashflow.filter(e => e.direction === 'inflow').reduce(...);
  const monthlyExpenses = cashflow.filter(e => e.direction === 'outflow').reduce(...);
  // ... compute all ratios

  return `You are a financial advisor assistant for a Malaysia-based wealth planner.
Analyse this client's financial data and provide a concise summary in ${lang === 'zh' ? 'Chinese' : 'English'}.

CLIENT PROFILE:
- Age: ${age}, ${client.marital_status}, ${client.number_of_dependants} dependants
- Occupation: ${client.occupation || 'Unknown'}
- Risk Profile: ${client.risk_profile || 'Not assessed'}

FINANCIAL SNAPSHOT:
- Monthly Income: RM ${monthlyIncome.toFixed(0)}
- Monthly Expenses: RM ${monthlyExpenses.toFixed(0)}
- Monthly Surplus: RM ${(monthlyIncome - monthlyExpenses).toFixed(0)}
- Savings Rate: ${savingsRate}%
- Total Assets: RM ${totalAssets.toFixed(0)}
- Total Liabilities: RM ${totalLiabilities.toFixed(0)}
- Net Worth: RM ${netWorth.toFixed(0)}
- DSR: ${dsr}%
- Emergency Fund: ${emergencyMonths} months
- Life Insurance Coverage: ${lifeCoverage}× income
- Critical Illness Coverage: RM ${ciCoverage}
- Has Medical Card: ${hasMedical ? 'Yes' : 'No'}

RESPONSE FORMAT:
1. Key Observations (2-3 bullet points)
2. Identified Gaps / Concerns (bullet points)
3. Recommended Talking Points for Advisor (2-3 action items)

Keep response concise and professional. Avoid generic advice.`;
}
```

### UI placement
**File:** `components/advisor/pages/ClientDetail.tsx`

Add a button in the client header area (next to the name):
```tsx
<button onClick={generateSummary} className="...">
  ✨ {t('AI Summary', 'AI 分析')}
</button>
```

Show result in a slide-over panel or modal. Include:
- Loading state with spinner
- The AI-generated text
- "Copy" button
- "Save as Note" button (saves to client_notes with note_type = 'task')

### Error handling
If API returns error, show: "Unable to generate summary. Please check that all financial data has been entered."

---

## Feature 3.2 — Report PDF Export

### What it does
A "Export Report" button on the client detail page. Generates a PDF summary of the client's financial position for sharing or filing.

### Recommended library
Use **`@react-pdf/renderer`** — works client-side in React/Vite without a backend.

```bash
npm install @react-pdf/renderer
```

### Report sections
1. **Cover Page** — Client name, advisor name, date, XinWealth branding
2. **Personal Particulars** — Name, IC, DOB, contact, employment
3. **Financial Health Summary** — The 5 health ratios as a table
4. **Cash Flow Summary** — Total income, total expenses, surplus, top 5 categories
5. **Net Worth Summary** — Total assets breakdown (liquid/non-liquid), total liabilities, net worth
6. **Insurance Summary** — Table of all policies + gap analysis
7. **Portfolio Summary** *(if Phase 2.2 is complete)* — Total portfolio value, account list
8. **Disclaimer** — Standard compliance disclaimer

### File structure
```
components/advisor/pdf/
├── ClientReport.tsx         → main PDF document using @react-pdf/renderer
├── sections/
│   ├── CoverPage.tsx
│   ├── PersonalSection.tsx
│   ├── HealthSection.tsx
│   ├── CashflowSection.tsx
│   ├── NetWorthSection.tsx
│   ├── InsuranceSection.tsx
│   └── DisclaimerSection.tsx
└── reportUtils.ts           → data aggregation helpers
```

### Trigger point
Add "Export PDF" button to `ClientDetail.tsx` header area:
```tsx
import { pdf } from '@react-pdf/renderer';
import { ClientReport } from '../pdf/ClientReport';

async function handleExport() {
  const blob = await pdf(<ClientReport client={client} data={reportData} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${client.full_name} - Financial Summary - ${new Date().toISOString().slice(0,10)}.pdf`;
  a.click();
}
```

### Branding
Use the existing XinWealth colour palette:
- Primary: `#0A2540`
- Gold: `#C8A97E`
- Background: `#F4F7F9`

---

---

# Implementation Order Recommendation

Execute features in this order to maximise value at each step:

```
Week 1:
  [1.3] Dashboard — Incomplete Profiles Panel   (1–2 days, quick win)
  [1.1] Financial Health Score Card             (2–3 days)

Week 2:
  [1.2] Insurance Gap Analysis                  (1–2 days, depends on 1.1 data)
  [2.2] Portfolio Tab                           (3–4 days)

Week 3:
  [3.1] AI Financial Summary                    (1–2 days)
  [3.2] PDF Export                              (3–5 days, most complex)
```

---

# Testing Checklist

For each feature, verify:

- [ ] Works with client that has **no data** (empty cashflow, no assets, no insurance)
- [ ] Works with client that has **partial data** (some but not all)
- [ ] Works with client that has **complete data**
- [ ] Language toggle (EN ↔ 中文) works correctly for all new text
- [ ] Mobile responsive (test at 375px width)
- [ ] RLS: Advisor can only see their own clients' data
- [ ] Loading states visible during data fetch
- [ ] Error states handled gracefully

---

# Deployment Notes

**GitHub repo:** `leonlee-xinwealth/XinWealth-Portal`  
**Branch strategy:** Work on `main` directly (single developer) or use feature branches  
**Auto-deploy:** Vercel is connected to GitHub — push to `main` triggers deployment automatically  
**Environment variables (Vercel):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — already configured  
**Local dev:** `npm run dev` in `D:\XinWealth Portal App\XinWealth-Portal`

For database changes, use Supabase migrations:
```bash
# Via Supabase MCP (already connected) or Supabase Dashboard SQL editor
# Always test migrations on the project: lqnnboepevcivcxvkoct
```

---

# Questions for Advisor Before Starting Phase 3

Before building the AI summary and PDF export, clarify:

1. **PDF language:** Should the report be English only, Chinese only, or follow the current language toggle?
2. **PDF branding:** Is there a XinWealth logo file available? (PNG or SVG)
3. **AI Summary:** Should it be saved automatically as a note, or only on manual "Save" click?
4. **Compliance disclaimer:** Is there a standard disclaimer text that must appear on all reports?
5. **Portfolio data source:** Is portfolio data entered manually by the advisor, or will there be future API integration with Phillip Invest / FAME?
