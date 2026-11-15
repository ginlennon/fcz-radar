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
- `.github/workflows/update-data.yml` runs hourly, every 6h and weekly (see the cron comments). It commits `data/` only
  when something changed. It needs `permissions: contents: write` and the built-in token, nothing else.
- Trigger by hand with `gh workflow run update-data -f mode=full|seasons|quick`.
- GitHub disables scheduled workflows after 60 days without repo activity. The data commits normally keep it
  alive. If it stops, re-enable it in the Actions tab.

## Cache busting
When shell files (`app.js`, `styles.css`) change, bump `?v=N` in `index.html` **and** in `sw.js` (`SHELL` + `VERSION`).

## Never commit
Keys, tokens, cookies, account details, or personal paths/hostnames. The app needs none. Handoff notes
(`CATCH_UP_CURRENT.md`, `WORKLOG/`, `.claude/`) are local-only via `.git/info/exclude`.
