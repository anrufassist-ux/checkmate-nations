# Zoo-Klingel (Entwurf)

Schnelles Reaktions-Kartenspiel nach dem Vorbild des Klingel-Clown-Spiels, mit süßen Tieren statt Clowns.
`index.html` ist ein spielbarer Prototyp: du gegen 1–4 Bots (statt echter Online-Gegner), keine Abhängigkeiten.

## Regeln (Prototyp)
- 7 Tiere (Fuchs, Frosch, Hase, Küken, Panda, Pinguin, Katze), je 5 fröhliche + 3 traurige Karten = 56 Karten, gleich verteilt.
- Reihum deckt jeder seine oberste Karte auf den eigenen offenen Stapel.
- Zwei gleiche **fröhliche** Tiere oben → klingeln. Wer zuerst klingelt, bekommt alle offenen Karten unter seinen Stapel.
- Traurige Tiere haben keinen Partner (auch nicht mit dem fröhlichen Tier derselben Sorte) – das ist die Falle.
- Falsch geklingelt: eine Karte an jeden Mitspieler.
- Wer beim eigenen Zug keine Karten mehr hat, ist raus. Der Letzte gewinnt.

## Plan für echtes Online-Multiplayer
- **Schnelles Spiel**: wer online ist, landet in einer Warteschlange; Tisch startet mit 2–5 Spielern, nach ~20 s Wartezeit füllen Bots auf.
- **Server ist Schiedsrichter**: Server mischt, hält die verdeckten Stapel und deckt im Takt auf (Clients sehen nur aufgedeckte Karten → kein Schummeln).
- **Klingeln**: Client schickt `ring` mit der Nummer des aktuellen Kartenstands. Der erste beim Server eingehende gültige `ring` gewinnt. Optional Latenzausgleich (Ping messen, Vorsprung bis ~80 ms ausgleichen).
- **Technik**: Für Millisekunden-Rennen ist ein Raum-Server mit WebSockets besser als Datenbank-Events (Supabase Realtime + Edge Function ist zu träge/teuer pro Klingeln). Vorschlag: ein Cloudflare Durable Object (oder PartyKit) pro Tisch; Supabase nur für Konten/Statistik, falls gewünscht.
