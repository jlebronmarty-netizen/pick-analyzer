#!/usr/bin/env python3
import csv, hashlib, io, json, urllib.request, zipfile
from collections import defaultdict

URL="https://www.retrosheet.org/downloads/2025/2025csvs.zip"
SHA="3d1e0e81d5913a635ae7a80366b811b777b832b488274124b4e38e04dd892753"
EXPECTED={
 "rbi": {"n":2402,"wins":2053,"monthly":{"2025-04":(489,405),"2025-05":(472,401),"2025-06":(401,344),"2025-07":(406,362),"2025-08":(310,255),"2025-09":(324,286)}},
 "hrrbi":{"n":2582,"wins":2278,"monthly":{"2025-04":(303,272),"2025-05":(442,384),"2025-06":(471,425),"2025-07":(489,437),"2025-08":(393,335),"2025-09":(484,425)}}
}

def I(v):
 s=(v or "").strip()
 return int(float(s)) if s else 0

def fetch():
 req=urllib.request.Request(URL,headers={"User-Agent":"PickAnalyzerResearch/1.0"})
 with urllib.request.urlopen(req,timeout=120) as r: b=r.read()
 assert hashlib.sha256(b).hexdigest()==SHA
 return b

def load():
 with zipfile.ZipFile(io.BytesIO(fetch())) as z:
  name=[n for n in z.namelist() if n.endswith("2025batting.csv")][0]
  rows=list(csv.DictReader(io.StringIO(z.read(name).decode("utf-8-sig"))))
 out=[]
 for r in rows:
  if (r.get("stattype") or "").strip()!="value" or (r.get("gametype") or "").strip()!="regular": continue
  out.append({"gid":(r.get("gid") or "").strip(),"id":(r.get("id") or "").strip(),"date":(r.get("date") or "").strip(),
              "number":I(r.get("number")),"pa":I(r.get("b_pa")),"h":I(r.get("b_h")),"r":I(r.get("b_r")),"rbi":I(r.get("b_rbi"))})
 assert len(out)==71550
 return out

def month(d): return f"{d[:4]}-{d[4:6]}"

def component(hist,key,recent_positive=False,rate_positive=False):
 rate_hist=[x for x in hist if x["pa"]>0] if rate_positive else hist
 recent_hist=[x for x in hist if x["pa"]>0] if recent_positive else hist
 if not rate_hist or sum(x["pa"] for x in rate_hist)<=0 or len(recent_hist)<10: return None
 l10=recent_hist[-10:]
 prior_pa=sum(x["pa"] for x in rate_hist)
 return 0.5*((sum(x[key] for x in rate_hist)/prior_pa)*(sum(x["pa"] for x in l10)/10))+0.5*(sum(x[key] for x in l10)/10)

def evaluate(rows, same_date, recent_positive, rate_positive, sort_mode):
 by=defaultdict(list)
 for x in rows: by[x["id"]].append(x)
 projected=[]
 eligible=0
 for pid,games in by.items():
  if sort_mode=="number_gid": games.sort(key=lambda x:(x["date"],x["number"],x["gid"]))
  elif sort_mode=="gid": games.sort(key=lambda x:(x["date"],x["gid"],x["number"]))
  else: games.sort(key=lambda x:(x["date"],x["number"]))
  hist=[]
  for g in games:
   if len(hist)>=10:
    eligible+=1
    hhist=hist if same_date else [x for x in hist if x["date"]<g["date"]]
    ph=component(hhist,"h",recent_positive,rate_positive)
    pr=component(hhist,"r",recent_positive,rate_positive)
    pi=component(hhist,"rbi",recent_positive,rate_positive)
    projected.append((g,pi,None if ph is None or pr is None or pi is None else ph+pr+pi))
   hist.append(g)
 assert eligible==58410
 def score(kind,thr,line):
  key=1 if kind=="rbi" else 2
  sel=[x for x in projected if x[key] is not None and x[key] <= thr+1e-12]
  wins=sum((x[0]["rbi"] if kind=="rbi" else x[0]["h"]+x[0]["r"]+x[0]["rbi"])<line for x in sel)
  m=defaultdict(lambda:[0,0])
  for x in sel:
   mm=month(x[0]["date"]); m[mm][0]+=1
   if (x[0]["rbi"] if kind=="rbi" else x[0]["h"]+x[0]["r"]+x[0]["rbi"])<line:m[mm][1]+=1
  return {"n":len(sel),"wins":wins,"monthly":dict(m)}
 rbi=score("rbi",0.10,0.5); h=score("hrrbi",0.70,2.5)
 distance=abs(rbi["n"]-2402)+abs(rbi["wins"]-2053)+abs(h["n"]-2582)+abs(h["wins"]-2278)
 for mm,v in EXPECTED["rbi"]["monthly"].items():
  o=rbi["monthly"].get(mm,[0,0]); distance+=abs(o[0]-v[0])+abs(o[1]-v[1])
 for mm,v in EXPECTED["hrrbi"]["monthly"].items():
  o=h["monthly"].get(mm,[0,0]); distance+=abs(o[0]-v[0])+abs(o[1]-v[1])
 return {"same_date_prior":same_date,"recent_positive_pa_only":recent_positive,"rate_positive_pa_only":rate_positive,"sort_mode":sort_mode,
         "rbi":rbi,"hrrbi":h,"distance":distance}

rows=load()
results=[]
for same in (True,False):
 for recent in (False,True):
  for rate in (False,True):
   for sort in ("number_gid","gid","number"):
    results.append(evaluate(rows,same,recent,rate,sort))
results.sort(key=lambda x:x["distance"])
print(json.dumps({"status":"LINEAGE_DIAGNOSTIC_ONLY","best":results[:12],"all_count":len(results)},indent=2,sort_keys=True))
