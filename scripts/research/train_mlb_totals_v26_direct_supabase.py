#!/usr/bin/env python3
"""Research-only MLB Totals V26 direct-Supabase ExtraTrees evaluation.

Protocol:
- Fetch Apr-Jun only first.
- Apr-May train.
- June internal model/threshold selection.
- Open Jul-Aug exactly once only if the frozen June candidate passes.
- Never read 2026.
- No Official Picks writes. No APOSTAR. No provider calls. No Odds API credits.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss
from sklearn.pipeline import Pipeline

SEED = 20260917
TABLE = "mlb_totals_v26_full_ml_dataset_2025_v1"
REGISTRY = "mlb_totals_formula_search_v1"
CANDIDATE_NAME = "totals_v26_full_surface_extra_trees_v1"
TARGET = "close_over_label"
EDGE_URL = "https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-totals-v26-github-export-temp"
OUT = Path("artifacts/research/mlb_totals_v26_extra_trees_result.json")

TRAIN_START = pd.Timestamp("2025-04-01")
INTERNAL_START = pd.Timestamp("2025-06-01")
PREGATE_START = pd.Timestamp("2025-07-01")
END_EXCLUSIVE = pd.Timestamp("2025-09-01")

META = {"game_pk", "game_date", TARGET, "research_only"}
FORBIDDEN = {
    "total_runs", "home_runs", "away_runs", "actual_winner", "y_margin",
    "open_total_margin", "close_total_margin",
    "actual_offense_score", "actual_contact_score",
    "actual_starter_vulnerability_score", "actual_bullpen_vulnerability_score",
    "actual_defense_error_score",
}
THRESHOLDS = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80]
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
        "contract": "MLB_TOTALS_V26_EXTRA_TREES_RESEARCH/1.0.0",
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
    }


def write_result(result: dict[str, Any]) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2, sort_keys=True), encoding="utf-8")


def fetch_range(anon_key: str, oidc_token: str, range_name: str) -> list[dict[str, Any]]:
    r = requests.post(
        EDGE_URL,
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {anon_key}",
            "x-github-oidc-token": oidc_token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={"range": range_name},
        timeout=120,
    )
    r.raise_for_status()
    payload = r.json()
    checks = [
        (payload.get("contract") == "MLB_TOTALS_V26_GITHUB_EXPORT/1.0.0", "contract"),
        (payload.get("researchOnly") is True, "researchOnly"),
        (payload.get("sourceTable") == f"public.{TABLE}", "sourceTable"),
        (payload.get("range") == range_name, "range"),
        (payload.get("officialPicksWrites") == 0, "Official Picks"),
        (payload.get("apostarActivation") is False, "APOSTAR"),
        (payload.get("productionPromotion") is False, "production"),
        (payload.get("oddsApiHistoricalCreditsConsumed") == 0, "Odds API credits"),
        (payload.get("external2026Included") is False, "2026"),
        (isinstance(payload.get("rows"), list), "rows"),
    ]
    bad = [name for ok, name in checks if not ok]
    if bad:
        raise RuntimeError("V26_EDGE_CONTRACT_INVALID:" + ",".join(bad))
    return payload["rows"]


def numeric_frame(df: pd.DataFrame, features: list[str]) -> pd.DataFrame:
    out = pd.DataFrame(index=df.index)
    for feature in features:
        out[feature] = pd.to_numeric(df[feature], errors="coerce")
    return out


def model_specs() -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []
    for depth in (3, 5, None):
        for leaf in (5, 15):
            for max_features in ("sqrt", 0.5):
                specs.append({
                    "n_estimators": 200,
                    "max_depth": depth,
                    "min_samples_leaf": leaf,
                    "max_features": max_features,
                    "class_weight": None,
                })
    return specs


def make_model(params: dict[str, Any]) -> Pipeline:
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("model", ExtraTreesClassifier(random_state=SEED, n_jobs=-1, **params)),
    ])


def selection(prob: np.ndarray, mode: str, threshold: float) -> tuple[np.ndarray, np.ndarray]:
    if mode == "two_sided":
        mask = (prob >= threshold) | (prob <= (1.0 - threshold))
        pred = (prob >= threshold).astype(int)
    elif mode == "over_only":
        mask = prob >= threshold
        pred = np.ones(len(prob), dtype=int)
    elif mode == "under_only":
        mask = prob <= (1.0 - threshold)
        pred = np.zeros(len(prob), dtype=int)
    else:
        raise ValueError(mode)
    return mask, pred


def safe_log_loss(y: np.ndarray, p: np.ndarray) -> float:
    return float(log_loss(y, np.clip(p, 1e-6, 1 - 1e-6), labels=[0, 1]))


def evaluate_internal(prob: np.ndarray, validation: pd.DataFrame, mode: str, threshold: float) -> dict[str, Any] | None:
    y = validation[TARGET].astype(int).to_numpy()
    mask, pred = selection(prob, mode, threshold)
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
        "threshold": threshold,
        "n": n,
        "correct": correct,
        "accuracy": accuracy,
        "first_half": {"n": n1, "correct": c1, "accuracy": a1},
        "second_half": {"n": n2, "correct": c2, "accuracy": a2},
        "worst_half_accuracy": worst,
        "min_half_n": min(n1, n2),
        "passes_internal_gate": (
            accuracy >= INTERNAL_ACC_MIN
            and worst >= INTERNAL_WORST_HALF_MIN
        ),
    }


def evaluate_pregate(
    selected: dict[str, Any],
    train_internal: pd.DataFrame,
    pregate: pd.DataFrame,
    features: list[str],
) -> dict[str, Any]:
    pipe = make_model(selected["params"])
    x_train = numeric_frame(train_internal, features)
    y_train = train_internal[TARGET].astype(int).to_numpy()
    x_test = numeric_frame(pregate, features)
    y_test = pregate[TARGET].astype(int).to_numpy()

    pipe.fit(x_train, y_train)
    prob = pipe.predict_proba(x_test)[:, 1]
    mask, pred = selection(prob, selected["mode"], selected["threshold"])
    n = int(mask.sum())
    if n == 0:
        return {"n": 0, "correct": 0, "accuracy": None, "passes_gate": False, "reason": "NO_SELECTIONS"}

    idx = np.flatnonzero(mask)
    y_sel = y_test[mask]
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
    passes = (
        n >= PREGATE_N_MIN
        and min_month_n >= PREGATE_MONTH_N_MIN
        and accuracy >= PREGATE_ACC_MIN
        and worst >= PREGATE_WORST_MONTH_MIN
    )
    return {
        "n": n,
        "correct": correct,
        "accuracy": accuracy,
        "coverage": n / len(pregate),
        "worst_month_accuracy": worst,
        "min_month_n": min_month_n,
        "months": months,
        "passes_gate": passes,
        "full_accuracy_at_0_5": float(accuracy_score(y_test, (prob >= 0.5).astype(int))),
        "full_brier": float(brier_score_loss(y_test, prob)),
        "full_log_loss": safe_log_loss(y_test, prob),
    }


def main() -> None:
    anon_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    oidc_token = os.environ.get("GITHUB_OIDC_TOKEN", "").strip()
    if not anon_key or not oidc_token:
        result = base_result("BLOCKED_MISSING_OIDC_EXPORT_AUTH")
        result["blocker"] = "GitHub OIDC or Supabase anon gateway key is unavailable."
        write_result(result)
        print(json.dumps({"status": result["status"]}, indent=2))
        return

    apr_jun = fetch_range(anon_key, oidc_token, "apr_jun")
    if len(apr_jun) != 1150:
        raise RuntimeError(f"V26_APR_JUN_COUNT_MISMATCH:{len(apr_jun)}")

    df = pd.DataFrame(apr_jun)
    df["game_date"] = pd.to_datetime(df["game_date"])
    leaked = sorted(FORBIDDEN.intersection(df.columns))
    if leaked:
        raise RuntimeError("FORBIDDEN_FEATURES_PRESENT:" + ",".join(leaked))

    features = sorted(c for c in df.columns if c not in META)
    train = df[(df["game_date"] >= TRAIN_START) & (df["game_date"] < INTERNAL_START)].copy()
    june = df[(df["game_date"] >= INTERNAL_START) & (df["game_date"] < PREGATE_START)].copy()
    if len(train) != 769 or len(june) != 381:
        raise RuntimeError(f"V26_SPLIT_COUNT_MISMATCH:{len(train)}:{len(june)}")

    x_train = numeric_frame(train, features)
    y_train = train[TARGET].astype(int).to_numpy()
    x_june = numeric_frame(june, features)
    y_june = june[TARGET].astype(int).to_numpy()

    specs = model_specs()
    all_gate: list[dict[str, Any]] = []
    summaries: list[dict[str, Any]] = []

    for idx, params in enumerate(specs):
        pipe = make_model(params)
        pipe.fit(x_train, y_train)
        prob = pipe.predict_proba(x_june)[:, 1]
        full_acc = float(accuracy_score(y_june, (prob >= 0.5).astype(int)))
        full_brier = float(brier_score_loss(y_june, prob))
        full_ll = safe_log_loss(y_june, prob)

        candidates: list[dict[str, Any]] = []
        for mode in MODES:
            for threshold in THRESHOLDS:
                metrics = evaluate_internal(prob, june, mode, threshold)
                if metrics is None:
                    continue
                candidate = {
                    "spec_index": idx,
                    "params": params,
                    **metrics,
                    "full_internal_accuracy": full_acc,
                    "full_internal_brier": full_brier,
                    "full_internal_log_loss": full_ll,
                }
                candidates.append(candidate)
                if metrics["passes_internal_gate"]:
                    all_gate.append(candidate)

        candidates.sort(
            key=lambda c: (
                c["accuracy"],
                c["worst_half_accuracy"],
                c["n"],
                -c["full_internal_brier"],
            ),
            reverse=True,
        )
        summaries.append({
            "spec_index": idx,
            "params": params,
            "full_internal_accuracy": full_acc,
            "full_internal_brier": full_brier,
            "full_internal_log_loss": full_ll,
            "gate_pass_count": sum(1 for c in candidates if c["passes_internal_gate"]),
            "best_candidate": candidates[0] if candidates else None,
            "best_gate_candidate": next((c for c in candidates if c["passes_internal_gate"]), None),
        })

    all_gate.sort(
        key=lambda c: (
            c["accuracy"],
            c["worst_half_accuracy"],
            c["n"],
            -c["full_internal_brier"],
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
        "model_family": "sklearn_extra_trees",
        "seed": SEED,
        "feature_count": len(features),
        "train_rows": len(train),
        "june_rows": len(june),
        "specs_tried": len(specs),
        "threshold_modes": MODES,
        "thresholds": THRESHOLDS,
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
        # First and only read of Jul-Aug for this frozen V26 family.
        jul_aug = fetch_range(anon_key, oidc_token, "jul_aug")
        if len(jul_aug) != 741:
            raise RuntimeError(f"V26_JULAUG_COUNT_MISMATCH:{len(jul_aug)}")
        pregate = pd.DataFrame(jul_aug)
        pregate["game_date"] = pd.to_datetime(pregate["game_date"])
        train_internal = df.copy()
        pregate_metrics = evaluate_pregate(selected, train_internal, pregate, features)
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
