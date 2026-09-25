#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

import train_mlb_f5_ml_revisit_v1 as base

OUT=Path("artifacts/research/mlb_f5_spread_transfer_diagnostic_v1.json")
THRESHOLD=0.75
TARGETS={
  777909:(-0.5,0.5),777911:(-0.5,0.5),777912:(-1.5,1.5),777913:(-0.5,0.5),777910:(-0.5,0.5),777946:(-1.5,1.5),
  777505:(-0.5,0.5),777504:(-1.5,1.5),777501:(-0.5,0.5),777500:(1.5,-1.5),777503:(-0.5,0.5),777499:(-0.5,0.5),777502:(-0.5,0.5),777494:(-0.5,0.5),
  776737:(-0.5,0.5),776740:(0.5,-0.5),776739:(0.5,-0.5),776735:(0.5,-0.5),776738:(-0.5,0.5),776741:(-0.5,0.5),776736:(-0.5,0.5),776733:(-1.5,1.5),
}

def main():
    token=os.environ.get("GITHUB_OIDC_TOKEN","").strip()
    if not token:
        raise RuntimeError("F5_SPREAD_TRANSFER_OIDC_MISSING")

    raw=base.fetch_rows(token)
    df,missing=base.build_frame(raw)
    x,nums,cats,dropped=base.choose_features(df)

    preds=[]
    for month,start_s,end_s in base.FOLDS:
        start=pd.Timestamp(start_s); end=pd.Timestamp(end_s)
        va=(df["_game_date"]>=start)&(df["_game_date"]<end)
        target_mask=va & df["_game_pk"].isin(TARGETS.keys())
        if not target_mask.any():
            continue

        tr=(df["_game_date"]<start)&df["_y_home"].notna()
        if tr.sum()<300:
            raise RuntimeError(f"F5_SPREAD_TRANSFER_SMALL_FOLD:{month}:{tr.sum()}")

        xv=x.loc[target_mask]
        p=np.zeros(int(target_mask.sum()),float)
        for si,params in enumerate(base.SPECS):
            m=base.model(params,si)
            m.fit(x.loc[tr],df.loc[tr,"_y_home"].astype(int).to_numpy(),cat_features=cats)
            p+=np.asarray(m.predict_proba(xv)[:,1],float)/len(base.SPECS)

        v=df.loc[target_mask].reset_index(drop=True)
        p=np.asarray(p,float)
        for i in range(len(v)):
            game_pk=int(v.loc[i,"_game_pk"])
            hp,ap=TARGETS[game_pk]
            home_wp=float(v.loc[i].get("home_win_pct")) if pd.notna(v.loc[i].get("home_win_pct")) else np.nan
            away_wp=float(v.loc[i].get("away_win_pct")) if pd.notna(v.loc[i].get("away_win_pct")) else np.nan
            adv=home_wp-away_wp if np.isfinite(home_wp) and np.isfinite(away_wp) else np.nan
            pred_home=bool(p[i]>=0.5)
            confident=bool(p[i]>=THRESHOLD or p[i]<=1.0-THRESHOLD)
            sign_agree=bool(np.isfinite(adv) and adv!=0 and pred_home==(adv>0))
            selected=bool(confident and sign_agree)
            pick="HOME" if pred_home else "AWAY"
            home_f5=int(v.loc[i,"_home_f5"]); away_f5=int(v.loc[i,"_away_f5"])
            line=hp if pick=="HOME" else ap
            margin=(home_f5-away_f5 if pick=="HOME" else away_f5-home_f5)+line
            preds.append({
              "month":month,"game_pk":game_pk,"game_date":str(v.loc[i,"_game_date"].date()),
              "home_team":v.loc[i].get("home_team"),"away_team":v.loc[i].get("away_team"),
              "home_f5":home_f5,"away_f5":away_f5,
              "fanduel_home_line":hp,"fanduel_away_line":ap,
              "p_home":float(p[i]),"win_pct_advantage":None if not np.isfinite(adv) else float(adv),
              "predicted_side":pick,"confident_at_0p75":confident,"win_pct_sign_agreement":sign_agree,
              "selected":selected,
              "ats_margin":float(margin) if selected else None,
              "ats_result":("WIN" if margin>0 else "PUSH" if margin==0 else "LOSS") if selected else None,
            })

    selected=[r for r in preds if r["selected"]]
    wins=sum(r["ats_result"]=="WIN" for r in selected)
    losses=sum(r["ats_result"]=="LOSS" for r in selected)
    pushes=sum(r["ats_result"]=="PUSH" for r in selected)
    nonpush=wins+losses

    result={
      "contract":"MLB_F5_SPREAD_TRANSFER_DIAGNOSTIC_V1/1.0.0",
      "research_only":True,
      "source_candidate":{
        "architecture":"catboost_win_pct_sign_agreement",
        "probability_threshold":THRESHOLD,
        "source_market":"F5_ML",
        "source_result_accuracy":0.671875,
        "source_result_state":"REVISIT_SECOND_PASS_BELOW_75",
        "retuned_for_spread":False,
      },
      "target_market":"spreads_1st_5_innings",
      "line_source":"THE_ODDS_API_HISTORICAL_FANDUEL_T_MINUS_60_FROM_BOUNDED_SAMPLE",
      "target_games_requested":len(TARGETS),
      "target_games_scored":len(preds),
      "selected":len(selected),"wins":wins,"losses":losses,"pushes":pushes,
      "nonpush":nonpush,
      "ats_accuracy":None if nonpush==0 else wins/nonpush,
      "selection_coverage":None if not preds else len(selected)/len(preds),
      "rows":preds,
      "feature_count":len(nums)+len(cats),
      "missing_target_rows_excluded_fail_closed":missing,
      "odds_api_calls_made":0,
      "odds_api_historical_credits_consumed":0,
      "official_picks_writes":0,
      "apostar_activation":False,
      "production_promotion":False,
      "tracker_modified":False,
      "github_sha_at_run":os.environ.get("GITHUB_SHA"),
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    print(json.dumps({
      "selected":result["selected"],"wins":wins,"losses":losses,"pushes":pushes,
      "ats_accuracy":result["ats_accuracy"],"coverage":result["selection_coverage"],
      "scored":result["target_games_scored"]
    },indent=2))

if __name__=="__main__":
    main()
