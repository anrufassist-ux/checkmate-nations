# Supabase für Online-Partien

Gäste spielen Freundschaftsspiele per 4-stelligem Code. Das Spiel liest seine Partien nur; jede Änderung
(Spiel anlegen, beitreten, Zug, Aufgabe, Revanche) läuft über die Edge Function `game`, die jeden Zug mit
chess.js auf dem Server prüft.

- Projekt: `uerlobtrjmgveqeoykwk` (Frankfurt), URL und Publishable key stehen in `index.html` (`SB_URL`, `SB_KEY`).
- `migrations/001_online_games.sql`: Tabelle `games`, Leserechte (RLS), Live-Updates, nächtliches Aufräumen.
- `migrations/002_accounts_rated.sql`: Profile (Spielername, Elo), Warteschlange, Schachuhr, Elo-Abrechnung (`finish_game`), Uhr-Prüfung jede Minute (`sweep_clocks`).
- `functions/game/index.ts`: die Server-Funktion.

## Einmal einrichten (im Supabase-Dashboard, kein Programm nötig)

1. **Datenbank:** SQL Editor → New query → kompletten Inhalt jeder Datei in `migrations/` der Reihe nach einfügen → Run.
   Die Skripte können gefahrlos noch einmal ausgeführt werden.
2. **Server-Funktion:** Edge Functions → Deploy a new function → Via Editor →
   Name **`game`** → Inhalt von `functions/game/index.ts` komplett einfügen → Deploy.
3. **JWT-Prüfung aus:** In der Funktion `game` → Details/Settings → „Verify JWT“ (Enforce JWT verification)
   **ausschalten** → Save. Die Funktion prüft die Anmeldung selbst.

Bei Änderungen an der Funktion: Inhalt im Editor ersetzen und erneut deployen.

## E-Mail-Versand (für Konten nötig)

Der eingebaute Mailer von Supabase schickt nur an Mitglieder des Supabase-Teams. Für echte Spieler:
Resend-Konto → Domain `checkmatenations.com` hinzufügen (Region EU) → die angezeigten DNS-Einträge bei Vercel eintragen →
API-Key erzeugen → in Supabase unter Authentication → Emails → SMTP Settings eintragen
(Host `smtp.resend.com`, Port `465`, Benutzer `resend`, Passwort = API-Key, Absender z. B. `login@checkmatenations.com`).
