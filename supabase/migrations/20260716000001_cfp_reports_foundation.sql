-- CFP multi-agent foundation (2026-07-16 design):
--   * report_sections.section_type widens to the 8 CFP sections
--     (asset_allocation is retired — allocation lives inside investment_planning)
--   * financial_reports carries the shared deterministic FinancialBaseline and
--     advisor-entered planning inputs (tax reliefs, estate regime, overrides)
--   * client_goals stores goal-based planning rows (education/house/business)
-- Verified before writing: production report_sections only holds
-- insurance_planning rows, so the constraint swap is safe.

alter table public.report_sections drop constraint report_sections_section_type_check;
alter table public.report_sections add constraint report_sections_section_type_check
  check (section_type in (
    'cashflow_planning','insurance_planning','investment_planning',
    'retirement_planning','tax_planning','legacy_planning',
    'goals_planning','financial_health'));

alter table public.financial_reports
  add column baseline jsonb,
  add column planning_inputs jsonb not null default '{}'::jsonb;

create table public.client_goals (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.clients(id) on delete cascade,
  advisor_id           uuid not null references public.advisors(id),
  goal_type            text not null check (goal_type in ('education','house','business','other')),
  name                 text not null,
  target_amount        numeric not null check (target_amount >= 0),
  target_year          int not null,
  current_saved        numeric not null default 0,
  monthly_contribution numeric not null default 0,
  inflation_override   numeric,
  priority             int not null default 1,
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index client_goals_client_idx on public.client_goals (client_id);

alter table public.client_goals enable row level security;

-- Same ownership pattern as advisor_manage_financial_reports.
create policy advisor_manage_client_goals on public.client_goals
  for all
  using (advisor_id in (select id from public.advisors where user_id = auth.uid()))
  with check (advisor_id in (select id from public.advisors where user_id = auth.uid()));

create trigger client_goals_updated_at
  before update on public.client_goals
  for each row execute function public.update_financial_reports_updated_at();

-- Per-section advisor ↔ agent chat. Messages are appended by the cfp-brain
-- edge function (service role); advisors read their own clients' threads via
-- RLS through the parent section → report ownership chain.
create table public.cfp_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.report_sections(id) on delete cascade,
  role       text not null check (role in ('advisor','agent')),
  message    text not null,
  created_at timestamptz not null default now()
);

create index cfp_chat_messages_section_idx on public.cfp_chat_messages (section_id, created_at);

alter table public.cfp_chat_messages enable row level security;

-- Sections inherit ownership through the parent report (financial_reports RLS
-- filters the subquery for authenticated callers) — same pattern as
-- advisor_manage_report_sections.
create policy advisor_manage_cfp_chat_messages on public.cfp_chat_messages
  for all
  using (section_id in (select id from public.report_sections))
  with check (section_id in (select id from public.report_sections));
