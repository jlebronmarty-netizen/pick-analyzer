"""Offline research archive. Run with Python 3.11+ and sanitized local input files."""
import argparse
import json
import math
import sqlite3
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

LEAGUES = {"basketball_ncaab": "NCAAB", "americanfootball_ncaaf": "NCAAF"}
ALIASES = {("NCAAB", "indiana st sycamores"): "indiana state sycamores"}


def timestamp(value):
    t = datetime.fromisoformat(value)
    if t.tzinfo is None:
        raise ValueError("Timezone required")
    return t.astimezone(timezone.utc)


def team(league, name):
    key = " ".join(name.casefold().replace(".", "").split())
    if not key:
        raise ValueError("Empty team name")
    return ALIASES.get((league, key), key)


def number(value):
    return type(value) in (int, float) and math.isfinite(value)


def evaluate(capture, forecasts):
    league = LEAGUES[capture["sport_key"]]
    seen = timestamp(capture["captured_at"])
    counts = Counter()
    accepted = []
    ids = set()
    matched_ids = {}
    for event in capture["events"]:
        eid = event["id"]
        if not eid or eid in ids or event["sport_key"] != capture["sport_key"]:
            raise ValueError("Invalid provider event identity")
        ids.add(eid)
        start = timestamp(event["commence_time"])
        home, away = (team(league, event[k]) for k in ("home_team", "away_team"))
        matches = [f for f in forecasts if f["league"] == league
                   and team(league, f["home"]) == home and team(league, f["away"]) == away
                   and abs((timestamp(f["scheduled_at"]) - start).total_seconds()) <= 600
                   and timestamp(f["frozen_at"]) <= seen]
        if home == away or len(matches) != 1:
            counts["missing_or_ambiguous_forecast"] += 1
            continue
        f = matches[0]
        if f["event_id"] in matched_ids:
            raise ValueError("Multiple provider events match one Pick event")
        matched_ids[f["event_id"]] = eid
        if seen >= min(start, timestamp(f["scheduled_at"])):
            counts["post_start_event"] += 1
            continue
        keys = set()
        for book in event["bookmakers"]:
            for market in book["markets"]:
                kind = market["key"]
                if kind not in ("spreads", "totals"):
                    continue
                key = (book["key"], kind)
                if not key[0] or key in keys:
                    raise ValueError("Invalid or duplicated bookmaker market")
                keys.add(key)
                try:
                    updated = timestamp(market["last_update"])
                except (KeyError, ValueError, TypeError):
                    counts["invalid_market_time"] += 1
                    continue
                if updated > seen:
                    counts["future_market_time"] += 1
                    continue
                outcomes = market["outcomes"]
                if len(outcomes) != 2 or not all(
                    number(o.get("point")) and type(o.get("price")) is int
                    and abs(o["price"]) >= 100 for o in outcomes
                ):
                    counts["invalid_contract"] += 1
                    continue
                sides = {team(league, o["name"]): o["point"] for o in outcomes}
                spread = kind == "spreads"
                valid = (set(sides) == {home, away} and sides[home] == -sides[away]
                         if spread else set(sides) == {"over", "under"}
                         and sides["over"] == sides["under"] and sides["over"] > 0)
                projection = f["margin" if spread else "total"]
                if not valid or not number(projection):
                    counts["invalid_contract"] += 1
                    continue
                distance = projection + sides[home] if spread else projection - sides["over"]
                accepted.append(dict(provider_event=eid, forecast=f, book=key[0],
                                     market=market, distance=distance))
    counts["accepted_groups"] = len(accepted)
    return accepted, dict(counts)


def archive(db, capture, forecasts):
    records, counts = evaluate(capture, forecasts)
    instant = timestamp(capture["captured_at"]).isoformat()
    data = json.dumps(capture, sort_keys=True, allow_nan=False)
    report = json.dumps({"records": records, "counts": counts}, sort_keys=True, allow_nan=False)
    with db:
        db.execute("""create table if not exists captures (
            league text, received text, evidence text not null, report text not null,
            primary key (league, received))""")
        key = (capture["sport_key"], instant)
        db.execute("insert into captures values (?,?,?,?) on conflict do nothing",
                   (*key, data, report))
        saved = db.execute("select evidence, report from captures where league=? and received=?",
                           key).fetchone()
        if saved != (data, report):
            raise ValueError("Conflicting replay at same capture time")
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ("capture", "forecasts", "archive"):
        parser.add_argument(arg, type=Path)
    args = parser.parse_args()
    with sqlite3.connect(args.archive) as connection:
        print(json.dumps(archive(connection, json.loads(args.capture.read_text()),
                                 json.loads(args.forecasts.read_text()))))
