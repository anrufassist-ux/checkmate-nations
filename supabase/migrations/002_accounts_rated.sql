-- Checkmate Nations, phase 2: accounts with player names, rated games (10 min + 5 s) via matchmaking, Elo.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Safe to run again.

-- Player profiles: only for confirmed e-mail accounts, never for guests. Public read (leaderboard).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  elo         int not null default 1200,
  games       int not null default 0,
  wins        int not null default 0,
  draws       int not null default 0,
  losses      int not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists profiles_username_idx on public.profiles (lower(username));
create index if not exists profiles_elo_idx on public.profiles (elo desc);
alter table public.profiles enable row level security;
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;

create table if not exists public.rating_history (
  id          bigserial primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  game_id     uuid references public.games (id) on delete set null,
  elo_before  int not null,
  elo_after   int not null,
  created_at  timestamptz not null default now()
);
create index if not exists rating_history_user_idx on public.rating_history (user_id, created_at);
alter table public.rating_history enable row level security;
drop policy if exists "own rating history" on public.rating_history;
create policy "own rating history" on public.rating_history for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete, truncate on public.rating_history from anon, authenticated;

-- Matchmaking queue: no client access at all, only the edge function touches it
create table if not exists public.match_queue (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  elo        int not null,
  nation     text not null,
  joined_at  timestamptz not null default now(),
  seen_at    timestamptz not null default now()
);
alter table public.match_queue enable row level security;
revoke all on public.match_queue from anon, authenticated;

-- Clocks for rated games (milliseconds left; the side to move has been thinking since turn_started_at)
alter table public.games add column if not exists white_ms int;
alter table public.games add column if not exists black_ms int;
alter table public.games add column if not exists increment_ms int not null default 0;
alter table public.games add column if not exists turn_started_at timestamptz;
alter table public.games add column if not exists elo_change jsonb;          -- {"w": +12, "b": -12}
create index if not exists games_active_rated_idx on public.games (status) where rated;

-- Ends a game once. Rated games with a result update both players' Elo (start 1200, K 40 for the
-- first 20 games, then 20). A null result means aborted: no Elo, nothing counted.
create or replace function public.finish_game(p_id uuid, p_result text, p_reason text)
returns public.games language plpgsql security definer set search_path = public as $$
declare
  g public.games; pw public.profiles; pb public.profiles;
  s numeric; ew numeric; kw int; kb int; dw int; db int;
begin
  select * into g from public.games where id = p_id for update;
  if not found or g.status = 'finished' then return g; end if;
  update public.games set status = 'finished', result = p_result, reason = p_reason, updated_at = now()
    where id = p_id returning * into g;
  if g.rated and p_result is not null then
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
      insert into public.rating_history (user_id, game_id, elo_before, elo_after) values
        (pw.id, g.id, pw.elo, pw.elo + dw), (pb.id, g.id, pb.elo, pb.elo + db);
      update public.games set elo_change = jsonb_build_object('w', dw, 'b', db) where id = p_id returning * into g;
    end if;
  end if;
  return g;
end $$;

-- Flag fall and abort check for one rated game: no first move within 60 s -> aborted,
-- clock of the side to move at zero -> that side loses on time.
create or replace function public.check_clock(p_id uuid)
returns public.games language plpgsql security definer set search_path = public as $$
declare g public.games; side text; left_ms numeric;
begin
  select * into g from public.games where id = p_id for update;
  if not found or g.status <> 'active' or not g.rated or g.turn_started_at is null then return g; end if;
  side := split_part(g.fen, ' ', 2);
  if g.move_no < 2 then
    if now() - g.turn_started_at > interval '60 seconds' then return public.finish_game(g.id, null, 'aborted'); end if;
    return g;
  end if;
  left_ms := (case side when 'w' then g.white_ms else g.black_ms end) - extract(epoch from now() - g.turn_started_at) * 1000;
  if left_ms <= 0 then
    return public.finish_game(g.id, case side when 'w' then '0-1' else '1-0' end, 'timeout');
  end if;
  return g;
end $$;

-- Every minute: settle games where a player simply left
create or replace function public.sweep_clocks()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.games where status = 'active' and rated loop
    if (public.check_clock(r.id)).status = 'finished' then n := n + 1; end if;
  end loop;
  delete from public.match_queue where seen_at < now() - interval '2 minutes';
  return n;
end $$;

revoke execute on function public.finish_game(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.check_clock(uuid) from public, anon, authenticated;
revoke execute on function public.sweep_clocks() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'checkmate-clocks';
select cron.schedule('checkmate-clocks', '* * * * *', $job$ select public.sweep_clocks(); $job$);
