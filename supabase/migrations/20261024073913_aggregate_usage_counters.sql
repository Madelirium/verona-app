begin;
create schema if not exists verona_private;
create table verona_private.usage_daily (
  day date not null,
  section text not null check (section in ('home','discover','calendar','saved','news','bus','explore','eventmap','district','games')),
  action text not null check (action in ('view','event_open','event_saved','event_participation','news_open','bus_timetable_open','bus_journey_open','travel_open','pharmacies_open','waste_open','parking_open','weather_open')),
  total integer not null check (total between 1 and 100000),
  primary key (day,section,action)
);
create table verona_private.usage_daily_quota (
  day date primary key,
  total integer not null check (total between 1 and 100000)
);
alter table verona_private.usage_daily enable row level security;
alter table verona_private.usage_daily_quota enable row level security;
revoke all on verona_private.usage_daily,verona_private.usage_daily_quota from public,anon,authenticated;
grant usage on schema verona_private to service_role;
grant select,insert,update,delete on verona_private.usage_daily,verona_private.usage_daily_quota to service_role;

-- No visitor identifiers, raw events, client dates or arbitrary metadata.
-- SECURITY INVOKER: only the server role can execute this RPC and touch the tables.
create function public.record_usage_count(p_section text,p_action text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  today date := (pg_catalog.statement_timestamp() at time zone 'Europe/Rome')::date;
  accepted integer;
begin
  if p_section is null or p_section not in ('home','discover','calendar','saved','news','bus','explore','eventmap','district','games')
     or p_action is null or p_action not in ('view','event_open','event_saved','event_participation','news_open','bus_timetable_open','bus_journey_open','travel_open','pharmacies_open','waste_open','parking_open','weather_open') then
    raise exception 'Invalid counter' using errcode='22023';
  end if;
  insert into verona_private.usage_daily_quota as q values(today,1)
    on conflict(day) do update set total=q.total+1 where q.total<100000
    returning total into accepted;
  if accepted is null then return false; end if;
  insert into verona_private.usage_daily as c values(today,p_section,p_action,1)
    on conflict(day,section,action) do update set total=c.total+1;
  -- Rolling 90 calendar days, cleaned whenever the collector is used.
  delete from verona_private.usage_daily where day<today-89;
  delete from verona_private.usage_daily_quota where day<today-89;
  return true;
end;
$$;
revoke all on function public.record_usage_count(text,text) from public,anon,authenticated;
grant execute on function public.record_usage_count(text,text) to service_role;
commit;
