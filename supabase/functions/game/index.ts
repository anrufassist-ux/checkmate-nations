// Checkmate Nations: the only way to change a game. Every move is replayed and checked with chess.js
// on the server, so a modified client cannot play illegal moves, move for the opponent, fake a result
// or stop its clock. Rated games (10 min + 5 s) only come from matchmaking; Elo is settled in SQL.
// Deploy as edge function "game" (JWT verification off: this function checks the user itself).
import postgres from "npm:postgres@3.4.5";
import { Chess } from "npm:chess.js@0.10.3";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 4, idle_timeout: 20 });
const AUTH_USER_URL = Deno.env.get("SUPABASE_URL") + "/auth/v1/user";
const ONLINE_NATIONS = new Set(["usa", "rus"]); // paid nations stay offline until real checkout exists
const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SQ = /^[a-h][1-8]$/;
const BASE_MS = 900_000, INC_MS = 10_000, FIRST_MOVE_MS = 60_000;
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
  if (!ONLINE_NATIONS.has(w) || !ONLINE_NATIONS.has(b)) return fail("nation not available online", 400);
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
  const nation = ONLINE_NATIONS.has(String(body.nation)) ? String(body.nation) : "usa";
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(4711)`; // one matcher at a time
    const [cur] = await tx`select * from public.games where rated and status = 'active'
      and (white_id = ${u.id} or black_id = ${u.id}) limit 1`;
    if (cur) {
      await tx`delete from public.match_queue where user_id = ${u.id}`;
      return reply({ game: view(cur), seat: seatOf(cur, u.id) });
    }
    const [me] = await tx`insert into public.match_queue (user_id, elo, nation) values (${u.id}, ${p.elo}, ${nation})
      on conflict (user_id) do update set seen_at = now(), elo = excluded.elo, nation = excluded.nation returning *`;
    // the Elo window widens the longer both have been waiting
    const [opp] = await tx`select q.* from public.match_queue q
      where q.user_id <> ${u.id} and q.seen_at > now() - interval '12 seconds'
        and abs(q.elo - ${p.elo}) <= 150 + 10 * extract(epoch from now() - least(q.joined_at, ${me.joined_at}))
        and (select count(*) from public.games x where x.rated and x.created_at > now() - interval '7 days' and x.reason is distinct from 'aborted'
             and coalesce((x.elo_change->>'short')::boolean, false) = false
             and ((x.white_id = q.user_id and x.black_id = ${u.id}) or (x.white_id = ${u.id} and x.black_id = q.user_id)))
            < ${PAIR_GAMES_PER_WEEK}
      order by q.joined_at limit 1`;
    if (!opp) return reply({ waiting: true, searching: await countSearching(tx) });
    await tx`delete from public.match_queue where user_id in (${u.id}, ${opp.user_id})`;
    const meWhite = Math.random() < 0.5;
    const [wid, bid] = meWhite ? [u.id, opp.user_id] : [opp.user_id, u.id];
    // the player who waited longer keeps their nation; the newcomer gets the other one if both picked the same
    const mine = nation === opp.nation ? (opp.nation === "usa" ? "rus" : "usa") : nation;
    const wn = meWhite ? mine : opp.nation;
    const bn = meWhite ? opp.nation : mine;
    const [g] = await tx`insert into public.games (white_id, black_id, white_nation, black_nation, status, rated,
      white_ms, black_ms, increment_ms, turn_started_at)
      values (${wid}, ${bid}, ${wn}, ${bn}, 'active', true, ${BASE_MS}, ${BASE_MS}, ${INC_MS}, now()) returning *`;
    return reply({ game: view(g), seat: meWhite ? "w" : "b" });
  });
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

const ACTIONS: Record<string, (u: User, body: Game) => Promise<Response> | Response> = {
  create, join, move, resign, claim, rematch, profile, queue, unqueue, stats: () => stats(),
  delete_account: (u) => deleteAccount(u),
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
