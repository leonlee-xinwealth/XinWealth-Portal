-- REFERENCE SNAPSHOT of the live core tables — NOT a migration, never applied.
-- Generated 2026-09-23 from the production catalog (query: docs/superpowers/plans/
-- 2026-09-23-cfp-p1-data-foundation.md, Task 12), after migrations
-- 20260923000001/000002. The repo's migration chain does not create these
-- tables; this file is what they actually look like.
-- Regenerate with the same query after any schema change to them.
--
-- Note: `public.cashflow_category` (enum) is a leftover — cashflow_entries.category
-- is text with a foreign key into cashflow_categories(code).

-- ─────────────────────────────────────────────────────────────── enum types

create type public.advisor_rank as enum ('AWP', 'WP', 'SWP', 'WPD');

create type public.advisor_status as enum ('active', 'inactive', 'suspended');

create type public.asset_type as enum ('savings', 'fixed_deposit', 'money_market', 'epf_account_1', 'epf_account_2', 'epf_account_3', 'unit_trust', 'stock', 'bond', 'etf', 'property', 'vehicle', 'business', 'other', 'cash_on_hand', 'ewallet', 'foreign_currency', 'prs', 'reit', 'asnb', 'tabung_haji', 'gold', 'crypto', 'forex', 'investment_property', 'land', 'receivable', 'sspn', 'own_residence', 'jewelry', 'collectibles', 'personal_asset_other');

create type public.audit_action as enum ('insert', 'update', 'delete', 'view_sensitive_field');

create type public.case_lost_reason as enum ('price', 'no_need', 'switched_competitor', 'lost_contact', 'other');

create type public.case_status as enum ('open', 'completed', 'cancelled', 'lost');

create type public.case_type as enum ('car_insurance');

create type public.cashflow_category as enum ('salary', 'bonus', 'director_fee', 'commission', 'rental_income', 'dividend', 'investment_return', 'other_income', 'household', 'transportation', 'dependants', 'personal', 'insurance_premium', 'loan_repayment', 'investment_contribution', 'tax', 'miscellaneous', 'other_expense');

create type public.cashflow_direction as enum ('inflow', 'outflow');

create type public.cashflow_frequency as enum ('one_off', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual');

create type public.client_status as enum ('prospect', 'active', 'inactive');

create type public.employment_status as enum ('employed', 'self_employed', 'unemployed', 'retired', 'student');

create type public.gender_type as enum ('male', 'female', 'other');

create type public.insurance_type as enum ('life', 'medical', 'critical_illness', 'disability', 'investment_linked', 'accident', 'property', 'other');

create type public.lead_source as enum ('referral', 'partner_referral', 'facebook', 'instagram', 'xiaohongshu', 'linkedin', 'bni', 'event', 'walk_in', 'other', 'cp', 'friends', 'website_quiz');

create type public.liability_type as enum ('mortgage', 'car_loan', 'personal_loan', 'study_loan', 'renovation_loan', 'credit_card', 'business_loan', 'other', 'bnpl', 'overdraft', 'tax_payable', 'family_loan', 'asb_financing', 'share_margin', 'policy_loan');

create type public.liquidity_level as enum ('high', 'medium', 'low');

create type public.lost_reason_category as enum ('price', 'no_need', 'competitor', 'lost_contact', 'timing', 'other');

create type public.marital_status as enum ('single', 'married', 'divorced', 'widowed');

create type public.pipeline_stage as enum ('new_lead', 'contacted', 'interested', 'proposal_sent', 'closed_won', 'closed_lost');

create type public.premium_frequency as enum ('monthly', 'quarterly', 'semi_annual', 'annual', 'single_premium');

create type public.risk_profile as enum ('conservative', 'moderate', 'balanced', 'growth', 'aggressive');

create type public.tax_residency as enum ('resident', 'non_resident');

-- ─────────────────────────────────────────────────────────────── tables

create table public.advisors (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  display_name text not null,
  agency_name text,
  license_far text,
  license_cmsrl text,
  license_rep text,
  phone text,
  email text,
  status advisor_status not null default 'active'::advisor_status,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  rank advisor_rank not null default 'WP'::advisor_rank,
  upline_id uuid,
  referral_code text,
  telegram_chat_id text
);

create table public.assets (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  asset_type asset_type not null,
  name text not null,
  institution text,
  account_number text,
  ownership_type text default 'sole'::text,
  current_value numeric(15,2) not null,
  cost_value numeric(15,2),
  currency text not null default 'MYR'::text,
  valuation_date date,
  acquired_at date,
  liquidity liquidity_level not null default 'medium'::liquidity_level,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  purpose text,
  ownership_pct numeric(5,2) not null default 100,
  needs_review boolean not null default false,
  review_reason text
);

create table public.cashflow_categories (
  code text not null,
  label text not null,
  label_zh text,
  direction text,
  is_system boolean default true,
  sort_order integer default 99,
  created_at timestamp with time zone default now(),
  category_group text,
  wealth_effect text,
  recurrence text,
  fixed_variable text,
  need_want text,
  link_to text,
  auto_generated boolean not null default false,
  is_active boolean not null default true
);

create table public.cashflow_entries (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  direction cashflow_direction not null,
  amount numeric(15,2) not null,
  currency text not null default 'MYR'::text,
  period_month date not null,
  is_recurring boolean not null default true,
  frequency cashflow_frequency not null default 'monthly'::cashflow_frequency,
  linked_asset_id uuid,
  linked_liability_id uuid,
  source_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  category text not null,
  needs_review boolean not null default false,
  review_reason text
);

create table public.clients (
  id uuid not null default gen_random_uuid(),
  advisor_id uuid not null,
  salutation text,
  full_name text not null,
  nric text,
  date_of_birth date,
  gender gender_type,
  nationality text,
  residency text,
  phone text,
  email text,
  correspondence_address text,
  correspondence_city text,
  correspondence_state text,
  correspondence_postal_code text,
  marital_status marital_status,
  number_of_dependants integer default 0,
  employment_status employment_status,
  occupation text,
  employer_name text,
  tax_residency tax_residency,
  risk_profile risk_profile,
  retirement_age integer,
  epf_account_number text,
  ppa_account_number text,
  status client_status not null default 'prospect'::client_status,
  pdpa_accepted_at timestamp with time zone,
  onboarded_at timestamp with time zone,
  kyc_payload jsonb not null default '{}'::jsonb,
  kyc_submitted_at timestamp with time zone,
  kyc_status text default 'pending'::text,
  locale text default 'en'::text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  race text,
  tin_number text,
  bank_name text,
  bank_account_number text,
  pep_status boolean default false,
  source_of_funds text,
  pipeline_stage pipeline_stage,
  lead_source lead_source,
  next_action text,
  next_action_date date,
  lost_reason_category lost_reason_category,
  lost_reason_notes text,
  stage_updated_at timestamp with time zone,
  last_contacted_at timestamp with time zone,
  has_epf boolean
);

create table public.health_snapshots (
  client_id uuid not null,
  snapshot_date date not null,
  net_worth numeric(15,2),
  total_assets numeric(15,2),
  total_liabilities numeric(15,2),
  basic_liquidity_ratio numeric(8,4),
  liquid_asset_to_net_worth numeric(8,4),
  solvency_ratio numeric(8,4),
  debt_service_ratio numeric(8,4),
  non_mortgage_dsr numeric(8,4),
  savings_ratio numeric(8,4),
  life_insurance_coverage numeric(8,4),
  invest_assets_to_net_worth numeric(8,4),
  passive_income_coverage numeric(8,4),
  raw_metrics jsonb not null default '{}'::jsonb
);

create table public.insurance_policies (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  policy_type insurance_type not null,
  provider text,
  policy_number text,
  sum_assured numeric(15,2),
  cash_value numeric(15,2),
  premium numeric(15,2),
  premium_frequency premium_frequency,
  insured_person text,
  beneficiaries jsonb not null default '[]'::jsonb,
  start_date date,
  end_date date,
  currency text not null default 'MYR'::text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  case_id uuid,
  plan_name text,
  plan_id uuid,
  policy_holder text,
  premium_term_value numeric,
  premium_term_unit text,
  coverage_term_value numeric,
  coverage_term_unit text
);

create table public.insurers (
  id uuid not null default gen_random_uuid(),
  name text not null,
  short_name text,
  logo_url text,
  created_at timestamp with time zone default now()
);

create table public.investment_accounts (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  asset_id uuid,
  account_type text not null,
  account_name text not null,
  platform text,
  account_number text,
  currency text not null default 'MYR'::text,
  opened_date date,
  status text not null default 'active'::text,
  prs_sub_account_a numeric(15,2),
  prs_sub_account_b numeric(15,2),
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.liabilities (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  liability_type liability_type not null,
  name text not null,
  lender text,
  original_principal numeric(15,2),
  outstanding_balance numeric(15,2) not null,
  interest_rate numeric(6,4),
  monthly_payment numeric(15,2),
  start_date date,
  end_date date,
  linked_asset_id uuid,
  currency text not null default 'MYR'::text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.plans (
  id uuid not null default gen_random_uuid(),
  insurer_id uuid,
  name text not null,
  plan_type text not null,
  coverage_types text[] not null,
  target_audience text[],
  min_entry_age integer,
  max_entry_age integer,
  coverage_till_age integer,
  auto_extension_till_age integer,
  summary text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table public.policy_riders (
  id uuid not null default gen_random_uuid(),
  policy_id uuid not null,
  rider_id uuid,
  rider_name text,
  category text not null,
  sum_assured numeric,
  premium numeric,
  premium_frequency text,
  reduces_main_sum boolean,
  tier_name text,
  room_board_daily numeric,
  annual_limit numeric,
  lifetime_limit numeric,
  pre_hosp_days integer,
  post_hosp_days integer,
  icu_days integer,
  copay_type text,
  copay_amount numeric,
  copay_basis text,
  copay_cap numeric,
  notes text,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  premium_term_value numeric,
  premium_term_unit text,
  coverage_term_value numeric,
  coverage_term_unit text
);

create table public.portfolio_holdings (
  id uuid not null default gen_random_uuid(),
  account_id uuid not null,
  client_id uuid not null,
  snapshot_month date not null,
  instrument_code text not null,
  instrument_name text not null,
  units_held numeric(18,6),
  nav_per_unit numeric(12,6),
  market_value numeric(15,2) not null,
  cost_basis numeric(15,2),
  notes text,
  created_at timestamp with time zone default now()
);

create table public.rider_tiers (
  id uuid not null default gen_random_uuid(),
  rider_id uuid,
  tier_name text not null,
  annual_limit numeric,
  lifetime_limit numeric,
  room_board_daily numeric,
  deductible_min numeric,
  deductible_unit text,
  deductible_options jsonb default '[]'::jsonb,
  co_insurance_pct numeric,
  co_insurance_cap numeric,
  effective_from date,
  effective_to date,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table public.riders (
  id uuid not null default gen_random_uuid(),
  insurer_id uuid,
  name text not null,
  category text not null,
  payout_method text not null,
  reduces_main_sum boolean default false,
  can_standalone boolean default false,
  description text,
  suitable_for text[],
  conditions_covered_count integer,
  early_intermediate_covered boolean default false,
  early_payout_percentage numeric,
  max_payout_percentage numeric,
  max_claim_count integer,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- ─────────────────────────────────────────────────────────────── constraints

alter table advisors add constraint advisors_pkey PRIMARY KEY (id);
alter table advisors add constraint advisors_referral_code_key UNIQUE (referral_code);
alter table advisors add constraint advisors_upline_id_fkey FOREIGN KEY (upline_id) REFERENCES advisors(id) ON DELETE SET NULL;
alter table advisors add constraint advisors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table advisors add constraint advisors_user_id_key UNIQUE (user_id);
alter table assets add constraint assets_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table assets add constraint assets_cost_value_check CHECK ((cost_value >= (0)::numeric));
alter table assets add constraint assets_current_value_check CHECK ((current_value >= (0)::numeric));
alter table assets add constraint assets_ownership_pct_check CHECK (((ownership_pct > (0)::numeric) AND (ownership_pct <= (100)::numeric)));
alter table assets add constraint assets_ownership_type_check CHECK ((ownership_type = ANY (ARRAY['sole'::text, 'joint'::text, 'trust'::text])));
alter table assets add constraint assets_pkey PRIMARY KEY (id);
alter table assets add constraint assets_purpose_check CHECK (((purpose IS NULL) OR (purpose = ANY (ARRAY['personal_use'::text, 'income_producing'::text, 'investment'::text]))));
alter table cashflow_categories add constraint cashflow_categories_direction_check CHECK ((direction = ANY (ARRAY['inflow'::text, 'outflow'::text, 'both'::text])));
alter table cashflow_categories add constraint cashflow_categories_fixed_variable_check CHECK (((fixed_variable IS NULL) OR (fixed_variable = ANY (ARRAY['fixed'::text, 'variable'::text]))));
alter table cashflow_categories add constraint cashflow_categories_link_to_check CHECK (((link_to IS NULL) OR (link_to = ANY (ARRAY['asset'::text, 'liability'::text, 'policy'::text, 'none'::text]))));
alter table cashflow_categories add constraint cashflow_categories_need_want_check CHECK (((need_want IS NULL) OR (need_want = ANY (ARRAY['need'::text, 'want'::text]))));
alter table cashflow_categories add constraint cashflow_categories_pkey PRIMARY KEY (code);
alter table cashflow_categories add constraint cashflow_categories_recurrence_check CHECK (((recurrence IS NULL) OR (recurrence = ANY (ARRAY['recurring'::text, 'irregular'::text, 'one_off'::text]))));
alter table cashflow_categories add constraint cashflow_categories_wealth_effect_check CHECK (((wealth_effect IS NULL) OR (wealth_effect = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text, 'split'::text]))));
alter table cashflow_entries add constraint cashflow_entries_amount_check CHECK ((amount > (0)::numeric));
alter table cashflow_entries add constraint cashflow_entries_category_fkey FOREIGN KEY (category) REFERENCES cashflow_categories(code);
alter table cashflow_entries add constraint cashflow_entries_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table cashflow_entries add constraint cashflow_entries_linked_asset_id_fkey FOREIGN KEY (linked_asset_id) REFERENCES assets(id) ON DELETE SET NULL;
alter table cashflow_entries add constraint cashflow_entries_linked_liability_id_fkey FOREIGN KEY (linked_liability_id) REFERENCES liabilities(id) ON DELETE SET NULL;
alter table cashflow_entries add constraint cashflow_entries_pkey PRIMARY KEY (id);
alter table clients add constraint chk_lost_has_reason CHECK (((pipeline_stage <> 'closed_lost'::pipeline_stage) OR (lost_reason_category IS NOT NULL)));
alter table clients add constraint chk_prospect_has_stage CHECK (((status <> 'prospect'::client_status) OR (pipeline_stage IS NOT NULL)));
alter table clients add constraint clients_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES advisors(id) ON DELETE RESTRICT;
alter table clients add constraint clients_email_key UNIQUE (email);
alter table clients add constraint clients_kyc_status_check CHECK ((kyc_status = ANY (ARRAY['pending'::text, 'submitted'::text, 'approved'::text])));
alter table clients add constraint clients_locale_check CHECK ((locale = ANY (ARRAY['en'::text, 'zh'::text])));
alter table clients add constraint clients_nric_key UNIQUE (nric);
alter table clients add constraint clients_pkey PRIMARY KEY (id);
alter table clients add constraint clients_retirement_age_check CHECK (((retirement_age >= 40) AND (retirement_age <= 100)));
alter table clients add constraint source_of_funds_check CHECK (((source_of_funds IS NULL) OR (source_of_funds = ANY (ARRAY['employment'::text, 'business'::text, 'investment'::text, 'inheritance'::text, 'savings'::text, 'other'::text]))));
alter table health_snapshots add constraint health_snapshots_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table health_snapshots add constraint health_snapshots_pkey PRIMARY KEY (client_id, snapshot_date);
alter table insurance_policies add constraint insurance_policies_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id);
alter table insurance_policies add constraint insurance_policies_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table insurance_policies add constraint insurance_policies_pkey PRIMARY KEY (id);
alter table insurance_policies add constraint insurance_policies_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;
alter table insurers add constraint insurers_pkey PRIMARY KEY (id);
alter table investment_accounts add constraint investment_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['unit_trust'::text, 'private_mandate'::text, 'prs'::text, 'wrap_account'::text, 'direct_stock'::text, 'property'::text, 'other'::text])));
alter table investment_accounts add constraint investment_accounts_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;
alter table investment_accounts add constraint investment_accounts_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table investment_accounts add constraint investment_accounts_pkey PRIMARY KEY (id);
alter table investment_accounts add constraint investment_accounts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text, 'suspended'::text])));
alter table liabilities add constraint liabilities_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table liabilities add constraint liabilities_linked_asset_id_fkey FOREIGN KEY (linked_asset_id) REFERENCES assets(id) ON DELETE SET NULL;
alter table liabilities add constraint liabilities_outstanding_balance_check CHECK ((outstanding_balance >= (0)::numeric));
alter table liabilities add constraint liabilities_pkey PRIMARY KEY (id);
alter table plans add constraint plans_insurer_id_fkey FOREIGN KEY (insurer_id) REFERENCES insurers(id) ON DELETE CASCADE;
alter table plans add constraint plans_pkey PRIMARY KEY (id);
alter table plans add constraint plans_plan_type_check CHECK ((plan_type = ANY (ARRAY['investment_linked'::text, 'term'::text, 'whole_life'::text, 'savings'::text])));
alter table policy_riders add constraint policy_riders_pkey PRIMARY KEY (id);
alter table policy_riders add constraint policy_riders_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES insurance_policies(id) ON DELETE CASCADE;
alter table policy_riders add constraint policy_riders_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE SET NULL;
alter table portfolio_holdings add constraint portfolio_holdings_account_id_fkey FOREIGN KEY (account_id) REFERENCES investment_accounts(id) ON DELETE CASCADE;
alter table portfolio_holdings add constraint portfolio_holdings_account_id_instrument_code_snapshot_mont_key UNIQUE (account_id, instrument_code, snapshot_month);
alter table portfolio_holdings add constraint portfolio_holdings_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table portfolio_holdings add constraint portfolio_holdings_market_value_check CHECK ((market_value >= (0)::numeric));
alter table portfolio_holdings add constraint portfolio_holdings_pkey PRIMARY KEY (id);
alter table rider_tiers add constraint rider_tiers_deductible_unit_check CHECK ((deductible_unit = ANY (ARRAY['per_year'::text, 'per_disability'::text])));
alter table rider_tiers add constraint rider_tiers_pkey PRIMARY KEY (id);
alter table rider_tiers add constraint rider_tiers_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE;
alter table riders add constraint riders_category_check CHECK ((category = ANY (ARRAY['ci'::text, 'cancer'::text, 'accident'::text, 'payor'::text, 'income'::text, 'medical_addon'::text])));
alter table riders add constraint riders_insurer_id_fkey FOREIGN KEY (insurer_id) REFERENCES insurers(id) ON DELETE CASCADE;
alter table riders add constraint riders_payout_method_check CHECK ((payout_method = ANY (ARRAY['lump_sum'::text, 'multiple_payout'::text, 'reimbursement'::text, 'monthly_benefit'::text, 'weekly_benefit'::text, 'waiver'::text])));
alter table riders add constraint riders_pkey PRIMARY KEY (id);

-- ─────────────────────────────────────────────────────────────── indexes

CREATE INDEX assets_needs_review_idx ON public.assets USING btree (client_id) WHERE needs_review;
CREATE INDEX cashflow_entries_needs_review_idx ON public.cashflow_entries USING btree (client_id) WHERE needs_review;
CREATE INDEX idx_advisors_status ON public.advisors USING btree (status);
CREATE INDEX idx_advisors_upline_id ON public.advisors USING btree (upline_id);
CREATE INDEX idx_advisors_user_id ON public.advisors USING btree (user_id);
CREATE INDEX idx_assets_asset_type ON public.assets USING btree (asset_type);
CREATE INDEX idx_assets_client_id ON public.assets USING btree (client_id);
CREATE INDEX idx_cashflow_client_id ON public.cashflow_entries USING btree (client_id);
CREATE INDEX idx_cashflow_direction ON public.cashflow_entries USING btree (direction);
CREATE INDEX idx_cashflow_linked_asset ON public.cashflow_entries USING btree (linked_asset_id);
CREATE INDEX idx_cashflow_linked_liab ON public.cashflow_entries USING btree (linked_liability_id);
CREATE INDEX idx_cashflow_period ON public.cashflow_entries USING btree (period_month);
CREATE INDEX idx_clients_advisor_id ON public.clients USING btree (advisor_id);
CREATE INDEX idx_clients_next_action ON public.clients USING btree (advisor_id, next_action_date) WHERE ((status = 'prospect'::client_status) AND (next_action_date IS NOT NULL));
CREATE INDEX idx_clients_nric ON public.clients USING btree (nric);
CREATE INDEX idx_clients_pipeline ON public.clients USING btree (advisor_id, pipeline_stage) WHERE ((status = 'prospect'::client_status) OR ((status = 'active'::client_status) AND (pipeline_stage = 'closed_won'::pipeline_stage)));
CREATE INDEX idx_clients_status ON public.clients USING btree (status);
CREATE INDEX idx_health_client_date ON public.health_snapshots USING btree (client_id, snapshot_date DESC);
CREATE INDEX idx_insurance_client_id ON public.insurance_policies USING btree (client_id);
CREATE INDEX idx_insurance_type ON public.insurance_policies USING btree (policy_type);
CREATE INDEX idx_inv_accounts_client ON public.investment_accounts USING btree (client_id);
CREATE INDEX idx_liabilities_client_id ON public.liabilities USING btree (client_id);
CREATE INDEX idx_liabilities_linked_asset ON public.liabilities USING btree (linked_asset_id);
CREATE INDEX idx_plans_insurer ON public.plans USING btree (insurer_id);
CREATE INDEX idx_policy_riders_policy ON public.policy_riders USING btree (policy_id);
CREATE INDEX idx_riders_category ON public.riders USING btree (category);
CREATE INDEX idx_riders_insurer ON public.riders USING btree (insurer_id);

-- ─────────────────────────────────────────────────────────────── row level security

alter table public.advisors enable row level security;
alter table public.assets enable row level security;
alter table public.cashflow_categories enable row level security;
alter table public.cashflow_entries enable row level security;
alter table public.clients enable row level security;
alter table public.health_snapshots enable row level security;
alter table public.insurance_policies enable row level security;
alter table public.insurers enable row level security;
alter table public.investment_accounts enable row level security;
alter table public.liabilities enable row level security;
alter table public.plans enable row level security;
alter table public.policy_riders enable row level security;
alter table public.portfolio_holdings enable row level security;
alter table public.rider_tiers enable row level security;
alter table public.riders enable row level security;

create policy advisors_select_own on public.advisors as PERMISSIVE for SELECT to public using (((user_id = auth.uid()) OR (id = ANY (my_downline_advisor_ids()))));
create policy advisors_update_own on public.advisors as PERMISSIVE for UPDATE to authenticated using ((user_id = auth.uid()));
create policy advisors_upline_select_downlines on public.advisors as PERMISSIVE for SELECT to public using ((upline_id = ( SELECT user_profiles.advisor_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));
create policy assets_advisor_all on public.assets as PERMISSIVE for ALL to authenticated using ((is_advisor() AND (client_id = ANY (my_advisor_client_ids()))));
create policy assets_client_select on public.assets as PERMISSIVE for SELECT to authenticated using ((is_client() AND (client_id = my_client_id())));
create policy cashflow_categories_insert on public.cashflow_categories as PERMISSIVE for INSERT to authenticated with check ((is_advisor() AND (is_system = false)));
create policy cashflow_categories_select on public.cashflow_categories as PERMISSIVE for SELECT to authenticated using (true);
create policy cashflow_entries_advisor_all on public.cashflow_entries as PERMISSIVE for ALL to authenticated using ((is_advisor() AND (client_id = ANY (my_advisor_client_ids()))));
create policy cashflow_entries_client_select on public.cashflow_entries as PERMISSIVE for SELECT to authenticated using ((is_client() AND (client_id = my_client_id())));
create policy clients_advisor_all on public.clients as PERMISSIVE for ALL to authenticated using ((is_advisor() AND (advisor_id IN ( SELECT advisors.id
   FROM advisors
  WHERE (advisors.user_id = auth.uid()))))) with check ((is_advisor() AND (advisor_id IN ( SELECT advisors.id
   FROM advisors
  WHERE (advisors.user_id = auth.uid())))));
create policy clients_client_select on public.clients as PERMISSIVE for SELECT to authenticated using ((is_client() AND (id = my_client_id())));
create policy health_snapshots_advisor_all on public.health_snapshots as PERMISSIVE for ALL to authenticated using ((is_advisor() AND (client_id = ANY (my_advisor_client_ids()))));
create policy health_snapshots_client_select on public.health_snapshots as PERMISSIVE for SELECT to authenticated using ((is_client() AND (client_id = my_client_id())));
create policy insurance_policies_advisor_all on public.insurance_policies as PERMISSIVE for ALL to authenticated using ((is_advisor() AND (client_id = ANY (my_advisor_client_ids()))));
create policy insurance_policies_client_select on public.insurance_policies as PERMISSIVE for SELECT to authenticated using ((is_client() AND (client_id = my_client_id())));
create policy insurers_advisor_insert on public.insurers as PERMISSIVE for INSERT to authenticated with check (is_advisor());
create policy "public read insurers" on public.insurers as PERMISSIVE for SELECT to public using (true);
create policy investment_accounts_advisor_all on public.investment_accounts as PERMISSIVE for ALL to authenticated using ((is_advisor() AND (client_id = ANY (my_advisor_client_ids()))));
create policy investment_accounts_client_select on public.investment_accounts as PERMISSIVE for SELECT to authenticated using ((is_client() AND (client_id = my_client_id())));
create policy liabilities_advisor_all on public.liabilities as PERMISSIVE for ALL to authenticated using ((is_advisor() AND (client_id = ANY (my_advisor_client_ids()))));
create policy liabilities_client_select on public.liabilities as PERMISSIVE for SELECT to authenticated using ((is_client() AND (client_id = my_client_id())));
create policy "public read plans" on public.plans as PERMISSIVE for SELECT to public using (true);
create policy policy_riders_advisor_all on public.policy_riders as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM insurance_policies p
  WHERE ((p.id = policy_riders.policy_id) AND is_advisor() AND (p.client_id = ANY (my_advisor_client_ids()))))));
create policy policy_riders_client_select on public.policy_riders as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM insurance_policies p
  WHERE ((p.id = policy_riders.policy_id) AND is_client() AND (p.client_id = my_client_id())))));
create policy portfolio_holdings_advisor_all on public.portfolio_holdings as PERMISSIVE for ALL to authenticated using ((is_advisor() AND (client_id = ANY (my_advisor_client_ids()))));
create policy portfolio_holdings_client_select on public.portfolio_holdings as PERMISSIVE for SELECT to authenticated using ((is_client() AND (client_id = my_client_id())));
create policy "advisors insert rider_tiers" on public.rider_tiers as PERMISSIVE for INSERT to public with check ((auth.role() = 'authenticated'::text));
create policy "public read rider_tiers" on public.rider_tiers as PERMISSIVE for SELECT to public using (true);
create policy "public read riders" on public.riders as PERMISSIVE for SELECT to public using (true);
