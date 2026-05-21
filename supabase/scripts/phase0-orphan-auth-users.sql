-- Phase 0.3: find auth users that are neither clients nor advisors.
-- Run in Supabase SQL editor or via psql with service-role privileges.

SELECT
  u.id,
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN public.clients c ON lower(c.email) = lower(u.email)
LEFT JOIN public.advisors a ON lower(a.email) = lower(u.email)
WHERE c.id IS NULL
  AND a.id IS NULL
ORDER BY u.created_at;

-- Known orphan from the implementation plan:
-- leon3913.fa@gmail.com
--
-- Delete only after confirming it should not become an advisor/client:
-- DELETE FROM auth.users
-- WHERE lower(email) = lower('leon3913.fa@gmail.com')
--   AND NOT EXISTS (SELECT 1 FROM public.clients WHERE lower(email) = lower('leon3913.fa@gmail.com'))
--   AND NOT EXISTS (SELECT 1 FROM public.advisors WHERE lower(email) = lower('leon3913.fa@gmail.com'));

-- Acceptance check:
SELECT
  (SELECT COUNT(*) FROM auth.users) AS auth_users_count,
  (SELECT COUNT(*) FROM public.clients WHERE email IS NOT NULL) AS client_email_count,
  (SELECT COUNT(*) FROM public.advisors WHERE email IS NOT NULL) AS advisor_email_count;
