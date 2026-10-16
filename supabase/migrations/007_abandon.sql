-- 007: abandoned rated games. While a player has a running rated game open, the client pings the edge function
-- every 15 s; the opponent may claim the win once the other side has been gone for 2 minutes (`abandon` action).
create table if not exists public.game_seen (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null,
  seen_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
-- no policies: only the edge function (service connection) reads and writes it
alter table public.game_seen enable row level security;
