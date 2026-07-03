-- PDF e-signature requests. Service-role access only (RLS enabled, no policies).

create table public.signature_requests (
  id               uuid primary key default gen_random_uuid(),
  advisor_id       uuid not null references public.advisors(id),
  client_name      text,
  file_name        text not null,
  original_path    text not null,
  signed_path      text,
  token            uuid unique,
  token_expires_at timestamptz,
  status           text not null default 'pending'
                     check (status in ('pending','signed','cancelled')),
  -- Signature box: normalized 0-1 coordinates, top-left origin, 1-based page.
  sig_page         int not null check (sig_page >= 1),
  sig_x            numeric not null check (sig_x >= 0 and sig_x <= 1),
  sig_y            numeric not null check (sig_y >= 0 and sig_y <= 1),
  sig_w            numeric not null check (sig_w > 0 and sig_w <= 1),
  sig_h            numeric not null check (sig_h > 0 and sig_h <= 1),
  created_at       timestamptz not null default now(),
  signed_at        timestamptz
);

create index signature_requests_advisor_idx on public.signature_requests (advisor_id, status);
create index signature_requests_token_idx on public.signature_requests (token) where token is not null;

alter table public.signature_requests enable row level security;

-- Private storage bucket for original + signed PDFs (service role only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
