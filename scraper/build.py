#!/usr/bin/env python3
"""FCZ Radar data builder — stdlib only (runs unchanged in GitHub Actions).

Collects PUBLIC data only, needs no keys or accounts:
  * dbFCZ (www.dbfcz.ch, CC-BY 4.0): every season page -> matches, standings, players
  * FCZforum (fczforum.ch): the public forum index (trending, latest, most liked, stats)
  * FotMob public team endpoint: fixtures, league table, squad

Usage:
  python scraper/build.py --full     # crawl all dbFCZ seasons (≈220 polite requests)
  python scraper/build.py            # quick: home page, current season, forum, fotmob
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE = DATA / "dbfcz_seasons"
UA = "fcz-radar/1.0 (unofficial fan app; +https://github.com/ginlennon/fcz-radar)"
DB = "https://www.dbfcz.ch/"
DELAY = 0.8  # seconds between dbFCZ requests — be gentle with a hobby site


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def fetch(url: str, retries: int = 3) -> str:
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "de-CH,de"})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read().decode("utf-8", errors="replace")
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 + 3 * i)
    raise RuntimeError(f"fetch failed {url}: {last}")


def strip(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def clean_name(s: str) -> str:
    return strip(re.sub(r"<!--.*?-->", "", s, flags=re.S))


CHANGED: list[str] = []


def _sans_fetched(o):
    return {k: v for k, v in o.items() if k != "fetched"} if isinstance(o, dict) else o


def write_json(path: Path, obj, pretty=False) -> bool:
    """Write only when the content (ignoring a top-level 'fetched' stamp) changed -> fewer bot commits."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        try:
            if _sans_fetched(json.loads(path.read_text(encoding="utf-8"))) == _sans_fetched(
                    json.loads(json.dumps(obj, ensure_ascii=False))):
                return False
        except Exception:  # noqa: BLE001
            pass
    txt = json.dumps(obj, ensure_ascii=False, indent=1 if pretty else None,
                     separators=None if pretty else (",", ":"))
    path.write_text(txt + "\n", encoding="utf-8")
    CHANGED.append(path.name)
    return True


# ----------------------------------------------------------------------------- dbFCZ
SECTION_CODES = [
    ("weitere", "P"), ("Liga", "L"), ("Barrage", "L"), ("Final", "L"), ("Cup", "C"), ("Internat", "I"),
    ("Europ", "I"), ("Freundschaft", "F"), ("Test", "F"),
]


def section_code(title: str) -> str:
    t = title.lower()
    if "ligacup" in t:
        return "LC"
    for key, code in SECTION_CODES:
        if key.lower() in t:
            return code
    return "O"


def parse_date(d: str) -> str | None:
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", d.strip())
    if not m:
        return None
    return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"


def discover_seasons() -> list[int]:
    t = fetch(DB + "saison.php")
    decades = set(re.findall(r"saison_id=(\d+)&(?:amp;)?jz=(\d{4})\"", t))
    ids = set(int(x) for x in re.findall(r"saison_id=(\d+)", t))
    for sid, jz in sorted(decades, key=lambda x: x[1]):
        time.sleep(DELAY)
        d = fetch(f"{DB}saison.php?saison_id={sid}&jz={jz}")
        ids |= set(int(x) for x in re.findall(r"saison_id=(\d+)&(?:amp;)?jz=\d{4}&(?:amp;)?j=\d{4}", d))
        ids.add(int(sid))
    return sorted(ids)


def parse_season(sid: int) -> dict:
    full = fetch(f"{DB}saison.php?saison_id={sid}&m=1&c=1&lc=1&i=1&p=1&f=1&s=1")
    time.sleep(DELAY)
    base = fetch(f"{DB}saison.php?saison_id={sid}")
    out: dict = {"id": sid, "label": None, "league": None, "rank": None, "note": None,
                 "teams": {}, "matches": [], "players": []}
    m = re.search(r"Saison\s*</span>\s*([^<]+)</h2>", full)
    out["label"] = strip(m.group(1)) if m else str(sid)

    # standings (from the default view): first <h3> table after the season title
    a = base.find("</h2>")
    if a > 0:
        hm = re.search(r"<h3[^>]*>(.*?)</h3>(.*?)(?:<h3|</article>)", base[a:], re.S)
        if hm:
            out["league"] = strip(hm.group(1))[:80]
            rows = []
            for r in re.findall(r"<tr>(.*?)</tr>", hm.group(2), re.S):
                tds = [strip(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", r, re.S)]
                tm = re.search(r"team_id=(\d+)", r)
                if not tm or len(tds) < 8:
                    continue
                rk = re.sub(r"\D", "", tds[0])
                nums = [int(x) if x.isdigit() else 0 for x in tds[2:6]]
                pts = int(tds[7]) if tds[7].isdigit() else 0
                rows.append([int(rk) if rk else None, int(tm.group(1)), *nums, tds[6], pts,
                             tds[8] if len(tds) > 8 else ""])
                out["teams"][tm.group(1)] = tds[1]
            out["standings"] = rows
            if not rows:
                out["league"] = None
            for r in rows:
                if r[1] == 1:
                    out["rank"], out["note"] = r[0], r[8] or None
                    break
        txt = strip(base[a: base.find("<aside") if "<aside" in base else None])
        mm = re.search(r"Ligaspiele\s*:\s*(\d+)", txt)
        out["counts"] = {k: int(v) for k, v in re.findall(
            r"(Ligaspiele|Cupspiele|Freundschaftsspiele|Eingesetzte Spieler|internationale Spiele)\s*:\s*(\d+)", txt)}

    art = full[full.find("</h2>"):]
    art = art[: art.find("</article>")] if "</article>" in art else art
    # split into sections by <h3>
    parts = re.split(r"<h3[^>]*>", art)
    for part in parts[1:]:
        title = strip(part[: part.find("</h3>")])
        body = part[part.find("</h3>"):]
        if "spieler.php" in body and "spiel.php?spiel_id" not in body:
            for row in re.findall(r"<tr>(.*?)</tr>", body, re.S):
                pm = re.search(r'spieler\.php\?spieler_id=(\d+)">(.*?)</a>', row, re.S)
                if not pm:
                    continue
                nums = [strip(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)[1:]]
                n = [int(x) if x.isdigit() else 0 for x in nums]
                n += [0] * (11 - len(n))
                # cols: pflicht, liga, cup, int, test, -, -, goals(pflicht), goals liga, cup, int
                out["players"].append([int(pm.group(1)), clean_name(pm.group(2)),
                                       n[0], n[1], n[2], n[3], n[4], n[7], n[8], n[9], n[10]])
            continue
        code = section_code(title)
        for row in re.findall(r"<tr>(.*?)</tr>", body, re.S):
            mm = re.search(r'spiel\.php\?spiel_id=(\d+)">([^<]+)</a>', row)
            teams = re.findall(r'team\.php\?team_id=(\d+)">([^<]+)</a>', row)
            if not mm or len(teams) < 2:
                continue
            cells = re.findall(r"<td[^>]*>(.*?)(?=</td>|<td|$)", row, re.S)
            score_raw = strip(cells[2]) if len(cells) > 2 else ""
            sm = re.search(r"(\d+)\s*:\s*(\d+)", score_raw)
            leg = re.search(r'class="legende">(.*?)(?:</td>|</tr>|$)', row, re.S)
            detail = strip(leg.group(1)) if leg else ""
            extra = score_raw[sm.end():].strip() if sm else score_raw
            for tid, tname in teams[:2]:
                out["teams"][tid] = html.unescape(tname).strip()
            out["matches"].append([
                int(mm.group(1)), parse_date(mm.group(2)), int(teams[0][0]), int(teams[1][0]),
                int(sm.group(1)) if sm else None, int(sm.group(2)) if sm else None,
                code, detail[:70], extra[:30],
            ])
    return out


def parse_home() -> dict:
    t = fetch(DB + "index.php")
    res: dict = {"birthdays": [], "deaths": [], "today": None, "total": None, "range": None}

    def rows(block):
        out = []
        for r in re.findall(r"<tr>(.*?)</tr>", block, re.S):
            pm = re.search(r'spieler_id=(\d+)">([^<]+)</a>', r)
            tds = [strip(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", r, re.S)]
            if pm and len(tds) >= 3:
                out.append({"id": int(pm.group(1)), "name": html.unescape(pm.group(2)),
                            "date": parse_date(tds[1]), "years": int(re.sub(r"\D", "", tds[2]) or 0)})
        return out

    g = t.find("Geburtstage aktuell")
    d = t.find("Todestage aktuell")
    if g > 0:
        res["birthdays"] = rows(t[g: d if d > 0 else g + 6000])
    if d > 0:
        res["deaths"] = rows(t[d: t.find("</table>", d) + 8])
    hm = re.search(r"<h3>Heute vor ([^<]+)</h3>\s*<p[^>]*>(.*?)</p>", t, re.S)
    if hm:
        sm = re.search(r"spiel_id=(\d+)", hm.group(2))
        res["today"] = {"title": "Heute vor " + strip(hm.group(1)), "text": strip(hm.group(2)),
                        "spiel_id": int(sm.group(1)) if sm else None}
    tm = re.search(r"Total:\s*(\d+)\s*Spiele", t)
    res["total"] = int(tm.group(1)) if tm else None
    titles = {}
    for label in ["Schweizer Meister", "Cupsiege", "Meister ChL / NLB / 1. Liga", "Ligacup-Siege"]:
        mm = re.search(re.escape(label) + r"\s*(?:<span[^>]*>)?\s*\((\d+)\)\s*(?:</span>)?\s*</h3>\s*<p>(.*?)</p>", t, re.S)
        if mm:
            titles[label] = [int(y) for y in re.findall(r"\b(1[89]\d\d|20\d\d)\b", strip(mm.group(2)))]
    res["titles"] = titles
    hof = re.search(r"Hall of Fame.*?</p>", t, re.S)
    if hof:
        res["hall_of_fame"] = [{"id": int(i), "name": html.unescape(n)} for i, n in
                               re.findall(r'spieler_id=(\d+)">([^<]+)</a>', hof.group(0))]
    return res


def build_db(full: bool):
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = {int(p.stem): p for p in CACHE.glob("*.json")}
    if full or not cached:
        ids = discover_seasons()
        todo = ids
    else:
        ids = sorted(cached)
        # refresh the most recent season (highest last match date) + any season touched this year
        recent = []
        for sid, p in cached.items():
            s = json.loads(p.read_text())
            last = max((m[1] or "" for m in s["matches"]), default="")
            recent.append((last, sid))
        recent.sort(reverse=True)
        todo = [sid for _, sid in recent[:2]]
        # also probe for a brand-new season id
        try:
            todo += [i for i in discover_seasons() if i not in cached]
        except Exception as e:  # noqa: BLE001
            log("discover failed", e)
    for n, sid in enumerate(todo, 1):
        try:
            s = parse_season(sid)
            old_p = CACHE / f"{sid}.json"
            if old_p.exists():  # guard against silent data loss from a broken/blocked page
                old = json.loads(old_p.read_text())
                if len(s["matches"]) < 0.9 * len(old["matches"]) or (old["players"] and not s["players"]):
                    raise RuntimeError(f"refusing to shrink season {sid}: {len(old['matches'])} -> {len(s['matches'])}")
            write_json(CACHE / f"{sid}.json", s)
            log(f"[{n}/{len(todo)}] season {sid} {s['label']}: {len(s['matches'])} matches, {len(s['players'])} players")
        except Exception as e:  # noqa: BLE001
            log("season fail", sid, e)
        time.sleep(DELAY)
    assemble_db()


def assemble_db():
    seasons, teams, matches, pseason = [], {}, {}, {}
    pnames: dict[int, str] = {}
    for p in sorted(CACHE.glob("*.json")):
        s = json.loads(p.read_text())
        if not s["matches"] and not s["players"]:
            continue
        teams.update({int(k): v for k, v in s["teams"].items()})
        for m in s["matches"]:
            row = [m[0], m[1], s["id"], *m[2:]]
            if row[7] == "O" and re.search(r"cup|league|ifc|uefa|messe|intertoto|mitropa|europa|champions",
                                            row[8] or "", re.I):  # older cache: "internationale Spiele" section
                row[7] = "I"
            matches[m[0]] = row
        start = min((m[1] for m in s["matches"] if m[1]), default=None)
        seasons.append({"id": s["id"], "label": s["label"], "league": s.get("league"), "rank": s.get("rank"),
                        "note": s.get("note"), "standings": s.get("standings"), "start": start,
                        "n": len(s["matches"])})
        for pl in s["players"]:
            pid = pl[0]
            pnames[pid] = pl[1]
            pseason.setdefault(pid, []).append([s["id"], *pl[2:]])
    seasons.sort(key=lambda x: (x["start"] or "", x["id"]))
    order = {s["id"]: i for i, s in enumerate(seasons)}
    players = []
    for pid, rows in pseason.items():
        rows.sort(key=lambda r: order.get(r[0], 0))
        tot = [sum(r[i] for r in rows) for i in range(1, 10)]
        # [id, name, pflicht apps, liga apps, pflicht goals, liga goals, test apps, first sid, last sid, n seasons]
        players.append([pid, pnames[pid], tot[0], tot[1], tot[5], tot[6], tot[4], rows[0][0], rows[-1][0], len(rows)])
    players.sort(key=lambda p: -p[2])
    ms = sorted(matches.values(), key=lambda m: (m[1] or "", m[0]))
    write_json(DATA / "db.json", {
        "source": "dbFCZ – www.dbfcz.ch (CC-BY 4.0)",
        "fields": {"match": "id,date,season,home,away,hg,ag,comp(L/C/I/F/LC/O),detail,extra",
                   "player": "id,name,pflicht,liga,goals,ligaGoals,tests,firstSeason,lastSeason,nSeasons"},
        "seasons": seasons, "teams": teams, "matches": ms, "players": players,
    })
    write_json(DATA / "player_seasons.json", pseason)
    log(f"db.json: {len(seasons)} seasons, {len(ms)} matches, {len(players)} players, {len(teams)} teams")


# ----------------------------------------------------------------------------- forum
def build_forum():
    t = fetch("https://fczforum.ch/forum")
    m = re.search(r'<script data-page="app" type="application/json">(.*?)</script>', t, re.S)
    p = json.loads(m.group(1))["props"]
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    # NOTE: deliberately NOT copying supporterNames (contains e-mail addresses) or avatar URLs.
    forums = [{
        "name": f["name"], "slug": f["slug"], "description": f.get("description"),
        "topics": f.get("topicsCount"), "posts": f.get("postsCount"), "membersOnly": f.get("membersOnly"),
        "latest": ({k: f["latestPost"].get(k) for k in ("topicTitle", "topicSlug", "authorName", "createdAt", "url")}
                   if f.get("latestPost") else None),
    } for f in p.get("forums", [])]
    trending = [{k: x.get(k) for k in ("title", "slug", "recentPostsCount", "starterName", "forumName")}
                for x in p.get("trending", [])]
    liked = [{k: x.get(k) for k in ("id", "excerpt", "likes", "authorName", "topicTitle", "topicId", "url")}
             for x in p.get("mostLiked", [])]
    ann = [{k: x.get(k) for k in ("title", "slug", "postsCount", "starterName", "forumName", "createdAt")}
           for x in p.get("announcements", [])]
    snap = {"fetched": now, "forums": forums, "trending": trending, "mostLiked": liked, "announcements": ann,
            "stats": p.get("stats"), "matchMood": p.get("matchMood"), "guests": p.get("guests"),
            "online": len(p.get("online") or [])}
    write_json(DATA / "forum.json", snap)

    # rolling archive: every topic we have ever seen on the index (makes forum topics searchable)
    ap = DATA / "forum_archive.json"
    arch = json.loads(ap.read_text()) if ap.exists() else {"topics": {}, "mood": []}
    def seen(slug, title, forum, author=None, at=None, heat=0):
        if not slug:
            return
        e = arch["topics"].setdefault(slug, {"title": title, "forum": forum, "first": now, "heat": 0})
        e.pop("n", None)
        e.update(title=title, forum=forum or e.get("forum"))
        e["heat"] = max(e.get("heat", 0), heat or 0)
        if at and at != e.get("lastPost"):
            e["last"] = at
        e.setdefault("last", at or now)
        if author:
            e["author"] = author
        if at:
            e["lastPost"] = at
    for f in forums:
        if f["latest"]:
            seen(f["latest"]["topicSlug"], f["latest"]["topicTitle"], f["name"], f["latest"]["authorName"],
                 f["latest"]["createdAt"])
    for x in trending:
        seen(x["slug"], x["title"], x["forumName"], heat=x.get("recentPostsCount"))
    for x in ann:
        seen(x["slug"], x["title"], x["forumName"], at=x.get("createdAt"))
    # post excerpts are NOT archived (only shown while they are on the forum front page)
    arch.pop("liked", None)
    mm = p.get("matchMood")
    last = arch["mood"][-1] if arch["mood"] else None
    if mm and (not last or last[1] != mm.get("score") or
               (dt.datetime.fromisoformat(now) - dt.datetime.fromisoformat(last[0])).total_seconds() > 6 * 3600):
        arch["mood"].append([now, mm.get("score"), mm.get("emoji")])
        arch["mood"] = arch["mood"][-500:]
    write_json(ap, arch)
    log(f"forum: {len(forums)} forums, {len(trending)} trending, archive {len(arch['topics'])} topics")


# ----------------------------------------------------------------------------- fotmob
FM_TEAM = 10243


def build_fotmob():
    d = json.loads(fetch(f"https://www.fotmob.com/api/data/teams?id={FM_TEAM}"))
    fx = []
    for f in d.get("fixtures", {}).get("allFixtures", {}).get("fixtures", []):
        st = f.get("status", {})
        fx.append({"id": f.get("id"), "url": "https://www.fotmob.com" + (f.get("pageUrl") or ""),
                   "utc": st.get("utcTime"), "home": f["home"]["name"], "homeId": f["home"]["id"],
                   "away": f["away"]["name"], "awayId": f["away"]["id"],
                   "hs": f["home"].get("score"), "as": f["away"].get("score"),
                   "finished": st.get("finished"), "started": st.get("started"),
                   "cancelled": st.get("cancelled"), "score": st.get("scoreStr"),
                   "tournament": (f.get("tournament") or {}).get("name"), "result": f.get("result")})
    table = []
    tab = (d.get("table") or [{}])[0].get("data", {})
    legend = tab.get("legend") or []
    for r in (tab.get("table") or {}).get("all", []):
        table.append({k: r.get(k) for k in ("idx", "name", "shortName", "id", "played", "wins", "draws", "losses",
                                            "scoresStr", "goalConDiff", "pts", "qualColor")})
    squad = []
    for g in d.get("squad", {}).get("squad", []):
        for mbr in g.get("members", []):
            squad.append({"group": g.get("title"), "name": mbr.get("name"), "id": mbr.get("id"),
                          "no": mbr.get("shirtNumber"), "age": mbr.get("age"), "cc": mbr.get("ccode"),
                          "country": mbr.get("cname"), "pos": mbr.get("positionIdsDesc"),
                          "goals": mbr.get("goals"), "assists": mbr.get("assists"), "rating": mbr.get("rating"),
                          "yc": mbr.get("ycards"), "rc": mbr.get("rcards"), "height": mbr.get("height"),
                          "injury": (mbr.get("injury") or {}).get("expectedReturn") if mbr.get("injury") else None})
    ov = d.get("overview", {})
    venue = (ov.get("venue") or {}).get("widget") or {}
    out = {"fetched": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
           "source": "FotMob", "teamId": FM_TEAM, "league": tab.get("leagueName"),
           "ics": f"https://pub.fotmob.com/prod/pub/api/v2/calendar/team/{FM_TEAM}.ics",
           "fixtures": fx, "table": table,
           "legend": [{"title": x.get("title"), "color": x.get("color")} for x in legend],
           "squad": squad, "venue": {"name": venue.get("name"), "city": venue.get("city")}}
    write_json(DATA / "fotmob.json", out)
    log(f"fotmob: {len(fx)} fixtures, {len(table)} table rows, {len(squad)} squad")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true", help="crawl all dbFCZ seasons")
    ap.add_argument("--only", help="comma list of steps: home,forum,fotmob,db,assemble")
    a = ap.parse_args()
    steps = {
        "home": lambda: write_json(DATA / "dbfcz_home.json", parse_home()),
        "db": lambda: build_db(a.full),
        "forum": build_forum,
        "fotmob": build_fotmob,
        "assemble": assemble_db,
    }
    run = a.only.split(",") if a.only else ["home", "forum", "fotmob", "db"]
    meta_p = DATA / "meta.json"
    meta = json.loads(meta_p.read_text()) if meta_p.exists() else {}
    ok = True
    for s in run:
        try:
            steps[s]()
            meta[s] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        except Exception as e:  # noqa: BLE001  one broken source must not kill the rest
            ok = False
            log(f"STEP {s} FAILED: {e}")
    if CHANGED:
        meta["changed"] = sorted(set(CHANGED))
        write_json(meta_p, meta, pretty=True)
    log("changed:", CHANGED or "nothing")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
