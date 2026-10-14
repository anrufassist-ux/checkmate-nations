-- Checkmate Nations: fairer rating. Run after 004. Safe to run again.
-- 1. Games shorter than 10 moves per side (20 half-moves) never change Elo.
-- 2. The leaderboard only lists players with rated games against at least 5 different opponents.

alter table public.rating_history add column if not exists opponent_id uuid references auth.users (id) on delete set null;

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

-- Public leaderboard: top 50 with at least 5 different rated opponents
create or replace function public.leaderboard()
returns table (id uuid, username text, elo int, games int, opponents int)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.elo, p.games, o.n::int
  from public.profiles p
  join (select user_id, count(distinct opponent_id) n from public.rating_history
        where opponent_id is not null group by user_id) o on o.user_id = p.id
  where o.n >= 5
  order by p.elo desc limit 50;
$$;
revoke execute on function public.leaderboard() from public;
grant execute on function public.leaderboard() to anon, authenticated;
