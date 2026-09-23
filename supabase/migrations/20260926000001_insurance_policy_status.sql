-- CFP P5 — policy status, nomination, group cover and MRTA/policy-loan links (additive only).
-- Spec: docs/superpowers/specs/2026-09-26-cfp-p5-insurance-design.md
-- policy_type is deliberately NOT extended: renaming/adding enum values would break every deployed
-- reader at once. MRTA/MLTA = a life policy with covers_liability_id; group cover = is_group_employer.

alter table public.insurance_policies
  add column if not exists status text not null default 'in_force'
    check (status in ('in_force', 'lapsed', 'paid_up', 'surrendered', 'matured')),
  add column if not exists nomination_type text
    check (nomination_type is null or nomination_type in ('trust', 'hibah', 'conditional', 'none')),
  add column if not exists is_group_employer boolean not null default false,
  add column if not exists covers_liability_id uuid references public.liabilities(id) on delete set null;

alter table public.liabilities
  add column if not exists linked_policy_id uuid references public.insurance_policies(id) on delete set null;
