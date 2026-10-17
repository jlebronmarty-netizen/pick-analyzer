"""Bounded FREE official evidence acquisition; never writes prediction databases."""
import concurrent.futures, datetime, hashlib, json, pathlib, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
rows = json.loads((ROOT / 'pending-before.json').read_text())
games = sorted({int(r['game_pk']) for r in rows})
budget = 2 * len(games)
(ROOT / 'raw').mkdir(exist_ok=True)
ledger = ROOT / 'provider-calls.jsonl'
# A previous connectivity probe fetched game 823169/boxscore without retaining its body.
# Record that call explicitly; the auditable acquisition below retains exact bytes.
if not ledger.exists():
    ledger.write_text(json.dumps({'kind':'prior_connectivity_probe','gamePk':823169,'endpoint':'boxscore','httpStatus':200,'bytes':178206,'rawRetained':False,'reason':'Confirm FREE official source reachable for requested stale settlement repair','paidCredits':0})+'\n')

def fetch_one(item):
    gid, kind = item
    path = ROOT / 'raw' / f'{gid}-{kind}.json'
    if path.exists():
        return {'gamePk':gid,'kind':kind,'reused':True}
    url = (f'https://statsapi.mlb.com/api/v1/game/{gid}/boxscore' if kind == 'boxscore'
           else f'https://statsapi.mlb.com/api/v1/schedule?gamePk={gid}&sportId=1')
    event = {'gamePk':gid,'kind':kind,'url':url,'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reason':'Verify final game identity, exact player participation and pending research outcome','budget':budget,'paidCredits':0}
    try:
        with urllib.request.urlopen(url, timeout=25) as response:
            body = response.read()
            json.loads(body)
            path.write_bytes(body)
            event.update(httpStatus=response.status,sha256=hashlib.sha256(body).hexdigest(),bytes=len(body),path=str(path.relative_to(ROOT)))
    except Exception as exc:
        event['error'] = str(exc)
    return event

requests = [(g,k) for g in games for k in ['schedule','boxscore']]
assert len(requests) <= budget
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for event in pool.map(fetch_one, requests):
        with ledger.open('a') as out: out.write(json.dumps(event)+'\n')
        print(json.dumps({k:v for k,v in event.items() if k in ['gamePk','kind','httpStatus','reused','error']}),flush=True)
