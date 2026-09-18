#!/usr/bin/env python3
"""One-shot external 2026 evaluation for frozen MLB Totals V37.

This script MUST run only after the V37 freeze artifact exists.
It does not search params, thresholds, modes, or features.
"""

from __future__ import annotations
import json, os
from pathlib import Path
from typing import Any
import numpy as np
import pandas as pd
import requests
from catboost import CatBoostClassifier, CatBoostRegressor
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error

FREEZE_PATH=Path("artifacts/research/mlb_totals_v37_frozen_candidate.json")
OUT=Path("artifacts/research/mlb_totals_v37_external_2026_result.json")
EDGE_URL="https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-totals-v37-external-github-export-temp"
EXPECTED_FREEZE_CONTRACT="MLB_TOTALS_V37_FROZEN_CANDIDATE/1.0.0"
SEED=20260918

def fetch(token:str,kind:str)->list[dict[str,Any]]:
    r=requests.post(EDGE_URL,headers={"x-github-oidc-token":token,"Content-Type":"application/json"},
                    json={"range":kind},timeout=180)
    if not r.ok: raise RuntimeError(f"V37_EXT_HTTP_{r.status_code}:{r.text[:800]}")
    p=r.json()
    checks=[
      (p.get("contract")=="MLB_TOTALS_V37_EXTERNAL_EXPORT/1.0.0","contract"),
      (p.get("researchOnly") is True,"research"),
      (p.get("range")==kind,"range"),
      (p.get("officialPicksWrites")==0,"official"),
      (p.get("apostarActivation") is False,"apostar"),
      (p.get("productionPromotion") is False,"production"),
      (p.get("oddsApiHistoricalCreditsConsumed")==0,"credits"),
    ]
    if kind=="train_2025": checks.append((p.get("season")==2025,"train season"))
    if kind=="external_2026": checks.append((p.get("season")==2026,"external season"))
    bad=[n for ok,n in checks if not ok]
    if bad:raise RuntimeError("V37_EXT_CONTRACT_INVALID:"+",".join(bad))
    return p["rows"]

def prep(df:pd.DataFrame,features:list[str],cats:list[str])->pd.DataFrame:
    out=pd.DataFrame(index=df.index)
    for c in features:
        if c in cats: out[c]=df[c].fillna("__MISSING__").astype(str)
        elif c=="doubleheader_flag":out[c]=df[c].fillna(False).astype(int)
        else:out[c]=pd.to_numeric(df[c],errors="coerce")
    return out

def selection(values:np.ndarray,arch:str,mode:str,th:float)->tuple[np.ndarray,np.ndarray]:
    if arch=="catboost_classifier":
        if mode=="two_sided":return (values>=th)|(values<=1-th),(values>=.5).astype(int)
        if mode=="over_only":return values>=th,np.ones(len(values),dtype=int)
        if mode=="under_only":return values<=1-th,np.zeros(len(values),dtype=int)
    else:
        if mode=="two_sided":return (values>=th)|(values<=-th),(values>=0).astype(int)
        if mode=="over_only":return values>=th,np.ones(len(values),dtype=int)
        if mode=="under_only":return values<=-th,np.zeros(len(values),dtype=int)
    raise ValueError((arch,mode))

def main():
    if not FREEZE_PATH.exists():raise RuntimeError("V37_FREEZE_MISSING")
    freeze=json.loads(FREEZE_PATH.read_text())
    if freeze.get("contract")!=EXPECTED_FREEZE_CONTRACT or freeze.get("frozen") is not True:
        raise RuntimeError("V37_FREEZE_INVALID")
    if freeze.get("selected_using_2025_only") is not True or freeze.get("external_2026_opened") is not False:
        raise RuntimeError("V37_FREEZE_LINEAGE_INVALID")

    cand=freeze["candidate"];features=freeze["feature_columns"];cats=freeze["categorical_features"]
    token=os.environ.get("GITHUB_OIDC_TOKEN","").strip()
    if not token:raise RuntimeError("V37_EXT_OIDC_MISSING")
    train=pd.DataFrame(fetch(token,"train_2025"));ext=pd.DataFrame(fetch(token,"external_2026"))
    train["game_date"]=pd.to_datetime(train["game_date"]);ext["game_date"]=pd.to_datetime(ext["game_date"])
    if len(train)!=2425:raise RuntimeError(f"V37_EXT_TRAIN_COUNT:{len(train)}")
    if len(ext)!=1576:raise RuntimeError(f"V37_EXT_EXTERNAL_COUNT:{len(ext)}")
    for c in features:
        if c not in train.columns or c not in ext.columns:raise RuntimeError("V37_EXT_FEATURE_MISSING:"+c)

    xtrain=prep(train,features,cats);xext=prep(ext,features,cats)
    params=cand["params"];arch=cand["architecture"]
    if arch=="catboost_classifier":
        tr=train[train["close_over_label"].notna()].copy()
        xt=prep(tr,features,cats)
        model=CatBoostClassifier(random_seed=SEED,loss_function="Logloss",eval_metric="Logloss",
            verbose=False,allow_writing_files=False,thread_count=-1,**params)
        model.fit(xt,tr["close_over_label"].astype(int).to_numpy(),cat_features=cats)
        score=np.asarray(model.predict_proba(xext)[:,1],float)
        full_pred=(score>=.5).astype(int)
        regression_diag=None
    elif arch=="catboost_close_margin_regression":
        model=CatBoostRegressor(random_seed=SEED,loss_function="RMSE",eval_metric="RMSE",
            verbose=False,allow_writing_files=False,thread_count=-1,**params)
        model.fit(xtrain,pd.to_numeric(train["y_close_margin"],errors="coerce").to_numpy(float),cat_features=cats)
        score=np.asarray(model.predict(xext),float);full_pred=(score>=0).astype(int)
        regression_diag={
          "target":"close_margin",
          "mae":float(mean_absolute_error(pd.to_numeric(ext["y_close_margin"],errors="coerce"),score)),
          "rmse":float(mean_squared_error(pd.to_numeric(ext["y_close_margin"],errors="coerce"),score)**.5),
        }
    elif arch=="catboost_total_runs_regression":
        model=CatBoostRegressor(random_seed=SEED,loss_function="RMSE",eval_metric="RMSE",
            verbose=False,allow_writing_files=False,thread_count=-1,**params)
        model.fit(xtrain,pd.to_numeric(train["y_total_runs"],errors="coerce").to_numpy(float),cat_features=cats)
        pred_total=np.asarray(model.predict(xext),float)
        score=pred_total-pd.to_numeric(ext["close_total"],errors="coerce").to_numpy(float)
        full_pred=(score>=0).astype(int)
        regression_diag={
          "target":"total_runs",
          "mae":float(mean_absolute_error(pd.to_numeric(ext["y_total_runs"],errors="coerce"),pred_total)),
          "rmse":float(mean_squared_error(pd.to_numeric(ext["y_total_runs"],errors="coerce"),pred_total)**.5),
        }
    else:raise RuntimeError("V37_EXT_ARCH_UNKNOWN:"+str(arch))

    valid=ext["close_over_label"].notna().to_numpy()
    truth=ext["close_over_label"].fillna(-1).astype(int).to_numpy()
    mask,pred=selection(score,arch,cand["mode"],float(cand["threshold"]))
    selected=mask & valid
    n=int(selected.sum());correct=int((pred[selected]==truth[selected]).sum())
    accuracy=correct/n if n else None
    nonpush=int(valid.sum())
    full_accuracy=float(accuracy_score(truth[valid],full_pred[valid]))
    months={}
    for month in sorted(ext.loc[valid,"game_date"].dt.strftime("%Y-%m").unique()):
        mm=selected & (ext["game_date"].dt.strftime("%Y-%m").to_numpy()==month)
        mn=int(mm.sum());mc=int((pred[mm]==truth[mm]).sum()) if mn else 0
        months[month]={"n":mn,"correct":mc,"accuracy":mc/mn if mn else None}
    observed=[v["accuracy"] for v in months.values() if v["accuracy"] is not None]

    result={
      "contract":"MLB_TOTALS_V37_EXTERNAL_2026_RESULT/1.0.0","research_only":True,
      "candidate_freeze_contract":freeze["contract"],"candidate_freeze_sha":freeze.get("github_sha_at_freeze"),
      "feature_hash_sha256":freeze["feature_hash_sha256"],"candidate":cand,
      "external_season":2026,"external_rows":len(ext),"external_nonpush_rows":nonpush,
      "selected_n":n,"selected_correct":correct,"selected_accuracy":accuracy,
      "selected_coverage_vs_nonpush":n/nonpush if nonpush else None,
      "monthly":months,"worst_month_accuracy":min(observed) if observed else None,
      "full_zero_threshold_accuracy":full_accuracy,"regression_diagnostics":regression_diag,
      "target_75_met_external":bool(accuracy is not None and accuracy>=0.75),
      "status":"TARGET_MET_75_PLUS_EXTERNAL" if accuracy is not None and accuracy>=0.75 else "REVISIT_AFTER_FIRST_PASS",
      "retuning_after_external":False,"selected_using_2025_only":True,"external_2026_opened_once":True,
      "official_picks_writes":0,"apostar_activation":False,"production_promotion":False,
      "odds_api_historical_credits_consumed":0,"github_sha_at_external_run":os.environ.get("GITHUB_SHA"),
    }
    OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    print(json.dumps(result,indent=2,sort_keys=True))

if __name__=="__main__":main()
