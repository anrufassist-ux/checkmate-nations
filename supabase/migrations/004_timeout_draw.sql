-- Checkmate Nations: flag fall is a draw when the side with time left cannot mate at all
-- (bare king, king + bishop, king + knight). Run after 003. Safe to run again.
create or replace function public.check_clock(p_id uuid)
returns public.games language plpgsql security definer set search_path = public as $$
declare g public.games; side text; left_ms numeric; rest text;
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
    -- pieces of the side that still has time, without its king
    rest := regexp_replace(split_part(g.fen, ' ', 1), case side when 'w' then '[^a-jl-z]' else '[^A-JL-Z]' end, '', 'g');
    if rest = '' or rest ~ '^[bnBN]$' then return public.finish_game(g.id, '1/2', 'timeout-draw'); end if;
    return public.finish_game(g.id, case side when 'w' then '0-1' else '1-0' end, 'timeout');
  end if;
  return g;
end $$;
revoke execute on function public.check_clock(uuid) from public, anon, authenticated;
