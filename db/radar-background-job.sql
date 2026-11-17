-- Apply after deploying RADAR_ENRICH_JOB_SECRET and storing the matching value
-- in Vault as pfx_radar_enrich_job_secret. Preserve the existing five-minute cadence.
DO $migration$
DECLARE radar_job bigint;
BEGIN
  SELECT jobid INTO STRICT radar_job FROM cron.job WHERE jobname = 'pfx-radar-live-enrich';
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'pfx_radar_enrich_job_secret') THEN
    RAISE EXCEPTION 'Dedicated radar job credential is missing';
  END IF;
  PERFORM cron.alter_job(radar_job, command := $job$
    SELECT net.http_post(
      url := 'https://profitx-ai-analyzer.vercel.app/api/radar-enrich',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'pfx_radar_enrich_job_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    );
  $job$);
END;
$migration$;
