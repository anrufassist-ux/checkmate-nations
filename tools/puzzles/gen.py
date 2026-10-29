"""Generates chess puzzles for the puzzle mode, the way lichess does it: weak engines play games, a strong check finds the
moment a side blunders and the other side has exactly one move that wins (or mates), and the line is extended while every
move of the solver stays the only good one. Needs a native Stockfish (`apt install stockfish`) and python-chess 1.10.

Usage: python3 gen.py OUT.jsonl SECONDS [SEED]   (run several in parallel, then build.py merges them into vendor/puzzles.json)
Each line: {"fen": position before the blunder, "moves": "blunder sol1 reply1 sol2 ...", "rating": estimate, "themes": [...]}"""
import chess, chess.engine, json, random, sys, time

SF = '/usr/games/stockfish'
V = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
out, secs = sys.argv[1], float(sys.argv[2]); rnd = random.Random(int(sys.argv[3]) if len(sys.argv) > 3 else None)
eng = chess.engine.SimpleEngine.popen_uci(SF); eng.configure({'Threads': 1, 'Hash': 64})
QUICK, DEEP = chess.engine.Limit(depth=9), chess.engine.Limit(depth=18)

def cp(score, pov):  # centipawns from pov, mates as +-10000 minus distance
    s = score.pov(pov); return s.score(mate_score=10000)

def multi(board, n=2, limit=DEEP):
    return eng.analyse(board, limit, multipv=n)

def unique(board, pov):
    """The best move if it is the only clearly winning one, else None. At mate in 1 any mate counts (client accepts all)."""
    info = multi(board)
    best = info[0]; s1 = cp(best['score'], pov); m = best['score'].pov(pov).mate()
    if m == 1: return best['pv'][0], s1
    s2 = cp(info[1]['score'], pov) if len(info) > 1 else -10000
    if m and m > 0:  # forced mate: the second move must not also win big
        return (best['pv'][0], s1) if s2 < 400 else (None, s1)
    if s1 >= 250 and s2 <= min(150, s1 - 250): return best['pv'][0], s1
    return None, s1

def found_depth(board, move):
    for d in range(1, 19):
        if eng.play(board, chess.engine.Limit(depth=d)).move == move:
            ok = all(eng.play(board, chess.engine.Limit(depth=e)).move == move for e in range(d + 1, min(d + 3, 19)))
            if ok: return d
    return 18

def themes(start, line, solver):
    t = []; b = start.copy(); b.push(line[0])
    first = line[1]; piece = b.piece_at(first.from_square); cap = b.piece_at(first.to_square)
    if cap and not b.attackers(not solver, first.to_square): t.append('hangingPiece')
    after = b.copy(); after.push(first)
    if piece and piece.piece_type == chess.KNIGHT:
        hit = [sq for sq in after.attacks(first.to_square) if after.piece_at(sq) and after.piece_at(sq).color != solver and V[after.piece_at(sq).piece_type] >= 3 or (after.piece_at(sq) and after.piece_at(sq).piece_type == chess.KING and after.piece_at(sq).color != solver)]
        if len(hit) >= 2: t.append('fork')
    if first.promotion: t.append('promotion')
    if piece and after.is_attacked_by(not solver, first.to_square) and V[piece.piece_type] > (V[cap.piece_type] if cap else 0) + 1: t.append('sacrifice')
    end = start.copy()
    for mv in line: end.push(mv)
    if end.is_checkmate():
        k = end.king(not solver); rank = chess.square_rank(k)
        if rank in (0, 7) and 'sacrifice' not in t:
            t.append('backRankMate')
    return t

def make_puzzle(before, blunder):
    """before: position before the blunder. Returns a puzzle dict or None."""
    b = before.copy(); b.push(blunder); solver = b.turn
    mv, s = unique(b, solver)
    if not mv: return None
    line = [blunder]
    mate_mode = s >= 9000
    while True:
        line.append(mv); b.push(mv)
        if b.is_checkmate(): break
        if b.is_game_over(): return None
        nb = sum(1 for i in range(1, len(line), 2))
        if nb >= (4 if mate_mode else 3): break
        reply = eng.play(b, chess.engine.Limit(depth=16)).move
        b2 = b.copy(); b2.push(reply)
        mv2, s2 = unique(b2, solver)
        if not mv2:
            if mate_mode: return None  # a mate line must be forced to the end
            break
        line.append(reply); b.push(reply); mv = mv2
    if mate_mode and not b.is_checkmate(): return None
    if not mate_mode:  # material line: the solver must still be clearly winning at the end
        if cp(eng.analyse(b, chess.engine.Limit(depth=16))['score'], solver) < 250: return None
    nsol = (len(line)) // 2
    start = before.copy(); start.push(blunder)
    d = found_depth(start, line[1])
    rating = 600 + 70 * d + 260 * (nsol - 1) + (0 if mate_mode else 150) + rnd.randint(-60, 60)
    th = (['mateIn%d' % nsol, 'mate'] if mate_mode else ['advantage' if s < 600 else 'crushing']) + themes(before, line, solver)
    return {'fen': before.fen(), 'moves': ' '.join(m.uci() for m in line), 'rating': max(500, min(2400, rating)), 'themes': th}

def game():
    b = chess.Board(); skill = {chess.WHITE: rnd.randint(0, 9), chess.BLACK: rnd.randint(0, 9)}
    prev = None; found = []
    for ply in range(160):
        if b.is_game_over(): break
        if ply < 6: mv = rnd.choice(list(b.legal_moves))  # random openings for variety
        else:
            eng.configure({'Skill Level': skill[b.turn]})
            mv = eng.play(b, chess.engine.Limit(depth=rnd.randint(3, 8))).move
            eng.configure({'Skill Level': 20})
        if ply >= 14:
            mover = b.turn
            e0 = -prev if prev is not None else cp(eng.analyse(b, QUICK)['score'], mover)  # last eval, seen from this side
            after = b.copy(); after.push(mv); prev = None
            if not after.is_game_over():
                e1 = cp(eng.analyse(after, QUICK)['score'], mover); prev = e1
                if e0 > -150 and e0 - e1 >= 300 and -e1 >= 250:
                    p = make_puzzle(b, mv)
                    if p: found.append(p); return found  # one puzzle per game keeps them varied
        b.push(mv)
    return found

t0 = time.time(); n = 0
with open(out, 'a') as f:
    while time.time() - t0 < secs:
        for p in game():
            f.write(json.dumps(p) + '\n'); f.flush(); n += 1
print(out, n, 'puzzles in', int(time.time() - t0), 's')
eng.quit()
