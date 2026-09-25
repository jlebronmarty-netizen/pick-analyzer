#!/usr/bin/env python3
import csv, hashlib, io, json, math, os, urllib.request, zipfile
from collections import defaultdict

SOURCE_URL="https://www.retrosheet.org/downloads/2025/2025csvs.zip"
EXPECTED_SHA256="3d1e0e81d5913a635ae7a80366b811b777b832b488274124b4e38e04dd892753"
EXPECTED_ALL_ROWS=73092
EXPECTED_REGULAR_ROWS=71550
EXPECTED_GAMES=2430
EXPECTED_ELIGIBLE=58410
EXPECTED_RBI=(2402,2053)
EXPECTED_HRRBI=(2582,2278)
EXPECTED_RBI_MONTHLY={
 "2025-04":(489,405),"2025-05":(472,401),"2025-06":(401,344),
 "2025-07":(406,362),"2025-08":(310,255),"2025-09":(324,286)
}
EXPECTED_HRRBI_MONTHLY={
 "2025-04":(303,272),"2025-05":(442,384),"2025-06":(471,425),
 "2025-07":(489,437),"2025-08":(393,335),"2025-09":(484,425)
}
THRESHOLDS=[round(i*.05,2) for i in range(0,101)]  # frozen 0.00..5.00
TARGETS=(("UNDER",.5),("OVER",.5),("UNDER",1.5),("OVER",1.5))
OUT=os.environ.get("HRRBI_RESULT_PATH","/tmp/mlb_hrrbi_line_surface_v1_result.json")

def emit(x):
 s=json.dumps(x,indent=2,sort_keys=True)
 print(s)
 with open(OUT,"w",encoding="utf-8") as f:f.write(s+"\n")

def fail(error,**kw):
 emit({"status":"FAIL_CLOSED","error":error,**kw});raise SystemExit(2)

def to_i(v):
 s=(v or "").strip()
 if not s:return 0
 try:return int(s)
 except:return int(float(s))

def wilson(w,n,z=1.959963984540054):
 if not n:return None
 p=w/n;d=1+z*z/n
 return (p+z*z/(2*n)-z*math.sqrt((p*(1-p)+z*z/(4*n))/n))/d

def archive():
 req=urllib.request.Request(SOURCE_URL,headers={"User-Agent":"PickAnalyzerResearch/1.0"})
 with urllib.request.urlopen(req,timeout=120) as r:data=r.read()
 sha=hashlib.sha256(data).hexdigest()
 if sha!=EXPECTED_SHA256:fail("SHA_MISMATCH",expected=EXPECTED_SHA256,observed=sha)
 return data,sha

def rows(data):
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  names=[n for n in z.namelist() if n.endswith("2025batting.csv")]
  if len(names)!=1:fail("BATTING_MEMBER_NOT_UNIQUE",matches=names)
  raw=z.read(names[0]).decode("utf-8-sig")
 allr=list(csv.DictReader(io.StringIO(raw)))
 if len(allr)!=EXPECTED_ALL_ROWS:fail("ALL_ROW_COUNT",expected=EXPECTED_ALL_ROWS,observed=len(allr))
 out=[]
 for r in allr:
  if (r.get("stattype") or "").strip()!="value" or (r.get("gametype") or "").strip()!="regular":continue
  out.append({
   "gid":(r.get("gid") or "").strip(),"id":(r.get("id") or "").strip(),
   "date":(r.get("date") or "").strip(),"number":to_i(r.get("number")),
   "pa":to_i(r.get("b_pa")),"h":to_i(r.get("b_h")),
   "r":to_i(r.get("b_r")),"rbi":to_i(r.get("b_rbi"))
  })
 if len(out)!=EXPECTED_REGULAR_ROWS:fail("REGULAR_ROW_COUNT",expected=EXPECTED_REGULAR_ROWS,observed=len(out))
 if len({r["gid"] for r in out})!=EXPECTED_GAMES:fail("GAME_COUNT")
 return out

def comp(hist,key):
 pa=sum(x["pa"] for x in hist)
 if pa<=0:return None
 l10=hist[-10:]
 return .5*((sum(x[key] for x in hist)/pa)*(sum(x["pa"] for x in l10)/10)) + .5*(sum(x[key] for x in l10)/10)

def month(d):return d[:4]+"-"+d[4:6]

def build(rs):
 by=defaultdict(list)
 for r in rs:by[r["id"]].append(r)
 universe=[];projected=[]
 for pid,games in by.items():
  games.sort(key=lambda x:(x["date"],x["number"],x["gid"]))
  hist=[]
  for g in games:
   if len(hist)>=10:
    hrrbi=g["h"]+g["r"]+g["rbi"]
    base={"id":pid,**g,"month":month(g["date"]),"hrrbi":hrrbi}
    universe.append(base)
    ph,pr,pi=comp(hist,"h"),comp(hist,"r"),comp(hist,"rbi")
    if ph is not None and pr is not None and pi is not None:
     projected.append({**base,"rbi_proj":pi,"hrrbi_proj":ph+pr+pi})
   hist.append(g)
 if len(universe)!=EXPECTED_ELIGIBLE:fail("ELIGIBLE_COUNT",expected=EXPECTED_ELIGIBLE,observed=len(universe))
 return universe,projected

def summary(selected,outcome_key,direction,line):
 def win(r):
  v=r[outcome_key]
  return v<line if direction=="UNDER" else v>line
 w=sum(1 for r in selected if win(r))
 by=defaultdict(list)
 for r in selected:by[r["month"]].append(r)
 monthly={}
 for m,v in sorted(by.items()):
  mw=sum(1 for r in v if win(r))
  monthly[m]={"n":len(v),"wins":mw,"accuracy":mw/len(v)}
 return {
  "n":len(selected),"wins":w,"accuracy":w/len(selected) if selected else None,
  "months":len(monthly),
  "worst_month":min((x["accuracy"] for x in monthly.values()),default=None),
  "wilson_lower":wilson(w,len(selected)),
  "monthly":monthly
 }

def baseline(universe,outcome_key,direction,line):
 return summary(universe,outcome_key,direction,line)

def prove(universe,projected):
 rbi=[r for r in projected if r["rbi_proj"]<=.10]
 hr=[r for r in projected if r["hrrbi_proj"]<=.70]
 rs=summary(rbi,"rbi","UNDER",.5);hs=summary(hr,"hrrbi","UNDER",2.5)
 rm={m:(v["n"],v["wins"]) for m,v in rs["monthly"].items()}
 hm={m:(v["n"],v["wins"]) for m,v in hs["monthly"].items()}
 if (rs["n"],rs["wins"])!=EXPECTED_RBI or rm!=EXPECTED_RBI_MONTHLY:
  fail("RBI_CONTROL_PARITY_FAIL",observed=rs)
 if (hs["n"],hs["wins"])!=EXPECTED_HRRBI or hm!=EXPECTED_HRRBI_MONTHLY:
  fail("HRRBI_CONTROL_PARITY_FAIL",observed=hs)
 return {"rbi_u0p5_proj_le_0p10":rs,"hrrbi_u2p5_proj_le_0p70":hs}

def search(universe,projected):
 results=[]
 for direction,line in TARGETS:
  b=baseline(universe,"hrrbi",direction,line)
  passing=[]
  for t in THRESHOLDS:
   if direction=="UNDER":
    sel=[r for r in projected if r["hrrbi_proj"]<=t]
   else:
    sel=[r for r in projected if r["hrrbi_proj"]>=t]
   s=summary(sel,"hrrbi",direction,line)
   if not s["n"]:continue
   s["threshold"]=t;s["baseline"]=b["accuracy"];s["lift_pp"]=100*(s["accuracy"]-b["accuracy"])
   s["passes"]=(
    s["accuracy"]>=.75 and s["n"]>=60 and s["months"]>=5 and
    s["worst_month"] is not None and s["worst_month"]>=.65 and s["lift_pp"]>=5
   )
   if s["passes"]:passing.append(s)
  passing.sort(key=lambda x:(-x["n"],-x["accuracy"],-(x["wilson_lower"] or 0),x["threshold"]))
  results.append({
   "direction":direction,"line":line,"baseline":b,
   "passing_threshold_count":len(passing),
   "best_max_n_passing":passing[0] if passing else None,
   "state":"DEVELOPMENT_GATE_PASS_THRESHOLD_FROZEN" if passing else "NO_75_PLUS_STABLE_SIGNAL_CANDIDATE"
  })
 return results

def main():
 data,sha=archive();universe,projected=build(rows(data));controls=prove(universe,projected)
 result={
  "contract":"MLB_BATTER_HRRBI_LINE_SURFACE_V1/1.0.0","research_only":True,
  "source":{"url":SOURCE_URL,"sha256":sha,"regular_batting_rows":EXPECTED_REGULAR_ROWS,"regular_games":EXPECTED_GAMES},
  "exact_lineage":{"history":"sequential strictly prior player games","plate_appearances":"Retrosheet b_pa exact","min_prior_games":10,"recent_window":10,
   "component_projection":"0.50*(prior_event_per_PA*L10_PA_per_game)+0.50*L10_event_per_game",
   "hrrbi_projection":"proj_hits+proj_runs+proj_rbi","eligible_rows":len(universe),"projected_rows":len(projected)},
  "control_parity":controls,
  "development_gate":{"accuracy_min":.75,"n_min":60,"months_min":5,"worst_month_min":.65,"lift_pp_min":5,
   "wilson_lower_reported":True,"priority":"maximum n among passing candidates"},
  "threshold_grid":{"min":0.0,"max":5.0,"step":.05,"frozen_before_search":True},
  "surface_results_2025_development_only":search(universe,projected),
  "external_2026_opened":False,
  "boundaries":{"official_picks_writes":0,"apostar_activation":False,"production_promotion":False,
   "odds_api_historical_credits_consumed":0,"provider_odds_calls":0,"tracker_modified":False},
  "status":"DEVELOPMENT_COMPLETE_EXTERNAL_GATE_CLOSED"
 }
 emit(result)

if __name__=="__main__":main()
