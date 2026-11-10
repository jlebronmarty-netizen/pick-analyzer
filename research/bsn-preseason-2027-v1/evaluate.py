"""Reproduce a fixed exploratory BSN pilot without remote calls or production writes."""
import hashlib,json,math
from collections import defaultdict
from datetime import datetime
from fractions import Fraction
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parent
POLICIES=['HOME_BASELINE','ELO32_MIN3','FORM5_MIN3','SCORES5_MIN3']
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read_games(rows):
    candidates=[];reject=[];conflicts=set();seen={}
    for r in rows:
        try:
            when=datetime.fromisoformat(r['start_time'].replace('Z','+00:00'))
            if when.tzinfo is None: raise ValueError('Timezone absent')
            date=when.astimezone(ZoneInfo('America/Puerto_Rico')).date().isoformat()
            if r['status'] not in ['completed','final'] or r['home_team_id']==r['away_team_id']: raise ValueError('Status/identity')
            if not all(isinstance(r[k],str) and r[k] for k in ['id','season','home_team_id','away_team_id','home_team','away_team']): raise ValueError('Missing ID')
            if any(type(r[k]) is not int or r[k]<0 for k in ['home_score','away_score']): raise ValueError('Invalid scores')
            if r['home_score']==r['away_score']: raise ValueError('Nondecisive score')
            g=dict(r,date=date)
            economic=(r['season'],date,tuple(sorted((r['home_team_id'],r['away_team_id']))))
            for key in [('id',r['id']),('economic',economic)]:
                if key in seen:conflicts.update((seen[key],r['id']))
                seen[key]=r['id']
            candidates.append(g)
        except (KeyError,TypeError,ValueError) as e: reject.append({'id':r.get('id'),'reason':str(e)})
    for g in candidates:
        if g['id'] in conflicts:reject.append({'id':g['id'],'reason':'Duplicate or ambiguous economic event'})
    return sorted((g for g in candidates if g['id'] not in conflicts),key=lambda g:(g['date'],g['id'])),reject
def wilson(w,n):
    if not n:return None
    z=1.959963984540054;p=w/n;den=1+z*z/n
    middle=(p+z*z/(2*n))/den;half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
    return [100*(middle-half),100*(middle+half)]
def evaluate(games):
    history=defaultdict(list);rating=defaultdict(lambda:1500.);allrows=[];days=defaultdict(list)
    for g in games:days[(g['season'],g['date'])].append(g)
    season=None
    for (this,date),batch in sorted(days.items()):
        if season!=this:history.clear();rating.clear();season=this
        updates=defaultdict(float)
        for g in batch:
            a,b=g['home_team_id'],g['away_team_id'];ha,hb=history[a],history[b]
            home_won=g['home_score']>g['away_score'];p=1/(1+10**((rating[b]-rating[a])/400))
            for policy in POLICIES:
                f={'policy':policy,'eventId':g['id'],'season':this,'date':date,'homeId':a,'awayId':b,'home':g['home_team'],'away':g['away_team'],
                   'homeScore':g['home_score'],'awayScore':g['away_score'],'actualWinnerId':a if home_won else b,
                   'selectedId':None,'result':'ABSTAIN','probabilityHome':None,'projectedHome':None,'projectedAway':None,'reason':None,
                   'priorHome':len(ha),'priorAway':len(hb),'inputsHome':[],'inputsAway':[],'latestFeatureDate':None,'roi':None}
                selected=None
                if policy=='HOME_BASELINE': selected=a
                elif min(len(ha),len(hb))<3: f['reason']='WARMUP_MIN3'
                else:
                    xa,xb=(ha,hb) if policy=='ELO32_MIN3' else (ha[-5:],hb[-5:])
                    f['inputsHome']=[x['id'] for x in xa];f['inputsAway']=[x['id'] for x in xb]
                    f['latestFeatureDate']=max(x['date'] for x in xa+xb)
                    assert f['latestFeatureDate']<date
                    if policy=='ELO32_MIN3':
                        f['probabilityHome']=p
                        selected=a if p>.5 else b if p<.5 else None
                    elif policy=='FORM5_MIN3':
                        wa=sum(x['won'] for x in xa);wb=sum(x['won'] for x in xb)
                        pa,pb=Fraction(wa,len(xa)),Fraction(wb,len(xb))
                        selected=a if pa>pb else b if pb>pa else None
                    else:
                        ph=(Fraction(sum(x['for'] for x in xa),len(xa))+Fraction(sum(x['against'] for x in xb),len(xb)))/2
                        pv=(Fraction(sum(x['for'] for x in xb),len(xb))+Fraction(sum(x['against'] for x in xa),len(xa)))/2
                        f['projectedHome'],f['projectedAway']=float(ph),float(pv)
                        selected=a if ph>pv else b if pv>ph else None
                    if selected is None:f['reason']='EQUAL_MODEL_SCORES'
                if selected is not None:
                    f['selectedId']=selected;f['result']='WIN' if selected==f['actualWinnerId'] else 'LOSS'
                allrows.append(f)
            delta=32*(int(home_won)-p)
            updates[a]+=delta;updates[b]-=delta
        # All outcomes from this Puerto Rico date are revealed together.
        for g in batch:
            a,b=g['home_team_id'],g['away_team_id']
            history[a].append({'id':g['id'],'date':date,'for':g['home_score'],'against':g['away_score'],'won':g['home_score']>g['away_score']})
            history[b].append({'id':g['id'],'date':date,'for':g['away_score'],'against':g['home_score'],'won':g['away_score']>g['home_score']})
        for team,change in updates.items():rating[team]+=change
    return allrows
def summarize(rows,total):
    out=[]
    for policy in POLICIES:
        data=[r for r in rows if r['policy']==policy];scored=[r for r in data if r['selectedId'] is not None]
        wins=sum(r['result']=='WIN' for r in scored);n=len(scored)
        probs=[r for r in scored if r['probabilityHome'] is not None]
        projected=[r for r in data if r['projectedHome'] is not None]
        out.append({'policy':policy,'attempts':len(data),'bets':None,'forecastCount':n,'wins':wins,'losses':n-wins,'abstentions':len(data)-n,
          'coveragePct':100*n/total if total else None,'accuracyPct':100*wins/n if n else None,'wilson95Pct':wilson(wins,n),
          'homeBaselineSameGamesPct':100*sum(r['homeScore']>r['awayScore'] for r in scored)/n if n else None,
          'dates':len({r['date'] for r in scored}),'teams':len({x for r in scored for x in (r['homeId'],r['awayId'])}),
          'brier':sum((r['probabilityHome']-int(r['homeScore']>r['awayScore']))**2 for r in probs)/len(probs) if probs else None,
          'marginMAE':sum(abs((r['projectedHome']-r['projectedAway'])-(r['homeScore']-r['awayScore'])) for r in projected)/len(projected) if projected else None,
          'totalMAE':sum(abs((r['projectedHome']+r['projectedAway'])-(r['homeScore']+r['awayScore'])) for r in projected)/len(projected) if projected else None,
          'roi':None,'profit':None,'oddsCount':0})
    return out
def main():
    receipt=(ROOT/'protocol-receipt.txt').read_text().split()[0]
    if receipt!=digest(ROOT/'PROTOCOL.json'):raise ValueError('Protocol hash mismatch')
    raw=json.loads((ROOT/'inputs/sport-events.json').read_text());games,rejected=read_games(raw['rows'])
    rows=evaluate(games);summary=summarize(rows,len(games))
    results=ROOT/'results';results.mkdir(exist_ok=True)
    output={'classification':'EXPLORATORY_RETROSPECTIVE_REPLAY','inputSha256':digest(ROOT/'inputs/sport-events.json'),
            'protocolSha256':receipt,'games':len(games),'seasons':sorted({g['season'] for g in games}),
            'dateFrom':games[0]['date'] if games else None,'dateTo':games[-1]['date'] if games else None,
            'quarantined':rejected,'policies':summary,'independentHoldout':False,'sportsbookROI':'UNAVAILABLE_NO_VERIFIED_PRICES',
            'knownLimitations':['Small selected archive, not a complete season','Archive captured after events','No verified tipoff times; local calendar date cutoffs only','Regular/postseason phase not certified','No independent holdout or multiple-testing claim','No verified sportsbook prices']}
    for file,data in [('summary.json',output),('predictions.json',rows)]:
        (results/file).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    def pct(x):return '—' if x is None else f'{x:.2f}%'
    table='\n'.join(f"| {s['policy']} | {s['forecastCount']} | {s['wins']}–{s['losses']} | {pct(s['accuracyPct'])} | {pct(s['coveragePct'])} | {pct(s['homeBaselineSameGamesPct'])} |" for s in summary)
    text=f"""# BSN 2027 — piloto histórico exploratorio

Se evaluaron **{len(games)} partidos** de **{output['dateFrom']} a {output['dateTo']}**, con cuatro reglas fijas. No hay una fórmula validada ni ROI demostrable.

| Regla | Pronósticos | G–P | Accuracy | Cobertura | Local en esos mismos juegos |
|---|---:|---:|---:|---:|---:|
{table}

Los primeros partidos de cada equipo sirven de calentamiento. El modelo solo ve fechas anteriores en Puerto Rico; todos los resultados de un día se incorporan juntos. Empates de puntuación del modelo producen abstención. La regla local es un comparador, no una fórmula entrenada.

Esta muestra de 38 juegos es una selección histórica limitada, capturada después de los partidos y con fase regular/playoffs no certificada. Las horas del archivo no se presentan como inicios verificados. Ningún resultado entra al accuracy prospectivo de Pick. Las diferencias entre reglas son exploratorias y no seleccionan un campeón.

El intervalo Wilson en summary.json es descriptivo bajo un supuesto de observaciones independientes; no corrige dependencia por equipos/fechas, selección de la muestra ni comparaciones múltiples. La incertidumbre real puede ser mayor.

ROI, beneficio y número de apuestas quedan sin datos: no existen cuotas verificadas para estos contratos. El error de puntos/margen/total no equivale a acertar un mercado O/U o spread.

## Cómo reproducir

Desde el repositorio: `python research/bsn-preseason-2027-v1/evaluate.py`.
No consulta proveedores, no modifica Supabase y no emite picks.
El protocolo, receipt, export original y cada entrada de entrenamiento permanecen archivados.
Para ampliar: importar temporadas completas con licencia/permisos y fechas de juego claras; separar cronológicamente desarrollo y confirmación antes de comparar más reglas. Capturar cuotas prepartido por separado. Una franquicia trasladada en 2027 requiere una revisión de identidad, no una unión automática por nombre.
"""
    (ROOT/'REPORT.md').write_text(text)
    manifest={p.relative_to(ROOT).as_posix():digest(p) for p in [ROOT/'PROTOCOL.json',ROOT/'inputs/sport-events.json',results/'summary.json',results/'predictions.json',ROOT/'REPORT.md']}
    (ROOT/'verification.json').write_text(json.dumps({'status':'PASS','forecastRows':len(rows),'allFeatureDatesStrictlyPrior':all(r['latestFeatureDate'] is None or r['latestFeatureDate']<r['date'] for r in rows),
      'allInputEventsKnown':all(x in {g['id'] for g in games} for r in rows for x in r['inputsHome']+r['inputsAway']),'manifest':manifest},indent=2)+'\n')
    print(json.dumps({'games':len(games),'quarantined':len(rejected),'results':summary},indent=2))
if __name__=='__main__':main()
