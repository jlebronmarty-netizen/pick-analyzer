#!/usr/bin/env python3
"""MLB Totals V36 — unified 2025 rolling development.

Research-only protocol:
- 2025 only for model/threshold selection.
- Expanding chronological folds validate May-Sep 2025.
- Freeze the best stable candidate even if it remains below 75%.
- 2026 is never fetched or read by this script.
- FULL/same-game process values are not features.
- Final outcomes are targets/evaluation labels only.
"""

from __future__ import annotations

import hashlib
import json
import os
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
from catboost import CatBoostClassifier, CatBoostRegressor
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error

SEED = 20260918
TABLE = "mlb_totals_model_2025_v1"
EDGE_URL = "https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-totals-v36-github-export-temp"
OUT = Path("artifacts/research/mlb_totals_v36_rolling_2025_result.json")
FREEZE = Path("artifacts/research/mlb_totals_v36_frozen_candidate.json")

LABEL = "close_over_label"
TARGET_MARGIN = "close_total_margin"
TARGET_TOTAL = "total_runs"

META = {
    "game_pk",
    "game_date",
    "research_only",
    "dataset_version",
    "created_at",
}
TARGET_ONLY = {
    "total_runs",
    "open_over_label",
    "close_over_label",
    "open_total_margin",
    "close_total_margin",
}
FORBIDDEN_FEATURE_PREFIXES = ("actual_", "y_")
CATEGORICAL = [
    "home_team",
    "away_team",
    "day_night",
    "pregame_integrity_tier",
    "wind_direction",
    "precip",
    "sky",
    "roof_status",
]

CLASS_THRESHOLDS = [0.55, 0.60, 0.65, 0.70, 0.75]
EDGE_THRESHOLDS = [0.5, 1.0, 1.5, 2.0]
MODES = ["two_sided", "over_only", "under_only"]

STABLE_N_MIN = 50
STABLE_MONTH_N_MIN = 8
TARGET_ACCURACY = 0.75
TARGET_WORST_MONTH = 0.65

FOLDS = [
    ("2025-05", "2025-05-01", "2025-06-01"),
    ("2025-06", "2025-06-01", "2025-07-01"),
    ("2025-07", "2025-07-01", "2025-08-01"),
    ("2025-08", "2025-08-01", "2025-09-01"),
    ("2025-09", "2025-09-01", "2025-10-01"),
]

SPECS = [
    {"depth": 4, "iterations": 250, "learning_rate": 0.03, "l2_leaf_reg": 5.0, "random_strength": 1.0},
    {"depth": 4, "iterations": 400, "learning_rate": 0.05, "l2_leaf_reg": 5.0, "random_strength": 1.0},
    {"depth": 6, "iterations": 250, "learning_rate": 0.03, "l2_leaf_reg": 5.0, "random_strength": 1.0},
    {"depth": 6, "iterations": 400, "learning_rate": 0.05, "l2_leaf_reg": 5.0, "random_strength": 1.0},
]


def fetch_2025(oidc: str) -> list[dict[str, Any]]:
    r = requests.post(
        EDGE_URL,
        headers={
            "x-github-oidc-token": oidc,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={"range": "full_2025"},
        timeout=180,
    )
    if not r.ok:
        raise RuntimeError(f"V36_EDGE_HTTP_{r.status_code}:{r.text[:1000]}")
    p = r.json()
    checks = [
        (p.get("contract") == "MLB_TOTALS_V36_GITHUB_EXPORT/1.0.0", "contract"),
        (p.get("researchOnly") is True, "researchOnly"),
        (p.get("sourceTable") == f"public.{TABLE}", "sourceTable"),
        (p.get("range") == "full_2025", "range"),
        (p.get("rowCount") == 2425, "rowCount"),
        (p.get("targetFields") == sorted(TARGET_ONLY), "targetFields"),
        (p.get("external2026Included") is False, "2026"),
        (p.get("officialPicksWrites") == 0, "Official Picks"),
        (p.get("apostarActivation") is False, "APOSTAR"),
        (p.get("productionPromotion") is False, "production"),
        (p.get("oddsApiHistoricalCreditsConsumed") == 0, "Odds API credits"),
        (isinstance(p.get("rows"), list), "rows"),
    ]
    bad = [name for ok, name in checks if not ok]
    if bad:
        raise RuntimeError("V36_EDGE_CONTRACT_INVALID:" + ",".join(bad))
    return p["rows"]


def feature_columns(df: pd.DataFrame) -> list[str]:
    cols = sorted(c for c in df.columns if c not in META and c not in TARGET_ONLY)
    bad = [
        c
        for c in cols
        if c.startswith(FORBIDDEN_FEATURE_PREFIXES)
        or c in {"actual_winner", "winner", "final_score", "final_runs"}
    ]
    if bad:
        raise RuntimeError("V36_FORBIDDEN_FEATURES:" + ",".join(sorted(bad)))
    missing_cats = sorted(set(CATEGORICAL) - set(cols))
    if missing_cats:
        raise RuntimeError("V36_CATEGORICAL_FEATURES_MISSING:" + ",".join(missing_cats))
    return cols


def prepare_x(df: pd.DataFrame, features: list[str]) -> pd.DataFrame:
    out = pd.DataFrame(index=df.index)
    for c in features:
        if c in CATEGORICAL:
            out[c] = df[c].fillna("__MISSING__").astype(str)
        elif c == "doubleheader_flag":
            out[c] = df[c].fillna(False).astype(int)
        else:
            out[c] = pd.to_numeric(df[c], errors="coerce")
    return out


def make_classifier(params: dict[str, Any]) -> CatBoostClassifier:
    return CatBoostClassifier(
        random_seed=SEED,
        loss_function="Logloss",
        eval_metric="Logloss",
        verbose=False,
        allow_writing_files=False,
        thread_count=-1,
        **params,
    )


def make_regressor(params: dict[str, Any]) -> CatBoostRegressor:
    return CatBoostRegressor(
        random_seed=SEED,
        loss_function="RMSE",
        eval_metric="RMSE",
        verbose=False,
        allow_writing_files=False,
        thread_count=-1,
        **params,
    )


def selection_from_prob(p: np.ndarray, mode: str, threshold: float) -> tuple[np.ndarray, np.ndarray]:
    if mode == "two_sided":
        mask = (p >= threshold) | (p <= 1.0 - threshold)
        pred = (p >= 0.5).astype(int)
    elif mode == "over_only":
        mask = p >= threshold
        pred = np.ones(len(p), dtype=int)
    elif mode == "under_only":
        mask = p <= 1.0 - threshold
        pred = np.zeros(len(p), dtype=int)
    else:
        raise ValueError(mode)
    return mask, pred


def selection_from_edge(edge: np.ndarray, mode: str, threshold: float) -> tuple[np.ndarray, np.ndarray]:
    if mode == "two_sided":
        mask = (edge >= threshold) | (edge <= -threshold)
        pred = (edge >= 0.0).astype(int)
    elif mode == "over_only":
        mask = edge >= threshold
        pred = np.ones(len(edge), dtype=int)
    elif mode == "under_only":
        mask = edge <= -threshold
        pred = np.zeros(len(edge), dtype=int)
    else:
        raise ValueError(mode)
    return mask, pred


def summarize_candidate(records: list[dict[str, Any]], architecture: str, spec_index: int, params: dict[str, Any], mode: str, threshold: float) -> dict[str, Any] | None:
    selected = [r for r in records if r["selected"]]
    if not selected:
        return None
    by_month: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in selected:
        by_month[r["month"]].append(r)

    months = {}
    for month, _, _ in FOLDS:
        rows = by_month.get(month, [])
        n = len(rows)
        correct = sum(int(r["truth"] == r["pred"]) for r in rows)
        months[month] = {
            "n": n,
            "correct": correct,
            "accuracy": (correct / n) if n else None,
        }

    n = len(selected)
    correct = sum(int(r["truth"] == r["pred"]) for r in selected)
    acc = correct / n
    month_ns = [months[m]["n"] for m, _, _ in FOLDS]
    month_accs = [
        months[m]["accuracy"]
        for m, _, _ in FOLDS
        if months[m]["accuracy"] is not None
    ]
    min_month_n = min(month_ns)
    worst_month = min(month_accs) if len(month_accs) == len(FOLDS) else 0.0
    stable = n >= STABLE_N_MIN and min_month_n >= STABLE_MONTH_N_MIN
    target_met = stable and acc >= TARGET_ACCURACY and worst_month >= TARGET_WORST_MONTH
    return {
        "architecture": architecture,
        "spec_index": spec_index,
        "params": params,
        "mode": mode,
        "threshold": threshold,
        "n": n,
        "correct": correct,
        "accuracy": acc,
        "coverage_vs_nonpush_oof": None,
        "months": months,
        "min_month_n": min_month_n,
        "worst_month_accuracy": worst_month,
        "monthly_accuracy_sd": float(np.std(month_accs, ddof=0)) if month_accs else None,
        "stable": stable,
        "target_met_75_plus": target_met,
    }


def rank_key(c: dict[str, Any]) -> tuple[Any, ...]:
    # When no candidate reaches the 75% target, prefer the most temporally
    # robust stable rule rather than a marginal pooled-accuracy winner that
    # collapses in one validation month. 2026 remains unopened.
    return (
        1 if c["target_met_75_plus"] else 0,
        1 if c["stable"] else 0,
        c["worst_month_accuracy"],
        c["accuracy"],
        -c["monthly_accuracy_sd"],
        c["n"],
    )


def main() -> None:
    oidc = os.environ.get("GITHUB_OIDC_TOKEN", "").strip()
    if not oidc:
        raise RuntimeError("V36_GITHUB_OIDC_TOKEN_MISSING")

    rows = fetch_2025(oidc)
    df = pd.DataFrame(rows)
    df["game_date"] = pd.to_datetime(df["game_date"])
    if len(df) != 2425:
        raise RuntimeError(f"V36_ROW_COUNT_MISMATCH:{len(df)}")
    if df["game_date"].min() < pd.Timestamp("2025-03-01") or df["game_date"].max() >= pd.Timestamp("2026-01-01"):
        raise RuntimeError("V36_DATE_SCOPE_INVALID")

    features = feature_columns(df)
    feature_hash = hashlib.sha256("\n".join(features).encode("utf-8")).hexdigest()

    # OOF records keyed by architecture/spec/mode/threshold.
    candidate_records: dict[tuple[str, int, str, float], list[dict[str, Any]]] = defaultdict(list)
    model_diagnostics: list[dict[str, Any]] = []
    fold_manifest: list[dict[str, Any]] = []
    total_oof_nonpush = 0

    for month, start_s, end_s in FOLDS:
        start = pd.Timestamp(start_s)
        end = pd.Timestamp(end_s)
        train_all = df[df["game_date"] < start].copy()
        val_all = df[(df["game_date"] >= start) & (df["game_date"] < end)].copy()
        train_cls = train_all[train_all[LABEL].notna()].copy()
        val = val_all[val_all[LABEL].notna()].copy()
        if len(train_cls) < 300 or len(val) < 300:
            raise RuntimeError(f"V36_FOLD_TOO_SMALL:{month}:{len(train_cls)}:{len(val)}")
        total_oof_nonpush += len(val)

        fold_manifest.append({
            "month": month,
            "train_start": str(train_all["game_date"].min().date()),
            "train_end": str(train_all["game_date"].max().date()),
            "train_rows_all": int(len(train_all)),
            "train_rows_nonpush": int(len(train_cls)),
            "validation_rows_all": int(len(val_all)),
            "validation_rows_nonpush": int(len(val)),
        })

        x_train_cls = prepare_x(train_cls, features)
        x_train_all = prepare_x(train_all, features)
        x_val = prepare_x(val, features)
        y_val = val[LABEL].astype(int).to_numpy()
        val_game_pks = val["game_pk"].astype(int).to_numpy()
        val_close_total = pd.to_numeric(val["close_total"], errors="coerce").to_numpy(dtype=float)

        for spec_index, params in enumerate(SPECS):
            clf = make_classifier(params)
            clf.fit(x_train_cls, train_cls[LABEL].astype(int).to_numpy(), cat_features=CATEGORICAL)
            p_over = np.asarray(clf.predict_proba(x_val)[:, 1], dtype=float)
            full_acc = float(accuracy_score(y_val, (p_over >= 0.5).astype(int)))
            model_diagnostics.append({
                "architecture": "catboost_classifier",
                "spec_index": spec_index,
                "month": month,
                "full_accuracy": full_acc,
            })
            for mode in MODES:
                for threshold in CLASS_THRESHOLDS:
                    mask, pred = selection_from_prob(p_over, mode, threshold)
                    key = ("catboost_classifier", spec_index, mode, float(threshold))
                    for i in range(len(val)):
                        candidate_records[key].append({
                            "month": month,
                            "game_pk": int(val_game_pks[i]),
                            "truth": int(y_val[i]),
                            "pred": int(pred[i]),
                            "selected": bool(mask[i]),
                        })

            reg_margin = make_regressor(params)
            reg_margin.fit(
                x_train_all,
                pd.to_numeric(train_all[TARGET_MARGIN], errors="coerce").to_numpy(dtype=float),
                cat_features=CATEGORICAL,
            )
            pred_margin = np.asarray(reg_margin.predict(x_val), dtype=float)
            actual_margin = pd.to_numeric(val[TARGET_MARGIN], errors="coerce").to_numpy(dtype=float)
            margin_full_acc = float(accuracy_score(y_val, (pred_margin >= 0.0).astype(int)))
            model_diagnostics.append({
                "architecture": "catboost_close_margin_regression",
                "spec_index": spec_index,
                "month": month,
                "full_accuracy": margin_full_acc,
                "mae": float(mean_absolute_error(actual_margin, pred_margin)),
                "rmse": float(mean_squared_error(actual_margin, pred_margin) ** 0.5),
            })
            for mode in MODES:
                for threshold in EDGE_THRESHOLDS:
                    mask, pred = selection_from_edge(pred_margin, mode, threshold)
                    key = ("catboost_close_margin_regression", spec_index, mode, float(threshold))
                    for i in range(len(val)):
                        candidate_records[key].append({
                            "month": month,
                            "game_pk": int(val_game_pks[i]),
                            "truth": int(y_val[i]),
                            "pred": int(pred[i]),
                            "selected": bool(mask[i]),
                        })

            reg_total = make_regressor(params)
            reg_total.fit(
                x_train_all,
                pd.to_numeric(train_all[TARGET_TOTAL], errors="coerce").to_numpy(dtype=float),
                cat_features=CATEGORICAL,
            )
            pred_total = np.asarray(reg_total.predict(x_val), dtype=float)
            edge = pred_total - val_close_total
            actual_total = pd.to_numeric(val[TARGET_TOTAL], errors="coerce").to_numpy(dtype=float)
            total_full_acc = float(accuracy_score(y_val, (edge >= 0.0).astype(int)))
            model_diagnostics.append({
                "architecture": "catboost_total_runs_regression",
                "spec_index": spec_index,
                "month": month,
                "full_accuracy": total_full_acc,
                "mae": float(mean_absolute_error(actual_total, pred_total)),
                "rmse": float(mean_squared_error(actual_total, pred_total) ** 0.5),
            })
            for mode in MODES:
                for threshold in EDGE_THRESHOLDS:
                    mask, pred = selection_from_edge(edge, mode, threshold)
                    key = ("catboost_total_runs_regression", spec_index, mode, float(threshold))
                    for i in range(len(val)):
                        candidate_records[key].append({
                            "month": month,
                            "game_pk": int(val_game_pks[i]),
                            "truth": int(y_val[i]),
                            "pred": int(pred[i]),
                            "selected": bool(mask[i]),
                        })

    candidates: list[dict[str, Any]] = []
    for (architecture, spec_index, mode, threshold), records in candidate_records.items():
        c = summarize_candidate(records, architecture, spec_index, SPECS[spec_index], mode, threshold)
        if c is None:
            continue
        c["coverage_vs_nonpush_oof"] = c["n"] / total_oof_nonpush
        candidates.append(c)

    stable = [c for c in candidates if c["stable"]]
    if not stable:
        raise RuntimeError("V36_NO_STABLE_CANDIDATE")
    stable.sort(key=rank_key, reverse=True)
    selected = stable[0]

    top_by_architecture = {}
    for arch in sorted({c["architecture"] for c in stable}):
        vals = [c for c in stable if c["architecture"] == arch]
        vals.sort(key=rank_key, reverse=True)
        top_by_architecture[arch] = vals[:10]

    result = {
        "contract": "MLB_TOTALS_V36_ROLLING_2025_RESULT/1.0.0",
        "candidate_family": "totals_v36_unified_rolling_2025",
        "research_only": True,
        "source_table": f"public.{TABLE}",
        "source_rows_2025": int(len(df)),
        "source_min_date": str(df["game_date"].min().date()),
        "source_max_date": str(df["game_date"].max().date()),
        "feature_count": len(features),
        "feature_hash_sha256": feature_hash,
        "categorical_features": CATEGORICAL,
        "target_only_fields": sorted(TARGET_ONLY),
        "architectures": [
            "catboost_classifier",
            "catboost_close_margin_regression",
            "catboost_total_runs_regression",
        ],
        "specs": SPECS,
        "folds": fold_manifest,
        "oof_nonpush_rows": int(total_oof_nonpush),
        "stable_gate": {
            "n_min": STABLE_N_MIN,
            "month_n_min": STABLE_MONTH_N_MIN,
        },
        "target_gate": {
            "accuracy_min": TARGET_ACCURACY,
            "worst_month_accuracy_min": TARGET_WORST_MONTH,
        },
        "selected_candidate": selected,
        "target_met_75_plus": bool(selected["target_met_75_plus"]),
        "market_closeout_state": "TARGET_MET_75_PLUS_EXTERNAL_PENDING"
            if selected["target_met_75_plus"]
            else "REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING",
        "top_stable_by_architecture": top_by_architecture,
        "model_diagnostics": model_diagnostics,
        "official_picks_writes": 0,
        "apostar_activation": False,
        "production_promotion": False,
        "odds_api_historical_credits_consumed": 0,
        "selected_using_2025_only": True,
        "external_2026_opened": False,
        "external_2026_used_for_selection": False,
        "github_sha_at_run": os.environ.get("GITHUB_SHA"),
    }

    freeze = {
        "contract": "MLB_TOTALS_V36_FROZEN_CANDIDATE/1.0.0",
        "frozen": True,
        "research_only": True,
        "market": "MLB_GAME_TOTAL",
        "target_role": "closing_total",
        "candidate": selected,
        "feature_count": len(features),
        "feature_hash_sha256": feature_hash,
        "categorical_features": CATEGORICAL,
        "source_table_2025": f"public.{TABLE}",
        "selected_using_2025_only": True,
        "external_2026_opened": False,
        "retrain_policy_for_external": "deterministically refit frozen architecture/spec on all eligible 2025 rows, then score 2026 once",
        "seed": SEED,
        "github_sha_at_freeze": os.environ.get("GITHUB_SHA"),
        "official_picks_writes": 0,
        "apostar_activation": False,
        "production_promotion": False,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    FREEZE.write_text(json.dumps(freeze, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": result["market_closeout_state"],
        "target_met_75_plus": result["target_met_75_plus"],
        "selected_candidate": selected,
        "feature_count": len(features),
        "oof_nonpush_rows": total_oof_nonpush,
        "external_2026_opened": False,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
