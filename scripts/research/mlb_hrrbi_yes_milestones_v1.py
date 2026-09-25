#!/usr/bin/env python3
import csv, hashlib, io, json, math, os, urllib.request, zipfile
from collections import defaultdict

SOURCE_URL="https://www.retrosheet.org/downloads/2025/2025csvs.zip"
EXPECTED_SHA256="3d1e0e81d5913a635ae7a80366b811b777b832b488274124b4e38e04dd892753"
EXPECTED_ALL_ROWS=73092
EXPECTED_REGULAR_ROWS=71550
EXPECTED_GAMES=2430
THRESHOLDS=[round(i*.05,2) for i in range(0,101)]
LINES=[2.5,3.5]
OUT=os.environ.get("HRRBI_YES_RESULT_PATH","/tmp/mlb_hrrbi_yes_milestones_v1.json")

def emit(x):
    s=json.dumps(x,indent=2,sort_keys=True)
    print(s)
    with open(OUT,"w",encoding="utf-8") as f:f.write(s+"\n")

def fail(error,**kw):
    emit({"status":"FAIL_CLOSED","error":error,**kw})
    raise SystemExit(2)

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

def read_rows(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names=[n for n in z.namelist() if n.endswith("2025batting.csv")]
        if len(names)!=1:fail("BATTING_MEMBER_NOT_UNIQUE",matches=names)
        raw=z.read(names[0]).decode("utf-8-sig")
    allr=list(csv.DictReader(io.StringIO(raw)))
    if len(allr)!=EXPECTED_ALL_ROWS:fail("ALL_ROW_COUNT",expected=EXPECTED_ALL_ROWS,observed=len(allr))
    out=[]
    for r in allr:
        if (r.get("stattype") or "").strip()!="value" or (r.get("gametype") or "").strip()!="regular":
            continue
        out.append({
            "gid":(r.get("gid") or "").strip(),
            "id":(r.get("id") or "").strip(),
            "date":(r.get("date") or "").strip(),
            "number":to_i(r.get("number")),
            "pa":to_i(r.get("b_pa")),
            "h":to_i(r.get("b_h")),
            "r":to_i(r.get("b_r")),
            "rbi":to_i(r.get("b_rbi")),
        })
    if len(out)!=EXPECTED_REGULAR_ROWS:
        fail("REGULAR_ROW_COUNT",expected=EXPECTED_REGULAR_ROWS,observed=len(out))
    if len({r["gid"] for r in out})!=EXPECTED_GAMES:
        fail("GAME_COUNT",expected=EXPECTED_GAMES,observed=len({r["gid"] for r in out}))
    return out

def comp(hist,key):
    pa=sum(x["pa"] for x in hist)
    if pa<=0:return None
    recent=hist[-10:]
    recent_pa_per_game=sum(x["pa"] for x in recent)/len(recent)
    prior_rate=sum(x[key] for x in hist)/pa
    recent_per_game=sum(x[key] for x in recent)/len(recent)
    return .5*(prior_rate*recent_pa_per_game)+.5*recent_per_game

def month(d):return d[:4]+"-"+d[4:6]

def build(rs):
    by=defaultdict(list)
    for r in rs:by[r["id"]].append(r)
    universe=[];projected=[]
    same_date_target_rows=0
    for pid,games in by.items():
        by_date=defaultdict(list)
        for g in games:by_date[g["date"]].append(g)
        hist=[]
        for date in sorted(by_date):
            day_games=sorted(by_date[date],key=lambda x:(x["number"],x["gid"]))
            # Every target on this date uses only dates strictly before it.
            for g in day_games:
                if len(hist)>=10:
                    hrrbi=g["h"]+g["r"]+g["rbi"]
                    base={"id":pid,**g,"month":month(g["date"]),"hrrbi":hrrbi}
                    universe.append(base)
                    ph,pr,pi=comp(hist,"h"),comp(hist,"r"),comp(hist,"rbi")
                    if ph is not None and pr is not None and pi is not None:
                        projected.append({**base,"hrrbi_proj":ph+pr+pi,"prior_games":len(hist),"latest_prior_date":hist[-1]["date"] if hist else None})
                        if hist and hist[-1]["date"]>=g["date"]: same_date_target_rows+=1
            hist.extend(day_games)
            hist.sort(key=lambda x:(x["date"],x["number"],x["gid"]))
    if same_date_target_rows:
        fail("SAME_DATE_LEAKAGE_DETECTED",rows=same_date_target_rows)
    return universe,projected

def summary(selected,line):
    def win(r):return r["hrrbi"]>line
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
        "monthly":monthly,
    }

def search(universe,projected):
    results=[]
    for line in LINES:
        base=summary(universe,line)
        passing=[]
        for t in THRESHOLDS:
            sel=[r for r in projected if r["hrrbi_proj"]>=t]
            s=summary(sel,line)
            if not s["n"]:continue
            s["threshold"]=t
            s["baseline"]=base["accuracy"]
            s["lift_pp"]=100*(s["accuracy"]-base["accuracy"])
            s["passes"]=(
                s["accuracy"]>=.75 and s["n"]>=60 and s["months"]>=5 and
                s["worst_month"] is not None and s["worst_month"]>=.65 and s["lift_pp"]>=5
            )
            if s["passes"]:passing.append(s)
        passing.sort(key=lambda x:(-x["n"],-x["lift_pp"],-x["accuracy"],x["threshold"]))
        results.append({
            "market":"batter_hits_runs_rbis",
            "line":line,
            "side":"YES",
            "baseline":base,
            "passing_threshold_count":len(passing),
            "best_max_n_passing":passing[0] if passing else None,
            "state":"DEVELOPMENT_GATE_PASS_THRESHOLD_FROZEN" if passing else "NO_75_PLUS_STABLE_SIGNAL_CANDIDATE",
        })
    return results

def main():
    data,sha=archive()
    rs=read_rows(data)
    universe,projected=build(rs)
    result={
        "contract":"MLB_BATTER_HRRBI_YES_MILESTONES_V1/1.0.0",
        "research_only":True,
        "market":"batter_hits_runs_rbis",
        "sides":["YES"],
        "lines":LINES,
        "source":{"url":SOURCE_URL,"sha256":sha,"regular_batting_rows":EXPECTED_REGULAR_ROWS,"regular_games":EXPECTED_GAMES},
        "lineage":{
            "history_rule":"source_game_date < target_game_date",
            "same_date_history_allowed":False,
            "minimum_prior_games":10,
            "recent_window":10,
            "component_projection":"0.50*(prior_event_per_PA*L10_PA_per_game)+0.50*L10_event_per_game",
            "hrrbi_projection":"proj_hits+proj_runs+proj_rbi",
            "eligible_rows":len(universe),
            "projected_rows":len(projected),
        },
        "development_gate":{"accuracy_min":.75,"n_min":60,"months_min":5,"worst_month_min":.65,"lift_pp_min":5,"priority":"maximum n among passing thresholds"},
        "threshold_grid":{"min":0.0,"max":5.0,"step":.05,"frozen_before_search":True},
        "surface_results_2025_development_only":search(universe,projected),
        "external_2026_opened":False,
        "boundaries":{"official_picks_writes":0,"apostar_activation":False,"production_promotion":False,"odds_api_historical_credits_consumed":0,"provider_odds_calls":0,"tracker_modified":False,"yes_side_not_aliased_to_over":True},
        "status":"DEVELOPMENT_COMPLETE_EXTERNAL_GATE_CLOSED",
    }
    emit(result)

if __name__=="__main__":main()
