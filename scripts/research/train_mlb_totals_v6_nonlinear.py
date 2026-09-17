#!/usr/bin/env python3
"""Train research-only nonlinear MLB Totals V6 candidates.

Protocol:
- 2025-04-01..2025-06-30: training only
- 2025-07-01..2025-08-31: model/threshold validation and selection only
- 2025-09-01..2025-09-30: untouched holdout; opened only after a candidate passes
  the validation gate.
- 2026 is never read by this script.

No Official Picks writes. No APOSTAR activation. No ROI/EV claims.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

SEED = 20260917
TRAIN_START = pd.Timestamp('2025-04-01')
VALIDATION_START = pd.Timestamp('2025-07-01')
HOLDOUT_START = pd.Timestamp('2025-09-01')
END_EXCLUSIVE = pd.Timestamp('2025-10-01')

TARGET = 'close_over_label'
META_COLUMNS = {
    'game_pk',
    'game_date',
    TARGET,
    'pregame_integrity_tier',
}
CATEGORICAL_COLUMNS = [
    'day_night',
    'doubleheader_flag',
    'wind_direction',
    'precip',
    'sky',
    'roof_status',
]

SELECTIVE_THRESHOLDS = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85]
MIN_VALIDATION_N = 30
MIN_VALIDATION_MONTH_N = 10
VALIDATION_ACCURACY_GATE = 0.75
WORST_MONTH_GATE = 0.70


@dataclass(frozen=True)
class Candidate:
    family: str
    params: dict[str, Any]
    mode: str
    threshold: float
    validation_n: int
    validation_correct: int
    validation_accuracy: float
    validation_worst_month_accuracy: float
    validation_min_month_n: int
    validation_month_accuracy_sd: float
    full_validation_accuracy: float
    full_validation_brier: float
    full_validation_log_loss: float


def american_to_implied(value: Any) -> float | None:
    try:
        odds = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(odds) or abs(odds) < 100:
        return None
    return (-odds / (-odds + 100.0)) if odds < 0 else (100.0 / (odds + 100.0))


def add_market_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out['line_move'] = pd.to_numeric(out['close_total'], errors='coerce') - pd.to_numeric(out['open_total'], errors='coerce')
    for role in ('open', 'close'):
        over_raw = out[f'{role}_over_price'].map(american_to_implied)
        under_raw = out[f'{role}_under_price'].map(american_to_implied)
        denom = over_raw + under_raw
        out[f'{role}_novig_over_prob'] = over_raw / denom
        out[f'{role}_novig_under_prob'] = under_raw / denom
    out['novig_over_prob_move'] = out['close_novig_over_prob'] - out['open_novig_over_prob']
    return out


def build_preprocessor(df: pd.DataFrame) -> tuple[ColumnTransformer, list[str], list[str]]:
    categorical = [c for c in CATEGORICAL_COLUMNS if c in df.columns]
    numeric = [c for c in df.columns if c not in META_COLUMNS and c not in categorical]
    for col in numeric:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    preprocessor = ColumnTransformer(
        transformers=[
            (
                'num',
                Pipeline([('imputer', SimpleImputer(strategy='median'))]),
                numeric,
            ),
            (
                'cat',
                Pipeline(
                    [
                        ('imputer', SimpleImputer(strategy='most_frequent')),
                        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False)),
                    ]
                ),
                categorical,
            ),
        ],
        remainder='drop',
        sparse_threshold=0.0,
    )
    return preprocessor, numeric, categorical


def model_specs() -> list[tuple[str, dict[str, Any]]]:
    specs: list[tuple[str, dict[str, Any]]] = []

    for max_depth in (3, 5, 7, None):
        for min_samples_leaf in (5, 10, 20):
            for max_features in ('sqrt', 0.5):
                for class_weight in (None, 'balanced'):
                    specs.append(
                        (
                            'extra_trees',
                            {
                                'n_estimators': 300,
                                'max_depth': max_depth,
                                'min_samples_leaf': min_samples_leaf,
                                'max_features': max_features,
                                'class_weight': class_weight,
                            },
                        )
                    )

    for max_depth in (4, 6, None):
        for min_samples_leaf in (5, 15):
            for max_features in ('sqrt', 0.5):
                for class_weight in (None, 'balanced'):
                    specs.append(
                        (
                            'random_forest',
                            {
                                'n_estimators': 300,
                                'max_depth': max_depth,
                                'min_samples_leaf': min_samples_leaf,
                                'max_features': max_features,
                                'class_weight': class_weight,
                            },
                        )
                    )

    for learning_rate in (0.03, 0.06):
        for max_iter in (100, 200):
            for max_leaf_nodes in (7, 15, 31):
                for min_samples_leaf in (10, 20):
                    for l2_regularization in (1.0, 5.0):
                        specs.append(
                            (
                                'hist_gradient_boosting',
                                {
                                    'learning_rate': learning_rate,
                                    'max_iter': max_iter,
                                    'max_leaf_nodes': max_leaf_nodes,
                                    'min_samples_leaf': min_samples_leaf,
                                    'l2_regularization': l2_regularization,
                                },
                            )
                        )
    return specs


def make_model(family: str, params: dict[str, Any]):
    if family == 'extra_trees':
        return ExtraTreesClassifier(random_state=SEED, n_jobs=-1, **params)
    if family == 'random_forest':
        return RandomForestClassifier(random_state=SEED, n_jobs=-1, **params)
    if family == 'hist_gradient_boosting':
        return HistGradientBoostingClassifier(random_state=SEED, **params)
    raise ValueError(f'unknown family {family}')


def safe_log_loss(y: np.ndarray, p: np.ndarray) -> float:
    clipped = np.clip(p, 1e-6, 1 - 1e-6)
    return float(log_loss(y, clipped, labels=[0, 1]))


def selection_mask(prob: np.ndarray, mode: str, threshold: float) -> tuple[np.ndarray, np.ndarray]:
    if mode == 'two_sided':
        selected = (prob >= threshold) | (prob <= 1.0 - threshold)
        prediction = (prob >= threshold).astype(int)
        return selected, prediction
    if mode == 'over_only':
        selected = prob >= threshold
        return selected, np.ones_like(prob, dtype=int)
    if mode == 'under_only':
        selected = prob <= 1.0 - threshold
        return selected, np.zeros_like(prob, dtype=int)
    raise ValueError(mode)


def candidate_metrics(
    family: str,
    params: dict[str, Any],
    prob: np.ndarray,
    y: np.ndarray,
    dates: pd.Series,
    mode: str,
    threshold: float,
    full_accuracy: float,
    full_brier: float,
    full_ll: float,
) -> Candidate | None:
    selected, prediction = selection_mask(prob, mode, threshold)
    n = int(selected.sum())
    if n < MIN_VALIDATION_N:
        return None

    y_sel = y[selected]
    pred_sel = prediction[selected]
    date_sel = dates.iloc[np.flatnonzero(selected)]
    correct = int((y_sel == pred_sel).sum())
    accuracy = correct / n

    month_stats = []
    for month in ('2025-07', '2025-08'):
        month_mask = date_sel.dt.strftime('%Y-%m').to_numpy() == month
        month_n = int(month_mask.sum())
        if month_n < MIN_VALIDATION_MONTH_N:
            return None
        month_acc = float((y_sel[month_mask] == pred_sel[month_mask]).mean())
        month_stats.append((month_n, month_acc))

    return Candidate(
        family=family,
        params=params,
        mode=mode,
        threshold=threshold,
        validation_n=n,
        validation_correct=correct,
        validation_accuracy=accuracy,
        validation_worst_month_accuracy=min(acc for _, acc in month_stats),
        validation_min_month_n=min(nm for nm, _ in month_stats),
        validation_month_accuracy_sd=float(np.std([acc for _, acc in month_stats])),
        full_validation_accuracy=full_accuracy,
        full_validation_brier=full_brier,
        full_validation_log_loss=full_ll,
    )


def candidate_rank(c: Candidate) -> tuple[float, float, int, float]:
    return (
        c.validation_accuracy,
        c.validation_worst_month_accuracy,
        c.validation_n,
        -c.validation_month_accuracy_sd,
    )


def evaluate_selected_on_holdout(
    selected: Candidate,
    train_validation: pd.DataFrame,
    holdout: pd.DataFrame,
    feature_columns: list[str],
) -> dict[str, Any]:
    X_tv = train_validation[feature_columns].copy()
    y_tv = train_validation[TARGET].astype(int).to_numpy()
    X_hold = holdout[feature_columns].copy()
    y_hold = holdout[TARGET].astype(int).to_numpy()

    preprocessor, _, _ = build_preprocessor(X_tv)
    X_tv_t = preprocessor.fit_transform(X_tv)
    X_hold_t = preprocessor.transform(X_hold)
    model = make_model(selected.family, selected.params)
    model.fit(X_tv_t, y_tv)
    prob = model.predict_proba(X_hold_t)[:, 1]

    selected_mask, prediction = selection_mask(prob, selected.mode, selected.threshold)
    n = int(selected_mask.sum())
    if n == 0:
        return {
            'period': '2025-09',
            'n': 0,
            'correct': 0,
            'accuracy': None,
            'coverage': 0.0,
            'status': 'NO_SELECTIONS',
        }

    correct = int((prediction[selected_mask] == y_hold[selected_mask]).sum())
    return {
        'period': '2025-09',
        'n': n,
        'correct': correct,
        'accuracy': correct / n,
        'coverage': n / len(holdout),
        'full_holdout_accuracy_at_0_5': float(accuracy_score(y_hold, (prob >= 0.5).astype(int))),
        'full_holdout_brier': float(brier_score_loss(y_hold, prob)),
        'full_holdout_log_loss': safe_log_loss(y_hold, prob),
        'status': 'EVALUATED_AFTER_FREEZE',
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    payload = json.loads(Path(args.input).read_text(encoding='utf-8'))
    if payload.get('contract') != 'MLB_TOTALS_V6_NONLINEAR_DATASET/1.0.0':
        raise RuntimeError('DATASET_CONTRACT_MISMATCH')
    if payload.get('researchOnly') is not True:
        raise RuntimeError('DATASET_NOT_RESEARCH_ONLY')
    if payload.get('officialPicksWrites') != 0 or payload.get('apostarActivation') is not False:
        raise RuntimeError('RESEARCH_BOUNDARY_VIOLATION')

    df = pd.DataFrame(payload['rows'])
    df['game_date'] = pd.to_datetime(df['game_date'])
    df = add_market_features(df)
    df = df[df[TARGET].isin([0, 1])].copy()

    train = df[(df.game_date >= TRAIN_START) & (df.game_date < VALIDATION_START)].copy()
    validation = df[(df.game_date >= VALIDATION_START) & (df.game_date < HOLDOUT_START)].copy()
    holdout = df[(df.game_date >= HOLDOUT_START) & (df.game_date < END_EXCLUSIVE)].copy()

    if min(len(train), len(validation), len(holdout)) == 0:
        raise RuntimeError(f'EMPTY_TEMPORAL_SPLIT:{len(train)}:{len(validation)}:{len(holdout)}')

    feature_columns = [c for c in df.columns if c not in META_COLUMNS]
    X_train = train[feature_columns].copy()
    X_val = validation[feature_columns].copy()
    y_train = train[TARGET].astype(int).to_numpy()
    y_val = validation[TARGET].astype(int).to_numpy()

    preprocessor, numeric_columns, categorical_columns = build_preprocessor(X_train)
    X_train_t = preprocessor.fit_transform(X_train)
    X_val_t = preprocessor.transform(X_val)

    candidates: list[Candidate] = []
    model_summaries: list[dict[str, Any]] = []

    specs = model_specs()
    for index, (family, params) in enumerate(specs, start=1):
        model = make_model(family, params)
        model.fit(X_train_t, y_train)
        prob = model.predict_proba(X_val_t)[:, 1]
        pred = (prob >= 0.5).astype(int)
        full_accuracy = float(accuracy_score(y_val, pred))
        full_brier = float(brier_score_loss(y_val, prob))
        full_ll = safe_log_loss(y_val, prob)

        model_summaries.append(
            {
                'index': index,
                'family': family,
                'params': params,
                'validation_full_accuracy': full_accuracy,
                'validation_brier': full_brier,
                'validation_log_loss': full_ll,
            }
        )

        for mode in ('two_sided', 'over_only', 'under_only'):
            for threshold in SELECTIVE_THRESHOLDS:
                candidate = candidate_metrics(
                    family,
                    params,
                    prob,
                    y_val,
                    validation['game_date'].reset_index(drop=True),
                    mode,
                    threshold,
                    full_accuracy,
                    full_brier,
                    full_ll,
                )
                if candidate is not None:
                    candidates.append(candidate)

    candidates.sort(key=candidate_rank, reverse=True)
    gate_candidates = [
        c
        for c in candidates
        if c.validation_accuracy >= VALIDATION_ACCURACY_GATE
        and c.validation_worst_month_accuracy >= WORST_MONTH_GATE
    ]

    selected = gate_candidates[0] if gate_candidates else None
    holdout_metrics = None
    if selected is not None:
        # Selection is complete at this point. Only now may September be evaluated.
        holdout_metrics = evaluate_selected_on_holdout(
            selected,
            pd.concat([train, validation], ignore_index=True),
            holdout,
            feature_columns,
        )

    top_models = sorted(
        model_summaries,
        key=lambda x: (x['validation_full_accuracy'], -x['validation_brier']),
        reverse=True,
    )[:20]

    artifact = {
        'contract': 'MLB_TOTALS_V6_NONLINEAR_RESEARCH/1.0.0',
        'research_only': True,
        'official_picks_writes': 0,
        'apostar_activation': False,
        'odds_api_credits_consumed': 0,
        '2026_used_for_selection': False,
        'protocol': {
            'train': '2025-04-01/2025-06-30',
            'validation': '2025-07-01/2025-08-31',
            'holdout': '2025-09-01/2025-09-30',
            'holdout_open_rule': 'only after validation gate passes',
            'validation_gate': {
                'accuracy_min': VALIDATION_ACCURACY_GATE,
                'worst_month_accuracy_min': WORST_MONTH_GATE,
                'n_min': MIN_VALIDATION_N,
                'month_n_min': MIN_VALIDATION_MONTH_N,
            },
        },
        'dataset': {
            'rows': len(df),
            'train_rows': len(train),
            'validation_rows': len(validation),
            'holdout_rows': len(holdout),
            'numeric_feature_count': len(numeric_columns),
            'categorical_features': categorical_columns,
            'target': TARGET,
        },
        'models_tried': len(specs),
        'top_full_coverage_validation_models': top_models,
        'top_selective_validation_candidates': [asdict(c) for c in candidates[:30]],
        'gate_candidate_count': len(gate_candidates),
        'selected_candidate_before_holdout': asdict(selected) if selected else None,
        'holdout_metrics': holdout_metrics,
        'status': (
            'CANDIDATE_HOLDOUT_EVALUATED'
            if selected is not None
            else 'NO_VALIDATION_GATE_CANDIDATE_HOLDOUT_NOT_OPENED'
        ),
        'probability_note': 'Classifier scores are not claimed as calibrated betting probabilities.',
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(json.dumps(artifact, indent=2, sort_keys=True))


if __name__ == '__main__':
    main()
