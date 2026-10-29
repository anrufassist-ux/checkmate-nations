// Checkmate Nations: the only way to change a game. Every move is replayed and checked with chess.js
// on the server, so a modified client cannot play illegal moves, move for the opponent, fake a result
// or stop its clock. Rated games (15 min + 10 s) only come from matchmaking; Elo and the Nations League
// are settled in SQL. Purchases go through Stripe Checkout and are granted here once Stripe says "paid".
// Deploy as edge function "game" (JWT verification off: this function checks the user itself).
import postgres from "npm:postgres@3.4.5";
import { Chess } from "npm:chess.js@0.10.3";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 4, idle_timeout: 20 });
const AUTH_USER_URL = Deno.env.get("SUPABASE_URL") + "/auth/v1/user";
const FREE_NATIONS = ["usa", "rus"];
const PAID_NATIONS = ["eu", "ger", "isr", "irn", "chn", "ind", "gbr", "bra", "fra", "pol"];
const ALL_NATIONS = new Set([...FREE_NATIONS, ...PAID_NATIONS]);
const STRIPE_API = Deno.env.get("STRIPE_API") || "https://api.stripe.com";
const PRICES: Record<string, number> = { bundle3: 299, all: 499, pass: 99 }; // cents, no VAT (§ 19 UStG)
const RETURN_OK = /^https:\/\/((www\.)?checkmatenations\.com|[a-z0-9-]+-anrufassist-uxs-projects\.vercel\.app)\//;
const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SQ = /^[a-h][1-8]$/;
const BASE_MS = 900_000, INC_MS = 10_000, FIRST_MOVE_MS = 60_000, GONE_MS = 120_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAIR_GAMES_PER_WEEK = 3; // the same two players can't farm Elo off each other

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (error: string, status: number, game?: Game) => reply({ error, game: game && view(game) }, status);

// deno-lint-ignore no-explicit-any
type Game = Record<string, any>;
type User = { id: string; is_anonymous?: boolean; email?: string; email_confirmed_at?: string | null };

async function currentUser(req: Request): Promise<User | null> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(AUTH_USER_URL, { headers: { Authorization: auth, apikey: req.headers.get("apikey") || "" } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && typeof u.id === "string" ? u : null;
}
const registered = (u: User) => !u.is_anonymous && !!u.email && !!u.email_confirmed_at;

const view = (g: Game) => ({
  id: g.id, code: g.code, white: g.white_id, black: g.black_id,
  nations: { w: g.white_nation, b: g.black_nation }, status: g.status, fen: g.fen,
  moveNo: g.move_no, last: g.last_move, caps: g.caps, epoch: g.epoch, result: g.result, reason: g.reason,
  rated: g.rated, eloChange: g.elo_change,
  clock: g.rated ? { w: g.white_ms, b: g.black_ms, inc: g.increment_ms, turnStartedAt: g.turn_started_at } : null,
  serverNow: Date.now(),
});
const seatOf = (g: Game, uid: string) => (g.white_id === uid ? "w" : g.black_id === uid ? "b" : null);
// deno-lint-ignore no-explicit-any
const lockGame = async (tx: any, id: unknown) =>
  (await tx`select *, extract(epoch from now() - turn_started_at) * 1000 as elapsed_ms
            from public.games where id = ${String(id)} for update`)[0] as Game | undefined;
// deno-lint-ignore no-explicit-any
const finish = async (tx: any, id: string, result: string | null, reason: string) =>
  (await tx`select * from public.finish_game(${id}, ${result}, ${reason})`)[0] as Game;

function replay(moves: string[]) {
  const c = new Chess();
  for (const m of moves) {
    if (!c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] || undefined })) throw new Error("corrupt history");
  }
  return c;
}
function outcome(c: InstanceType<typeof Chess>, mover: "w" | "b") {
  if (c.in_checkmate()) return { result: mover === "w" ? "1-0" : "0-1", reason: "mate" };
  if (c.in_stalemate()) return { result: "1/2", reason: "stalemate" };
  if (c.in_threefold_repetition()) return { result: "1/2", reason: "repetition" };
  if (c.insufficient_material()) return { result: "1/2", reason: "material" };
  if (c.in_draw()) return { result: "1/2", reason: "fifty-moves" };
  return null;
}

// Flag fall: the side without time loses, unless the other side cannot mate at all (bare king,
// king + bishop or king + knight), then it is a draw. Same rule as check_clock() in SQL.
function onTime(fen: string, loser: string) {
  const board = fen.split(" ")[0];
  const rest = (loser === "w" ? board.replace(/[^a-z]/g, "") : board.replace(/[^A-Z]/g, "")).replace(/k/i, "");
  if (rest === "" || /^[bn]$/i.test(rest)) return { result: "1/2", reason: "timeout-draw" };
  return { result: loser === "w" ? "0-1" : "1-0", reason: "timeout" };
}

// ---------- friendly games by code (guests welcome, never rated) ----------
async function create(u: User, body: Game) {
  const w = String(body.w || "usa"), b = String(body.b || "rus");
  const mine = await ownedNations(sql, u.id); // the creator may also hand an owned nation to the friend
  if (!mine.includes(w) || !mine.includes(b)) return fail("nation not owned", 403);
  if (w === b) return fail("both sides need different nations", 400);
  for (let i = 0; i < 8; i++) {
    let code = "";
    for (let k = 0; k < 4; k++) code += CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)];
    const rows = await sql`insert into public.games (code, white_id, white_nation, black_nation)
      values (${code}, ${u.id}, ${w}, ${b}) on conflict (code) do nothing returning *`;
    if (rows.length) return reply({ game: view(rows[0]), seat: "w" });
  }
  return fail("no free game code, try again", 503);
}

function join(u: User, body: Game) {
  const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z2-9]{4}$/.test(code)) return fail("bad code", 400);
  return sql.begin(async (tx) => {
    const [g] = await tx`select * from public.games where code = ${code} for update`;
    if (!g) return fail("not found", 404);
    const seat = seatOf(g, u.id);
    if (seat) return reply({ game: view(g), seat });
    if (g.black_id) return fail("full", 409);
    const [n] = await tx`update public.games set black_id = ${u.id},
      status = case when status = 'waiting' then 'active' else status end, updated_at = now()
      where id = ${g.id} returning *`;
    return reply({ game: view(n), seat: "b" });
  });
}

// ---------- moves, resign, rematch, flag fall ----------
function move(u: User, body: Game) {
  const from = String(body.from || ""), to = String(body.to || "");
  const promotion = body.promotion ? String(body.promotion) : "";
  if (!SQ.test(from) || !SQ.test(to) || (promotion && !/^[qrbn]$/.test(promotion))) return fail("bad move", 400);
  return sql.begin(async (tx) => {
    const g = await lockGame(tx, body.id);
    if (!g) return fail("not found", 404);
    const seat = seatOf(g, u.id);
    if (!seat) return fail("not your game", 403);
    if (g.status !== "active") return fail("game not running", 409, g);
    if (Number(body.moveNo) !== g.move_no) return fail("out of sync", 409, g);
    const c = replay(g.moves);
    if (c.turn() !== seat) return fail("not your turn", 409, g);
    // clock: the first move of each side has 60 s and costs no time; after that the clock runs
    let myMs: number | null = null;
    if (g.rated) {
      const elapsed = Number(g.elapsed_ms) || 0;
      if (g.move_no < 2) {
        if (elapsed > FIRST_MOVE_MS) return fail("time", 409, await finish(tx, g.id, null, "aborted"));
        myMs = seat === "w" ? g.white_ms : g.black_ms;
      } else {
        const left = (seat === "w" ? g.white_ms : g.black_ms) - elapsed;
        if (left <= 0) { const t = onTime(g.fen, seat); return fail("time", 409, await finish(tx, g.id, t.result, t.reason)); }
        myMs = Math.round(left + g.increment_ms);
      }
    }
    const res = c.move({ from, to, promotion: promotion || undefined });
    if (!res) return fail("illegal move", 400, g);
    const caps = { w: [...(g.caps?.w || [])], b: [...(g.caps?.b || [])] };
    if (res.captured) caps[seat].push(res.captured);
    const uci = res.from + res.to + (res.promotion || "");
    let [n] = await tx`update public.games set
      moves = array_append(moves, ${uci}), move_no = move_no + 1, fen = ${c.fen()},
      last_move = ${tx.json({ from: res.from, to: res.to, promotion: res.promotion || null })},
      caps = ${tx.json(caps)}, updated_at = now(),
      white_ms = case when ${seat} = 'w' and rated then ${myMs} else white_ms end,
      black_ms = case when ${seat} = 'b' and rated then ${myMs} else black_ms end,
      turn_started_at = case when rated then now() else turn_started_at end
      where id = ${g.id} returning *`;
    const end = outcome(c, seat);
    if (end) n = await finish(tx, g.id, end.result, end.reason);
    return reply({ game: view(n) });
  });
}

function resign(u: User, body: Game) {
  return sql.begin(async (tx) => {
    const g = await lockGame(tx, body.id);
    if (!g) return fail("not found", 404);
    const seat = seatOf(g, u.id);
    if (!seat) return fail("not your game", 403);
    if (g.status === "finished") return reply({ game: view(g) });
    // giving up a rated game before both sides moved only aborts it (no free Elo for a friend)
    const n = g.rated && g.move_no < 2
      ? await finish(tx, g.id, null, "aborted")
      : await finish(tx, g.id, seat === "w" ? "0-1" : "1-0", "resign");
    return reply({ game: view(n) });
  });
}

function claim(u: User, body: Game) { // "your clock is at zero": the server checks with its own time
  return sql.begin(async (tx) => {
    const g = await lockGame(tx, body.id);
    if (!g) return fail("not found", 404);
    if (!seatOf(g, u.id)) return fail("not your game", 403);
    const [n] = await tx`select * from public.check_clock(${g.id})`;
    return reply({ game: view(n) });
  });
}

// ---------- abandoned games: clients ping while a rated game is open, the opponent can claim after 2 minutes ----------
async function ping(u: User, body: Game) {
  const id = String(body.id || "");
  if (!UUID.test(id)) return fail("bad id", 400);
  await sql`insert into public.game_seen (game_id, user_id)
    select id, ${u.id} from public.games where id = ${id} and status = 'active' and ${u.id} in (white_id, black_id)
    on conflict (game_id, user_id) do update set seen_at = now()`;
  return reply({ ok: true });
}

function abandon(u: User, body: Game) {
  if (!UUID.test(String(body.id || ""))) return fail("bad id", 400);
  return sql.begin(async (tx) => {
    const g = await lockGame(tx, body.id);
    if (!g) return fail("not found", 404);
    const seat = seatOf(g, u.id);
    if (!seat) return fail("not your game", 403);
    if (g.status !== "active" || !g.rated) return fail("game not running", 409, g);
    const opp = seat === "w" ? g.black_id : g.white_id;
    // last sign of the opponent: a ping, a move (turn_started_at) or the start of the game
    const [s] = await tx`select extract(epoch from now() - greatest(
        coalesce((select seen_at from public.game_seen where game_id = ${g.id} and user_id = ${opp}), '-infinity'),
        coalesce(turn_started_at, '-infinity'), created_at)) * 1000 as gone
      from public.games where id = ${g.id}`;
    if (Number(s.gone) < GONE_MS) return fail("opponent still here", 409, g);
    const n = g.move_no < 2
      ? await finish(tx, g.id, null, "aborted")
      : await finish(tx, g.id, seat === "w" ? "1-0" : "0-1", "abandon");
    return reply({ game: view(n) });
  });
}

function rematch(u: User, body: Game) {
  return sql.begin(async (tx) => {
    const g = await lockGame(tx, body.id);
    if (!g) return fail("not found", 404);
    if (!seatOf(g, u.id)) return fail("not your game", 403);
    if (g.rated) return fail("rated games have no rematch", 409, g);
    if (g.status !== "finished") return fail("game still running", 409, g);
    const [n] = await tx`update public.games set fen = default, moves = '{}', move_no = 0, last_move = null,
      caps = default, status = 'active', result = null, reason = null, epoch = epoch + 1, updated_at = now()
      where id = ${g.id} returning *`;
    return reply({ game: view(n) });
  });
}

// ---------- accounts ----------
async function profile(u: User, body: Game) {
  if (!registered(u)) return fail("account needed", 403);
  const name = String(body.username || "").trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return fail("bad name", 400);
  try {
    const [p] = await sql`insert into public.profiles (id, username) values (${u.id}, ${name})
      on conflict (id) do update set username = excluded.username returning *`;
    return reply({ profile: p });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return fail("name taken", 409);
    throw e;
  }
}

async function deleteAccount(u: User) {
  await sql`delete from public.match_queue where user_id = ${u.id}`;
  await sql`delete from auth.users where id = ${u.id}`; // profile and rating history go with it
  return reply({ deleted: true });
}

// ---------- matchmaking for rated games ----------
async function queue(u: User, body: Game) {
  if (!registered(u)) return fail("account needed", 403);
  const [p] = await sql`select * from public.profiles where id = ${u.id}`;
  if (!p) return fail("no profile", 412);
  const owned = await ownedNations(sql, u.id);
  const nation = String(body.nation || "usa");
  if (!owned.includes(nation)) return fail("nation not owned", 403);
  // in the league with this nation: such games can count; league_only = pair only with league opponents
  const s = await season();
  const [entry] = await sql`select nation from public.league_entries where season = ${s} and user_id = ${u.id}`;
  const inLeague = !!entry && entry.nation === nation;
  const leagueOnly = !!body.league;
  if (leagueOnly && !inLeague) return fail("not in league with this nation", 403);
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(4711)`; // one matcher at a time
    const [cur] = await tx`select * from public.games where rated and status = 'active'
      and (white_id = ${u.id} or black_id = ${u.id}) limit 1`;
    if (cur) {
      await tx`delete from public.match_queue where user_id = ${u.id}`;
      return reply({ game: view(cur), seat: seatOf(cur, u.id) });
    }
    const [me] = await tx`insert into public.match_queue (user_id, elo, nation, league_only) values (${u.id}, ${p.elo}, ${nation}, ${leagueOnly})
      on conflict (user_id) do update set seen_at = now(), elo = excluded.elo, nation = excluded.nation, league_only = excluded.league_only returning *`;
    // the Elo window widens the longer both have been waiting
    const [opp] = await tx`select q.* from public.match_queue q
      where q.user_id <> ${u.id} and q.seen_at > now() - interval '12 seconds'
        and abs(q.elo - ${p.elo}) <= 150 + 10 * extract(epoch from now() - least(q.joined_at, ${me.joined_at}))
        and (select count(*) from public.games x where x.rated and x.created_at > now() - interval '7 days' and x.reason is distinct from 'aborted'
             and coalesce((x.elo_change->>'short')::boolean, false) = false
             and ((x.white_id = q.user_id and x.black_id = ${u.id}) or (x.white_id = ${u.id} and x.black_id = q.user_id)))
            < ${PAIR_GAMES_PER_WEEK}
        and ((not ${leagueOnly} and not q.league_only) or (${inLeague} and q.nation <> ${nation} and exists (select 1
             from public.league_entries e where e.season = ${s} and e.user_id = q.user_id and e.nation = q.nation)))
      order by (${inLeague} and q.nation <> ${nation} and exists (select 1 from public.league_entries e
               where e.season = ${s} and e.user_id = q.user_id and e.nation = q.nation)) desc,
        (q.nation = ${nation}), q.joined_at limit 1`; // prefer a league game, then an opponent with another nation
    if (!opp) {
      // someone else is searching but we already played them often enough this week: say so instead of waiting forever
      const [lim] = await tx`select 1 from public.match_queue q
        where q.user_id <> ${u.id} and q.seen_at > now() - interval '12 seconds'
          and (select count(*) from public.games x where x.rated and x.created_at > now() - interval '7 days' and x.reason is distinct from 'aborted'
               and coalesce((x.elo_change->>'short')::boolean, false) = false
               and ((x.white_id = q.user_id and x.black_id = ${u.id}) or (x.white_id = ${u.id} and x.black_id = q.user_id)))
              >= ${PAIR_GAMES_PER_WEEK} limit 1`;
      return reply({ waiting: true, searching: await countSearching(tx), pairLimit: !!lim });
    }
    await tx`delete from public.match_queue where user_id in (${u.id}, ${opp.user_id})`;
    const meWhite = Math.random() < 0.5;
    const [wid, bid] = meWhite ? [u.id, opp.user_id] : [opp.user_id, u.id];
    // the player who waited longer keeps their nation; the newcomer gets the other one if both picked the same
    const mine = nation !== opp.nation ? nation : (opp.nation === "usa" ? "rus" : "usa");
    const wn = meWhite ? mine : opp.nation;
    const bn = meWhite ? opp.nation : mine;
    const [g] = await tx`insert into public.games (white_id, black_id, white_nation, black_nation, status, rated,
      white_ms, black_ms, increment_ms, turn_started_at)
      values (${wid}, ${bid}, ${wn}, ${bn}, 'active', true, ${BASE_MS}, ${BASE_MS}, ${INC_MS}, now()) returning *`;
    return reply({ game: view(g), seat: meWhite ? "w" : "b" });
  });
}

// Does this rated game count for the league, and if not, why? After the end also the points it brought.
async function leagueStatus(u: User, body: Game) {
  const [g] = await sql`select * from public.games where id = ${String(body.id || "")}
    and (white_id = ${u.id} or black_id = ${u.id})`;
  if (!g || !g.rated) return reply({ league: false, why: "unrated" });
  const s = await season();
  const es = await sql`select user_id, nation from public.league_entries where season = ${s}
    and user_id in (${g.white_id}, ${g.black_id})`;
  const w = g.white_id === u.id;
  const [myNation, oppNation] = w ? [g.white_nation, g.black_nation] : [g.black_nation, g.white_nation];
  const mine = es.find((e: { user_id: string }) => e.user_id === u.id);
  const theirs = es.find((e: { user_id: string }) => e.user_id === (w ? g.black_id : g.white_id));
  const why = !mine ? "me" : mine.nation !== myNation ? "my_nation" : !theirs || theirs.nation !== oppNation ? "opp"
    : myNation === oppNation ? "same" : null;
  const [lg] = await sql`select * from public.league_games where game_id = ${g.id}`;
  return reply({ league: !why, why, nation: myNation, entry: mine ? mine.nation : null,
    counted: lg ? { pts: w ? lg.w_pts : lg.b_pts, ok: w ? lg.w_ok : lg.b_ok } : null });
}

// how many players are looking for a rated game right now (shown in the lobby)
// deno-lint-ignore no-explicit-any
const countSearching = async (q: any) =>
  Number((await q`select count(*)::int as n from public.match_queue where seen_at > now() - interval '12 seconds'`)[0].n);
const stats = async () => reply({ searching: await countSearching(sql) });

async function unqueue(u: User) {
  await sql`delete from public.match_queue where user_id = ${u.id}`;
  return reply({ ok: true });
}

// ---------- shop: what a player owns, Stripe Checkout ----------
// deno-lint-ignore no-explicit-any
async function ownedNations(q: any, uid: string): Promise<string[]> {
  // "all nations" includes every nation added later
  const [all] = await q`select 1 from public.checkouts where user_id = ${uid} and product = 'all' and status = 'paid' limit 1`;
  if (all) return [...FREE_NATIONS, ...PAID_NATIONS];
  const rows = await q`select nation from public.owned_nations where user_id = ${uid}`;
  return [...FREE_NATIONS, ...rows.map((r: Game) => r.nation)];
}
const season = async () => (await sql`select public.current_season() s`)[0].s as string;

async function stripe(path: string, form?: URLSearchParams) {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  const r = await fetch(STRIPE_API + path, {
    method: form ? "POST" : "GET",
    headers: { Authorization: "Bearer " + key, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form,
  });
  const j = await r.json();
  if (!r.ok) throw new Error("stripe " + r.status + ": " + JSON.stringify(j.error || j));
  return j;
}

// Ask Stripe about this player's open checkouts and grant what was paid (safe to call often)
async function syncPurchases(uid: string) {
  const open = await sql`select session_id from public.checkouts where user_id = ${uid} and status = 'open'
    and created_at > now() - interval '3 days'`;
  for (const { session_id } of open) {
    let cs;
    try { cs = await stripe("/v1/checkout/sessions/" + encodeURIComponent(session_id)); } catch (e) { console.error(e); continue; }
    if (cs.payment_status === "paid") {
      await sql.begin(async (tx) => {
        const [c] = await tx`update public.checkouts set status = 'paid', paid_at = now()
          where session_id = ${session_id} and status = 'open' returning *`;
        if (!c) return; // granted already
        if (c.product === "pass") {
          await tx`insert into public.league_passes (user_id, season, session_id) values (${uid}, ${c.season}, ${session_id})
            on conflict do nothing`;
        } else {
          for (const n of c.nations) {
            await tx`insert into public.owned_nations (user_id, nation, session_id) values (${uid}, ${n}, ${session_id})
              on conflict do nothing`;
          }
        }
      });
    } else if (cs.status === "expired") {
      await sql`update public.checkouts set status = 'expired' where session_id = ${session_id} and status = 'open'`;
    }
  }
}

// League access this season: any bought nation, or a league pass for this season
async function shopState(uid: string) {
  const s = await season();
  const owned = await ownedNations(sql, uid);
  const [pass] = await sql`select 1 from public.league_passes where user_id = ${uid} and season = ${s}`;
  const [entry] = await sql`select nation, joined_at from public.league_entries where season = ${s} and user_id = ${uid}`;
  return { season: s, owned, pass: !!pass, access: !!pass || owned.length > FREE_NATIONS.length, entry: entry || null };
}

async function me(u: User) {
  if (!registered(u)) return reply({ season: await season(), owned: FREE_NATIONS, pass: false, access: false, entry: null });
  await syncPurchases(u.id);
  return reply(await shopState(u.id));
}

async function checkout(u: User, body: Game) {
  if (!registered(u)) return fail("account needed", 403);
  if (body.consent !== true) return fail("consent needed", 400);
  const product = String(body.product || "");
  if (!(product in PRICES)) return fail("bad product", 400);
  const st = await shopState(u.id);
  let nations: string[] = [];
  let name = "";
  if (product === "bundle3") {
    nations = [...new Set((Array.isArray(body.nations) ? body.nations : []).map(String))];
    if (nations.length !== 3 || nations.some((n) => !PAID_NATIONS.includes(n) || st.owned.includes(n))) {
      return fail("pick 3 nations you don't own yet", 400);
    }
    name = "Checkmate Nations: 3 nations";
  } else if (product === "all") {
    nations = PAID_NATIONS.filter((n) => !st.owned.includes(n));
    if (!nations.length) return fail("owned already", 409);
    name = "Checkmate Nations: all nations";
  } else {
    if (st.access) return fail("league access already", 409);
    name = "Checkmate Nations: Nations League pass " + st.season;
  }
  const back = RETURN_OK.test(String(body.returnUrl || "")) ? String(body.returnUrl).split(/[?#]/)[0] : "https://checkmatenations.com/";
  const f = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(PRICES[product]),
    "line_items[0][price_data][product_data][name]": name,
    success_url: back + "?paid={CHECKOUT_SESSION_ID}",
    cancel_url: back,
    client_reference_id: u.id,
    "metadata[user_id]": u.id,
    "metadata[product]": product,
    "metadata[nations]": nations.join(","),
    "custom_text[submit][message]":
      "Digital content, unlocked immediately. You agreed to immediate unlocking and lose your right of withdrawal. " +
      "No VAT is charged (small business, § 19 UStG). / Digitale Inhalte, sofort freigeschaltet; mit deiner Zustimmung " +
      "zur sofortigen Ausführung erlischt dein Widerrufsrecht. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
  });
  if (u.email) f.set("customer_email", u.email);
  const cs = await stripe("/v1/checkout/sessions", f);
  await sql`insert into public.checkouts (session_id, user_id, product, nations, season, amount, consent_at)
    values (${cs.id}, ${u.id}, ${product}, ${nations}, ${product === "pass" ? st.season : null}, ${PRICES[product]}, now())`;
  return reply({ url: cs.url });
}

// ---------- Nations League ----------
async function league(u: User, body: Game) {
  const s = body.season && /^\d{4}-\d{2}$/.test(String(body.season)) ? String(body.season) : null;
  const [t] = await sql`select public.league_table(${s}) t`;
  const out: Game = { table: t.t };
  if (body.hall) out.hall = (await sql`select public.hall_of_fame() h`)[0].h;
  return reply(out);
}

async function leagueJoin(u: User, body: Game) {
  if (!registered(u)) return fail("account needed", 403);
  const [p] = await sql`select 1 from public.profiles where id = ${u.id}`;
  if (!p) return fail("no profile", 412);
  await syncPurchases(u.id);
  const st = await shopState(u.id);
  if (st.entry) return reply(st); // the nation is fixed for the whole season
  if (!st.access) return fail("league access needed", 402);
  const nation = String(body.nation || "");
  if (!st.owned.includes(nation)) return fail("nation not owned", 403);
  await sql`insert into public.league_entries (season, user_id, nation) values (${st.season}, ${u.id}, ${nation})
    on conflict do nothing`;
  return reply(await shopState(u.id));
}

// ---------- "Beat the AI": the Normal AI plays on the server ----------
// The same search as the game's own AI (Normal = depth 2 plus a little random noise against repetitive play), but run
// here: the client only sends the player's moves, so a win in the hall of fame is always a real win.
const VAL: Record<string, number> = { p: 100, n: 310, b: 325, r: 500, q: 900, k: 0 };
// The search runs on a plain 64-square array (index 0 = a8 like chess.js board(); "." empty, upper case white): chess.js
// is far too slow for it (seconds per move, the edge function only has 2 s CPU). Same evaluation and depth as the game's
// AI and the same scores (checked against it); castling/en passant are only left out inside the search, the root moves
// always come from chess.js.
type B = string[];
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]], KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DB = [[-1, -1], [-1, 1], [1, -1], [1, 1]], DR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const isW = (ch: string) => ch >= "A" && ch <= "Z";
function fenBoard(fen: string): B {
  const b: B = [];
  for (const ch of fen.split(" ")[0]) {
    if (ch === "/") continue;
    if (ch >= "1" && ch <= "8") for (let i = 0; i < +ch; i++) b.push("."); else b.push(ch);
  }
  return b;
}
function aiEval(b: B) {
  let s = 0;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const ch = b[i * 8 + j]; if (ch === ".") continue;
    const t = ch.toLowerCase(), black = !isW(ch);
    let v = VAL[t];
    if (t !== "k" && t !== "r") v += (3.5 - Math.abs(j - 3.5)) * 4 + (3.5 - Math.abs(i - 3.5)) * 4;
    if (t === "p") v += (black ? i : 7 - i) * 6;
    s += black ? v : -v;
  }
  return s;
}
function attacked(b: B, sq: number, byW: boolean) {
  const r = sq >> 3, c = sq & 7, at = (rr: number, cc: number) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8 ? b[rr * 8 + cc] : "";
  for (const dc of [-1, 1]) if (at(byW ? r + 1 : r - 1, c + dc) === (byW ? "P" : "p")) return true;
  for (const [dr, dc] of KN) if (at(r + dr, c + dc) === (byW ? "N" : "n")) return true;
  for (const [dr, dc] of KG) if (at(r + dr, c + dc) === (byW ? "K" : "k")) return true;
  for (const [dirs, set] of [[DB, "bq"], [DR, "rq"]] as [number[][], string][]) for (const [dr, dc] of dirs) {
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
      const ch = b[rr * 8 + cc];
      if (ch !== ".") { if (isW(ch) === byW && set.includes(ch.toLowerCase())) return true; break; }
      rr += dr; cc += dc;
    }
  }
  return false;
}
type M = [number, number, number]; // from, to, value of the captured piece (for move ordering)
function make(b: B, m: M): [string, string] {
  const [s, d] = m, cap = b[d], pc = b[s];
  b[d] = pc; b[s] = ".";
  if (pc === "P" && d < 8) b[d] = "Q";
  if (pc === "p" && d >= 56) b[d] = "q";
  return [cap, pc];
}
const unmake = (b: B, m: M, [cap, pc]: [string, string]) => { b[m[0]] = pc; b[m[1]] = cap; };
function gen(b: B, wtm: boolean): M[] {
  const mv: M[] = [], mine = (ch: string) => ch !== "." && isW(ch) === wtm, theirs = (ch: string) => ch !== "." && isW(ch) !== wtm;
  for (let s = 0; s < 64; s++) {
    const ch = b[s]; if (!mine(ch)) continue;
    const t = ch.toLowerCase(), r = s >> 3, c = s & 7;
    const add = (rr: number, cc: number) => {
      if (rr < 0 || rr > 7 || cc < 0 || cc > 7) return false;
      const d = rr * 8 + cc, x = b[d]; if (mine(x)) return false;
      mv.push([s, d, x === "." ? 0 : VAL[x.toLowerCase()]]); return x === ".";
    };
    if (t === "p") {
      const dir = wtm ? -1 : 1, r1 = r + dir;
      if (r1 < 0 || r1 > 7) continue;
      if (b[r1 * 8 + c] === ".") {
        mv.push([s, r1 * 8 + c, 0]);
        if (r === (wtm ? 6 : 1) && b[(r + 2 * dir) * 8 + c] === ".") mv.push([s, (r + 2 * dir) * 8 + c, 0]);
      }
      for (const dc of [-1, 1]) { const cc = c + dc; if (cc < 0 || cc > 7) continue; const x = b[r1 * 8 + cc]; if (theirs(x)) mv.push([s, r1 * 8 + cc, VAL[x.toLowerCase()]]); }
    } else if (t === "n") for (const [dr, dc] of KN) add(r + dr, c + dc);
    else if (t === "k") for (const [dr, dc] of KG) add(r + dr, c + dc);
    else for (const [dr, dc] of t === "b" ? DB : t === "r" ? DR : DB.concat(DR)) { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc; } }
  }
  const out: M[] = [];
  for (const m of mv) { const u = make(b, m); if (!attacked(b, b.indexOf(wtm ? "K" : "k"), !wtm)) out.push(m); unmake(b, m, u); }
  return out.sort((x, y) => y[2] - x[2]);
}
function aiSearch(b: B, wtm: boolean, depth: number, alpha: number, beta: number, maxi: boolean): number {
  if (depth === 0) return aiEval(b);
  const ms = gen(b, wtm);
  if (!ms.length) return attacked(b, b.indexOf(wtm ? "K" : "k"), !wtm) ? (maxi ? -1e5 - depth : 1e5 + depth) : 0;
  let best = maxi ? -Infinity : Infinity;
  for (const m of ms) {
    const u = make(b, m); const v = aiSearch(b, !wtm, depth - 1, alpha, beta, !maxi); unmake(b, m, u);
    if (maxi) { best = Math.max(best, v); alpha = Math.max(alpha, best); } else { best = Math.min(best, v); beta = Math.min(beta, best); }
    if (beta <= alpha) break;
  }
  return best;
}
// the AI always plays black in the challenge (the player is white, like in the game)
// deno-lint-ignore no-explicit-any
function aiPick(c: any) {
  const moves = c.moves({ verbose: true }).filter((m: Game) => !m.promotion || m.promotion === "q")
    .sort((a: Game, b: Game) => (b.captured ? VAL[b.captured] : 0) - (a.captured ? VAL[a.captured] : 0));
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    c.move({ from: m.from, to: m.to, promotion: m.promotion });
    // white to move minimises, the AI (black) takes the highest score; a little noise against always the same game
    const sc = (c.in_checkmate() ? 1e6 : aiSearch(fenBoard(c.fen()), true, 2, -Infinity, Infinity, false)) + Math.random() * 12;
    c.undo();
    if (sc > bestScore) { bestScore = sc; best = m; }
  }
  return best;
}
const aiView = (g: Game) => ({ id: g.id, moves: g.moves, status: g.status, nations: { w: g.white_nation, b: g.black_nation } });
// deno-lint-ignore no-explicit-any
const aiEnd = (c: any) => c.in_checkmate() ? (c.turn() === "b" ? "won" : "lost") : c.game_over() ? "draw" : null;

async function aiStart(u: User, body: Game) {
  if (!registered(u)) return fail("account needed", 403);
  const [p] = await sql`select 1 from public.profiles where id = ${u.id}`;
  if (!p) return fail("no profile", 412);
  const w = String(body.w || "usa"), b = String(body.b || "rus");
  const mine = await ownedNations(sql, u.id);
  if (!mine.includes(w) || !mine.includes(b) || w === b) return fail("nation not owned", 403);
  // one challenge at a time: an unfinished earlier one counts as given up
  await sql`update public.ai_games set status = 'resigned', finished_at = now() where user_id = ${u.id} and status = 'active'`;
  const [g] = await sql`insert into public.ai_games (user_id, white_nation, black_nation) values (${u.id}, ${w}, ${b}) returning *`;
  return reply({ ai: aiView(g) });
}

function aiMove(u: User, body: Game) {
  const from = String(body.from || ""), to = String(body.to || "");
  const promotion = body.promotion ? String(body.promotion) : "";
  if (!SQ.test(from) || !SQ.test(to) || (promotion && !/^[qrbn]$/.test(promotion))) return fail("bad move", 400);
  if (!UUID.test(String(body.id || ""))) return fail("not found", 404);
  return sql.begin(async (tx) => {
    const [g] = await tx`select * from public.ai_games where id = ${String(body.id)} and user_id = ${u.id} for update`;
    if (!g) return fail("not found", 404);
    if (g.status !== "active") return reply({ ai: aiView(g) });
    if (Number(body.moveNo) !== g.moves.length) return reply({ error: "out of sync", ai: aiView(g) }, 409);
    const c = replay(g.moves);
    if (c.turn() !== "w") return fail("not your turn", 409);
    const res = c.move({ from, to, promotion: promotion || undefined });
    if (!res) return fail("illegal move", 400);
    const moves = [...g.moves, res.from + res.to + (res.promotion || "")];
    let status = aiEnd(c), reply_ = null;
    if (!status) {
      const m = aiPick(c);
      const r = c.move({ from: m.from, to: m.to, promotion: m.promotion });
      reply_ = { from: r.from, to: r.to, promotion: r.promotion || null };
      moves.push(r.from + r.to + (r.promotion || ""));
      status = aiEnd(c);
    }
    const [n] = await tx`update public.ai_games set moves = ${moves}, status = ${status || "active"}, updated_at = now(),
      finished_at = case when ${!!status} then now() else null end where id = ${g.id} returning *`;
    return reply({ ai: aiView(n), reply: reply_ });
  });
}

async function aiResign(u: User, body: Game) {
  if (!UUID.test(String(body.id || ""))) return fail("not found", 404);
  await sql`update public.ai_games set status = 'resigned', finished_at = now()
    where id = ${String(body.id)} and user_id = ${u.id} and status = 'active'`;
  return reply({ ok: true });
}

// ---------- Puzzles: rating for signed-in players. The puzzle's own rating comes from our puzzle file (by FEN),
// the client only says solved or not, so nobody can claim a hard puzzle that does not exist. Same Elo as the client.
const PUZZLE_URL = Deno.env.get("PUZZLE_URL") || "https://checkmatenations.com/vendor/puzzles.json";
const PZ_PER_DAY = 300;
let pzRatings: Map<string, number> | null = null;
async function puzzleRating(fen: string) {
  if (!pzRatings) {
    const r = await fetch(PUZZLE_URL);
    if (!r.ok) throw new Error("puzzles not loaded");
    const rows = (await r.json()) as [string, string, number, string][];
    pzRatings = new Map(rows.map((x) => [x[0], Number(x[2])]));
  }
  return pzRatings.get(fen);
}
const pzView = (s: Game | undefined) =>
  s ? { r: Number(s.rating), n: s.played, ok: s.solved, streak: s.streak, best: s.best_streak } : null;

// returns the server rating; on the very first sync the rating from this browser is carried over (capped, so an
// edited localStorage cannot buy a top rank)
async function pzSync(u: User, body: Game) {
  if (!registered(u)) return fail("account needed", 403);
  let [s] = await sql`select * from public.puzzle_stats where user_id = ${u.id}`;
  if (!s) {
    const l = body.local || {}, int = (x: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(x) || 0)));
    const r = Math.max(400, Math.min(1400, Number(l.r) || 900)), n = int(l.n, 500), ok = Math.min(int(l.ok, 500), n);
    [s] = await sql`insert into public.puzzle_stats (user_id, rating, played, solved) values (${u.id}, ${r}, ${n}, ${ok})
      on conflict (user_id) do update set updated_at = now() returning *`;
  }
  return reply({ pz: pzView(s) });
}

async function pzResult(u: User, body: Game) {
  if (!registered(u)) return fail("account needed", 403);
  const pr = await puzzleRating(String(body.fen || ""));
  if (pr == null) return fail("unknown puzzle", 400);
  const won = body.ok === true;
  return sql.begin(async (tx) => {
    await tx`insert into public.puzzle_stats (user_id) values (${u.id}) on conflict (user_id) do nothing`;
    const [s] = await tx`select *, day = current_date as today from public.puzzle_stats where user_id = ${u.id} for update`;
    const count = s.today ? s.day_count : 0;
    if (count >= PZ_PER_DAY) return reply({ error: "daily limit", pz: pzView(s) }, 429);
    const r = Number(s.rating), e = 1 / (1 + Math.pow(10, (pr - r) / 400)), k = s.played < 20 ? 60 : 32;
    const nr = Math.max(400, Math.min(2600, r + k * ((won ? 1 : 0) - e))), streak = won ? s.streak + 1 : 0;
    const [n] = await tx`update public.puzzle_stats set rating = ${nr}, played = played + 1, solved = solved + ${won ? 1 : 0},
      streak = ${streak}, best_streak = greatest(best_streak, ${streak}), day = current_date, day_count = ${count + 1},
      updated_at = now() where user_id = ${u.id} returning *`;
    return reply({ pz: pzView(n) });
  });
}

const ACTIONS: Record<string, (u: User, body: Game) => Promise<Response> | Response> = {
  create, join, move, resign, claim, rematch, profile, queue, unqueue, stats: () => stats(), ping, abandon,
  me, checkout, league, league_join: leagueJoin, league_status: leagueStatus,
  delete_account: (u) => deleteAccount(u),
  ai_start: aiStart, ai_move: aiMove, ai_resign: aiResign,
  pz_sync: pzSync, pz_result: pzResult,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("method not allowed", 405);
  try {
    const user = await currentUser(req);
    if (!user) return fail("not signed in", 401);
    const body = await req.json().catch(() => ({}));
    const action = ACTIONS[String(body.action)];
    if (!action) return fail("unknown action", 400);
    return await action(user, body);
  } catch (e) {
    console.error(e);
    return fail("server error", 500);
  }
});
