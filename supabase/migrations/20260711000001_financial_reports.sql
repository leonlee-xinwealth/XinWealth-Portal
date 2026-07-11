-- CFP multi-agent report foundation (paraplanner phase 2).
-- One financial_reports row per client per period; each agent writes its own
-- report_sections row (insurance_brain / asset_expert / investment_master).
-- Section rows are created and updated only by the owning agent's edge
-- function (service role); advisors edit content/status via RLS.

create table public.financial_reports (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  advisor_id uuid not null references public.advisors(id),
  period     text not null,
  status     text not null default 'in_progress'
               check (status in ('in_progress','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, period)
);

create table public.report_sections (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.financial_reports(id) on delete cascade,
  section_type text not null
                 check (section_type in ('insurance_planning','asset_allocation','investment_planning')),
  agent        text not null default 'insurance_brain',
  status       text not null default 'generating'
                 check (status in ('generating','draft','approved','failed')),
  content      jsonb,
  error        text,
  generated_at timestamptz,
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (report_id, section_type)
);

create index financial_reports_client_idx on public.financial_reports (client_id);
create index report_sections_report_idx on public.report_sections (report_id);

alter table public.financial_reports enable row level security;
alter table public.report_sections enable row level security;

-- Same pattern as advisor_manage_prs_applications.
create policy advisor_manage_financial_reports on public.financial_reports
  for all
  using (advisor_id in (select id from public.advisors where user_id = auth.uid()))
  with check (advisor_id in (select id from public.advisors where user_id = auth.uid()));

-- Sections inherit ownership through the parent report (financial_reports RLS
-- filters the subquery for authenticated callers).
create policy advisor_manage_report_sections on public.report_sections
  for all
  using (report_id in (select id from public.financial_reports))
  with check (report_id in (select id from public.financial_reports));

create or replace function public.update_financial_reports_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger financial_reports_updated_at
  before update on public.financial_reports
  for each row execute function public.update_financial_reports_updated_at();

create trigger report_sections_updated_at
  before update on public.report_sections
  for each row execute function public.update_financial_reports_updated_at();
