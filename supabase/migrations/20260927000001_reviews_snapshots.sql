-- CFP P4 — reviews (quarterly / annual), liability balance history, snapshot links (additive only).
-- Spec: docs/superpowers/specs/2026-09-27-cfp-p4-review-monitoring-design.md
-- A review changes nothing until an advisor approves it (D5); approval writes valuations, balances and a snapshot.

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  kind          text not null check (kind in ('quarterly', 'annual')),
  period_end    date not null,
  status        text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  submitted_by  text check (submitted_by is null or submitted_by in ('client', 'advisor')),
  submitted_at  timestamptz,
  approved_by   uuid,
  approved_at   timestamptz,
  payload       jsonb not null default '{}'::jsonb,
  advisor_note  text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists reviews_client_idx on public.reviews (client_id, period_end desc);
create index if not exists reviews_pending_idx on public.reviews (status) where status = 'submitted';

alter table public.reviews enable row level security;

create policy reviews_advisor_all on public.reviews
  for all to authenticated
  using (is_advisor() and client_id = any (my_advisor_client_ids()))
  with check (is_advisor() and client_id = any (my_advisor_client_ids()));

create policy reviews_client_select on public.reviews
  for select to authenticated
  using (is_client() and client_id = my_client_id());

create trigger trg_reviews_updated_at before update on public.reviews
  for each row execute function set_updated_at();
create trigger audit_reviews after insert or delete or update on public.reviews
  for each row execute function write_audit_log();

create table if not exists public.liability_balances (
  id              uuid primary key default gen_random_uuid(),
  liability_id    uuid not null references public.liabilities(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  balance_date    date not null,
  balance         numeric not null check (balance >= 0),
  interest_rate   numeric,
  monthly_payment numeric,
  source          text not null default 'manual' check (source in ('auto', 'manual', 'review', 'migrated')),
  note            text,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (liability_id, balance_date)
);

create index if not exists liability_balances_client_idx on public.liability_balances (client_id, balance_date);

alter table public.liability_balances enable row level security;

create policy liability_balances_advisor_all on public.liability_balances
  for all to authenticated
  using (is_advisor() and client_id = any (my_advisor_client_ids()))
  with check (is_advisor() and client_id = any (my_advisor_client_ids()));

create policy liability_balances_client_select on public.liability_balances
  for select to authenticated
  using (is_client() and client_id = my_client_id());

create trigger trg_liability_balances_updated_at before update on public.liability_balances
  for each row execute function set_updated_at();
create trigger audit_liability_balances after insert or delete or update on public.liability_balances
  for each row execute function write_audit_log();

create or replace function public.record_liability_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.outstanding_balance is null or new.outstanding_balance < 0 then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.outstanding_balance is not distinct from old.outstanding_balance
     and new.interest_rate is not distinct from old.interest_rate
     and new.monthly_payment is not distinct from old.monthly_payment then
    return new;
  end if;
  insert into public.liability_balances (liability_id, client_id, balance_date, balance, interest_rate, monthly_payment, source)
  values (new.id, new.client_id, current_date, new.outstanding_balance, new.interest_rate, new.monthly_payment, 'auto')
  on conflict (liability_id, balance_date) do update
    set balance = excluded.balance, interest_rate = excluded.interest_rate, monthly_payment = excluded.monthly_payment
    where public.liability_balances.source = 'auto';
  return new;
end;
$$;

create trigger trg_liabilities_record_balance
  after insert or update of outstanding_balance, interest_rate, monthly_payment on public.liabilities
  for each row execute function public.record_liability_balance();

alter table public.health_snapshots
  add column if not exists review_id uuid references public.reviews(id) on delete set null,
  add column if not exists unexplained_gap numeric;
