#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
from catboost import CatBoostClassifier, Pool

SEED=20260919
EDGE_URL="https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-pitcher-win-forward-compat-github-export-temp"
EDGE_CONTRACT="MLB_PITCHER_WIN_FORWARD_COMPAT_GITHUB_EXPORT/1.0.0"
PROTOCOL="MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0"
MAX_HIST_DATE=pd.Timestamp("2026-09-18")
FORWARD_MIN_DATE=pd.Timestamp("2026-09-20")

OUT=Path("artifacts/research/mlb_pitcher_win_forward_numeric_v1_result.json")
FREEZE=Path("artifacts/research/mlb_pitcher_win_forward_numeric_v1_frozen_candidate.json")
DECISIONS=Path("artifacts/research/mlb_pitcher_win_forward_numeric_2026_decisions_v1.json")
GOLDEN=Path("artifacts/research/mlb_pitcher_win_forward_numeric_v1_golden.json")
MODEL_DIR=Path("python_models")

TARGET_ACC=0.75
MIN_N=60
MIN_MONTHS=5
MIN_WORST=0.65

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
 {"depth":3,"iterations":300,"learning_rate":0.035,"l2_leaf_reg":8.0,"random_strength":1.0},
 {"depth":5,"iterations":300,"learning_rate":0.035,"l2_leaf_reg":8.0,"random_strength":1.0},
]

NO_THRESHOLDS=[0.05,0.075,0.10,0.125,0.15,0.175,0.20,0.225,0.25,0.275,0.30,0.325,0.35,0.375,0.40]
PRIOR_RATE_CAPS=[0.05,0.10,0.15,0.20,0.25,0.30,0.35,0.40]
PRIOR_START_MINS=[3,5,8,10]

NUMERIC_BASE=[
 "starter_is_home","game_number","doubleheader_flag",
 "own_games_prior","opp_games_prior",
 "own_win_pct","opp_win_pct",
 "own_run_diff_pg","opp_run_diff_pg",
 "own_pyth_win_pct","opp_pyth_win_pct",
 "own_l5_games","opp_l5_games",
 "own_l5_win_pct","opp_l5_win_pct",
 "own_l5_run_diff_pg","opp_l5_run_diff_pg",
 "own_l10_games","opp_l10_games",
 "own_l10_win_pct","opp_l10_win_pct",
 "own_l10_run_diff_pg","opp_l10_run_diff_pg",
 "own_rest_days","opp_rest_days",
 "side_h2h_win_pct",
 "prior_starts","prior_wins","prior_win_rate"
]
CATEGORICAL=[]

def normalize_team(value:Any)->str:
    s=str(value or "")
    if s=="ARI": return "AZ"
    if s=="CHW": return "CWS"
    return s

def fetch_rows(token:str)->list[dict[str,Any]]:
    rows=[];offset=0;expected=None
    while True:
        resp=requests.post(
          EDGE_URL,
          headers={"x-github-oidc-token":token,"Content-Type":"application/json"},
          json={"offset":offset,"limit":125},
          timeout=180,
        )
        if not resp.ok:
            raise RuntimeError(f"PWFC_EXPORT_HTTP_{resp.status_code}:{resp.text[:800]}")
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
        if bad: raise RuntimeError("PWFC_EXPORT_INVALID:"+",".join(bad))
        if expected is None: expected=int(p["totalRows"])
        if int(p["totalRows"])!=expected: raise RuntimeError("PWFC_EXPORT_TOTAL_CHANGED")
        batch=p.get("rows") or []
        rows.extend(batch);offset+=len(batch)
        if not batch or offset>=expected: break
    if expected is None or len(rows)!=expected:
        raise RuntimeError(f"PWFC_EXPORT_COUNT:{len(rows)}:{expected}")
    return rows

def fetch_schedule_decisions(game_pks:set[int])->dict[int,dict[str,Any]]:
    chunks=[
      ("2026-03-01","2026-03-31"),
      ("2026-04-01","2026-04-30"),
      ("2026-05-01","2026-05-31"),
      ("2026-06-01","2026-06-30"),
      ("2026-07-01","2026-07-31"),
      ("2026-08-01","2026-08-31"),
      ("2026-09-01","2026-09-18"),
    ]
    fields="dates,date,games,gamePk,decisions,winner,id,fullName,loser"
    out={};calls=0
    sess=requests.Session()
    sess.headers.update({"User-Agent":"pick-analyzer-research/1.0"})
    for start,end in chunks:
        params={"sportId":1,"startDate":start,"endDate":end,"gameTypes":"R","hydrate":"decisions","fields":fields}
        last=None
        for attempt in range(3):
            try:
                resp=sess.get("https://statsapi.mlb.com/api/v1/schedule",params=params,timeout=60)
                calls+=1;resp.raise_for_status();payload=resp.json();last=None;break
            except Exception as exc:
                last=exc;time.sleep(1.5*(attempt+1))
        if last is not None: raise RuntimeError(f"PWFC_DECISION_FETCH:{start}:{end}:{last}")
        for d in payload.get("dates",[]):
            for game in d.get("games",[]):
                game_pk=int(game["gamePk"])
                if game_pk not in game_pks: continue
                dec=game.get("decisions") or {}
                winner=dec.get("winner") or {}; loser=dec.get("loser") or {}
                if winner.get("id") and loser.get("id"):
                    out[game_pk]={
                      "winner_id":int(winner["id"]),
                      "winner_name":winner.get("fullName"),
                      "loser_id":int(loser["id"]),
                      "loser_name":loser.get("fullName")
                    }
    missing=sorted(game_pks-set(out))
    if missing: raise RuntimeError(f"PWFC_DECISIONS_MISSING:{len(missing)}:{missing[:20]}")
    DECISIONS.parent.mkdir(parents=True,exist_ok=True)
    DECISIONS.write_text(json.dumps({
      "contract":"MLB_PITCHER_WIN_FORWARD_NUMERIC_2026_DECISIONS/1.0.0",
      "source":"MLB StatsAPI schedule hydrate=decisions",
      "requested_game_count":len(game_pks),
      "resolved_game_count":len(out),
      "http_calls":calls,
      "odds_api_historical_credits_consumed":0,
      "rows":[{"game_pk":k,**out[k]} for k in sorted(out)]
    },indent=2,sort_keys=True)+"\n")
    return out

def add_labels_and_prior(rows:list[dict[str,Any]])->pd.DataFrame:
    df=pd.DataFrame(rows)
    df["game_date"]=pd.to_datetime(df["game_date"])
    if (df.game_date>MAX_HIST_DATE).any(): raise RuntimeError("PWFC_CUTOFF_BREACH")
    if (df.game_date==pd.Timestamp("2026-09-19")).any(): raise RuntimeError("PWFC_QUARANTINE_BREACH")
    if (df.game_date>=FORWARD_MIN_DATE).any(): raise RuntimeError("PWFC_FORWARD_BREACH")
    if not (df.development_class=="HISTORICAL_SEEN_DEVELOPMENT").all(): raise RuntimeError("PWFC_CLASS_BREACH")
    if not df.research_only.fillna(False).astype(bool).all(): raise RuntimeError("PWFC_RESEARCH_BREACH")

    game_pks=set(df.loc[df.season==2026,"game_pk"].astype(int))
    dec=fetch_schedule_decisions(game_pks)
    m=df.season==2026
    df.loc[m,"y_win"]=[
      1 if int(sid)==dec[int(gpk)]["winner_id"] else 0
      for gpk,sid in zip(df.loc[m,"game_pk"],df.loc[m,"starter_mlbam_id"])
    ]
    df["y_win"]=pd.to_numeric(df["y_win"],errors="raise").astype(int)

    # Strictly prior pitcher decisions by season and identity, date-isolated.
    df=df.sort_values(["season","starter_identity","game_date","game_pk"]).copy()
    df["prior_starts"]=0;df["prior_wins"]=0
    for (_,pid),idx in df.groupby(["season","starter_identity"],sort=False).groups.items():
        sub=df.loc[idx].sort_values(["game_date","game_pk"])
        date_stats=sub.groupby("game_date")["y_win"].agg(["count","sum"]).sort_index()
        date_stats["prior_starts"]=date_stats["count"].cumsum().shift(fill_value=0)
        date_stats["prior_wins"]=date_stats["sum"].cumsum().shift(fill_value=0)
        sm=date_stats["prior_starts"].to_dict();wm=date_stats["prior_wins"].to_dict()
        df.loc[sub.index,"prior_starts"]=[int(sm[d]) for d in sub.game_date]
        df.loc[sub.index,"prior_wins"]=[int(wm[d]) for d in sub.game_date]
    df["prior_win_rate"]=np.where(df.prior_starts>0,df.prior_wins/df.prior_starts,np.nan)
    return df.sort_values(["game_date","game_pk","starter_side"]).reset_index(drop=True)

def value(p:dict[str,Any],key:str):
    return p.get(key)

def side_features(row:pd.Series)->dict[str,Any]:
    p=dict(row["payload"] or {})
    if "actual_winner" in p: raise RuntimeError("PWFC_ACTUAL_WINNER_PAYLOAD")
    side=str(row["starter_side"])
    own="home_" if side=="home" else "away_"
    opp="away_" if side=="home" else "home_"
    h2h=pd.to_numeric(pd.Series([p.get("home_h2h_win_pct_prior")]),errors="coerce").iloc[0]
    if pd.isna(h2h): side_h2h=np.nan
    else: side_h2h=float(h2h) if side=="home" else 1.0-float(h2h)

    out={
      "starter_is_home":1 if side=="home" else 0,
      "game_number":p.get("game_number"),
      "doubleheader_flag":1 if bool(p.get("doubleheader_flag")) else 0,
      "side_h2h_win_pct":side_h2h,
      "own_team":normalize_team(p.get("home_team") if side=="home" else p.get("away_team")),
      "opp_team":normalize_team(p.get("away_team") if side=="home" else p.get("home_team")),
      "day_night":str(p.get("day_night") or "__MISSING__"),
      "venue":str(p.get("venue") or "__MISSING__"),
      "prior_starts":int(row["prior_starts"]),
      "prior_wins":int(row["prior_wins"]),
      "prior_win_rate":row["prior_win_rate"],
    }
    suffixes=[
      "games_prior","win_pct","run_diff_pg","pyth_win_pct",
      "l5_games","l5_win_pct","l5_run_diff_pg",
      "l10_games","l10_win_pct","l10_run_diff_pg",
      "rest_days"
    ]
    for suffix in suffixes:
        out["own_"+suffix]=value(p,own+suffix)
        out["opp_"+suffix]=value(p,opp+suffix)
    return out

def build_matrix(df:pd.DataFrame)->pd.DataFrame:
    records=[side_features(r) for _,r in df.iterrows()]
    x=pd.DataFrame(records)
    for c in NUMERIC_BASE:
        x[c]=pd.to_numeric(x[c],errors="coerce")
    for c in CATEGORICAL:
        x[c]=x[c].where(x[c].notna(),"__MISSING__").astype(str)
    return x[NUMERIC_BASE+CATEGORICAL]

def model(params:dict[str,Any],offset:int)->CatBoostClassifier:
    return CatBoostClassifier(
      random_seed=SEED+offset,
      loss_function="Logloss",eval_metric="Logloss",
      verbose=False,allow_writing_files=False,thread_count=-1,
      **params
    )

def summarize(oof:pd.DataFrame,mask:np.ndarray,config:dict[str,Any])->dict[str,Any]|None:
    z=oof.loc[mask].copy()
    if z.empty:return None
    z["pred"]=0
    z["correct"]=(z.truth.astype(int)==0).astype(int)
    monthly={}
    for month,g in z.groupby("month",sort=True):
        monthly[month]={"n":int(len(g)),"correct":int(g.correct.sum()),"accuracy":float(g.correct.mean())}
    n=len(z);correct=int(z.correct.sum());acc=correct/n
    months=len(monthly);worst=min(v["accuracy"] for v in monthly.values())
    baseline=float((oof.truth==0).mean())
    sample=n>=MIN_N and months>=MIN_MONTHS
    stable=sample and worst>=MIN_WORST
    return {
      **config,
      "direction":"NO",
      "n":int(n),"correct":correct,"accuracy":acc,
      "coverage_vs_oof":n/len(oof),
      "months_with_selections":months,
      "min_month_n":min(v["n"] for v in monthly.values()),
      "worst_month_accuracy":worst,
      "monthly_accuracy_sd":float(np.std([v["accuracy"] for v in monthly.values()])),
      "monthly":monthly,
      "unconditional_no_baseline":baseline,
      "lift_vs_unconditional_no_baseline":acc-baseline,
      "sample_gate_met":sample,
      "sample_stability_gate_met":stable,
      "target_met_75_plus":bool(stable and acc>=TARGET_ACC)
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
    if not token: raise RuntimeError("PWFC_OIDC_MISSING")
    rows=fetch_rows(token)
    df=add_labels_and_prior(rows)
    x=build_matrix(df)

    oof_rows=[];fold_meta=[]
    for month,start_s,end_s in FOLDS:
        start=pd.Timestamp(start_s);end=pd.Timestamp(end_s)
        tr=df.game_date<start
        va=(df.game_date>=start)&(df.game_date<end)
        if tr.sum()<700 or va.sum()<60:
            raise RuntimeError(f"PWFC_SMALL_FOLD:{month}:{tr.sum()}:{va.sum()}")
        p=np.zeros(int(va.sum()),float)
        for si,params in enumerate(SPECS):
            m=model(params,si)
            m.fit(x.loc[tr],df.loc[tr,"y_win"].to_numpy(int),cat_features=CATEGORICAL)
            p+=np.asarray(m.predict_proba(x.loc[va])[:,1],float)/len(SPECS)
        v=df.loc[va].reset_index(drop=True)
        for i in range(len(v)):
            oof_rows.append({
              "month":month,"season":int(v.loc[i,"season"]),
              "game_pk":int(v.loc[i,"game_pk"]),"game_date":str(v.loc[i,"game_date"].date()),
              "starter_side":str(v.loc[i,"starter_side"]),
              "truth":int(v.loc[i,"y_win"]),"p_win":float(p[i]),
              "prior_starts":int(v.loc[i,"prior_starts"]),
              "prior_win_rate":None if pd.isna(v.loc[i,"prior_win_rate"]) else float(v.loc[i,"prior_win_rate"])
            })
        fold_meta.append({"month":month,"train_n":int(tr.sum()),"validation_n":int(va.sum()),"train_end":str(df.loc[tr,"game_date"].max().date())})

    oof=pd.DataFrame(oof_rows)
    p=oof.p_win.to_numpy(float)
    ps=oof.prior_starts.to_numpy(int)
    pr=pd.to_numeric(oof.prior_win_rate,errors="coerce").to_numpy(float)
    candidates=[]

    for t in NO_THRESHOLDS:
        mask=p<=t
        s=summarize(oof,mask,{
          "architecture":"deployable_core_catboost",
          "probability_threshold":t,
          "minimum_prior_starts":None,
          "prior_win_rate_cap":None
        })
        if s:candidates.append(s)
        for minstarts in PRIOR_START_MINS:
            for cap in PRIOR_RATE_CAPS:
                m=mask&(ps>=minstarts)&np.isfinite(pr)&(pr<=cap)
                s=summarize(oof,m,{
                  "architecture":"deployable_core_catboost_plus_prior_win",
                  "probability_threshold":t,
                  "minimum_prior_starts":minstarts,
                  "prior_win_rate_cap":cap
                })
                if s:candidates.append(s)

    for minstarts in PRIOR_START_MINS:
        for cap in PRIOR_RATE_CAPS:
            mask=(ps>=minstarts)&np.isfinite(pr)&(pr<=cap)
            s=summarize(oof,mask,{
              "architecture":"deployable_prior_win_rule",
              "probability_threshold":None,
              "minimum_prior_starts":minstarts,
              "prior_win_rate_cap":cap
            })
            if s:candidates.append(s)

    sample=[c for c in candidates if c["sample_gate_met"]]
    if not sample: raise RuntimeError("PWFC_NO_SAMPLE_ELIGIBLE")
    sample.sort(key=rank_key,reverse=True)
    selected=sample[0]
    target=bool(selected["target_met_75_plus"])
    high=sorted(sample,key=lambda c:(c["accuracy"],c["worst_month_accuracy"],c["n"]),reverse=True)[:25]

    model_files=[]
    final_models=[]
    if target:
        MODEL_DIR.mkdir(parents=True,exist_ok=True)
        pool=Pool(x,label=df["y_win"].to_numpy(int),cat_features=CATEGORICAL)
        for si,params in enumerate(SPECS):
            final_model=model(params,si)
            final_model.fit(pool)
            final_models.append(final_model)
            py_path=MODEL_DIR/f"pitcher_win_forward_numeric_model_{si}.py"
            json_path=MODEL_DIR/f"pitcher_win_forward_numeric_model_{si}.json"
            final_model.save_model(str(py_path),format="python",pool=pool)
            final_model.save_model(str(json_path),format="json",pool=pool)
            model_files.append({
              "python_path":str(py_path),
              "python_sha256":hashlib.sha256(py_path.read_bytes()).hexdigest(),
              "json_path":str(json_path),
              "json_sha256":hashlib.sha256(json_path.read_bytes()).hexdigest(),
              "spec_index":si
            })

        golden_rows=[]
        sample_count=min(96,len(df))
        sample_idx=np.linspace(0,len(df)-1,num=sample_count,dtype=int)
        for ridx in sample_idx:
            one=x.iloc[[int(ridx)]]
            per_model=[float(m.predict_proba(one)[0,1]) for m in final_models]
            features=[]
            for name in NUMERIC_BASE:
                val=one.iloc[0][name]
                features.append(None if pd.isna(val) else float(val))
            golden_rows.append({
              "row_index":int(ridx),
              "game_pk":int(df.iloc[int(ridx)]["game_pk"]),
              "game_date":str(df.iloc[int(ridx)]["game_date"].date()),
              "starter_side":str(df.iloc[int(ridx)]["starter_side"]),
              "features":features,
              "per_model_p_win":per_model,
              "ensemble_p_win":float(sum(per_model)/len(per_model))
            })
        GOLDEN.parent.mkdir(parents=True,exist_ok=True)
        GOLDEN.write_text(json.dumps({
          "contract":"MLB_PITCHER_WIN_FORWARD_NUMERIC_GOLDEN/1.0.0",
          "feature_names":NUMERIC_BASE,
          "threshold":selected["probability_threshold"],
          "rows":golden_rows
        },indent=2,sort_keys=True)+"\n")

    result={
      "contract":"MLB_PITCHER_WIN_FORWARD_NUMERIC_V1_RESULT/1.0.0",
      "protocol":PROTOCOL,"research_only":True,
      "feature_contract":"DEPLOYABLE_EXACT_PARITY_NUMERIC_V1",
      "historical_max_allowed_game_date":"2026-09-18",
      "actual_max_game_date_used":str(df.game_date.max().date()),
      "source_rows":len(df),
      "source_rows_by_season":{str(k):int(v) for k,v in df.groupby("season").size().items()},
      "oof_rows":len(oof),"folds":fold_meta,
      "numeric_features":NUMERIC_BASE,
      "categorical_features":CATEGORICAL,
      "specs":SPECS,
      "model_files":model_files,
      "selected_candidate":selected,
      "highest_accuracy_sample_candidates":high,
      "target_met_75_plus":target,
      "market_state":"TARGET_MET_75_PLUS_FORWARD_COMPAT_FREEZE_READY" if target else "FORWARD_COMPAT_BELOW_75",
      "forward_2026_09_20_plus_opened":False,
      "forward_used_for_selection":False,
      "quarantine_2026_09_19_used":False,
      "odds_api_calls_made":0,
      "odds_api_historical_credits_consumed":0,
      "official_picks_writes":0,"apostar_activation":False,"production_promotion":False,
      "github_sha_at_run":os.environ.get("GITHUB_SHA")
    }
    freeze={
      "contract":"MLB_PITCHER_WIN_FORWARD_NUMERIC_V1_FROZEN_CANDIDATE/1.0.0",
      "protocol":PROTOCOL,"research_only":True,
      "frozen":target,"forward_eligible":target,
      "candidate":selected,
      "feature_contract":"DEPLOYABLE_EXACT_PARITY_NUMERIC_V1",
      "numeric_features":NUMERIC_BASE if target else [],
      "categorical_features":CATEGORICAL if target else [],
      "specs":SPECS if target else [],
      "model_files":model_files if target else [],
      "historical_max_allowed_game_date":"2026-09-18",
      "actual_max_game_date_used":result["actual_max_game_date_used"],
      "forward_min_game_date":"2026-09-20",
      "forward_outcomes_opened":False,
      "reason":"Deployable exact-parity core cleared frozen historical gate." if target else "Deployable exact-parity core did not clear 75% historical gate.",
      "odds_api_historical_credits_consumed":0,
      "official_picks_writes":0,"apostar_activation":False,"production_promotion":False,
      "github_sha_at_freeze":os.environ.get("GITHUB_SHA") if target else None
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    FREEZE.write_text(json.dumps(freeze,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"state":result["market_state"],"oof":len(oof),"selected":selected},indent=2))

if __name__=="__main__":
    main()
