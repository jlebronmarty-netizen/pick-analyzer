"""Offline projection from the pinned Sports Edge Hub archive; no network IO."""
import collections
import hashlib
import json
import sys
import zipfile
from datetime import datetime
from pathlib import Path

archive, output = map(Path, sys.argv[1:])
expected = "6af590d979fc42e5667a8ca5fbc850340f69cf62f23d04a97d30a836cd76cf4a"
with archive.open("rb") as f:
    assert hashlib.file_digest(f, "sha256").hexdigest() == expected
with zipfile.ZipFile(archive) as z:
    base = "derived/boxscores-1100-20261010/"
    coverage = json.loads(z.read(base + "coverage.json"))
    grouped = collections.defaultdict(list)
    for line in z.open(base + "teams.jsonl"):
        row = json.loads(line)
        grouped[row["event_id"]].append(row)
games = []
asof = datetime.fromisoformat(coverage["at"])
for event_id, rows in sorted(grouped.items()):
    if len(rows) != 2 or any(r["boxscore_validation"] != "PASS" or r["errors"] or not r["time_verified"] for r in rows):
        continue
    away, home = sorted(rows, key=lambda r: r["side"])
    assert [away["side"], home["side"]] == ["away", "home"]
    assert home["team_id"] != away["team_id"] and event_id.startswith("espn:")
    assert all(home[k] == away[k] for k in ("scheduled_at", "season_ending_year", "source_lineage"))
    start = datetime.fromisoformat(home["scheduled_at"])
    assert all(start < datetime.fromisoformat(r[key]["captured_at"]) <= asof for r in rows for key in ("source_lineage", "game_observation"))
    scores = [r["final_score"] for r in (home, away)]
    assert scores[0] != scores[1] and all(isinstance(v,(float,int)) and v>=0 and int(v)==v for v in scores)
    games.append([home["season_ending_year"],event_id,home["scheduled_at"],home["team_id"],away["team_id"],*map(int,scores)])
assert len(games)==sum(s["validated_boxscore_games"] for s in coverage["seasons"])
output.write_text(json.dumps({"availableAt":coverage["at"],"games":games},separators=(",",":"))+"\n")
