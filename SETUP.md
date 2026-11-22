# Setup / operating

## Run locally
```bash
python3 scraper/build.py --full                     # first time: crawl all dbFCZ seasons (~4 min, ~220 requests)
python3 scraper/build.py                            # normal refresh (home, forum, fotmob, current seasons, players)
python3 scraper/build.py --only home,forum,fotmob   # quick refresh
python3 scraper/build.py --only players          # dbFCZ player pages (first run ~928 pages, ~20 min)
python3 scraper/build.py --only assemble            # rebuild data/db.json from the season cache only
python3 -m http.server 8917 --bind 127.0.0.1        # then open http://127.0.0.1:8917/
```
Python 3.10+ with the standard library only. No pip installs are needed.

## Deploy
- Repo `ginlennon/fcz-radar` is **public**. GitHub Pages serves branch `main` from the root at
  https://ginlennon.github.io/fcz-radar/.
- `.github/workflows/update-data.yml` (commits `data/` only when something changed; needs `permissions: contents:
  write` and the built-in token, nothing else):
  - every 6h: forum, FotMob, dbFCZ home + current seasons; weekly (Mon 03:23 UTC): full dbFCZ re-crawl.
  - every 30 min a `gate` job runs `scraper/postmatch_window.py`: from kickoff+2h to kickoff+8h of an FCZ match
    (kickoffs from `data/fotmob.json`) it does a quick refresh (home, forum, fotmob); otherwise it stops in ~5 s.
    GitHub drops many scheduled runs, so expect roughly hourly refreshes in the window, not every 30 min.
  - Test the window: `python3 scraper/postmatch_window.py --now 2026-11-08T19:00Z`.
- Trigger by hand with `gh workflow run update-data.yml -R ginlennon/fcz-radar -f mode=quick|seasons|full`, or from the
  GitHub mobile app: Actions → update-data → Run workflow.
- GitHub disables scheduled workflows after 60 days without repo activity. The data commits normally keep it
  alive. If it stops, re-enable it in the Actions tab.

## Cache busting
When shell files (`app.js`, `styles.css`) change, bump `?v=N` in `index.html` **and** in `sw.js` (`SHELL` + `VERSION`).

## Never commit
Keys, tokens, cookies, account details, or personal paths/hostnames. The app needs none. Handoff notes
(`CATCH_UP_CURRENT.md`, `WORKLOG/`, `.claude/`) are local-only via `.git/info/exclude`.
