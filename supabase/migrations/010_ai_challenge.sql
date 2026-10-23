-- 010: "Beat the AI" challenge. Signed-in players can play the Normal AI with the AI's moves computed by the edge
-- function: every player move is checked there and the AI answers on the server, so a win cannot be faked by a modified
-- client. Wins appear in a public hall of fame. Only the edge function writes here.
create table if not exists public.ai_games (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  white_nation text not null,
  black_nation text not null,
  moves       text[] not null default '{}',
  status      text not null default 'active' check (status in ('active', 'won', 'lost', 'draw', 'resigned')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ai_games_user on public.ai_games (user_id, status);
create index if not exists ai_games_won on public.ai_games (status) where status = 'won';
-- no policies: only the edge function (service connection) reads and writes it
alter table public.ai_games enable row level security;

-- Hall of fame: everyone who has beaten the Normal AI, with the shortest win (player moves) and the first win;
-- plus how many challenge games were finished and won in total (for "x % lose to this AI")
create or replace function public.ai_hall()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'players', coalesce((select jsonb_agg(x order by x.best, x.first) from (
        select p.username, count(*)::int as wins, min((cardinality(g.moves) + 1) / 2)::int as best, min(g.finished_at) as first
        from public.ai_games g join public.profiles p on p.id = g.user_id
        where g.status = 'won' group by p.username) x), '[]'::jsonb),
    'finished', (select count(*) from public.ai_games where status in ('won', 'lost', 'draw', 'resigned')
                 and cardinality(moves) >= 2),
    'won', (select count(*) from public.ai_games where status = 'won'));
$$;
revoke execute on function public.ai_hall() from public;
grant execute on function public.ai_hall() to anon, authenticated;
