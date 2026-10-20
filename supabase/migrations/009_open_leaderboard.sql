-- 009: open leaderboard for the start. Everyone with at least one counted rated game is listed (was: 5 different
-- opponents). Farming stays limited by the weekly pair limit and short games not counting; "?" marks provisional ratings.
create or replace function public.leaderboard()
returns table (id uuid, username text, elo int, games int, opponents int)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.elo, p.games, o.n::int
  from public.profiles p
  join (select user_id, count(distinct opponent_id) n from public.rating_history
        where opponent_id is not null group by user_id) o on o.user_id = p.id
  order by p.elo desc limit 50;
$$;
revoke execute on function public.leaderboard() from public;
grant execute on function public.leaderboard() to anon, authenticated;
