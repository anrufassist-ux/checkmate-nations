# Leaders behind the caricatures

Which real person each nation's king shows, and when that could change. Checked every week (scheduled task
"Leader-Check", Monday morning); when a leader changes, the king head is swapped (new Grok bust, `brand/heads-src/make_heads.py`,
`window.HEADS` / `window.CRY` / `CRY_EYES`, see CLAUDE.md) and the posts that mention the old leader stay as they are.

Last check: 2026-10-31

## Nations with a caricature king

| Nation (key) | Caricature shows | Office | In office since | Next date that could change it | Risk | Notes |
|---|---|---|---|---|---|---|
| USA (`usa`, head `kw`) | Donald Trump | President | 20 Jan 2025 | Midterms 3 Nov 2026 (Congress only); presidential election 7 Nov 2028, new president 20 Jan 2029 | low until 2028 | |
| Russia (`rus`, head `kb`) | Vladimir Putin | President | 2000 (current term since 2024) | Presidential election 2030 | low | |
| China (`chn`) | Xi Jinping | General Secretary / President | 2012 / 2013 | 21st Party Congress, second half of 2027 (expected to stay for a 4th term) | low | |
| Germany (`ger`) | Friedrich Merz | Chancellor | 6 May 2025 | Federal election spring 2029 | medium | Polls in Sep 2026: 48 % expect a change of chancellor by the end of the year; he rules out an early election. Watch closely. |
| Europe (`eu`) | Ursula von der Leyen | President of the European Commission | 2019 (re-elected July 2024) | End of term 2029 | low | |
| India (`ind`) | Narendra Modi | Prime Minister | 26 May 2014 | General election 2029 | low | |
| UK (`gbr`) | Andy Burnham | Prime Minister | 20 Jul 2026 (after Starmer resigned) | General election due by 2029; he ruled out an early election in 2027 | low | Labour working majority ~167 |
| France (`fra`) | Emmanuel Macron | President | 14 May 2017 | **Presidential election 18 Apr 2027, run-off 2 May 2027; Macron cannot run again, term ends 13 May 2027** | **certain change** | Prepare the new head in April 2027 as soon as the run-off is decided. |

## Nations with a generic king (no caricature yet)

Only relevant if we add a caricature later.

| Nation | Head of government / state today | Next date | Notes |
|---|---|---|---|
| Israel (`isr`) | PM Benjamin Netanyahu (caretaker) | Knesset election held 27 Oct 2026: Netanyahu bloc 53, Eisenkot bloc 48, Arab parties 19; no majority; official results by 4 Nov 2026 | Coalition talks open, a new PM is possible. Keep generic until a government stands. |
| Iran (`irn`) | Supreme Leader Mojtaba Khamenei (since 2026), President Masoud Pezeshkian | – | Volatile after the 2026 war. |
| Brazil (`bra`) | President Lula da Silva | Re-elected in the run-off on 25 Oct 2026, new term from 1 Jan 2027 | |
| Poland (`pol`) | PM Donald Tusk, President Karol Nawrocki | Parliamentary election autumn 2027 | Constitutional court dispute since 30 Oct 2026. |

## Weekly check (what the scheduled task does)
1. Search the news for every leader in both tables: still in office? Early election called, resignation, vote of no confidence, death?
2. Update the tables and "Last check"; add any election in the next 8 weeks to "Next date".
3. Tell the owner only when something changed or a change is due within 8 weeks (France from March 2027).
