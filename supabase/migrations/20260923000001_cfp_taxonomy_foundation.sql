-- CFP data framework P1 — additive only.
-- Spec: docs/superpowers/specs/2026-09-22-cfp-financial-data-framework-design.md
--
-- Safe against the code that is live today: nothing here renames or removes
-- anything a deployed reader depends on. New enum values cannot be used in the
-- transaction that adds them, so the data remap is a separate migration
-- (20260923000003_legacy_taxonomy_remap.sql).

-- 1. New asset kinds. Existing spellings (epf_account_1..3, bond, business,
--    other, property) stay: renaming an enum value breaks every reader at once.
alter type public.asset_type add value if not exists 'cash_on_hand';
alter type public.asset_type add value if not exists 'ewallet';
alter type public.asset_type add value if not exists 'foreign_currency';
alter type public.asset_type add value if not exists 'prs';
alter type public.asset_type add value if not exists 'reit';
alter type public.asset_type add value if not exists 'asnb';
alter type public.asset_type add value if not exists 'tabung_haji';
alter type public.asset_type add value if not exists 'gold';
alter type public.asset_type add value if not exists 'crypto';
alter type public.asset_type add value if not exists 'forex';
alter type public.asset_type add value if not exists 'investment_property';
alter type public.asset_type add value if not exists 'land';
alter type public.asset_type add value if not exists 'receivable';
alter type public.asset_type add value if not exists 'sspn';
alter type public.asset_type add value if not exists 'own_residence';
alter type public.asset_type add value if not exists 'jewelry';
alter type public.asset_type add value if not exists 'collectibles';
alter type public.asset_type add value if not exists 'personal_asset_other';

-- 2. New liability kinds.
alter type public.liability_type add value if not exists 'bnpl';
alter type public.liability_type add value if not exists 'overdraft';
alter type public.liability_type add value if not exists 'tax_payable';
alter type public.liability_type add value if not exists 'family_loan';
alter type public.liability_type add value if not exists 'asb_financing';
alter type public.liability_type add value if not exists 'share_margin';
alter type public.liability_type add value if not exists 'policy_loan';

-- 3. assets: why it is held, how much of it is the client's, and the
--    advisor's triage flag for rows the remap could not place.
alter table public.assets
  add column if not exists purpose text
    check (purpose is null or purpose in ('personal_use', 'income_producing', 'investment')),
  add column if not exists ownership_pct numeric(5, 2) not null default 100
    check (ownership_pct > 0 and ownership_pct <= 100),
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text;

-- 4. clients: whether salary carries statutory EPF (D2). null = not yet confirmed.
alter table public.clients
  add column if not exists has_epf boolean;

-- 5. cashflow_entries: the same triage flag.
alter table public.cashflow_entries
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text;

-- 6. cashflow_categories: the chart-of-accounts attributes (spec §3.0).
alter table public.cashflow_categories
  add column if not exists category_group text,
  add column if not exists wealth_effect text
    check (wealth_effect is null or wealth_effect in ('income', 'expense', 'transfer', 'split')),
  add column if not exists recurrence text
    check (recurrence is null or recurrence in ('recurring', 'irregular', 'one_off')),
  add column if not exists fixed_variable text
    check (fixed_variable is null or fixed_variable in ('fixed', 'variable')),
  add column if not exists need_want text
    check (need_want is null or need_want in ('need', 'want')),
  add column if not exists link_to text
    check (link_to is null or link_to in ('asset', 'liability', 'policy', 'none')),
  add column if not exists auto_generated boolean not null default false,
  add column if not exists is_active boolean not null default true;

-- 7. The advisor's "待分类" queue is read per client.
create index if not exists cashflow_entries_needs_review_idx
  on public.cashflow_entries (client_id) where needs_review;
create index if not exists assets_needs_review_idx
  on public.assets (client_id) where needs_review;
