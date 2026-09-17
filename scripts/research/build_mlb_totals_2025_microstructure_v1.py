#!/usr/bin/env python3
"""Build research-only MLB 2025 Totals sportsbook microstructure features.

Reads immutable SBR opening/closing Totals artifacts already present in the repo.
No Odds API calls. No scores/outcomes. No Official Picks/APOSTAR writes.
"""

from __future__ import annotations

import collections
import json
import math
import statistics
from pathlib import Path

import build_mlb_totals_2025_market_v1 as base

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "research" / "totals_2025_microstructure_v1"
PRICE_MIN_ABS = 100.0
PRICE_MAX_ABS = 10000.0


def valid_price(value):
    return isinstance(value, (int, float)) and PRICE_MIN_ABS <= abs(float(value)) <= PRICE_MAX_ABS


def implied(price: float) -> float:
    price = float(price)
    return 100.0 / (price + 100.0) if price > 0 else (-price) / ((-price) + 100.0)


def representative_actual_price(values):
    clean = [float(v) for v in values if valid_price(v)]
    if not clean:
        return None
    center = statistics.median(implied(v) for v in clean)
    return min(clean, key=lambda v: (abs(implied(v) - center), abs(v), v))


def pstdev(values):
    return float(statistics.pstdev(values)) if len(values) > 1 else (0.0 if values else None)


def vrange(values):
    return float(max(values) - min(values)) if values else None


def entropy(values):
    if not values:
        return None
    c = collections.Counter(values)
    n = len(values)
    return float(-sum((k / n) * math.log(k / n) for k in c.values()))


def role_features(quotes):
    books = sorted(quotes)
    if not books:
        return {
            "book_count": 0, "distinct_lines": 0, "line_std": None, "line_range": None,
            "consensus_support": None, "line_entropy": None, "novig_over_mean": None,
            "novig_over_std": None, "novig_over_range": None, "vig_mean": None, "vig_std": None,
        }
    lines = [float(quotes[b]["line"]) for b in books]
    mode = base.modal_line(lines)
    support = sum(1 for x in lines if x == mode) / len(lines)
    novig = []
    vig = []
    for b in books:
        op = quotes[b].get("over_price")
        up = quotes[b].get("under_price")
        if not valid_price(op) or not valid_price(up):
            continue
        po, pu = implied(float(op)), implied(float(up))
        total = po + pu
        if total > 0:
            novig.append(po / total)
            vig.append(total - 1.0)
    return {
        "book_count": len(books),
        "distinct_lines": len(set(lines)),
        "line_std": pstdev(lines),
        "line_range": vrange(lines),
        "consensus_support": float(support),
        "line_entropy": entropy(lines),
        "novig_over_mean": float(statistics.mean(novig)) if novig else None,
        "novig_over_std": pstdev(novig),
        "novig_over_range": vrange(novig),
        "vig_mean": float(statistics.mean(vig)) if vig else None,
        "vig_std": pstdev(vig),
    }


def book_novig(q):
    op, up = q.get("over_price"), q.get("under_price")
    if not valid_price(op) or not valid_price(up):
        return None
    po, pu = implied(float(op)), implied(float(up))
    return po / (po + pu) if po + pu > 0 else None


def move_features(opening, closing):
    ob = set(opening)
    cb = set(closing)
    common = sorted(ob & cb)
    line_moves = []
    prob_moves = []
    for b in common:
        line_moves.append(float(closing[b]["line"]) - float(opening[b]["line"]))
        po, pc = book_novig(opening[b]), book_novig(closing[b])
        if po is not None and pc is not None:
            prob_moves.append(pc - po)

    def direction(xs):
        if not xs:
            return (None, None, None, None)
        eps = 1e-12
        up = sum(x > eps for x in xs) / len(xs)
        down = sum(x < -eps for x in xs) / len(xs)
        flat = 1.0 - up - down
        return float(up), float(down), float(flat), float(max(up, down, flat))

    lup, ldown, lflat, lagree = direction(line_moves)
    pup, pdown, pflat, pagree = direction(prob_moves)
    return {
        "common_book_count": len(common),
        "open_only_book_count": len(ob - cb),
        "close_only_book_count": len(cb - ob),
        "line_move_mean_common": float(statistics.mean(line_moves)) if line_moves else None,
        "line_move_std_common": pstdev(line_moves),
        "line_move_up_pct": lup,
        "line_move_down_pct": ldown,
        "line_move_flat_pct": lflat,
        "line_move_direction_agreement": lagree,
        "novig_move_mean_common": float(statistics.mean(prob_moves)) if prob_moves else None,
        "novig_move_std_common": pstdev(prob_moves),
        "novig_move_up_pct": pup,
        "novig_move_down_pct": pdown,
        "novig_move_flat_pct": pflat,
        "novig_move_direction_agreement": pagree,
    }


FEATURES = [
    "open_book_count","close_book_count","common_book_count","open_only_book_count","close_only_book_count",
    "open_distinct_lines","close_distinct_lines","open_line_std","close_line_std","open_line_range","close_line_range",
    "open_consensus_support","close_consensus_support","open_line_entropy","close_line_entropy",
    "open_novig_over_mean","close_novig_over_mean","open_novig_over_std","close_novig_over_std",
    "open_novig_over_range","close_novig_over_range","open_vig_mean","close_vig_mean","open_vig_std","close_vig_std",
    "line_move_mean_common","line_move_std_common","line_move_up_pct","line_move_down_pct","line_move_flat_pct",
    "line_move_direction_agreement","novig_move_mean_common","novig_move_std_common","novig_move_up_pct",
    "novig_move_down_pct","novig_move_flat_pct","novig_move_direction_agreement",
]


def sql_num(v):
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return "NULL"
    return repr(float(v)) if isinstance(v, float) else str(v)


def write_sql(rows, chunk_size=250):
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("mlb_2025_totals_microstructure_v1_part_*.sql"):
        old.unlink()
    cols = ["game_pk","game_date"] + FEATURES + ["research_only"]
    parts = []
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start:start+chunk_size]
        tuples = []
        for r in chunk:
            vals = [str(r["game_pk"]), "'" + r["game_date"] + "'"]
            vals += [sql_num(r.get(f)) for f in FEATURES]
            vals += ["true"]
            tuples.append("(" + ",".join(vals) + ")")
        update = ",".join(f"{c}=excluded.{c}" for c in cols[1:])
        sql = (
            "-- RESEARCH ONLY; immutable SBR artifacts; 0 Odds API credits.\n"
            "insert into public.mlb_totals_v17_microstructure_2025_v1 (" + ",".join(cols) + ") values\n"
            + ",\n".join(tuples)
            + "\non conflict(game_pk) do update set " + update + ";\n"
        )
        name = f"mlb_2025_totals_microstructure_v1_part_{start//chunk_size+1:02d}.sql"
        (OUT / name).write_text(sql, encoding="utf-8")
        parts.append(name)
    return parts


def main():
    raw = base.load_market_rows()
    rows = [r for r in raw if valid_price(r.get("price"))]
    games = base.load_canonical_schedule()
    mapped, unmapped, ambiguous = base.map_identities(rows, games)
    if unmapped or ambiguous:
        raise RuntimeError(f"identity mapping failure unmapped={len(unmapped)} ambiguous={len(ambiguous)}")
    base.median = representative_actual_price
    paired, _ = base.paired_book_quotes(rows, mapped)
    canonical = {g["game_pk"]: g for g in games}

    out = []
    for game_pk, roles in paired.items():
        if game_pk not in canonical:
            continue
        opening = roles.get("opening") or {}
        closing = roles.get("closing") or {}
        if not opening or not closing:
            continue
        of = role_features(opening)
        cf = role_features(closing)
        mf = move_features(opening, closing)
        row = {
            "game_pk": int(game_pk),
            "game_date": canonical[game_pk]["game_date"],
            **{f"open_{k}": v for k, v in of.items()},
            **{f"close_{k}": v for k, v in cf.items()},
            **mf,
        }
        out.append(row)

    out.sort(key=lambda r: r["game_pk"])
    parts = write_sql(out)
    summary = {
        "contract":"MLB_TOTALS_MICROSTRUCTURE_2025_V1",
        "research_only":True,
        "games":len(out),
        "feature_count":len(FEATURES),
        "source_rows":len(rows),
        "odds_api_credits_consumed":0,
        "official_picks_writes":0,
        "apostar_activation":False,
        "postgame_fields_used":0,
        "sql_parts":parts,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT/"mlb_2025_totals_microstructure_v1_summary.json").write_text(
        json.dumps(summary,indent=2,sort_keys=True)+"\n",encoding="utf-8"
    )
    print(json.dumps(summary,indent=2,sort_keys=True))


if __name__ == "__main__":
    main()
