"""
training/tune.py — Optuna Hyperparameter Search
================================================
Runs an Optuna study with 50 trials to find XGBoost hyperparameters that
minimise MAE on the validation set.

After completion, saves the best params to models/best_params.json.
The next run of training/train.py will automatically use these params.

Usage:
    python -m training.tune                    # 50 trials (default)
    python -m training.tune --n-trials 100     # custom trial count
    python -m training.tune --days-back 60

This script is SEPARATE from the CI/training pipeline.  Run it manually
when you want to invest time in hyperparameter optimisation.  It can take
30–60 minutes for 50 trials on a dataset of ~10k rows.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import optuna
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error

from config import settings, ETA_ROOT
from training.extract import DataExtractor
from training.features import FEATURE_NAMES, fit_route_encoder, extract_stop_arrivals
from training.validate import validate_training_data, DataValidationError
from training.train import (
    TRAIN_FRAC,
    VAL_FRAC,
    _build_labelled_dataset,
)

_log = logging.getLogger(__name__)

BEST_PARAMS_PATH: Path = ETA_ROOT / "models" / "best_params.json"
DEFAULT_N_TRIALS: int = 50

# Suppress Optuna's verbose per-trial logging (keep it clean)
optuna.logging.set_verbosity(optuna.logging.WARNING)


# ---------------------------------------------------------------------------
# Objective function
# ---------------------------------------------------------------------------


def objective(
    trial: optuna.Trial,
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
) -> float:
    """Optuna objective: train XGBoost with trial params, return val MAE.

    Hyperparameter search space is carefully bounded to avoid wasted trials
    on values known to be too extreme for this dataset size and problem.

    Args:
        trial:   Optuna trial object (suggests hyperparameter values).
        X_train: Training feature matrix.
        y_train: Training labels.
        X_val:   Validation feature matrix.
        y_val:   Validation labels.

    Returns:
        Validation MAE in minutes (float, minimised by Optuna).
    """
    params = {
        "n_estimators": trial.suggest_int("n_estimators", 100, 1000, step=50),
        "max_depth": trial.suggest_int("max_depth", 3, 10),
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
        "subsample": trial.suggest_float("subsample", 0.5, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
        "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
        "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 1.0),   # L1 regularisation
        "reg_lambda": trial.suggest_float("reg_lambda", 0.5, 2.0),  # L2 regularisation
        "gamma": trial.suggest_float("gamma", 0.0, 0.5),
        "objective": "reg:squarederror",
        "eval_metric": "mae",
        "random_state": 42,
        "verbosity": 0,
        "n_jobs": -1,
        "early_stopping_rounds": 30,
    }

    model = xgb.XGBRegressor(**params)
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )

    y_pred = model.predict(X_val)
    y_pred = np.maximum(0.0, y_pred)
    mae = float(mean_absolute_error(y_val, y_pred))

    _log.debug(
        "Trial %d: MAE=%.4f | n_est=%d depth=%d lr=%.4f subsample=%.2f",
        trial.number, mae,
        params["n_estimators"], params["max_depth"],
        params["learning_rate"], params["subsample"],
    )
    return mae


# ---------------------------------------------------------------------------
# Main tune function
# ---------------------------------------------------------------------------


async def tune(days_back: int = 90, n_trials: int = DEFAULT_N_TRIALS) -> None:
    """Run the full Optuna hyperparameter search.

    Steps:
      1. Extract and validate training data.
      2. Build feature matrix and split into train/val.
      3. Run Optuna study (minimise validation MAE).
      4. Print best params and improvement over baseline.
      5. Save best_params.json.

    Args:
        days_back: Number of days of GPS history to use.
        n_trials:  Number of Optuna trials to run.
    """
    _log.info("Starting Optuna hyperparameter search (%d trials)...", n_trials)

    # ------------------------------------------------------------------
    # Step 1: Extract and validate
    # ------------------------------------------------------------------
    extractor = DataExtractor()
    try:
        data = await extractor.extract(days_back=days_back)
    finally:
        await extractor.close()

    try:
        validate_training_data(data)
    except DataValidationError as exc:
        _log.critical("Data validation failed: %s", exc)
        sys.exit(1)

    # ------------------------------------------------------------------
    # Step 2: Build feature matrix
    # ------------------------------------------------------------------
    gps_df = data.gps_df.copy()
    bus_meta = data.buses_df.set_index("bus_id")[["route_id", "capacity"]]
    gps_df = gps_df.join(bus_meta, on="bus_id", how="left")

    route_encoder = None
    if not data.routes_df.empty:
        route_encoder = fit_route_encoder(data.routes_df["route_id"].tolist())

    arrivals_df = extract_stop_arrivals(gps_df, data.stops_df)
    rows = _build_labelled_dataset(gps_df, arrivals_df, data, route_encoder)
    feature_df = pd.DataFrame(rows).sort_values("recorded_at")

    if len(feature_df) < 500:
        _log.critical("Only %d labelled rows. Cannot run tuning.", len(feature_df))
        sys.exit(1)

    n = len(feature_df)
    train_end = int(n * TRAIN_FRAC)
    val_end = int(n * (TRAIN_FRAC + VAL_FRAC))

    X_train = feature_df[FEATURE_NAMES].iloc[:train_end].values.astype(np.float32)
    y_train = feature_df["actual_eta_minutes"].iloc[:train_end].values.astype(np.float32)
    X_val = feature_df[FEATURE_NAMES].iloc[train_end:val_end].values.astype(np.float32)
    y_val = feature_df["actual_eta_minutes"].iloc[train_end:val_end].values.astype(np.float32)

    _log.info(
        "Tuning data: train=%d val=%d features=%d",
        len(X_train), len(X_val), len(FEATURE_NAMES),
    )

    # ------------------------------------------------------------------
    # Step 3: Optuna study
    # ------------------------------------------------------------------
    study = optuna.create_study(
        direction="minimize",
        study_name="nxtbus_eta_xgb",
        sampler=optuna.samplers.TPESampler(seed=42),
        pruner=optuna.pruners.MedianPruner(n_startup_trials=5, n_warmup_steps=10),
    )

    print(f"\nRunning {n_trials} Optuna trials (TPE sampler)...")
    print("This may take 20–60 minutes. Best params saved to best_params.json.\n")

    def _objective_closure(trial: optuna.Trial) -> float:
        return objective(trial, X_train, y_train, X_val, y_val)

    study.optimize(
        _objective_closure,
        n_trials=n_trials,
        show_progress_bar=True,
        callbacks=[_progress_callback],
    )

    # ------------------------------------------------------------------
    # Step 4: Report results
    # ------------------------------------------------------------------
    best_trial = study.best_trial
    best_mae = best_trial.value
    best_params = best_trial.params

    print("\n" + "=" * 60)
    print("  Optuna Search Complete")
    print("=" * 60)
    print(f"  Best validation MAE: {best_mae:.4f} minutes")
    print(f"  Best trial number:   {best_trial.number}")
    print(f"  Best hyperparameters:")
    for k, v in best_params.items():
        print(f"    {k}: {v}")

    # Compute improvement over baseline
    from training.train import BASELINE_XGB_PARAMS
    baseline_model = xgb.XGBRegressor(**BASELINE_XGB_PARAMS)
    baseline_model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    baseline_pred = np.maximum(0.0, baseline_model.predict(X_val))
    baseline_mae = float(mean_absolute_error(y_val, baseline_pred))

    improvement_pct = (baseline_mae - best_mae) / baseline_mae * 100
    print(f"\n  Baseline MAE:        {baseline_mae:.4f} minutes")
    print(f"  Improvement:         {improvement_pct:+.2f}%")

    if improvement_pct < 0:
        print("\n  NOTE: Optuna params are slightly worse than baseline on val set.")
        print("  This can happen with small datasets. Using baseline params is safer.")

    # ------------------------------------------------------------------
    # Step 5: Save best_params.json
    # ------------------------------------------------------------------
    BEST_PARAMS_PATH.parent.mkdir(parents=True, exist_ok=True)
    output = {
        **best_params,
        "objective": "reg:squarederror",
        "eval_metric": "mae",
        "random_state": 42,
        "verbosity": 0,
        "n_jobs": -1,
        "tuned_at": datetime.now(tz=timezone.utc).isoformat(),
        "best_val_mae": best_mae,
        "n_trials": n_trials,
        "optuna_version": optuna.__version__,
    }
    with open(BEST_PARAMS_PATH, "w", encoding="utf-8") as fh:
        json.dump(output, fh, indent=2)

    print(f"\n  Best params saved to: {BEST_PARAMS_PATH}")
    print("  Run training/train.py to retrain with these parameters.")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Progress callback
# ---------------------------------------------------------------------------


def _progress_callback(
    study: optuna.Study, trial: optuna.FrozenTrial
) -> None:
    """Print a one-line summary every 10 trials.

    Args:
        study: The Optuna study.
        trial: The completed trial.
    """
    if trial.number % 10 == 0:
        print(
            f"  Trial {trial.number:>3}: "
            f"val_mae={trial.value:.4f}  |  "
            f"best={study.best_value:.4f} (trial {study.best_trial.number})"
        )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Optuna hyperparameter search for NXTBus ETA XGBoost model.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--n-trials", type=int, default=DEFAULT_N_TRIALS)
    parser.add_argument("--days-back", type=int, default=90)
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    asyncio.run(tune(days_back=args.days_back, n_trials=args.n_trials))
