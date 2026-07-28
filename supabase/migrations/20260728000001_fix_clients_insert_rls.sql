-- Fix: advisors cannot add new clients — "new row violates row-level security policy for table clients"
--
-- The live `clients` table has only `clients_advisor_all` (FOR ALL) with a USING clause
-- (is_advisor() AND id = ANY(my_advisor_client_ids())) and NO WITH CHECK. On INSERT,
-- Postgres falls back to the USING expression as the check; my_advisor_client_ids()
-- lists the advisor's EXISTING client ids, so a brand-new row's freshly-generated id
-- can never satisfy it and every insert is rejected.
--
-- Add a dedicated INSERT policy. Permissive INSERT policies OR their WITH CHECK, so this
-- grants inserts where advisor_id is the advisor's own, without altering the ALL policy
-- (which still governs select/update/delete). Mirrors the precedent used by other
-- advisor-scoped tables (prs_applications, financial_reports, cfp_reports).

drop policy if exists clients_advisor_insert on public.clients;

create policy clients_advisor_insert
  on public.clients
  for insert
  to authenticated
  with check (
    is_advisor()
    and advisor_id in (select id from public.advisors where user_id = auth.uid())
  );
