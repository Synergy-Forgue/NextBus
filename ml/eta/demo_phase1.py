import asyncio
import json
from datetime import timezone
from unittest.mock import MagicMock
from serving.predictor import ETAPredictor, RouteStop, StopInfo
from serving.providers import SimulatedProvider
from serving.schemas import ETARequest

async def main():
    print("Initializing Phase 1 ETA Predictor (Rule-Based Fallback Mode)...")
    
    # Mock database and Redis connections since we are running isolated
    mock_engine = MagicMock()
    mock_redis = MagicMock()
    provider = SimulatedProvider()

    predictor = ETAPredictor(engine=mock_engine, redis=mock_redis, provider=provider)

    # Inject mock data into caches (bypassing the need for a live PostgreSQL database)
    predictor._bus_route_cache = {"BUS_28K_001": "28K"}
    predictor._bus_capacity_cache = {"BUS_28K_001": 50}
    predictor._stops_cache = {
        "rly_station": StopInfo("rly_station", "Railway Station", 17.7068, 83.2040),
        "gajuwaka": StopInfo("gajuwaka", "Gajuwaka", 17.6804, 83.2036),
    }
    predictor._route_stops_cache = {
        "28K": [
            RouteStop("gajuwaka", 0, 17.6804, 83.2036),
            RouteStop("rly_station", 1, 17.7068, 83.2040),
        ]
    }
    
    # Force the predictor into Phase 1 mode
    predictor._model_loaded = False
    predictor._model_version = "v1_rule_based"

    # Mock the rolling speed fetch to return 25.0 km/h
    async def mock_get_rolling_avg_speed(bus_id: str) -> float:
        return 25.0
    predictor._get_rolling_avg_speed = mock_get_rolling_avg_speed

    print("Submitting ETA Request for BUS_28K_001 to rly_station...\n")
    request = ETARequest(bus_id="BUS_28K_001", target_stop_id="rly_station")
    
    # Compute ETA
    response = await predictor.predict(request)
    
    print("--- Phase 1 ETA Response ---")
    output = response.model_dump()
    output["computed_at"] = output["computed_at"].isoformat()
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
