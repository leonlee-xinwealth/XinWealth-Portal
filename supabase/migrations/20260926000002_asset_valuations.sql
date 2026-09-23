-- CFP P3 — per-asset valuation history (additive only).
-- Spec: docs/superpowers/specs/2026-09-26-cfp-p3-assets-portfolio-design.md 决策 2
-- Every insert of an asset, and every change to its current_value / valuation_date, records a
-- valuation automatically, so history accumulates without touching any existing write path.
-- net_contribution = money added minus money taken out during the period ending on valuation_date
-- (time-weighted return needs it to separate contributions from market movement).

create table if not exists public.asset_valuations (
  id               uuid primary key default gen_random_uuid(),
  asset_id         uuid not null references public.assets(id) on delete cascade,
  client_id        uuid not null references public.clients(id) on delete cascade,
  valuation_date   date not null,
  value            numeric not null check (value >= 0),
  net_contribution numeric not null default 0,
  source           text not null default 'manual' check (source in ('auto', 'manual', 'review', 'migrated')),
  note             text,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (asset_id, valuation_date)
);

create index if not exists asset_valuations_client_idx on public.asset_valuations (client_id, valuation_date);

alter table public.asset_valuations enable row level security;

create policy asset_valuations_advisor_all on public.asset_valuations
  for all to authenticated
  using (is_advisor() and client_id = any (my_advisor_client_ids()))
  with check (is_advisor() and client_id = any (my_advisor_client_ids()));

create policy asset_valuations_client_select on public.asset_valuations
  for select to authenticated
  using (is_client() and client_id = my_client_id());

create trigger trg_asset_valuations_updated_at
  before update on public.asset_valuations
  for each row execute function set_updated_at();

create trigger audit_asset_valuations
  after insert or delete or update on public.asset_valuations
  for each row execute function write_audit_log();

create or replace function public.record_asset_valuation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_value is null or new.current_value < 0 then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.current_value is not distinct from old.current_value
     and new.valuation_date is not distinct from old.valuation_date then
    return new;
  end if;
  insert into public.asset_valuations (asset_id, client_id, valuation_date, value, source)
  values (new.id, new.client_id, coalesce(new.valuation_date, current_date), new.current_value, 'auto')
  on conflict (asset_id, valuation_date) do update
    set value = excluded.value
    where public.asset_valuations.source = 'auto';
  return new;
end;
$$;

create trigger trg_assets_record_valuation
  after insert or update of current_value, valuation_date on public.assets
  for each row execute function public.record_asset_valuation();
