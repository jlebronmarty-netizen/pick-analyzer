#!/usr/bin/env python3
from __future__ import annotations

import json, os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
from catboost import CatBoostClassifier

SEED=20260921
EDGE_URL="https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-period-team-threshold-github-export-temp"
CONTRACT="MLB_PERIOD_TEAM_THRESHOLD_GITHUB_EXPORT_V1/1.0.0"
OUT=Path("artifacts/research/mlb_period_team_threshold_classifier_v1.json")
MAX_DATE=pd.Timestamp("2026-09-18")
GATES=[0.75,0.80,0.85,0.90]
SPECS=[
 {"id":"depth4","depth":4,"iterations":400,"learning_rate":0.035,"l2_leaf_reg":7.0,"random_strength":1.0},
 {"id":"depth6","depth":6,"iterations":400,"learning_rate":0.035,"l2_leaf_reg":7.0,"random_strength":1.0},
]
FOLDS=[
 ("2025-05","2025-05-01","2025-06-01"),
 ("2025-06","2025-06-01","2025-07-01"),
 ("2025-07","2025-07-01","2025-08-01"),
 ("2025-08","2025-08-01","2025-09-01"),
 ("2025-09","2025-09-01","2025-10-01"),
]
CATS={"home_team","away_team","venue","day_night","home_sp_hand","away_sp_hand","pregame_integrity_tier"}
META={"season","game_pk","game_date","feature_cutoff_date"}
TARGETS={"target_home_f5","target_away_f5","target_home_runs","target_away_runs"}

def fetch_mode(token:str,mode:str)->list[dict[str,Any]]:
    rows=[]; offset=0
    while True:
        r=requests.post(EDGE_URL,headers={"x-github-oidc-token":token,"Content-Type":"application/json"},
                        json={"mode":mode,"offset":offset,"limit":250},timeout=180)
        if not r.ok: raise RuntimeError(f"EXPORT_HTTP_{r.status_code}:{r.text[:800]}")
        p=r.json()
        checks=[
          (p.get("contract")==CONTRACT,"contract"),(p.get("mode")==mode,"mode"),
          (p.get("historicalMaxGameDate")=="2026-09-18","cutoff"),(p.get("researchOnly") is True,"research"),
          (p.get("providerCallsMade")==0,"provider"),(p.get("oddsApiHistoricalCreditsConsumed")==0,"credits"),
          (p.get("officialPicksWrites")==0,"official"),(p.get("apostarActivation") is False,"apostar"),
          (p.get("productionPromotion") is False,"production"),
        ]
        bad=[name for ok,name in checks if not ok]
        if bad: raise RuntimeError("EXPORT_CONTRACT:"+",".join(bad))
        rows.extend(p.get("rows") or [])
        offset += int(p.get("scannedRows") or 0)
        if not p.get("hasMore"): break
        if offset>10000: raise RuntimeError("EXPORT_PAGINATION_GUARD")
    return rows

def frame(rows):
    d=pd.DataFrame(rows)
    if d.empty: raise RuntimeError("EMPTY_EXPORT")
    d["game_date"]=pd.to_datetime(d["game_date"])
    if (d["game_date"]>MAX_DATE).any(): raise RuntimeError("DATE_CUTOFF_BREACH")
    cutoff=pd.to_datetime(d["feature_cutoff_date"],errors="coerce")
    if cutoff.notna().any() and (cutoff>=d["game_date"]).any(): raise RuntimeError("FEATURE_CUTOFF_BREACH")
    return d.sort_values(["game_date","game_pk"]).reset_index(drop=True)

def feature_lists(d):
    nums=[]; cats=[]; dropped=[]
    for c in d.columns:
        if c in META or c in TARGETS: continue
        if c in CATS: cats.append(c); continue
        s=pd.to_numeric(d[c],errors="coerce")
        if s.notna().sum()>=max(150,int(.20*len(d))): nums.append(c)
        else: dropped.append(c)
    return sorted(nums),sorted(cats),sorted(dropped)

def make_x(d,nums,cats):
    x=pd.DataFrame(index=d.index)
    for c in nums: x[c]=pd.to_numeric(d[c],errors="coerce")
    for c in cats: x[c]=d[c].where(d[c].notna(),"__MISSING__").astype(str)
    return x

def model(spec,seed_offset=0):
    p={k:v for k,v in spec.items() if k!="id"}
    return CatBoostClassifier(
      random_seed=SEED+seed_offset,loss_function="Logloss",eval_metric="Logloss",
      verbose=False,allow_writing_files=False,thread_count=-1,**p
    )

def brier(y,p):
    y=np.asarray(y,float); p=np.asarray(p,float)
    return float(np.mean((p-y)**2))

def candidate_metrics(y,p,dates,gate):
    y=np.asarray(y,int); p=np.asarray(p,float); dates=pd.to_datetime(dates)
    sel=(p>=gate)|(p<=1-gate)
    n=int(sel.sum()); total=len(y)
    if not n:
        return {"gate":gate,"n":0,"coverage":0.0,"accuracy":None,"selected_majority_baseline":None,"lift":None,
                "worst_qualified_month_accuracy":None,"qualified_month_count":0}
    ys=y[sel]; ps=p[sel]; pred=(ps>=.5).astype(int)
    acc=float(np.mean(pred==ys)); prevalence=float(np.mean(ys)); base=max(prevalence,1-prevalence)
    tmp=pd.DataFrame({"date":dates[sel],"hit":pred==ys}); tmp["month"]=tmp["date"].dt.strftime("%Y-%m")
    months=[]
    for _,g in tmp.groupby("month"):
        if len(g)>=10: months.append(float(g["hit"].mean()))
    return {
      "gate":gate,"n":n,"coverage":float(n/total),"accuracy":acc,
      "selected_true_rate":prevalence,"selected_majority_baseline":base,"lift":float(acc-base),
      "worst_qualified_month_accuracy":min(months) if months else None,
      "qualified_month_count":len(months),
    }

def choose_candidate(records,min_n):
    stable=[r for r in records if r["metrics"]["n"]>=min_n and r["metrics"]["coverage"]>=.03 and
            r["metrics"]["qualified_month_count"]>=4 and r["metrics"]["worst_qualified_month_accuracy"] is not None]
    target=[r for r in stable if r["metrics"]["accuracy"]>=.75 and r["metrics"]["worst_qualified_month_accuracy"]>=.65 and
            r["metrics"]["lift"]>=.03]
    pool=target if target else stable
    if not pool: return None,False
    pool=sorted(pool,key=lambda r:(-(r["metrics"]["accuracy"] or 0),-(r["metrics"]["worst_qualified_month_accuracy"] or 0),
                                   -(r["metrics"]["lift"] or -9),-r["metrics"]["n"],r["spec"],r["metrics"]["gate"]))
    return pool[0],bool(target)

def rolling_probs(d,x,y):
    probs={s["id"]:[] for s in SPECS}; probs["ensemble"]=[]
    truth=[]; dates=[]; folds=[]
    for month,start_s,end_s in FOLDS:
        start,end=pd.Timestamp(start_s),pd.Timestamp(end_s)
        tr=(d["season"]==2025)&(d["game_date"]<start); va=(d["season"]==2025)&(d["game_date"]>=start)&(d["game_date"]<end)
        if tr.sum()<300 or va.sum()<100: raise RuntimeError(f"SMALL_FOLD:{month}:{tr.sum()}:{va.sum()}")
        fold_p=[]
        for i,spec in enumerate(SPECS):
            m=model(spec,i)
            m.fit(x.loc[tr],y.loc[tr].astype(int),cat_features=[c for c in CATS if c in x.columns])
            p=np.asarray(m.predict_proba(x.loc[va]))[:,1]; probs[spec["id"]].extend(p.tolist()); fold_p.append(p)
        probs["ensemble"].extend(np.mean(np.vstack(fold_p),axis=0).tolist())
        truth.extend(y.loc[va].astype(int).tolist()); dates.extend(d.loc[va,"game_date"].astype(str).tolist())
        folds.append({"month":month,"train_n":int(tr.sum()),"validation_n":int(va.sum())})
    return np.asarray(truth),{k:np.asarray(v) for k,v in probs.items()},np.asarray(dates),folds

def full_external_probs(d,x,y,spec_id):
    tr=d["season"]==2025; ext=d["season"]==2026
    specs=SPECS if spec_id=="ensemble" else [s for s in SPECS if s["id"]==spec_id]
    pp=[]
    for i,spec in enumerate(specs):
        m=model(spec,100+i)
        m.fit(x.loc[tr],y.loc[tr].astype(int),cat_features=[c for c in CATS if c in x.columns])
        pp.append(np.asarray(m.predict_proba(x.loc[ext]))[:,1])
    return d.loc[ext].copy(),np.mean(np.vstack(pp),axis=0)

def analyze_binary(d,x,y,label,min_n):
    truth,probs,dates,folds=rolling_probs(d,x,y)
    dev_models={k:{"brier":brier(truth,p),"base_rate":float(np.mean(truth))} for k,p in probs.items()}
    records=[]
    for spec,p in probs.items():
        for gate in GATES:
            records.append({"spec":spec,"metrics":candidate_metrics(truth,p,dates,gate)})
    champ,target_met=choose_candidate(records,min_n)
    if champ is None:
        return {"label":label,"development_models":dev_models,"candidates":records,"champion":None,
                "development_target_met":False,"external_2026":None,"folds":folds}
    ext,p_ext=full_external_probs(d,x,y,champ["spec"])
    y_ext=y.loc[ext.index].astype(int).to_numpy()
    em=candidate_metrics(y_ext,p_ext,ext["game_date"].astype(str).to_numpy(),champ["metrics"]["gate"])
    em["brier"]=brier(y_ext,p_ext); em["base_rate"]=float(np.mean(y_ext))
    return {"label":label,"development_models":dev_models,"candidates":records,"champion":champ,
            "development_target_met":target_met,"external_2026":em,"folds":folds}

def run_f5(d,nums,cats):
    d=d.dropna(subset=["target_home_f5","target_away_f5"]).copy()
    d["margin"]=pd.to_numeric(d["target_home_f5"])-pd.to_numeric(d["target_away_f5"])
    x=make_x(d,nums,cats)
    targets=[("margin_ge_neg1",-1),("margin_ge_0",0),("margin_ge_1",1),("margin_ge_2",2)]
    return {name:analyze_binary(d,x,(d["margin"]>=thr).astype(int),name,80) for name,thr in targets}

def team_label_analysis(d,nums,cats,k):
    d=d.dropna(subset=["target_home_runs","target_away_runs"]).copy(); x=make_x(d,nums,cats)
    # Separate home/away models per fold, then combine probabilities into one team-level sample.
    stores={s["id"]:[] for s in SPECS}; stores["ensemble"]=[]; truths=[]; dates=[]; folds=[]
    for month,start_s,end_s in FOLDS:
        start,end=pd.Timestamp(start_s),pd.Timestamp(end_s)
        tr=(d["season"]==2025)&(d["game_date"]<start); va=(d["season"]==2025)&(d["game_date"]>=start)&(d["game_date"]<end)
        if tr.sum()<300 or va.sum()<100: raise RuntimeError(f"TEAM_SMALL_FOLD:{month}")
        per=[]
        for i,spec in enumerate(SPECS):
            mh=model(spec,200+i); ma=model(spec,300+i)
            yh=(pd.to_numeric(d["target_home_runs"])>=k).astype(int); ya=(pd.to_numeric(d["target_away_runs"])>=k).astype(int)
            cats_here=[c for c in CATS if c in x.columns]
            mh.fit(x.loc[tr],yh.loc[tr],cat_features=cats_here); ma.fit(x.loc[tr],ya.loc[tr],cat_features=cats_here)
            ph=np.asarray(mh.predict_proba(x.loc[va]))[:,1]; pa=np.asarray(ma.predict_proba(x.loc[va]))[:,1]
            combo=np.concatenate([ph,pa]); stores[spec["id"]].extend(combo.tolist()); per.append(combo)
        stores["ensemble"].extend(np.mean(np.vstack(per),axis=0).tolist())
        truths.extend(np.concatenate([(pd.to_numeric(d.loc[va,"target_home_runs"])>=k).astype(int).to_numpy(),
                                      (pd.to_numeric(d.loc[va,"target_away_runs"])>=k).astype(int).to_numpy()]).tolist())
        dd=d.loc[va,"game_date"].astype(str).tolist(); dates.extend(dd+dd)
        folds.append({"month":month,"train_games":int(tr.sum()),"validation_games":int(va.sum())})
    truth=np.asarray(truths); dates=np.asarray(dates); probs={kk:np.asarray(v) for kk,v in stores.items()}
    dev_models={kk:{"brier":brier(truth,p),"base_rate":float(np.mean(truth))} for kk,p in probs.items()}
    records=[]
    for spec,p in probs.items():
        for gate in GATES: records.append({"spec":spec,"metrics":candidate_metrics(truth,p,dates,gate)})
    champ,target_met=choose_candidate(records,150)
    external=None
    if champ:
        tr=d["season"]==2025; ext=d["season"]==2026
        specs=SPECS if champ["spec"]=="ensemble" else [s for s in SPECS if s["id"]==champ["spec"]]
        hh=[]; aa=[]; cats_here=[c for c in CATS if c in x.columns]
        yh=(pd.to_numeric(d["target_home_runs"])>=k).astype(int); ya=(pd.to_numeric(d["target_away_runs"])>=k).astype(int)
        for i,spec in enumerate(specs):
            mh=model(spec,400+i); ma=model(spec,500+i)
            mh.fit(x.loc[tr],yh.loc[tr],cat_features=cats_here); ma.fit(x.loc[tr],ya.loc[tr],cat_features=cats_here)
            hh.append(np.asarray(mh.predict_proba(x.loc[ext]))[:,1]); aa.append(np.asarray(ma.predict_proba(x.loc[ext]))[:,1])
        pext=np.concatenate([np.mean(np.vstack(hh),axis=0),np.mean(np.vstack(aa),axis=0)])
        yext=np.concatenate([yh.loc[ext].to_numpy(),ya.loc[ext].to_numpy()])
        de=d.loc[ext,"game_date"].astype(str).to_numpy(); dateext=np.concatenate([de,de])
        external=candidate_metrics(yext,pext,dateext,champ["metrics"]["gate"])
        external["brier"]=brier(yext,pext); external["base_rate"]=float(np.mean(yext))
    return {"label":f"team_runs_ge_{k}","development_models":dev_models,"candidates":records,
            "champion":champ,"development_target_met":target_met,"external_2026":external,"folds":folds}

def main():
    token=os.environ.get("GITHUB_OIDC_TOKEN","").strip()
    if not token: raise RuntimeError("OIDC_MISSING")
    f5=frame(fetch_mode(token,"f5_margin")); team=frame(fetch_mode(token,"team_runs"))
    fn,fc,fd=feature_lists(f5); tn,tc,td=feature_lists(team)
    f5r=run_f5(f5,fn,fc)
    teamr={f"runs_ge_{k}":team_label_analysis(team,tn,tc,k) for k in [3,4,5,6]}
    out={
      "contract":"MLB_PERIOD_TEAM_THRESHOLD_CLASSIFIER_V1_RESULT/1.0.0",
      "state":"RESEARCH_ONLY_DISTRIBUTION_SIGNAL_NO_REAL_LINE_CERTIFICATION",
      "policy":{
        "development":"rolling monthly 2025 only","external":"2026 historical diagnostic after champion selection",
        "probability_gates":GATES,"target_accuracy":0.75,"min_worst_month_accuracy":0.65,"min_selected_lift":0.03,
        "f5_min_selected_n":80,"team_min_selected_n":150,"minimum_selected_coverage":0.03,
        "minimum_qualified_months":4,"qualified_month_min_n":10,
      },
      "f5":{"source_rows":len(f5),"numeric_features":fn,"categorical_features":fc,"dropped":fd,"targets":f5r},
      "team_totals":{"source_rows":len(team),"numeric_features":tn,"categorical_features":tc,"dropped":td,"targets":teamr},
      "provider_calls_made":0,"odds_api_historical_credits_consumed":0,"official_picks_writes":0,
      "apostar_activation":False,"production_promotion":False,"real_line_backtest_performed":False,
    }
    OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
    summary={"f5":{},"team":{}}
    for k,v in f5r.items(): summary["f5"][k]={"champion":v["champion"],"dev_target":v["development_target_met"],"external":v["external_2026"]}
    for k,v in teamr.items(): summary["team"][k]={"champion":v["champion"],"dev_target":v["development_target_met"],"external":v["external_2026"]}
    print(json.dumps(summary,indent=2))

if __name__=="__main__": main()
