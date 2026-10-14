-- Checkmate Nations, phase 2b: head-to-head record for friendly code games (never public, never rated).
-- Run after 002 in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Safe to run again.

-- One row per pair of players, the smaller id first; counts finished friendly games between them
create table if not exists public.friend_records (
  a       uuid not null references auth.users (id) on delete cascade,
  b       uuid not null references auth.users (id) on delete cascade,
  a_wins  int not null default 0,
  b_wins  int not null default 0,
  draws   int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
alter table public.friend_records enable row level security;
drop policy if exists "own friend records" on public.friend_records;
create policy "own friend records" on public.friend_records for select to authenticated
  using ((select auth.uid()) = a or (select auth.uid()) = b);
revoke insert, update, delete, truncate on public.friend_records from anon, authenticated;

-- finish_game from 002, now also counting friendly games into friend_records
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
