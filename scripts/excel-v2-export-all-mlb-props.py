#!/usr/bin/env python3
import csv
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

BASE = "https://api.the-odds-api.com/v4"
SPORT = "baseball_mlb"
BOOKMAKERS = "fanduel,williamhill_us"
TZ = ZoneInfo("America/Puerto_Rico")
TARGET_DATE = os.environ.get("TARGET_DATE", "2026-09-15")
OUT = Path(os.environ.get("OUT_DIR", "data/excel-v2-all-props"))
KEY = os.environ.get("THE_ODDS_API_KEY", "").strip()

if not KEY:
    raise SystemExit("THE_ODDS_API_KEY is not configured")

OUT.mkdir(parents=True, exist_ok=True)
quota = {"calls": 0, "last": None, "remaining": None, "used": None}


def get_json(path: str, params: dict):
    clean_params = dict(params)
    clean_params["apiKey"] = KEY
    url = f"{BASE}{path}?{urlencode(clean_params)}"
    req = Request(url, headers={"User-Agent": "pick-analyzer-excel-v2/1.0"})
    with urlopen(req, timeout=45) as resp:
        body = resp.read().decode("utf-8")
        quota["calls"] += 1
        for src, dst in [
            ("x-requests-last", "last"),
            ("x-requests-remaining", "remaining"),
            ("x-requests-used", "used"),
        ]:
            value = resp.headers.get(src)
            if value is not None:
                try:
                    quota[dst] = int(value)
                except ValueError:
                    quota[dst] = value
        return json.loads(body)


def pr_date(iso: str):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(TZ)


def market_type(key: str):
    if key.endswith("_alternate"):
        return "ALTERNATE"
    if key in {"batter_first_home_run", "pitcher_record_a_win"}:
        return "SPECIAL"
    return "MAIN"


def market_label(key: str):
    labels = {
        "batter_home_runs": "Batter Home Runs",
        "batter_first_home_run": "First Home Run",
        "batter_hits": "Batter Hits",
        "batter_total_bases": "Batter Total Bases",
        "batter_rbis": "Batter RBIs",
        "batter_runs_scored": "Batter Runs Scored",
        "batter_hits_runs_rbis": "Hits + Runs + RBIs",
        "batter_singles": "Batter Singles",
        "batter_doubles": "Batter Doubles",
        "batter_triples": "Batter Triples",
        "batter_walks": "Batter Walks",
        "batter_strikeouts": "Batter Strikeouts",
        "batter_stolen_bases": "Batter Stolen Bases",
        "batter_fantasy_score": "Batter Fantasy Score",
        "pitcher_strikeouts": "Pitcher Strikeouts",
        "pitcher_record_a_win": "Pitcher Record a Win",
        "pitcher_hits_allowed": "Pitcher Hits Allowed",
        "pitcher_walks": "Pitcher Walks",
        "pitcher_earned_runs": "Pitcher Earned Runs",
        "pitcher_outs": "Pitcher Outs",
    }
    base = key[:-10] if key.endswith("_alternate") else key
    label = labels.get(base, base.replace("_", " ").title())
    return f"{label} (Alternate)" if key.endswith("_alternate") else label


# 1) Current MLB event list is free and avoids hard-coding provider event IDs.
events = get_json(f"/sports/{SPORT}/events", {"dateFormat": "iso"})
selected = []
for event in events:
    dt = pr_date(event["commence_time"])
    if dt.date().isoformat() == TARGET_DATE:
        selected.append(event)

if not selected:
    raise SystemExit(f"No MLB events found for {TARGET_DATE} Puerto Rico time")

all_rows = []
inventory_rows = []
raw_markets = {}
raw_odds = {}

# 2) Discover the markets actually open for each book/event before requesting odds.
for event in selected:
    event_id = event["id"]
    discovered = get_json(
        f"/sports/{SPORT}/events/{event_id}/markets",
        {"bookmakers": BOOKMAKERS, "dateFormat": "iso"},
    )
    raw_markets[event_id] = discovered

    prop_keys = set()
    for book in discovered.get("bookmakers", []):
        for market in book.get("markets", []):
            key = market.get("key", "")
            if key.startswith("batter_") or key.startswith("pitcher_"):
                prop_keys.add(key)
                inventory_rows.append({
                    "event_id": event_id,
                    "date_pr": pr_date(event["commence_time"]).date().isoformat(),
                    "time_pr": pr_date(event["commence_time"]).strftime("%-I:%M %p"),
                    "matchup": f"{event['away_team']} @ {event['home_team']}",
                    "bookmaker_key": book.get("key"),
                    "bookmaker": book.get("title"),
                    "market_key": key,
                    "market": market_label(key),
                    "market_type": market_type(key),
                    "last_update": market.get("last_update"),
                })

    if not prop_keys:
        continue

    # One event-odds call for all discovered prop markets. Quota is charged only for
    # markets actually returned by the provider.
    payload = get_json(
        f"/sports/{SPORT}/events/{event_id}/odds",
        {
            "bookmakers": BOOKMAKERS,
            "markets": ",".join(sorted(prop_keys)),
            "oddsFormat": "american",
            "dateFormat": "iso",
        },
    )
    raw_odds[event_id] = payload

    event_dt = pr_date(payload["commence_time"])
    matchup = f"{payload['away_team']} @ {payload['home_team']}"
    for book in payload.get("bookmakers", []):
        for market in book.get("markets", []):
            mkey = market.get("key")
            for outcome in market.get("outcomes", []):
                all_rows.append({
                    "date_pr": event_dt.date().isoformat(),
                    "time_pr": event_dt.strftime("%-I:%M %p"),
                    "event_id": event_id,
                    "matchup": matchup,
                    "away_team": payload.get("away_team"),
                    "home_team": payload.get("home_team"),
                    "bookmaker_key": book.get("key"),
                    "bookmaker": book.get("title"),
                    "market_key": mkey,
                    "market": market_label(mkey),
                    "market_type": market_type(mkey),
                    "player": outcome.get("description") or outcome.get("name"),
                    "side": outcome.get("name"),
                    "line": outcome.get("point"),
                    "american_odds": outcome.get("price"),
                    "last_update": market.get("last_update"),
                })

# Deterministic ordering for Excel ingestion.
all_rows.sort(key=lambda r: (
    r["time_pr"], r["matchup"], r["bookmaker"], r["market"],
    r["player"] or "", -999 if r["line"] is None else float(r["line"]), r["side"] or ""
))
inventory_rows.sort(key=lambda r: (r["bookmaker"], r["market"], r["matchup"]))

fields = [
    "date_pr","time_pr","event_id","matchup","away_team","home_team",
    "bookmaker_key","bookmaker","market_key","market","market_type",
    "player","side","line","american_odds","last_update"
]
with (OUT / "all_player_props.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader(); w.writerows(all_rows)

inv_fields = [
    "event_id","date_pr","time_pr","matchup","bookmaker_key","bookmaker",
    "market_key","market","market_type","last_update"
]
with (OUT / "market_inventory.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=inv_fields)
    w.writeheader(); w.writerows(inventory_rows)

(OUT / "all_player_props.json").write_text(json.dumps(all_rows, ensure_ascii=False, indent=2), encoding="utf-8")
(OUT / "raw_market_discovery.json").write_text(json.dumps(raw_markets, ensure_ascii=False), encoding="utf-8")
(OUT / "raw_event_odds.json").write_text(json.dumps(raw_odds, ensure_ascii=False), encoding="utf-8")

counts = Counter((r["bookmaker"], r["market_key"]) for r in all_rows)
summary = {
    "target_date_pr": TARGET_DATE,
    "events": len(selected),
    "rows": len(all_rows),
    "quota": quota,
    "bookmaker_rows": dict(Counter(r["bookmaker"] for r in all_rows)),
    "markets": [
        {"bookmaker": book, "market_key": market, "rows": n}
        for (book, market), n in sorted(counts.items())
    ],
}
(OUT / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

print(json.dumps({
    "events": summary["events"],
    "rows": summary["rows"],
    "bookmaker_rows": summary["bookmaker_rows"],
    "provider_calls": quota["calls"],
    "requests_last": quota["last"],
    "requests_remaining": quota["remaining"],
}, indent=2))
