-- Per-advisor KYC referral code.
--
-- The public KYC form (/api/kyc) previously hardcoded every submission to a single
-- default advisor, so a second advisor (Vivian) never received her clients' KYC data.
-- Add a short, unique referral code per advisor so /kyc?ref=<code> attributes each
-- submission to the correct advisor. The API resolves ref -> advisor_id and falls back
-- to the default advisor when ref is missing or unknown.

alter table public.advisors add column if not exists referral_code text unique;

update public.advisors set referral_code = 'leon'
  where id = '5ac7f25c-421e-4f03-8dac-ac5375626586' and referral_code is null;
update public.advisors set referral_code = 'vivian'
  where id = '503dadb0-0774-403f-90e4-89572f76a1e9' and referral_code is null;
