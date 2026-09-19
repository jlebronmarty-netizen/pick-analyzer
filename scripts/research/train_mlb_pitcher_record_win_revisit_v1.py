#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
from catboost import CatBoostClassifier

SEED=20260919
EDGE_URL="https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-pitcher-win-revisit-github-export-temp"
EDGE_CONTRACT="MLB_PITCHER_WIN_REVISIT_GITHUB_EXPORT/1.0.0"
PROTOCOL="MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0"
MAX_HIST_DATE=pd.Timestamp("2026-09-18")
FORWARD_MIN_DATE=pd.Timestamp("2026-09-20")

OUT=Path("artifacts/research/mlb_pitcher_record_win_revisit_v1_result.json")
FREEZE=Path("artifacts/research/mlb_pitcher_record_win_revisit_v1_frozen_candidate.json")
DECISIONS=Path("artifacts/research/mlb_pitcher_record_win_revisit_2026_decisions_v1.json")

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
 {"depth":4,"iterations":350,"learning_rate":0.035,"l2_leaf_reg":7.0,"random_strength":1.0},
 {"depth":6,"iterations":350,"learning_rate":0.035,"l2_leaf_reg":7.0,"random_strength":1.0},
]

NO_THRESHOLDS=[0.05,0.075,0.10,0.125,0.15,0.175,0.20,0.225,0.25,0.275,0.30,0.325,0.35]
YES_THRESHOLDS=[0.40,0.45,0.50,0.55,0.60,0.65,0.70]
PRIOR_RATE_CAPS=[0.05,0.10,0.15,0.20,0.25,0.30,0.40]
PRIOR_START_MINS=[3,5,8,10]

NEUTRAL_ALLOW={
 "game_number","day_night","doubleheader_flag","venue","temperature_f","wind_mph",
 "wind_direction","precip","sky","roof_status","park_games_prior","park_runs_pg_prior",
 "park_home_win_pct_prior","home_plate_umpire","start_time_local"
}
BLOCK_SUFFIX_PARTS=("actual","source","digest","created","updated","mlbam","retrosheet","_id","name")
BLOCK_EXACT={
 "canonical_game_id","source_game_id","feature_cutoff_date","feature_version",
 "actual_winner","current_inputs_reconstructed","data_completeness_pct","pregame_integrity_tier",
 "has_statcast","has_lineup","has_starters","has_weather","has_umpire","has_odds",
}

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
            raise RuntimeError(f"WIN_EXPORT_HTTP_{resp.status_code}:{resp.text[:800]}")
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
        if bad: raise RuntimeError("WIN_EXPORT_INVALID:"+",".join(bad))
        if expected is None: expected=int(p["totalRows"])
        if int(p["totalRows"])!=expected: raise RuntimeError("WIN_EXPORT_TOTAL_CHANGED")
        batch=p.get("rows") or []
        rows.extend(batch);offset+=len(batch)
        if not batch or offset>=expected: break
    if expected is None or len(rows)!=expected:
        raise RuntimeError(f"WIN_EXPORT_COUNT:{len(rows)}:{expected}")
    return rows

def fetch_schedule_decisions(game_pks:set[int])->dict[int,dict[str,Any]]:
    if not game_pks: return {}
    min_date="2026-03-01"
    max_date="2026-09-18"
    chunks=[
      ("2026-03-01","2026-03-31"),
      ("2026-04-01","2026-04-30"),
      ("2026-05-01","2026-05-31"),
      ("2026-06-01","2026-06-30"),
      ("2026-07-01","2026-07-31"),
      ("2026-08-01","2026-08-31"),
      ("2026-09-01","2026-09-18"),
    ]
    fields="dates,date,games,gamePk,decisions,winner,id,fullName,loser,save"
    out={}
    calls=0
    sess=requests.Session()
    sess.headers.update({"User-Agent":"pick-analyzer-research/1.0"})
    for start,end in chunks:
        params={
          "sportId":1,"startDate":start,"endDate":end,
          "gameTypes":"R","hydrate":"decisions","fields":fields,
        }
        last=None
        for attempt in range(3):
            try:
                resp=sess.get("https://statsapi.mlb.com/api/v1/schedule",params=params,timeout=60)
                calls+=1
                resp.raise_for_status()
                payload=resp.json()
                last=None
                break
            except Exception as e:
                last=e
                time.sleep(1.5*(attempt+1))
        if last is not None: raise RuntimeError(f"MLB_SCHEDULE_DECISIONS_FAILED:{start}:{end}:{last}")
        for d in payload.get("dates",[]):
            for game in d.get("games",[]):
                game_pk=int(game["gamePk"])
                if game_pk not in game_pks: continue
                dec=game.get("decisions") or {}
                winner=dec.get("winner") or {}
                loser=dec.get("loser") or {}
                if not winner.get("id") or not loser.get("id"):
                    continue
                out[game_pk]={
                  "winner_id":int(winner["id"]),
                  "winner_name":winner.get("fullName"),
                  "loser_id":int(loser["id"]),
                  "loser_name":loser.get("fullName"),
                }
    missing=sorted(game_pks-set(out))
    if missing:
        raise RuntimeError(f"MLB_DECISIONS_MISSING:{len(missing)}:{missing[:30]}")
    DECISIONS.parent.mkdir(parents=True,exist_ok=True)
    DECISIONS.write_text(json.dumps({
      "contract":"MLB_PITCHER_RECORD_WIN_2026_DECISIONS/1.0.0",
      "research_only":True,
      "source":"MLB StatsAPI schedule hydrate=decisions",
      "range":{"from":min_date,"to":max_date},
      "requested_game_count":len(game_pks),
      "resolved_game_count":len(out),
      "http_calls":calls,
      "odds_api_historical_credits_consumed":0,
      "rows":[{"game_pk":k,**out[k]} for k in sorted(out)]
    },indent=2,sort_keys=True)+"\n")
    return out

def add_prior_win_features(df:pd.DataFrame)->pd.DataFrame:
    df=df.sort_values(["season","starter_identity","game_date","game_pk"]).copy()
    df["prior_starts"]=0
    df["prior_wins"]=0
    for (_,pid),idx in df.groupby(["season","starter_identity"],sort=False).groups.items():
        sub=df.loc[idx].sort_values(["game_date","game_pk"])
        date_stats=sub.groupby("game_date")["y_win"].agg(["count","sum"]).sort_index()
        date_stats["prior_starts"]=date_stats["count"].cumsum().shift(fill_value=0)
        date_stats["prior_wins"]=date_stats["sum"].cumsum().shift(fill_value=0)
        map_starts=date_stats["prior_starts"].to_dict()
        map_wins=date_stats["prior_wins"].to_dict()
        df.loc[sub.index,"prior_starts"]=[int(map_starts[d]) for d in sub["game_date"]]
        df.loc[sub.index,"prior_wins"]=[int(map_wins[d]) for d in sub["game_date"]]
    df["prior_win_rate"]=np.where(df["prior_starts"]>0,df["prior_wins"]/df["prior_starts"],np.nan)
    return df.sort_values(["game_date","game_pk","starter_side"]).reset_index(drop=True)

def safe_numeric(v:Any)->float:
    if isinstance(v,bool): return float(int(v))
    try:
        if v is None or v=="": return np.nan
        return float(v)
    except (TypeError,ValueError):
        return np.nan

def side_normalize(row:dict[str,Any])->dict[str,Any]:
    p=dict(row["payload"] or {})
    if "actual_winner" in p or any(k.startswith(("actual_","postgame_","final_")) for k in p):
        raise RuntimeError("POSTGAME_KEY_IN_PAYLOAD")
    side=row["starter_side"]
    own="home_" if side=="home" else "away_"
    opp="away_" if side=="home" else "home_"
    sign=1.0 if side=="home" else -1.0
    keys=set(p)
    out={"starter_is_home":1 if side=="home" else 0}
    for k in sorted(keys):
        if k in BLOCK_EXACT: continue
        if k.startswith("home_"):
            suffix=k[5:]
            if "away_"+suffix not in keys: continue
            if any(part in suffix.lower() for part in BLOCK_SUFFIX_PARTS): continue
            out["own_"+suffix]=p.get(own+suffix)
            out["opp_"+suffix]=p.get(opp+suffix)
        elif k.startswith("adv_"):
            if any(part in k.lower() for part in BLOCK_SUFFIX_PARTS): continue
            v=safe_numeric(p.get(k))
            out["side_"+k]=v*sign if math.isfinite(v) else np.nan
        elif k in NEUTRAL_ALLOW:
            out[k]=p.get(k)
    out["prior_starts"]=row["prior_starts"]
    out["prior_wins"]=row["prior_wins"]
    out["prior_win_rate"]=row["prior_win_rate"]
    return out

def build_frame(rows:list[dict[str,Any]])->pd.DataFrame:
    base=pd.DataFrame(rows)
    base["game_date"]=pd.to_datetime(base["game_date"])
    if (base["game_date"]>MAX_HIST_DATE).any(): raise RuntimeError("WIN_HIST_CUTOFF_BREACH")
    if (base["game_date"]==pd.Timestamp("2026-09-19")).any(): raise RuntimeError("WIN_QUARANTINE_BREACH")
    if (base["game_date"]>=FORWARD_MIN_DATE).any(): raise RuntimeError("WIN_FORWARD_BREACH")
    if not (base["development_class"]=="HISTORICAL_SEEN_DEVELOPMENT").all():
        raise RuntimeError("WIN_CLASS_BREACH")
    if not base["research_only"].fillna(False).astype(bool).all():
        raise RuntimeError("WIN_RESEARCH_BREACH")

    game_pks=set(base.loc[base.season==2026,"game_pk"].astype(int))
    dec=fetch_schedule_decisions(game_pks)
    m2026=base.season==2026
    base.loc[m2026,"y_win"]=[
      1 if int(sid)==dec[int(gpk)]["winner_id"] else 0
      for gpk,sid in zip(base.loc[m2026,"game_pk"],base.loc[m2026,"starter_mlbam_id"])
    ]
    base["y_win"]=pd.to_numeric(base["y_win"],errors="raise").astype(int)
    per_game=base.groupby(["season","game_pk"])["y_win"].sum()
    if (per_game>1).any(): raise RuntimeError("MULTIPLE_STARTER_WINS_GAME")
    return add_prior_win_features(base)

def feature_matrix(df:pd.DataFrame)->tuple[pd.DataFrame,list[str],list[str],list[str]]:
    records=[side_normalize(r) for r in df.to_dict(orient="records")]
    raw=pd.DataFrame(records)
    numeric=[];categorical=[];dropped=[]
    for c in raw.columns:
        if c in {"starter_is_home","prior_starts","prior_wins","prior_win_rate"}:
            numeric.append(c);continue
        s=pd.to_numeric(raw[c],errors="coerce")
        coverage=float(s.notna().mean())
        if coverage>=0.25:
            numeric.append(c)
        else:
            nonnull=raw[c].notna().mean()
            nunique=raw[c].dropna().astype(str).nunique()
            if nonnull>=0.20 and nunique<=500:
                categorical.append(c)
            else:
                dropped.append(c)
    x=pd.DataFrame(index=raw.index)
    for c in numeric: x[c]=pd.to_numeric(raw[c],errors="coerce")
    for c in categorical: x[c]=raw[c].where(raw[c].notna(),"__MISSING__").astype(str)
    return x,sorted(numeric),sorted(categorical),sorted(dropped)

def model(params:dict[str,Any],offset:int)->CatBoostClassifier:
    return CatBoostClassifier(
      random_seed=SEED+offset,
      loss_function="Logloss",eval_metric="Logloss",
      verbose=False,allow_writing_files=False,thread_count=-1,
      **params
    )

def summarize(oof:pd.DataFrame,mask:np.ndarray,pred:int|np.ndarray,config:dict[str,Any])->dict[str,Any]|None:
    z=oof.loc[mask].copy()
    if z.empty:return None
    if np.isscalar(pred): z["pred"]=int(pred)
    else: z["pred"]=np.asarray(pred)[mask].astype(int)
    z["correct"]=(z["pred"].astype(int)==z["truth"].astype(int)).astype(int)
    monthly={}
    for month,g in z.groupby("month",sort=True):
        monthly[month]={"n":int(len(g)),"correct":int(g.correct.sum()),"accuracy":float(g.correct.mean())}
    n=len(z);correct=int(z.correct.sum());acc=correct/n
    months=len(monthly);worst=min(v["accuracy"] for v in monthly.values())
    truth_rate=float(z.truth.mean());majority=max(truth_rate,1-truth_rate)
    gate=n>=MIN_N and months>=MIN_MONTHS and worst>=MIN_WORST
    return {
      **config,
      "n":int(n),"correct":correct,"accuracy":acc,
      "coverage_vs_oof":n/len(oof),
      "months_with_selections":months,
      "min_month_n":min(v["n"] for v in monthly.values()),
      "worst_month_accuracy":worst,
      "monthly_accuracy_sd":float(np.std([v["accuracy"] for v in monthly.values()])),
      "monthly":monthly,
      "selected_yes_rate":truth_rate,
      "selected_majority_baseline":majority,
      "lift_vs_selected_majority":acc-majority,
      "sample_stability_gate_met":gate,
      "target_met_75_plus":bool(gate and acc>=TARGET_ACC)
    }

def rank_key(c:dict[str,Any])->tuple:
    return (
      1 if c["target_met_75_plus"] else 0,
      1 if c["sample_stability_gate_met"] else 0,
      c["worst_month_accuracy"],
      c["accuracy"],
      c["lift_vs_selected_majority"],
      c["n"]
    )

def main():
    token=os.environ.get("GITHUB_OIDC_TOKEN","").strip()
    if not token: raise RuntimeError("WIN_REVISIT_OIDC_MISSING")
    rows=fetch_rows(token)
    df=build_frame(rows)
    x,nums,cats,dropped=feature_matrix(df)

    oof_rows=[]
    fold_meta=[]
    for month,start_s,end_s in FOLDS:
        start=pd.Timestamp(start_s);end=pd.Timestamp(end_s)
        tr=df.game_date<start
        va=(df.game_date>=start)&(df.game_date<end)
        if tr.sum()<700 or va.sum()<60:
            raise RuntimeError(f"WIN_SMALL_FOLD:{month}:{tr.sum()}:{va.sum()}")
        xv=x.loc[va]
        p=np.zeros(int(va.sum()),dtype=float)
        for si,params in enumerate(SPECS):
            m=model(params,si)
            m.fit(x.loc[tr],df.loc[tr,"y_win"].to_numpy(int),cat_features=cats)
            p+=np.asarray(m.predict_proba(xv)[:,1],float)/len(SPECS)
        v=df.loc[va].reset_index(drop=True)
        for i in range(len(v)):
            oof_rows.append({
              "month":month,"season":int(v.loc[i,"season"]),
              "game_pk":int(v.loc[i,"game_pk"]),"game_date":str(v.loc[i,"game_date"].date()),
              "starter_side":v.loc[i,"starter_side"],
              "starter_identity":str(v.loc[i,"starter_identity"]),
              "truth":int(v.loc[i,"y_win"]),"p_win":float(p[i]),
              "prior_starts":int(v.loc[i,"prior_starts"]),
              "prior_win_rate":None if pd.isna(v.loc[i,"prior_win_rate"]) else float(v.loc[i,"prior_win_rate"])
            })
        fold_meta.append({
          "month":month,"train_n":int(tr.sum()),"validation_n":int(va.sum()),
          "train_end":str(df.loc[tr,"game_date"].max().date())
        })

    oof=pd.DataFrame(oof_rows)
    p=oof.p_win.to_numpy(float)
    prior_rate=pd.to_numeric(oof.prior_win_rate,errors="coerce").to_numpy(float)
    prior_starts=oof.prior_starts.to_numpy(int)
    candidates=[]

    # Legacy frozen rule reproduced on the unified second-pass OOF surface.
    mask=(prior_starts>=5)&np.isfinite(prior_rate)&(prior_rate<=0.10)
    s=summarize(oof,mask,0,{
      "architecture":"legacy_prior_win_rate_rule",
      "direction":"NO","probability_threshold":None,
      "prior_win_rate_cap":0.10,"minimum_prior_starts":5
    })
    if s:candidates.append(s)

    for t in NO_THRESHOLDS:
        mask=p<=t
        s=summarize(oof,mask,0,{
          "architecture":"catboost_probability","direction":"NO",
          "probability_threshold":t,"prior_win_rate_cap":None,"minimum_prior_starts":0
        })
        if s:candidates.append(s)
        for cap in PRIOR_RATE_CAPS:
            for minstarts in PRIOR_START_MINS:
                mask=(p<=t)&(prior_starts>=minstarts)&np.isfinite(prior_rate)&(prior_rate<=cap)
                s=summarize(oof,mask,0,{
                  "architecture":"catboost_plus_prior_win_filter","direction":"NO",
                  "probability_threshold":t,"prior_win_rate_cap":cap,"minimum_prior_starts":minstarts
                })
                if s:candidates.append(s)

    for t in YES_THRESHOLDS:
        mask=p>=t
        s=summarize(oof,mask,1,{
          "architecture":"catboost_probability","direction":"YES",
          "probability_threshold":t,"prior_win_rate_cap":None,"minimum_prior_starts":0
        })
        if s:candidates.append(s)

    eligible=[c for c in candidates if c["sample_stability_gate_met"]]
    if not eligible: raise RuntimeError("WIN_NO_STABLE_CANDIDATE")
    eligible.sort(key=rank_key,reverse=True)
    selected=eligible[0]
    target=bool(selected["target_met_75_plus"])

    by_acc=sorted(eligible,key=lambda c:(c["accuracy"],c["worst_month_accuracy"],c["n"]),reverse=True)[:20]

    result={
      "contract":"MLB_PITCHER_RECORD_WIN_REVISIT_V1_RESULT/1.0.0",
      "protocol":PROTOCOL,"research_only":True,
      "development_class":"HISTORICAL_SEEN_DEVELOPMENT",
      "historical_max_allowed_game_date":"2026-09-18",
      "actual_max_game_date_used":str(df.game_date.max().date()),
      "source_rows":len(df),
      "source_rows_by_season":{str(k):int(v) for k,v in df.groupby("season").size().items()},
      "outcome_yes_by_season":{str(k):int(v) for k,v in df.groupby("season").y_win.sum().items()},
      "oof_rows":len(oof),"folds":fold_meta,
      "architecture_family":"side_normalized_catboost_pitcher_win_v1",
      "numeric_feature_count":len(nums),"categorical_feature_count":len(cats),
      "numeric_features":nums,"categorical_features":cats,"dropped_fields":dropped,
      "specs":SPECS,
      "selected_candidate":selected,
      "highest_accuracy_stable_candidates":by_acc,
      "target_met_75_plus":target,
      "market_closeout_state":"TARGET_MET_75_PLUS_FREEZE_READY" if target else "REVISIT_SECOND_PASS_BELOW_75",
      "forward_2026_09_20_plus_opened":False,
      "forward_used_for_selection":False,
      "quarantine_2026_09_19_used":False,
      "mlb_schedule_decisions_used":True,
      "odds_api_calls_made":0,
      "odds_api_historical_credits_consumed":0,
      "official_picks_writes":0,"apostar_activation":False,"production_promotion":False,
      "github_sha_at_run":os.environ.get("GITHUB_SHA")
    }
    freeze={
      "contract":"MLB_PITCHER_RECORD_WIN_REVISIT_V1_FROZEN_CANDIDATE/1.0.0",
      "protocol":PROTOCOL,"research_only":True,
      "frozen":target,"forward_eligible":target,
      "candidate":selected,
      "architecture_family":result["architecture_family"],
      "numeric_features":nums if target else [],
      "categorical_features":cats if target else [],
      "specs":SPECS if target else [],
      "historical_max_allowed_game_date":"2026-09-18",
      "actual_max_game_date_used":result["actual_max_game_date_used"],
      "forward_min_game_date":"2026-09-20",
      "forward_outcomes_opened":False,
      "reason":"Historical rolling gate met before forward window." if target else "75% historical revisit gate not met; no forward candidate activated.",
      "odds_api_historical_credits_consumed":0,
      "official_picks_writes":0,"apostar_activation":False,"production_promotion":False,
      "github_sha_at_freeze":os.environ.get("GITHUB_SHA") if target else None
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    FREEZE.write_text(json.dumps(freeze,indent=2,sort_keys=True)+"\n")
    print(json.dumps({
      "state":result["market_closeout_state"],
      "source_rows":len(df),"oof_rows":len(oof),
      "features":len(nums)+len(cats),
      "selected":selected
    },indent=2))

if __name__=="__main__":
    main()
