-- Add policy holder + premium/coverage term to policies and riders.
-- Malaysian policies separate the premium PAYMENT term (e.g. pay 20 years) from the
-- COVERAGE term (e.g. covered until age 80), and each rider can carry its own terms.
-- Each term is stored as a value (number) + unit ('years' | 'to_age').
ALTER TABLE public.insurance_policies
  ADD COLUMN IF NOT EXISTS policy_holder         text,
  ADD COLUMN IF NOT EXISTS premium_term_value    numeric,
  ADD COLUMN IF NOT EXISTS premium_term_unit     text,   -- years | to_age
  ADD COLUMN IF NOT EXISTS coverage_term_value   numeric,
  ADD COLUMN IF NOT EXISTS coverage_term_unit    text;   -- years | to_age

ALTER TABLE public.policy_riders
  ADD COLUMN IF NOT EXISTS premium_term_value    numeric,
  ADD COLUMN IF NOT EXISTS premium_term_unit     text,
  ADD COLUMN IF NOT EXISTS coverage_term_value   numeric,
  ADD COLUMN IF NOT EXISTS coverage_term_unit    text;
