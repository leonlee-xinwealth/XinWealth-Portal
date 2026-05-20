# Scheduled Broadcast Setup

The `send-broadcast` function needs to run on a schedule to process scheduled broadcasts.

## Option A: Supabase Dashboard (Recommended)

1. Go to Supabase Dashboard → Edge Functions → send-broadcast
2. Click "Add Schedule"
3. Set cron expression: `0 * * * *` (every hour)
4. Set HTTP method: POST
5. Set body: `{"mode":"process_scheduled"}`
6. Save

## Option B: pg_cron + pg_net (if both extensions are enabled)

```sql
SELECT cron.schedule(
  'process-scheduled-broadcasts',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := '<YOUR_SUPABASE_URL>/functions/v1/send-broadcast',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
      ),
      body := '{"mode":"process_scheduled"}'::jsonb
    );
  $$
);
```
