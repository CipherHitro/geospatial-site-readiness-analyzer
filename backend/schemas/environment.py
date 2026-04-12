from pydantic import BaseModel
from typing import Any

class EnvironmentRequest(BaseModel):
    lat: float
    lng: float

class EnvironmentScoreResponse(BaseModel):
    lat: float
    lng: float
    h3_index: str | None = None
    flood_score: float
    aqi: int | None = None
    aqi_level: str = "Unknown"
    dominant_pollutant: str | None = None

class EnvironmentGridResponse(BaseModel):
    type: str = "FeatureCollection"
    features: list[Any]
