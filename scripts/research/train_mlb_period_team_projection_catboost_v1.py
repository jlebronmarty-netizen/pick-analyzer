#!/usr/bin/env python3
from __future__ import annotations

import json, math, os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
from catboost import CatBoostRegressor

SEED=20260921
EDGE_URL="https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-period-team-projection-github-export-temp"
CONTRACT="MLB_PERIOD_TEAM_PROJECTION_GITHUB_EXPORT_V1/1.0.0"
MAX_DATE=pd.Timestamp("2026-09-18")
OUT=Path("artifacts/research/mlb_period_team_projection_catboost_v1.json")

SPECS=[
  {"id":"depth4","depth":4,"iterations":450,"learning_rate":0.035,"l2_leaf_reg":7.0,"random_strength":1.0},
  {"id":"depth6","depth":6,"iterations":450,"learning_rate":0.035,"l2_leaf_reg":7.0,"random_strength":1.0},
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

def fetch_mode(token:str, mode:str)->list[dict[str,Any]]:
    rows=[]
    offset=0
    while True:
        r=requests.post(
            EDGE_URL,
            headers={"x-github-oidc-token":token,"Content-Type":"application/json"},
            json={"mode":mode,"offset":offset,"limit":250},
            timeout=180,
        )
        if not r.ok:
            raise RuntimeError(f"EXPORT_HTTP_{r.status_code}:{r.text[:800]}")
        p=r.json()
        checks=[
            (p.get("contract")==CONTRACT,"contract"),
            (p.get("mode")==mode,"mode"),
            (p.get("historicalMaxGameDate")=="2026-09-18","cutoff"),
            (p.get("researchOnly") is True,"research"),
            (p.get("providerCallsMade")==0,"provider"),
            (p.get("oddsApiHistoricalCreditsConsumed")==0,"credits"),
            (p.get("officialPicksWrites")==0,"official"),
            (p.get("apostarActivation") is False,"apostar"),
            (p.get("productionPromotion") is False,"production"),
        ]
        bad=[n for ok,n in checks if not ok]
        if bad: raise RuntimeError("EXPORT_CONTRACT:"+",".join(bad))
        batch=p.get("rows") or []
        rows.extend(batch)
        offset += int(p.get("scannedRows") or 0)
        if not p.get("hasMore"): break
        if offset>10000: raise RuntimeError("EXPORT_PAGINATION_GUARD")
    return rows

def frame(rows:list[dict[str,Any]])->pd.DataFrame:
    df=pd.DataFrame(rows)
    if df.empty: raise RuntimeError("EMPTY_EXPORT")
    df["game_date"]=pd.to_datetime(df["game_date"])
    if (df["game_date"]>MAX_DATE).any(): raise RuntimeError("DATE_CUTOFF_BREACH")
    cutoff=pd.to_datetime(df["feature_cutoff_date"],errors="coerce")
    if cutoff.notna().any() and (cutoff>=df["game_date"]).any(): raise RuntimeError("FEATURE_CUTOFF_BREACH")
    return df.sort_values(["game_date","game_pk"]).reset_index(drop=True)

def feature_lists(df:pd.DataFrame):
    cats=[]
    nums=[]
    dropped=[]
    for c in df.columns:
        if c in META or c in TARGETS: continue
        if c in CATS:
            cats.append(c); continue
        s=pd.to_numeric(df[c],errors="coerce")
        if s.notna().sum()>=max(150,int(.20*len(df))):
            nums.append(c)
        else:
            dropped.append(c)
    return sorted(nums),sorted(cats),sorted(dropped)

def make_x(df,nums,cats):
    x=pd.DataFrame(index=df.index)
    for c in nums: x[c]=pd.to_numeric(df[c],errors="coerce")
    for c in cats: x[c]=df[c].where(df[c].notna(),"__MISSING__").astype(str)
    return x

def model(spec,seed_offset=0):
    p={k:v for k,v in spec.items() if k!="id"}
    return CatBoostRegressor(
      random_seed=SEED+seed_offset,loss_function="RMSE",eval_metric="RMSE",
      verbose=False,allow_writing_files=False,thread_count=-1,**p
    )

def metrics(y,pred,dates=None):
    y=np.asarray(y,float); pred=np.asarray(pred,float)
    err=pred-y
    out={
      "n":int(len(y)),
      "mae":float(np.mean(np.abs(err))),
      "rmse":float(np.sqrt(np.mean(err**2))),
      "bias":float(np.mean(err)),
      "residual_sd":float(np.std(err,ddof=0)),
      "residual_quantiles":{str(q):float(np.quantile(err,q)) for q in [.05,.10,.25,.50,.75,.90,.95]},
    }
    if dates is not None:
      tmp=pd.DataFrame({"date":pd.to_datetime(dates),"y":y,"pred":pred})
      tmp["month"]=tmp["date"].dt.strftime("%Y-%m")
      out["monthly"]={}
      for m,g in tmp.groupby("month"):
        e=g["pred"].to_numpy()-g["y"].to_numpy()
        out["monthly"][m]={
          "n":int(len(g)),
          "mae":float(np.mean(np.abs(e))),
          "rmse":float(np.sqrt(np.mean(e**2))),
        }
    return out

def run_f5(df,nums,cats):
    d=df.dropna(subset=["target_home_f5","target_away_f5"]).copy()
    d["target_margin"]=pd.to_numeric(d["target_home_f5"])-pd.to_numeric(d["target_away_f5"])
    x=make_x(d,nums,cats)
    oof={s["id"]:[] for s in SPECS}; oof["ensemble"]=[]
    truth=[]; dates=[]; fold_meta=[]
    for month,start_s,end_s in FOLDS:
        start,end=pd.Timestamp(start_s),pd.Timestamp(end_s)
        tr=(d["season"]==2025)&(d["game_date"]<start)
        va=(d["season"]==2025)&(d["game_date"]>=start)&(d["game_date"]<end)
        if tr.sum()<300 or va.sum()<100: raise RuntimeError(f"F5_SMALL_FOLD:{month}:{tr.sum()}:{va.sum()}")
        ps=[]
        for i,spec in enumerate(SPECS):
            m=model(spec,i)
            m.fit(x.loc[tr],d.loc[tr,"target_margin"].to_numpy(float),cat_features=cats)
            p=np.asarray(m.predict(x.loc[va]),float); ps.append(p); oof[spec["id"]].extend(p.tolist())
        oof["ensemble"].extend(np.mean(np.vstack(ps),axis=0).tolist())
        truth.extend(d.loc[va,"target_margin"].astype(float).tolist())
        dates.extend(d.loc[va,"game_date"].astype(str).tolist())
        fold_meta.append({"month":month,"train_n":int(tr.sum()),"validation_n":int(va.sum())})
    dev={k:metrics(truth,v,dates) for k,v in oof.items()}
    champ=min(dev,key=lambda k:(dev[k]["mae"],k))
    train=d["season"]==2025; ext=d["season"]==2026
    final_preds=[]
    chosen_specs=SPECS if champ=="ensemble" else [s for s in SPECS if s["id"]==champ]
    for i,spec in enumerate(chosen_specs):
        m=model(spec,100+i)
        m.fit(x.loc[train],d.loc[train,"target_margin"].to_numpy(float),cat_features=cats)
        final_preds.append(np.asarray(m.predict(x.loc[ext]),float))
    pred=np.mean(np.vstack(final_preds),axis=0)
    extm=metrics(d.loc[ext,"target_margin"].to_numpy(float),pred,d.loc[ext,"game_date"].astype(str).tolist())
    nonpush=d.loc[ext,"target_margin"].to_numpy(float)!=0
    if nonpush.any():
        yt=d.loc[ext,"target_margin"].to_numpy(float)[nonpush]
        pp=pred[nonpush]
        extm["sign_accuracy_nonpush"]=float(np.mean(np.sign(yt)==np.sign(pp)))
        extm["nonpush_n"]=int(nonpush.sum())
    return {"champion_selected_on_2025_oof_mae":champ,"development_2025_oof":dev,"external_2026":extm,"folds":fold_meta}

def run_team(df,nums,cats):
    d=df.dropna(subset=["target_home_runs","target_away_runs"]).copy()
    x=make_x(d,nums,cats)
    dev_by={}
    fold_meta=[]
    store={s["id"]:{"home":[],"away":[]} for s in SPECS}; store["ensemble"]={"home":[],"away":[]}
    truth_home=[]; truth_away=[]; dates=[]
    for month,start_s,end_s in FOLDS:
        start,end=pd.Timestamp(start_s),pd.Timestamp(end_s)
        tr=(d["season"]==2025)&(d["game_date"]<start)
        va=(d["season"]==2025)&(d["game_date"]>=start)&(d["game_date"]<end)
        if tr.sum()<300 or va.sum()<100: raise RuntimeError(f"TEAM_SMALL_FOLD:{month}:{tr.sum()}:{va.sum()}")
        ph=[]; pa=[]
        for i,spec in enumerate(SPECS):
            mh=model(spec,200+i); ma=model(spec,300+i)
            mh.fit(x.loc[tr],d.loc[tr,"target_home_runs"].to_numpy(float),cat_features=cats)
            ma.fit(x.loc[tr],d.loc[tr,"target_away_runs"].to_numpy(float),cat_features=cats)
            h=np.asarray(mh.predict(x.loc[va]),float); a=np.asarray(ma.predict(x.loc[va]),float)
            ph.append(h); pa.append(a); store[spec["id"]]["home"].extend(h.tolist()); store[spec["id"]]["away"].extend(a.tolist())
        store["ensemble"]["home"].extend(np.mean(np.vstack(ph),axis=0).tolist())
        store["ensemble"]["away"].extend(np.mean(np.vstack(pa),axis=0).tolist())
        truth_home.extend(d.loc[va,"target_home_runs"].astype(float).tolist()); truth_away.extend(d.loc[va,"target_away_runs"].astype(float).tolist())
        dates.extend(d.loc[va,"game_date"].astype(str).tolist())
        fold_meta.append({"month":month,"train_n":int(tr.sum()),"validation_n":int(va.sum())})
    for k,v in store.items():
        hm=metrics(truth_home,v["home"],dates); am=metrics(truth_away,v["away"],dates)
        dev_by[k]={"home":hm,"away":am,"combined_mae":float((hm["mae"]+am["mae"])/2)}
    champ=min(dev_by,key=lambda k:(dev_by[k]["combined_mae"],k))
    train=d["season"]==2025; ext=d["season"]==2026
    chosen=SPECS if champ=="ensemble" else [s for s in SPECS if s["id"]==champ]
    hs=[]; aas=[]
    for i,spec in enumerate(chosen):
        mh=model(spec,400+i); ma=model(spec,500+i)
        mh.fit(x.loc[train],d.loc[train,"target_home_runs"].to_numpy(float),cat_features=cats)
        ma.fit(x.loc[train],d.loc[train,"target_away_runs"].to_numpy(float),cat_features=cats)
        hs.append(np.asarray(mh.predict(x.loc[ext]),float)); aas.append(np.asarray(ma.predict(x.loc[ext]),float))
    hp=np.mean(np.vstack(hs),axis=0); ap=np.mean(np.vstack(aas),axis=0)
    hm=metrics(d.loc[ext,"target_home_runs"].to_numpy(float),hp,d.loc[ext,"game_date"].astype(str).tolist())
    am=metrics(d.loc[ext,"target_away_runs"].to_numpy(float),ap,d.loc[ext,"game_date"].astype(str).tolist())
    return {
      "champion_selected_on_2025_oof_combined_mae":champ,
      "development_2025_oof":dev_by,
      "external_2026":{"home":hm,"away":am,"combined_mae":float((hm["mae"]+am["mae"])/2)},
      "folds":fold_meta,
    }

def main():
    token=os.environ.get("GITHUB_OIDC_TOKEN","").strip()
    if not token: raise RuntimeError("OIDC_MISSING")
    f5=frame(fetch_mode(token,"f5_margin")); team=frame(fetch_mode(token,"team_runs"))
    f5_nums,f5_cats,f5_drop=feature_lists(f5); t_nums,t_cats,t_drop=feature_lists(team)
    result={
      "contract":"MLB_PERIOD_TEAM_PROJECTION_CATBOOST_V1_RESULT/1.0.0",
      "state":"RESEARCH_ONLY_PROJECTION_ONLY_NO_REAL_LINE_CERTIFICATION",
      "selection_policy":"2025 rolling OOF MAE only; 2026 opened after champion selection for historical diagnostic only",
      "external_2026_class":"HISTORICAL_2026_SEEN_DIAGNOSTIC_NOT_PRISTINE_HOLDOUT",
      "f5_margin":{"source_rows":len(f5),"numeric_features":f5_nums,"categorical_features":f5_cats,"dropped":f5_drop,**run_f5(f5,f5_nums,f5_cats)},
      "team_runs":{"source_rows":len(team),"numeric_features":t_nums,"categorical_features":t_cats,"dropped":t_drop,**run_team(team,t_nums,t_cats)},
      "provider_calls_made":0,"odds_api_historical_credits_consumed":0,
      "official_picks_writes":0,"apostar_activation":False,"production_promotion":False,
      "real_line_backtest_performed":False,
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    print(json.dumps({
      "f5_champion":result["f5_margin"]["champion_selected_on_2025_oof_mae"],
      "f5_dev":result["f5_margin"]["development_2025_oof"][result["f5_margin"]["champion_selected_on_2025_oof_mae"]],
      "f5_external":result["f5_margin"]["external_2026"],
      "team_champion":result["team_runs"]["champion_selected_on_2025_oof_combined_mae"],
      "team_dev":result["team_runs"]["development_2025_oof"][result["team_runs"]["champion_selected_on_2025_oof_combined_mae"]],
      "team_external":result["team_runs"]["external_2026"],
    },indent=2))

if __name__=="__main__":
    main()
