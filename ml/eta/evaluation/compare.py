"""
evaluation/compare.py — v1 vs v2 Side-by-Side Comparison
==========================================================
Evaluates BOTH the v1 rule-based predictor AND the v2 XGBoost model on
the SAME test set, then prints a clear comparison table showing which
version wins on every metric.

This is the A/B comparison script instead of a live A/B testing system.
Run this before deploying v2 to confirm it is actually better than v1.

Usage:
    python -m evaluation.compare
    python -m evaluation.compare --test-csv path/to/test.csv
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from geopy.distance import geodesic

from config import settings, ETA_ROOT
from training.features import FEATURE_NAMES

_log = logging.getLogger(__name__)

MODELS_DIR: Path = ETA_ROOT / "models"
MODEL_PATH: Path = MODELS_DIR / "eta_v2_xgb.pkl"


# ---------------------------------------------------------------------------
# v1 Rule-based prediction (pure Python, no DB)
# ---------------------------------------------------------------------------


def predict_v1_from_row(row: pd.Series) -> float:
    """Apply the v1 rule-based formula to a single test row.

    Uses the features already computed in the test DataFrame rather than
    making a live DB/Redis call.  This allows apples-to-apples comparison
    on the same feature vectors.

    Formula:
        eta = (distance_to_stop_km / max(rolling_avg_speed_10, speed_floor)) * 60
            + (stops_remaining * dwell_time)

    Args:
        row: A single row from the test DataFrame with FEATURE_NAMES columns.

    Returns:
        Predicted ETA in minutes (float, ≥ 0).
    """
    distance_km = float(row.get("distance_to_stop_km", 1.0))
    rolling_speed = float(row.get("rolling_avg_speed_10", settings.speed_fallback_kmh))
    stops_remaining = float(row.get("stops_remaining", 0.0))

    effective_speed = max(rolling_speed, settings.speed_floor_kmh)
    travel_time = (distance_km / effective_speed) * 60.0
    dwell_time = stops_remaining * settings.dwell_time_per_stop_minutes

    return max(0.0, travel_time + dwell_time)


# ---------------------------------------------------------------------------
# Metric computation (shared)
# ---------------------------------------------------------------------------


def compute_comparison_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    label: str,
) -> dict:
    """Compute a reduced set of comparison metrics.

    Args:
        y_true: Ground truth ETA values.
        y_pred: Predicted ETA values.
        label:  Name of the predictor (e.g. 'v1_rule_based', 'v2_xgb').

    Returns:
        Dict of metric name → value with a 'label' key.
    """
    errors = np.abs(y_pred - y_true)
    n = len(y_true)

    mae = float(np.mean(errors))
    rmse = float(np.sqrt(np.mean((y_pred - y_true) ** 2)))

    nonzero = y_true > 0.1
    mape = (
        float(np.mean(np.abs((y_true[nonzero] - y_pred[nonzero]) / y_true[nonzero])) * 100)
        if nonzero.sum() > 0
        else float("nan")
    )

    return {
        "label": label,
        "mae": mae,
        "rmse": rmse,
        "mape": mape,
        "within_2min_pct": float((errors <= 2.0).sum() / n * 100),
        "within_5min_pct": float((errors <= 5.0).sum() / n * 100),
        "within_10min_pct": float((errors <= 10.0).sum() / n * 100),
        "max_error": float(errors.max()),
        "median_error": float(np.median(errors)),
    }


# ---------------------------------------------------------------------------
# Main comparison function
# ---------------------------------------------------------------------------


def compare(
    model_path: Optional[Path] = None,
    test_csv: Optional[Path] = None,
) -> None:
    """Run v1 vs v2 comparison on the same test set and print results.

    Args:
        model_path: Path to the XGBoost .pkl file.
        test_csv:   Path to a CSV test set. If None, re-extracts from DB.

    Raises:
        FileNotFoundError: If the model file is not found.
        RuntimeError:      If the test set cannot be loaded.
    """
    model_path = model_path or MODEL_PATH

    # --- Load model ---
    if not model_path.exists():
        raise FileNotFoundError(
            f"XGBoost model not found at '{model_path}'. "
            "Run training/train.py first."
        )
    _log.info("Loading XGBoost model from %s...", model_path)
    model: xgb.XGBRegressor = joblib.load(model_path)

    # --- Load test data ---
    if test_csv is not None:
        _log.info("Loading test data from %s...", test_csv)
        test_df = pd.read_csv(test_csv)
    else:
        _log.info("Extracting test set from DB (most recent 15%% of labelled data)...")
        from evaluation.evaluate import _extract_test_set
        test_df = _extract_test_set()

    if test_df is None or test_df.empty:
        raise RuntimeError("Test DataFrame is empty.")

    missing = set(FEATURE_NAMES) - set(test_df.columns)
    if missing:
        raise RuntimeError(f"Test DataFrame missing feature columns: {missing}")

    y_true = test_df["actual_eta_minutes"].values.astype(np.float32)

    # --- v1 predictions ---
    _log.info("Computing v1 rule-based predictions on %d test rows...", len(test_df))
    y_pred_v1 = test_df.apply(predict_v1_from_row, axis=1).values.astype(np.float32)
    y_pred_v1 = np.maximum(0.0, y_pred_v1)

    # --- v2 predictions ---
    _log.info("Computing v2 XGBoost predictions...")
    X_test = test_df[FEATURE_NAMES].values.astype(np.float32)
    y_pred_v2 = model.predict(X_test)
    y_pred_v2 = np.maximum(0.0, y_pred_v2)

    # --- Metrics ---
    metrics_v1 = compute_comparison_metrics(y_true, y_pred_v1, "v1_rule_based")
    metrics_v2 = compute_comparison_metrics(y_true, y_pred_v2, "v2_xgb")

    # --- Print comparison table ---
    _print_comparison_table(metrics_v1, metrics_v2, len(y_true))


def _print_comparison_table(
    v1: dict, v2: dict, n_samples: int
) -> None:
    """Print a formatted side-by-side comparison table.

    Args:
        v1:        v1 metrics dict.
        v2:        v2 metrics dict.
        n_samples: Number of test samples.
    """

    def _winner(v1_val: float, v2_val: float, higher_better: bool = False) -> tuple[str, str]:
        """Return (v1_marker, v2_marker) where winner gets '★'."""
        if higher_better:
            win_v2 = v2_val > v1_val
        else:
            win_v2 = v2_val < v1_val
        return ("  ", "★") if win_v2 else ("★", "  ")

    def _improvement(v1_val: float, v2_val: float, higher_better: bool = False) -> str:
        if v1_val == 0:
            return "N/A"
        if higher_better:
            diff_pct = (v2_val - v1_val) / abs(v1_val) * 100
        else:
            diff_pct = (v1_val - v2_val) / abs(v1_val) * 100
        prefix = "+" if diff_pct >= 0 else ""
        return f"{prefix}{diff_pct:.1f}%"

    print("\n" + "=" * 70)
    print("  NXTBus ETA — v1 Rule-Based vs v2 XGBoost Comparison")
    print(f"  Test samples: {n_samples}")
    print("=" * 70)
    print(f"  {'Metric':<28} {'v1 Rule-Based':>15} {'v2 XGBoost':>15} {'Improvement':>12}")
    print("  " + "-" * 68)

    metrics_to_print = [
        ("MAE (minutes)", "mae", False),
        ("RMSE (minutes)", "rmse", False),
        ("MAPE (%)", "mape", False),
        ("Median error (min)", "median_error", False),
        ("Max error (min)", "max_error", False),
        ("Within ±2 min (%)", "within_2min_pct", True),
        ("Within ±5 min (%)", "within_5min_pct", True),
        ("Within ±10 min (%)", "within_10min_pct", True),
    ]

    v2_wins = 0
    v1_wins = 0

    for label, key, higher_better in metrics_to_print:
        v1_val = v1[key]
        v2_val = v2[key]
        w1, w2 = _winner(v1_val, v2_val, higher_better)
        impr = _improvement(v1_val, v2_val, higher_better)

        if w2 == "★":
            v2_wins += 1
        else:
            v1_wins += 1

        print(
            f"  {label:<28} {w1}{v1_val:>13.2f} {w2}{v2_val:>13.2f} {impr:>12}"
        )

    print("  " + "-" * 68)
    print(f"\n  WINNER: ", end="")

    if v2_wins > v1_wins:
        print(f"★ v2 XGBoost ({v2_wins}/{len(metrics_to_print)} metrics better)")
        print("  ✓ Recommend deploying v2 XGBoost.")
    elif v1_wins > v2_wins:
        print(f"★ v1 Rule-Based ({v1_wins}/{len(metrics_to_print)} metrics better)")
        print("  ✗ v2 XGBoost does not outperform v1. Review training data quality.")
        print("    Consider collecting more data or running tune.py for hyperparameter search.")
    else:
        print("Tie — further evaluation needed.")

    # MAE comparison (primary metric)
    mae_improvement = (v1["mae"] - v2["mae"]) / v1["mae"] * 100
    print(f"\n  Primary metric (MAE) improvement: {mae_improvement:+.1f}%")
    print(f"  v1 MAE: {v1['mae']:.3f} min")
    print(f"  v2 MAE: {v2['mae']:.3f} min")
    print("=" * 70)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare v1 rule-based vs v2 XGBoost ETA predictors.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--model-path", type=Path, default=None)
    parser.add_argument("--test-csv", type=Path, default=None)
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    compare(model_path=args.model_path, test_csv=args.test_csv)
