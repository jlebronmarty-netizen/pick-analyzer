#!/usr/bin/env python3
"""MLB Game Totals second-pass revisit — historical-seen rolling development.

Governance:
- MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0
- Development only: 2025 + eligible 2026 through 2026-09-18.
- No 2026-09-19 rows.
- No 2026-09-20+ forward outcomes.
- No provider calls and zero historical Odds API credits.
- Freeze only if the historical rolling candidate clears the frozen gate.
"""

from __future__ import annotations

import json
import math
import os
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
from catboost import CatBoostClassifier, CatBoostRegressor

SEED = 20260919
EDGE_URL = "https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-totals-revisit-github-export-temp"
EDGE_CONTRACT = "MLB_TOTALS_REVISIT_GITHUB_EXPORT/1.0.0"
PROTOCOL = "MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0"
MAX_HIST_DATE = pd.Timestamp("2026-09-18")
FORWARD_MIN_DATE = pd.Timestamp("2026-09-20")

OUT = Path("artifacts/research/mlb_totals_revisit_v1_result.json")
FREEZE = Path("artifacts/research/mlb_totals_revisit_v1_frozen_candidate.json")

TARGET_ACC = 0.75
MIN_N = 60
MIN_MONTHS = 5
MIN_WORST_MONTH = 0.65

FOLDS = [
    ("2025-05", "2025-05-01", "2025-06-01"),
    ("2025-06", "2025-06-01", "2025-07-01"),
    ("2025-07", "2025-07-01", "2025-08-01"),
    ("2025-08", "2025-08-01", "2025-09-01"),
    ("2025-09", "2025-09-01", "2025-10-01"),
    ("2026-04", "2026-04-01", "2026-05-01"),
    ("2026-05", "2026-05-01", "2026-06-01"),
    ("2026-06", "2026-06-01", "2026-07-01"),
    ("2026-07", "2026-07-01", "2026-08-01"),
    ("2026-08", "2026-08-01", "2026-09-01"),
    ("2026-09", "2026-09-01", "2026-10-01"),
]

SPECS = [
    {"depth": 4, "iterations": 350, "learning_rate": 0.035, "l2_leaf_reg": 7.0, "random_strength": 1.0},
    {"depth": 6, "iterations": 350, "learning_rate": 0.035, "l2_leaf_reg": 7.0, "random_strength": 1.0},
]

PROB_THRESHOLDS = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90]
EDGE_THRESHOLDS = [0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 2.00]
MODES = ["two_sided", "over_only", "under_only"]

CATEGORICAL_CANDIDATES = {
    "home_team", "away_team", "day_night", "home_sp_hand", "away_sp_hand",
    "wind_direction", "precip", "sky", "roof_status", "venue",
    "home_sp_primary_pitch", "home_sp_secondary_pitch",
    "away_sp_primary_pitch", "away_sp_secondary_pitch",
    "pregame_integrity_tier",
}

BLOCK_EXACT = {
    "actual_winner", "canonical_game_id", "source_game_id", "game_pk", "game_date",
    "season", "feature_cutoff_date", "feature_version", "start_time_local",
    "home_sp_retrosheet_id", "away_sp_retrosheet_id",
    "home_sp_mlbam_id", "away_sp_mlbam_id",
    "home_sp_name", "away_sp_name", "home_plate_umpire",
}
BLOCK_PREFIXES = ("actual_", "postgame_", "final_")
BLOCK_PROVENANCE = {
    "current_inputs_reconstructed", "has_statcast", "has_lineup", "has_starters",
    "has_weather", "has_umpire", "has_odds", "data_completeness_pct",
}

def fetch_rows(token: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    expected_total: int | None = None
    while True:
        r = requests.post(
            EDGE_URL,
            headers={"x-github-oidc-token": token, "Content-Type": "application/json"},
            json={"offset": offset, "limit": 250},
            timeout=180,
        )
        if not r.ok:
            raise RuntimeError(f"REVISIT_EXPORT_HTTP_{r.status_code}:{r.text[:800]}")
        p = r.json()
        checks = [
            (p.get("contract") == EDGE_CONTRACT, "contract"),
            (p.get("researchOnly") is True, "research"),
            (p.get("historicalMaxGameDate") == "2026-09-18", "cutoff"),
            (p.get("externalForwardIncluded") is False, "forward"),
            (p.get("providerCallsMade") == 0, "provider_calls"),
            (p.get("oddsApiHistoricalCreditsConsumed") == 0, "credits"),
            (p.get("officialPicksWrites") == 0, "official"),
            (p.get("apostarActivation") is False, "apostar"),
            (p.get("productionPromotion") is False, "production"),
        ]
        bad = [name for ok, name in checks if not ok]
        if bad:
            raise RuntimeError("REVISIT_EXPORT_CONTRACT_INVALID:" + ",".join(bad))
        if expected_total is None:
            expected_total = int(p["totalRows"])
        elif expected_total != int(p["totalRows"]):
            raise RuntimeError("REVISIT_EXPORT_TOTAL_CHANGED")
        batch = p.get("rows") or []
        rows.extend(batch)
        offset += len(batch)
        if not batch or offset >= expected_total:
            break
    if expected_total is None or len(rows) != expected_total:
        raise RuntimeError(f"REVISIT_EXPORT_COUNT_MISMATCH:{len(rows)}:{expected_total}")
    return rows

def american_implied(x: Any) -> float:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return float("nan")
    if not math.isfinite(v) or abs(v) < 100:
        return float("nan")
    return (-v) / ((-v) + 100.0) if v < 0 else 100.0 / (v + 100.0)

def build_frame(rows: list[dict[str, Any]]) -> pd.DataFrame:
    flat = []
    for r in rows:
        payload = dict(r.get("payload") or {})
        if any(k == "actual_winner" or k.startswith(BLOCK_PREFIXES) for k in payload):
            raise RuntimeError("POSTGAME_KEY_IN_PAYLOAD")
        d = payload
        d["_season"] = int(r["season"])
        d["_game_pk"] = int(r["game_pk"])
        d["_game_date"] = r["game_date"]
        d["_y_total_runs"] = r["y_total_runs"]
        d["_y_close_margin"] = r["y_close_margin"]
        d["_label"] = r["close_over_label"]
        d["_market_lineage"] = r["market_lineage"]
        d["_development_class"] = r["development_class"]
        d["_research_only"] = r["research_only"]
        flat.append(d)
    df = pd.DataFrame(flat)
    df["_game_date"] = pd.to_datetime(df["_game_date"])
    if (df["_game_date"] > MAX_HIST_DATE).any():
        raise RuntimeError("HISTORICAL_CUTOFF_BREACH")
    if (df["_game_date"] == pd.Timestamp("2026-09-19")).any():
        raise RuntimeError("QUARANTINE_DATE_BREACH")
    if (df["_game_date"] >= FORWARD_MIN_DATE).any():
        raise RuntimeError("FORWARD_OUTCOME_BREACH")
    if not (df["_development_class"] == "HISTORICAL_SEEN_DEVELOPMENT").all():
        raise RuntimeError("DEVELOPMENT_CLASS_BREACH")
    if not df["_research_only"].fillna(False).astype(bool).all():
        raise RuntimeError("RESEARCH_ONLY_BREACH")

    cutoff = pd.to_datetime(df.get("feature_cutoff_date"), errors="coerce")
    if cutoff.notna().any() and (cutoff >= df["_game_date"]).any():
        raise RuntimeError("STRICT_PRIOR_DATE_BREACH")
    return df.sort_values(["_game_date", "_game_pk"]).reset_index(drop=True)

def choose_features(df: pd.DataFrame) -> tuple[list[str], list[str], list[str]]:
    meta = {c for c in df.columns if c.startswith("_")}
    candidates = [
        c for c in df.columns
        if c not in meta
        and c not in BLOCK_EXACT
        and c not in BLOCK_PROVENANCE
        and not c.startswith(BLOCK_PREFIXES)
        and not c.startswith("source_")
    ]
    cats: list[str] = []
    nums: list[str] = []
    dropped: list[str] = []
    for c in candidates:
        if c in CATEGORICAL_CANDIDATES:
            cats.append(c)
            continue
        s = pd.to_numeric(df[c], errors="coerce")
        nonnull = int(s.notna().sum())
        if nonnull >= max(100, int(0.20 * len(df))):
            nums.append(c)
        else:
            dropped.append(c)
    if "close_total" not in nums:
        raise RuntimeError("CLOSE_TOTAL_FEATURE_MISSING")
    return sorted(nums), sorted(cats), sorted(dropped)

def make_x(df: pd.DataFrame, nums: list[str], cats: list[str]) -> pd.DataFrame:
    x = pd.DataFrame(index=df.index)
    for c in nums:
        x[c] = pd.to_numeric(df[c], errors="coerce")
    for c in cats:
        x[c] = df[c].where(df[c].notna(), "__MISSING__").astype(str)
    return x

def clf(params: dict[str, Any], seed_offset: int) -> CatBoostClassifier:
    return CatBoostClassifier(
        random_seed=SEED + seed_offset,
        loss_function="Logloss",
        eval_metric="Logloss",
        verbose=False,
        allow_writing_files=False,
        thread_count=-1,
        **params,
    )

def reg(params: dict[str, Any], seed_offset: int) -> CatBoostRegressor:
    return CatBoostRegressor(
        random_seed=SEED + seed_offset,
        loss_function="RMSE",
        eval_metric="RMSE",
        verbose=False,
        allow_writing_files=False,
        thread_count=-1,
        **params,
    )

def mode_mask(p: np.ndarray, mode: str, threshold: float) -> tuple[np.ndarray, np.ndarray]:
    pred = (p >= 0.5).astype(int)
    if mode == "two_sided":
        mask = (p >= threshold) | (p <= 1.0 - threshold)
    elif mode == "over_only":
        mask = p >= threshold
        pred = np.ones(len(p), dtype=int)
    elif mode == "under_only":
        mask = p <= 1.0 - threshold
        pred = np.zeros(len(p), dtype=int)
    else:
        raise ValueError(mode)
    return mask, pred

def edge_mask(edge: np.ndarray, mode: str, threshold: float) -> tuple[np.ndarray, np.ndarray]:
    pred = (edge >= 0).astype(int)
    if mode == "two_sided":
        mask = np.abs(edge) >= threshold
    elif mode == "over_only":
        mask = edge >= threshold
        pred = np.ones(len(edge), dtype=int)
    elif mode == "under_only":
        mask = edge <= -threshold
        pred = np.zeros(len(edge), dtype=int)
    else:
        raise ValueError(mode)
    return mask, pred

def summarize(oof: pd.DataFrame, mask: np.ndarray, pred: np.ndarray, config: dict[str, Any]) -> dict[str, Any] | None:
    z = oof.loc[mask].copy()
    if z.empty:
        return None
    z["pred"] = pred[mask]
    z["correct"] = (z["pred"].astype(int) == z["truth"].astype(int)).astype(int)
    monthly = {}
    for month, grp in z.groupby("month", sort=True):
        monthly[month] = {
            "n": int(len(grp)),
            "correct": int(grp["correct"].sum()),
            "accuracy": float(grp["correct"].mean()),
        }
    n = int(len(z))
    correct = int(z["correct"].sum())
    acc = correct / n
    month_accs = [v["accuracy"] for v in monthly.values()]
    worst = min(month_accs) if month_accs else 0.0
    months = len(monthly)
    truth_mean = float(z["truth"].mean())
    majority = max(truth_mean, 1.0 - truth_mean)

    market_valid = z["market_pred"].notna()
    market_acc = None
    if market_valid.any():
        market_acc = float((z.loc[market_valid, "market_pred"].astype(int) == z.loc[market_valid, "truth"].astype(int)).mean())

    gate_sample = n >= MIN_N and months >= MIN_MONTHS
    target = gate_sample and acc >= TARGET_ACC and worst >= MIN_WORST_MONTH

    return {
        **config,
        "n": n,
        "correct": correct,
        "accuracy": acc,
        "coverage_vs_oof_nonpush": n / len(oof),
        "months_with_selections": months,
        "min_month_n": min(v["n"] for v in monthly.values()),
        "worst_month_accuracy": worst,
        "monthly_accuracy_sd": float(np.std(month_accs, ddof=0)),
        "monthly": monthly,
        "sample_gate_met": gate_sample,
        "target_met_75_plus": target,
        "selected_majority_baseline": majority,
        "lift_vs_selected_majority": acc - majority,
        "market_juice_side_accuracy": market_acc,
    }

def rank_key(c: dict[str, Any]) -> tuple:
    return (
        1 if c["target_met_75_plus"] else 0,
        1 if c["sample_gate_met"] else 0,
        c["worst_month_accuracy"],
        c["accuracy"],
        c["months_with_selections"],
        c["min_month_n"],
        c["n"],
    )

def main() -> None:
    token = os.environ.get("GITHUB_OIDC_TOKEN", "").strip()
    if not token:
        raise RuntimeError("REVISIT_OIDC_MISSING")

    rows = fetch_rows(token)
    df = build_frame(rows)
    nums, cats, dropped = choose_features(df)
    x = make_x(df, nums, cats)
    cat_features = cats

    oof_rows: list[dict[str, Any]] = []
    fold_meta = []

    for month, start_s, end_s in FOLDS:
        start, end = pd.Timestamp(start_s), pd.Timestamp(end_s)
        train_all_mask = df["_game_date"] < start
        val_mask = (df["_game_date"] >= start) & (df["_game_date"] < end) & df["_label"].notna()
        train_cls_mask = train_all_mask & df["_label"].notna()
        train_reg_mask = train_all_mask & df["_y_total_runs"].notna()

        train_cls_n = int(train_cls_mask.sum())
        train_reg_n = int(train_reg_mask.sum())
        val_n = int(val_mask.sum())
        if train_cls_n < 350 or train_reg_n < 350 or val_n < 40:
            raise RuntimeError(f"REVISIT_SMALL_FOLD:{month}:{train_cls_n}:{train_reg_n}:{val_n}")

        xv = x.loc[val_mask]
        p_ens = np.zeros(val_n, dtype=float)
        total_ens = np.zeros(val_n, dtype=float)

        for si, params in enumerate(SPECS):
            cm = clf(params, si)
            cm.fit(
                x.loc[train_cls_mask],
                df.loc[train_cls_mask, "_label"].astype(int).to_numpy(),
                cat_features=cat_features,
            )
            p_ens += np.asarray(cm.predict_proba(xv)[:, 1], dtype=float) / len(SPECS)

            rm = reg(params, 100 + si)
            rm.fit(
                x.loc[train_reg_mask],
                pd.to_numeric(df.loc[train_reg_mask, "_y_total_runs"], errors="coerce").to_numpy(float),
                cat_features=cat_features,
            )
            total_ens += np.asarray(rm.predict(xv), dtype=float) / len(SPECS)

        v = df.loc[val_mask].copy().reset_index(drop=True)
        close_total = pd.to_numeric(v["close_total"], errors="coerce").to_numpy(float)
        reg_edge = total_ens - close_total

        over_imp = np.array([american_implied(vv) for vv in v["close_over_price"]], dtype=float)
        under_imp = np.array([american_implied(vv) for vv in v["close_under_price"]], dtype=float)
        denom = over_imp + under_imp
        market_prob = np.where(np.isfinite(denom) & (denom > 0), over_imp / denom, np.nan)
        market_pred = np.where(np.isfinite(market_prob), (market_prob >= 0.5).astype(float), np.nan)

        for i in range(val_n):
            oof_rows.append({
                "month": month,
                "game_pk": int(v.loc[i, "_game_pk"]),
                "game_date": str(v.loc[i, "_game_date"].date()),
                "season": int(v.loc[i, "_season"]),
                "truth": int(v.loc[i, "_label"]),
                "p_over": float(p_ens[i]),
                "pred_total": float(total_ens[i]),
                "reg_edge": float(reg_edge[i]),
                "close_total": float(close_total[i]),
                "market_over_prob": None if not np.isfinite(market_prob[i]) else float(market_prob[i]),
                "market_pred": None if not np.isfinite(market_pred[i]) else int(market_pred[i]),
                "market_lineage": str(v.loc[i, "_market_lineage"]),
            })

        fold_meta.append({
            "month": month,
            "train_classifier_n": train_cls_n,
            "train_regression_n": train_reg_n,
            "validation_nonpush_n": val_n,
            "train_end": str(df.loc[train_all_mask, "_game_date"].max().date()),
            "validation_start": start_s,
            "validation_end_exclusive": end_s,
        })

    oof = pd.DataFrame(oof_rows)
    if len(oof) < 2500:
        raise RuntimeError(f"REVISIT_OOF_TOO_SMALL:{len(oof)}")

    p = oof["p_over"].to_numpy(float)
    e = oof["reg_edge"].to_numpy(float)
    market_pred_arr = pd.to_numeric(oof["market_pred"], errors="coerce").to_numpy(float)

    candidates: list[dict[str, Any]] = []

    for mode in MODES:
        for t in PROB_THRESHOLDS:
            mask, pred = mode_mask(p, mode, t)
            s = summarize(oof, mask, pred, {
                "architecture": "catboost_classifier_ensemble",
                "mode": mode,
                "prob_threshold": t,
                "edge_threshold": None,
                "market_agreement_required": False,
            })
            if s:
                candidates.append(s)

        for et in EDGE_THRESHOLDS:
            mask, pred = edge_mask(e, mode, et)
            s = summarize(oof, mask, pred, {
                "architecture": "catboost_total_regression_ensemble",
                "mode": mode,
                "prob_threshold": None,
                "edge_threshold": et,
                "market_agreement_required": False,
            })
            if s:
                candidates.append(s)

        for t in PROB_THRESHOLDS:
            cmask, cpred = mode_mask(p, mode, t)
            for et in EDGE_THRESHOLDS:
                emask, epred = edge_mask(e, mode, et)
                agree = cpred == epred
                mask = cmask & emask & agree
                s = summarize(oof, mask, cpred, {
                    "architecture": "catboost_classifier_regression_agreement",
                    "mode": mode,
                    "prob_threshold": t,
                    "edge_threshold": et,
                    "market_agreement_required": False,
                })
                if s:
                    candidates.append(s)

                market_valid = np.isfinite(market_pred_arr)
                market_agree = market_valid & (cpred == market_pred_arr.astype(int))
                mask3 = mask & market_agree
                s3 = summarize(oof, mask3, cpred, {
                    "architecture": "catboost_classifier_regression_market_agreement",
                    "mode": mode,
                    "prob_threshold": t,
                    "edge_threshold": et,
                    "market_agreement_required": True,
                })
                if s3:
                    candidates.append(s3)

    eligible = [c for c in candidates if c["sample_gate_met"]]
    if not eligible:
        raise RuntimeError("REVISIT_NO_SAMPLE_ELIGIBLE_CANDIDATE")
    eligible.sort(key=rank_key, reverse=True)
    selected = eligible[0]
    target_met = bool(selected["target_met_75_plus"])

    top = sorted(eligible, key=rank_key, reverse=True)[:30]
    source_counts = (
        df.groupby(["_season", "_market_lineage"]).size().reset_index(name="n")
        .to_dict(orient="records")
    )

    result = {
        "contract": "MLB_TOTALS_REVISIT_V1_RESULT/1.0.0",
        "protocol": PROTOCOL,
        "research_only": True,
        "development_class": "HISTORICAL_SEEN_DEVELOPMENT",
        "historical_max_allowed_game_date": "2026-09-18",
        "actual_max_game_date_used": str(df["_game_date"].max().date()),
        "source_rows": len(df),
        "source_counts": source_counts,
        "nonpush_oof_rows": len(oof),
        "folds": fold_meta,
        "feature_count_numeric": len(nums),
        "feature_count_categorical": len(cats),
        "numeric_features": nums,
        "categorical_features": cats,
        "dropped_non_numeric_sparse_fields": dropped,
        "architecture_family": "rolling_catboost_classifier_total_regression_ensemble_v1",
        "specs": SPECS,
        "selected_candidate": selected,
        "target_met_75_plus": target_met,
        "market_closeout_state": (
            "TARGET_MET_75_PLUS_FREEZE_READY"
            if target_met
            else "REVISIT_SECOND_PASS_BELOW_75"
        ),
        "top_candidates": top,
        "forward_2026_09_20_plus_opened": False,
        "forward_used_for_selection": False,
        "quarantine_2026_09_19_used": False,
        "provider_calls_made": 0,
        "odds_api_historical_credits_consumed": 0,
        "official_picks_writes": 0,
        "apostar_activation": False,
        "production_promotion": False,
        "github_sha_at_run": os.environ.get("GITHUB_SHA"),
    }

    freeze = {
        "contract": "MLB_TOTALS_REVISIT_V1_FROZEN_CANDIDATE/1.0.0",
        "protocol": PROTOCOL,
        "frozen": target_met,
        "forward_eligible": target_met,
        "reason": (
            "Historical rolling gate met before prospective 2026-09-20+ evaluation."
            if target_met
            else "Best historical candidate preserved for tracker only; 75% gate not met, so no forward candidate is activated."
        ),
        "candidate": selected,
        "architecture_family": result["architecture_family"],
        "specs": SPECS,
        "numeric_features": nums if target_met else [],
        "categorical_features": cats if target_met else [],
        "historical_max_allowed_game_date": "2026-09-18",
        "actual_max_game_date_used": result["actual_max_game_date_used"],
        "forward_min_game_date": "2026-09-20",
        "forward_outcomes_opened": False,
        "odds_api_historical_credits_consumed": 0,
        "official_picks_writes": 0,
        "apostar_activation": False,
        "production_promotion": False,
        "github_sha_at_freeze": os.environ.get("GITHUB_SHA") if target_met else None,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    FREEZE.write_text(json.dumps(freeze, indent=2, sort_keys=True) + "\n")

    print(json.dumps({
        "state": result["market_closeout_state"],
        "source_rows": result["source_rows"],
        "oof_nonpush_rows": result["nonpush_oof_rows"],
        "features": len(nums) + len(cats),
        "selected": selected,
    }, indent=2))

if __name__ == "__main__":
    main()
