-- Insurance Brain agent (paraplanner phase 1)
-- Extends the live policy_review_requests table (created outside repo migrations
-- by the n8n policy-review funnel) to serve both funnel prospects and CFP deep
-- analyses for existing clients.

alter table public.policy_review_requests
  add column if not exists source text not null default 'prospect',
  add column if not exists agent text not null default 'insurance_brain',
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists error text;

alter table public.policy_review_requests
  drop constraint if exists policy_review_requests_source_check;
alter table public.policy_review_requests
  add constraint policy_review_requests_source_check
  check (source in ('prospect', 'cfp'));

-- Extend status flow with processing/failed (edge function lifecycle states).
alter table public.policy_review_requests
  drop constraint if exists policy_review_requests_status_check;
alter table public.policy_review_requests
  add constraint policy_review_requests_status_check
  check (status in ('submitted', 'processing', 'draft_ready', 'approved',
                    'viewed', 'payment_claimed', 'paid', 'failed'));

create index if not exists idx_prr_client_id
  on public.policy_review_requests (client_id) where client_id is not null;
create index if not exists idx_prr_status_created
  on public.policy_review_requests (status, created_at desc);

-- Advisors may read requests (future read-only dashboard); writes stay
-- service-role-only (n8n + edge functions use the service key).
drop policy if exists prr_advisor_select on public.policy_review_requests;
create policy prr_advisor_select on public.policy_review_requests
  for select to authenticated
  using (exists (
    select 1 from public.advisors a where a.user_id = auth.uid()
  ));
