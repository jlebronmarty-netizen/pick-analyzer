#!/usr/bin/env python3
"""MLB Totals V37 — cross-year-parity 2025 rolling development.

Only the 2025 research table is read here. The 2026 parity table contains
PREGAME features only and is not opened by this trainer.

Protocol:
- Expanding chronological validation May-Sep 2025.
- Three fixed CatBoost architectures.
- Stability-first fallback selection if no candidate reaches 75%.
- Freeze before any 2026 outcome is opened.
"""

from __future__ import annotations
import hashlib, json, os
from collections import defaultdict
from pathlib import Path
from typing import Any
import numpy as np
import pandas as pd
import requests
from catboost import CatBoostClassifier, CatBoostRegressor
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error

SEED=20260918
TABLE="mlb_totals_v37_xyear_pregame_2025_v1"
EDGE_URL="https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-totals-v37-github-export-temp"
OUT=Path("artifacts/research/mlb_totals_v37_rolling_2025_result.json")
FREEZE=Path("artifacts/research/mlb_totals_v37_frozen_candidate.json")

LABEL="close_over_label"
Y_MARGIN="y_close_margin"
Y_TOTAL="y_total_runs"
META={"game_pk","game_date","research_only"}
TARGETS={LABEL,Y_MARGIN,Y_TOTAL}
CATEGORICAL=[
 "home_team","away_team","day_night","home_sp_hand","away_sp_hand",
 "wind_direction","precip","sky","roof_status"
]
CLASS_THRESHOLDS=[0.55,0.60,0.65,0.70,0.75]
EDGE_THRESHOLDS=[0.5,1.0,1.5,2.0]
MODES=["two_sided","over_only","under_only"]
STABLE_N_MIN=50
STABLE_MONTH_N_MIN=8
TARGET_ACC=0.75
TARGET_WORST=0.65
FOLDS=[
 ("2025-05","2025-05-01","2025-06-01"),
 ("2025-06","2025-06-01","2025-07-01"),
 ("2025-07","2025-07-01","2025-08-01"),
 ("2025-08","2025-08-01","2025-09-01"),
 ("2025-09","2025-09-01","2025-10-01"),
]
SPECS=[
 {"depth":4,"iterations":250,"learning_rate":0.03,"l2_leaf_reg":5.0,"random_strength":1.0},
 {"depth":4,"iterations":400,"learning_rate":0.05,"l2_leaf_reg":5.0,"random_strength":1.0},
 {"depth":6,"iterations":250,"learning_rate":0.03,"l2_leaf_reg":5.0,"random_strength":1.0},
 {"depth":6,"iterations":400,"learning_rate":0.05,"l2_leaf_reg":5.0,"random_strength":1.0},
]

def fetch_rows(token:str)->list[dict[str,Any]]:
    r=requests.post(EDGE_URL,headers={"x-github-oidc-token":token,"Content-Type":"application/json"},
        json={"range":"full_2025"},timeout=180)
    if not r.ok: raise RuntimeError(f"V37_EDGE_HTTP_{r.status_code}:{r.text[:800]}")
    p=r.json()
    checks=[
      (p.get("contract")=="MLB_TOTALS_V37_GITHUB_EXPORT/1.0.0","contract"),
      (p.get("sourceTable")==f"public.{TABLE}","table"),
      (p.get("rowCount")==2425,"rowCount"),
      (p.get("researchOnly") is True,"research"),
      (p.get("external2026Included") is False,"2026"),
      (p.get("officialPicksWrites")==0,"official"),
      (p.get("apostarActivation") is False,"apostar"),
      (p.get("productionPromotion") is False,"production"),
      (p.get("oddsApiHistoricalCreditsConsumed")==0,"credits"),
    ]
    bad=[n for ok,n in checks if not ok]
    if bad: raise RuntimeError("V37_EXPORT_CONTRACT_INVALID:"+",".join(bad))
    return p["rows"]

def prep(df:pd.DataFrame,features:list[str])->pd.DataFrame:
    out=pd.DataFrame(index=df.index)
    for c in features:
        if c in CATEGORICAL: out[c]=df[c].fillna("__MISSING__").astype(str)
        elif c=="doubleheader_flag": out[c]=df[c].fillna(False).astype(int)
        else: out[c]=pd.to_numeric(df[c],errors="coerce")
    return out

def clf(params):
    return CatBoostClassifier(random_seed=SEED,loss_function="Logloss",eval_metric="Logloss",
        verbose=False,allow_writing_files=False,thread_count=-1,**params)

def reg(params):
    return CatBoostRegressor(random_seed=SEED,loss_function="RMSE",eval_metric="RMSE",
        verbose=False,allow_writing_files=False,thread_count=-1,**params)

def prob_select(p,mode,th):
    if mode=="two_sided": return (p>=th)|(p<=1-th),(p>=.5).astype(int)
    if mode=="over_only": return p>=th,np.ones(len(p),dtype=int)
    if mode=="under_only": return p<=1-th,np.zeros(len(p),dtype=int)
    raise ValueError(mode)

def edge_select(e,mode,th):
    if mode=="two_sided": return (e>=th)|(e<=-th),(e>=0).astype(int)
    if mode=="over_only": return e>=th,np.ones(len(e),dtype=int)
    if mode=="under_only": return e<=-th,np.zeros(len(e),dtype=int)
    raise ValueError(mode)

def summarize(records,arch,spec_index,params,mode,th,total_oof):
    sel=[x for x in records if x["selected"]]
    if not sel:return None
    months={}
    for m,_,_ in FOLDS:
        rr=[x for x in sel if x["month"]==m]
        n=len(rr);c=sum(int(x["truth"]==x["pred"]) for x in rr)
        months[m]={"n":n,"correct":c,"accuracy":c/n if n else None}
    n=len(sel);correct=sum(int(x["truth"]==x["pred"]) for x in sel);acc=correct/n
    ns=[months[m]["n"] for m,_,_ in FOLDS]
    accs=[months[m]["accuracy"] for m,_,_ in FOLDS if months[m]["accuracy"] is not None]
    worst=min(accs) if len(accs)==len(FOLDS) else 0.0
    stable=n>=STABLE_N_MIN and min(ns)>=STABLE_MONTH_N_MIN
    target=stable and acc>=TARGET_ACC and worst>=TARGET_WORST
    return {
      "architecture":arch,"spec_index":spec_index,"params":params,"mode":mode,"threshold":th,
      "n":n,"correct":correct,"accuracy":acc,"coverage_vs_nonpush_oof":n/total_oof,
      "months":months,"min_month_n":min(ns),"worst_month_accuracy":worst,
      "monthly_accuracy_sd":float(np.std(accs,ddof=0)) if accs else None,
      "stable":stable,"target_met_75_plus":target,
    }

def rank_key(c):
    return (
      1 if c["target_met_75_plus"] else 0,
      1 if c["stable"] else 0,
      c["worst_month_accuracy"],
      c["accuracy"],
      -c["monthly_accuracy_sd"],
      c["n"],
    )

def main():
    token=os.environ.get("GITHUB_OIDC_TOKEN","").strip()
    if not token: raise RuntimeError("V37_OIDC_MISSING")
    df=pd.DataFrame(fetch_rows(token));df["game_date"]=pd.to_datetime(df["game_date"])
    if len(df)!=2425:raise RuntimeError("V37_COUNT_MISMATCH")
    features=sorted(c for c in df.columns if c not in META|TARGETS)
    if any(c.startswith("actual_") or c.startswith("y_") for c in features):
        raise RuntimeError("V37_TARGET_OR_FULL_LEAK")
    if set(CATEGORICAL)-set(features):raise RuntimeError("V37_CAT_MISSING")
    feature_hash=hashlib.sha256("\n".join(features).encode()).hexdigest()

    records=defaultdict(list);diagnostics=[];folds=[];total_oof=0
    for month,start_s,end_s in FOLDS:
        start=pd.Timestamp(start_s);end=pd.Timestamp(end_s)
        train_all=df[df.game_date<start].copy()
        train_cls=train_all[train_all[LABEL].notna()].copy()
        val=df[(df.game_date>=start)&(df.game_date<end)&df[LABEL].notna()].copy()
        if len(train_cls)<300 or len(val)<300:raise RuntimeError(f"V37_SMALL_FOLD:{month}")
        total_oof+=len(val)
        folds.append({"month":month,"train_rows":len(train_cls),"validation_nonpush_rows":len(val),
                      "train_end":str(train_all.game_date.max().date())})
        xcls=prep(train_cls,features);xall=prep(train_all,features);xv=prep(val,features)
        y=val[LABEL].astype(int).to_numpy();pks=val.game_pk.astype(int).to_numpy()
        close=pd.to_numeric(val.close_total,errors="coerce").to_numpy(float)

        for si,params in enumerate(SPECS):
            m=clf(params);m.fit(xcls,train_cls[LABEL].astype(int).to_numpy(),cat_features=CATEGORICAL)
            po=np.asarray(m.predict_proba(xv)[:,1],float)
            diagnostics.append({"architecture":"catboost_classifier","spec_index":si,"month":month,
                                "full_accuracy":float(accuracy_score(y,(po>=.5).astype(int)))})
            for mode in MODES:
                for th in CLASS_THRESHOLDS:
                    mask,pred=prob_select(po,mode,th);key=("catboost_classifier",si,mode,float(th))
                    for i in range(len(val)):records[key].append({"month":month,"game_pk":int(pks[i]),"truth":int(y[i]),"pred":int(pred[i]),"selected":bool(mask[i])})

            m=reg(params);m.fit(xall,pd.to_numeric(train_all[Y_MARGIN],errors="coerce").to_numpy(float),cat_features=CATEGORICAL)
            pm=np.asarray(m.predict(xv),float);actual=pd.to_numeric(val[Y_MARGIN],errors="coerce").to_numpy(float)
            diagnostics.append({"architecture":"catboost_close_margin_regression","spec_index":si,"month":month,
                                "full_accuracy":float(accuracy_score(y,(pm>=0).astype(int))),
                                "mae":float(mean_absolute_error(actual,pm)),"rmse":float(mean_squared_error(actual,pm)**.5)})
            for mode in MODES:
                for th in EDGE_THRESHOLDS:
                    mask,pred=edge_select(pm,mode,th);key=("catboost_close_margin_regression",si,mode,float(th))
                    for i in range(len(val)):records[key].append({"month":month,"game_pk":int(pks[i]),"truth":int(y[i]),"pred":int(pred[i]),"selected":bool(mask[i])})

            m=reg(params);m.fit(xall,pd.to_numeric(train_all[Y_TOTAL],errors="coerce").to_numpy(float),cat_features=CATEGORICAL)
            pt=np.asarray(m.predict(xv),float);edge=pt-close;actualt=pd.to_numeric(val[Y_TOTAL],errors="coerce").to_numpy(float)
            diagnostics.append({"architecture":"catboost_total_runs_regression","spec_index":si,"month":month,
                                "full_accuracy":float(accuracy_score(y,(edge>=0).astype(int))),
                                "mae":float(mean_absolute_error(actualt,pt)),"rmse":float(mean_squared_error(actualt,pt)**.5)})
            for mode in MODES:
                for th in EDGE_THRESHOLDS:
                    mask,pred=edge_select(edge,mode,th);key=("catboost_total_runs_regression",si,mode,float(th))
                    for i in range(len(val)):records[key].append({"month":month,"game_pk":int(pks[i]),"truth":int(y[i]),"pred":int(pred[i]),"selected":bool(mask[i])})

    candidates=[]
    for (arch,si,mode,th),rr in records.items():
        s=summarize(rr,arch,si,SPECS[si],mode,th,total_oof)
        if s:candidates.append(s)
    stable=[c for c in candidates if c["stable"]]
    if not stable:raise RuntimeError("V37_NO_STABLE_CANDIDATES")
    stable.sort(key=rank_key,reverse=True);selected=stable[0]
    tops={}
    for arch in sorted({c["architecture"] for c in stable}):
        vals=[c for c in stable if c["architecture"]==arch];vals.sort(key=rank_key,reverse=True);tops[arch]=vals[:10]

    result={
      "contract":"MLB_TOTALS_V37_ROLLING_2025_RESULT/1.0.0","research_only":True,
      "candidate_family":"totals_v37_xyear_parity","source_table":f"public.{TABLE}",
      "source_rows_2025":len(df),"feature_count":len(features),"feature_hash_sha256":feature_hash,
      "categorical_features":CATEGORICAL,"target_only_fields":sorted(TARGETS),
      "folds":folds,"oof_nonpush_rows":total_oof,"selected_candidate":selected,
      "target_met_75_plus":selected["target_met_75_plus"],
      "market_closeout_state":"TARGET_MET_75_PLUS_EXTERNAL_PENDING" if selected["target_met_75_plus"] else "REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING",
      "top_stable_by_architecture":tops,"model_diagnostics":diagnostics,
      "selected_using_2025_only":True,"external_2026_opened":False,"external_2026_used_for_selection":False,
      "cross_year_feature_parity_verified":True,"cross_year_2026_pregame_rows":1576,
      "official_picks_writes":0,"apostar_activation":False,"production_promotion":False,
      "odds_api_historical_credits_consumed":0,"github_sha_at_run":os.environ.get("GITHUB_SHA"),
    }
    freeze={
      "contract":"MLB_TOTALS_V37_FROZEN_CANDIDATE/1.0.0","frozen":True,"research_only":True,
      "candidate":selected,"feature_count":len(features),"feature_hash_sha256":feature_hash,
      "feature_columns":features,"categorical_features":CATEGORICAL,
      "source_table_2025":f"public.{TABLE}","source_table_2026_pregame":"public.mlb_totals_v37_xyear_pregame_2026_v1",
      "selected_using_2025_only":True,"external_2026_opened":False,"seed":SEED,
      "official_picks_writes":0,"apostar_activation":False,"production_promotion":False,
      "github_sha_at_freeze":os.environ.get("GITHUB_SHA"),
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    FREEZE.write_text(json.dumps(freeze,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"state":result["market_closeout_state"],"selected":selected,
      "feature_count":len(features),"external_2026_opened":False},indent=2,sort_keys=True))

if __name__=="__main__": main()
