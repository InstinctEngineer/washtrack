-- Schedule the cutoff date update to run every Sunday at midnight (00:00)
SELECT cron.schedule(
  'auto-update-cutoff-date',
  '0 0 * * 0', -- Every Sunday at midnight
  $$
  SELECT
    net.http_post(
        url:='https://hkthxnrcgohwjvpgbxyg.supabase.co/functions/v1/update-cutoff-date',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrdGh4bnJjZ29od2p2cGdieHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwODU2ODQsImV4cCI6MjA3NTY2MTY4NH0.A5xemBobaCI9aDytw97LGxRwGOYwaBIpBODq-Wp6cw8"}'::jsonb,
        body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);