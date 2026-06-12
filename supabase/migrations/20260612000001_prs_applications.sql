-- supabase/migrations/20260612000001_prs_applications.sql
-- PRS 开户申请：form_data 为所有表格答案的唯一数据源（见设计文档 §5）

create table public.prs_applications (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references public.clients(id) on delete set null,
  advisor_id       uuid not null references public.advisors(id),
  status           text not null default 'draft'
                     check (status in ('draft','awaiting_client','submitted','completed','cancelled')),
  token            uuid unique,
  token_expires_at timestamptz,
  form_data        jsonb not null default '{}'::jsonb,
  submitted_at     timestamptz,
  pdf_generated_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index prs_applications_advisor_idx on public.prs_applications (advisor_id, status);
create index prs_applications_client_idx  on public.prs_applications (client_id);

alter table public.prs_applications enable row level security;

-- 与 cases 表的 advisor_manage_cases 同模式
create policy advisor_manage_prs_applications on public.prs_applications
  for all
  using (advisor_id in (select id from public.advisors where user_id = auth.uid()))
  with check (advisor_id in (select id from public.advisors where user_id = auth.uid()));

create or replace function public.update_prs_applications_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger prs_applications_updated_at
  before update on public.prs_applications
  for each row execute function public.update_prs_applications_updated_at();
