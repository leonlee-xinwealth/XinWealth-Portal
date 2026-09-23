-- CFP P2b — standing cash-flow items (常设项目): the plan. Additive only.
-- Spec: docs/superpowers/specs/2026-09-25-cfp-p2b-standing-items-design.md
-- cashflow_entries is unchanged and keeps its meaning: one month's actual figures.
-- Months are stored as the first of the month; effective_to includes its month, null = open-ended.

create table if not exists public.cashflow_items (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  direction           public.cashflow_direction not null,
  category            text not null references public.cashflow_categories(code),
  name                text,
  amount              numeric not null check (amount > 0),
  currency            text not null default 'MYR',
  frequency           public.cashflow_frequency not null default 'monthly',
  effective_from      date not null check (extract(day from effective_from) = 1),
  effective_to        date check (
                        effective_to is null
                        or (extract(day from effective_to) = 1 and effective_to >= effective_from)
                      ),
  linked_asset_id     uuid references public.assets(id) on delete set null,
  linked_liability_id uuid references public.liabilities(id) on delete set null,
  linked_policy_id    uuid references public.insurance_policies(id) on delete set null,
  previous_id         uuid references public.cashflow_items(id) on delete set null,
  source              text not null default 'advisor'
                        check (source in ('advisor', 'kyc', 'client', 'migrated')),
  needs_review        boolean not null default false,
  review_reason       text,
  metadata            jsonb not null default '{}'::jsonb,
  created_by          uuid default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint cashflow_items_one_off_single_month
    check (frequency <> 'one_off' or effective_to = effective_from)
);

create index if not exists cashflow_items_client_effective_idx
  on public.cashflow_items (client_id, effective_from);
create index if not exists cashflow_items_linked_asset_idx
  on public.cashflow_items (linked_asset_id) where linked_asset_id is not null;

alter table public.cashflow_items enable row level security;

create policy cashflow_items_advisor_all on public.cashflow_items
  for all to authenticated
  using (is_advisor() and client_id = any (my_advisor_client_ids()))
  with check (is_advisor() and client_id = any (my_advisor_client_ids()));

create policy cashflow_items_client_select on public.cashflow_items
  for select to authenticated
  using (is_client() and client_id = my_client_id());

create trigger trg_cashflow_items_updated_at
  before update on public.cashflow_items
  for each row execute function set_updated_at();

create trigger audit_cashflow_items
  after insert or delete or update on public.cashflow_items
  for each row execute function write_audit_log();
