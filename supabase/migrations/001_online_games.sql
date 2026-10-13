-- Checkmate Nations: online games, phase 1 (guest friendly games by code, server-validated moves).
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Safe to run again.

create table if not exists public.games (
  id            uuid primary key default gen_random_uuid(),
  code          text unique check (code ~ '^[A-Z2-9]{4}$'),
  white_id      uuid references auth.users (id) on delete set null,
  black_id      uuid references auth.users (id) on delete set null,
  white_nation  text not null default 'usa',
  black_nation  text not null default 'rus',
  status        text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  rated         boolean not null default false,
  fen           text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves         text[] not null default '{}',          -- UCI moves like e2e4, e7e8q
  move_no       int not null default 0,
  last_move     jsonb,                                 -- {"from":"e2","to":"e4","promotion":null}
  caps          jsonb not null default '{"w":[],"b":[]}', -- pieces captured by white / by black
  epoch         int not null default 1,                -- +1 on every rematch
  result        text check (result in ('1-0', '0-1', '1/2')),
  reason        text,                                  -- mate, resign, stalemate, repetition, ...
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists games_white_idx on public.games (white_id);
create index if not exists games_black_idx on public.games (black_id);
create index if not exists games_updated_idx on public.games (updated_at);

-- Players may only read their own games. Nobody writes directly: every change goes through the
-- "game" edge function, which checks each move with chess.js on the server.
alter table public.games enable row level security;
drop policy if exists "players read own games" on public.games;
create policy "players read own games" on public.games
  for select to authenticated
  using ((select auth.uid()) = white_id or (select auth.uid()) = black_id);
revoke insert, update, delete, truncate on public.games from anon, authenticated;

-- Live updates for the opponent's moves
do $$ begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null; end $$;

-- Nightly clean-up: games untouched for 14 days, guests without a recent game after 30 days
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'checkmate-cleanup';
select cron.schedule('checkmate-cleanup', '17 3 * * *', $job$
  delete from public.games where updated_at < now() - interval '14 days';
  delete from auth.users u
   where u.is_anonymous
     and u.created_at < now() - interval '30 days'
     and not exists (select 1 from public.games g
                      where (g.white_id = u.id or g.black_id = u.id)
                        and g.updated_at > now() - interval '30 days');
$job$);
