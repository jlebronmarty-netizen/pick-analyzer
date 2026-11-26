"""Compile archived Pick query results into a versioned, time-filterable supplement."""
import collections
import glob
import json
import sys
from pathlib import Path

def read(pattern):
    return [item for file in sorted(glob.glob(str(Path(sys.argv[1]) / pattern)))
            for item in json.loads(Path(file).read_text())]

def verified_periods(box, play):
    game = box['game']
    count = game['period']
    if not play or not play['unique_order'] or count < 4:
        return {}
    if play['ended'] != 1:
        # Some finalized feeds end with the regulation/OT horn instead of a separate game marker.
        terminal = play.get('terminal') or []
        if (play['ended'] != 0 or game.get('status') != 'Final' or len(terminal) != 5
                or terminal[:2] != ['End Period', count] or terminal[2] not in ('0.0','0:00','00:00')
                or terminal[3:] != [game['home_team_score'], game['visitor_team_score']]
                or terminal[3] == terminal[4]):
            return {}
    ends = play['ends'] or []
    home = away = 0
    for period in range(1, count + 1):
        suffix = 'q' + str(period) if period <= 4 else 'ot' + str(period - 4)
        scores = [game.get(side + '_' + suffix) for side in ('home','visitor')]
        if None in scores:
            return {}
        home += scores[0]
        away += scores[1]
        if [period,home,away] not in ends:
            return {}
    if len(ends) != count or [home,away] != [game['home_team_score'],game['visitor_team_score']]:
        return {}
    by_player = collections.defaultdict(dict)
    for period,player,*stats,active in play['rows']:
        by_player[player][period] = (stats,active)
    result = {}
    for player,_,minutes,*values in box['players']:
        periods = by_player[player]
        if not periods or not minutes or minutes in ('0','0:00','00:00'):
            continue
        # Zero from a closed event stream is admissible only for reconciled metrics.
        # Require a participation event in the requested segment independently.
        valid = [v is not None and sum(stats[j] for stats,_ in periods.values()) == v
                 for j,v in enumerate(values[:7])]
        if not any(valid):
            continue
        segments = [(f'Q{i}',[i]) for i in range(1,5)] + [('1H',[1,2]),('2H',list(range(3,count+1)))]
        result[player] = {}
        for label,segment in segments:
            rows = [periods[i] for i in segment if i in periods]
            if any(active for _,active in rows):
                result[player][label] = [sum(stats[j] for stats,_ in rows) if ok else None for j,ok in enumerate(valid)]
    return result

boxes = read('nbab[0-9]*.json')
pbp = {x['id']:x for x in read('nbap[0-9]*.json')}
games = []
for box in sorted(boxes,key=lambda x:x['id']):
    g = box['game']
    p = pbp.get(box['id'])
    verified = verified_periods(box,p)
    games.append(dict(id=str(box['id']),start=g['datetime'],at=box['at'],
                      home=g['home_team_id'],away=g['visitor_team_id'],scores=[g['home_team_score'],g['visitor_team_score']],
                      players=box['players'],periodAt=p['at'] if verified else None,periods=verified))
dest = Path(sys.argv[2])
dest.write_text(json.dumps(dict(games=games,schedule=read('nbas[0-9]*.json'),originals=read('nbao[0-9]*.json')),separators=(',',':')))
print(len(games),'boxes;',sum(bool(g['periods']) for g in games),'reconciled games;',dest.stat().st_size,'bytes')
