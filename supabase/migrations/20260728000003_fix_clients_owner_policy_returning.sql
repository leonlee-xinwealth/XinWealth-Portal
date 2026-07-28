-- Corrective fix for the advisor "add client" flow.
--
-- 000001 added an INSERT policy so advisors could satisfy the WITH CHECK, but
-- NewClient.tsx inserts with `.insert(payload).select().single()` — i.e.
-- INSERT ... RETURNING. The RETURNING row is filtered by clients_advisor_all's
-- SELECT USING = `is_advisor() AND id = ANY(my_advisor_client_ids())`.
-- my_advisor_client_ids() scans `clients` and cannot see the row being inserted
-- within the same command, so RETURNING still raised
-- "new row violates row-level security policy for table clients".
--
-- Redefine ownership DIRECTLY by advisor_id (a column comparison on the new row,
-- independent of the row pre-existing), for SELECT/INSERT/UPDATE/DELETE. This is
-- equivalent in scope to my_advisor_client_ids() (advisor's own clients) but works
-- correctly for INSERT ... RETURNING and is cheaper (no per-row id-array build).
-- Drop the now-redundant separate insert policy from 000001.

drop policy if exists clients_advisor_insert on public.clients;
drop policy if exists clients_advisor_all on public.clients;

create policy clients_advisor_all
  on public.clients
  for all
  to authenticated
  using (
    is_advisor()
    and advisor_id in (select id from public.advisors where user_id = auth.uid())
  )
  with check (
    is_advisor()
    and advisor_id in (select id from public.advisors where user_id = auth.uid())
  );
