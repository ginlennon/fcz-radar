# FCZ Radar

**Live:** https://ginlennon.github.io/fcz-radar/

FCZ Radar is an unofficial, mobile-first fan app. It is a single static page that brings search and information from
two fan sources together, alongside current season data:

- **[dbFCZ](https://www.dbfcz.ch)**: the database of every FC Zürich match since 1920 (CC-BY 4.0)
- **[FCZforum](https://fczforum.ch/forum)**: the public forum front page (trending, latest, most liked, match mood)
- **FotMob** (fixtures, table, squad), **Mastodon @dbFCZ** and **Wikipedia**, loaded live

It is not affiliated with FC Zürich. No club logo is used as branding.

## Goals / design decisions
- **One search box for everything.** Players, opponents, seasons, dates (`14.11.`), results (`5:0`), years (`1981`),
  forum topics and the current squad. Hand-offs to dbFCZ (POST search) and to the forum (via Google `site:`) are
  one tap away.
- **Static only, no keys.** GitHub Pages serves the page. A scheduled GitHub Action rebuilds `data/*.json` from
  public pages using only the built-in `GITHUB_TOKEN`. Nothing secret is stored anywhere.
- **Be gentle with hobby sites.** dbFCZ is crawled fully once a week, with a delay between requests. Otherwise only
  the current seasons are refreshed (every 6h). The forum front page is read once an hour.
- **Privacy / respect.** Only data that is already public on the forum front page is used. Supporter names (which
  contain e-mail addresses), avatar URLs and post excerpts are never archived. Club crests are not hotlinked;
  neutral monograms are used instead. There are no cookies and no tracking. The footer links an issue tracker for
  takedown requests.
- **Rank anything.** The Spieler tab is a sortable mask over the whole archive (games, goals, minutes, minutes per
  goal, time at the club in weeks, age at debut, subs, cards) with position, decade and minimum-games filters.
- **Phone first.** Bottom tab bar, bottom-sheet details, works offline (service worker), installable (PWA).
- **Review process.** The draft went through three rounds of design and feature review by a Fable subagent
  (2026-11-14). Results: a match-day hero, combo search, a daily quiz, provisional FotMob results bridging the dbFCZ lag,
  and a hygiene pass for a public site.

## Success bar
- Opens in under 2 s on a phone over 4G, and the search answers as you type.
- Every view deep-links (`#/spieler/6`, `#/gegner/13`, `#/saisonarchiv/89`), so it can be shared.
- Data is never more than about 1 h (forum) or about 6 h (season) old while the Action runs.

## Layout
`index.html`, `styles.css` and `app.js` make up the whole app (vanilla JS, no build step). `scraper/build.py` is the
data builder (Python stdlib only). `data/` holds the generated JSON. See `docs/architecture.md` and `SETUP.md`.

## Credits / licences
Match, player and season data © dbFCZ, CC-BY 4.0. Forum excerpts and titles © their authors on fczforum.ch.
Fixtures, table and squad come from FotMob. Code: MIT.
