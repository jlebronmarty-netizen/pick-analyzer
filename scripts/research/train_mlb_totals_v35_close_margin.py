#!/usr/bin/env python3
"""Research-only MLB Totals V35 direct close-margin CatBoost regression.

Target = final total runs - pregame closing total.
The target is training/evaluation only and is explicitly excluded from features.

Protocol:
- Apr-May fit only.
- June internal model/edge selection.
- Jul-Aug opens once only if frozen June candidate passes.
- 2026 never read.
"""

from __future__ import annotations
import json, os
from pathlib import Path
from typing import Any
import numpy as np
import pandas as pd
import requests
from catboost import CatBoostRegressor
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error

SEED=20260917
TABLE="mlb_totals_v35_close_margin_dataset_2025_v1"
TARGET_LABEL="close_over_label"
Y="y_close_margin"
CANDIDATE_NAME="totals_v35_direct_close_margin_catboost_v1"
EDGE_URL="https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-totals-v35-github-export-temp"
OUT=Path("artifacts/research/mlb_totals_v35_close_margin_result.json")

TRAIN_START=pd.Timestamp("2025-04-01")
INTERNAL_START=pd.Timestamp("2025-06-01")
PREGATE_START=pd.Timestamp("2025-07-01")
CAT_FEATURES=["cat_home_team","cat_away_team","cat_venue"]
META={"game_pk","game_date",TARGET_LABEL,"research_only",Y}
FORBIDDEN={
  "total_runs","home_runs","away_runs","actual_winner","y_margin",
  "open_total_margin","close_total_margin",
  "actual_offense_score","actual_contact_score",
  "actual_starter_vulnerability_score","actual_bullpen_vulnerability_score",
  "actual_defense_error_score",Y,
}
EDGE_THRESHOLDS=[0.5,1.0,1.5,2.0]
MODES=["two_sided","over_only","under_only"]

INTERNAL_N_MIN=30
INTERNAL_HALF_N_MIN=10
INTERNAL_ACC_MIN=0.70
INTERNAL_WORST_HALF_MIN=0.65
PREGATE_N_MIN=30
PREGATE_MONTH_N_MIN=10
PREGATE_ACC_MIN=0.75
PREGATE_WORST_MONTH_MIN=0.70

def base_result(status:str)->dict[str,Any]:
    return {
      "contract":"MLB_TOTALS_V35_CLOSE_MARGIN_RESEARCH/1.0.0",
      "research_only":True,"candidate_name":CANDIDATE_NAME,
      "source_table":f"public.{TABLE}","status":status,
      "official_picks_writes":0,"apostar_activation":False,
      "production_promotion":False,"odds_api_historical_credits_consumed":0,
      "2026_used_for_selection":False,"2026_opened_for_external_test":False,
      "jul_aug_opened":False,"target_only_fields":[Y],
    }

def write_result(r:dict[str,Any])->None:
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(r,indent=2,sort_keys=True)+"\n",encoding="utf-8")

def fetch_range(oidc:str,range_name:str)->list[dict[str,Any]]:
    r=requests.post(EDGE_URL,headers={
      "x-github-oidc-token":oidc,"Content-Type":"application/json","Accept":"application/json"
    },json={"range":range_name},timeout=120)
    if not r.ok: raise RuntimeError(f"V35_EDGE_HTTP_{r.status_code}:{r.text[:1000]}")
    p=r.json()
    checks=[
      (p.get("contract")=="MLB_TOTALS_V35_GITHUB_EXPORT/1.0.0","contract"),
      (p.get("researchOnly") is True,"researchOnly"),
      (p.get("sourceTable")==f"public.{TABLE}","sourceTable"),
      (p.get("range")==range_name,"range"),
      (p.get("targetFields")==[Y],"targetFields"),
      (p.get("officialPicksWrites")==0,"Official Picks"),
      (p.get("apostarActivation") is False,"APOSTAR"),
      (p.get("productionPromotion") is False,"production"),
      (p.get("oddsApiHistoricalCreditsConsumed")==0,"Odds API credits"),
      (p.get("external2026Included") is False,"2026"),
      (isinstance(p.get("rows"),list),"rows"),
    ]
    bad=[name for ok,name in checks if not ok]
    if bad: raise RuntimeError("V35_EDGE_CONTRACT_INVALID:"+",".join(bad))
    return p["rows"]

def feature_frame(df:pd.DataFrame,features:list[str])->pd.DataFrame:
    out=pd.DataFrame(index=df.index)
    for f in features:
        if f in CAT_FEATURES: out[f]=df[f].fillna("__MISSING__").astype(str)
        else: out[f]=pd.to_numeric(df[f],errors="coerce")
    return out

def model_specs()->list[dict[str,Any]]:
    out=[]
    for depth in (4,6):
      for iterations in (200,400):
        for lr in (0.03,0.06):
          out.append({"depth":depth,"iterations":iterations,"learning_rate":lr,"l2_leaf_reg":5.0,"random_strength":1.0})
    return out

def make_model(params:dict[str,Any])->CatBoostRegressor:
    return CatBoostRegressor(
      random_seed=SEED,loss_function="RMSE",eval_metric="RMSE",
      verbose=False,allow_writing_files=False,thread_count=-1,**params
    )

def selection(pred_margin:np.ndarray,mode:str,threshold:float)->tuple[np.ndarray,np.ndarray]:
    if mode=="two_sided":
      mask=(pred_margin>=threshold)|(pred_margin<=-threshold); pred=(pred_margin>=threshold).astype(int)
    elif mode=="over_only":
      mask=pred_margin>=threshold; pred=np.ones(len(pred_margin),dtype=int)
    elif mode=="under_only":
      mask=pred_margin<=-threshold; pred=np.zeros(len(pred_margin),dtype=int)
    else: raise ValueError(mode)
    return mask,pred

def eval_internal(pred_margin:np.ndarray,val:pd.DataFrame,mode:str,threshold:float,mae:float,rmse:float,full_acc:float):
    y=val[TARGET_LABEL].astype(int).to_numpy()
    mask,pred=selection(pred_margin,mode,threshold)
    n=int(mask.sum())
    if n<INTERNAL_N_MIN:return None
    idx=np.flatnonzero(mask); ys=y[mask]; ps=pred[mask]
    dates=val["game_date"].reset_index(drop=True).iloc[idx].reset_index(drop=True)
    first=dates.dt.day.to_numpy()<=15; second=~first
    n1,n2=int(first.sum()),int(second.sum())
    if n1<INTERNAL_HALF_N_MIN or n2<INTERNAL_HALF_N_MIN:return None
    c=int((ys==ps).sum()); c1=int((ys[first]==ps[first]).sum()); c2=int((ys[second]==ps[second]).sum())
    a=c/n;a1=c1/n1;a2=c2/n2;worst=min(a1,a2)
    return {
      "mode":mode,"edge_threshold":threshold,"n":n,"correct":c,"accuracy":a,
      "first_half":{"n":n1,"correct":c1,"accuracy":a1},
      "second_half":{"n":n2,"correct":c2,"accuracy":a2},
      "worst_half_accuracy":worst,"min_half_n":min(n1,n2),
      "full_internal_accuracy_at_zero_margin":full_acc,
      "margin_mae":mae,"margin_rmse":rmse,
      "passes_internal_gate":a>=INTERNAL_ACC_MIN and worst>=INTERNAL_WORST_HALF_MIN,
    }

def fit_predict(train:pd.DataFrame,test:pd.DataFrame,features:list[str],params:dict[str,Any])->np.ndarray:
    xtr=feature_frame(train,features); xte=feature_frame(test,features)
    m=make_model(params)
    m.fit(xtr,train[Y].astype(float).to_numpy(),cat_features=CAT_FEATURES)
    return np.asarray(m.predict(xte),dtype=float)

def eval_pregate(selected:dict[str,Any],train_internal:pd.DataFrame,pregate:pd.DataFrame,features:list[str])->dict[str,Any]:
    pred_margin=fit_predict(train_internal,pregate,features,selected["params"])
    y_label=pregate[TARGET_LABEL].astype(int).to_numpy()
    mask,pred=selection(pred_margin,selected["mode"],selected["edge_threshold"])
    n=int(mask.sum())
    if n==0:return {"n":0,"correct":0,"accuracy":None,"passes_gate":False,"reason":"NO_SELECTIONS"}
    idx=np.flatnonzero(mask); ys=y_label[mask]; ps=pred[mask]
    dates=pregate["game_date"].reset_index(drop=True).iloc[idx].reset_index(drop=True)
    c=int((ys==ps).sum())
    months={};accs=[];ns=[]
    for month in ("2025-07","2025-08"):
      mm=dates.dt.strftime("%Y-%m").to_numpy()==month
      mn=int(mm.sum());mc=int((ys[mm]==ps[mm]).sum()) if mn else 0;ma=(mc/mn) if mn else None
      months[month]={"n":mn,"correct":mc,"accuracy":ma};ns.append(mn)
      if ma is not None:accs.append(ma)
    accuracy=c/n;worst=min(accs) if len(accs)==2 else 0.0;min_month_n=min(ns)
    actual_margin=pregate[Y].astype(float).to_numpy()
    return {
      "n":n,"correct":c,"accuracy":accuracy,"coverage":n/len(pregate),
      "worst_month_accuracy":worst,"min_month_n":min_month_n,"months":months,
      "passes_gate":n>=PREGATE_N_MIN and min_month_n>=PREGATE_MONTH_N_MIN and accuracy>=PREGATE_ACC_MIN and worst>=PREGATE_WORST_MONTH_MIN,
      "full_accuracy_at_zero_margin":float(accuracy_score(y_label,(pred_margin>=0).astype(int))),
      "margin_mae":float(mean_absolute_error(actual_margin,pred_margin)),
      "margin_rmse":float(mean_squared_error(actual_margin,pred_margin)**0.5),
    }

def main()->None:
    oidc=os.environ.get("GITHUB_OIDC_TOKEN","").strip()
    if not oidc:
      r=base_result("BLOCKED_MISSING_OIDC_EXPORT_AUTH");r["blocker"]="GitHub OIDC token is unavailable.";write_result(r);return
    apr_jun=fetch_range(oidc,"apr_jun")
    if len(apr_jun)!=1150:raise RuntimeError(f"V35_APR_JUN_COUNT_MISMATCH:{len(apr_jun)}")
    df=pd.DataFrame(apr_jun);df["game_date"]=pd.to_datetime(df["game_date"])
    if Y not in df.columns:raise RuntimeError("V35_TARGET_MISSING")
    features=sorted(c for c in df.columns if c not in META)
    if Y in features:raise RuntimeError("V35_TARGET_ENTERED_FEATURES")
    leaks=sorted((FORBIDDEN-{Y}).intersection(features))
    if leaks:raise RuntimeError("FORBIDDEN_FEATURES_PRESENT:"+",".join(leaks))
    train=df[(df.game_date>=TRAIN_START)&(df.game_date<INTERNAL_START)].copy()
    june=df[(df.game_date>=INTERNAL_START)&(df.game_date<PREGATE_START)].copy()
    if len(train)!=769 or len(june)!=381:raise RuntimeError(f"V35_SPLIT_COUNT_MISMATCH:{len(train)}:{len(june)}")
    yj=june[TARGET_LABEL].astype(int).to_numpy();actual_margin=june[Y].astype(float).to_numpy()
    all_gate=[];summaries=[]
    for idx,params in enumerate(model_specs()):
      pm=fit_predict(train,june,features,params)
      full_acc=float(accuracy_score(yj,(pm>=0).astype(int)))
      mae=float(mean_absolute_error(actual_margin,pm));rmse=float(mean_squared_error(actual_margin,pm)**0.5)
      candidates=[]
      for mode in MODES:
        for th in EDGE_THRESHOLDS:
          m=eval_internal(pm,june,mode,th,mae,rmse,full_acc)
          if m is None:continue
          c={"spec_index":idx,"params":params,**m};candidates.append(c)
          if m["passes_internal_gate"]:all_gate.append(c)
      candidates.sort(key=lambda c:(c["accuracy"],c["worst_half_accuracy"],c["n"],-c["margin_mae"]),reverse=True)
      summaries.append({
        "spec_index":idx,"params":params,"full_internal_accuracy_at_zero_margin":full_acc,
        "margin_mae":mae,"margin_rmse":rmse,
        "gate_pass_count":sum(1 for c in candidates if c["passes_internal_gate"]),
        "best_candidate":candidates[0] if candidates else None,
        "best_gate_candidate":next((c for c in candidates if c["passes_internal_gate"]),None),
      })
    all_gate.sort(key=lambda c:(c["accuracy"],c["worst_half_accuracy"],c["n"],-c["margin_mae"]),reverse=True)
    selected=all_gate[0] if all_gate else None
    result=base_result("INTERNAL_JUNE_GATE_PASSED_PREGATE_NOT_OPENED" if selected else "REJECTED_INTERNAL_JUNE_GATE")
    result.update({
      "model_family":"catboost_close_margin_regression","catboost_version":"1.2.10","seed":SEED,
      "feature_count":len(features),"categorical_features":CAT_FEATURES,
      "prediction_rule":"predicted close-margin sign determines over/under",
      "train_rows":len(train),"june_rows":len(june),"specs_tried":len(model_specs()),
      "threshold_modes":MODES,"edge_thresholds_runs":EDGE_THRESHOLDS,
      "internal_gate":{"accuracy_min":INTERNAL_ACC_MIN,"worst_half_accuracy_min":INTERNAL_WORST_HALF_MIN,"n_min":INTERNAL_N_MIN,"half_n_min":INTERNAL_HALF_N_MIN},
      "internal_gate_candidate_count":len(all_gate),"selected_candidate_before_pregate":selected,
      "spec_summaries":summaries,"jul_aug_status":"NOT_OPENED",
    })
    if selected is not None:
      ja=fetch_range(oidc,"jul_aug")
      if len(ja)!=741:raise RuntimeError(f"V35_JULAUG_COUNT_MISMATCH:{len(ja)}")
      pregate=pd.DataFrame(ja);pregate["game_date"]=pd.to_datetime(pregate["game_date"])
      metrics=eval_pregate(selected,df.copy(),pregate,features)
      result["jul_aug_opened"]=True;result["jul_aug_status"]="OPENED_ONCE_AFTER_INTERNAL_GATE";result["pregate_rows"]=len(pregate);result["pregate_metrics"]=metrics
      result["pregate_gate"]={"accuracy_min":PREGATE_ACC_MIN,"worst_month_accuracy_min":PREGATE_WORST_MONTH_MIN,"n_min":PREGATE_N_MIN,"month_n_min":PREGATE_MONTH_N_MIN}
      result["status"]="PASSED_JULAUG_VALIDATION_GATE_FROZEN_2026_NOT_OPENED" if metrics["passes_gate"] else "REJECTED_JULAUG_VALIDATION_GATE"
    write_result(result)
    print(json.dumps({"status":result["status"],"feature_count":result["feature_count"],"specs_tried":result["specs_tried"],"internal_gate_candidate_count":result["internal_gate_candidate_count"],"selected_candidate_before_pregate":result["selected_candidate_before_pregate"],"jul_aug_opened":result["jul_aug_opened"],"pregate_metrics":result.get("pregate_metrics")},indent=2,sort_keys=True))

if __name__=="__main__":main()
