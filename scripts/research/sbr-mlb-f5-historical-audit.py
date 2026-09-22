#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
import time
from collections import Counter
from pathlib import Path

import requests

BASE = "https://www.sportsbookreview.com"
LEAGUE = "mlb-baseball"
DATES = [
    "2025-04-15",
    "2025-05-15",
    "2025-06-15",
    "2025-07-15",
    "2025-08-15",
    "2025-09-01",
]
MARKETS = {
    "moneyline": ("money-line", "money-line"),
    "spread": ("pointspread", "pointspread"),
    "totals": ("totals", "totals"),
}
SCOPE = "1st-half"
UA = "pick-analyzer-research-audit/1.0 (+ephemeral; low-rate public-page audit)"


def fetch(session: requests.Session, url: str) -> requests.Response:
    response = session.get(url, timeout=45)
    response.raise_for_status()
    return response


def page_url(date: str, path_market: str) -> str:
    return f"{BASE}/betting-odds/{LEAGUE}/{path_market}/{SCOPE}/?date={date}"


def extract_next_payload(html: str) -> dict:
    match = re.search(r'__NEXT_DATA__" type="application/json">(.*?)</script>', html)
    if not match:
        raise RuntimeError("NEXT_DATA_NOT_FOUND")
    payload = json.loads(match.group(1))
    if not isinstance(payload, dict):
        raise RuntimeError("NEXT_DATA_OBJECT_REQUIRED")
    return payload


def game_rows(payload: dict) -> list[dict]:
    tables = payload.get("props", {}).get("pageProps", {}).get("oddsTables") or []
    if not tables:
        return []
    model = tables[0].get("oddsTableModel") or {}
    rows = model.get("gameRows") or []
    return [row for row in rows if isinstance(row, dict)]


def line_complete(market: str, line: dict | None) -> bool:
    if not isinstance(line, dict):
        return False
    if market == "totals":
        return (
            line.get("total") is not None
            and line.get("overOdds") is not None
            and line.get("underOdds") is not None
        )
    if market == "moneyline":
        return line.get("homeOdds") is not None and line.get("awayOdds") is not None
    if market == "spread":
        return (
            line.get("homeSpread") is not None
            and line.get("awaySpread") is not None
            and line.get("homeOdds") is not None
            and line.get("awayOdds") is not None
        )
    return False


def odds_view_rows(container) -> list[dict]:
    out: list[dict] = []

    def walk(value, depth: int = 0) -> None:
        if depth > 8:
            return
        if isinstance(value, list):
            for item in value:
                walk(item, depth + 1)
            return
        if not isinstance(value, dict):
            return

        looks_like_book_row = (
            ("sportsbook" in value or "sportsbookName" in value)
            and ("openingLine" in value or "currentLine" in value)
        )
        if looks_like_book_row:
            out.append(value)
            return

        for nested in value.values():
            if isinstance(nested, (dict, list)):
                walk(nested, depth + 1)

    walk(container)
    return out


def audit_rows(market: str, rows: list[dict]) -> dict:
    books = Counter()
    games_with_views = 0
    games_with_opening = 0
    games_with_current = 0
    games_with_both = 0
    total_views = 0
    complete_open_views = 0
    complete_current_views = 0
    complete_both_views = 0
    starter_games = 0

    for game in rows:
        view = game.get("gameView") or {}
        away = view.get("awayTeam") or {}
        home = view.get("homeTeam") or {}
        if away.get("startingPitcher") or home.get("startingPitcher"):
            starter_games += 1

        odds_container = game.get("oddsViews") or []
        odds_views = odds_view_rows(odds_container)
        if odds_container:
            games_with_views += 1
        has_open = False
        has_current = False
        has_both = False
        for row in odds_views:
            total_views += 1
            book = str(row.get("sportsbook") or row.get("sportsbookName") or "").strip().lower()
            if book:
                books[book] += 1
            opening = row.get("openingLine")
            current = row.get("currentLine")
            o = line_complete(market, opening)
            c = line_complete(market, current)
            if o:
                complete_open_views += 1
                has_open = True
            if c:
                complete_current_views += 1
                has_current = True
            if o and c:
                complete_both_views += 1
                has_both = True
        games_with_opening += int(has_open)
        games_with_current += int(has_current)
        games_with_both += int(has_both)

    return {
        "games": len(rows),
        "gamesWithOddsViews": games_with_views,
        "gamesWithOpening": games_with_opening,
        "gamesWithCurrent": games_with_current,
        "gamesWithBoth": games_with_both,
        "gamesWithStarterMetadata": starter_games,
        "oddsViews": total_views,
        "completeOpeningViews": complete_open_views,
        "completeCurrentViews": complete_current_views,
        "completeBothViews": complete_both_views,
        "sportsbooks": dict(sorted(books.items())),
    }


def schema_shape(value, depth: int = 0, max_depth: int = 5):
    if depth > max_depth:
        return {"type": type(value).__name__}
    if isinstance(value, dict):
        keys = sorted(str(k) for k in value.keys())
        children = {}
        for key in keys[:40]:
            nested = value.get(key)
            if isinstance(nested, (dict, list)):
                children[key] = schema_shape(nested, depth + 1, max_depth)
        return {"type": "dict", "keys": keys[:80], "children": children}
    if isinstance(value, list):
        first = next((x for x in value if x is not None), None)
        return {
            "type": "list",
            "length": len(value),
            "itemShape": schema_shape(first, depth + 1, max_depth) if first is not None else None,
        }
    return {"type": type(value).__name__}


def main() -> None:
    output = Path(sys.argv[1] if len(sys.argv) > 1 else "sbr-f5-historical-audit.json")
    session = requests.Session()
    session.headers.update({
        "User-Agent": UA,
        "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
    })

    if "--schema-only" in sys.argv:
        url = page_url(DATES[0], "totals")
        response = fetch(session, url)
        payload = extract_next_payload(response.text)
        tables = payload.get("props", {}).get("pageProps", {}).get("oddsTables") or []
        table0 = tables[0] if tables else {}
        model = table0.get("oddsTableModel") or {}
        rows = game_rows(payload)
        first_game = rows[0] if rows else {}
        summary = {
            "schema": "mlb-sbr-f5-oddsviews-shape/1.1.0",
            "researchOnly": True,
            "date": DATES[0],
            "market": "totals",
            "scope": SCOPE,
            "games": len(rows),
            "providerRequestsMade": 1,
            "subscriptionCreditsConsumed": 0,
            "rawPayloadPersisted": False,
            "pagePropsShape": schema_shape(payload.get("props", {}).get("pageProps", {}), max_depth=3),
            "oddsTableShape": schema_shape(table0, max_depth=4),
            "oddsTableModelShape": schema_shape(model, max_depth=5),
            "firstGameShape": schema_shape(first_game, max_depth=5),
            "oddsViewsShape": schema_shape(first_game.get("oddsViews")),
        }
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(summary, indent=2))
        return

    results: dict[str, dict] = {}
    provider_requests = 0

    for date in DATES:
        results[date] = {}
        for logical_market, (path_market, odds_type) in MARKETS.items():
            url = page_url(date, path_market)
            response = fetch(session, url)
            provider_requests += 1
            payload = extract_next_payload(response.text)
            rows = game_rows(payload)
            results[date][logical_market] = {
                "urlPath": f"/betting-odds/{LEAGUE}/{path_market}/{SCOPE}/?date={date}",
                **audit_rows(logical_market, rows),
            }
            time.sleep(1.25)

    aggregate = {}
    for market in MARKETS:
        rows = [results[d][market] for d in DATES]
        aggregate[market] = {
            "sampleDates": len(DATES),
            "games": sum(r["games"] for r in rows),
            "gamesWithOddsViews": sum(r["gamesWithOddsViews"] for r in rows),
            "gamesWithOpening": sum(r["gamesWithOpening"] for r in rows),
            "gamesWithCurrent": sum(r["gamesWithCurrent"] for r in rows),
            "gamesWithBoth": sum(r["gamesWithBoth"] for r in rows),
            "oddsViews": sum(r["oddsViews"] for r in rows),
            "completeOpeningViews": sum(r["completeOpeningViews"] for r in rows),
            "completeCurrentViews": sum(r["completeCurrentViews"] for r in rows),
            "completeBothViews": sum(r["completeBothViews"] for r in rows),
        }
        games = aggregate[market]["games"]
        aggregate[market]["bothGameCoverage"] = (
            aggregate[market]["gamesWithBoth"] / games if games else 0.0
        )

    summary = {
        "schema": "mlb-sbr-f5-historical-audit/1.0.0",
        "researchOnly": True,
        "source": "SportsBookReview public betting-odds pages",
        "scope": "1st-half",
        "mlbInterpretation": "1st 5",
        "sampleDates": DATES,
        "htmlNextDataParser": True,
        "buildIdRecorded": False,
        "rawPayloadPersisted": False,
        "rawPayloadUploaded": False,
        "providerRequestsMade": provider_requests,
        "requestDelaySeconds": 1.25,
        "subscriptionCreditsConsumed": 0,
        "results": results,
        "aggregate": aggregate,
        "disposition": (
            "F5_PUBLIC_HISTORY_SAMPLE_AVAILABLE"
            if all(aggregate[m]["bothGameCoverage"] >= 0.75 for m in MARKETS)
            else "F5_PUBLIC_HISTORY_SAMPLE_INCOMPLETE"
        ),
        "nextGate": "NO_FULL_SEASON_SCRAPE_UNTIL_SAMPLE_COVERAGE_AND_SOURCE_POLICY_REVIEW",
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
