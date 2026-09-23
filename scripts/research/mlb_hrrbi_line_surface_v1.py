#!/usr/bin/env python3
import csv
import hashlib
import io
import json
import math
import os
import urllib.request
import zipfile
from collections import defaultdict

SOURCE_URL = "https://www.retrosheet.org/downloads/2025/2025csvs.zip"
EXPECTED_SHA256 = "3d1e0e81d5913a635ae7a80366b811b777b832b488274124b4e38e04dd892753"
EXPECTED_REGULAR_BATTING_ROWS = 71550
EXPECTED_REGULAR_GAMES = 2430\nEXPECTED_ELIGIBLE_ROWS = 58410
EXPECTED_RBI_CONTROL = {"n": 2402, "wins": 2053}
EXPECTED_HRRBI_CONTROL = {"n": 2582, "wins": 2278}
EXPECTED_HRRBI_MONTHLY = {
    "2025-04": (303, 272),
    "2025-05": (442, 384),
    "2025-06": (471, 425),
    "2025-07": (489, 437),
    "2025-08": (393, 335),
    "2025-09": (484, 425),
}
EXPECTED_HRRBI_BASELINE = 0.7962335216572505
EXPECTED_RBI_BASELINE = 0.7913713405238829

MIN_PRIOR_GAMES = 10
RECENT_WINDOW = 10
GRID = [round(i * 0.05, 2) for i in range(1, 61)]  # 0.05..3.00
TARGETS = [
    ("UNDER", 0.5),
    ("OVER", 0.5),
    ("UNDER", 1.5),
    ("OVER", 1.5),
]

def fail(msg, **extra):
    payload = {"status": "FAIL_CLOSED", "error": msg, **extra}
    print(json.dumps(payload, indent=2, sort_keys=True))
    raise SystemExit(2)

def to_int(value):
    s = (value or "").strip()
    if not s:
        return 0
    try:
        return int(s)
    except ValueError:
        return int(float(s))

def wilson_lower(wins, n, z=1.959963984540054):
    if n <= 0:
        return None
    p = wins / n
    denom = 1 + z * z / n
    center = p + z * z / (2 * n)
    margin = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)
    return (center - margin) / denom

def line_win(outcome, direction, line):
    return outcome < line if direction == "UNDER" else outcome > line

def download():
    req = urllib.request.Request(
        SOURCE_URL,
        headers={
            "User-Agent": "PickAnalyzerResearch/1.0 (+research-only; exact-source-replay)",
            "Accept": "application/zip,application/octet-stream;q=0.9,*/*;q=0.1",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXPECTED_SHA256:
        fail(
            "RETROSHEET_ARCHIVE_SHA256_MISMATCH",
            expected=EXPECTED_SHA256,
            observed=digest,
            bytes=len(data),
        )
    return data, digest

def read_member(zf, suffix):
    matches = [name for name in zf.namelist() if name.endswith(suffix)]
    if len(matches) != 1:
        fail("ARCHIVE_MEMBER_NOT_UNIQUE", suffix=suffix, matches=matches)
    raw = zf.read(matches[0])
    return matches[0], raw

def load_rows(archive_bytes):
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as zf:
        batting_name, batting_bytes = read_member(zf, "2025batting.csv")
        team_name, _team_bytes = read_member(zf, "2025teamstats.csv")

    batting_text = batting_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(batting_text))
    all_rows = list(reader)
    stattypes = defaultdict(int)
    gametypes = defaultdict(int)
    for r in all_rows:
        stattypes[(r.get("stattype") or "").strip()] += 1
        gametypes[(r.get("gametype") or "").strip()] += 1

    rows = []
    for r in all_rows:
        if (r.get("stattype") or "").strip() != "value":
            continue
        if (r.get("gametype") or "").strip() != "regular":
            continue
        rows.append(
            {
                "gid": (r.get("gid") or "").strip(),
                "id": (r.get("id") or "").strip(),
                "date": (r.get("date") or "").strip(),
                "number": to_int(r.get("number")),
                "pa": to_int(r.get("b_pa")),
                "h": to_int(r.get("b_h")),
                "r": to_int(r.get("b_r")),
                "rbi": to_int(r.get("b_rbi")),
            }
        )

    if len(rows) != EXPECTED_REGULAR_BATTING_ROWS:
        fail(
            "REGULAR_BATTING_ROW_COUNT_MISMATCH",
            expected=EXPECTED_REGULAR_BATTING_ROWS,
            observed=len(rows),
            all_batting_rows=len(all_rows),
            stattypes=dict(sorted(stattypes.items())),
            gametypes=dict(sorted(gametypes.items())),
        )

    unique_games = len({r["gid"] for r in rows})
    if unique_games != EXPECTED_REGULAR_GAMES:
        fail(
            "REGULAR_GAME_COUNT_MISMATCH",
            expected=EXPECTED_REGULAR_GAMES,
            observed=unique_games,
            stattypes=dict(sorted(stattypes.items())),
            gametypes=dict(sorted(gametypes.items())),
        )

    return rows, {
        "batting_member": batting_name,
        "teamstats_member": team_name,
        "all_batting_rows": len(all_rows),
        "regular_value_rows": len(rows),
        "regular_games": unique_games,
        "stattype_counts": dict(sorted(stattypes.items())),
        "gametype_counts": dict(sorted(gametypes.items())),
    }

def component(history, event_key):
    last10 = history[-RECENT_WINDOW:]
    prior_pa = sum(x["pa"] for x in history)
    if prior_pa <= 0:
        return None
    prior_event = sum(x[event_key] for x in history)
    l10_pa_per_game = sum(x["pa"] for x in last10) / RECENT_WINDOW
    l10_event_per_game = sum(x[event_key] for x in last10) / RECENT_WINDOW
    return 0.50 * ((prior_event / prior_pa) * l10_pa_per_game) + 0.50 * l10_event_per_game

def build_eligible(rows):
    by_player = defaultdict(list)
    for r in rows:
        if not r["id"] or not r["date"]:
            continue
        by_player[r["id"]].append(r)

    eligible = []
    for player_id, games in by_player.items():
        games = sorted(games, key=lambda x: (x["date"], x["number"], x["gid"]))
        history = []
        for r in games:
            if len(history) >= MIN_PRIOR_GAMES:
                proj_h = component(history, "h")
                proj_r = component(history, "r")
                proj_rbi = component(history, "rbi")
                if proj_h is not None and proj_r is not None and proj_rbi is not None:
                    eligible.append(
                        {
                            "id": player_id,
                            "gid": r["gid"],
                            "date": r["date"],
                            "month": r["date"][:7],
                            "hrrbi_proj": proj_h + proj_r + proj_rbi,
                            "rbi_proj": proj_rbi,
                            "hrrbi": r["h"] + r["r"] + r["rbi"],
                            "rbi": r["rbi"],
                        }
                    )
            history.append(r)
    eligible.sort(key=lambda x: (x["date"], x["gid"], x["id"]))
    if len(eligible) != EXPECTED_ELIGIBLE_ROWS:
        fail(
            "ELIGIBLE_ROW_COUNT_MISMATCH",
            expected=EXPECTED_ELIGIBLE_ROWS,
            observed=len(eligible),
            unique_players=len(by_player),
        )
    return eligible

