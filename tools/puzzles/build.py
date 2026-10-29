"""Merges the gen.py outputs into vendor/puzzles.json: replays every line with python-chess, drops duplicates and
under-promotions (the game always promotes to a queen), sorts by rating.
Usage: python3 build.py part1.jsonl part2.jsonl ...  ->  ../../vendor/puzzles.json  ([fen, moves, rating, themes] rows)"""
import chess, json, os, sys
rows, seen = [], set()
for fn in sys.argv[1:]:
    for line in open(fn):
        p = json.loads(line); key = ' '.join(p['fen'].split()[:4])
        if key in seen: continue
        moves = p['moves'].split()
        if any(len(m) == 5 and m[4] != 'q' for m in moves): continue
        b = chess.Board(p['fen'])
        try:
            for m in moves: b.push_uci(m)
        except ValueError: continue
        if 'mate' in p['themes'] and not b.is_checkmate(): continue
        seen.add(key); rows.append([p['fen'], p['moves'], p['rating'], ' '.join(p['themes'])])
rows.sort(key=lambda r: r[2])
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../vendor/puzzles.json')
json.dump(rows, open(out, 'w'), separators=(',', ':'))
from collections import Counter
print(len(rows), 'puzzles ->', out, os.path.getsize(out) // 1024, 'KB')
print('levels', Counter('easy' if r[2] < 1000 else 'medium' if r[2] < 1500 else 'hard' for r in rows))
print('themes', Counter(t for r in rows for t in r[3].split()).most_common(12))
