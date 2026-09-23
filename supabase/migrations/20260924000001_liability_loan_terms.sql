-- CFP P2a — loan terms the D1 estimator reads (additive only).
-- Spec: docs/superpowers/specs/2026-09-24-cfp-p2a-linked-obligations-design.md
-- Estimated values are computed at read time (supabase/functions/_shared/finance/loans.ts)
-- and never stored; these two columns only hold what the client actually told us.

alter table public.liabilities
  add column if not exists remaining_months integer
    check (remaining_months is null or remaining_months > 0),
  add column if not exists rate_type text
    check (rate_type is null or rate_type in ('reducing', 'flat', 'revolving', 'interest_only'));
