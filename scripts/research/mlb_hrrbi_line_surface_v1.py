#!/usr/bin/env python3
import csv, hashlib, io, json, os, urllib.request, zipfile
from collections import defaultdict
from itertools import product

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

def get_archive():
 req=urllib.request.Request(SOURCE_URL,headers={"User-Agent":"PickAnalyzerResearch/1.0"})
 with urllib.request.urlopen(req,timeout=120) as r:data=r.read()
 sha=hashlib.sha256(data).hexdigest()
 if sha!=EXPECTED_SHA256:fail("SHA_MISMATCH",expected=EXPECTED_SHA256,observed=sha)
 return data,sha

def read_rows(data):
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  names=[n for n in z.namelist() if n.endswith("2025batting.csv")]
  if len(names)!=1:fail("BATTING_MEMBER_NOT_UNIQUE",matches=names)
  raw=z.read(names[0]).decode("utf-8-sig")
 allr=list(csv.DictReader(io.StringIO(raw)))
 if len(allr)!=EXPECTED_ALL_ROWS:fail("ALL_ROW_COUNT",expected=EXPECTED_ALL_ROWS,observed=len(allr))
 rows=[]
 for r in allr:
  if (r.get("stattype") or "").strip()!="value" or (r.get("gametype") or "").strip()!="regular":continue
  exact=to_i(r.get("b_pa"))
  proxy=to_i(r.get("b_ab"))+to_i(r.get("b_w"))+to_i(r.get("b_hbp"))+to_i(r.get("b_sf"))+to_i(r.get("b_sh"))
  rows.append({
   "gid":(r.get("gid") or "").strip(),"id":(r.get("id") or "").strip(),
   "date":(r.get("date") or "").strip(),"number":to_i(r.get("number")),
   "pa_exact":exact,"pa_proxy":proxy,"xi":to_i(r.get("b_xi")),
   "h":to_i(r.get("b_h")),"r":to_i(r.get("b_r")),"rbi":to_i(r.get("b_rbi"))
  })
 if len(rows)!=EXPECTED_REGULAR_ROWS:fail("REGULAR_ROW_COUNT",expected=EXPECTED_REGULAR_ROWS,observed=len(rows))
 if len({r["gid"] for r in rows})!=EXPECTED_GAMES:fail("GAME_COUNT")
 return rows

def comp(hist,key,pa_mode):
 pa_key="pa_exact" if pa_mode=="exact" else "pa_proxy"
 pa=sum(x[pa_key] for x in hist)
 if pa<=0:return None
 l10=hist[-10:]
 return .5*((sum(x[key] for x in hist)/pa)*(sum(x[pa_key] for x in l10)/10))+ .5*(sum(x[key] for x in l10)/10)

def month(date):return date[:4]+"-"+date[4:6]

def summarize(sel,outcome_key,line=0.5):
 wins=sum(1 for r in sel if r[outcome_key]<line)
 by=defaultdict(list)
 for r in sel:by[r["month"]].append(r)
 monthly={}
 for m,v in sorted(by.items()):
  w=sum(1 for r in v if r[outcome_key]<line)
  monthly[m]=(len(v),w)
 return len(sel),wins,monthly

def main():
 data,sha=get_archive();rows=read_rows(data)
 players=defaultdict(list)
 for r in rows:players[r["id"]].append(r)
 universe=[]
 for pid,games in players.items():
  games.sort(key=lambda x:(x["date"],x["number"],x["gid"]))
  hist=[]
  for g in games:
   if len(hist)>=10:
    universe.append({"id":pid,**g,"month":month(g["date"]),"history_seq":list(hist),"history_date":[x for x in hist if x["date"]<g["date"]]})
   hist.append(g)
 if len(universe)!=EXPECTED_ELIGIBLE:fail("ELIGIBLE_COUNT",expected=EXPECTED_ELIGIBLE,observed=len(universe))
 baseline_rbi=sum(1 for r in universe if r["rbi"]<.5)
 baseline_hrrbi=sum(1 for r in universe if r["h"]+r["r"]+r["rbi"]<2.5)
 variants=[]
 exact=[]
 for hist_mode in ("seq","date"):
  for h_pa,r_pa,rbi_pa in product(("exact","proxy"),repeat=3):
   projected=[]
   for row in universe:
    hist=row["history_seq"] if hist_mode=="seq" else row["history_date"]
    if len(hist)<10:continue
    ph=comp(hist,"h",h_pa);pr=comp(hist,"r",r_pa);pi=comp(hist,"rbi",rbi_pa)
    if ph is None or pr is None or pi is None:continue
    projected.append({**row,"rbi_proj":pi,"hrrbi_proj":ph+pr+pi,"hrrbi":row["h"]+row["r"]+row["rbi"]})
   rbi_sel=[r for r in projected if r["rbi_proj"]<=.10]
   h_sel=[r for r in projected if r["hrrbi_proj"]<=.70]
   rn,rw,rm=summarize(rbi_sel,"rbi",.5)
   hn,hw,hm=summarize(h_sel,"hrrbi",2.5)
   rec={
    "history":hist_mode,"h_pa":h_pa,"r_pa":r_pa,"rbi_pa":rbi_pa,
    "projected_n":len(projected),
    "rbi":{"n":rn,"wins":rw,"monthly":rm,"exact":(rn,rw)==EXPECTED_RBI and rm==EXPECTED_RBI_MONTHLY},
    "hrrbi":{"n":hn,"wins":hw,"monthly":hm,"exact":(hn,hw)==EXPECTED_HRRBI and hm==EXPECTED_HRRBI_MONTHLY}
   }
   rec["full_exact"]=rec["rbi"]["exact"] and rec["hrrbi"]["exact"]
   variants.append(rec)
   if rec["full_exact"]:exact.append(rec)
 ranked=sorted(variants,key=lambda x:(
   abs(x["hrrbi"]["n"]-EXPECTED_HRRBI[0])+abs(x["hrrbi"]["wins"]-EXPECTED_HRRBI[1]),
   abs(x["rbi"]["n"]-EXPECTED_RBI[0])+abs(x["rbi"]["wins"]-EXPECTED_RBI[1])
 ))
 result={
  "contract":"MLB_BATTER_HRRBI_LINEAGE_DIAGNOSTIC_V1",
  "research_only":True,"sha256":sha,"eligible_rows":len(universe),
  "baseline":{"rbi_u0p5":baseline_rbi,"hrrbi_u2p5":baseline_hrrbi},
  "tested_variants":len(variants),"exact_matches":exact,"top5":ranked[:5],
  "status":"EXACT_LINEAGE_RECOVERED" if len(exact)==1 else ("AMBIGUOUS_EXACT_LINEAGE" if len(exact)>1 else "NO_EXACT_LINEAGE_MATCH"),
  "external_2026_opened":False,
  "threshold_search_performed":False,
  "boundaries":{"official_picks_writes":0,"apostar_activation":False,"production_promotion":False,"odds_api_historical_credits_consumed":0}
 }
 emit(result)
 if len(exact)!=1:raise SystemExit(2)

if __name__=="__main__":main()
