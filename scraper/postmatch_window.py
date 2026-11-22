#!/usr/bin/env python3
"""Decide whether we are in a post-match window (stdlib only; used by the update-data gate).

A window opens 2h after an FCZ kickoff (about the final whistle) and closes 8h after it,
which gives roughly 6 hours of quick refreshes after each match. Kickoff times come from
the committed data/fotmob.json, which the 6-hourly run keeps current (postponements included).

Prints "yes" or "no" plus the match it matched. Exit code 0 = in a window, 1 = not.

  python scraper/postmatch_window.py
  python scraper/postmatch_window.py --now 2026-11-08T19:00Z    # test with a fake "now"
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

FOTMOB = Path(__file__).resolve().parent.parent / "data" / "fotmob.json"
OPEN_AFTER = dt.timedelta(hours=2)
CLOSE_AFTER = dt.timedelta(hours=8)


def parse_utc(s: str) -> dt.datetime:
    s = s.strip().replace("Z", "+00:00")
    t = dt.datetime.fromisoformat(s)
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def find_window(now: dt.datetime, fixtures: list[dict]) -> dict | None:
    for f in fixtures:
        if f.get("cancelled") or not f.get("utc"):
            continue
        kickoff = parse_utc(f["utc"])
        if kickoff + OPEN_AFTER <= now <= kickoff + CLOSE_AFTER:
            return f
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--now", help="ISO time to test with instead of the current UTC time")
    args = ap.parse_args()
    now = parse_utc(args.now) if args.now else dt.datetime.now(dt.timezone.utc)
    try:
        fixtures = json.loads(FOTMOB.read_text(encoding="utf-8")).get("fixtures") or []
    except (OSError, ValueError) as e:
        print(f"no (cannot read {FOTMOB.name}: {e})")
        return 1
    f = find_window(now, fixtures)
    if f:
        print(f"yes: {f['home']} - {f['away']}, kickoff {f['utc']}")
        return 0
    print(f"no post-match window at {now:%Y-%m-%dT%H:%MZ}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
