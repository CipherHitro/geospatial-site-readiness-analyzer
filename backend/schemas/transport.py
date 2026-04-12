from pydantic import BaseModel
from typing import Optional, Any

# What the frontend sends
class LocationRequest(BaseModel):
    lat: float
    lng: float
    use_case: str = "retail"

# Sub-score breakdown
class ScoreBreakdown(BaseModel):
    bus_score:     float
    station_score: float
    road_score:    float

# One isochrone ring
class Isochrone(BaseModel):
    minutes:    int
    polygon:    Any   # GeoJSON geometry object

class RoadDetails(BaseModel):
    highway: str
    length_m: float
    geometry: Any # GeoJSON LineString

class BusStopDetails(BaseModel):
    name: str
    dist_m: int
    geometry: Any # GeoJSON Point

class StationDetails(BaseModel):
    name: str
    dist_m: int
    geometry: Any # GeoJSON Point

# Full transport layer response
class TransportResponse(BaseModel):
    transport_score:      float
    nearest_bus_stop:     str
    bus_stop_distance_m:  int
    nearest_station:      str
    station_distance_m:   int
    total_road_length_m:  float
    breakdown:            ScoreBreakdown
    weights_used:         dict[str, float] = {}
    roads_nearby:         list[RoadDetails]
    bus_stops_nearby:     list[BusStopDetails]
    stations_nearby:      list[StationDetails]
    isochrones:           list[Isochrone] = []