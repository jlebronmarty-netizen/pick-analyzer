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
EXPECTED_BATTING_ROWS = 71550
EXPECTED_REGULAR_GAMES = 2430
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
    if len(all_rows) != EXPECTED_BATTING_ROWS:
        fail(
            "BATTING_ROW_COUNT_MISMATCH",
            expected=EXPECTED_BATTING_ROWS,
            observed=len(all_rows),
            batting_member=batting_name,
        )

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
        by_date = defaultdict(list)
        for r in games:
            by_date[r["date"]].append(r)
        history = []
        for date in sorted(by_date):
            day_rows = sorted(by_date[date], key=lambda x: (x["number"], x["gid"]))
            if len(history) >= MIN_PRIOR_GAMES:
                proj_h = component(history, "h")
                proj_r = component(history, "r")
                proj_rbi = component(history, "rbi")
                if proj_h is not None and proj_r is not None and proj_rbi is not None:
                    hrrbi_proj = proj_h + proj_r + proj_rbi
                    rbi_proj = proj_rbi
                    for r in day_rows:
                        eligible.append(
                            {
                                "id": player_id,
                                "gid": r["gid"],
                                "date": date,
                                "month": date[:7],
                                "hrrbi_proj": hrrbi_proj,
                                "rbi_proj": rbi_proj,
                                "hrrbi": r["h"] + r["r"] + r["rbi"],
                                "rbi": r["rbi"],
                            }
                        )
            history.extend(day_rows)
    eligible.sort(key=lambda x: (x["date"], x["gid"], x["id"]))
    return eligible

def eval_rule(rows, projection_key, outcome_key, direction, line, threshold):
    if direction == "UNDER":
        selected = [r for r in rows if r[projection_key] <= threshold + 1e-12]
    else:
        selected = [r for r in rows if r[projection_key] >= threshold - 1e-12]
    n = len(selected)
    wins = sum(1 for r in selected if line_win(r[outcome_key], direction, line))
    monthly = {}
    by_month = defaultdict(list)
    for r in selected:
        by_month[r["month"]].append(r)
    for month in sorted(by_month):
        vals = by_month[month]
        mw = sum(1 for r in vals if line_win(r[outcome_key], direction, line))
        monthly[month] = {
            "n": len(vals),
            "wins": mw,
            "accuracy": mw / len(vals) if vals else None,
        }
    return {
        "threshold": threshold,
        "n": n,
        "wins": wins,
        "accuracy": wins / n if n else None,
        "months": len(monthly),
        "worst_month": min((x["accuracy"] for x in monthly.values()), default=None),
        "wilson_lower": wilson_lower(wins, n),
        "monthly": monthly,
    }

def baseline(rows, outcome_key, direction, line):
    n = len(rows)
    wins = sum(1 for r in rows if line_win(r[outcome_key], direction, line))
    return {"n": n, "wins": wins, "accuracy": wins / n if n else None}

def assert_control_parity(eligible):
    rbi_base = baseline(eligible, "rbi", "UNDER", 0.5)
    rbi = eval_rule(eligible, "rbi_proj", "rbi", "UNDER", 0.5, 0.10)
    if (rbi["n"], rbi["wins"]) != (EXPECTED_RBI_CONTROL["n"], EXPECTED_RBI_CONTROL["wins"]):
        fail("RBI_CONTROL_PARITY_FAIL", expected=EXPECTED_RBI_CONTROL, observed={"n": rbi["n"], "wins": rbi["wins"]}, baseline=rbi_base)
    if abs(rbi_base["accuracy"] - EXPECTED_RBI_BASELINE) > 1e-12:
        fail("RBI_BASELINE_PARITY_FAIL", expected=EXPECTED_RBI_BASELINE, observed=rbi_base["accuracy"])

    hbase = baseline(eligible, "hrrbi", "UNDER", 2.5)
    hctrl = eval_rule(eligible, "hrrbi_proj", "hrrbi", "UNDER", 2.5, 0.70)
    if (hctrl["n"], hctrl["wins"]) != (EXPECTED_HRRBI_CONTROL["n"], EXPECTED_HRRBI_CONTROL["wins"]):
        fail("HRRBI_CONTROL_PARITY_FAIL", expected=EXPECTED_HRRBI_CONTROL, observed={"n": hctrl["n"], "wins": hctrl["wins"]}, baseline=hbase)
    if abs(hbase["accuracy"] - EXPECTED_HRRBI_BASELINE) > 1e-12:
        fail("HRRBI_BASELINE_PARITY_FAIL", expected=EXPECTED_HRRBI_BASELINE, observed=hbase["accuracy"])
    observed_monthly = {m: (x["n"], x["wins"]) for m, x in hctrl["monthly"].items()}
    if observed_monthly != EXPECTED_HRRBI_MONTHLY:
        fail("HRRBI_MONTHLY_PARITY_FAIL", expected=EXPECTED_HRRBI_MONTHLY, observed=observed_monthly)
    return {
        "rbi_u0p5_proj_le_0p10": rbi,
        "rbi_u0p5_baseline": rbi_base,
        "hrrbi_u2p5_proj_le_0p70": hctrl,
        "hrrbi_u2p5_baseline": hbase,
    }

def search_surface(eligible):
    results = []
    for direction, line in TARGETS:
        b = baseline(eligible, "hrrbi", direction, line)
        candidates = []
        for threshold in GRID:
            ev = eval_rule(eligible, "hrrbi_proj", "hrrbi", direction, line, threshold)
            if ev["n"] == 0:
                continue
            ev["baseline"] = b["accuracy"]
            ev["lift_pp"] = (ev["accuracy"] - b["accuracy"]) * 100
            ev["passes"] = (
                ev["accuracy"] >= 0.75
                and ev["n"] >= 60
                and ev["months"] >= 5
                and ev["worst_month"] is not None
                and ev["worst_month"] >= 0.65
                and ev["lift_pp"] >= 5.0
            )
            candidates.append(ev)
        passing = [c for c in candidates if c["passes"]]
        passing.sort(key=lambda c: (-c["n"], -c["accuracy"], -c["wilson_lower"], c["threshold"]))
        best = passing[0] if passing else None
        results.append(
            {
                "contract": f"batter_hrrbi_{direction.lower()}_{str(line).replace('.', 'p')}",
                "direction": direction,
                "line": line,
                "eligible_baseline": b,
                "grid": {"min": GRID[0], "max": GRID[-1], "step": 0.05},
                "passing_count": len(passing),
                "best_max_n_passing": best,
                "state": "DEVELOPMENT_GATE_PASS_THRESHOLD_FROZEN" if best else "NO_75_PLUS_STABLE_SIGNAL_CANDIDATE",
            }
        )
    return results

def main():
    archive_bytes, digest = download()
    rows, source_meta = load_rows(archive_bytes)
    eligible = build_eligible(rows)
    controls = assert_control_parity(eligible)
    surfaces = search_surface(eligible)

    result = {
        "contract": "MLB_BATTER_HRRBI_LINE_SURFACE_V1/1.0.0",
        "research_only": True,
        "source": {
            "url": SOURCE_URL,
            "sha256": digest,
            **source_meta,
        },
        "feature_contract": {
            "min_prior_games": MIN_PRIOR_GAMES,
            "prior_rule": "strictly prior player games within 2025 only; same-date games excluded from one another",
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
        "threshold_grid_frozen_before_2026": {"min": 0.05, "max": 3.0, "step": 0.05},
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
    out = json.dumps(result, indent=2, sort_keys=True)
    print(out)
    out_path = os.environ.get("HRRBI_RESULT_PATH", "/tmp/mlb_hrrbi_line_surface_v1_result.json")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(out + "\n")

if __name__ == "__main__":
    main()
