-- Anonymous event-level deduplication, no visitor identity or analyzed mint.
create table public.pfx_analysis_funnel_daily (
 day date primary key,
 started bigint not null default 0 check(started>=0),
 completed bigint not null default 0 check(completed>=0),
 failed bigint not null default 0 check(failed>=0),
 started_at timestamptz not null default now()
);
create table public.pfx_analysis_funnel_events (
 event_id uuid not null,
 kind text not null check(kind in ('started','completed','failed')),
 created_at timestamptz not null default now(),
 primary key(event_id,kind)
);
create index pfx_analysis_funnel_events_created_idx on public.pfx_analysis_funnel_events(created_at);
alter table public.pfx_analysis_funnel_daily enable row level security;
alter table public.pfx_analysis_funnel_events enable row level security;
revoke all on public.pfx_analysis_funnel_daily,public.pfx_analysis_funnel_events from public,anon,authenticated;
grant select,insert,update,delete on public.pfx_analysis_funnel_daily,public.pfx_analysis_funnel_events to service_role;
insert into public.pfx_analysis_funnel_daily(day) values((now() at time zone 'Europe/Paris')::date);
create function public.pfx_record_analysis_funnel(p_event_id uuid,p_kind text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare inserted_count integer;
begin
 if p_kind is null or p_kind not in ('started','completed','failed') or p_event_id is null then raise exception 'Invalid event'; end if;
 insert into public.pfx_analysis_funnel_events(event_id,kind) values(p_event_id,p_kind) on conflict do nothing;
 get diagnostics inserted_count=row_count;
 if inserted_count=0 then return false; end if;
 insert into public.pfx_analysis_funnel_daily(day,started,completed,failed)
 values((now() at time zone 'Europe/Paris')::date,(p_kind='started')::int,(p_kind='completed')::int,(p_kind='failed')::int)
 on conflict(day) do update set started=public.pfx_analysis_funnel_daily.started+excluded.started,completed=public.pfx_analysis_funnel_daily.completed+excluded.completed,failed=public.pfx_analysis_funnel_daily.failed+excluded.failed;
 delete from public.pfx_analysis_funnel_events where (event_id,kind) in
 (select event_id,kind from public.pfx_analysis_funnel_events where created_at<now()-interval '7 days' order by created_at limit 1000);
 return true;
end; $$;
create function public.pfx_analysis_funnel_summary() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('since',min(started_at),'started',coalesce(sum(started),0),'completed',coalesce(sum(completed),0),'failed',coalesce(sum(failed),0)) from public.pfx_analysis_funnel_daily;
$$;
revoke all on function public.pfx_record_analysis_funnel(uuid,text),public.pfx_analysis_funnel_summary() from public,anon,authenticated;
grant execute on function public.pfx_record_analysis_funnel(uuid,text),public.pfx_analysis_funnel_summary() to service_role;
