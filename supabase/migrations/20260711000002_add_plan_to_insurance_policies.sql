-- Add plan name + catalog link to per-client insurance policies.
-- Lets the advisor record the specific plan a client holds and hard-link it to
-- the insurance catalog (public.plans) when the plan exists there, while still
-- allowing free-text plan names for policies outside the catalog.
ALTER TABLE public.insurance_policies
  ADD COLUMN IF NOT EXISTS plan_name text,
  ADD COLUMN IF NOT EXISTS plan_id  uuid REFERENCES public.plans(id) ON DELETE SET NULL;
