# Scheduled Broadcast Setup

The `send-broadcast` function needs to run on a schedule to process scheduled broadcasts.

## Authentication

`process_scheduled` is a **machine** call — there is no signed-in user, so it
authenticates with the `x-agent-secret` header checked against
`AGENT_SHARED_SECRET` (same pattern as `cfp-brain` / `insurance-brain`), not
with an `Authorization` bearer token.

> A service-role key does **not** work as a bearer token here: the function
> resolves the caller with `auth.getUser()`, and a service-role JWT represents
> no end user, so it fails and returns 401. That mistake silently broke this
> schedule for months — every hourly tick returned `401 Unauthorized`.

Machine callers may only run `process_scheduled`. Sending a specific broadcast
(`{"broadcastId": "..."}`) still requires a real advisor JWT, and the advisor
must own that broadcast.

## Current setup (pg_cron + pg_net)

Live as `cron.job` id 1, `process-scheduled-broadcasts`, hourly:

```sql
SELECT cron.schedule(
  'process-scheduled-broadcasts',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-broadcast',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-agent-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'AGENT_SHARED_SECRET' LIMIT 1)
      ),
      body := '{"mode":"process_scheduled"}'::jsonb,
      timeout_milliseconds := 20000
    );
  $$
);
```

`timeout_milliseconds` matters: the job runs only once an hour, so the function
is **always** cold, and pg_net's 5000 ms default is not enough for a cold start
plus the vault lookup — it will time out on every tick without it.

## Checking on it

```sql
-- recent invocation results
select id, status_code, content, error_msg, created
from net._http_response order by created desc limit 10;
```

Expect `200` with `{"processed":N}`. A `401` means the agent secret is missing
or wrong; a timeout with `status_code` null means `timeout_milliseconds` is too
low.
