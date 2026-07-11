-- Per-client policy riders: a policy is a base plan (death/TPD) plus a list of
-- categorised riders (medical, critical illness, cancer, accident, income, payor, ...).
-- Medical riders carry structured coverage detail (R&B, annual/lifetime limit,
-- pre/post-hosp days, ICU days, co-payment) mirroring the insurance catalog's
-- rider_tiers shape, so per-client data stays comparable to the catalog and lets
-- the coverage overview aggregate precisely across all of a client's policies.
CREATE TABLE public.policy_riders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id      uuid NOT NULL REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  rider_id       uuid REFERENCES public.riders(id) ON DELETE SET NULL,
  rider_name     text NOT NULL,
  category       text NOT NULL,
  sum_assured    numeric,
  premium        numeric,
  premium_frequency text,
  reduces_main_sum  boolean,
  tier_name      text,
  room_board_daily numeric,
  annual_limit   numeric,
  lifetime_limit numeric,
  pre_hosp_days  integer,
  post_hosp_days integer,
  icu_days       integer,
  copay_type     text,
  copay_amount   numeric,
  copay_basis    text,
  copay_cap      numeric,
  notes          text,
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE public.policy_riders ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_riders_advisor_all ON public.policy_riders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insurance_policies p
                 WHERE p.id = policy_riders.policy_id
                   AND is_advisor() AND p.client_id = ANY (my_advisor_client_ids())));

CREATE POLICY policy_riders_client_select ON public.policy_riders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insurance_policies p
                 WHERE p.id = policy_riders.policy_id
                   AND is_client() AND p.client_id = my_client_id()));

CREATE INDEX idx_policy_riders_policy ON public.policy_riders(policy_id);
