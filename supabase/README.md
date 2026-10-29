# Supabase für Online-Partien

Gäste spielen Freundschaftsspiele per 4-stelligem Code. Das Spiel liest seine Partien nur; jede Änderung
(Spiel anlegen, beitreten, Zug, Aufgabe, Revanche) läuft über die Edge Function `game`, die jeden Zug mit
chess.js auf dem Server prüft.

- Projekt: `uerlobtrjmgveqeoykwk` (Frankfurt), URL und Publishable key stehen in `index.html` (`SB_URL`, `SB_KEY`).
- `migrations/001_online_games.sql`: Tabelle `games`, Leserechte (RLS), Live-Updates, nächtliches Aufräumen.
- `migrations/002_accounts_rated.sql`: Profile (Spielername, Elo), Warteschlange, Schachuhr, Elo-Abrechnung (`finish_game`), Uhr-Prüfung jede Minute (`sweep_clocks`).
- `migrations/003_friend_records.sql`: private Bilanz zwischen zwei Spielern bei Freundschaftsspielen.
- `migrations/004_timeout_draw.sql`: Zeitüberschreitung ist Remis, wenn der Gegner gar nicht mehr mattsetzen kann.
- `migrations/005_fair_rating.sql`: Partien unter 10 Zügen pro Seite zählen nicht für Elo, Rangliste erst ab 5 verschiedenen Gegnern.
- `migrations/006_league_shop.sql`: Käufe (Stripe), gekaufte Länder, League-Pass, Nations League (Saison = Kalendermonat), Tabellen und Hall of Fame.
- `migrations/007_abandon.sql`: verlassene gewertete Partien. Die Clients melden sich alle 15 s (`ping`), nach 2 Minuten Funkstille kann der Gegner den Sieg beanspruchen (`abandon`).
- `migrations/008_league_search.sql`: Spalte `league_only` in `match_queue`. Wer in der Liga ist, kann gezielt einen Liga-Gegner suchen (`queue` mit `league: true`, nur Gegner aus der Liga mit ihrem Liga-Land, andere Nation). Die Aktion `league_status` sagt dem Spiel, ob eine gewertete Partie für die Liga zählt und wie viele Punkte sie gebracht hat.
- `migrations/009_open_leaderboard.sql`: Rangliste schon ab einer gewerteten Partie (statt 5 verschiedenen Gegnern).
- `migrations/010_ai_challenge.sql`: KI-Challenge. Tabelle `ai_games` (nur die Funktion schreibt), die KI auf Normal rechnet in der Funktion (`ai_start`, `ai_move`, `ai_resign`), öffentliche Hall of Fame `ai_hall()`.
- `migrations/011_puzzles.sql`: Puzzle-Wertung für Konten. Tabelle `puzzle_stats` (nur die Funktion schreibt), Aktionen `pz_sync` (lädt die Wertung, übernimmt beim ersten Mal die Browser-Wertung, gedeckelt auf 1400) und `pz_result` (die Funktion rechnet die Elo selbst, die Puzzle-Stärke kommt aus `vendor/puzzles.json` der Website, höchstens 300 Ergebnisse pro Tag), öffentliche Rangliste `puzzle_board()` (ab 10 Aufgaben).
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

## Bezahlen (Stripe)

Gekauft wird über Stripe Checkout. Die Funktion `game` legt den Bezahlvorgang an und fragt Stripe danach selbst,
ob bezahlt wurde (beim Zurückkommen ins Spiel und bei jedem Öffnen des Kontos). Ein Webhook ist nicht nötig.

1. Stripe-Dashboard → Entwickler → API-Schlüssel → **Eingeschränkten Schlüssel erstellen**:
   Name „Checkmate Nations“, Berechtigung nur **Checkout Sessions: Schreiben**, alles andere „Keine“.
2. Supabase → Edge Functions → **Secrets** → Name `STRIPE_SECRET_KEY`, Wert = dieser Schlüssel → Save.
   Erst mit dem Test-Schlüssel (Testmodus, Karte 4242 4242 4242 4242) testen, dann den Live-Schlüssel eintragen.
3. Stripe → Einstellungen → Kunden-E-Mails: „Erfolgreiche Zahlungen“ an, damit Käufer einen Beleg bekommen.

Preise stehen in der Funktion (`PRICES`): 3 Länder 2,99 €, alle Länder 4,99 €, League-Pass 0,99 € pro Saison,
ohne Umsatzsteuer (Kleinunternehmer, § 19 UStG).

## Anmelde-Mail (nur Code)

Angemeldet wird nur mit dem 6-stelligen Code, ohne Link: Ein Link würde den Code verbrauchen, wenn er auf einem anderen Gerät
geöffnet wird. Der Code steht im Betreff, damit er schon in der Benachrichtigung zu sehen ist. Danach bleibt man auf dem Gerät
angemeldet. Supabase → Authentication → Emails → Templates → bei **Magic Link**, **Confirm signup** und
**Change Email Address** jeweils:

Nur Englisch, weil wir die Sprache des Spielers nicht kennen (das Spiel ist standardmäßig auch Englisch).

Betreff: `{{ .Token }} is your Checkmate Nations code`

```html
<h2>Checkmate Nations</h2>
<p>Your sign-in code:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:12px 0">{{ .Token }}</p>
<p style="color:#666">Enter this code in the game.</p>
<p style="color:#888">If this wasn't you, just ignore this e-mail.</p>
```
