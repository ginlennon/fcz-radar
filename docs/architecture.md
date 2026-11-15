# Architecture

```
GitHub Action (cron) ──> scraper/build.py ──> data/*.json ──> git push ──> GitHub Pages
                                                                   │
phone browser ── index.html + app.js ── fetch data/*.json ─────────┘
              └─ live (CORS ok, no key): Mastodon API @dbFCZ, Wikipedia REST summary
```

## Data files
| file | source | content |
|---|---|---|
| `data/db.json` | dbFCZ season pages | `seasons[]` (label, league, rank, note, standings), `teams{id:name}`, `matches[]`, `players[]` |
| `data/player_seasons.json` | dbFCZ | `{playerId: [[seasonId, pflicht, liga, cup, int, test, goals, ligaGoals, cupGoals, intGoals]]}` (lazy-loaded) |
| `data/dbfcz_seasons/` | dbFCZ | raw per-season parse (cache for incremental refresh) |
| `data/player_details.json` | dbFCZ player pages | `players{id: row}`: birth/death, nationality, position, minutes, subs, assists, cards, first/last match. Field order in `fields`. `fetched_at` drives the refresh (lazy-loaded) |
| `data/dbfcz_home.json` | dbFCZ start page | birthdays, anniversaries, titles, hall of fame |
| `data/forum.json` | fczforum.ch/forum (Inertia `data-page` JSON) | sections, trending, most liked, stats, match mood |
| `data/forum_archive.json` | accumulated | every topic seen on the front page + match-mood history (post excerpts are deliberately NOT archived) |
| `data/fotmob.json` | FotMob team endpoint | fixtures, table, squad, ICS link |

Row layouts are compact arrays. The field order is written in `db.json → fields`.
match = `[id, date, seasonId, homeTeamId, awayTeamId, homeGoals, awayGoals, comp(L/C/I/F/LC), detail, extra]`.
dbFCZ team id 1 = FCZ.

## Source quirks
- dbFCZ search only accepts **POST** (`suche_string`, `suche_radio`), so the app submits a hidden form with `target=_blank`.
- dbFCZ player names may contain HTML comments (`Name<!-- 24 FCZ -->`), which are stripped.
- Season page: `&m=1&c=1&lc=1&i=1&f=1&s=1` expands all match lists and players. The default view holds the standings.
- Player pages (`spieler.php?spieler_id=`) carry what the season pages lack: minutes, first/last match, assists, cards,
  subs. `build_players` fetches missing players, refreshes players of the last two seasons once a day and everyone else
  after 30 days (at most 60 per run; `--full` lifts the cap). Assists, cards and minutes are patchy for early decades.
- The forum shows guests only `/forum`. Every other route redirects (302), so topic links need a forum login and
  the forum has no guest search. The app's "Themen-Radar" archive and Google `site:` fill that gap.
- FotMob `api/data/teams?id=10243` is unofficial. The ICS link `pub.fotmob.com/.../calendar/team/10243.ics` is meant
  for public subscription.

## Front end
A hash router (`#/heute`, `#/saison?t=`, `#/archiv?m=&c=&d=&o=&tag=`, `#/gegner/:id`, `#/saisonarchiv/:id`,
`#/spieler?s=&o=&pos=&d=&min=&akt=&f=` (ranking mask, metrics in `METRICS`), `#/spieler/:id`, `#/vergleich/:a/:b` (0 = not chosen yet), `#/forum`, `#/spiel/:id` as a bottom sheet). Search runs over an in-memory index
built on first open.
