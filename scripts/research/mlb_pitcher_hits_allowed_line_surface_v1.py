#!/usr/bin/env python3
import concurrent.futures, json, math, statistics, urllib.parse, urllib.request
from collections import defaultdict
from pathlib import Path

OUT=Path("/tmp/mlb_pitcher_hits_allowed_line_surface_v1.json")
SEASON=2025
EXPECTED_N=3099
EXPECTED_INTERCEPT=2.97876810879942
EXPECTED_SLOPE=0.415326852941172
CONTROL={"line":6.5,"threshold":5.0,"n":761,"wins":634}
LINES=[3.5,4.5,5.5,6.5,7.5,8.5,9.5]
THRESHOLDS=[round(2.0+i*0.25,2) for i in range(25)]  # 2.00..8.00 frozen before search

def emit(x):
 s=json.dumps(x,indent=2,sort_keys=True)
 print(s); OUT.write_text(s+"\n",encoding="utf-8")

def fail(error,**kw):
 emit({"status":"FAIL_CLOSED","error":error,**kw}); raise SystemExit(2)

def get_json(url,timeout=30):
 req=urllib.request.Request(url,headers={"User-Agent":"PickAnalyzerResearch/1.0"})
 with urllib.request.urlopen(req,timeout=timeout) as r:return json.load(r)

def wilson(w,n,z=1.959963984540054):
 if not n:return None
 p=w/n;d=1+z*z/n
 return (p+z*z/(2*n)-z*math.sqrt((p*(1-p)+z*z/(4*n))/n))/d

def player_directory():
 p=get_json("https://statsapi.mlb.com/api/v1/sports/1/players?season=2025&gameType=R").get("people") or []
 pitchers=[]
 for x in p:
  pos=x.get("primaryPosition") or {}
  if str(pos.get("abbreviation") or "").upper()=="P":
   pid=int(x.get("id") or 0);name=str(x.get("fullName") or "").strip()
   if pid and name:pitchers.append({"id":pid,"name":name})
 return p,pitchers

def log(player):
 pid=player["id"]
 qs=urllib.parse.urlencode({"stats":"gameLog","group":"pitching","season":"2025"})
 payload=get_json(f"https://statsapi.mlb.com/api/v1/people/{pid}/stats?{qs}")
 splits=[]
 for b in payload.get("stats") or []:splits.extend(b.get("splits") or [])
 rows=[]
 for s in splits:
  game=s.get("game") or {};st=s.get("stat") or {}
  pk=int(game.get("gamePk") or 0);date=str(s.get("date") or "")[:10]
  if not pk or not date:continue
  def n(k):
   try:return float(st.get(k)) if st.get(k) is not None else None
   except:return None
  gs=n("gamesStarted") or 0
  hits=n("hits");bf=n("battersFaced")
  if gs<=0 or hits is None or bf is None or bf<=0:continue
  rows.append({"pitcher_id":pid,"pitcher_name":player["name"],"gamePk":pk,"date":date,"hits":hits,"bf":bf})
 rows.sort(key=lambda r:(r["date"],r["gamePk"]))
 return rows

def fetch(players):
 out=[];failures=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
  fm={ex.submit(log,p):p for p in players}
  for f in concurrent.futures.as_completed(fm):
   p=fm[f]
   try:out.extend(f.result())
   except Exception as e:failures.append({"id":p["id"],"name":p["name"],"error":str(e)[:200]})
 if failures:fail("MLB_OFFICIAL_PITCHER_GAMELOG_FETCH_FAIL",count=len(failures),failures=failures[:20])
 return out

def build(raw):
 by=defaultdict(list)
 for r in raw:by[r["pitcher_id"]].append(r)
 modeled=[]
 for pid,starts in by.items():
  starts.sort(key=lambda r:(r["date"],r["gamePk"]))
  for target in starts:
   history=[r for r in starts if r["date"]<target["date"]]
   if len(history)<5:continue
   recent=history[-5:]
   cum_hits=sum(r["hits"] for r in history);cum_bf=sum(r["bf"] for r in history)
   recent_bf=sum(r["bf"] for r in recent)
   if cum_bf<=0 or recent_bf<=0:continue
   avg_bf=recent_bf/len(recent)
   raw_feature=avg_bf*(cum_hits/cum_bf)
   modeled.append({**target,"month":target["date"][:7],"raw":raw_feature,"prior_starts":len(history)})
 modeled.sort(key=lambda r:(r["date"],r["gamePk"],r["pitcher_id"]))
 return modeled

def ols(rows):
 xs=[r["raw"] for r in rows];ys=[r["hits"] for r in rows]
 xm=sum(xs)/len(xs);ym=sum(ys)/len(ys)
 den=sum((x-xm)**2 for x in xs)
 if den<=0:fail("OLS_ZERO_VARIANCE")
 slope=sum((x-xm)*(y-ym) for x,y in zip(xs,ys))/den
 intercept=ym-slope*xm
 return intercept,slope

def enrich(rows,intercept,slope):
 return [{**r,"projection":intercept+slope*r["raw"]} for r in rows]

def summary(rows,direction,line,threshold):
 if direction=="UNDER":sel=[r for r in rows if r["projection"]<=threshold+1e-12]
 else:sel=[r for r in rows if r["projection"]>=threshold-1e-12]
 def win(r):return r["hits"]<line if direction=="UNDER" else r["hits"]>line
 wins=sum(1 for r in sel if win(r));by=defaultdict(list)
 for r in sel:by[r["month"]].append(r)
 monthly={}
 for m,v in sorted(by.items()):
  w=sum(1 for r in v if win(r));monthly[m]={"n":len(v),"wins":w,"accuracy":w/len(v)}
 return {"n":len(sel),"wins":wins,"accuracy":wins/len(sel) if sel else None,"months":len(monthly),"worst_month":min((x["accuracy"] for x in monthly.values()),default=None),"wilson_lower":wilson(wins,len(sel)),"monthly":monthly}

def baseline(rows,direction,line):
 wins=sum(1 for r in rows if (r["hits"]<line if direction=="UNDER" else r["hits"]>line))
 return {"n":len(rows),"wins":wins,"accuracy":wins/len(rows)}

def search(rows):
 out=[]
 for line in LINES:
  for direction in ("UNDER","OVER"):
   b=baseline(rows,direction,line);passers=[]
   for t in THRESHOLDS:
    s=summary(rows,direction,line,t)
    if not s["n"]:continue
    s["threshold"]=t;s["baseline"]=b["accuracy"];s["lift_pp"]=100*(s["accuracy"]-b["accuracy"])
    s["passes"]=(s["accuracy"]>=.75 and s["n"]>=60 and s["months"]>=5 and s["worst_month"] is not None and s["worst_month"]>=.65 and s["lift_pp"]>=5)
    if s["passes"]:passers.append(s)
   passers.sort(key=lambda x:(-x["n"],-x["accuracy"],-(x["wilson_lower"] or 0),x["threshold"]))
   out.append({"line":line,"direction":direction,"baseline":b,"passing_threshold_count":len(passers),"best_max_n_passing":passers[0] if passers else None,"state":"DEVELOPMENT_GATE_PASS_THRESHOLD_FROZEN" if passers else "NO_75_PLUS_STABLE_SIGNAL_CANDIDATE"})
 return out

def main():
 all_people,pitchers=player_directory();raw=fetch(pitchers);modeled=build(raw)
 intercept,slope=ols(modeled)
 if len(modeled)!=EXPECTED_N or abs(intercept-EXPECTED_INTERCEPT)>1e-12 or abs(slope-EXPECTED_SLOPE)>1e-12:
  fail("EXACT_2025_REFIT_PARITY_FAIL",expected={"n":EXPECTED_N,"intercept":EXPECTED_INTERCEPT,"slope":EXPECTED_SLOPE},observed={"n":len(modeled),"intercept":intercept,"slope":slope},directory_rows=len(all_people),pitcher_ids=len(pitchers),raw_start_rows=len(raw))
 rows=enrich(modeled,intercept,slope)
 ctrl=summary(rows,"UNDER",CONTROL["line"],CONTROL["threshold"])
 if ctrl["n"]!=CONTROL["n"] or ctrl["wins"]!=CONTROL["wins"]:
  fail("CONTROL_U6P5_PARITY_FAIL",expected=CONTROL,observed=ctrl)
 emit({"contract":"MLB_PITCHER_HITS_ALLOWED_LINE_SURFACE_V1/1.0.0","research_only":True,"source":{"provider":"MLB Official StatsAPI gameLog pitching","season":2025,"directory_rows":len(all_people),"pitcher_ids":len(pitchers),"raw_start_rows":len(raw)},"exact_replay":{"n":len(modeled),"intercept":intercept,"slope":slope,"raw_feature":"avg(BF last 5 strict-prior starts) * cumulative prior hits / cumulative prior BF","minimum_prior_starts":5,"strict_prior_date":True,"same_date_history_allowed":False,"control_u6p5_proj_le_5p0":ctrl,"status":"EXACT_REPLAY_PASS"},"development_gate":{"accuracy_min":.75,"n_min":60,"months_min":5,"worst_month_min":.65,"lift_pp_min":5,"priority":"maximum n among passing thresholds"},"threshold_grid":{"min":THRESHOLDS[0],"max":THRESHOLDS[-1],"step":.25,"frozen_before_search":True},"surface_results_2025_development_only":search(rows),"external_2026_opened":False,"boundaries":{"official_picks_writes":0,"apostar_activation":False,"production_promotion":False,"odds_api_historical_credits_consumed":0,"tracker_modified":False},"status":"DEVELOPMENT_COMPLETE_EXTERNAL_GATE_CLOSED"})

if __name__=="__main__":main()
