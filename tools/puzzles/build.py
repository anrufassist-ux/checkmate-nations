"""Merges the gen.py outputs into vendor/puzzles.json: replays every line with python-chess, drops duplicates and
under-promotions (the game always promotes to a queen), sorts by rating.
Usage: python3 build.py part1.jsonl part2.jsonl ...  ->  ../../vendor/puzzles.json  ([fen, moves, rating, themes] rows)"""
import chess, json, os, sys
V = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}

def trim(fen, moves, themes):
    """Material puzzles end at the solver move that wins the most material (counted after the opponent's reply in the
    line), so nobody has to play on with checks once the piece is won. Mate puzzles stay as they are."""
    if 'mate' in themes: return moves
    b = chess.Board(fen); b.push_uci(moves[0]); solver = b.turn; best, bi = -99, len(moves) - 1
    mat = lambda x: sum(V[p.piece_type] * (1 if p.color == solver else -1) for p in x.piece_map().values())
    for i in range(1, len(moves)):
        b.push_uci(moves[i])
        if i % 2 == 1:
            bb = b.copy()
            if i + 1 < len(moves): bb.push_uci(moves[i + 1])
            if mat(bb) > best: best, bi = mat(bb), i
    return moves[:bi + 1]

if sys.argv[1:] == ['--trim']:  # one-off: trim the existing vendor/puzzles.json in place
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../vendor/puzzles.json')
    rows = json.load(open(out)); n = 0
    for r in rows:
        t = trim(r[0], r[1].split(), r[3].split())
        if len(t) < len(r[1].split()): r[1] = ' '.join(t); n += 1
    json.dump(rows, open(out, 'w'), separators=(',', ':')); print('trimmed', n); sys.exit()
rows, seen = [], set()
for fn in sys.argv[1:]:
    for line in open(fn):
        p = json.loads(line); key = ' '.join(p['fen'].split()[:4])
        if key in seen: continue
        moves = trim(p['fen'], p['moves'].split(), p['themes'])
        if any(len(m) == 5 and m[4] != 'q' for m in moves): continue
        b = chess.Board(p['fen'])
        try:
            for m in moves: b.push_uci(m)
        except ValueError: continue
        if 'mate' in p['themes'] and not b.is_checkmate(): continue
        r = p['rating'] + (0 if 'kids' in p['themes'] else 300)  # gen.py's estimate runs low next to the kids set
        seen.add(key); rows.append([p['fen'], ' '.join(moves), r, ' '.join(p['themes'])])
rows.sort(key=lambda r: r[2])
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../vendor/puzzles.json')
json.dump(rows, open(out, 'w'), separators=(',', ':'))
from collections import Counter
print(len(rows), 'puzzles ->', out, os.path.getsize(out) // 1024, 'KB')
print('levels', Counter('easy' if r[2] < 1000 else 'medium' if r[2] < 1500 else 'hard' for r in rows))
print('themes', Counter(t for r in rows for t in r[3].split()).most_common(12))
