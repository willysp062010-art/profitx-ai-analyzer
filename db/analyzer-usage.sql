-- Aggregate usage only: no IP, wallet, mint, account or persistent visitor identity.
create table public.pfx_usage_daily (
 day date primary key,
 visits bigint not null default 0 check (visits >= 0),
 analyses bigint not null default 0 check (analyses >= 0),
 started_at timestamptz not null default now()
);
create table public.pfx_usage_events (
 event_id uuid primary key,
 kind text not null check (kind in ('visit','analysis')),
 created_at timestamptz not null default now()
);
create index pfx_usage_events_created_idx on public.pfx_usage_events(created_at);
alter table public.pfx_usage_daily enable row level security;
alter table public.pfx_usage_events enable row level security;
revoke all on public.pfx_usage_daily,public.pfx_usage_events from public,anon,authenticated;
grant select,insert,update,delete on public.pfx_usage_daily,public.pfx_usage_events to service_role;
insert into public.pfx_usage_daily(day) values ((now() at time zone 'Europe/Paris')::date);
create function public.pfx_record_usage(p_event_id uuid,p_kind text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare inserted_count integer;
begin
 if p_kind not in ('visit','analysis') or p_event_id is null then raise exception 'Invalid usage event'; end if;
 insert into public.pfx_usage_events(event_id,kind) values(p_event_id,p_kind) on conflict do nothing;
 get diagnostics inserted_count = row_count;
 if inserted_count = 0 then return false; end if;
 insert into public.pfx_usage_daily(day,visits,analyses)
 values ((now() at time zone 'Europe/Paris')::date,case when p_kind='visit' then 1 else 0 end,case when p_kind='analysis' then 1 else 0 end)
 on conflict(day) do update set visits=public.pfx_usage_daily.visits+excluded.visits,analyses=public.pfx_usage_daily.analyses+excluded.analyses;
 delete from public.pfx_usage_events where event_id in
 (select event_id from public.pfx_usage_events where created_at < now()-interval '7 days' order by created_at limit 1000);
 return true;
end; $$;
create function public.pfx_usage_summary() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('since',min(started_at),'timezone','Europe/Paris',
 'visits',coalesce(sum(visits),0),'analyses',coalesce(sum(analyses),0),
 'todayVisits',coalesce(sum(visits) filter(where day=(now() at time zone 'Europe/Paris')::date),0),
 'todayAnalyses',coalesce(sum(analyses) filter(where day=(now() at time zone 'Europe/Paris')::date),0))
 from public.pfx_usage_daily;
$$;
revoke all on function public.pfx_record_usage(uuid,text),public.pfx_usage_summary() from public,anon,authenticated;
grant execute on function public.pfx_record_usage(uuid,text),public.pfx_usage_summary() to service_role;
