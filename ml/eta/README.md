# NXTBus ETA Prediction Service — Track D (ML)

Real-time bus arrival time prediction for Visakhapatnam, Andhra Pradesh, India.

## Architecture Overview

```
Track B (NestJS) ──POST /eta──▶ FastAPI (this service) ──▶ ETAPredictor
                                                                │
                     ┌──────────────────────────────────────────┤
                     │                                          │
                 LocationProvider                         XGBoost v2
                 (Redis GPS data)                      (or v1 rule-based)
                     │
                 PostgreSQL
                 (gps_history, stops, routes)
```

**Track D (ML) owns everything in `nxtbus/ml/eta/`.** It does not touch the NestJS backend, mobile app, or IoT firmware.

---

## Two-Phase ETA System

| Phase | Predictor | Active When | MAE |
|-------|-----------|-------------|-----|
| v1 | Rule-based haversine + dwell formula | Day 1 — always available | ~4–8 min |
| v2 | XGBoost trained on GPS history | After 14 days, ≥5000 GPS rows | Target < 2.5 min |

The predictor auto-selects on startup. Track B never changes its API call.

---

## Quick Start — Serving

```bash
# 1. Clone and enter the ML directory
cd nxtbus/ml/eta

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and REDIS_URL

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the service (starts in v1 mode if no model.pkl exists)
uvicorn serving.main:app --host 0.0.0.0 --port 8001 --reload

# 5. Test it
curl -X POST http://localhost:8001/eta \
  -H "Content-Type: application/json" \
  -d '{"bus_id": "BUS_28K_001", "target_stop_id": "rly_station"}'

# Health check
curl http://localhost:8001/health
```

---

## Training

### Prerequisites
- At least 2–3 weeks of GPS history in the `gps_history` table
- At least 5000 rows in the last 14 days (v2 activation threshold)

### Run Training (Local)

```bash
# Basic (last 90 days)
python -m training.train

# Custom window
python -m training.train --days-back 60
```

Training output:
- `models/eta_v2_xgb.pkl` — serialised XGBoost model
- `models/metadata.json` — MAE, RMSE, features, trained_at
- MLflow run logged to `./mlruns/`

### Train on Google Colab

Open `notebooks/03_training_colab.ipynb` in Google Colab.
Fill in your database credentials in Cell 3 and run all cells top-to-bottom.
The model is saved to Google Drive and can be downloaded at the end.

---

## Hyperparameter Tuning (Optional)

```bash
# 50 trials — takes 30–60 minutes
python -m training.tune

# Results saved to models/best_params.json
# Next train.py run will use these automatically
```

---

## Evaluation

```bash
# Full metrics + SHAP feature importance plot
python -m evaluation.evaluate

# v1 rule-based vs v2 XGBoost comparison
python -m evaluation.compare
```

Evaluation targets:

| Metric | Target |
|--------|--------|
| MAE | < 2.5 min |
| Within ±2 min | > 60% |
| Within ±5 min | > 85% |
| Within ±10 min | > 95% |
| Max error | < 15 min |

SHAP feature importance plot saved to `models/feature_importance.png`.

---

## Testing

```bash
# All tests (no DB or Redis required)
pytest tests/ -v

# Specific test files
pytest tests/test_features.py -v
pytest tests/test_predictor.py -v
pytest tests/test_api.py -v
```

---

## Docker

```bash
# Build
docker build -t nxtbus-eta:latest .

# Run
docker run -p 8001:8001 \
  -e DATABASE_URL=postgresql+asyncpg://... \
  -e REDIS_URL=redis://... \
  -e LOCATION_PROVIDER=phone_gps \
  nxtbus-eta:latest

# With pre-trained model
docker run -p 8001:8001 \
  -v $(pwd)/models:/app/models:ro \
  -e DATABASE_URL=... \
  -e REDIS_URL=... \
  nxtbus-eta:latest
```

---

## API Reference

### `POST /eta`

Request:
```json
{
  "bus_id": "BUS_28K_001",
  "target_stop_id": "rly_station"
}
```

Response:
```json
{
  "bus_id": "BUS_28K_001",
  "target_stop_id": "rly_station",
  "eta_minutes": 7.3,
  "confidence": 0.87,
  "model_version": "v2_xgb",
  "computed_at": "2025-01-24T08:32:11Z"
}
```

### `GET /health`

```json
{
  "status": "ok",
  "model_loaded": true,
  "model_version": "v2_xgb"
}
```

> `status: "degraded"` means v1 rule-based fallback is active (no model loaded). This is expected on Day 1.

### `GET /model/info`

```json
{
  "version": "v2_xgb",
  "mae_minutes": 2.1,
  "rmse_minutes": 3.4,
  "trained_at": "2025-01-20T14:00:00Z",
  "n_samples": 12000,
  "features": ["distance_to_stop_km", "current_speed_kmh", "..."]
}
```

---

## File Structure

```
nxtbus/ml/eta/
│
├── serving/
│   ├── main.py           FastAPI app (lifespan, routes, error handlers)
│   ├── predictor.py      v1/v2 orchestrator + feature assembly
│   ├── schemas.py        Pydantic: ETARequest, ETAResponse, HealthResponse
│   └── providers.py      LocationProvider ABC + Phone/Hardware/Simulated
│
├── training/
│   ├── extract.py        Async PostgreSQL → DataFrames
│   ├── features.py       17 features, all documented + extract_stop_arrivals()
│   ├── validate.py       7 data quality checks, raises DataValidationError
│   ├── train.py          10-step XGBoost training pipeline
│   └── tune.py           Optuna 50-trial hyperparameter search
│
├── evaluation/
│   ├── evaluate.py       Metrics + SHAP feature importance plot
│   └── compare.py        v1 vs v2 side-by-side comparison
│
├── notebooks/
│   ├── 01_data_exploration.ipynb
│   ├── 02_feature_engineering.ipynb
│   └── 03_training_colab.ipynb   ← Self-contained, runs top-to-bottom
│
├── tests/
│   ├── test_features.py   TDD: every feature function
│   ├── test_predictor.py  v1 formula + v2 fallback
│   └── test_api.py        FastAPI TestClient: /eta, /health, /model/info
│
├── models/               gitignored — populated by train.py
│   ├── eta_v2_xgb.pkl
│   ├── metadata.json
│   └── feature_importance.png
│
├── config.py             Pydantic-settings (reads .env)
├── requirements.txt
├── Dockerfile
├── .env.example
└── README.md
```

---

## Configuration Reference

All settings read from environment variables / `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | Async PostgreSQL DSN |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |
| `LOCATION_PROVIDER` | `phone_gps` | `phone_gps` / `hardware_gps` / `simulated` |
| `MODEL_PATH` | `./models/eta_v2_xgb.pkl` | Path to XGBoost model |
| `LOG_LEVEL` | `INFO` | Python logging level |
| `PORT` | `8001` | FastAPI listen port |
| `WORKERS` | `2` | Uvicorn workers |
| `DWELL_TIME_PER_STOP_MINUTES` | `0.75` | v1 dwell constant |
| `SPEED_FLOOR_KMH` | `15.0` | Minimum speed for ETA calc |
| `V2_ACTIVATION_THRESHOLD` | `5000` | GPS rows needed for v2 |

---

## LocationProvider Swap (Phone GPS → Hardware GPS)

When Teltonika FMB920 hardware GPS units are installed on buses:

```bash
# Change one environment variable — no code changes required
LOCATION_PROVIDER=hardware_gps
```

The `HardwareGPSProvider` reads from the same Redis key format as the phone GPS provider. The only observable difference is the `source="hardware_gps"` tag on the `LocationReading` object.

---

## Database Schema (Read-Only)

Track B owns and writes these tables. Track D reads them.

```sql
gps_history: id, bus_id, lat, lng, speed_kmh, heading, occupancy, recorded_at
routes:       id (route_id), waypoints (JSONB)
stops:        id, name, lat, lng, route_ids
route_stops:  route_id, stop_id, stop_order
buses:        id, route_id, capacity
```

Redis key (maintained by Track B):
```
bus:{bus_id}:state  →  JSON, TTL 30s
{"lat":17.7211,"lng":83.3089,"speed_kmh":28.4,"heading":182,
 "occupancy_count":34,"updated_at":1706123456789}
```

---

## Latency Budget

Target: p95 < 50ms for `POST /eta`

| Operation | Typical latency |
|-----------|----------------|
| Redis GET (bus state) | ~1ms |
| PostgreSQL (rolling speed) | ~5ms |
| PostgreSQL (congestion lookup) | ~3ms |
| XGBoost inference (17 features) | ~2ms |
| FastAPI overhead | ~3ms |
| **Total** | **~14ms** |

Remaining headroom before 50ms target: ~36ms.
