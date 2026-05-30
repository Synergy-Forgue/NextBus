"""
training/validate.py — Data Quality Validation
===============================================
Validates extracted GPS data before training begins.  If the data does not
meet quality standards, training is aborted with a clear, actionable error
message.

Failing fast here prevents training on corrupt data and producing a model
that silently makes worse predictions than v1 rule-based.

All validation is on the gps_df DataFrame.  Reference tables (stops,
routes, etc.) are validated for existence/shape only.

Usage:
    from training.validate import validate_training_data, DataValidationError

    try:
        validate_training_data(data)
    except DataValidationError as e:
        sys.exit(1)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import pandas as pd

from config import settings
from training.extract import ExtractedData

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom exception
# ---------------------------------------------------------------------------


class DataValidationError(Exception):
    """Raised when training data fails quality checks.

    Attributes:
        check_name: Which validation check failed.
        detail:     Human-readable description of the failure.
        suggestion: Suggested remediation action.
    """

    def __init__(self, check_name: str, detail: str, suggestion: str = "") -> None:
        self.check_name = check_name
        self.detail = detail
        self.suggestion = suggestion
        super().__init__(
            f"[DataValidationError: {check_name}] {detail}"
            + (f" Suggestion: {suggestion}" if suggestion else "")
        )


# ---------------------------------------------------------------------------
# Validation result
# ---------------------------------------------------------------------------


@dataclass
class ValidationReport:
    """Summary of all validation checks run against the training data.

    Attributes:
        passed:           True if all checks passed.
        n_checks:         Total number of checks performed.
        n_passed:         Number of checks that passed.
        n_failed:         Number of checks that failed (0 if all passed).
        warnings:         Non-fatal issues that were logged but not raised.
        failed_checks:    Names and details of failed checks.
        gps_rows_input:   Total GPS rows before validation.
        gps_rows_clean:   GPS rows remaining after filtering invalid records.
    """

    passed: bool
    n_checks: int
    n_passed: int
    n_failed: int
    warnings: list[str]
    failed_checks: list[dict[str, str]]
    gps_rows_input: int
    gps_rows_clean: int


# ---------------------------------------------------------------------------
# Minimum row threshold
# ---------------------------------------------------------------------------

MINIMUM_LABELLED_ROWS: int = 500   # Absolute minimum to start training
RECOMMENDED_ROWS: int = 5_000      # Below this, a warning is issued


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def validate_training_data(data: ExtractedData) -> ValidationReport:
    """Run all data quality checks on the extracted training data.

    Performs the following checks (in order):

    1. Reference tables non-empty (stops, routes, route_stops, buses)
    2. GPS DataFrame has required columns
    3. No NaN in required GPS columns
    4. speed_kmh within [0, 120] km/h
    5. lat/lng within Visakhapatnam bounding box
    6. recorded_at is timezone-aware and recent
    7. Minimum 500 labelled GPS rows

    Checks 1–6 raise DataValidationError immediately on failure.
    Check 7 raises DataValidationError if the cleaned row count < 500.
    Additional warnings are issued (but not raised) for:
    - GPS row count between 500 and 5000 (model may be underpowered)
    - Unusually high proportion of zero-speed records (bus may be parked a lot)

    Args:
        data: ExtractedData from training/extract.py.

    Returns:
        ValidationReport summarising all check results.

    Raises:
        DataValidationError: On any fatal validation failure.
    """
    _log.info("Data validation started: %d GPS rows input.", len(data.gps_df))

    report = ValidationReport(
        passed=False,
        n_checks=0,
        n_passed=0,
        n_failed=0,
        warnings=[],
        failed_checks=[],
        gps_rows_input=len(data.gps_df),
        gps_rows_clean=0,
    )

    # ------------------------------------------------------------------
    # Check 1: Reference tables are non-empty
    # ------------------------------------------------------------------
    _check_reference_tables(data, report)

    # ------------------------------------------------------------------
    # Check 2: Required GPS columns
    # ------------------------------------------------------------------
    required_gps_cols = {"bus_id", "lat", "lng", "speed_kmh", "recorded_at"}
    _run_check(
        report=report,
        name="required_gps_columns",
        condition=required_gps_cols.issubset(set(data.gps_df.columns)),
        detail=(
            f"gps_df is missing columns: "
            f"{required_gps_cols - set(data.gps_df.columns)}"
        ),
        suggestion=(
            "Check that gps_history table schema matches the expected columns. "
            "Re-run extract.py."
        ),
    )

    # ------------------------------------------------------------------
    # Check 3: No NaN in required GPS columns
    # ------------------------------------------------------------------
    if not data.gps_df.empty:
        nan_counts = data.gps_df[list(required_gps_cols)].isna().sum()
        nan_cols = nan_counts[nan_counts > 0]
        _run_check(
            report=report,
            name="no_nan_in_required_columns",
            condition=len(nan_cols) == 0,
            detail=(
                f"NaN found in required GPS columns: "
                f"{dict(nan_cols)}"
            ),
            suggestion=(
                "Inspect gps_history for NULL values. "
                "Consider adding WHERE ... IS NOT NULL to the extract query, "
                "or investigate the Track B (IoT) GPS writing pipeline."
            ),
        )

    # ------------------------------------------------------------------
    # Check 4: speed_kmh in [0, 120]
    # ------------------------------------------------------------------
    if "speed_kmh" in data.gps_df.columns:
        speeds = data.gps_df["speed_kmh"].dropna()
        n_invalid_speed = ((speeds < 0) | (speeds > 120)).sum()
        invalid_pct = (n_invalid_speed / len(speeds) * 100) if len(speeds) > 0 else 0
        _run_check(
            report=report,
            name="speed_kmh_range",
            condition=n_invalid_speed == 0,
            detail=(
                f"{n_invalid_speed} records ({invalid_pct:.1f}%) have speed_kmh "
                f"outside [0, 120]. Min={speeds.min():.1f}, Max={speeds.max():.1f}."
            ),
            suggestion=(
                "Check GPS firmware for speed reporting errors. "
                "Values > 120 km/h are physically impossible for Visakhapatnam city buses. "
                "Filter these records before training."
            ),
        )

        # Warning: high proportion of zero speeds (bus parked or GPS issues)
        n_zero_speed = (speeds == 0).sum()
        zero_pct = n_zero_speed / len(speeds) * 100 if len(speeds) > 0 else 0
        if zero_pct > 30:
            msg = (
                f"WARNING: {zero_pct:.1f}% of GPS records have speed_kmh=0. "
                "This may indicate the bus was frequently parked or GPS was reporting "
                "stationary fixes. Check if records should be filtered."
            )
            _log.warning(msg)
            report.warnings.append(msg)

    # ------------------------------------------------------------------
    # Check 5: lat/lng within Visakhapatnam bounding box
    # ------------------------------------------------------------------
    bbox = settings.visakhapatnam_bbox
    if "lat" in data.gps_df.columns and "lng" in data.gps_df.columns:
        lats = data.gps_df["lat"].dropna()
        lngs = data.gps_df["lng"].dropna()
        n_invalid_lat = ((lats < bbox["lat_min"]) | (lats > bbox["lat_max"])).sum()
        n_invalid_lng = ((lngs < bbox["lng_min"]) | (lngs > bbox["lng_max"])).sum()
        n_out_of_bbox = max(n_invalid_lat, n_invalid_lng)
        _run_check(
            report=report,
            name="coordinates_in_visakhapatnam_bbox",
            condition=n_out_of_bbox == 0,
            detail=(
                f"{n_out_of_bbox} records have coordinates outside Visakhapatnam "
                f"bounding box (lat [{bbox['lat_min']}, {bbox['lat_max']}], "
                f"lng [{bbox['lng_min']}, {bbox['lng_max']}]). "
                f"Out-of-bbox lat: {n_invalid_lat}, lng: {n_invalid_lng}."
            ),
            suggestion=(
                "GPS fixes outside Visakhapatnam are likely sensor errors or "
                "default coordinates (0,0). Filter them from gps_history or "
                "investigate the IoT firmware."
            ),
        )

    # ------------------------------------------------------------------
    # Check 6: recorded_at is recent (within days_back + 1 day)
    # ------------------------------------------------------------------
    if "recorded_at" in data.gps_df.columns:
        timestamps = pd.to_datetime(data.gps_df["recorded_at"], utc=True)
        # All records should be after date_from
        n_before_window = (timestamps < pd.Timestamp(data.date_from)).sum()
        _run_check(
            report=report,
            name="timestamps_within_window",
            condition=n_before_window == 0,
            detail=(
                f"{n_before_window} GPS records are timestamped before the extraction "
                f"window start ({data.date_from.strftime('%Y-%m-%d')}). "
                "This should not happen with the current SQL query."
            ),
            suggestion=(
                "Check for timezone issues in PostgreSQL (recorded_at should be TIMESTAMPTZ). "
                "Ensure the DB server clock is accurate."
            ),
        )

    # ------------------------------------------------------------------
    # Check 7: Minimum row count
    # ------------------------------------------------------------------
    # Count clean rows (after filtering for NaN speed and valid bbox)
    clean_mask = _build_clean_mask(data.gps_df, bbox)
    n_clean = int(clean_mask.sum())
    report.gps_rows_clean = n_clean

    _run_check(
        report=report,
        name=f"minimum_{MINIMUM_LABELLED_ROWS}_clean_rows",
        condition=n_clean >= MINIMUM_LABELLED_ROWS,
        detail=(
            f"Only {n_clean} clean GPS rows after validation. "
            f"Minimum required: {MINIMUM_LABELLED_ROWS}."
        ),
        suggestion=(
            f"Collect more GPS data (current: {n_clean} rows, need {MINIMUM_LABELLED_ROWS}). "
            "If using the v2 XGBoost model on Day 1 without historical data, "
            "this is expected — use v1 rule-based predictor until data is available. "
            "The threshold for v2 activation is 5000 rows over 14 days."
        ),
    )

    # Warning: low row count (between min and recommended)
    if MINIMUM_LABELLED_ROWS <= n_clean < RECOMMENDED_ROWS:
        msg = (
            f"WARNING: Only {n_clean} clean GPS rows available "
            f"(recommended: {RECOMMENDED_ROWS}+). "
            "The model may generalise poorly with limited data. "
            "Continue collecting GPS history for better results."
        )
        _log.warning(msg)
        report.warnings.append(msg)

    # ------------------------------------------------------------------
    # Finalise report
    # ------------------------------------------------------------------
    report.passed = report.n_failed == 0
    _log.info(
        "Data validation complete: %d/%d checks passed. Clean rows: %d. "
        "Warnings: %d. PASSED=%s",
        report.n_passed,
        report.n_checks,
        n_clean,
        len(report.warnings),
        report.passed,
    )
    return report


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _check_reference_tables(data: ExtractedData, report: ValidationReport) -> None:
    """Validate that all reference tables are non-empty.

    Args:
        data:   ExtractedData to check.
        report: ValidationReport to update in-place.
    """
    tables = {
        "stops": data.stops_df,
        "routes": data.routes_df,
        "route_stops": data.route_stops_df,
        "buses": data.buses_df,
    }
    for name, df in tables.items():
        _run_check(
            report=report,
            name=f"{name}_not_empty",
            condition=not df.empty,
            detail=f"Reference table '{name}' is empty.",
            suggestion=(
                f"Ensure the '{name}' table in PostgreSQL has been populated by Track B "
                "before running training."
            ),
        )


def _run_check(
    report: ValidationReport,
    name: str,
    condition: bool,
    detail: str,
    suggestion: str = "",
) -> None:
    """Run a single validation check and update the report.

    If the condition is False, raises DataValidationError immediately.

    Args:
        report:     ValidationReport to update.
        name:       Short identifier for this check.
        condition:  True if check passes.
        detail:     Description of the failure (used only if condition=False).
        suggestion: Remediation hint.

    Raises:
        DataValidationError: If condition is False.
    """
    report.n_checks += 1
    if condition:
        report.n_passed += 1
        _log.debug("Check PASSED: %s", name)
    else:
        report.n_failed += 1
        report.failed_checks.append({"check": name, "detail": detail})
        _log.error("Check FAILED: %s — %s", name, detail)
        raise DataValidationError(name, detail, suggestion)


def _build_clean_mask(gps_df: pd.DataFrame, bbox: dict[str, float]) -> "pd.Series[bool]":
    """Build a boolean mask for valid (clean) GPS rows.

    A row is clean if:
      - speed_kmh is not NaN and is in [0, 120]
      - lat and lng are not NaN and within the Visakhapatnam bounding box

    Args:
        gps_df: GPS history DataFrame.
        bbox:   Bounding box dict with lat_min, lat_max, lng_min, lng_max.

    Returns:
        Boolean Series with True for clean rows.
    """
    if gps_df.empty:
        return pd.Series(dtype=bool)

    mask = pd.Series([True] * len(gps_df), index=gps_df.index)

    if "speed_kmh" in gps_df.columns:
        mask &= gps_df["speed_kmh"].notna()
        mask &= (gps_df["speed_kmh"] >= 0) & (gps_df["speed_kmh"] <= 120)

    if "lat" in gps_df.columns:
        mask &= gps_df["lat"].notna()
        mask &= (gps_df["lat"] >= bbox["lat_min"]) & (gps_df["lat"] <= bbox["lat_max"])

    if "lng" in gps_df.columns:
        mask &= gps_df["lng"].notna()
        mask &= (gps_df["lng"] >= bbox["lng_min"]) & (gps_df["lng"] <= bbox["lng_max"])

    return mask
