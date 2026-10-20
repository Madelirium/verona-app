-- Run once in the Supabase SQL editor. Only the trusted Node backend may call these RPCs.
begin;
create schema if not exists verona_private;
revoke all on schema verona_private from public, anon, authenticated;
grant usage on schema verona_private to service_role;

create table if not exists verona_private.game_runtime (
  key text primary key check (key in ('friendly:briscola','friendly:forza4','ranked')),
  revision bigint not null default 0,
  state jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists verona_private.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24 and position('@' in name)=0),
  updated_at timestamptz not null default now()
);
create table if not exists verona_private.game_ratings (
  game text not null check (game in ('briscola','forza4')),
  user_id uuid not null references verona_private.player_profiles(user_id) on delete cascade,
  name text not null,
  elo integer not null default 1000,
  games integer not null default 0 check (games>=0),
  wins integer not null default 0 check (wins>=0 and wins<=games),
  primary key (game,user_id)
);
create index if not exists game_ratings_leaderboard on verona_private.game_ratings(game,elo desc,games desc,user_id);
create index if not exists game_ratings_user on verona_private.game_ratings(user_id);
create table if not exists verona_private.game_results (
  match_id text primary key check (match_id ~ '^[a-f0-9]{32}$'),
  game text not null check (game in ('briscola','forza4')),
  player_a uuid not null references auth.users(id) on delete cascade,
  player_b uuid not null references auth.users(id) on delete cascade,
  winner integer check (winner in (0,1)),
  reason text not null check (reason in ('completed','timeout','abandon')),
  finished_at bigint not null,
  changes jsonb not null,
  check (player_a<>player_b)
);
create index if not exists game_results_player_a on verona_private.game_results(player_a,finished_at desc);
create index if not exists game_results_player_b on verona_private.game_results(player_b,finished_at desc);
alter table verona_private.game_runtime enable row level security;
alter table verona_private.player_profiles enable row level security;
alter table verona_private.game_ratings enable row level security;
alter table verona_private.game_results enable row level security;
revoke all on verona_private.game_runtime,verona_private.player_profiles,verona_private.game_ratings,verona_private.game_results from public,anon,authenticated;
grant select,insert,update,delete on verona_private.game_runtime,verona_private.player_profiles,verona_private.game_ratings,verona_private.game_results to service_role;

create or replace function public.verona_games_load(p_key text,p_user uuid default null,p_game text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare runtime verona_private.game_runtime%rowtype; ratings jsonb:='[]'; board jsonb:='[]';
begin
  if p_key not in ('friendly:briscola','friendly:forza4','ranked') then raise exception 'Invalid runtime'; end if;
  select * into runtime from verona_private.game_runtime where key=p_key;
  if p_key='ranked' then
    select coalesce(jsonb_agg(to_jsonb(r)),'[]') into ratings from verona_private.game_ratings r
    where r.user_id=p_user or r.user_id in (
      select (player->>'id')::uuid from jsonb_array_elements(coalesce(runtime.state->'matches','[]')) m,
        lateral jsonb_array_elements(m->'players') player
    );
    if p_game is not null then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into board from (
        select name,elo,games,wins from verona_private.game_ratings where game=p_game and games>0
        order by elo desc,games desc,user_id limit 50
      ) r;
    end if;
  end if;
  return jsonb_build_object('revision',coalesce(runtime.revision,0),'state',runtime.state,'ratings',ratings,'leaderboard',board);
end $$;

create or replace function public.verona_games_commit(p_key text,p_revision bigint,p_state jsonb,p_results jsonb default '[]')
returns boolean language plpgsql security invoker set search_path='' as $$
declare current_revision bigint; result jsonb; player jsonb; change jsonb; seat integer; affected integer; match_id_value text;
begin
  if p_key not in ('friendly:briscola','friendly:forza4','ranked') or p_revision<0 or p_state is null then raise exception 'Invalid checkpoint'; end if;
  if p_key<>'ranked' and jsonb_array_length(p_results)>0 then raise exception 'Invalid results'; end if;
  insert into verona_private.game_runtime(key) values(p_key) on conflict do nothing;
  select revision into current_revision from verona_private.game_runtime where key=p_key for update;
  if current_revision<>p_revision then return false; end if;
  for result in select value from jsonb_array_elements(p_results) loop
    match_id_value:=result->>'matchId';
    if jsonb_array_length(result->'players')<>2 or jsonb_array_length(result->'changes')<>2 then raise exception 'Invalid players'; end if;
    -- The checkpoint and result are committed together. A duplicate is a failed transition,
    -- never an opportunity to apply a rating twice.
    if exists(select 1 from verona_private.game_results where match_id=match_id_value) then raise exception 'Duplicate result'; end if;
    for seat in 0..1 loop
      player:=result->'players'->seat; change:=result->'changes'->seat;
      if (change->>'after')::integer-(change->>'before')::integer<>(change->>'delta')::integer then raise exception 'Invalid Elo'; end if;
      insert into verona_private.player_profiles(user_id,name) values((player->>'id')::uuid,player->>'name')
      on conflict(user_id) do update set name=excluded.name,updated_at=now();
      insert into verona_private.game_ratings(game,user_id,name) values(result->>'game',(player->>'id')::uuid,player->>'name') on conflict do nothing;
      update verona_private.game_ratings set name=player->>'name',elo=(change->>'after')::integer,games=games+1,
        wins=wins+case when (result->>'winner')::integer=seat then 1 else 0 end
      where game=result->>'game' and user_id=(player->>'id')::uuid and elo=(change->>'before')::integer;
      get diagnostics affected=row_count;
      if affected<>1 then raise exception 'Rating conflict'; end if;
    end loop;
    if ((result->'changes'->0->>'delta')::integer+(result->'changes'->1->>'delta')::integer)<>0 then raise exception 'Unbalanced Elo'; end if;
    insert into verona_private.game_results(match_id,game,player_a,player_b,winner,reason,finished_at,changes)
    values(match_id_value,result->>'game',(result->'players'->0->>'id')::uuid,(result->'players'->1->>'id')::uuid,
      (result->>'winner')::integer,result->>'reason',(result->>'now')::bigint,result->'changes');
  end loop;
  update verona_private.game_runtime set revision=revision+1,state=p_state,updated_at=now() where key=p_key;
  return true;
end $$;
revoke all on function public.verona_games_load(text,uuid,text) from public,anon,authenticated;
revoke all on function public.verona_games_commit(text,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.verona_games_load(text,uuid,text) to service_role;
grant execute on function public.verona_games_commit(text,bigint,jsonb,jsonb) to service_role;
commit;
