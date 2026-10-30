-- 012: the puzzle level (kid / mid / pro) belongs to the account, like the puzzle rating. Picking a level on an account
-- starts the rating again at that level's value (edge function action pz_level).
alter table public.puzzle_stats add column if not exists lvl text check (lvl in ('kid','mid','pro'));
