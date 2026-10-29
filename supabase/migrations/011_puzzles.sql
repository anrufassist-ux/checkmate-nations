-- 011: puzzle rating for signed-in players, plus a public puzzle ranking. Guests keep their puzzle rating in the browser
-- only (localStorage wms-pz). The edge function computes every rating change itself from the puzzle's own rating in
-- vendor/puzzles.json (looked up by FEN), so a client can only report solved / not solved, never a rating.
-- Only the edge function writes here.
create table if not exists public.puzzle_stats (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  rating      real not null default 900,
  played      int  not null default 0,
  solved      int  not null default 0,
  streak      int  not null default 0,
  best_streak int  not null default 0,
  day         date not null default current_date,
  day_count   int  not null default 0,   -- results today, capped by the function
  updated_at  timestamptz not null default now()
);
-- no policies: only the edge function (service connection) reads and writes it
alter table public.puzzle_stats enable row level security;

-- Puzzle ranking: everyone with at least 10 puzzles played and a player name, best 100
create or replace function public.puzzle_board()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.rating desc), '[]'::jsonb) from (
    select p.id, p.username, round(s.rating)::int as rating, s.solved, s.played, s.best_streak
    from public.puzzle_stats s join public.profiles p on p.id = s.user_id
    where s.played >= 10 order by s.rating desc limit 100) x;
$$;
revoke execute on function public.puzzle_board() from public;
grant execute on function public.puzzle_board() to anon, authenticated;
