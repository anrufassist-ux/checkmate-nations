-- Search for league opponents only: players in the Nations League can ask the matchmaker to pair them only with
-- other league players (each with the nation they signed up with, nations different), so the game counts.
alter table public.match_queue add column if not exists league_only boolean not null default false;
