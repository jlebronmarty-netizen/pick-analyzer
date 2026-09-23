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
EXPECTED_ALL_BATTING_ROWS = 73092
EXPECTED_REGULAR_BATTING_ROWS = 71550
EXPECTED_REGULAR_GAMES = 2430
EXPECTED_ELIGIBLE_ROWS = 58410

EXPECTED_RBI = {
    "n": 2402,
    "wins": 2053,
    "baseline_n": 58410,
    "baseline_wins": 46224,
}
EXPECTED_HRRBI = {
    "n": 2582,
    "wins": 2278,
    "baseline_n": 58410,
    "baseline_wins": 46508,
    "monthly": {
        "2025-04": (303, 272),
        "2025-05": (442, 384),
        "2025-06": (471, 425),
        "2025-07": (489, 437),
        "2025-08": (393, 335),
        "2025-09": (484, 425),
    },
}

MIN_PRIOR_GAMES = 10
RECENT_WINDOW = 10
THRESHOLDS = [round(i * 0.05, 2) for i in range(1, 61)]
TARGETS = (("UNDER", 0.5), ("OVER", 0.5), ("UNDER", 1.5), ("OVER", 1.5))
OUT_PATH = os.environ.get("HRRBI_RESULT_PATH", "/tmp/mlb_hrrbi_line_surface_v1_result.json")


def emit(payload):
    out = json.dumps(payload, indent=2, sort_keys=True)
    print(out)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(out + "\n")


def fail(error, **details):
    emit({"status": "FAIL_CLOSED", "error": error, **details})
    raise SystemExit(2)


def to_int(value):
    s = (value or "").strip()
    if not s:
        return 0
    try:
        return int(s)
    except ValueError:
        return int(float(s))


def line_win(outcome, direction, line):
    return outcome < line if direction == "UNDER" else outcome > line


def wilson_lower(wins, n, z=1.959963984540054):
    if n <= 0:
        return None
    p = wins / n
    denom = 1 + z * z / n
    center = p + z * z / (2 * n)
    margin = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)
    return (center - margin) / denom


def download_archive():
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
        fail("RETROSHEET_ARCHIVE_SHA256_MISMATCH",
             expected=EXPECTED_SHA256, observed=digest, bytes=len(data))
    return data, digest


def read_unique_member(zf, suffix):
    matches = [name for name in zf.namelist() if name.endswith(suffix)]
    if len(matches) != 1:
        fail("ARCHIVE_MEMBER_NOT_UNIQUE", suffix=suffix, matches=matches)
    return matches[0], zf.read(matches[0])


def load_regular_batting(archive_bytes):
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as zf:
        batting_name, batting_bytes = read_unique_member(zf, "2025batting.csv")
        team_name, _ = read_unique_member(zf, "2025teamstats.csv")

    all_rows = list(csv.DictReader(io.StringIO(batting_bytes.decode("utf-8-sig"))))
    if len(all_rows) != EXPECTED_ALL_BATTING_ROWS:
        fail("ALL_BATTING_ROW_COUNT_MISMATCH",
             expected=EXPECTED_ALL_BATTING_ROWS, observed=len(all_rows))

    rows = []
    for r in all_rows:
        if (r.get("stattype") or "").strip() != "value":
            continue
        if (r.get("gametype") or "").strip() != "regular":
            continue
        rows.append({
            "gid": (r.get("gid") or "").strip(),
            "id": (r.get("id") or "").strip(),
            "date": (r.get("date") or "").strip(),
            "number": to_int(r.get("number")),
            "pa": to_int(r.get("b_pa")),
            "h": to_int(r.get("b_h")),
            "r": to_int(r.get("b_r")),
            "rbi": to_int(r.get("b_rbi")),
        })

    if len(rows) != EXPECTED_REGULAR_BATTING_ROWS:
        fail("REGULAR_BATTING_ROW_COUNT_MISMATCH",
             expected=EXPECTED_REGULAR_BATTING_ROWS, observed=len(rows))

    games = {r["gid"] for r in rows}
    if len(games) != EXPECTED_REGULAR_GAMES:
        fail("REGULAR_GAME_COUNT_MISMATCH",
             expected=EXPECTED_REGULAR_GAMES, observed=len(games))

    return rows, {
        "batting_member": batting_name,
        "teamstats_member": team_name,
        "all_batting_rows": len(all_rows),
        "regular_batting_rows": len(rows),
        "regular_games": len(games),
    }


def component(history, key):
    prior_pa = sum(x["pa"] for x in history)
    if prior_pa <= 0:
        return None
    l10 = history[-RECENT_WINDOW:]
    prior_event = sum(x[key] for x in history)
    l10_pa_per_game = sum(x["pa"] for x in l10) / RECENT_WINDOW
    l10_event_per_game = sum(x[key] for x in l10) / RECENT_WINDOW
    return 0.50 * ((prior_event / prior_pa) * l10_pa_per_game) + 0.50 * l10_event_per_game


def build_eligible(rows):
    by_player = defaultdict(list)
    for r in rows:
        if not r["id"] or not r["date"]:
            fail("MISSING_PLAYER_OR_DATE", row=r)
        by_player[r["id"]].append(r)

    eligible = []
    for player_id, games in by_player.items():
        games.sort(key=lambda x: (x["date"], x["number"], x["gid"]))
        history = []
        for game in games:
            if len(history) >= MIN_PRIOR_GAMES:
                strict_prior_date = [x for x in history if x["date"] < game["date"]]
                if len(strict_prior_date) >= MIN_PRIOR_GAMES:
                    ph = component(strict_prior_date, "h")
                    pr = component(strict_prior_date, "r")
                    pi = component(strict_prior_date, "rbi")
                else:
                    ph = pr = pi = None
                eligible.append({
                    "id": player_id,
                    "gid": game["gid"],
                    "date": game["date"],
                    "month": f"{game['date'][:4]}-{game['date'][4:6]}",
                    "rbi_proj": pi,
                    "hrrbi_proj": None if ph is None or pr is None or pi is None else ph + pr + pi,
                    "rbi": game["rbi"],
                    "hrrbi": game["h"] + game["r"] + game["rbi"],
                })
            history.append(game)

    eligible.sort(key=lambda x: (x["date"], x["gid"], x["id"]))
    if len(eligible) != EXPECTED_ELIGIBLE_ROWS:
        fail("ELIGIBLE_ROW_COUNT_MISMATCH",
             expected=EXPECTED_ELIGIBLE_ROWS, observed=len(eligible),
             unique_players=len(by_player))
    return eligible


def baseline(rows, outcome_key, direction, line):
    wins = sum(line_win(r[outcome_key], direction, line) for r in rows)
    return {"n": len(rows), "wins": wins, "accuracy": wins / len(rows)}


def evaluate(rows, projection_key, outcome_key, direction, line, threshold):
    projected = [r for r in rows if r[projection_key] is not None]
    if direction == "UNDER":
        selected = [r for r in projected if r[projection_key] <= threshold + 1e-12]
    else:
        selected = [r for r in projected if r[projection_key] >= threshold - 1e-12]

    by_month = defaultdict(list)
    for r in selected:
        by_month[r["month"]].append(r)
    monthly = {}
    for month in sorted(by_month):
        vals = by_month[month]
        wins = sum(line_win(r[outcome_key], direction, line) for r in vals)
        monthly[month] = {
            "n": len(vals),
            "wins": wins,
            "accuracy": wins / len(vals),
        }

    wins = sum(line_win(r[outcome_key], direction, line) for r in selected)
    return {
        "threshold": threshold,
        "n": len(selected),
        "wins": wins,
        "accuracy": wins / len(selected) if selected else None,
        "months": len(monthly),
        "worst_month": min((m["accuracy"] for m in monthly.values()), default=None),
        "wilson_lower": wilson_lower(wins, len(selected)),
        "monthly": monthly,
    }


def prove_controls(rows):
    rbi_base = baseline(rows, "rbi", "UNDER", 0.5)
    rbi = evaluate(rows, "rbi_proj", "rbi", "UNDER", 0.5, 0.10)
    observed_rbi = (rbi["n"], rbi["wins"], rbi_base["n"], rbi_base["wins"])
    expected_rbi = (
        EXPECTED_RBI["n"], EXPECTED_RBI["wins"],
        EXPECTED_RBI["baseline_n"], EXPECTED_RBI["baseline_wins"],
    )
    if observed_rbi != expected_rbi:
        fail("RBI_CONTROL_PARITY_FAIL",
             expected=expected_rbi, observed=observed_rbi,
             rbi_control=rbi, rbi_baseline=rbi_base)

    h_base = baseline(rows, "hrrbi", "UNDER", 2.5)
    h = evaluate(rows, "hrrbi_proj", "hrrbi", "UNDER", 2.5, 0.70)
    observed_h = (h["n"], h["wins"], h_base["n"], h_base["wins"])
    expected_h = (
        EXPECTED_HRRBI["n"], EXPECTED_HRRBI["wins"],
        EXPECTED_HRRBI["baseline_n"], EXPECTED_HRRBI["baseline_wins"],
    )
    if observed_h != expected_h:
        fail("HRRBI_CONTROL_PARITY_FAIL",
             expected=expected_h, observed=observed_h,
             hrrbi_control=h, hrrbi_baseline=h_base)

    observed_monthly = {m: (v["n"], v["wins"]) for m, v in h["monthly"].items()}
    if observed_monthly != EXPECTED_HRRBI["monthly"]:
        fail("HRRBI_MONTHLY_PARITY_FAIL",
             expected=EXPECTED_HRRBI["monthly"], observed=observed_monthly)

    return {
        "rbi_u0p5_proj_le_0p10": rbi,
        "rbi_u0p5_baseline": rbi_base,
        "hrrbi_u2p5_proj_le_0p70": h,
        "hrrbi_u2p5_baseline": h_base,
    }


def search_surfaces(rows):
    output = []
    for direction, line in TARGETS:
        b = baseline(rows, "hrrbi", direction, line)
        passing = []
        for threshold in THRESHOLDS:
            ev = evaluate(rows, "hrrbi_proj", "hrrbi", direction, line, threshold)
            if not ev["n"]:
                continue
            ev["baseline"] = b["accuracy"]
            ev["lift_pp"] = 100 * (ev["accuracy"] - b["accuracy"])
            ev["passes"] = (
                ev["accuracy"] >= 0.75
                and ev["n"] >= 60
                and ev["months"] >= 5
                and ev["worst_month"] is not None
                and ev["worst_month"] >= 0.65
                and ev["lift_pp"] >= 5.0
            )
            if ev["passes"]:
                passing.append(ev)

        passing.sort(
            key=lambda x: (-x["n"], -x["accuracy"], -(x["wilson_lower"] or 0), x["threshold"])
        )
        best = passing[0] if passing else None
        output.append({
            "direction": direction,
            "line": line,
            "baseline": b,
            "passing_thresholds": len(passing),
            "best_max_n_passing": best,
            "state": (
                "DEVELOPMENT_GATE_PASS_THRESHOLD_FROZEN"
                if best else "NO_75_PLUS_STABLE_SIGNAL_CANDIDATE"
            ),
        })
    return output


def main():
    archive, digest = download_archive()
    regular_rows, source_meta = load_regular_batting(archive)
    eligible = build_eligible(regular_rows)
    controls = prove_controls(eligible)
    surfaces = search_surfaces(eligible)

    result = {
        "contract": "MLB_BATTER_HRRBI_LINE_SURFACE_V1/1.0.0",
        "research_only": True,
        "source": {"url": SOURCE_URL, "sha256": digest, **source_meta},
        "feature_contract": {
            "min_prior_games": MIN_PRIOR_GAMES,
            "prior_rule": "strictly prior player games within 2025 only",
            "doubleheader_rule": "game number ordering makes earlier same-date player games prior",
            "recent_window": RECENT_WINDOW,
            "component_projection": "0.50*(prior event/PA*L10 PA/game)+0.50*L10 event/game",
            "hrrbi_projection": "proj_hits+proj_runs+proj_rbi",
        },
        "eligible_rows": len(eligible),
        "control_parity": controls,
        "development_gate": {
            "accuracy_min": 0.75,
            "n_min": 60,
            "months_min": 5,
            "worst_month_min": 0.65,
            "lift_pp_min": 5.0,
            "wilson_lower_reported": True,
            "priority": "maximum n among passing candidates",
        },
        "threshold_grid_frozen_before_2026": {
            "min": THRESHOLDS[0], "max": THRESHOLDS[-1], "step": 0.05
        },
        "surface_results_2025_development_only": surfaces,
        "external_2026_opened": False,
        "boundaries": {
            "official_picks_writes": 0,
            "apostar_activation": False,
            "production_promotion": False,
            "odds_api_historical_credits_consumed": 0,
            "provider_odds_calls": 0,
            "threshold_rescue_after_2026": False,
        },
        "status": "DEVELOPMENT_COMPLETE_EXTERNAL_GATE_CLOSED",
    }
    emit(result)


if __name__ == "__main__":
    main()
