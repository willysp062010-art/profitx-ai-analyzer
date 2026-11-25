create table public.pfx_demo_events (
  event_id uuid not null,
  stage text not null check (stage in ('home_click', 'demo_open', 'analysis_started', 'analysis_completed')),
  created_at timestamptz not null default now(),
  primary key (event_id, stage)
);
create index pfx_demo_events_created_idx on public.pfx_demo_events (created_at);
alter table public.pfx_demo_events enable row level security;
revoke all on public.pfx_demo_events from public, anon, authenticated;
grant select, insert, delete on public.pfx_demo_events to service_role;

create function public.pfx_record_demo_event(p_event_id uuid, p_stage text) returns void
language sql security invoker set search_path = '' as $$
  insert into public.pfx_demo_events(event_id, stage) values (p_event_id, p_stage)
  on conflict do nothing;
  delete from public.pfx_demo_events where created_at < now() - interval '7 days';
$$;

create function public.pfx_demo_summary() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'homeClicks', count(*) filter (where home_click),
    'demoOpens', count(*) filter (where demo_open),
    'homeToDemo', count(*) filter (where home_click and demo_open),
    'analysisStarts', count(*) filter (where demo_open and analysis_started),
    'analysisCompletions', count(*) filter (where demo_open and analysis_started and analysis_completed)
  )
  from (
    select bool_or(stage = 'home_click') as home_click,
           bool_or(stage = 'demo_open') as demo_open,
           bool_or(stage = 'analysis_started') as analysis_started,
           bool_or(stage = 'analysis_completed') as analysis_completed
    from public.pfx_demo_events where created_at >= now() - interval '7 days' group by event_id
  ) sessions;
$$;

revoke all on function public.pfx_record_demo_event(uuid,text), public.pfx_demo_summary() from public, anon, authenticated;
grant execute on function public.pfx_record_demo_event(uuid,text), public.pfx_demo_summary() to service_role;
