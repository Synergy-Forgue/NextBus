"""
training/train.py — XGBoost ETA Model Training Pipeline
========================================================
Main training script.  Executes the full pipeline in this order:

  1. Connect to PostgreSQL, extract last 90 days of GPS history
  2. Validate data quality (exit code 1 if fails)
  3. Engineer features using training/features.py
  4. Time-based train/val/test split (70/15/15)
  5. Train XGBoost (baseline params, overridden by best_params.json if present)
  6. Evaluate on test set — print full metrics table
  7. Save model to models/eta_v2_xgb.pkl
  8. Save models/metadata.json
  9. Log to MLflow: params, metrics, model artifact
  10. Print summary line

Run:
    python -m training.train
    # or with custom days:
    python -m training.train --days-back 60
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

import joblib
import mlflow
import mlflow.xgboost
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import LabelEncoder

from config import settings, ETA_ROOT
from training.extract import DataExtractor
from training.features import (
    FEATURE_NAMES,
    build_feature_matrix,
    extract_stop_arrivals,
    fit_route_encoder,
)
from training.validate import validate_training_data, DataValidationError

_log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASELINE_XGB_PARAMS: dict = {
    "n_estimators": 500,
    "max_depth": 6,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "early_stopping_rounds": 50,
    "eval_metric": "mae",
    "objective": "reg:squarederror",
    "random_state": 42,
    "verbosity": 0,
    "n_jobs": -1,
}

MAE_TARGET_MINUTES: float = 2.5       # Training target threshold
MODELS_DIR: Path = ETA_ROOT / "models"
MODEL_PATH: Path = MODELS_DIR / "eta_v2_xgb.pkl"
METADATA_PATH: Path = MODELS_DIR / "metadata.json"
BEST_PARAMS_PATH: Path = ETA_ROOT / "models" / "best_params.json"

TRAIN_FRAC: float = 0.70
VAL_FRAC: float = 0.15
# TEST_FRAC implicitly = 1 - TRAIN_FRAC - VAL_FRAC = 0.15


# ---------------------------------------------------------------------------
# Main async training function
# ---------------------------------------------------------------------------


async def train(days_back: int = 90) -> None:
    """Run the full XGBoost ETA training pipeline.

    Steps 1–10 as documented in the module docstring.

    Args:
        days_back: Number of days of GPS history to use.
    """
    _log.info("=" * 60)
    _log.info("NXTBus ETA Training Pipeline — XGBoost v2")
    _log.info("=" * 60)

    # ------------------------------------------------------------------
    # Step 1: Extract data
    # ------------------------------------------------------------------
    _log.info("Step 1/10: Extracting GPS history (last %d days)...", days_back)
    extractor = DataExtractor()
    try:
        data = await extractor.extract(days_back=days_back)
    except Exception as exc:
        _log.critical("Data extraction failed: %s", exc, exc_info=True)
        sys.exit(1)
    finally:
        await extractor.close()

    _log.info("Extracted %d GPS rows, %d stops, %d buses.",
              data.n_gps_rows, len(data.stops_df), len(data.buses_df))

    # ------------------------------------------------------------------
    # Step 2: Validate
    # ------------------------------------------------------------------
    _log.info("Step 2/10: Validating data quality...")
    try:
        report = validate_training_data(data)
    except DataValidationError as exc:
        _log.critical("DATA VALIDATION FAILED: %s", exc)
        _log.critical("Fix the data issue above and re-run training.")
        sys.exit(1)

    for warning in report.warnings:
        print(warning)

    _log.info(
        "Validation passed: %d/%d checks. Clean rows: %d.",
        report.n_passed, report.n_checks, report.gps_rows_clean,
    )

    # ------------------------------------------------------------------
    # Step 3: Feature engineering
    # ------------------------------------------------------------------
    _log.info("Step 3/10: Engineering features...")

    # Merge bus route_id and capacity into gps_df
    gps_df = data.gps_df.copy()
    bus_meta = data.buses_df.set_index("bus_id")[["route_id", "capacity"]]
    gps_df = gps_df.join(bus_meta, on="bus_id", how="left")

    # Fit route encoder on all known routes
    route_encoder: Optional[LabelEncoder] = None
    if not data.routes_df.empty:
        route_ids = data.routes_df["route_id"].tolist()
        route_encoder = fit_route_encoder(route_ids)
        route_encoding_map = {
            rid: int(route_encoder.transform([rid])[0])
            for rid in route_ids
        }
    else:
        route_encoding_map = {}

    # Build feature matrix for each stop
    # For training, we use one representative target stop per route.
    # In practice, we build one matrix per (bus, stop) pair from arrivals.
    _log.info("Extracting stop arrival events...")
    arrivals_df = extract_stop_arrivals(gps_df, data.stops_df)
    _log.info("Found %d stop arrival events.", len(arrivals_df))

    if arrivals_df.empty:
        _log.critical(
            "No stop arrival events found. Cannot derive training labels. "
            "Ensure the GPS data covers routes that pass through known stops "
            "within %dm.", settings.stop_arrival_radius_meters
        )
        sys.exit(1)

    # Build labelled training rows:
    # For each arrival event, find the GPS record closest in time before arrival
    # and compute features at that moment. The label is time_to_arrival.
    labelled_rows = _build_labelled_dataset(gps_df, arrivals_df, data, route_encoder)

    if len(labelled_rows) < 500:
        _log.critical(
            "Only %d labelled rows generated. Need at least 500. "
            "More GPS history and stop arrival events are required.",
            len(labelled_rows),
        )
        sys.exit(1)

    feature_df = pd.DataFrame(labelled_rows)
    _log.info(
        "Feature matrix built: %d rows × %d features.",
        len(feature_df), len(FEATURE_NAMES),
    )

    # ------------------------------------------------------------------
    # Step 4: Time-based train / val / test split
    # ------------------------------------------------------------------
    _log.info("Step 4/10: Time-based train/val/test split (70/15/15)...")
    feature_df = feature_df.sort_values("recorded_at").reset_index(drop=True)
    n = len(feature_df)
    train_end = int(n * TRAIN_FRAC)
    val_end = int(n * (TRAIN_FRAC + VAL_FRAC))

    train_df = feature_df.iloc[:train_end]
    val_df = feature_df.iloc[train_end:val_end]
    test_df = feature_df.iloc[val_end:]

    _log.info(
        "Split: train=%d val=%d test=%d (most recent 15%% are test set)",
        len(train_df), len(val_df), len(test_df),
    )

    X_train = train_df[FEATURE_NAMES].values.astype(np.float32)
    y_train = train_df["actual_eta_minutes"].values.astype(np.float32)
    X_val = val_df[FEATURE_NAMES].values.astype(np.float32)
    y_val = val_df["actual_eta_minutes"].values.astype(np.float32)
    X_test = test_df[FEATURE_NAMES].values.astype(np.float32)
    y_test = test_df["actual_eta_minutes"].values.astype(np.float32)

    # ------------------------------------------------------------------
    # Step 5: Train XGBoost
    # ------------------------------------------------------------------
    _log.info("Step 5/10: Training XGBoost model...")
    xgb_params = _load_xgb_params()
    _log.info("XGBoost params: %s", xgb_params)

    model = xgb.XGBRegressor(**xgb_params)

    early_stopping = xgb_params.pop("early_stopping_rounds", 50)
    model.set_params(early_stopping_rounds=early_stopping)

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        verbose=50,
    )

    _log.info(
        "Training complete. Best iteration: %d",
        model.best_iteration if hasattr(model, "best_iteration") else "N/A",
    )

    # ------------------------------------------------------------------
    # Step 6: Evaluate on test set
    # ------------------------------------------------------------------
    _log.info("Step 6/10: Evaluating on test set...")
    metrics = _evaluate_model(model, X_test, y_test, FEATURE_NAMES)
    _print_metrics_table(metrics)

    if metrics["mae"] >= MAE_TARGET_MINUTES:
        print(
            f"\nWARNING: MAE {metrics['mae']:.2f} exceeds target {MAE_TARGET_MINUTES} min. "
            "Model saved but review feature quality and data coverage before deploying."
        )

    # ------------------------------------------------------------------
    # Step 7: Save model
    # ------------------------------------------------------------------
    _log.info("Step 7/10: Saving model to %s...", MODEL_PATH)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    _log.info("Model saved: %s", MODEL_PATH)

    # ------------------------------------------------------------------
    # Step 8: Save metadata
    # ------------------------------------------------------------------
    _log.info("Step 8/10: Saving metadata...")
    metadata = {
        "version": "v2_xgb",
        "mae": round(metrics["mae"], 4),
        "rmse": round(metrics["rmse"], 4),
        "mape": round(metrics["mape"], 4),
        "within_2min_pct": round(metrics["within_2min_pct"], 2),
        "within_5min_pct": round(metrics["within_5min_pct"], 2),
        "within_10min_pct": round(metrics["within_10min_pct"], 2),
        "n_train": len(X_train),
        "n_val": len(X_val),
        "n_test": len(X_test),
        "n_samples": len(feature_df),
        "feature_names": FEATURE_NAMES,
        "route_encoding": route_encoding_map,
        "trained_at": datetime.now(tz=timezone.utc).isoformat(),
        "xgb_version": xgb.__version__,
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "days_back": days_back,
        "date_from": data.date_from.isoformat(),
        "date_to": data.date_to.isoformat(),
    }
    with open(METADATA_PATH, "w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2)
    _log.info("Metadata saved: %s", METADATA_PATH)

    # ------------------------------------------------------------------
    # Step 9: MLflow logging
    # ------------------------------------------------------------------
    _log.info("Step 9/10: Logging to MLflow...")
    _log_to_mlflow(model, xgb_params, metrics, metadata)

    # ------------------------------------------------------------------
    # Step 10: Final summary
    # ------------------------------------------------------------------
    print(f"\nModel saved. MAE on test set: {metrics['mae']:.2f} minutes")
    _log.info("Training pipeline complete.")


# ---------------------------------------------------------------------------
# Helper: build labelled dataset
# ---------------------------------------------------------------------------


def _build_labelled_dataset(
    gps_df: pd.DataFrame,
    arrivals_df: pd.DataFrame,
    data,
    route_encoder: Optional[LabelEncoder],
) -> list[dict]:
    """Build labelled training rows from GPS history and arrival events.

    For each stop arrival event:
      1. Find GPS records for that bus in the 30 min window before arrival.
      2. For each prior GPS record, compute features and label
         (actual_eta_minutes = time from that record to arrival).

    This generates many labelled examples per arrival (one per prior GPS fix),
    giving the model diverse training samples at varying distances from the stop.

    Args:
        gps_df:        Full GPS history DataFrame with route_id, capacity.
        arrivals_df:   Stop arrival events from extract_stop_arrivals().
        data:          ExtractedData (for stops, route_stops, segment_speed).
        route_encoder: Fitted LabelEncoder for route IDs.

    Returns:
        List of dicts, each representing one labelled training row.
    """
    rows = []
    route_stops_lookup = _build_route_stops_lookup(data.route_stops_df)
    target_stop_coords = data.stops_df.set_index("stop_id")[["lat", "lng"]].to_dict("index")

    # Process in chunks to avoid memory blowup on large datasets
    for _, arrival in arrivals_df.iterrows():
        bus_id = arrival["bus_id"]
        stop_id = arrival["stop_id"]
        arrival_time = arrival["arrival_time"]

        if stop_id not in target_stop_coords:
            continue

        stop_lat = float(target_stop_coords[stop_id]["lat"])
        stop_lng = float(target_stop_coords[stop_id]["lng"])

        # GPS records for this bus in the 30 min window before arrival
        window_start = arrival_time - pd.Timedelta(minutes=30)
        bus_prior = gps_df[
            (gps_df["bus_id"] == bus_id)
            & (gps_df["recorded_at"] >= window_start)
            & (gps_df["recorded_at"] < arrival_time)
        ].sort_values("recorded_at")

        if bus_prior.empty:
            continue

        route_id = str(bus_prior.iloc[0].get("route_id", ""))
        route_stops = route_stops_lookup.get(route_id, [])

        for _, gps_row in bus_prior.iterrows():
            from training.features import (
                compute_distance_to_stop_km,
                compute_stops_remaining,
                compute_occupancy_ratio,
                compute_congestion_index,
                compute_segment_hist_speed,
                compute_temporal_features,
                compute_is_peak_hour,
                encode_route_id,
            )

            eta_minutes = (arrival_time - gps_row["recorded_at"]).total_seconds() / 60.0
            if eta_minutes <= 0 or eta_minutes > 120:
                continue  # Filter unreasonable labels

            temporal = compute_temporal_features(gps_row["recorded_at"])
            current_speed = float(gps_row.get("speed_kmh", 0.0) or 0.0)

            # Rolling speeds from gps_df up to this timestamp
            prior_speeds = gps_df[
                (gps_df["bus_id"] == bus_id)
                & (gps_df["recorded_at"] <= gps_row["recorded_at"])
            ]["speed_kmh"].dropna().tail(10).tolist()

            avg5 = np.mean(prior_speeds[-5:]) if len(prior_speeds) >= 5 else settings.speed_fallback_kmh
            avg10 = np.mean(prior_speeds) if len(prior_speeds) >= 10 else settings.speed_fallback_kmh
            variance = float(np.var(prior_speeds)) if len(prior_speeds) >= 2 else 0.0

            seg_speed = compute_segment_hist_speed(
                float(gps_row["lat"]), float(gps_row["lng"]),
                temporal["hour_of_day"], data.segment_speed_df,
            )
            cong = compute_congestion_index(current_speed, seg_speed)

            if route_encoder is not None:
                rid_enc = encode_route_id(route_id, route_encoder)
            else:
                rid_enc = hash(route_id) % 100

            occ_ratio = compute_occupancy_ratio(
                int(gps_row.get("occupancy", 0) or 0),
                int(gps_row.get("capacity", 50) or 50),
            )

            stops_rem = compute_stops_remaining(
                float(gps_row["lat"]), float(gps_row["lng"]),
                stop_id, route_stops,
            )

            rows.append({
                "distance_to_stop_km": compute_distance_to_stop_km(
                    float(gps_row["lat"]), float(gps_row["lng"]),
                    stop_lat, stop_lng,
                ),
                "stops_remaining": float(stops_rem),
                "current_speed_kmh": current_speed,
                "rolling_avg_speed_5": float(avg5),
                "rolling_avg_speed_10": float(avg10),
                "speed_variance": variance,
                "hour_of_day": float(temporal["hour_of_day"]),
                "minute_of_hour": float(temporal["minute_of_hour"]),
                "day_of_week": float(temporal["day_of_week"]),
                "is_weekday": float(temporal["is_weekday"]),
                "is_peak_hour": float(compute_is_peak_hour(temporal["hour_of_day"])),
                "route_id_encoded": float(rid_enc),
                "direction": 0.0,  # simplified in training; predictor infers at runtime
                "occupancy_ratio": occ_ratio,
                "congestion_index": cong,
                "segment_hist_speed": seg_speed,
                "hist_avg_dwell_at_next": settings.dwell_time_per_stop_minutes,
                "actual_eta_minutes": eta_minutes,
                "recorded_at": gps_row["recorded_at"],
            })

    _log.info("_build_labelled_dataset: generated %d labelled rows.", len(rows))
    return rows


def _build_route_stops_lookup(route_stops_df: pd.DataFrame) -> dict[str, list[dict]]:
    """Convert route_stops DataFrame to nested dict keyed by route_id.

    Args:
        route_stops_df: DataFrame with route_id, stop_id, stop_order, lat, lng.

    Returns:
        Dict: route_id → [{stop_id, stop_order, lat, lng}].
    """
    lookup: dict[str, list[dict]] = {}
    for row in route_stops_df.itertuples(index=False):
        rid = str(row.route_id)
        if rid not in lookup:
            lookup[rid] = []
        lookup[rid].append({
            "stop_id": str(row.stop_id),
            "stop_order": int(row.stop_order),
            "lat": float(row.lat),
            "lng": float(row.lng),
        })
    return lookup


# ---------------------------------------------------------------------------
# Helper: load XGBoost params
# ---------------------------------------------------------------------------


def _load_xgb_params() -> dict:
    """Load XGBoost hyperparameters.

    If models/best_params.json exists (created by tune.py Optuna study),
    it overrides the baseline params.  Otherwise returns BASELINE_XGB_PARAMS.

    Returns:
        Dict of XGBoost constructor arguments.
    """
    params = dict(BASELINE_XGB_PARAMS)

    if BEST_PARAMS_PATH.exists():
        try:
            with open(BEST_PARAMS_PATH, "r", encoding="utf-8") as fh:
                best = json.load(fh)
            _log.info("Loaded Optuna best_params.json: %s", best)
            params.update(best)
        except Exception as exc:  # pylint: disable=broad-except
            _log.warning("Could not read best_params.json: %s. Using baseline.", exc)
    else:
        _log.info("No best_params.json found. Using baseline XGBoost params.")

    return params


# ---------------------------------------------------------------------------
# Helper: evaluate model
# ---------------------------------------------------------------------------


def _evaluate_model(
    model: xgb.XGBRegressor,
    X_test: np.ndarray,
    y_test: np.ndarray,
    feature_names: list[str],
) -> dict[str, float]:
    """Evaluate the model and compute all required metrics.

    Args:
        model:         Trained XGBRegressor.
        X_test:        Test feature matrix.
        y_test:        Test labels (actual_eta_minutes).
        feature_names: Feature names for logging.

    Returns:
        Dict with keys: mae, rmse, mape, within_2min_pct, within_5min_pct,
        within_10min_pct, max_error, best_iteration.
    """
    y_pred = model.predict(X_test)
    y_pred = np.maximum(0.0, y_pred)  # ETA cannot be negative

    errors = np.abs(y_pred - y_test)

    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))

    # MAPE — avoid division by zero for very small actual values
    nonzero_mask = y_test > 0.1
    if nonzero_mask.sum() > 0:
        mape = float(np.mean(np.abs((y_test[nonzero_mask] - y_pred[nonzero_mask]) / y_test[nonzero_mask])) * 100)
    else:
        mape = float("nan")

    n = len(y_test)
    within_2min_pct = float((errors <= 2.0).sum() / n * 100)
    within_5min_pct = float((errors <= 5.0).sum() / n * 100)
    within_10min_pct = float((errors <= 10.0).sum() / n * 100)
    max_error = float(errors.max())

    best_iter = getattr(model, "best_iteration", None)

    return {
        "mae": mae,
        "rmse": rmse,
        "mape": mape,
        "within_2min_pct": within_2min_pct,
        "within_5min_pct": within_5min_pct,
        "within_10min_pct": within_10min_pct,
        "max_error": max_error,
        "best_iteration": float(best_iter) if best_iter is not None else 0.0,
    }


def _print_metrics_table(metrics: dict[str, float]) -> None:
    """Print a formatted evaluation metrics table to stdout.

    Args:
        metrics: Dict from _evaluate_model().
    """
    target_met = "✓" if metrics["mae"] < 2.5 else "✗"
    print("\n" + "=" * 50)
    print("  ETA v2 XGBoost — Test Set Evaluation")
    print("=" * 50)
    print(f"  MAE:                    {metrics['mae']:.3f} min  (target < 2.5) {target_met}")
    print(f"  RMSE:                   {metrics['rmse']:.3f} min")
    print(f"  MAPE:                   {metrics['mape']:.1f}%")
    print(f"  Within ±2 min:          {metrics['within_2min_pct']:.1f}%  (target > 60%)")
    print(f"  Within ±5 min:          {metrics['within_5min_pct']:.1f}%  (target > 85%)")
    print(f"  Within ±10 min:         {metrics['within_10min_pct']:.1f}%  (target > 95%)")
    print(f"  Max error:              {metrics['max_error']:.1f} min  (target < 15 min)")
    print("=" * 50)


# ---------------------------------------------------------------------------
# Helper: MLflow logging
# ---------------------------------------------------------------------------


def _log_to_mlflow(
    model: xgb.XGBRegressor,
    params: dict,
    metrics: dict[str, float],
    metadata: dict,
) -> None:
    """Log training run to MLflow.

    Logs:
      - All XGBoost hyperparameters.
      - All evaluation metrics.
      - The model artifact (eta_v2_xgb.pkl) as a versioned MLflow artifact.
      - metadata.json as a secondary artifact.

    Args:
        model:    Trained XGBRegressor.
        params:   XGBoost hyperparameters used.
        metrics:  Evaluation metrics dict.
        metadata: Full metadata dict saved to metadata.json.
    """
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    mlflow.set_experiment(settings.mlflow_experiment_name)

    try:
        with mlflow.start_run(run_name=f"xgb_{datetime.now(tz=timezone.utc).strftime('%Y%m%d_%H%M%S')}"):
            # Log params
            safe_params = {k: v for k, v in params.items() if isinstance(v, (int, float, str, bool))}
            mlflow.log_params(safe_params)

            # Log metrics
            mlflow.log_metric("mae_minutes", metrics["mae"])
            mlflow.log_metric("rmse_minutes", metrics["rmse"])
            mlflow.log_metric("mape_pct", metrics.get("mape", 0.0))
            mlflow.log_metric("within_2min_pct", metrics["within_2min_pct"])
            mlflow.log_metric("within_5min_pct", metrics["within_5min_pct"])
            mlflow.log_metric("within_10min_pct", metrics["within_10min_pct"])
            mlflow.log_metric("max_error_minutes", metrics["max_error"])
            mlflow.log_metric("n_samples", float(metadata["n_samples"]))

            # Log model artifact
            mlflow.xgboost.log_model(model, artifact_path="eta_model")

            # Log metadata file
            if METADATA_PATH.exists():
                mlflow.log_artifact(str(METADATA_PATH), artifact_path="metadata")

            run_id = mlflow.active_run().info.run_id
            _log.info("MLflow run logged: run_id=%s", run_id)

    except Exception as exc:  # pylint: disable=broad-except
        _log.warning("MLflow logging failed (non-fatal): %s", exc)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train the NXTBus ETA XGBoost model.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--days-back",
        type=int,
        default=90,
        help="Number of days of GPS history to use for training.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    asyncio.run(train(days_back=args.days_back))
