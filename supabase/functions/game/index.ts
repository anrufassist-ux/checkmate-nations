// Checkmate Nations: the only way to change a game. Every move is replayed and checked with chess.js
// on the server, so a modified client cannot play illegal moves, move for the opponent or fake a result.
// Deploy as edge function "game" (JWT verification off: this function checks the user itself).
import postgres from "npm:postgres@3.4.5";
import { Chess } from "npm:chess.js@0.10.3";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 4, idle_timeout: 20 });
const AUTH_USER_URL = Deno.env.get("SUPABASE_URL") + "/auth/v1/user";
const ONLINE_NATIONS = new Set(["usa", "rus"]); // paid nations stay offline until real checkout exists
const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SQ = /^[a-h][1-8]$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (error: string, status: number, game?: unknown) => reply({ error, game }, status);

async function currentUser(req: Request): Promise<{ id: string } | null> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(AUTH_USER_URL, { headers: { Authorization: auth, apikey: req.headers.get("apikey") || "" } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && typeof u.id === "string" ? u : null;
}

// deno-lint-ignore no-explicit-any
type Game = Record<string, any>;
const view = (g: Game) => ({
  id: g.id, code: g.code, white: g.white_id, black: g.black_id,
  nations: { w: g.white_nation, b: g.black_nation }, status: g.status, fen: g.fen,
  moveNo: g.move_no, last: g.last_move, caps: g.caps, epoch: g.epoch, result: g.result, reason: g.reason,
});
const seatOf = (g: Game, uid: string) => (g.white_id === uid ? "w" : g.black_id === uid ? "b" : null);

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

async function create(uid: string, body: Game) {
  const w = String(body.w || "usa"), b = String(body.b || "rus");
  if (!ONLINE_NATIONS.has(w) || !ONLINE_NATIONS.has(b)) return fail("nation not available online", 400);
  for (let i = 0; i < 8; i++) {
    let code = "";
    for (let k = 0; k < 4; k++) code += CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)];
    const rows = await sql`insert into public.games (code, white_id, white_nation, black_nation)
      values (${code}, ${uid}, ${w}, ${b}) on conflict (code) do nothing returning *`;
    if (rows.length) return reply({ game: view(rows[0]), seat: "w" });
  }
  return fail("no free game code, try again", 503);
}

function join(uid: string, body: Game) {
  const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z2-9]{4}$/.test(code)) return fail("bad code", 400);
  return sql.begin(async (tx) => {
    const [g] = await tx`select * from public.games where code = ${code} for update`;
    if (!g) return fail("not found", 404);
    const seat = seatOf(g, uid);
    if (seat) return reply({ game: view(g), seat });
    if (g.black_id) return fail("full", 409);
    const [u] = await tx`update public.games set black_id = ${uid},
      status = case when status = 'waiting' then 'active' else status end, updated_at = now()
      where id = ${g.id} returning *`;
    return reply({ game: view(u), seat: "b" });
  });
}

function move(uid: string, body: Game) {
  const from = String(body.from || ""), to = String(body.to || "");
  const promotion = body.promotion ? String(body.promotion) : "";
  if (!SQ.test(from) || !SQ.test(to) || (promotion && !/^[qrbn]$/.test(promotion))) return fail("bad move", 400);
  return sql.begin(async (tx) => {
    const [g] = await tx`select * from public.games where id = ${String(body.id)} for update`;
    if (!g) return fail("not found", 404);
    const seat = seatOf(g, uid);
    if (!seat) return fail("not your game", 403);
    if (g.status !== "active") return fail("game not running", 409, view(g));
    if (Number(body.moveNo) !== g.move_no) return fail("out of sync", 409, view(g));
    const c = replay(g.moves);
    if (c.turn() !== seat) return fail("not your turn", 409, view(g));
    const res = c.move({ from, to, promotion: promotion || undefined });
    if (!res) return fail("illegal move", 400, view(g));
    const caps = { w: [...(g.caps?.w || [])], b: [...(g.caps?.b || [])] };
    if (res.captured) caps[seat].push(res.captured);
    const end = outcome(c, seat);
    const uci = res.from + res.to + (res.promotion || "");
    const [u] = await tx`update public.games set
      moves = array_append(moves, ${uci}), move_no = move_no + 1, fen = ${c.fen()},
      last_move = ${tx.json({ from: res.from, to: res.to, promotion: res.promotion || null })},
      caps = ${tx.json(caps)}, status = ${end ? "finished" : "active"},
      result = ${end?.result ?? null}, reason = ${end?.reason ?? null}, updated_at = now()
      where id = ${g.id} returning *`;
    return reply({ game: view(u) });
  });
}

function resign(uid: string, body: Game) {
  return sql.begin(async (tx) => {
    const [g] = await tx`select * from public.games where id = ${String(body.id)} for update`;
    if (!g) return fail("not found", 404);
    const seat = seatOf(g, uid);
    if (!seat) return fail("not your game", 403);
    if (g.status === "finished") return reply({ game: view(g) });
    const [u] = await tx`update public.games set status = 'finished', result = ${seat === "w" ? "0-1" : "1-0"},
      reason = 'resign', updated_at = now() where id = ${g.id} returning *`;
    return reply({ game: view(u) });
  });
}

function rematch(uid: string, body: Game) {
  return sql.begin(async (tx) => {
    const [g] = await tx`select * from public.games where id = ${String(body.id)} for update`;
    if (!g) return fail("not found", 404);
    if (!seatOf(g, uid)) return fail("not your game", 403);
    if (g.status !== "finished") return fail("game still running", 409, view(g));
    const [u] = await tx`update public.games set fen = default, moves = '{}', move_no = 0, last_move = null,
      caps = default, status = 'active', result = null, reason = null, epoch = epoch + 1, updated_at = now()
      where id = ${g.id} returning *`;
    return reply({ game: view(u) });
  });
}

const ACTIONS: Record<string, (uid: string, body: Game) => Promise<Response> | Response> = { create, join, move, resign, rematch };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("method not allowed", 405);
  try {
    const user = await currentUser(req);
    if (!user) return fail("not signed in", 401);
    const body = await req.json().catch(() => ({}));
    const action = ACTIONS[String(body.action)];
    if (!action) return fail("unknown action", 400);
    return await action(user.id, body);
  } catch (e) {
    console.error(e);
    return fail("server error", 500);
  }
});
