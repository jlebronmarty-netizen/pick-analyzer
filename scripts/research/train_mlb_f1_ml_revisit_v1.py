#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
from catboost import CatBoostClassifier, CatBoostRegressor

SEED=20260919
EDGE_URL="https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-f1-ml-revisit-github-export-temp"
EDGE_CONTRACT="MLB_F1_ML_REVISIT_GITHUB_EXPORT/1.0.0"
PROTOCOL="MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0"
MAX_HIST_DATE=pd.Timestamp("2026-09-18")
FORWARD_MIN_DATE=pd.Timestamp("2026-09-20")

OUT=Path("artifacts/research/mlb_f1_ml_revisit_v1_result.json")
FREEZE=Path("artifacts/research/mlb_f1_ml_revisit_v1_frozen_candidate.json")

TARGET_ACC=0.75
MIN_N=60
MIN_MONTHS=5
MIN_WORST=0.65
LEGACY_THRESHOLD=0.267999190778826

FOLDS=[
 ("2025-05","2025-05-01","2025-06-01"),
 ("2025-06","2025-06-01","2025-07-01"),
 ("2025-07","2025-07-01","2025-08-01"),
 ("2025-08","2025-08-01","2025-09-01"),
 ("2025-09","2025-09-01","2025-10-01"),
 ("2026-04","2026-04-01","2026-05-01"),
 ("2026-05","2026-05-01","2026-06-01"),
 ("2026-06","2026-06-01","2026-07-01"),
 ("2026-07","2026-07-01","2026-08-01"),
 ("2026-08","2026-08-01","2026-09-01"),
 ("2026-09","2026-09-01","2026-10-01"),
]

SPECS=[
 {"depth":4,"iterations":350,"learning_rate":0.035,"l2_leaf_reg":7.0,"random_strength":1.0},
 {"depth":6,"iterations":350,"learning_rate":0.035,"l2_leaf_reg":7.0,"random_strength":1.0},
]

PROB_THRESHOLDS=[0.58,0.60,0.625,0.65,0.675,0.70,0.725,0.75,0.775,0.80,0.825,0.85,0.875,0.90]
MARGIN_THRESHOLDS=[0.50,0.75,1.00,1.25,1.50,2.00,2.50,3.00]

BLOCK_EXACT={
 "canonical_game_id","source_game_id","feature_cutoff_date","feature_version",
 "actual_winner","current_inputs_reconstructed","data_completeness_pct","pregame_integrity_tier",
 "has_statcast","has_lineup","has_starters","has_weather","has_umpire","has_odds",
 "home_ml_close","away_ml_close","no_vig_home_prob_close","no_vig_away_prob_close",
}
BLOCK_PREFIXES=("actual_","postgame_","final_")
CATEGORICAL_CANDIDATES={
 "home_team","away_team","day_night","home_sp_hand","away_sp_hand","venue",
 "wind_direction","precip","sky","roof_status",
 "home_sp_primary_pitch","home_sp_secondary_pitch","away_sp_primary_pitch","away_sp_secondary_pitch"
}

def fetch_rows(token:str)->list[dict[str,Any]]:
    rows=[];offset=0;expected=None
    while True:
        resp=requests.post(
          EDGE_URL,
          headers={"x-github-oidc-token":token,"Content-Type":"application/json"},
          json={"offset":offset,"limit":250},
          timeout=180,
        )
        if not resp.ok:
            raise RuntimeError(f"F1_EXPORT_HTTP_{resp.status_code}:{resp.text[:800]}")
        p=resp.json()
        checks=[
          (p.get("contract")==EDGE_CONTRACT,"contract"),
          (p.get("researchOnly") is True,"research"),
          (p.get("historicalMaxGameDate")=="2026-09-18","cutoff"),
          (p.get("forwardIncluded") is False,"forward"),
          (p.get("oddsApiHistoricalCreditsConsumed")==0,"credits"),
          (p.get("officialPicksWrites")==0,"official"),
          (p.get("apostarActivation") is False,"apostar"),
          (p.get("productionPromotion") is False,"production"),
        ]
        bad=[n for ok,n in checks if not ok]
        if bad: raise RuntimeError("F1_EXPORT_INVALID:"+",".join(bad))
        if expected is None: expected=int(p["totalRows"])
        if int(p["totalRows"])!=expected: raise RuntimeError("F1_EXPORT_TOTAL_CHANGED")
        batch=p.get("rows") or []
        rows.extend(batch);offset+=len(batch)
        if not batch or offset>=expected: break
    if expected is None or len(rows)!=expected:
        raise RuntimeError(f"F1_EXPORT_COUNT:{len(rows)}:{expected}")
    return rows

def build_frame(rows:list[dict[str,Any]])->tuple[pd.DataFrame,int]:
    flat=[]
    missing_target_rows=0
    for r in rows:
        if r.get("home_f1") is None or r.get("away_f1") is None:
            missing_target_rows+=1
            continue
        p=dict(r.get("payload") or {})
        if "actual_winner" in p or any(k.startswith(BLOCK_PREFIXES) for k in p):
            raise RuntimeError("F1_POSTGAME_KEY_IN_PAYLOAD")
        d=p
        d["_season"]=int(r["season"])
        d["_game_pk"]=int(r["game_pk"])
        d["_game_date"]=r["game_date"]
        d["_home_f1"]=int(r["home_f1"])
        d["_away_f1"]=int(r["away_f1"])
        d["_y_home"]=r["y_home"]
        d["_outcome_lineage"]=r["outcome_lineage"]
        d["_development_class"]=r["development_class"]
        d["_research_only"]=r["research_only"]
        flat.append(d)
    df=pd.DataFrame(flat)
    df["_game_date"]=pd.to_datetime(df["_game_date"])
    if (df["_game_date"]>MAX_HIST_DATE).any(): raise RuntimeError("F1_HIST_CUTOFF_BREACH")
    if (df["_game_date"]==pd.Timestamp("2026-09-19")).any(): raise RuntimeError("F1_QUARANTINE_BREACH")
    if (df["_game_date"]>=FORWARD_MIN_DATE).any(): raise RuntimeError("F1_FORWARD_BREACH")
    if not (df["_development_class"]=="HISTORICAL_SEEN_DEVELOPMENT").all():
        raise RuntimeError("F1_CLASS_BREACH")
    if not df["_research_only"].fillna(False).astype(bool).all():
        raise RuntimeError("F1_RESEARCH_BREACH")
    cutoff=pd.to_datetime(df.get("feature_cutoff_date"),errors="coerce")
    if cutoff.notna().any() and (cutoff>=df["_game_date"]).any():
        raise RuntimeError("F1_STRICT_PRIOR_BREACH")
    return df.sort_values(["_game_date","_game_pk"]).reset_index(drop=True),missing_target_rows

def choose_features(df:pd.DataFrame)->tuple[pd.DataFrame,list[str],list[str],list[str]]:
    meta={c for c in df.columns if c.startswith("_")}
    candidates=[
      c for c in df.columns
      if c not in meta
      and c not in BLOCK_EXACT
      and not c.startswith(BLOCK_PREFIXES)
      and not c.startswith("source_")
      and not c.endswith("_id")
      and "actual" not in c.lower()
    ]
    nums=[];cats=[];dropped=[]
    for c in candidates:
        if c in CATEGORICAL_CANDIDATES:
            if df[c].notna().mean()>=0.20:
                cats.append(c)
            else:dropped.append(c)
            continue
        s=pd.to_numeric(df[c],errors="coerce")
        if s.notna().mean()>=0.25:
            nums.append(c)
        else:
            dropped.append(c)
    x=pd.DataFrame(index=df.index)
    for c in nums:x[c]=pd.to_numeric(df[c],errors="coerce")
    for c in cats:x[c]=df[c].where(df[c].notna(),"__MISSING__").astype(str)
    return x,sorted(nums),sorted(cats),sorted(dropped)

def model(params:dict[str,Any],offset:int)->CatBoostClassifier:
    return CatBoostClassifier(
      random_seed=SEED+offset,
      loss_function="Logloss",eval_metric="Logloss",
      verbose=False,allow_writing_files=False,thread_count=-1,
      **params
    )

def reg_model(params:dict[str,Any],offset:int)->CatBoostRegressor:
    return CatBoostRegressor(
      random_seed=SEED+100+offset,
      loss_function="RMSE",eval_metric="RMSE",
      verbose=False,allow_writing_files=False,thread_count=-1,
      **params
    )

def summarize(oof:pd.DataFrame,mask:np.ndarray,pred:np.ndarray|int,config:dict[str,Any])->dict[str,Any]|None:
    selected=oof.loc[mask].copy()
    if selected.empty:return None
    selected["pred"]=int(pred) if np.isscalar(pred) else np.asarray(pred)[mask].astype(int)
    pushes=int(selected["truth"].isna().sum())
    z=selected[selected["truth"].notna()].copy()
    if z.empty:return None
    z["truth"]=z["truth"].astype(int)
    z["correct"]=(z["pred"].astype(int)==z["truth"]).astype(int)
    monthly={}
    for month,g in z.groupby("month",sort=True):
        monthly[month]={
          "n":int(len(g)),"correct":int(g.correct.sum()),"accuracy":float(g.correct.mean()),
          "pushes":int(selected[(selected.month==month)&selected.truth.isna()].shape[0])
        }
    n=len(z);correct=int(z.correct.sum());acc=correct/n
    months=len(monthly);worst=min(v["accuracy"] for v in monthly.values())
    all_nonpush=oof[oof.truth.notna()]
    home_rate=float(all_nonpush.truth.astype(int).mean())
    majority=max(home_rate,1-home_rate)
    sample_gate=n>=MIN_N and months>=MIN_MONTHS
    stability_gate=sample_gate and worst>=MIN_WORST
    return {
      **config,
      "selected_total":int(len(selected)),
      "n":int(n),"pushes":pushes,"correct":correct,"accuracy":acc,
      "coverage_vs_oof_all":len(selected)/len(oof),
      "coverage_vs_oof_nonpush":n/len(all_nonpush),
      "months_with_selections":months,
      "min_month_n":min(v["n"] for v in monthly.values()),
      "worst_month_accuracy":worst,
      "monthly_accuracy_sd":float(np.std([v["accuracy"] for v in monthly.values()])),
      "monthly":monthly,
      "unconditional_majority_baseline":majority,
      "lift_vs_unconditional_majority":acc-majority,
      "sample_gate_met":sample_gate,
      "sample_stability_gate_met":stability_gate,
      "target_met_75_plus":bool(stability_gate and acc>=TARGET_ACC)
    }

def rank_key(c:dict[str,Any])->tuple:
    return (
      1 if c["target_met_75_plus"] else 0,
      1 if c["sample_stability_gate_met"] else 0,
      c["worst_month_accuracy"],
      c["accuracy"],
      c["min_month_n"],
      c["n"]
    )

def main():
    token=os.environ.get("GITHUB_OIDC_TOKEN","").strip()
    if not token: raise RuntimeError("F1_REVISIT_OIDC_MISSING")
    raw_rows=fetch_rows(token)
    df,missing_target_rows=build_frame(raw_rows)
    x,nums,cats,dropped=choose_features(df)

    oof_rows=[];fold_meta=[]
    for month,start_s,end_s in FOLDS:
        start=pd.Timestamp(start_s);end=pd.Timestamp(end_s)
        tr=(df["_game_date"]<start)&df["_y_home"].notna()
        tr_reg=df["_game_date"]<start
        va=(df["_game_date"]>=start)&(df["_game_date"]<end)
        if tr.sum()<180 or tr_reg.sum()<400 or va.sum()<50:
            raise RuntimeError(f"F1_SMALL_FOLD:{month}:{tr.sum()}:{tr_reg.sum()}:{va.sum()}")
        p=np.zeros(int(va.sum()),float)
        pred_margin=np.zeros(int(va.sum()),float)
        xv=x.loc[va]
        for si,params in enumerate(SPECS):
            m=model(params,si)
            m.fit(x.loc[tr],df.loc[tr,"_y_home"].astype(int).to_numpy(),cat_features=cats)
            p+=np.asarray(m.predict_proba(xv)[:,1],float)/len(SPECS)
            rm=reg_model(params,si)
            y_margin=(df.loc[tr_reg,"_home_f1"]-df.loc[tr_reg,"_away_f1"]).astype(float).to_numpy()
            rm.fit(x.loc[tr_reg],y_margin,cat_features=cats)
            pred_margin+=np.asarray(rm.predict(xv),float)/len(SPECS)
        v=df.loc[va].reset_index(drop=True)
        for i in range(len(v)):
            oof_rows.append({
              "month":month,"season":int(v.loc[i,"_season"]),
              "game_pk":int(v.loc[i,"_game_pk"]),"game_date":str(v.loc[i,"_game_date"].date()),
              "truth":None if pd.isna(v.loc[i,"_y_home"]) else int(v.loc[i,"_y_home"]),
              "p_home":float(p[i]),
              "pred_margin":float(pred_margin[i]),
              "home_win_pct":None if pd.isna(v.loc[i].get("home_win_pct")) else float(v.loc[i].get("home_win_pct")),
              "away_win_pct":None if pd.isna(v.loc[i].get("away_win_pct")) else float(v.loc[i].get("away_win_pct")),
              "home_sp_ra9":None if pd.isna(v.loc[i].get("home_sp_ra9")) else float(v.loc[i].get("home_sp_ra9")),
              "away_sp_ra9":None if pd.isna(v.loc[i].get("away_sp_ra9")) else float(v.loc[i].get("away_sp_ra9")),
              "home_off_ops_proxy":None if pd.isna(v.loc[i].get("home_off_ops_proxy")) else float(v.loc[i].get("home_off_ops_proxy")),
              "away_off_ops_proxy":None if pd.isna(v.loc[i].get("away_off_ops_proxy")) else float(v.loc[i].get("away_off_ops_proxy")),
            })
        fold_meta.append({
          "month":month,"train_nonpush_n":int(tr.sum()),"train_margin_n":int(tr_reg.sum()),"validation_all_n":int(va.sum()),
          "validation_nonpush_n":int(df.loc[va,"_y_home"].notna().sum()),
          "validation_pushes":int(df.loc[va,"_y_home"].isna().sum()),
          "train_end":str(df.loc[tr,"_game_date"].max().date())
        })

    oof=pd.DataFrame(oof_rows)
    p=oof.p_home.to_numpy(float)
    pm=oof.pred_margin.to_numpy(float)
    candidates=[]

    # Original first-pass rule benchmark on unified OOF.
    hrd=pd.to_numeric(oof.home_win_pct,errors="coerce").to_numpy(float)
    ard=pd.to_numeric(oof.away_win_pct,errors="coerce").to_numpy(float)
    adv=hrd-ard
    legacy_mask=np.isfinite(adv)&(np.abs(adv)>=LEGACY_THRESHOLD)
    legacy_pred=(adv>0).astype(int)
    s=summarize(oof,legacy_mask,legacy_pred,{
      "architecture":"legacy_win_pct_q95","mode":"symmetric",
      "probability_threshold":None,"legacy_absolute_advantage":LEGACY_THRESHOLD
    })
    if s:candidates.append(s)

    # Original stable F1 composite fallback benchmark.
    h_sp=pd.to_numeric(oof.home_sp_ra9,errors="coerce").to_numpy(float)
    a_sp=pd.to_numeric(oof.away_sp_ra9,errors="coerce").to_numpy(float)
    h_ops=pd.to_numeric(oof.home_off_ops_proxy,errors="coerce").to_numpy(float)
    a_ops=pd.to_numeric(oof.away_off_ops_proxy,errors="coerce").to_numpy(float)
    win_adv=adv
    sp_adv=a_sp-h_sp
    ops_adv=h_ops-a_ops
    finite=np.isfinite(sp_adv)&np.isfinite(ops_adv)&np.isfinite(win_adv)
    home_comp=finite&(sp_adv>=1.0)&(ops_adv>=0.0)&(win_adv>=0.20)
    away_comp=finite&(sp_adv<=-1.0)&(ops_adv<=0.0)&(win_adv<=-0.20)
    comp_mask=home_comp|away_comp
    comp_pred=np.where(home_comp,1,0)
    s=summarize(oof,comp_mask,comp_pred,{
      "architecture":"legacy_f1_composite",
      "mode":"symmetric","probability_threshold":None,
      "predicted_margin_threshold":None,
      "legacy_absolute_advantage":None
    })
    if s:candidates.append(s)

    for t in PROB_THRESHOLDS:
        home=p>=t
        away=p<=1.0-t
        sym=home|away
        pred=(p>=0.5).astype(int)
        for mask,mode,prediction in [
          (sym,"symmetric",pred),
          (home,"home_only",1),
          (away,"away_only",0),
        ]:
            s=summarize(oof,mask,prediction,{
              "architecture":"catboost_probability",
              "mode":mode,"probability_threshold":t,
              "legacy_absolute_advantage":None
            })
            if s:candidates.append(s)

        # Agreement with prior win-pct sign, but no threshold rescue from the old q95.
        run_sign=np.isfinite(adv)&(adv!=0)
        agree=run_sign&(pred==(adv>0).astype(int))
        s=summarize(oof,sym&agree,pred,{
          "architecture":"catboost_win_pct_sign_agreement",
          "mode":"symmetric","probability_threshold":t,
          "legacy_absolute_advantage":None
        })
        if s:candidates.append(s)

    # F1 run-margin regression: a materially different architecture from the first pass.
    for mt in MARGIN_THRESHOLDS:
        mask=np.isfinite(pm)&(np.abs(pm)>=mt)
        pred=(pm>0).astype(int)
        s=summarize(oof,mask,pred,{
          "architecture":"catboost_f1_margin_regression",
          "mode":"symmetric","probability_threshold":None,
          "predicted_margin_threshold":mt,
          "legacy_absolute_advantage":None
        })
        if s:candidates.append(s)

        for t in PROB_THRESHOLDS:
            confident=(p>=t)|(p<=1.0-t)
            clf_pred=(p>=0.5).astype(int)
            agree=clf_pred==pred
            s=summarize(oof,mask&confident&agree,pred,{
              "architecture":"catboost_classifier_margin_agreement",
              "mode":"symmetric","probability_threshold":t,
              "predicted_margin_threshold":mt,
              "legacy_absolute_advantage":None
            })
            if s:candidates.append(s)

    sample_eligible=[c for c in candidates if c["sample_gate_met"]]
    if not sample_eligible:raise RuntimeError("F1_NO_SAMPLE_ELIGIBLE_CANDIDATE")
    sample_eligible.sort(key=rank_key,reverse=True)
    selected=sample_eligible[0]
    target=bool(selected["target_met_75_plus"])
    high_acc=sorted(sample_eligible,key=lambda c:(c["accuracy"],c["worst_month_accuracy"],c["n"]),reverse=True)[:20]

    result={
      "contract":"MLB_F1_ML_REVISIT_V1_RESULT/1.0.0",
      "protocol":PROTOCOL,"research_only":True,
      "development_class":"HISTORICAL_SEEN_DEVELOPMENT",
      "historical_max_allowed_game_date":"2026-09-18",
      "actual_max_game_date_used":str(df["_game_date"].max().date()),
      "raw_source_rows":len(raw_rows),
      "source_rows":len(df),
      "missing_target_rows_excluded_fail_closed":missing_target_rows,
      "source_rows_by_season":{str(k):int(v) for k,v in df.groupby("_season").size().items()},
      "pushes_by_season":{str(k):int(v) for k,v in df.groupby("_season")["_y_home"].apply(lambda s:s.isna().sum()).items()},
      "oof_rows":len(oof),"oof_nonpush_rows":int(oof.truth.notna().sum()),
      "folds":fold_meta,
      "architecture_family":"pregame_catboost_classifier_margin_f1_moneyline_v1",
      "numeric_feature_count":len(nums),"categorical_feature_count":len(cats),
      "numeric_features":nums,"categorical_features":cats,"dropped_fields":dropped,
      "specs":SPECS,
      "selected_candidate":selected,
      "highest_accuracy_stable_candidates":high_acc,
      "target_met_75_plus":target,
      "market_closeout_state":"TARGET_MET_75_PLUS_FREEZE_READY" if target else "REVISIT_SECOND_PASS_BELOW_75",
      "forward_2026_09_20_plus_opened":False,
      "forward_used_for_selection":False,
      "quarantine_2026_09_19_used":False,
      "odds_api_calls_made":0,"odds_api_historical_credits_consumed":0,
      "official_picks_writes":0,"apostar_activation":False,"production_promotion":False,
      "github_sha_at_run":os.environ.get("GITHUB_SHA")
    }
    freeze={
      "contract":"MLB_F1_ML_REVISIT_V1_FROZEN_CANDIDATE/1.0.0",
      "protocol":PROTOCOL,"research_only":True,
      "frozen":target,"forward_eligible":target,
      "candidate":selected,
      "architecture_family":result["architecture_family"],
      "numeric_features":nums if target else [],
      "categorical_features":cats if target else [],
      "specs":SPECS if target else [],
      "historical_max_allowed_game_date":"2026-09-18",
      "actual_max_game_date_used":result["actual_max_game_date_used"],
      "forward_min_game_date":"2026-09-20","forward_outcomes_opened":False,
      "reason":"Historical rolling F1 gate met before forward window." if target else "75% F1 revisit gate not met; no forward candidate activated.",
      "odds_api_historical_credits_consumed":0,
      "official_picks_writes":0,"apostar_activation":False,"production_promotion":False,
      "github_sha_at_freeze":os.environ.get("GITHUB_SHA") if target else None
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    FREEZE.write_text(json.dumps(freeze,indent=2,sort_keys=True)+"\n")
    print(json.dumps({
      "state":result["market_closeout_state"],"source_rows":len(df),
      "oof":len(oof),"features":len(nums)+len(cats),"selected":selected
    },indent=2))

if __name__=="__main__":
    main()
