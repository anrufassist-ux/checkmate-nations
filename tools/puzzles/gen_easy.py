"""Beginner and kids puzzles: weak games, and the moment one side allows a mate in 1 or leaves a piece (knight or more)
completely unprotected, the other side gets the puzzle. Few pieces on the board so it stays clear. Same output format as gen.py.
Usage: python3 gen_easy.py OUT.jsonl SECONDS [SEED]"""
import chess, chess.engine, json, random, sys, time

V = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
out, secs = sys.argv[1], float(sys.argv[2]); rnd = random.Random(int(sys.argv[3]) if len(sys.argv) > 3 else None)
eng = chess.engine.SimpleEngine.popen_uci('/usr/games/stockfish'); eng.configure({'Threads': 1, 'Hash': 32})

def cp(score, pov): return score.pov(pov).score(mate_score=10000)

def mates(b):
    res = []
    for m in b.legal_moves:
        b.push(m)
        if b.is_checkmate(): res.append(m)
        b.pop()
    return res

def free_capture(b):
    """The single capture of an unprotected knight/bishop/rook/queen that the engine also calls clearly best."""
    caps = [m for m in b.legal_moves if b.piece_at(m.to_square) and V[b.piece_at(m.to_square).piece_type] >= 3
            and not b.attackers(not b.turn, m.to_square)]
    if len(caps) != 1: return None
    info = eng.analyse(b, chess.engine.Limit(depth=12), multipv=2)
    if info[0]['pv'][0] != caps[0]: return None
    s1 = cp(info[0]['score'], b.turn); s2 = cp(info[1]['score'], b.turn) if len(info) > 1 else -10000
    return caps[0] if s1 >= 250 and s2 <= s1 - 200 else None

def game():
    b = chess.Board(); skill = rnd.randint(0, 3)
    eng.configure({'Skill Level': skill})
    for ply in range(140):
        if b.is_game_over(): return None
        if ply < 4: mv = rnd.choice(list(b.legal_moves))
        else: mv = eng.play(b, chess.engine.Limit(depth=rnd.randint(1, 4))).move
        before = b.copy(); b.push(mv)
        if ply < 10 or b.is_game_over(): continue
        n = len(b.piece_map())
        if n > 22: continue
        if mates(before): continue  # the solver must not have had the mate already before this move
        ms = mates(b)
        if len(ms) == 1:
            r = 380 + 9 * n + rnd.randint(-40, 40)
            return {'fen': before.fen(), 'moves': mv.uci() + ' ' + ms[0].uci(), 'rating': r, 'themes': ['mateIn1', 'mate', 'kids']}
        if not ms and rnd.random() < .5:
            eng.configure({'Skill Level': 20}); c = free_capture(b); eng.configure({'Skill Level': skill})
            if c:
                val = V[b.piece_at(c.to_square).piece_type]
                r = 330 + 8 * n + (0 if val >= 5 else 60) + rnd.randint(-40, 40)
                return {'fen': before.fen(), 'moves': mv.uci() + ' ' + c.uci(), 'rating': r, 'themes': ['hangingPiece', 'advantage', 'kids']}
    return None

t0 = time.time(); n = 0
with open(out, 'a') as f:
    while time.time() - t0 < secs:
        p = game()
        if p: f.write(json.dumps(p) + '\n'); f.flush(); n += 1
print(out, n, 'puzzles in', int(time.time() - t0), 's')
eng.quit()
