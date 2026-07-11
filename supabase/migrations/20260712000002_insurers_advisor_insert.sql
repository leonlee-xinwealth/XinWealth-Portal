-- Allow advisors to enrich the insurance catalog with a new company when a client's
-- policy is with an insurer not yet in the catalog (mirrors the existing
-- "advisors insert rider_tiers" precedent).
CREATE POLICY insurers_advisor_insert ON public.insurers FOR INSERT TO authenticated
  WITH CHECK (is_advisor());
