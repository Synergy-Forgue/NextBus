##############################################################################
# NXTBus ETA Prediction Service — Dockerfile
##############################################################################
# Base image: python:3.11-slim (smaller than python:3.11-full, no dev tools)
#
# What's included at runtime:
#   serving/         FastAPI app + predictor + providers + schemas
#   models/          eta_v2_xgb.pkl + metadata.json (copied in at build time)
#   config.py        Settings singleton
#   requirements.txt Used for package installation only, not at runtime
#
# What's NOT included (training, notebooks, tests are not needed at runtime):
#   training/
#   evaluation/
#   notebooks/
#   tests/
#
# Port: 8001
# Health check: GET /health every 30s
##############################################################################

FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Create non-root user for security
RUN groupadd --gid 1001 nxtbus && \
    useradd --uid 1001 --gid 1001 --no-create-home --shell /bin/false nxtbus

# Install system dependencies needed by some Python packages
# (asyncpg needs libssl, geopy doesn't need extra deps)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

##############################################################################
# Build stage — install Python dependencies
##############################################################################
FROM base AS builder

WORKDIR /build

COPY requirements.txt .

# Install into a prefix we can copy cleanly to the final image
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt

##############################################################################
# Final stage — lean runtime image
##############################################################################
FROM base AS runtime

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy only the files needed at runtime
COPY config.py          ./config.py
COPY serving/           ./serving/

# Copy model artifacts if they exist at build time.
# If models/ doesn't exist (e.g. building before training), the COPY is a no-op.
# The predictor handles missing model files gracefully by falling back to v1.
COPY models/            ./models/

# Create models directory in case the COPY above had nothing to copy
RUN mkdir -p ./models

# Switch to non-root user
USER nxtbus

# Expose FastAPI port
EXPOSE 8001

# Health check — GET /health every 30 seconds
# Starts after 10s (service needs time to load model and warm caches)
# Times out after 5s, retried 3 times before marking unhealthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Production entrypoint
# --workers 2   : two Uvicorn processes (matches settings.workers default)
# --host        : bind to all interfaces
# --port        : matches EXPOSE above
# --no-access-log: access logs are verbose; use structured logging in production
CMD ["uvicorn", "serving.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8001", \
     "--workers", "2", \
     "--no-access-log"]
