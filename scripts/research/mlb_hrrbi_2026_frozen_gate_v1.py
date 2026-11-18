#!/usr/bin/env python3
import concurrent.futures
import json
import math
import os
import re
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

NAME_UNIVERSE_PATH = Path("artifacts/research/mlb_hrrbi_2026_frozen_gate_name_universe_v1.json")
OUT_PATH = Path(os.environ.get("HRRBI_2026_RESULT_PATH", "/tmp/mlb_hrrbi_2026_frozen_gate_v1.json"))
SEASON = 2026
WINDOW_START = "2026-03-26"
WINDOW_END = "2026-07-19"
EXPECTED_RESOLVED_PLAYERS = 516
EXPECTED_RAW_GAMELOG_ROWS = 30889
EXPECTED_ELIGIBLE_ROWS = 25729
EXPECTED_CONTROL = {"n": 1255, "wins": 1073}
FROZEN = [
    {"candidate_id":"batter_hrrbi_under_0p5_proj_0p05_v1","line":0.5,"threshold":0.05},
    {"candidate_id":"batter_hrrbi_under_1p5_proj_0p90_v1","line":1.5,"threshold":0.90},
]

def emit(payload):
    text = json.dumps(payload, indent=2, sort_keys=True)
    print(text)
    OUT_PATH.write_text(text + "\n", encoding="utf-8")

def fail(error, **details):
    emit({"status":"FAIL_CLOSED","error":error,**details})
    raise SystemExit(2)

def get_json(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent":"PickAnalyzerResearch/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP_{response.status}:{url}")
        return json.load(response)

def normalize_person(value):
    trimmed = str(value or "").strip()
    if "," in trimmed:
        parts = trimmed.split(",")
        trimmed = ",".join(parts[1:]).strip() + " " + parts[0].strip()
    value = unicodedata.normalize("NFKD", trimmed)
    value = "".join(ch for ch in value if not unicodedata.combining(ch)).lower()
    value = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", value)
    return re.sub(r"[^a-z0-9]+", "", value)

def wilson_lower(wins, n, z=1.959963984540054):
    if n <= 0:
        return None
    p = wins / n
    denom = 1 + z*z/n
    return (p + z*z/(2*n) - z*math.sqrt((p*(1-p)+z*z/(4*n))/n)) / denom

def official_directory():
    url = "https://statsapi.mlb.com/api/v1/sports/1/players?season=2026&gameType=R"
    payload = get_json(url)
    people = payload.get("people") or []
    directory = defaultdict(list)
    for person in people:
        pid = int(person.get("id") or 0)
        name = str(person.get("fullName") or "").strip()
        key = normalize_person(name)
        if pid > 0 and name and key:
            if all(x["id"] != pid for x in directory[key]):
                directory[key].append({"id":pid,"name":name})
    return people, directory

def resolve_players():
    source = json.loads(NAME_UNIVERSE_PATH.read_text(encoding="utf-8"))
    source_players = source["players"]
    official_people, directory = official_directory()
    resolved = []
    unresolved = []
    for item in source_players:
        name = item["player_name"]
        key = normalize_person(name)
        matches = directory.get(key, [])
        if len(matches) == 1:
            resolved.append({
                "source_player_id": item["player_id"],
                "source_name": name,
                "source_team_ids": item.get("team_ids") or [],
                "key": key,
                **matches[0],
            })
        else:
            unresolved.append({
                "source_player_id": item["player_id"],
                "source_name": name,
                "source_team_ids": item.get("team_ids") or [],
                "key":key,
                "match_count":len(matches),
                "matches":matches,
            })
    if len(resolved) != EXPECTED_RESOLVED_PLAYERS:
        fail(
            "EXACT_IDENTITY_UNIVERSE_MISMATCH",
            expected_resolved=EXPECTED_RESOLVED_PLAYERS,
            observed_resolved=len(resolved),
            source_players=len(source_players),
            official_directory_rows=len(official_people),
            unresolved=unresolved,
        )
    return source, resolved, unresolved, len(official_people)


def batter_game_log(player):
    pid = player["id"]
    url = (
        f"https://statsapi.mlb.com/api/v1/people/{pid}/stats?"
        + urllib.parse.urlencode({"stats":"gameLog","group":"hitting","season":"2026"})
    )
    payload = get_json(url, timeout=30)
    splits = []
    for block in payload.get("stats") or []:
        splits.extend(block.get("splits") or [])
    rows = []
    for split in splits:
        game = split.get("game") or {}
        stat = split.get("stat") or {}
        game_pk = int(game.get("gamePk") or 0)
        date = str(split.get("date") or "")[:10]
        if not game_pk or not date or date < WINDOW_START or date > WINDOW_END:
            continue
        def n(key):
            try:
                return float(stat.get(key) or 0)
            except Exception:
                return 0.0
        rows.append({
            "player_id":pid,
            "player_name":player["name"],
            "gamePk":game_pk,
            "date":date,
            "plateAppearances":n("plateAppearances"),
            "hits":n("hits"),
            "runs":n("runs"),
            "rbi":n("rbi"),
        })
    rows.sort(key=lambda x:(x["date"],x["gamePk"]))
    return rows

def fetch_logs(players):
    failures = []
    all_rows = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        future_map = {ex.submit(batter_game_log, player):player for player in players}
        for future in concurrent.futures.as_completed(future_map):
            player = future_map[future]
            try:
                all_rows.extend(future.result())
            except Exception as exc:
                failures.append({"id":player["id"],"name":player["name"],"error":str(exc)[:300]})
    if failures:
        fail("MLB_OFFICIAL_GAMELOG_FETCH_FAILURE", failures=failures[:20], failure_count=len(failures))
    if len(all_rows) != EXPECTED_RAW_GAMELOG_ROWS:
        fail(
            "RAW_GAMELOG_ROW_PARITY_FAIL",
            expected=EXPECTED_RAW_GAMELOG_ROWS,
            observed=len(all_rows),
        )
    return all_rows

def project(history):
    if len(history) < 10:
        return None
    prior_pa = sum(r["plateAppearances"] for r in history)
    if prior_pa <= 0:
        return None
    recent = history[-10:]
    recent_pa_per_game = sum(r["plateAppearances"] for r in recent) / len(recent)
    total = 0.0
    components = {}
    for key in ("hits","runs","rbi"):
        prior_y = sum(r[key] for r in history)
        recent_y = sum(r[key] for r in recent) / len(recent)
        prior_rate = prior_y / prior_pa
        predicted = 0.50 * (prior_rate * recent_pa_per_game) + 0.50 * recent_y
        components[key] = predicted
        total += predicted
    return total, components

def build_eligible(all_rows):
    by_player = defaultdict(list)
    for row in all_rows:
        by_player[row["player_id"]].append(row)
    eligible = []
    for pid, rows in by_player.items():
        rows.sort(key=lambda x:(x["date"],x["gamePk"]))
        for target in rows:
            history = [r for r in rows if r["date"] < target["date"]]
            p = project(history)
            if p is None:
                continue
            projection, components = p
            eligible.append({
                **target,
                "month":target["date"][:7],
                "projection":projection,
                "components":components,
                "actual":target["hits"] + target["runs"] + target["rbi"],
                "prior_games":len(history),
            })
    eligible.sort(key=lambda x:(x["date"],x["gamePk"],x["player_id"]))
    if len(eligible) != EXPECTED_ELIGIBLE_ROWS:
        fail(
            "ELIGIBLE_ROW_PARITY_FAIL",
            expected=EXPECTED_ELIGIBLE_ROWS,
            observed=len(eligible),
        )
    return eligible

def evaluate(rows, line, threshold):
    selected = [r for r in rows if r["projection"] <= threshold + 1e-12]
    wins = sum(1 for r in selected if r["actual"] < line)
    baseline_wins = sum(1 for r in rows if r["actual"] < line)
    by_month = defaultdict(list)
    for r in selected:
        by_month[r["month"]].append(r)
    monthly = {}
    for month, vals in sorted(by_month.items()):
        mw = sum(1 for r in vals if r["actual"] < line)
        monthly[month] = {"n":len(vals),"wins":mw,"accuracy":mw/len(vals)}
    accuracy = wins / len(selected) if selected else None
    baseline = baseline_wins / len(rows)
    return {
        "n":len(selected),
        "wins":wins,
        "accuracy":accuracy,
        "baseline_n":len(rows),
        "baseline_wins":baseline_wins,
        "baseline_accuracy":baseline,
        "lift_pp":None if accuracy is None else 100*(accuracy-baseline),
        "months":len(monthly),
        "worst_month":min((v["accuracy"] for v in monthly.values()), default=None),
        "wilson_lower":wilson_lower(wins,len(selected)),
        "monthly":monthly,
    }

def main():
    name_source, players, unresolved, official_directory_rows = resolve_players()
    all_rows = fetch_logs(players)
    eligible = build_eligible(all_rows)

    control = evaluate(eligible, 2.5, 0.70)
    if (control["n"],control["wins"]) != (EXPECTED_CONTROL["n"],EXPECTED_CONTROL["wins"]):
        fail(
            "HRRBI_U2P5_2026_CONTROL_PARITY_FAIL",
            expected=EXPECTED_CONTROL,
            observed={"n":control["n"],"wins":control["wins"]},
            control=control,
        )

    results = []
    for candidate in FROZEN:
        ev = evaluate(eligible, candidate["line"], candidate["threshold"])
        passes = (
            ev["accuracy"] is not None and ev["accuracy"] >= 0.75
            and ev["n"] >= 60
            and ev["months"] >= 5
            and ev["worst_month"] is not None and ev["worst_month"] >= 0.65
            and ev["lift_pp"] is not None and ev["lift_pp"] >= 5.0
        )
        results.append({
            **candidate,
            "evaluation":ev,
            "passes_full_diagnostic_gate":passes,
            "state":"2026_DIAGNOSTIC_GATE_PASS" if passes else "2026_DIAGNOSTIC_GATE_FAIL_NO_RETUNE",
        })

    emit({
        "contract":"MLB_BATTER_HRRBI_2026_FROZEN_GATE_V1/1.0.0",
        "research_only":True,
        "evidence_label":"EXACT_MLB_OFFICIAL_2026_DIAGNOSTIC_AFTER_PRIOR_HRRBI_FAMILY_READ_NOT_PRISTINE_EXTERNAL",
        "source":{
            "identity_universe":str(NAME_UNIVERSE_PATH),
            "identity_rule":"runtime-equivalent unique exact normalized name only; fuzzy matching false",
            "official_directory_endpoint":"MLB StatsAPI sports/1/players season=2026 gameType=R",
            "outcomes":"MLB Official StatsAPI hitting gameLog",
            "window":[WINDOW_START,WINDOW_END],
            "resolved_players":len(players),
            "unresolved_unique_names":len(unresolved),
            "official_directory_rows":official_directory_rows,
            "raw_game_log_rows":len(all_rows),
            "eligible_rows":len(eligible),
        },
        "frozen_before_2026":[
            {"candidate_id":x["candidate_id"],"line":x["line"],"threshold":x["threshold"]} for x in FROZEN
        ],
        "control_parity":{
            "candidate_id":"batter_hrrbi_under_2p5_proj_0p70_v1",
            "expected":EXPECTED_CONTROL,
            "observed":control,
            "status":"EXACT_2026_PARITY_PASS",
        },
        "results":results,
        "retuned_after_2026":False,
        "threshold_rescue_after_2026":False,
        "boundaries":{
            "official_picks_writes":0,
            "apostar_activation":False,
            "production_promotion":False,
            "odds_api_historical_credits_consumed":0,
            "sportsdata_outcomes_used":False,
            "fuzzy_matching_used":False,
            "tracker_modified":False,
        },
        "status":"ONE_SHOT_2026_DIAGNOSTIC_COMPLETE_NO_RETUNE",
    })

if __name__ == "__main__":
    main()
