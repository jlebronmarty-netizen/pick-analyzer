"""Independent arithmetic/as-of verifier. No provider calls or database writes."""
import json,gzip,hashlib,math,unicodedata
from pathlib import Path
from collections import defaultdict
root=Path('research/ufc-free-v1')
def read(name):
 p=root/name
 return json.loads(gzip.decompress(p.read_bytes()) if p.suffix=='.gz' else p.read_text())
x=read('inputs.json.gz');summary=read('results/summary.json');bets=read('results/bets.json.gz');trials=read('results/trials.json.gz');selection=read('results/selection.json')
def key(s):return ''.join(c for c in unicodedata.normalize('NFKD',s).lower() if c in 'abcdefghijklmnopqrstuvwxyz0123456789')
facts={b['id']:b for b in x['history']};assert len(facts)==len(x['history'])
# Replay dates independently; every forecast is checked before any target-date update.
by=defaultdict(list)
for b in facts.values():by[b['date']].append(b)
checks={(t['formula'],t['bout']):t for t in trials};assert len(checks)==len(trials)
for k in [16,32,64]:
 ratings={};count=defaultdict(int)
 for date,bs in sorted(by.items()):
  for b in bs:
   a,c=key(b['a']),key(b['b']);p=1/(1+10**((ratings.get(c,1500)-ratings.get(a,1500))/400))
   for ev in [3,7]:
    t=checks.get((f'ELO_K{k}_EV{ev}',b['id']))
    if t is None:continue
    if min(count[a],count[c])<3:assert t['probabilityA'] is None
    else:assert abs(t['probabilityA']-p)<1e-12
  delta=defaultdict(float)
  for b in bs:
   if b['result']=='NC':continue
   a,c=key(b['a']),key(b['b']);p=1/(1+10**((ratings.get(c,1500)-ratings.get(a,1500))/400));score={'A':1,'B':0,'DRAW':.5}[b['result']];d=k*(score-p);delta[a]+=d;delta[c]-=d
   if b['result']!='DRAW':count[a]+=1;count[c]+=1
  for name,d in delta.items():ratings[name]=ratings.get(name,1500)+d
seen=set()
for b in bets:
 assert (b['formula'],b['bout']) not in seen;seen.add((b['formula'],b['bout']))
 f=facts[b['bout']];winner=key(f['a']) if f['result']=='A' else key(f['b']) if f['result']=='B' else None
 assert b['date']==f['date'];assert b['side'] in [key(f['a']),key(f['b'])];assert b['decimal']>1
 expected=None if winner is None else b['decimal']-1 if b['side']==winner else -1
 assert b['profit']==expected;assert b['stake']==(0 if winner is None else 1)
 if b['formula'].startswith('ELO_K') and 'EV' in b['formula']:
  assert b['probability']*b['decimal']-1>=int(b['formula'].split('EV')[1])/100-1e-12
  assert 1.2<=b['decimal']<=6
 assert b['phase']==('DEVELOPMENT' if b['date']<'2021-01-01' else 'CONFIRMATION')
for e in summary['experiments']:
 for phase in ['development','confirmation']:
  rows=[b for b in bets if b['formula']==e['parameters']['id'] and b['phase']==phase.upper() and b['profit'] is not None];m=e[phase]
  assert m['settled']==len(rows);assert m['wins']==sum(b['result']=='WIN' for b in rows)
  assert math.isclose(m['profitUnits'] or 0,sum(b['profit'] for b in rows),abs_tol=1e-9)
  if rows:assert math.isclose(m['roiPct'],100*sum(b['profit'] for b in rows)/len(rows),abs_tol=1e-9)
assert summary['chosen']==selection['chosen'];assert len(summary['experiments'])==8
assert selection['chosen'] is None # none met this frozen development rule
assert summary['protocolSha256']==hashlib.sha256((root/'PROTOCOL.md').read_bytes()).hexdigest()
assert summary['selectionSha256']==hashlib.sha256((root/'results/selection.json').read_bytes()).hexdigest()
result={'status':'PASS','independentLanguage':'Python','facts':len(facts),'trials':len(trials),'bets':len(bets),'checks':['unique bouts and economic selections','prior-date Elo replay all K','warmup','frozen threshold and odds bounds','flat stakes, result identity, profits and ROI','development/confirmation separation','protocol and selection hashes'],'limits':['source availability and sportsbook contracts not certified','no positive-ROI candidate; no certification of profitability']}
(root/'results/verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
