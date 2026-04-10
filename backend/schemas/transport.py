from pydantic import BaseModel
from typing import Optional, Any

# What the frontend sends
class LocationRequest(BaseModel):
    lat: float
    lng: float

# Sub-score breakdown
class ScoreBreakdown(BaseModel):
    bus_score:     float
    station_score: float
    road_score:    float

# One isochrone ring
class Isochrone(BaseModel):
    minutes:    int
    # population: int
    polygon:    Any   # GeoJSON geometry object

# Full transport layer response
class TransportResponse(BaseModel):
    transport_score:      float
    nearest_bus_stop:     str
    bus_stop_distance_m:  int
    nearest_station:      str
    station_distance_m:   int
    total_road_length_m:  float
    breakdown:            ScoreBreakdown
    isochrones:           list[Isochrone]