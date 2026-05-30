"""
evaluation/evaluate.py — Model Evaluation with SHAP
====================================================
Loads the trained XGBoost model and a test dataset, computes evaluation
metrics, prints a formatted report, and saves a SHAP feature importance plot.

Usage:
    python -m evaluation.evaluate
    python -m evaluation.evaluate --test-csv path/to/test.csv
    python -m evaluation.evaluate --model-path models/eta_v2_xgb.pkl

Outputs:
  - Printed metrics table (MAE, RMSE, MAPE, percentile buckets, worst cases)
  - models/feature_importance.png  (top 10 features by mean |SHAP| value)
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path
from typing import Optional

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error

from config import settings, ETA_ROOT
from training.features import FEATURE_NAMES

_log = logging.getLogger(__name__)

MODELS_DIR: Path = ETA_ROOT / "models"
MODEL_PATH: Path = MODELS_DIR / "eta_v2_xgb.pkl"
FEATURE_IMPORTANCE_PATH: Path = MODELS_DIR / "feature_importance.png"

# Targets for pass/fail reporting
TARGET_MAE: float = 2.5
TARGET_WITHIN_2MIN: float = 60.0
TARGET_WITHIN_5MIN: float = 85.0
TARGET_WITHIN_10MIN: float = 95.0
TARGET_MAX_ERROR: float = 15.0
TOP_WORST_N: int = 10


# ---------------------------------------------------------------------------
# Main evaluation function
# ---------------------------------------------------------------------------


def evaluate(
    model_path: Optional[Path] = None,
    test_csv: Optional[Path] = None,
) -> dict:
    """Load model and test data, compute and print all metrics, save SHAP plot.

    Args:
        model_path: Path to the .pkl model file. Defaults to settings.model_path.
        test_csv:   Path to a CSV test set. If None, re-extracts data from DB
                    and uses the most-recent 15% as the test set (matches train.py split).

    Returns:
        Dict of evaluation metrics.

    Raises:
        FileNotFoundError: If the model file is not found.
        RuntimeError:      If test data cannot be loaded.
    """
    model_path = model_path or settings.model_path

    _log.info("Loading model from %s...", model_path)
    if not model_path.exists():
        raise FileNotFoundError(
            f"Model file not found at '{model_path}'. "
            "Run training/train.py first."
        )

    model: xgb.XGBRegressor = joblib.load(model_path)
    _log.info("Model loaded successfully.")

    # Load or generate test data
    if test_csv is not None:
        _log.info("Loading test data from CSV: %s", test_csv)
        test_df = pd.read_csv(test_csv)
    else:
        _log.info("No test CSV provided — extracting test set from DB (last 15%% of data)...")
        test_df = _extract_test_set()

    if test_df is None or test_df.empty:
        raise RuntimeError(
            "Test DataFrame is empty. Cannot evaluate. "
            "Provide --test-csv or ensure the database has sufficient GPS history."
        )

    # Validate feature columns
    missing_features = set(FEATURE_NAMES) - set(test_df.columns)
    if missing_features:
        raise RuntimeError(
            f"Test DataFrame is missing feature columns: {missing_features}. "
            "Ensure the test CSV was produced by the same pipeline as training."
        )

    if "actual_eta_minutes" not in test_df.columns:
        raise RuntimeError(
            "Test DataFrame must have an 'actual_eta_minutes' column. "
            "This is the ground truth label produced by extract_stop_arrivals()."
        )

    X_test = test_df[FEATURE_NAMES].values.astype(np.float32)
    y_test = test_df["actual_eta_minutes"].values.astype(np.float32)

    _log.info("Test set: %d rows.", len(X_test))

    # --- Run inference ---
    y_pred = model.predict(X_test)
    y_pred = np.maximum(0.0, y_pred)  # ETA never negative

    # --- Compute metrics ---
    metrics = _compute_metrics(y_test, y_pred)

    # --- Print report ---
    _print_evaluation_report(metrics, test_df, y_pred)

    # --- SHAP analysis ---
    _generate_shap_plot(model, X_test, FEATURE_NAMES, FEATURE_IMPORTANCE_PATH)

    return metrics


def _extract_test_set() -> pd.DataFrame:
    """Re-run training data extraction and return the most-recent 15%.

    This mirrors exactly what train.py does so evaluate.py uses the same
    test split without requiring a saved CSV.

    Returns:
        DataFrame with FEATURE_NAMES + actual_eta_minutes columns,
        representing the most recent 15% of available labelled data.
    """
    import asyncio as _asyncio
    from training.extract import DataExtractor
    from training.validate import validate_training_data
    from training.train import _build_labelled_dataset, _build_route_stops_lookup
    from training.features import extract_stop_arrivals, fit_route_encoder

    async def _run() -> pd.DataFrame:
        extractor = DataExtractor()
        try:
            data = await extractor.extract(days_back=90)
        finally:
            await extractor.close()

        validate_training_data(data)

        gps_df = data.gps_df.copy()
        bus_meta = data.buses_df.set_index("bus_id")[["route_id", "capacity"]]
        gps_df = gps_df.join(bus_meta, on="bus_id", how="left")

        route_encoder = None
        if not data.routes_df.empty:
            route_encoder = fit_route_encoder(data.routes_df["route_id"].tolist())

        arrivals_df = extract_stop_arrivals(gps_df, data.stops_df)
        rows = _build_labelled_dataset(gps_df, arrivals_df, data, route_encoder)
        df = pd.DataFrame(rows).sort_values("recorded_at")

        n = len(df)
        test_start = int(n * 0.85)
        return df.iloc[test_start:]

    return _asyncio.run(_run())


# ---------------------------------------------------------------------------
# Metrics computation
# ---------------------------------------------------------------------------


def _compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """Compute all evaluation metrics.

    Args:
        y_true: Ground truth ETA in minutes.
        y_pred: Predicted ETA in minutes.

    Returns:
        Dict of metric name → value.
    """
    errors = np.abs(y_pred - y_true)
    n = len(y_true)

    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))

    nonzero = y_true > 0.1
    if nonzero.sum() > 0:
        mape = float(
            np.mean(np.abs((y_true[nonzero] - y_pred[nonzero]) / y_true[nonzero])) * 100
        )
    else:
        mape = float("nan")

    return {
        "mae": mae,
        "rmse": rmse,
        "mape": mape,
        "within_2min_pct": float((errors <= 2.0).sum() / n * 100),
        "within_5min_pct": float((errors <= 5.0).sum() / n * 100),
        "within_10min_pct": float((errors <= 10.0).sum() / n * 100),
        "max_error": float(errors.max()),
        "median_error": float(np.median(errors)),
        "p75_error": float(np.percentile(errors, 75)),
        "p95_error": float(np.percentile(errors, 95)),
        "n_samples": n,
    }


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def _print_evaluation_report(
    metrics: dict,
    test_df: pd.DataFrame,
    y_pred: np.ndarray,
) -> None:
    """Print formatted metrics table and worst-case predictions.

    Args:
        metrics:  Dict from _compute_metrics().
        test_df:  Test DataFrame (for extracting worst-case rows).
        y_pred:   Model predictions (numpy array).
    """

    def _flag(value: float, target: float, higher_better: bool = False) -> str:
        ok = value < target if not higher_better else value > target
        return "✓" if ok else "✗"

    print("\n" + "=" * 60)
    print("  NXTBus ETA v2 XGBoost — Evaluation Report")
    print("=" * 60)
    print(f"  Test samples:           {metrics['n_samples']}")
    print(f"  MAE:                    {metrics['mae']:.3f} min  "
          f"(target < {TARGET_MAE}) {_flag(metrics['mae'], TARGET_MAE)}")
    print(f"  RMSE:                   {metrics['rmse']:.3f} min")
    print(f"  MAPE:                   {metrics['mape']:.1f}%")
    print(f"  Median absolute error:  {metrics['median_error']:.3f} min")
    print(f"  p75 absolute error:     {metrics['p75_error']:.3f} min")
    print(f"  p95 absolute error:     {metrics['p95_error']:.3f} min")
    print(f"  Within ±2 min:          {metrics['within_2min_pct']:.1f}%  "
          f"(target > {TARGET_WITHIN_2MIN:.0f}%) {_flag(metrics['within_2min_pct'], TARGET_WITHIN_2MIN, True)}")
    print(f"  Within ±5 min:          {metrics['within_5min_pct']:.1f}%  "
          f"(target > {TARGET_WITHIN_5MIN:.0f}%) {_flag(metrics['within_5min_pct'], TARGET_WITHIN_5MIN, True)}")
    print(f"  Within ±10 min:         {metrics['within_10min_pct']:.1f}%  "
          f"(target > {TARGET_WITHIN_10MIN:.0f}%) {_flag(metrics['within_10min_pct'], TARGET_WITHIN_10MIN, True)}")
    print(f"  Max error:              {metrics['max_error']:.1f} min  "
          f"(target < {TARGET_MAX_ERROR:.0f} min) {_flag(metrics['max_error'], TARGET_MAX_ERROR)}")
    print("=" * 60)

    # --- Worst-case predictions ---
    y_true = test_df["actual_eta_minutes"].values
    errors = np.abs(y_pred - y_true)
    worst_idx = np.argsort(errors)[-TOP_WORST_N:][::-1]

    print(f"\n  Top {TOP_WORST_N} Worst Predictions:")
    print(f"  {'#':>3}  {'Actual':>8}  {'Predicted':>10}  {'Error':>8}  {'Bus':>16}  {'Stop':>16}")
    print("  " + "-" * 70)

    for rank, idx in enumerate(worst_idx, 1):
        actual = float(y_true[idx])
        predicted = float(y_pred[idx])
        error = abs(predicted - actual)
        bus_id = test_df.iloc[idx].get("bus_id", "?") if "bus_id" in test_df.columns else "?"
        stop_id = test_df.iloc[idx].get("stop_id", "?") if "stop_id" in test_df.columns else "?"
        print(
            f"  {rank:>3}  {actual:>8.1f}  {predicted:>10.1f}  {error:>8.1f}  "
            f"{str(bus_id):>16}  {str(stop_id):>16}"
        )

    print("\n  Feature importance plot saved to:", FEATURE_IMPORTANCE_PATH)
    print("=" * 60)


# ---------------------------------------------------------------------------
# SHAP analysis
# ---------------------------------------------------------------------------


def _generate_shap_plot(
    model: xgb.XGBRegressor,
    X_test: np.ndarray,
    feature_names: list[str],
    output_path: Path,
) -> None:
    """Compute SHAP values and save feature importance bar plot.

    Uses TreeExplainer (fast, exact SHAP values for tree ensembles) to
    compute the mean absolute SHAP value per feature.  Saves a horizontal
    bar chart of the top 10 features.

    Args:
        model:         Trained XGBRegressor.
        X_test:        Test feature matrix (n_samples × n_features).
        feature_names: Ordered list of feature names.
        output_path:   Where to save the PNG file.
    """
    _log.info("Computing SHAP values (TreeExplainer)...")

    try:
        # Subsample for speed if test set is large
        max_shap_samples = min(1000, len(X_test))
        X_shap = X_test[:max_shap_samples]

        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_shap)

        # Mean absolute SHAP value per feature
        mean_abs_shap = np.abs(shap_values).mean(axis=0)
        shap_df = pd.DataFrame(
            {"feature": feature_names, "mean_abs_shap": mean_abs_shap}
        ).sort_values("mean_abs_shap", ascending=True).tail(10)

        # Plot
        fig, ax = plt.subplots(figsize=(10, 6))
        bars = ax.barh(shap_df["feature"], shap_df["mean_abs_shap"], color="#3b82f6")
        ax.set_xlabel("Mean |SHAP value| (minutes)", fontsize=12)
        ax.set_title("ETA v2 — Top 10 Features by SHAP Importance", fontsize=14, fontweight="bold")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.grid(axis="x", alpha=0.3)

        # Add value labels on bars
        for bar, val in zip(bars, shap_df["mean_abs_shap"]):
            ax.text(
                bar.get_width() + 0.01,
                bar.get_y() + bar.get_height() / 2,
                f"{val:.3f}",
                va="center",
                fontsize=9,
            )

        plt.tight_layout()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output_path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        _log.info("SHAP feature importance plot saved to %s", output_path)

    except Exception as exc:  # pylint: disable=broad-except
        _log.warning("SHAP analysis failed (non-fatal): %s", exc, exc_info=True)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate the NXTBus ETA XGBoost model.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--model-path",
        type=Path,
        default=None,
        help="Path to the .pkl model file (default: from config).",
    )
    parser.add_argument(
        "--test-csv",
        type=Path,
        default=None,
        help="Path to CSV test set. If omitted, re-extracts from DB.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    evaluate(
        model_path=args.model_path,
        test_csv=args.test_csv,
    )
