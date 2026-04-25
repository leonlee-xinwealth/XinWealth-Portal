-- =============================================================
-- XinWealth Portal — Supabase Schema
-- Run in Supabase Studio → SQL Editor (drop existing tables first)
-- =============================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------
-- clients (linked 1:1 to auth.users)
-- -------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,

  full_name              text not null,
  family_name            text,
  given_name             text,
  salutation             text,
  email                  text unique not null,
  nric                   text,
  contact_number         text,
  date_of_birth          date,
  age                    int,
  retirement_age         int default 55,
  gender                 text,
  marital_status         text,
  nationality            text,
  residency              text,
  occupation             text,
  employment_status      text,
  tax_status             text,
  advisor                text,
  epf_account_number     text,
  ppa_account_number     text,
  correspondence_address text,
  correspondence_city    text,
  correspondence_state   text,
  correspondence_postal_code text,
  pdpa_accepted          boolean default false,
  submission_date        timestamptz default now(),

  custom_fields          jsonb default '{}'::jsonb,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

create index clients_email_idx on public.clients (lower(email));
create index clients_user_id_idx on public.clients (user_id);

-- -------------------------------------------------------------
-- incomes
-- -------------------------------------------------------------
create table public.incomes (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.clients(id) on delete cascade,
  category     text not null,
  description  text,
  amount       numeric not null default 0,
  month        int  not null check (month between 0 and 11),
  year         int  not null,
  custom_fields jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);
create index incomes_client_period_idx on public.incomes (client_id, year, month);

-- -------------------------------------------------------------
-- networth (assets + liabilities, distinguished by `type`)
-- -------------------------------------------------------------
create table public.networth (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.clients(id) on delete cascade,
  type         text not null check (type in ('Asset','Liability','Investment')),
  category     text not null,
  description  text,
  value        numeric not null default 0,
  original_purchase_price numeric,
  original_loan_amount    numeric,
  linked_asset_id uuid references public.networth(id) on delete set null,
  month        int  not null check (month between 0 and 11),
  year         int  not null,
  custom_fields jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);
create index networth_client_period_idx on public.networth (client_id, year, month);
create index networth_type_idx on public.networth (client_id, type);

-- -------------------------------------------------------------
-- investments (portfolio time-series; separate from networth.Investment)
-- -------------------------------------------------------------
create table public.investments (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.clients(id) on delete cascade,
  category     text not null,
  description  text,
  amount       numeric not null default 0,
  end_value    numeric,
  cashflow     numeric,
  fd_comparison numeric,
  invested_date date,
  month        int  not null check (month between 0 and 11),
  year         int  not null,
  custom_fields jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);
create index investments_client_period_idx on public.investments (client_id, year, month);
create index investments_client_date_idx on public.investments (client_id, invested_date);

-- -------------------------------------------------------------
-- expenses
-- -------------------------------------------------------------
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.clients(id) on delete cascade,
  category     text not null,
  type         text,
  description  text,
  amount       numeric not null default 0,
  month        int  not null check (month between 0 and 11),
  year         int  not null,
  custom_fields jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);
create index expenses_client_period_idx on public.expenses (client_id, year, month);

-- -------------------------------------------------------------
-- insurance
-- -------------------------------------------------------------
create table public.insurance (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.clients(id) on delete cascade,
  insurer      text,
  plan_name    text,
  policy_number text,
  coverage     text,
  sum_assured  numeric,
  premium      numeric,
  personal_accident numeric,
  medical_annual_limit numeric,
  advance_critical_illness numeric,
  early_critical_illness numeric,
  tpd numeric,
  death numeric,
  policy_url   text,
  custom_fields jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);
create index insurance_client_idx on public.insurance (client_id);

-- -------------------------------------------------------------
-- monthly_snapshots (per-networth-item time-series)
-- -------------------------------------------------------------
create table public.monthly_snapshots (
  id            uuid primary key default gen_random_uuid(),
  networth_id   uuid references public.networth(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete cascade,
  current_value numeric,
  cashflow      numeric,
  monthly_income numeric,
  monthly_expenses numeric,
  monthly_repayment numeric,
  snapshot_date date not null,
  custom_fields jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);
create index monthly_snapshots_client_date_idx on public.monthly_snapshots (client_id, snapshot_date);
create index monthly_snapshots_networth_idx on public.monthly_snapshots (networth_id);

-- -------------------------------------------------------------
-- updated_at trigger
-- -------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.touch_updated_at();

-- =============================================================
-- Row Level Security
-- =============================================================

alter table public.clients           enable row level security;
alter table public.incomes           enable row level security;
alter table public.networth          enable row level security;
alter table public.investments       enable row level security;
alter table public.expenses          enable row level security;
alter table public.insurance         enable row level security;
alter table public.monthly_snapshots enable row level security;

-- Clients: each user can only see/update their own client row
create policy "client reads own row" on public.clients
  for select using (auth.uid() = user_id);
create policy "client updates own row" on public.clients
  for update using (auth.uid() = user_id);

-- Sub-tables: rows scoped via clients.user_id
do $$
declare
  t text;
begin
  for t in select unnest(array['incomes','networth','investments','expenses','insurance','monthly_snapshots']) loop
    execute format($f$
      create policy "client reads own %1$s" on public.%1$s
        for select using (
          client_id in (select id from public.clients where user_id = auth.uid())
        );
      create policy "client writes own %1$s" on public.%1$s
        for insert with check (
          client_id in (select id from public.clients where user_id = auth.uid())
        );
      create policy "client updates own %1$s" on public.%1$s
        for update using (
          client_id in (select id from public.clients where user_id = auth.uid())
        );
      create policy "client deletes own %1$s" on public.%1$s
        for delete using (
          client_id in (select id from public.clients where user_id = auth.uid())
        );
    $f$, t);
  end loop;
end$$;

-- Note: Service role (used by /api/* serverless functions) bypasses RLS automatically.
