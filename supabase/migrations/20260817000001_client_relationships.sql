-- Family relationships between clients of the same advisor.
-- Spouses are the first use case (joint CFP planning, see the companion
-- 20260817000002 migration), but the model is deliberately general so
-- children/parents/siblings can be recorded later without another migration.
--
-- Rows are stored bidirectionally: inserting A→B automatically materialises the
-- reciprocal B→A row via trigger, so every read is a plain
-- `.eq('client_id', id)` — no two-sided or(...) queries in the portal.

create table public.client_relationships (
  id                uuid primary key default gen_random_uuid(),
  advisor_id        uuid not null references public.advisors(id),
  client_id         uuid not null references public.clients(id) on delete cascade,
  related_client_id uuid not null references public.clients(id) on delete cascade,
  relationship_type text not null check (relationship_type in
                      ('spouse','child','parent','sibling','other')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint client_relationships_not_self check (client_id <> related_client_id),
  unique (client_id, related_client_id)
);

create index client_relationships_client_idx on public.client_relationships (client_id);
create index client_relationships_related_idx on public.client_relationships (related_client_id);

alter table public.client_relationships enable row level security;

-- Same ownership pattern as advisor_manage_client_goals.
create policy advisor_manage_client_relationships on public.client_relationships
  for all
  using (advisor_id in (select id from public.advisors where user_id = auth.uid()))
  with check (advisor_id in (select id from public.advisors where user_id = auth.uid()));

create trigger client_relationships_updated_at
  before update on public.client_relationships
  for each row execute function public.update_financial_reports_updated_at();

-- ---------------------------------------------------------------- reciprocity

-- child→parent and parent→child; everything else is its own inverse.
create or replace function public.inverse_relationship_type(t text)
returns text language sql immutable as $$
  select case t when 'child' then 'parent' when 'parent' then 'child' else t end;
$$;

-- Both ends must belong to the advisor who owns the row — otherwise an advisor
-- could graft another advisor's client into their own family tree and read it
-- back through the join.
create or replace function public.client_relationships_validate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a_owner uuid;
  b_owner uuid;
begin
  select advisor_id into a_owner from public.clients where id = new.client_id;
  select advisor_id into b_owner from public.clients where id = new.related_client_id;
  if a_owner is null or b_owner is null then
    raise exception 'client_relationships: client not found';
  end if;
  if a_owner <> new.advisor_id or b_owner <> new.advisor_id then
    raise exception 'client_relationships: both clients must belong to advisor %', new.advisor_id;
  end if;
  return new;
end $$;

create trigger client_relationships_validate
  before insert or update on public.client_relationships
  for each row execute function public.client_relationships_validate();

-- security definer: the mirror row is written on behalf of the advisor, but the
-- INSERT itself happens inside the trigger where the RLS with-check would
-- otherwise re-evaluate against a statement the caller never issued.
-- `on conflict do nothing` is what stops the mirror from mirroring back.
create or replace function public.client_relationships_mirror()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.client_relationships
      (advisor_id, client_id, related_client_id, relationship_type, notes)
    values
      (new.advisor_id, new.related_client_id, new.client_id,
       public.inverse_relationship_type(new.relationship_type), new.notes)
    on conflict (client_id, related_client_id) do nothing;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    update public.client_relationships
       set relationship_type = public.inverse_relationship_type(new.relationship_type),
           notes = new.notes
     where client_id = new.related_client_id
       and related_client_id = new.client_id
       and (relationship_type is distinct from public.inverse_relationship_type(new.relationship_type)
            or notes is distinct from new.notes);
    return new;
  end if;

  -- DELETE: drop the reciprocal row too. The recursion terminates because the
  -- mirror is already gone by the time its own delete trigger fires.
  delete from public.client_relationships
   where client_id = old.related_client_id
     and related_client_id = old.client_id;
  return old;
end $$;

create trigger client_relationships_mirror
  after insert or update or delete on public.client_relationships
  for each row execute function public.client_relationships_mirror();
