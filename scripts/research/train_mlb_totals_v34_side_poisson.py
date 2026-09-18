#!/usr/bin/env python3
"""Research-only MLB Totals V34 side-specific CatBoost Poisson experiment.

Architecture:
- Same pregame V33 feature surface.
- Fit HOME runs and AWAY runs separately using CatBoost Poisson.
- Final HOME/AWAY runs are training/evaluation targets only, never features.
- Sum predicted run means and compare to real pregame closing total.

Protocol:
- Apr-May train only.
- June internal model/edge selection.
- Jul-Aug opened once only if frozen June candidate passes.
- 2026 never read.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
from catboost import CatBoostRegressor
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error

SEED = 20260917
TABLE = "mlb_totals_v34_side_poisson_dataset_2025_v1"
TARGET_LABEL = "close_over_label"
Y_HOME = "y_home_runs"
Y_AWAY = "y_away_runs"
CANDIDATE_NAME = "totals_v34_side_poisson_catboost_v1"
EDGE_URL = "https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-totals-v34-github-export-temp"
OUT = Path("artifacts/research/mlb_totals_v34_side_poisson_result.json")

TRAIN_START = pd.Timestamp("2025-04-01")
INTERNAL_START = pd.Timestamp("2025-06-01")
PREGATE_START = pd.Timestamp("2025-07-01")

CAT_FEATURES = ["cat_home_team", "cat_away_team", "cat_venue"]
META = {"game_pk", "game_date", TARGET_LABEL, "research_only", Y_HOME, Y_AWAY}
FORBIDDEN_FEATURES = {
    "total_runs", "home_runs", "away_runs", "actual_winner", "y_margin",
    "open_total_margin", "close_total_margin",
    "actual_offense_score", "actual_contact_score",
    "actual_starter_vulnerability_score", "actual_bullpen_vulnerability_score",
    "actual_defense_error_score", Y_HOME, Y_AWAY,
}
EDGE_THRESHOLDS = [0.5, 1.0, 1.5, 2.0]
MODES = ["two_sided", "over_only", "under_only"]

INTERNAL_N_MIN = 30
INTERNAL_HALF_N_MIN = 10
INTERNAL_ACC_MIN = 0.70
INTERNAL_WORST_HALF_MIN = 0.65

PREGATE_N_MIN = 30
PREGATE_MONTH_N_MIN = 10
PREGATE_ACC_MIN = 0.75
PREGATE_WORST_MONTH_MIN = 0.70


def base_result(status: str) -> dict[str, Any]:
    return {
        "contract": "MLB_TOTALS_V34_SIDE_POISSON_RESEARCH/1.0.0",
        "research_only": True,
        "candidate_name": CANDIDATE_NAME,
        "source_table": f"public.{TABLE}",
        "status": status,
        "official_picks_writes": 0,
        "apostar_activation": False,
        "production_promotion": False,
        "odds_api_historical_credits_consumed": 0,
        "2026_used_for_selection": False,
        "2026_opened_for_external_test": False,
        "jul_aug_opened": False,
        "target_only_fields": [Y_HOME, Y_AWAY],
    }


def write_result(result: dict[str, Any]) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def fetch_range(oidc_token: str, range_name: str) -> list[dict[str, Any]]:
    r = requests.post(
        EDGE_URL,
        headers={
            "x-github-oidc-token": oidc_token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={"range": range_name},
        timeout=120,
    )
    if not r.ok:
        raise RuntimeError(f"V34_EDGE_HTTP_{r.status_code}:{r.text[:1000]}")
    payload = r.json()
    checks = [
        (payload.get("contract") == "MLB_TOTALS_V34_GITHUB_EXPORT/1.0.0", "contract"),
        (payload.get("researchOnly") is True, "researchOnly"),
        (payload.get("sourceTable") == f"public.{TABLE}", "sourceTable"),
        (payload.get("range") == range_name, "range"),
        (payload.get("targetFields") == [Y_HOME, Y_AWAY], "targetFields"),
        (payload.get("officialPicksWrites") == 0, "Official Picks"),
        (payload.get("apostarActivation") is False, "APOSTAR"),
        (payload.get("productionPromotion") is False, "production"),
        (payload.get("oddsApiHistoricalCreditsConsumed") == 0, "Odds API credits"),
        (payload.get("external2026Included") is False, "2026"),
        (isinstance(payload.get("rows"), list), "rows"),
    ]
    bad = [name for ok, name in checks if not ok]
    if bad:
        raise RuntimeError("V34_EDGE_CONTRACT_INVALID:" + ",".join(bad))
    return payload["rows"]


def feature_frame(df: pd.DataFrame, features: list[str]) -> pd.DataFrame:
    out = pd.DataFrame(index=df.index)
    for feature in features:
        if feature in CAT_FEATURES:
            out[feature] = df[feature].fillna("__MISSING__").astype(str)
        else:
            out[feature] = pd.to_numeric(df[feature], errors="coerce")
    return out


def model_specs() -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []
    for depth in (4, 6):
        for iterations in (200, 400):
            for learning_rate in (0.03, 0.06):
                specs.append({
                    "depth": depth,
                    "iterations": iterations,
                    "learning_rate": learning_rate,
                    "l2_leaf_reg": 5.0,
                    "random_strength": 1.0,
                })
    return specs


def make_model(params: dict[str, Any]) -> CatBoostRegressor:
    return CatBoostRegressor(
        random_seed=SEED,
        loss_function="Poisson",
        eval_metric="Poisson",
        verbose=False,
        allow_writing_files=False,
        thread_count=-1,
        **params,
    )


def selection(edge: np.ndarray, mode: str, threshold: float) -> tuple[np.ndarray, np.ndarray]:
    if mode == "two_sided":
        mask = (edge >= threshold) | (edge <= -threshold)
        pred = (edge >= threshold).astype(int)
    elif mode == "over_only":
        mask = edge >= threshold
        pred = np.ones(len(edge), dtype=int)
    elif mode == "under_only":
        mask = edge <= -threshold
        pred = np.zeros(len(edge), dtype=int)
    else:
        raise ValueError(mode)
    return mask, pred


def evaluate_internal(
    edge: np.ndarray,
    validation: pd.DataFrame,
    mode: str,
    threshold: float,
    total_mae: float,
    total_rmse: float,
    full_accuracy: float,
) -> dict[str, Any] | None:
    y = validation[TARGET_LABEL].astype(int).to_numpy()
    mask, pred = selection(edge, mode, threshold)
    n = int(mask.sum())
    if n < INTERNAL_N_MIN:
        return None

    idx = np.flatnonzero(mask)
    y_sel = y[mask]
    pred_sel = pred[mask]
    dates = validation["game_date"].reset_index(drop=True).iloc[idx].reset_index(drop=True)
    correct = int((y_sel == pred_sel).sum())

    first = dates.dt.day.to_numpy() <= 15
    second = ~first
    n1, n2 = int(first.sum()), int(second.sum())
    if n1 < INTERNAL_HALF_N_MIN or n2 < INTERNAL_HALF_N_MIN:
        return None

    c1 = int((y_sel[first] == pred_sel[first]).sum())
    c2 = int((y_sel[second] == pred_sel[second]).sum())
    a1, a2 = c1 / n1, c2 / n2
    accuracy = correct / n
    worst = min(a1, a2)
    return {
        "mode": mode,
        "edge_threshold": threshold,
        "n": n,
        "correct": correct,
        "accuracy": accuracy,
        "first_half": {"n": n1, "correct": c1, "accuracy": a1},
        "second_half": {"n": n2, "correct": c2, "accuracy": a2},
        "worst_half_accuracy": worst,
        "min_half_n": min(n1, n2),
        "full_internal_accuracy_at_zero_edge": full_accuracy,
        "total_runs_mae": total_mae,
        "total_runs_rmse": total_rmse,
        "passes_internal_gate": (
            accuracy >= INTERNAL_ACC_MIN
            and worst >= INTERNAL_WORST_HALF_MIN
        ),
    }


def fit_predict(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    features: list[str],
    params: dict[str, Any],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    x_train = feature_frame(train_df, features)
    x_test = feature_frame(test_df, features)

    home_model = make_model(params)
    away_model = make_model(params)
    home_model.fit(x_train, train_df[Y_HOME].astype(float).to_numpy(), cat_features=CAT_FEATURES)
    away_model.fit(x_train, train_df[Y_AWAY].astype(float).to_numpy(), cat_features=CAT_FEATURES)

    pred_home = np.asarray(home_model.predict(x_test, prediction_type="Exponent"), dtype=float)
    pred_away = np.asarray(away_model.predict(x_test, prediction_type="Exponent"), dtype=float)
    pred_total = pred_home + pred_away
    return pred_home, pred_away, pred_total


def evaluate_pregate(
    selected: dict[str, Any],
    train_internal: pd.DataFrame,
    pregate: pd.DataFrame,
    features: list[str],
) -> dict[str, Any]:
    _, _, pred_total = fit_predict(train_internal, pregate, features, selected["params"])
    close_total = pd.to_numeric(pregate["close_total"], errors="coerce").to_numpy(dtype=float)
    if np.isnan(close_total).any():
        raise RuntimeError("V34_PREGATE_CLOSE_TOTAL_MISSING")

    edge = pred_total - close_total
    y_label = pregate[TARGET_LABEL].astype(int).to_numpy()
    mask, pred = selection(edge, selected["mode"], selected["edge_threshold"])
    n = int(mask.sum())
    if n == 0:
        return {"n": 0, "correct": 0, "accuracy": None, "passes_gate": False, "reason": "NO_SELECTIONS"}

    idx = np.flatnonzero(mask)
    y_sel = y_label[mask]
    pred_sel = pred[mask]
    dates = pregate["game_date"].reset_index(drop=True).iloc[idx].reset_index(drop=True)
    correct = int((y_sel == pred_sel).sum())

    months: dict[str, Any] = {}
    accs: list[float] = []
    ns: list[int] = []
    for month in ("2025-07", "2025-08"):
        mm = dates.dt.strftime("%Y-%m").to_numpy() == month
        mn = int(mm.sum())
        mc = int((y_sel[mm] == pred_sel[mm]).sum()) if mn else 0
        ma = (mc / mn) if mn else None
        months[month] = {"n": mn, "correct": mc, "accuracy": ma}
        ns.append(mn)
        if ma is not None:
            accs.append(ma)

    accuracy = correct / n
    worst = min(accs) if len(accs) == 2 else 0.0
    min_month_n = min(ns)

    actual_total = (
        pregate[Y_HOME].astype(float).to_numpy()
        + pregate[Y_AWAY].astype(float).to_numpy()
    )
    full_pred = (edge >= 0.0).astype(int)
    return {
        "n": n,
        "correct": correct,
        "accuracy": accuracy,
        "coverage": n / len(pregate),
        "worst_month_accuracy": worst,
        "min_month_n": min_month_n,
        "months": months,
        "passes_gate": (
            n >= PREGATE_N_MIN
            and min_month_n >= PREGATE_MONTH_N_MIN
            and accuracy >= PREGATE_ACC_MIN
            and worst >= PREGATE_WORST_MONTH_MIN
        ),
        "full_accuracy_at_zero_edge": float(accuracy_score(y_label, full_pred)),
        "total_runs_mae": float(mean_absolute_error(actual_total, pred_total)),
        "total_runs_rmse": float(mean_squared_error(actual_total, pred_total) ** 0.5),
    }


def main() -> None:
    oidc_token = os.environ.get("GITHUB_OIDC_TOKEN", "").strip()
    if not oidc_token:
        result = base_result("BLOCKED_MISSING_OIDC_EXPORT_AUTH")
        result["blocker"] = "GitHub OIDC token is unavailable."
        write_result(result)
        return

    apr_jun = fetch_range(oidc_token, "apr_jun")
    if len(apr_jun) != 1150:
        raise RuntimeError(f"V34_APR_JUN_COUNT_MISMATCH:{len(apr_jun)}")

    df = pd.DataFrame(apr_jun)
    df["game_date"] = pd.to_datetime(df["game_date"])
    for target in (Y_HOME, Y_AWAY):
        if target not in df.columns:
            raise RuntimeError("V34_TARGET_MISSING:" + target)

    feature_leaks = sorted((FORBIDDEN_FEATURES - {Y_HOME, Y_AWAY}).intersection(df.columns))
    if feature_leaks:
        raise RuntimeError("FORBIDDEN_FEATURES_PRESENT:" + ",".join(feature_leaks))

    features = sorted(c for c in df.columns if c not in META)
    leaked_targets = sorted({Y_HOME, Y_AWAY}.intersection(features))
    if leaked_targets:
        raise RuntimeError("TARGET_FIELDS_ENTERED_FEATURES:" + ",".join(leaked_targets))
    if "close_total" not in features:
        raise RuntimeError("CLOSE_TOTAL_FEATURE_MISSING")
    missing_cat = [c for c in CAT_FEATURES if c not in features]
    if missing_cat:
        raise RuntimeError("MISSING_CATEGORICAL_FEATURES:" + ",".join(missing_cat))

    train = df[(df["game_date"] >= TRAIN_START) & (df["game_date"] < INTERNAL_START)].copy()
    june = df[(df["game_date"] >= INTERNAL_START) & (df["game_date"] < PREGATE_START)].copy()
    if len(train) != 769 or len(june) != 381:
        raise RuntimeError(f"V34_SPLIT_COUNT_MISMATCH:{len(train)}:{len(june)}")

    specs = model_specs()
    all_gate: list[dict[str, Any]] = []
    summaries: list[dict[str, Any]] = []

    close_june = pd.to_numeric(june["close_total"], errors="coerce").to_numpy(dtype=float)
    if np.isnan(close_june).any():
        raise RuntimeError("V34_JUNE_CLOSE_TOTAL_MISSING")

    actual_total_june = (
        june[Y_HOME].astype(float).to_numpy()
        + june[Y_AWAY].astype(float).to_numpy()
    )
    y_june = june[TARGET_LABEL].astype(int).to_numpy()

    for idx, params in enumerate(specs):
        _, _, pred_total = fit_predict(train, june, features, params)
        edge = pred_total - close_june
        full_acc = float(accuracy_score(y_june, (edge >= 0.0).astype(int)))
        total_mae = float(mean_absolute_error(actual_total_june, pred_total))
        total_rmse = float(mean_squared_error(actual_total_june, pred_total) ** 0.5)

        candidates: list[dict[str, Any]] = []
        for mode in MODES:
            for threshold in EDGE_THRESHOLDS:
                metrics = evaluate_internal(
                    edge, june, mode, threshold, total_mae, total_rmse, full_acc
                )
                if metrics is None:
                    continue
                candidate = {
                    "spec_index": idx,
                    "params": params,
                    **metrics,
                }
                candidates.append(candidate)
                if metrics["passes_internal_gate"]:
                    all_gate.append(candidate)

        candidates.sort(
            key=lambda c: (
                c["accuracy"],
                c["worst_half_accuracy"],
                c["n"],
                -c["total_runs_mae"],
            ),
            reverse=True,
        )
        summaries.append({
            "spec_index": idx,
            "params": params,
            "full_internal_accuracy_at_zero_edge": full_acc,
            "total_runs_mae": total_mae,
            "total_runs_rmse": total_rmse,
            "gate_pass_count": sum(1 for c in candidates if c["passes_internal_gate"]),
            "best_candidate": candidates[0] if candidates else None,
            "best_gate_candidate": next((c for c in candidates if c["passes_internal_gate"]), None),
        })

    all_gate.sort(
        key=lambda c: (
            c["accuracy"],
            c["worst_half_accuracy"],
            c["n"],
            -c["total_runs_mae"],
        ),
        reverse=True,
    )
    selected = all_gate[0] if all_gate else None

    result = base_result(
        "INTERNAL_JUNE_GATE_PASSED_PREGATE_NOT_OPENED"
        if selected else
        "REJECTED_INTERNAL_JUNE_GATE"
    )
    result.update({
        "model_family": "catboost_side_poisson",
        "catboost_version": "1.2.10",
        "seed": SEED,
        "feature_count": len(features),
        "categorical_features": CAT_FEATURES,
        "prediction_rule": "predicted_home_mean + predicted_away_mean compared with closing total",
        "train_rows": len(train),
        "june_rows": len(june),
        "specs_tried": len(specs),
        "threshold_modes": MODES,
        "edge_thresholds_runs": EDGE_THRESHOLDS,
        "internal_gate": {
            "accuracy_min": INTERNAL_ACC_MIN,
            "worst_half_accuracy_min": INTERNAL_WORST_HALF_MIN,
            "n_min": INTERNAL_N_MIN,
            "half_n_min": INTERNAL_HALF_N_MIN,
        },
        "internal_gate_candidate_count": len(all_gate),
        "selected_candidate_before_pregate": selected,
        "spec_summaries": summaries,
        "jul_aug_status": "NOT_OPENED",
    })

    if selected is not None:
        jul_aug = fetch_range(oidc_token, "jul_aug")
        if len(jul_aug) != 741:
            raise RuntimeError(f"V34_JULAUG_COUNT_MISMATCH:{len(jul_aug)}")
        pregate = pd.DataFrame(jul_aug)
        pregate["game_date"] = pd.to_datetime(pregate["game_date"])
        pregate_metrics = evaluate_pregate(selected, df.copy(), pregate, features)
        result["jul_aug_opened"] = True
        result["jul_aug_status"] = "OPENED_ONCE_AFTER_INTERNAL_GATE"
        result["pregate_rows"] = len(pregate)
        result["pregate_metrics"] = pregate_metrics
        result["pregate_gate"] = {
            "accuracy_min": PREGATE_ACC_MIN,
            "worst_month_accuracy_min": PREGATE_WORST_MONTH_MIN,
            "n_min": PREGATE_N_MIN,
            "month_n_min": PREGATE_MONTH_N_MIN,
        }
        result["status"] = (
            "PASSED_JULAUG_VALIDATION_GATE_FROZEN_2026_NOT_OPENED"
            if pregate_metrics["passes_gate"]
            else "REJECTED_JULAUG_VALIDATION_GATE"
        )

    write_result(result)
    print(json.dumps({
        "status": result["status"],
        "feature_count": result["feature_count"],
        "specs_tried": result["specs_tried"],
        "internal_gate_candidate_count": result["internal_gate_candidate_count"],
        "selected_candidate_before_pregate": result["selected_candidate_before_pregate"],
        "jul_aug_opened": result["jul_aug_opened"],
        "pregate_metrics": result.get("pregate_metrics"),
        "2026_opened_for_external_test": False,
        "odds_api_historical_credits_consumed": 0,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
