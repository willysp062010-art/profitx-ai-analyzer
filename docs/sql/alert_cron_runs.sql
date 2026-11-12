-- Applied through Supabase migrations record_private_alert_cron_runs and limit_alert_cron_run_service_privileges.
create table public.pfx_alert_cron_runs (
  started_at timestamptz primary key,
  completed_at timestamptz not null,
  http_status integer not null check (http_status between 100 and 599),
  duration_ms integer not null check (duration_ms >= 0),
  outcome text not null check (outcome in ('completed','failed')),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object')
);
alter table public.pfx_alert_cron_runs enable row level security;
revoke all on public.pfx_alert_cron_runs from public, anon, authenticated, service_role;
grant select, insert on public.pfx_alert_cron_runs to service_role;
