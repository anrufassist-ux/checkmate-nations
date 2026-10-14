-- Checkmate Nations: purchases (Stripe), Nations League with monthly seasons, Hall of Fame.
-- Run after 005 in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Safe to run again.
-- Clients never write any of this; the edge function "game" does, finish_game() records league games.

-- ---------- shop ----------
-- One row per Stripe Checkout started from the game; granted once Stripe says it is paid.
create table if not exists public.checkouts (
  session_id  text primary key,
  user_id     uuid references auth.users (id) on delete set null,
  product     text not null check (product in ('bundle3', 'all', 'pass')),
  nations     text[] not null default '{}',
  season      text,                       -- league pass: the season it is for
  amount      int not null,               -- cents
  consent_at  timestamptz not null,       -- player agreed to immediate unlock (no right of withdrawal)
  status      text not null default 'open' check (status in ('open', 'paid', 'expired')),
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);
create index if not exists checkouts_user_idx on public.checkouts (user_id, status);
alter table public.checkouts enable row level security;
revoke all on public.checkouts from anon, authenticated;

create table if not exists public.owned_nations (
  user_id     uuid not null references auth.users (id) on delete cascade,
  nation      text not null,
  session_id  text,
  created_at  timestamptz not null default now(),
  primary key (user_id, nation)
);
alter table public.owned_nations enable row level security;
drop policy if exists "own nations" on public.owned_nations;
create policy "own nations" on public.owned_nations for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete, truncate on public.owned_nations from anon, authenticated;

create table if not exists public.league_passes (
  user_id     uuid not null references auth.users (id) on delete cascade,
  season      text not null,
  session_id  text,
  created_at  timestamptz not null default now(),
  primary key (user_id, season)
);
alter table public.league_passes enable row level security;
drop policy if exists "own passes" on public.league_passes;
create policy "own passes" on public.league_passes for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete, truncate on public.league_passes from anon, authenticated;

-- ---------- league ----------
-- Season = calendar month in German time, e.g. '2026-10'
create or replace function public.current_season() returns text language sql stable as $$
  select to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM');
$$;

-- One fixed nation per player and season
create table if not exists public.league_entries (
  season     text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  nation     text not null,
  joined_at  timestamptz not null default now(),
  primary key (season, user_id)
);
alter table public.league_entries enable row level security;
drop policy if exists "league entries are public" on public.league_entries;
create policy "league entries are public" on public.league_entries for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.league_entries from anon, authenticated;

-- One row per rated game that counted for the league (kept after the game itself is cleaned up).
-- *_pts: 3/1/0 for that side, *_w: weight of that side for its nation (weaker or new players count less),
-- *_ok: false when that side was over its daily cap.
create table if not exists public.league_games (
  game_id   uuid primary key,
  season    text not null,
  day       date not null,
  white_id  uuid references auth.users (id) on delete set null,
  black_id  uuid references auth.users (id) on delete set null,
  white_nation text not null,
  black_nation text not null,
  w_pts int not null, b_pts int not null,
  w_w numeric not null, b_w numeric not null,
  w_ok boolean not null, b_ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists league_games_season_idx on public.league_games (season);
alter table public.league_games enable row level security;
revoke all on public.league_games from anon, authenticated;

-- Weight of a player's result for the nation: new (provisional) players and players under 1000 Elo count half each
create or replace function public.league_weight(p public.profiles) returns numeric language sql immutable as $$
  select (case when p.games < 20 then 0.5 else 1 end) * (case when p.elo < 1000 then 0.5 else 1 end);
$$;

-- Called by finish_game for every rated game that changed Elo (p = profiles before the game)
create or replace function public.record_league_game(g public.games, pw public.profiles, pb public.profiles)
returns void language plpgsql security definer set search_path = public as $$
declare s text := public.current_season(); d date := (now() at time zone 'Europe/Berlin')::date;
  ew public.league_entries; eb public.league_entries; nw int; nb int; ws int;
begin
  if g.white_nation = g.black_nation then return; end if;            -- only games between different nations
  select * into ew from public.league_entries where season = s and user_id = g.white_id;
  select * into eb from public.league_entries where season = s and user_id = g.black_id;
  -- both must be in the league this season and play the nation they signed up with
  if ew.user_id is null or eb.user_id is null or ew.nation <> g.white_nation or eb.nation <> g.black_nation then return; end if;
  select count(*) into nw from public.league_games where day = d and
    ((white_id = g.white_id and w_ok) or (black_id = g.white_id and b_ok));
  select count(*) into nb from public.league_games where day = d and
    ((white_id = g.black_id and w_ok) or (black_id = g.black_id and b_ok));
  ws := case g.result when '1-0' then 3 when '0-1' then 0 else 1 end;
  insert into public.league_games (game_id, season, day, white_id, black_id, white_nation, black_nation,
      w_pts, b_pts, w_w, b_w, w_ok, b_ok)
    values (g.id, s, d, g.white_id, g.black_id, g.white_nation, g.black_nation,
      ws, case ws when 3 then 0 when 0 then 3 else 1 end,
      public.league_weight(pw), public.league_weight(pb), nw < 10, nb < 10)
    on conflict (game_id) do nothing;
end $$;

-- Players who look like they lose on purpose to help someone: at least 10 league games in the season,
-- at least 80 % lost, and at least half of them against the same opponent. Their games count for nobody.
create or replace function public.league_suspects(p_season text) returns setof uuid
language sql stable security definer set search_path = public as $$
  with sides as (
    select white_id uid, black_id opp, w_pts pts from public.league_games where season = p_season
    union all
    select black_id, white_id, b_pts from public.league_games where season = p_season
  ), per as (
    select uid, count(*) n, count(*) filter (where pts = 0) lost from sides where uid is not null group by uid
  ), top as (
    select uid, max(c) c from (select uid, opp, count(*) c from sides group by uid, opp) x group by uid
  )
  select per.uid from per join top using (uid)
  where per.n >= 10 and per.lost >= 0.8 * per.n and top.c >= 0.5 * per.n;
$$;

-- All counted player-sides of a season (suspects removed)
create or replace function public.league_sides(p_season text)
returns table (uid uuid, nation text, pts int, w numeric)
language sql stable security definer set search_path = public as $$
  with sus as (select * from public.league_suspects(p_season)),
  g as (select * from public.league_games where season = p_season
        and (white_id is null or white_id not in (select * from sus))
        and (black_id is null or black_id not in (select * from sus)))
  select white_id, white_nation, w_pts, w_w from g where w_ok
  union all
  select black_id, black_nation, b_pts, b_w from g where b_ok;
$$;

-- Public standings of a season: nations (ranked by weighted points per game) and players (by points)
create or replace function public.league_table(p_season text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (select coalesce(p_season, public.current_season()) season),
  sd as (select * from public.league_sides((select season from s))),
  nat as (
    select nation, count(*)::int games, sum(pts)::int points,
           round(sum(pts * w) / nullif(sum(w), 0), 2) ppg,
           (select count(*)::int from public.league_entries e where e.season = (select season from s) and e.nation = sd.nation) players
    from sd group by nation
  ),
  ply as (
    select sd.uid, p.username, e.nation, count(*)::int games, sum(sd.pts)::int points,
           round(sum(sd.pts)::numeric / count(*), 2) ppg
    from sd join public.profiles p on p.id = sd.uid
    join public.league_entries e on e.user_id = sd.uid and e.season = (select season from s)
    group by sd.uid, p.username, e.nation
  )
  select jsonb_build_object(
    'season', (select season from s),
    'nations', coalesce((select jsonb_agg(to_jsonb(nat) order by ppg desc nulls last, games desc) from nat), '[]'),
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', uid, 'username', username, 'nation', nation,
                 'games', games, 'points', points, 'ppg', ppg) order by points desc, ppg desc)
               from (select * from ply order by points desc, ppg desc limit 50) t), '[]'),
    'entries', (select count(*)::int from public.league_entries e where e.season = (select season from s))
  );
$$;

-- Hall of Fame: champion nation (at least 10 counted games) and best player (at least 5 games)
-- of every finished season, plus the all-time nation table
create or replace function public.hall_of_fame()
returns jsonb language sql stable security definer set search_path = public as $$
  with seasons as (select distinct season from public.league_games where season < public.current_season()),
  per as (
    select se.season,
      (select jsonb_build_object('nation', nation, 'ppg', round(sum(pts * w) / nullif(sum(w), 0), 2), 'games', count(*))
         from public.league_sides(se.season) group by nation having count(*) >= 10
         order by sum(pts * w) / nullif(sum(w), 0) desc, count(*) desc limit 1) champion,
      (select jsonb_build_object('username', p.username, 'nation', e.nation, 'points', sum(sd.pts), 'games', count(*))
         from public.league_sides(se.season) sd join public.profiles p on p.id = sd.uid
         join public.league_entries e on e.user_id = sd.uid and e.season = se.season
         group by p.username, e.nation having count(*) >= 5
         order by sum(sd.pts) desc, count(*) asc limit 1) best
    from seasons se
  ),
  allt as (
    select nation, count(*)::int games, round(sum(pts * w) / nullif(sum(w), 0), 2) ppg
    from seasons se, lateral public.league_sides(se.season) group by nation
  )
  select jsonb_build_object(
    'seasons', coalesce((select jsonb_agg(jsonb_build_object('season', season, 'champion', champion, 'best', best)
                 order by season desc) from per), '[]'),
    'titles', coalesce((select jsonb_agg(jsonb_build_object('nation', n, 'titles', c) order by c desc)
                 from (select champion->>'nation' n, count(*) c from per where champion is not null group by 1) t), '[]'),
    'alltime', coalesce((select jsonb_agg(to_jsonb(allt) order by ppg desc nulls last) from allt), '[]')
  );
$$;

revoke execute on function public.record_league_game(public.games, public.profiles, public.profiles) from public, anon, authenticated;
revoke execute on function public.league_suspects(text) from public, anon, authenticated;
revoke execute on function public.league_sides(text) from public, anon, authenticated;
revoke execute on function public.league_table(text) from public;
revoke execute on function public.hall_of_fame() from public;
grant execute on function public.league_table(text) to anon, authenticated;
grant execute on function public.hall_of_fame() to anon, authenticated;

-- finish_game from 005, now also recording league games
create or replace function public.finish_game(p_id uuid, p_result text, p_reason text)
returns public.games language plpgsql security definer set search_path = public as $$
declare
  g public.games; pw public.profiles; pb public.profiles;
  s numeric; ew numeric; kw int; kb int; dw int; db int;
  lo uuid; hi uuid; lo_white boolean;
begin
  select * into g from public.games where id = p_id for update;
  if not found or g.status = 'finished' then return g; end if;
  update public.games set status = 'finished', result = p_result, reason = p_reason, updated_at = now()
    where id = p_id returning * into g;
  if g.rated and p_result is not null and g.move_no < 20 then
    -- too short to say anything about strength (and the easiest way to farm Elo): no rating
    update public.games set elo_change = jsonb_build_object('w', 0, 'b', 0, 'short', true) where id = p_id returning * into g;
  elsif g.rated and p_result is not null then
    select * into pw from public.profiles where id = g.white_id for update;
    select * into pb from public.profiles where id = g.black_id for update;
    if pw.id is not null and pb.id is not null then
      s  := case p_result when '1-0' then 1 when '0-1' then 0 else 0.5 end;
      ew := 1 / (1 + power(10, (pb.elo - pw.elo) / 400.0));
      kw := case when pw.games < 20 then 40 else 20 end;
      kb := case when pb.games < 20 then 40 else 20 end;
      dw := round(kw * (s - ew));
      db := round(kb * ((1 - s) - (1 - ew)));
      update public.profiles set elo = elo + dw, games = games + 1,
        wins = wins + (s = 1)::int, draws = draws + (s = 0.5)::int, losses = losses + (s = 0)::int where id = pw.id;
      update public.profiles set elo = elo + db, games = games + 1,
        wins = wins + (s = 0)::int, draws = draws + (s = 0.5)::int, losses = losses + (s = 1)::int where id = pb.id;
      insert into public.rating_history (user_id, game_id, opponent_id, elo_before, elo_after) values
        (pw.id, g.id, pb.id, pw.elo, pw.elo + dw), (pb.id, g.id, pw.id, pb.elo, pb.elo + db);
      update public.games set elo_change = jsonb_build_object('w', dw, 'b', db) where id = p_id returning * into g;
      perform public.record_league_game(g, pw, pb);
    end if;
  elsif not g.rated and p_result is not null and g.white_id is not null and g.black_id is not null
        and g.white_id <> g.black_id then
    lo_white := g.white_id < g.black_id;
    lo := least(g.white_id, g.black_id); hi := greatest(g.white_id, g.black_id);
    insert into public.friend_records (a, b, a_wins, b_wins, draws) values (lo, hi,
      ((p_result = '1-0' and lo_white) or (p_result = '0-1' and not lo_white))::int,
      ((p_result = '0-1' and lo_white) or (p_result = '1-0' and not lo_white))::int,
      (p_result = '1/2')::int)
    on conflict (a, b) do update set
      a_wins = friend_records.a_wins + excluded.a_wins, b_wins = friend_records.b_wins + excluded.b_wins,
      draws = friend_records.draws + excluded.draws, updated_at = now();
  end if;
  return g;
end $$;
revoke execute on function public.finish_game(uuid, text, text) from public, anon, authenticated;
