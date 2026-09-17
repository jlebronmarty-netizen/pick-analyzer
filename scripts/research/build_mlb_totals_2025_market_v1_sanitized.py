#!/usr/bin/env python3
"""Rebuild Totals V1 after strict American-odds price sanitation.

Research-only wrapper around build_mlb_totals_2025_market_v1. It rejects malformed
price values before sportsbook pairing/consensus, preserves opening and closing as
separate semantic roles, consumes no Odds API credits, never touches production, and
never fabricates an American-odds quote by arithmetic averaging across opposite signs.
"""

from __future__ import annotations

import collections
import json
import statistics

import build_mlb_totals_2025_market_v1 as base

PRICE_MIN_ABS = 100.0
PRICE_MAX_ABS = 10000.0
MARKET_SOURCE_VERSION = "sbr_2025_open_close_totals_v1_price_sanitized"
CONSENSUS_METHOD = "sportsbook_mode_line_actual_price_nearest_median_implied_probability"


def valid_american_price(value: object) -> bool:
    if not isinstance(value, (int, float)):
        return False
    price = float(value)
    return PRICE_MIN_ABS <= abs(price) <= PRICE_MAX_ABS


def implied_probability(price: float) -> float:
    """Convert valid American odds to implied probability."""
    price = float(price)
    if price > 0:
        return 100.0 / (price + 100.0)
    return (-price) / ((-price) + 100.0)


def representative_actual_price(values: list[float]) -> float | None:
    """Return an actually offered quote nearest the median implied probability.

    Arithmetic medians of American odds are invalid across opposite signs: e.g.
    -105 and +100 average/median to -2.5. This function uses implied probability
    only to locate the center, then returns one original quote from the source set.
    """
    clean = [float(value) for value in values if valid_american_price(value)]
    if not clean:
        return None
    probabilities = [implied_probability(value) for value in clean]
    center = float(statistics.median(probabilities))
    chosen = min(
        clean,
        key=lambda value: (
            abs(implied_probability(value) - center),
            abs(value),
            value,
        ),
    )
    return float(chosen)


def main() -> None:
    base.OUT.mkdir(parents=True, exist_ok=True)
    for old in base.OUT.glob("mlb_2025_totals_market_v1_part_*.sql"):
        old.unlink()

    raw_rows = base.load_market_rows()
    rejected = [row for row in raw_rows if not valid_american_price(row.get("price"))]
    rows = [row for row in raw_rows if valid_american_price(row.get("price"))]

    games = base.load_canonical_schedule()
    mapped, unmapped, ambiguous = base.map_identities(rows, games)
    if unmapped:
        raise RuntimeError(f"UNMAPPED_MARKET_IDENTITIES:{len(unmapped)}")
    if ambiguous:
        raise RuntimeError(f"AMBIGUOUS_MARKET_IDENTITIES:{len(ambiguous)}")

    # The base builder uses `median()` only for price aggregation. Replace it with
    # an actual-quote selector so every compact price remains traceable to an input.
    base.median = representative_actual_price
    base.MARKET_SOURCE_VERSION = MARKET_SOURCE_VERSION
    base.CONSENSUS_METHOD = CONSENSUS_METHOD

    paired, metadata = base.paired_book_quotes(rows, mapped)
    compact = base.build_compact(games, paired, metadata)

    if len(compact) < 2425:
        raise RuntimeError(f"COMPACT_TOTALS_COVERAGE_REGRESSION:{len(compact)}")

    price_fields = (
        "open_over_price",
        "open_under_price",
        "close_over_price",
        "close_under_price",
    )
    invalid_compact = []
    for row in compact:
        bad = {field: row.get(field) for field in price_fields if not valid_american_price(row.get(field))}
        if bad:
            invalid_compact.append({"game_pk": row["game_pk"], "bad_prices": bad})
    if invalid_compact:
        raise RuntimeError(f"INVALID_CONSENSUS_PRICES:{invalid_compact[:10]}")

    sql_parts = base.write_sql_chunks(compact)
    compact_path = base.OUT / "mlb_2025_totals_market_v1.json"
    compact_path.write_text(json.dumps(compact, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    line_counts_open = collections.Counter(row["open_total"] for row in compact)
    line_counts_close = collections.Counter(row["close_total"] for row in compact)
    rejected_by_source = collections.Counter(str(row.get("sourceLayer") or "") for row in rejected)
    rejected_values = collections.Counter(str(row.get("price")) for row in rejected)

    summary = {
        "contract": "MLB_TOTALS_MARKET_2025_V1_BUILD",
        "research_only": True,
        "market": "total",
        "canonical_regular_season_games": 2430,
        "compact_market_games": len(compact),
        "coverage_pct": round(100.0 * len(compact) / 2430.0, 8),
        "source_market_rows_before_price_sanitation": len(raw_rows),
        "source_market_rows_after_price_sanitation": len(rows),
        "rejected_invalid_price_rows": len(rejected),
        "rejected_invalid_price_rows_by_source": dict(sorted(rejected_by_source.items())),
        "rejected_invalid_price_values_top20": rejected_values.most_common(20),
        "american_price_contract": {
            "min_abs_inclusive": PRICE_MIN_ABS,
            "max_abs_inclusive": PRICE_MAX_ABS,
        },
        "price_aggregation_rule": "actual_offered_quote_nearest_median_implied_probability",
        "fabricated_price_quotes": 0,
        "invalid_consensus_price_rows": 0,
        "mapped_game_pks": len(set(mapped.values())),
        "unmapped_identity_count": len(unmapped),
        "ambiguous_identity_count": len(ambiguous),
        "market_source_version": MARKET_SOURCE_VERSION,
        "consensus_method": CONSENSUS_METHOD,
        "opening_line_distribution": {str(k): v for k, v in sorted(line_counts_open.items())},
        "closing_line_distribution": {str(k): v for k, v in sorted(line_counts_close.items())},
        "sql_parts": sql_parts,
        "postgame_fields_copied": 0,
        "odds_api_credits_consumed": 0,
        "official_picks_writes": 0,
        "apostar_activation": False,
    }
    (base.OUT / "mlb_2025_totals_market_v1_build_summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
