#!/usr/bin/env python3
# Registered workflow trigger; research logic unchanged.
from __future__ import annotations

import json, os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
from catboost import CatBoostClassifier, CatBoostRegressor

SEED=20260919
EDGE_URL="https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-f7-3way-revisit-github-export-temp"
EDGE_CONTRACT="MLB_F7_3WAY_REVISIT_GITHUB_EXPORT/1.0.0"
PROTOCOL="MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0"
MAX_HIST_DATE=pd.Timestamp("2026-09-18")
FORWARD_MIN_DATE=pd.Timestamp("2026-09-20")
OUT=Path("artifacts/research/mlb_f7_3way_revisit_v1_result.json")
FREEZE=Path("artifacts/research/mlb_f7_3way_revisit_v1_frozen_candidate.json")

TARGET_ACC=0.75
MIN_N=60
MIN_MONTHS=5
MIN_WORST=0.65

LABEL_TO_INT={"AWAY":0,"DRAW":1,"HOME":2}
INT_TO_LABEL={v:k for k,v in LABEL_TO_INT.items()}

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

ALL_THRESHOLDS=[0.45,0.50,0.55,0.60,0.65,0.70,0.75,0.80]
SIDE_THRESHOLDS=[0.55,0.60,0.65,0.70,0.75,0.80,0.85]
DRAW_THRESHOLDS=[0.18,0.20,0.22,0.25,0.28,0.30,0.35,0.40]
MARGIN_THRESHOLDS=[0.50,0.75,1.00,1.50,2.00]
DRAW_MARGIN_MAX=[0.25,0.50,0.75]

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
        r=requests.post(EDGE_URL,headers={"x-github-oidc-token":token,"Content-Type":"application/json"},
                        json={"offset":offset,"limit":250},timeout=180)
        if not r.ok: raise RuntimeError(f"F7_3WAY_EXPORT_HTTP_{r.status_code}:{r.text[:500]}")
        p=r.json()
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
        if bad: raise RuntimeError("F7_3WAY_EXPORT_INVALID:"+",".join(bad))
        if expected is None: expected=int(p["totalRows"])
        if int(p["totalRows"])!=expected: raise RuntimeError("F7_3WAY_EXPORT_TOTAL_CHANGED")
        batch=p.get("rows") or []
        rows.extend(batch);offset+=len(batch)
        if not batch or offset>=expected: break
    if expected is None or len(rows)!=expected: raise RuntimeError("F7_3WAY_EXPORT_COUNT")
    return rows

def build_frame(rows:list[dict[str,Any]])->pd.DataFrame:
    flat=[]
    for r in rows:
        p=dict(r.get("payload") or {})
        if "actual_winner" in p or any(k.startswith(BLOCK_PREFIXES) for k in p):
            raise RuntimeError("F7_3WAY_POSTGAME_KEY")
        if r.get("home_f7") is None or r.get("away_f7") is None:
            raise RuntimeError("F7_3WAY_MISSING_SCORE")
        y=str(r["y_class"])
        if y not in LABEL_TO_INT: raise RuntimeError("F7_3WAY_BAD_LABEL:"+y)
        d=p
        d["_season"]=int(r["season"]); d["_game_pk"]=int(r["game_pk"]); d["_game_date"]=r["game_date"]
        d["_home_f7"]=int(r["home_f7"]); d["_away_f7"]=int(r["away_f7"]); d["_y"]=LABEL_TO_INT[y]
        d["_label"]=y; d["_development_class"]=r["development_class"]; d["_research_only"]=r["research_only"]
        flat.append(d)
    df=pd.DataFrame(flat); df["_game_date"]=pd.to_datetime(df["_game_date"])
    if (df["_game_date"]>MAX_HIST_DATE).any(): raise RuntimeError("F7_3WAY_CUTOFF")
    if (df["_game_date"]==pd.Timestamp("2026-09-19")).any(): raise RuntimeError("F7_3WAY_QUARANTINE")
    if (df["_game_date"]>=FORWARD_MIN_DATE).any(): raise RuntimeError("F7_3WAY_FORWARD")
    if not (df["_development_class"]=="HISTORICAL_SEEN_DEVELOPMENT").all(): raise RuntimeError("F7_3WAY_CLASS")
    if not df["_research_only"].fillna(False).astype(bool).all(): raise RuntimeError("F7_3WAY_RESEARCH")
    cutoff=pd.to_datetime(df.get("feature_cutoff_date"),errors="coerce")
    if cutoff.notna().any() and (cutoff>=df["_game_date"]).any(): raise RuntimeError("F7_3WAY_STRICT_PRIOR")
    return df.sort_values(["_game_date","_game_pk"]).reset_index(drop=True)

def feature_matrix(df:pd.DataFrame):
    meta={c for c in df.columns if c.startswith("_")}
    candidates=[c for c in df.columns if c not in meta and c not in BLOCK_EXACT
                and not c.startswith(BLOCK_PREFIXES) and not c.startswith("source_")
                and not c.endswith("_id") and "actual" not in c.lower()]
    nums=[];cats=[];dropped=[]
    for c in candidates:
        if c in CATEGORICAL_CANDIDATES:
            if df[c].notna().mean()>=0.20: cats.append(c)
            else: dropped.append(c)
            continue
        s=pd.to_numeric(df[c],errors="coerce")
        if s.notna().mean()>=0.25: nums.append(c)
        else: dropped.append(c)
    x=pd.DataFrame(index=df.index)
    for c in nums:x[c]=pd.to_numeric(df[c],errors="coerce")
    for c in cats:x[c]=df[c].where(df[c].notna(),"__MISSING__").astype(str)
    return x,sorted(nums),sorted(cats),sorted(dropped)

def clf(params,off):
    return CatBoostClassifier(random_seed=SEED+off,loss_function="MultiClass",eval_metric="MultiClass",
      verbose=False,allow_writing_files=False,thread_count=-1,**params)

def reg(params,off):
    return CatBoostRegressor(random_seed=SEED+100+off,loss_function="RMSE",eval_metric="RMSE",
      verbose=False,allow_writing_files=False,thread_count=-1,**params)

def summarize(oof,mask,pred,config):
    z=oof.loc[mask].copy()
    if z.empty:return None
    z["pred"]=np.asarray(pred)[mask].astype(int) if not np.isscalar(pred) else int(pred)
    z["correct"]=(z["pred"].astype(int)==z["truth"].astype(int)).astype(int)
    monthly={}
    for month,g in z.groupby("month",sort=True):
        monthly[month]={"n":int(len(g)),"correct":int(g.correct.sum()),"accuracy":float(g.correct.mean())}
    n=len(z);correct=int(z.correct.sum());acc=correct/n
    months=len(monthly);worst=min(v["accuracy"] for v in monthly.values())
    base=float(oof.truth.value_counts(normalize=True).max())
    gate=n>=MIN_N and months>=MIN_MONTHS and worst>=MIN_WORST
    return {**config,"n":int(n),"correct":correct,"accuracy":acc,"coverage_vs_oof":n/len(oof),
      "months_with_selections":months,"min_month_n":min(v["n"] for v in monthly.values()),
      "worst_month_accuracy":worst,"monthly_accuracy_sd":float(np.std([v["accuracy"] for v in monthly.values()])),
      "monthly":monthly,"unconditional_majority_baseline":base,"lift_vs_unconditional_majority":acc-base,
      "sample_stability_gate_met":gate,"target_met_75_plus":bool(gate and acc>=TARGET_ACC)}

def rank_key(c):
    return (1 if c["target_met_75_plus"] else 0,1 if c["sample_stability_gate_met"] else 0,
            c["worst_month_accuracy"],c["accuracy"],c["min_month_n"],c["n"])

def main():
    token=os.environ.get("GITHUB_OIDC_TOKEN","").strip()
    if not token: raise RuntimeError("F7_3WAY_OIDC_MISSING")
    df=build_frame(fetch_rows(token)); x,nums,cats,dropped=feature_matrix(df)
    oof_rows=[];fold_meta=[]
    for month,ss,es in FOLDS:
        start=pd.Timestamp(ss);end=pd.Timestamp(es)
        tr=df["_game_date"]<start; va=(df["_game_date"]>=start)&(df["_game_date"]<end)
        if tr.sum()<400 or va.sum()<50: raise RuntimeError(f"F7_3WAY_SMALL_FOLD:{month}:{tr.sum()}:{va.sum()}")
        xv=x.loc[va]; probs=np.zeros((int(va.sum()),3),float); pm=np.zeros(int(va.sum()),float)
        for si,params in enumerate(SPECS):
            m=clf(params,si); m.fit(x.loc[tr],df.loc[tr,"_y"].to_numpy(int),cat_features=cats)
            pp=np.asarray(m.predict_proba(xv),float)
            classes=[int(v) for v in m.classes_]
            aligned=np.zeros_like(probs)
            for j,cls in enumerate(classes): aligned[:,cls]=pp[:,j]
            probs+=aligned/len(SPECS)
            rm=reg(params,si); ymargin=(df.loc[tr,"_home_f7"]-df.loc[tr,"_away_f7"]).astype(float).to_numpy()
            rm.fit(x.loc[tr],ymargin,cat_features=cats); pm+=np.asarray(rm.predict(xv),float)/len(SPECS)
        v=df.loc[va].reset_index(drop=True)
        for i in range(len(v)):
            oof_rows.append({"month":month,"season":int(v.loc[i,"_season"]),"game_pk":int(v.loc[i,"_game_pk"]),
              "game_date":str(v.loc[i,"_game_date"].date()),"truth":int(v.loc[i,"_y"]),
              "p_away":float(probs[i,0]),"p_draw":float(probs[i,1]),"p_home":float(probs[i,2]),
              "pred_margin":float(pm[i]),
              "home_sp_ra9":None if pd.isna(v.loc[i].get("home_sp_ra9")) else float(v.loc[i].get("home_sp_ra9")),
              "away_sp_ra9":None if pd.isna(v.loc[i].get("away_sp_ra9")) else float(v.loc[i].get("away_sp_ra9")),
              "home_win_pct":None if pd.isna(v.loc[i].get("home_win_pct")) else float(v.loc[i].get("home_win_pct")),
              "away_win_pct":None if pd.isna(v.loc[i].get("away_win_pct")) else float(v.loc[i].get("away_win_pct"))})
        fold_meta.append({"month":month,"train_n":int(tr.sum()),"validation_n":int(va.sum()),
          "train_end":str(df.loc[tr,"_game_date"].max().date())})
    oof=pd.DataFrame(oof_rows)
    pmat=oof[["p_away","p_draw","p_home"]].to_numpy(float); arg=pmat.argmax(axis=1); conf=pmat.max(axis=1)
    pm=oof.pred_margin.to_numpy(float); candidates=[]

    # Original stable two-sided fallback benchmark (DRAW counts as incorrect).
    hsp=pd.to_numeric(oof.home_sp_ra9,errors="coerce").to_numpy(float)
    asp=pd.to_numeric(oof.away_sp_ra9,errors="coerce").to_numpy(float)
    hw=pd.to_numeric(oof.home_win_pct,errors="coerce").to_numpy(float)
    aw=pd.to_numeric(oof.away_win_pct,errors="coerce").to_numpy(float)
    spadv=asp-hsp; winadv=hw-aw
    finite=np.isfinite(spadv)&np.isfinite(winadv)
    home=finite&(spadv>=2.0)&(winadv>=0.20); away=finite&(spadv<=-2.0)&(winadv<=-0.20)
    mask=home|away; pred=np.where(home,2,0)
    s=summarize(oof,mask,pred,{"architecture":"legacy_f7_3way_two_sided","mode":"side_only",
      "probability_threshold":None,"margin_threshold":None}); 
    if s:candidates.append(s)

    for t in ALL_THRESHOLDS:
        mask=conf>=t
        s=summarize(oof,mask,arg,{"architecture":"catboost_multiclass","mode":"all_classes",
          "probability_threshold":t,"margin_threshold":None})
        if s:candidates.append(s)

    for t in SIDE_THRESHOLDS:
        side=(arg!=1)&(conf>=t)
        s=summarize(oof,side,arg,{"architecture":"catboost_multiclass","mode":"side_only",
          "probability_threshold":t,"margin_threshold":None})
        if s:candidates.append(s)
        for mt in MARGIN_THRESHOLDS:
            margin_side=np.where(pm>0,2,0)
            agree=(arg==margin_side)
            mask=side&agree&(np.abs(pm)>=mt)
            s=summarize(oof,mask,arg,{"architecture":"catboost_side_margin_agreement","mode":"side_only",
              "probability_threshold":t,"margin_threshold":mt})
            if s:candidates.append(s)

    for t in DRAW_THRESHOLDS:
        for mt in DRAW_MARGIN_MAX:
            mask=(pmat[:,1]>=t)&(np.abs(pm)<=mt)
            s=summarize(oof,mask,1,{"architecture":"catboost_draw_margin_agreement","mode":"draw_only",
              "probability_threshold":t,"margin_threshold":mt})
            if s:candidates.append(s)

    sample=[c for c in candidates if c["n"]>=MIN_N and c["months_with_selections"]>=MIN_MONTHS]
    if not sample: raise RuntimeError("F7_3WAY_NO_SAMPLE_CANDIDATE")
    sample.sort(key=rank_key,reverse=True); selected=sample[0]; target=bool(selected["target_met_75_plus"])
    high=sorted(sample,key=lambda c:(c["accuracy"],c["worst_month_accuracy"],c["n"]),reverse=True)[:20]
    result={"contract":"MLB_F7_3WAY_REVISIT_V1_RESULT/1.0.0","protocol":PROTOCOL,"research_only":True,
      "development_class":"HISTORICAL_SEEN_DEVELOPMENT","historical_max_allowed_game_date":"2026-09-18",
      "actual_max_game_date_used":str(df["_game_date"].max().date()),"source_rows":len(df),
      "source_rows_by_season":{str(k):int(v) for k,v in df.groupby("_season").size().items()},
      "class_counts":{INT_TO_LABEL[int(k)]:int(v) for k,v in df["_y"].value_counts().items()},
      "oof_rows":len(oof),"folds":fold_meta,"architecture_family":"pregame_catboost_multiclass_margin_f7_3way_v1",
      "numeric_feature_count":len(nums),"categorical_feature_count":len(cats),"numeric_features":nums,
      "categorical_features":cats,"dropped_fields":dropped,"specs":SPECS,"selected_candidate":selected,
      "highest_accuracy_sample_candidates":high,"target_met_75_plus":target,
      "market_closeout_state":"TARGET_MET_75_PLUS_FREEZE_READY" if target else "REVISIT_SECOND_PASS_BELOW_75",
      "forward_2026_09_20_plus_opened":False,"forward_used_for_selection":False,"quarantine_2026_09_19_used":False,
      "odds_api_calls_made":0,"odds_api_historical_credits_consumed":0,"official_picks_writes":0,
      "apostar_activation":False,"production_promotion":False,"github_sha_at_run":os.environ.get("GITHUB_SHA")}
    freeze={"contract":"MLB_F7_3WAY_REVISIT_V1_FROZEN_CANDIDATE/1.0.0","protocol":PROTOCOL,"research_only":True,
      "frozen":target,"forward_eligible":target,"candidate":selected,"architecture_family":result["architecture_family"],
      "numeric_features":nums if target else [],"categorical_features":cats if target else [],"specs":SPECS if target else [],
      "historical_max_allowed_game_date":"2026-09-18","actual_max_game_date_used":result["actual_max_game_date_used"],
      "forward_min_game_date":"2026-09-20","forward_outcomes_opened":False,
      "reason":"Historical rolling F7 3-way gate met before forward window." if target else "75% F7 3-way revisit gate not met; no forward candidate activated.",
      "odds_api_historical_credits_consumed":0,"official_picks_writes":0,"apostar_activation":False,
      "production_promotion":False,"github_sha_at_freeze":os.environ.get("GITHUB_SHA") if target else None}
    OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    FREEZE.write_text(json.dumps(freeze,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"state":result["market_closeout_state"],"source_rows":len(df),"oof":len(oof),"selected":selected},indent=2))

if __name__=="__main__": main()
