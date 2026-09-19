#!/usr/bin/env python3
import json
import urllib.request

GAME_PKS=[776135,776136,822924]
out=[]
for game_pk in GAME_PKS:
    url=f"https://statsapi.mlb.com/api/v1/game/{game_pk}/decisions"
    req=urllib.request.Request(url,headers={"User-Agent":"pick-analyzer-research/1.0"})
    with urllib.request.urlopen(req,timeout=30) as resp:
        payload=json.load(resp)
    winner=payload.get("winner") or {}
    loser=payload.get("loser") or {}
    if not winner.get("id") or not loser.get("id"):
        raise RuntimeError(f"MLB_DECISIONS_INCOMPLETE:{game_pk}:{payload}")
    out.append({
        "game_pk":game_pk,
        "winner_id":int(winner["id"]),
        "winner_name":winner.get("fullName"),
        "loser_id":int(loser["id"]),
        "loser_name":loser.get("fullName"),
    })
print(json.dumps({"contract":"MLB_PITCHER_DECISIONS_PROBE/1.0.0","rows":out},indent=2))
