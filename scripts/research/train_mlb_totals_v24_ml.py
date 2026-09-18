#!/usr/bin/env python3
"""Research-only MLB Totals V24 real-ML experiment.

Protocol:
- Apr-May 2025: model fitting only.
- June 2025: internal model/threshold selection.
- Jul-Aug 2025: frozen pre-gate, opened only if June internal gate passes.
- 2026: never read by this script.

No Official Picks writes. No APOSTAR. No provider calls. No ROI/EV claims.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss
from sklearn.pipeline import Pipeline

SEED = 20260917
TARGET = "close_over_label"

TRAIN_START = pd.Timestamp("2025-04-01")
INTERNAL_START = pd.Timestamp("2025-06-01")
PREGATE_START = pd.Timestamp("2025-07-01")
END_EXCLUSIVE = pd.Timestamp("2025-09-01")

META = {"game_pk", "game_date", TARGET, "research_only"}
THRESHOLDS = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80]

INTERNAL_N_MIN = 30
INTERNAL_HALF_N_MIN = 10
INTERNAL_ACC_MIN = 0.70
INTERNAL_WORST_HALF_MIN = 0.65

PREGATE_N_MIN = 30
PREGATE_MONTH_N_MIN = 10
PREGATE_ACC_MIN = 0.75
PREGATE_WORST_MONTH_MIN = 0.70


@dataclass(frozen=True)
class Candidate:
    family: str
    params: dict[str, Any]
    mode: str
    threshold: float
    internal_n: int
    internal_correct: int
    internal_accuracy: float
    internal_worst_half_accuracy: float
    internal_min_half_n: int
    full_internal_accuracy: float
    full_internal_brier: float
    full_internal_log_loss: float


def model_specs() -> list[tuple[str, dict[str, Any]]]:
    specs: list[tuple[str, dict[str, Any]]] = []

    for depth in (3, 5, None):
        for leaf in (5, 15):
            for max_features in ("sqrt", 0.5):
                for class_weight in (None, "balanced"):
                    specs.append(
                        (
                            "extra_trees",
                            {
                                "n_estimators": 200,
                                "max_depth": depth,
                                "min_samples_leaf": leaf,
                                "max_features": max_features,
                                "class_weight": class_weight,
                            },
                        )
                    )

    for depth in (4, None):
        for leaf in (5, 15):
            for max_features in ("sqrt", 0.5):
                for class_weight in (None, "balanced"):
                    specs.append(
                        (
                            "random_forest",
                            {
                                "n_estimators": 200,
                                "max_depth": depth,
                                "min_samples_leaf": leaf,
                                "max_features": max_features,
                                "class_weight": class_weight,
                            },
                        )
                    )

    for lr in (0.03, 0.06):
        for max_iter in (100, 200):
            for max_leaf_nodes in (7, 15):
                for min_samples_leaf in (10, 20):
                    specs.append(
                        (
                            "hist_gradient_boosting",
                            {
                                "learning_rate": lr,
                                "max_iter": max_iter,
                                "max_leaf_nodes": max_leaf_nodes,
                                "min_samples_leaf": min_samples_leaf,
                                "l2_regularization": 2.0,
                            },
                        )
                    )
    return specs


def make_model(family: str, params: dict[str, Any]):
    if family == "extra_trees":
        return ExtraTreesClassifier(random_state=SEED, n_jobs=-1, **params)
    if family == "random_forest":
        return RandomForestClassifier(random_state=SEED, n_jobs=-1, **params)
    if family == "hist_gradient_boosting":
        return HistGradientBoostingClassifier(random_state=SEED, **params)
    raise ValueError(family)


def safe_log_loss(y: np.ndarray, p: np.ndarray) -> float:
    return float(log_loss(y, np.clip(p, 1e-6, 1 - 1e-6), labels=[0, 1]))


def selection_mask(prob: np.ndarray, mode: str, threshold: float) -> tuple[np.ndarray, np.ndarray]:
    if mode == "two_sided":
        selected = (prob >= threshold) | (prob <= 1.0 - threshold)
        pred = (prob >= threshold).astype(int)
        return selected, pred
    if mode == "over_only":
        selected = prob >= threshold
        return selected, np.ones_like(prob, dtype=int)
    if mode == "under_only":
        selected = prob <= 1.0 - threshold
        return selected, np.zeros_like(prob, dtype=int)
    raise ValueError(mode)


def internal_candidate(
    family: str,
    params: dict[str, Any],
    prob: np.ndarray,
    y: np.ndarray,
    dates: pd.Series,
    mode: str,
    threshold: float,
    full_acc: float,
    full_brier: float,
    full_ll: float,
) -> Candidate | None:
    selected, pred = selection_mask(prob, mode, threshold)
    n = int(selected.sum())
    if n < INTERNAL_N_MIN:
        return None

    idx = np.flatnonzero(selected)
    y_sel = y[selected]
    pred_sel = pred[selected]
    d_sel = dates.iloc[idx].reset_index(drop=True)
    correct = int((y_sel == pred_sel).sum())
    accuracy = correct / n

    half_masks = [
        d_sel.dt.day.to_numpy() <= 15,
        d_sel.dt.day.to_numpy() > 15,
    ]
    half_stats: list[tuple[int, float]] = []
    for hm in half_masks:
        hn = int(hm.sum())
        if hn < INTERNAL_HALF_N_MIN:
            return None
        ha = float((y_sel[hm] == pred_sel[hm]).mean())
        half_stats.append((hn, ha))

    return Candidate(
        family=family,
        params=params,
        mode=mode,
        threshold=threshold,
        internal_n=n,
        internal_correct=correct,
        internal_accuracy=accuracy,
        internal_worst_half_accuracy=min(x[1] for x in half_stats),
        internal_min_half_n=min(x[0] for x in half_stats),
        full_internal_accuracy=full_acc,
        full_internal_brier=full_brier,
        full_internal_log_loss=full_ll,
    )


def rank_candidate(c: Candidate) -> tuple[float, float, int, float]:
    return (
        c.internal_accuracy,
        c.internal_worst_half_accuracy,
        c.internal_n,
        -c.full_internal_brier,
    )


def evaluate_pregate(
    selected: Candidate,
    train_internal: pd.DataFrame,
    pregate: pd.DataFrame,
    features: list[str],
) -> dict[str, Any]:
    X_train = train_internal[features].copy()
    y_train = train_internal[TARGET].astype(int).to_numpy()
    X_test = pregate[features].copy()
    y_test = pregate[TARGET].astype(int).to_numpy()

    pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("model", make_model(selected.family, selected.params)),
    ])
    pipe.fit(X_train, y_train)
    prob = pipe.predict_proba(X_test)[:, 1]
    selected_mask, pred = selection_mask(prob, selected.mode, selected.threshold)

    n = int(selected_mask.sum())
    if n == 0:
        return {
            "n": 0,
            "correct": 0,
            "accuracy": None,
            "passes_gate": False,
            "reason": "NO_SELECTIONS",
        }

    dates = pregate["game_date"].reset_index(drop=True)
    idx = np.flatnonzero(selected_mask)
    y_sel = y_test[selected_mask]
    pred_sel = pred[selected_mask]
    d_sel = dates.iloc[idx].reset_index(drop=True)
    correct = int((y_sel == pred_sel).sum())

    months: dict[str, Any] = {}
    month_accs: list[float] = []
    month_ns: list[int] = []
    for month in ("2025-07", "2025-08"):
        mm = d_sel.dt.strftime("%Y-%m").to_numpy() == month
        mn = int(mm.sum())
        mc = int((y_sel[mm] == pred_sel[mm]).sum()) if mn else 0
        ma = (mc / mn) if mn else None
        months[month] = {"n": mn, "correct": mc, "accuracy": ma}
        if ma is not None:
            month_accs.append(ma)
        month_ns.append(mn)

    accuracy = correct / n
    worst_month = min(month_accs) if len(month_accs) == 2 else 0.0
    min_month_n = min(month_ns)
    passes = (
        n >= PREGATE_N_MIN
        and min_month_n >= PREGATE_MONTH_N_MIN
        and accuracy >= PREGATE_ACC_MIN
        and worst_month >= PREGATE_WORST_MONTH_MIN
    )

    return {
        "n": n,
        "correct": correct,
        "accuracy": accuracy,
        "coverage": n / len(pregate),
        "worst_month_accuracy": worst_month,
        "min_month_n": min_month_n,
        "months": months,
        "passes_gate": passes,
        "full_accuracy_at_0_5": float(accuracy_score(y_test, (prob >= 0.5).astype(int))),
        "full_brier": float(brier_score_loss(y_test, prob)),
        "full_log_loss": safe_log_loss(y_test, prob),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    if payload.get("contract") != "MLB_TOTALS_V24_ML_DATASET/1.0.0":
        raise RuntimeError("DATASET_CONTRACT_MISMATCH")
    if payload.get("researchOnly") is not True:
        raise RuntimeError("DATASET_NOT_RESEARCH_ONLY")
    if payload.get("officialPicksWrites") != 0 or payload.get("apostarActivation") is not False:
        raise RuntimeError("RESEARCH_BOUNDARY_VIOLATION")

    df = pd.DataFrame(payload["rows"])
    df["game_date"] = pd.to_datetime(df["game_date"])
    df = df[df[TARGET].isin([0, 1])].copy()

    forbidden = {
        "total_runs", "home_runs", "away_runs", "actual_winner", "y_margin",
        "actual_offense_score", "actual_contact_score",
        "actual_starter_vulnerability_score", "actual_bullpen_vulnerability_score",
    }
    leaked = sorted(forbidden.intersection(df.columns))
    if leaked:
        raise RuntimeError(f"FORBIDDEN_FIELDS_PRESENT:{','.join(leaked)}")

    features = [c for c in df.columns if c not in META]
    for col in features:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    train = df[(df.game_date >= TRAIN_START) & (df.game_date < INTERNAL_START)].copy()
    internal = df[(df.game_date >= INTERNAL_START) & (df.game_date < PREGATE_START)].copy()
    pregate = df[(df.game_date >= PREGATE_START) & (df.game_date < END_EXCLUSIVE)].copy()
    if min(len(train), len(internal), len(pregate)) == 0:
        raise RuntimeError(f"EMPTY_SPLIT:{len(train)}:{len(internal)}:{len(pregate)}")

    X_train = train[features].copy()
    y_train = train[TARGET].astype(int).to_numpy()
    X_internal = internal[features].copy()
    y_internal = internal[TARGET].astype(int).to_numpy()

    candidates: list[Candidate] = []
    full_models: list[dict[str, Any]] = []

    specs = model_specs()
    for family, params in specs:
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("model", make_model(family, params)),
        ])
        pipe.fit(X_train, y_train)
        prob = pipe.predict_proba(X_internal)[:, 1]
        pred = (prob >= 0.5).astype(int)

        full_acc = float(accuracy_score(y_internal, pred))
        full_brier = float(brier_score_loss(y_internal, prob))
        full_ll = safe_log_loss(y_internal, prob)
        full_models.append({
            "family": family,
            "params": params,
            "internal_full_accuracy": full_acc,
            "internal_brier": full_brier,
            "internal_log_loss": full_ll,
        })

        dates = internal["game_date"].reset_index(drop=True)
        for mode in ("two_sided", "over_only", "under_only"):
            for threshold in THRESHOLDS:
                c = internal_candidate(
                    family, params, prob, y_internal, dates, mode, threshold,
                    full_acc, full_brier, full_ll,
                )
                if c is not None:
                    candidates.append(c)

    candidates.sort(key=rank_candidate, reverse=True)
    internal_gate = [
        c for c in candidates
        if c.internal_accuracy >= INTERNAL_ACC_MIN
        and c.internal_worst_half_accuracy >= INTERNAL_WORST_HALF_MIN
    ]
    selected = internal_gate[0] if internal_gate else None

    pregate_metrics = None
    if selected is not None:
        pregate_metrics = evaluate_pregate(
            selected,
            pd.concat([train, internal], ignore_index=True),
            pregate,
            features,
        )

    artifact = {
        "contract": "MLB_TOTALS_V24_REAL_ML_RESEARCH/1.0.0",
        "research_only": True,
        "official_picks_writes": 0,
        "apostar_activation": False,
        "production_promotion": False,
        "odds_api_credits_consumed": 0,
        "2026_used_for_selection": False,
        "protocol": {
            "train": "2025-04-01/2025-05-31",
            "internal_validation": "2025-06-01/2025-06-30",
            "pregate": "2025-07-01/2025-08-31",
            "external_2026_open_rule": "only after frozen Jul-Aug pregate passes",
            "internal_gate": {
                "accuracy_min": INTERNAL_ACC_MIN,
                "worst_half_accuracy_min": INTERNAL_WORST_HALF_MIN,
                "n_min": INTERNAL_N_MIN,
                "half_n_min": INTERNAL_HALF_N_MIN,
            },
            "pregate_gate": {
                "accuracy_min": PREGATE_ACC_MIN,
                "worst_month_accuracy_min": PREGATE_WORST_MONTH_MIN,
                "n_min": PREGATE_N_MIN,
                "month_n_min": PREGATE_MONTH_N_MIN,
            },
        },
        "dataset": {
            "rows": len(df),
            "train_rows": len(train),
            "internal_rows": len(internal),
            "pregate_rows": len(pregate),
            "feature_count": len(features),
            "target": TARGET,
        },
        "models_tried": len(specs),
        "top_full_internal_models": sorted(
            full_models,
            key=lambda x: (x["internal_full_accuracy"], -x["internal_brier"]),
            reverse=True,
        )[:20],
        "top_internal_selective_candidates": [asdict(c) for c in candidates[:30]],
        "internal_gate_candidate_count": len(internal_gate),
        "selected_candidate_before_pregate": asdict(selected) if selected else None,
        "pregate_metrics": pregate_metrics,
        "external_2026_status": (
            "READY_FOR_FROZEN_EXTERNAL_TEST_NOT_OPENED"
            if pregate_metrics and pregate_metrics.get("passes_gate")
            else "NOT_OPENED"
        ),
        "status": (
            "PRE_GATE_PASS_EXTERNAL_2026_NOT_OPENED"
            if pregate_metrics and pregate_metrics.get("passes_gate")
            else (
                "PREGATE_FAILED_EXTERNAL_2026_NOT_OPENED"
                if selected is not None
                else "NO_INTERNAL_GATE_CANDIDATE_PREGATE_NOT_OPENED"
            )
        ),
        "probability_note": "Model scores are classifier outputs and are not claimed as calibrated betting probabilities.",
    }

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(artifact, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(artifact, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
