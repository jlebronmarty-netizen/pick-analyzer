#!/usr/bin/env python3
"""Build a research-only compact MLB 2025 Totals market layer from immutable SBR artifacts.

This script intentionally reads ONLY pregame market artifacts and MLB schedule identity.
It does not read scores, game outcomes, Official Picks, or production recommendation tables.
Opening and closing remain separate semantic roles. No Odds API request is made.
"""

from __future__ import annotations

import collections
import datetime as dt
import gzip
import json
import math
import os
import statistics
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "research"
OUT = DATA / "totals_2025_market_v1"

BASE_FILES = [
    ("sportsbookreview_via_arnavsaraogi_dataset", DATA / "mlb_2025_sbr_open_close.jsonl.gz"),
    ("sportsbookreview_direct_scrape", DATA / "mlb_2025_sbr_gap_open_close.jsonl.gz"),
    ("sportsbookreview_multigame_retry", DATA / "mlb_2025_sbr_multigame_retry.jsonl.gz"),
    ("sportsbookreview_athletics_totals_v1", DATA / "mlb_2025_sbr_athletics_totals_v1.jsonl.gz"),
]

FORBIDDEN = {
    "awayTeamScore",
    "homeTeamScore",
    "gameStatusText",
    "winner",
    "result",
    "runs",
    "rbi",
}

ALIASES = {
    "ARI": "AZ",
    "OAK": "ATH",
    "CHW": "CWS",
    "WAS": "WSH",
    "WSN": "WSH",
    "SFG": "SF",
    "SDP": "SD",
    "KCR": "KC",
    "TBR": "TB",
}

CONSENSUS_METHOD = "sportsbook_mode_line_median_price_at_consensus"
MARKET_SOURCE_VERSION = "sbr_2025_open_close_totals_v1"


def team(value: object) -> str:
    value = str(value or "").strip().upper()
    return ALIASES.get(value, value)


def timestamp(value: object) -> float | None:
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


def row_identity(row: dict) -> tuple[str, str, str, str]:
    return (
        str(row.get("sourceDate") or "")[:10],
        team(row.get("awayTeam")),
        team(row.get("homeTeam")),
        str(row.get("sourceStartDate") or ""),
    )


def median(values: list[float]) -> float | None:
    if not values:
        return None
    return float(statistics.median(values))


def modal_line(lines: list[float]) -> float | None:
    """Choose an actual offered line, never manufacture a quarter-run median line."""
    if not lines:
        return None
    counts = collections.Counter(lines)
    max_count = max(counts.values())
    candidates = sorted(line for line, count in counts.items() if count == max_count)
    center = float(statistics.median(lines))
    return min(candidates, key=lambda line: (abs(line - center), line))


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql_num(value: float | int | None) -> str:
    if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
        return "NULL"
    return str(value)


def sql_array(values: list[str]) -> str:
    if not values:
        return "ARRAY[]::text[]"
    return "ARRAY[" + ",".join(sql_text(v) for v in values) + "]::text[]"


def load_market_rows() -> list[dict]:
    rows: list[dict] = []
    for source_layer, path in BASE_FILES:
        if not path.exists():
            raise RuntimeError(f"MISSING_SOURCE_ARTIFACT:{path}")
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            for line in handle:
                row = json.loads(line)
                if any(key in row for key in FORBIDDEN):
                    raise RuntimeError(f"POSTGAME_FIELD_IN_SOURCE_ARTIFACT:{path.name}")
                if row.get("market") != "total":
                    continue
                normalized = dict(row)
                normalized["homeTeam"] = team(row.get("homeTeam"))
                normalized["awayTeam"] = team(row.get("awayTeam"))
                normalized["sourceLayer"] = source_layer
                rows.append(normalized)
    return rows


def load_canonical_schedule() -> list[dict]:
    url = (
        "https://statsapi.mlb.com/api/v1/schedule"
        "?sportId=1&startDate=2025-03-18&endDate=2025-09-28"
        "&gameType=R&hydrate=team"
    )
    with urllib.request.urlopen(url, timeout=60) as response:
        schedule = json.load(response)
    games: list[dict] = []
    for date_block in schedule.get("dates") or []:
        game_date = date_block.get("date")
        for game in date_block.get("games") or []:
            home = (((game.get("teams") or {}).get("home") or {}).get("team") or {})
            away = (((game.get("teams") or {}).get("away") or {}).get("team") or {})
            home_team = team(home.get("abbreviation"))
            away_team = team(away.get("abbreviation"))
            if not home_team or not away_team:
                continue
            games.append(
                {
                    "game_pk": int(game["gamePk"]),
                    "game_date": game_date,
                    "away_team": away_team,
                    "home_team": home_team,
                    "start": game.get("gameDate"),
                }
            )
    if len({game["game_pk"] for game in games}) != 2430:
        raise RuntimeError(f"CANONICAL_GAME_COUNT_UNEXPECTED:{len({g['game_pk'] for g in games})}")
    return games


def map_identities(rows: list[dict], games: list[dict]) -> tuple[dict, list, list]:
    by_pair: dict[tuple[str, str, str], list[dict]] = collections.defaultdict(list)
    for game in games:
        by_pair[(game["game_date"], game["away_team"], game["home_team"])].append(game)

    identities = {row_identity(row): row for row in rows}
    mapped: dict[tuple[str, str, str, str], int] = {}
    unmapped: list[dict] = []
    ambiguous: list[dict] = []

    for identity in identities:
        date, away, home, start = identity
        candidates = by_pair.get((date, away, home), [])
        if len(candidates) == 1:
            mapped[identity] = candidates[0]["game_pk"]
            continue
        if len(candidates) > 1:
            source_ts = timestamp(start)
            ranked = []
            for candidate in candidates:
                candidate_ts = timestamp(candidate["start"])
                diff = (
                    abs(candidate_ts - source_ts)
                    if source_ts is not None and candidate_ts is not None
                    else float("inf")
                )
                ranked.append((diff, candidate))
            ranked.sort(key=lambda item: item[0])
            if len(ranked) == 1 or ranked[0][0] < ranked[1][0]:
                mapped[identity] = ranked[0][1]["game_pk"]
            else:
                ambiguous.append(
                    {
                        "identity": identity,
                        "candidate_game_pks": [item[1]["game_pk"] for item in ranked],
                    }
                )
        else:
            unmapped.append(
                {"date": date, "away": away, "home": home, "source_start": start}
            )
    return mapped, unmapped, ambiguous


def paired_book_quotes(rows: list[dict], mapped: dict) -> tuple[dict, dict]:
    # game -> role -> sportsbook -> outcome -> list[{line,price,source_layer}]
    grouped = collections.defaultdict(
        lambda: collections.defaultdict(
            lambda: collections.defaultdict(lambda: collections.defaultdict(list))
        )
    )
    raw_counts = collections.Counter()
    source_layers = collections.defaultdict(set)

    for row in rows:
        game_pk = mapped.get(row_identity(row))
        if game_pk is None:
            continue
        role = str(row.get("snapshotRole") or "").lower()
        outcome = str(row.get("outcome") or "").lower()
        sportsbook = str(row.get("sportsbook") or "").strip().lower()
        line = row.get("line")
        price = row.get("price")
        if role not in {"opening", "closing"} or outcome not in {"over", "under"}:
            continue
        if not sportsbook or not isinstance(line, (int, float)) or not isinstance(price, (int, float)):
            continue
        item = {
            "line": float(line),
            "price": float(price),
            "source_layer": str(row.get("sourceLayer") or ""),
        }
        grouped[game_pk][role][sportsbook][outcome].append(item)
        raw_counts[game_pk] += 1
        source_layers[game_pk].add(item["source_layer"])

    paired = collections.defaultdict(lambda: collections.defaultdict(dict))
    for game_pk, roles in grouped.items():
        for role, books in roles.items():
            for sportsbook, outcomes in books.items():
                over = outcomes.get("over") or []
                under = outcomes.get("under") or []
                if not over or not under:
                    continue
                over_lines = collections.Counter(item["line"] for item in over)
                under_lines = collections.Counter(item["line"] for item in under)
                common = sorted(set(over_lines).intersection(under_lines))
                if not common:
                    continue
                best_support = max(min(over_lines[line], under_lines[line]) for line in common)
                candidates = [
                    line for line in common if min(over_lines[line], under_lines[line]) == best_support
                ]
                center = float(statistics.median(common))
                chosen_line = min(candidates, key=lambda line: (abs(line - center), line))
                over_prices = [item["price"] for item in over if item["line"] == chosen_line]
                under_prices = [item["price"] for item in under if item["line"] == chosen_line]
                paired[game_pk][role][sportsbook] = {
                    "line": chosen_line,
                    "over_price": median(over_prices),
                    "under_price": median(under_prices),
                }
    return paired, {pk: {"raw_row_count": raw_counts[pk], "source_layers": sorted(source_layers[pk])} for pk in raw_counts}


def role_consensus(book_quotes: dict[str, dict]) -> dict:
    if not book_quotes:
        return {"line": None, "over_price": None, "under_price": None, "sportsbooks": []}
    books = sorted(book_quotes)
    chosen_line = modal_line([book_quotes[book]["line"] for book in books])
    at_line = [book for book in books if book_quotes[book]["line"] == chosen_line]
    return {
        "line": chosen_line,
        "over_price": median([book_quotes[book]["over_price"] for book in at_line if book_quotes[book]["over_price"] is not None]),
        "under_price": median([book_quotes[book]["under_price"] for book in at_line if book_quotes[book]["under_price"] is not None]),
        "sportsbooks": books,
    }


def build_compact(games: list[dict], paired: dict, metadata: dict) -> list[dict]:
    canonical = {game["game_pk"]: game for game in games}
    output = []
    for game_pk in sorted(paired):
        game = canonical.get(game_pk)
        if game is None:
            continue
        opening = role_consensus((paired[game_pk] or {}).get("opening") or {})
        closing = role_consensus((paired[game_pk] or {}).get("closing") or {})
        if opening["line"] is None or closing["line"] is None:
            continue
        md = metadata.get(game_pk) or {"raw_row_count": 0, "source_layers": []}
        output.append(
            {
                "game_pk": game_pk,
                "game_date": game["game_date"],
                "home_team": game["home_team"],
                "away_team": game["away_team"],
                "source_identity": f"{game['game_date']}|{game['away_team']}|{game['home_team']}|{game_pk}",
                "market_source_version": MARKET_SOURCE_VERSION,
                "open_total": opening["line"],
                "close_total": closing["line"],
                "open_over_price": opening["over_price"],
                "open_under_price": opening["under_price"],
                "close_over_price": closing["over_price"],
                "close_under_price": closing["under_price"],
                "opening_sportsbook_count": len(opening["sportsbooks"]),
                "closing_sportsbook_count": len(closing["sportsbooks"]),
                "raw_row_count": int(md["raw_row_count"]),
                "has_opening": True,
                "has_closing": True,
                "consensus_method": CONSENSUS_METHOD,
                "research_only": True,
                "source_layers": md["source_layers"],
                "opening_sportsbooks": opening["sportsbooks"],
                "closing_sportsbooks": closing["sportsbooks"],
            }
        )
    return output


def sql_tuple(row: dict) -> str:
    values = [
        str(row["game_pk"]),
        sql_text(row["game_date"]),
        sql_text(row["home_team"]),
        sql_text(row["away_team"]),
        sql_text(row["source_identity"]),
        sql_text(row["market_source_version"]),
        sql_num(row["open_total"]),
        sql_num(row["close_total"]),
        sql_num(row["open_over_price"]),
        sql_num(row["open_under_price"]),
        sql_num(row["close_over_price"]),
        sql_num(row["close_under_price"]),
        str(row["opening_sportsbook_count"]),
        str(row["closing_sportsbook_count"]),
        str(row["raw_row_count"]),
        "true",
        "true",
        sql_text(row["consensus_method"]),
        "true",
        sql_array(row["source_layers"]),
        sql_array(row["opening_sportsbooks"]),
        sql_array(row["closing_sportsbooks"]),
    ]
    return "(" + ",".join(values) + ")"


def write_sql_chunks(rows: list[dict], chunk_size: int = 250) -> list[str]:
    columns = """game_pk,game_date,home_team,away_team,source_identity,market_source_version,
open_total,close_total,open_over_price,open_under_price,close_over_price,close_under_price,
opening_sportsbook_count,closing_sportsbook_count,raw_row_count,has_opening,has_closing,
consensus_method,research_only,source_layers,opening_sportsbooks,closing_sportsbooks""".replace("\n", "")
    update = """game_date=excluded.game_date,home_team=excluded.home_team,away_team=excluded.away_team,
source_identity=excluded.source_identity,market_source_version=excluded.market_source_version,
open_total=excluded.open_total,close_total=excluded.close_total,
open_over_price=excluded.open_over_price,open_under_price=excluded.open_under_price,
close_over_price=excluded.close_over_price,close_under_price=excluded.close_under_price,
opening_sportsbook_count=excluded.opening_sportsbook_count,closing_sportsbook_count=excluded.closing_sportsbook_count,
raw_row_count=excluded.raw_row_count,has_opening=excluded.has_opening,has_closing=excluded.has_closing,
consensus_method=excluded.consensus_method,research_only=true,source_layers=excluded.source_layers,
opening_sportsbooks=excluded.opening_sportsbooks,closing_sportsbooks=excluded.closing_sportsbooks""".replace("\n", "")
    files = []
    for index in range(0, len(rows), chunk_size):
        part = index // chunk_size + 1
        chunk = rows[index : index + chunk_size]
        sql = (
            "-- RESEARCH ONLY. Generated from immutable SBR Totals artifacts.\n"
            "insert into public.mlb_totals_market_2025_v1 (" + columns + ") values\n"
            + ",\n".join(sql_tuple(row) for row in chunk)
            + "\non conflict (game_pk) do update set " + update + ";\n"
        )
        filename = f"mlb_2025_totals_market_v1_part_{part:02d}.sql"
        (OUT / filename).write_text(sql, encoding="utf-8")
        files.append(filename)
    return files


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("mlb_2025_totals_market_v1_part_*.sql"):
        old.unlink()

    rows = load_market_rows()
    games = load_canonical_schedule()
    mapped, unmapped, ambiguous = map_identities(rows, games)
    if unmapped:
        raise RuntimeError(f"UNMAPPED_MARKET_IDENTITIES:{len(unmapped)}")
    if ambiguous:
        raise RuntimeError(f"AMBIGUOUS_MARKET_IDENTITIES:{len(ambiguous)}")

    paired, metadata = paired_book_quotes(rows, mapped)
    compact = build_compact(games, paired, metadata)
    if len(compact) < 2425:
        raise RuntimeError(f"COMPACT_TOTALS_COVERAGE_REGRESSION:{len(compact)}")

    sql_parts = write_sql_chunks(compact)
    compact_path = OUT / "mlb_2025_totals_market_v1.json"
    compact_path.write_text(json.dumps(compact, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    line_counts_open = collections.Counter(row["open_total"] for row in compact)
    line_counts_close = collections.Counter(row["close_total"] for row in compact)
    summary = {
        "contract": "MLB_TOTALS_MARKET_2025_V1_BUILD",
        "research_only": True,
        "market": "total",
        "canonical_regular_season_games": 2430,
        "compact_market_games": len(compact),
        "coverage_pct": round(100.0 * len(compact) / 2430.0, 8),
        "source_market_rows": len(rows),
        "mapped_game_pks": len(set(mapped.values())),
        "unmapped_identity_count": len(unmapped),
        "ambiguous_identity_count": len(ambiguous),
        "consensus_method": CONSENSUS_METHOD,
        "opening_line_distribution": {str(k): v for k, v in sorted(line_counts_open.items())},
        "closing_line_distribution": {str(k): v for k, v in sorted(line_counts_close.items())},
        "sql_parts": sql_parts,
        "postgame_fields_copied": 0,
        "odds_api_credits_consumed": 0,
        "official_picks_writes": 0,
        "apostar_activation": False,
    }
    (OUT / "mlb_2025_totals_market_v1_build_summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
