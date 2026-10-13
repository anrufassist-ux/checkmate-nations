# Supabase für Online-Partien (Phase 1)

Gäste spielen Freundschaftsspiele per 4-stelligem Code. Das Spiel liest seine Partien nur; jede Änderung
(Spiel anlegen, beitreten, Zug, Aufgabe, Revanche) läuft über die Edge Function `game`, die jeden Zug mit
chess.js auf dem Server prüft.

- Projekt: `uerlobtrjmgveqeoykwk` (Frankfurt), URL und Publishable key stehen in `index.html` (`SB_URL`, `SB_KEY`).
- `migrations/001_online_games.sql`: Tabelle `games`, Leserechte (RLS), Live-Updates, nächtliches Aufräumen.
- `functions/game/index.ts`: die Server-Funktion.

## Einmal einrichten (im Supabase-Dashboard, kein Programm nötig)

1. **Datenbank:** SQL Editor → New query → kompletten Inhalt von `migrations/001_online_games.sql` einfügen → Run.
   Das Skript kann gefahrlos noch einmal ausgeführt werden.
2. **Server-Funktion:** Edge Functions → Deploy a new function → Via Editor →
   Name **`game`** → Inhalt von `functions/game/index.ts` komplett einfügen → Deploy.
3. **JWT-Prüfung aus:** In der Funktion `game` → Details/Settings → „Verify JWT“ (Enforce JWT verification)
   **ausschalten** → Save. Die Funktion prüft die Anmeldung selbst.

Bei Änderungen an der Funktion: Inhalt im Editor ersetzen und erneut deployen.
