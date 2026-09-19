#!/usr/bin/env python3
import json
import urllib.parse
import urllib.request

FIELDS="dates,date,games,gamePk,decisions,winner,id,fullName,loser,save"
params={
    "sportId":1,
    "date":"2026-09-17",
    "hydrate":"decisions",
    "fields":FIELDS,
}
url="https://statsapi.mlb.com/api/v1/schedule?"+urllib.parse.urlencode(params)
req=urllib.request.Request(url,headers={"User-Agent":"pick-analyzer-research/1.0"})
with urllib.request.urlopen(req,timeout=30) as resp:
    payload=json.load(resp)

rows=[]
for d in payload.get("dates",[]):
    for game in d.get("games",[]):
        dec=game.get("decisions") or {}
        winner=dec.get("winner") or {}
        loser=dec.get("loser") or {}
        if not winner.get("id") or not loser.get("id"):
            raise RuntimeError(f"SCHEDULE_DECISIONS_INCOMPLETE:{game.get('gamePk')}:{dec}")
        rows.append({
            "game_pk":int(game["gamePk"]),
            "winner_id":int(winner["id"]),
            "winner_name":winner.get("fullName"),
            "loser_id":int(loser["id"]),
            "loser_name":loser.get("fullName"),
        })
if not any(x["game_pk"]==822924 and x["winner_id"]==656876 for x in rows):
    raise RuntimeError("SCHEDULE_DECISIONS_PARITY_FAILED")
print(json.dumps({
    "contract":"MLB_PITCHER_DECISIONS_SCHEDULE_PROBE/1.0.0",
    "date":"2026-09-17",
    "games":len(rows),
    "parity_game_pk":822924,
    "rows":rows
},indent=2))
