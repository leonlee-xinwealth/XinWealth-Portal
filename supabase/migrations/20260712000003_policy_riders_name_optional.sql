-- A rider can be recorded by category + sum assured without a specific name
-- (advisors often know "it's CI, 500k" without the exact rider product name).
-- Make rider_name optional so such riders persist instead of being dropped.
ALTER TABLE public.policy_riders ALTER COLUMN rider_name DROP NOT NULL;
