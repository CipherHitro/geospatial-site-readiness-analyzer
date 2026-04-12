from pydantic import BaseModel
from typing import Any

class EnvironmentRequest(BaseModel):
    lat: float
    lng: float
    use_case: str = "retail"

class EnvironmentBreakdown(BaseModel):
    flood_safety_score: float
    aqi_score: float
    earthquake_score: float

class EnvironmentScoreResponse(BaseModel):
    lat: float
    lng: float
    h3_index: str | None = None
    
    environment_score: float
    flood_safety_score: float
    aqi_score: float
    earthquake_score: float
    flood_score_raw: float
    
    aqi: int | None = None
    aqi_level: str = "Unknown"
    dominant_pollutant: str | None = None

    breakdown: EnvironmentBreakdown
    weights_used: dict[str, float] = {}
    use_case: str

class EnvironmentGridResponse(BaseModel):
    type: str = "FeatureCollection"
    features: list[Any]
