-- Joint (household) CFP reports. A report with partner_client_id set is planned
-- against BOTH clients' merged financial picture; null keeps the existing
-- single-client behaviour, so every pre-existing row is unaffected.
--
-- The unique (client_id, period) constraint stays as-is: the joint report is
-- still owned by one primary client, the partner is a planning input.

alter table public.financial_reports
  add column partner_client_id uuid references public.clients(id);

comment on column public.financial_reports.partner_client_id is
  'Non-null = joint household plan; cfp-brain merges both clients'' data (see supabase/functions/cfp-brain/household.ts).';
