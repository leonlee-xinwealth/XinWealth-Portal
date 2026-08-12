-- Investor Suitability Assessment (15-question risk profiler), rule engine v1.0.
--
-- WHY new tables instead of reusing prs_applications / clients.risk_profile:
--   * The 6-question ISA inside the PRS form is the REGULATOR's questionnaire and it
--     writes clients.risk_profile. This feature is XinWealth's own advisory model
--     (Final Profile = MIN(capacity band, tolerance band, horizon ceiling)) and must
--     NEVER touch clients.risk_profile, or it would silently overwrite a filed
--     regulatory answer with a differently-derived number.
--   * suitability_assessments is the MUTABLE workflow row (token, status, answers).
--     suitability_results is an APPEND-ONLY scored snapshot carrying rule_version plus
--     config_snapshot -- the fully-resolved return range, allocation ranges and profile
--     copy in force at scoring time. Editing lib/suitability/rules.ts later therefore
--     cannot retro-change a PDF an advisor has already sent.
--
-- RLS: the two-policy column-ownership pattern from the 20260728000003 post-mortem.
-- A USING clause that requires the row to already exist breaks INSERT ... RETURNING,
-- which is what supabase-js .insert().select().single() compiles to. advisor_id is
-- deliberately DENORMALISED onto suitability_results for exactly this reason:
-- ownership is a column on the new row, not a join through the parent.
--
-- Verified in production before writing: public.is_advisor() (0-arg) exists,
-- public.update_financial_reports_updated_at() exists, neither table exists yet,
-- advisors.telegram_chat_id does not exist yet, and the 'signatures' bucket
-- confirms the private-bucket-in-a-migration precedent from 20260703000001.

create table public.suitability_assessments (
  id                uuid primary key default gen_random_uuid(),
  advisor_id        uuid not null references public.advisors(id),
  client_id         uuid references public.clients(id) on delete set null,
  prospect_name     text,
  prospect_email    text,
  locale            text not null default 'en' check (locale in ('en','zh')),
  status            text not null default 'awaiting_client'
                      check (status in ('awaiting_client','submitted','reviewed','cancelled')),
  token             uuid unique,
  token_expires_at  timestamptz,
  answers           jsonb not null default '{}'::jsonb,
  submitted_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index suitability_assessments_advisor_idx on public.suitability_assessments (advisor_id, status);
create index suitability_assessments_token_idx   on public.suitability_assessments (token) where token is not null;
create index suitability_assessments_client_idx  on public.suitability_assessments (client_id);

alter table public.suitability_assessments enable row level security;

create policy suitability_assessments_advisor_all
  on public.suitability_assessments
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

-- Reuses an existing updated_at helper (newest precedent: 20260716000001:48-50).
create trigger suitability_assessments_updated_at
  before update on public.suitability_assessments
  for each row execute function public.update_financial_reports_updated_at();


create table public.suitability_results (
  id                      uuid primary key default gen_random_uuid(),
  assessment_id           uuid not null references public.suitability_assessments(id) on delete cascade,
  advisor_id              uuid not null references public.advisors(id),
  rule_version            text not null,
  final_profile           text not null
                            check (final_profile in ('STABLE','BALANCED','GROWTH','AGGRESSIVE_GROWTH')),
  final_band              int  not null check (final_band between 1 and 4),
  horizon_ceiling_band    int  not null check (horizon_ceiling_band between 1 and 4),
  capacity_score          int  not null check (capacity_score between 0 and 9),
  capacity_band           int  not null check (capacity_band between 1 and 4),
  tolerance_score         int  not null check (tolerance_score between 0 and 9),
  tolerance_band          int  not null check (tolerance_band between 1 and 4),
  experience_years_band   int  not null check (experience_years_band between 0 and 4),
  product_level           text not null
                            check (product_level in ('NONE','BASIC','INTERMEDIATE','ADVANCED')),
  behaviour_confidence    text not null check (behaviour_confidence in ('LOW','MEDIUM','HIGH')),
  expectation_gap         text not null
                            check (expectation_gap in ('ALIGNED','MODERATE_GAP','SIGNIFICANT_GAP')),
  target_return_pct       numeric,
  red_flags               jsonb   not null default '[]'::jsonb,
  requires_advisor_review boolean not null default false,
  -- Frozen copy of the resolved rule config (return range, allocation ranges,
  -- profile copy) so historical assessments never change when rules.ts is edited.
  config_snapshot         jsonb   not null default '{}'::jsonb,
  answers_snapshot        jsonb   not null default '{}'::jsonb,
  pdf_path                text,
  pdf_generated_at        timestamptz,
  -- PDF render + Telegram push are best-effort and must never fail a submission,
  -- so their outcome is recorded here and retried via /api/suitability redeliver.
  delivery_status         text not null default 'pending'
                            check (delivery_status in ('pending','sent','failed','skipped')),
  delivery_error          text,
  created_at              timestamptz not null default now()
);

create index suitability_results_assessment_idx on public.suitability_results (assessment_id, created_at desc);
create index suitability_results_advisor_idx    on public.suitability_results (advisor_id, created_at desc);
create index suitability_results_review_idx     on public.suitability_results (advisor_id)
  where requires_advisor_review;

alter table public.suitability_results enable row level security;

create policy suitability_results_advisor_all
  on public.suitability_results
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

-- Private bucket for generated suitability PDFs, mirroring the 'signatures' bucket
-- from 20260703000001: service role writes, advisors download via
-- /api/suitability?action=download which mints a short-lived signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('suitability', 'suitability', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Per-advisor Telegram destination. Nullable: the server falls back to the
-- TELEGRAM_CHAT_ID env var when unset, so the single-advisor MVP needs no data
-- entry, and onboarding a second advisor is one UPDATE rather than a migration plus
-- a code change plus a deploy. To obtain a chat id: DM the bot, then read
-- https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
alter table public.advisors add column if not exists telegram_chat_id text;
