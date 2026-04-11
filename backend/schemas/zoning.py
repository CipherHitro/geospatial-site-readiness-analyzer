# schemas/zoning.py
from pydantic import BaseModel
from typing import Dict, Any

class ZoningBreakdown(BaseModel):
    zone_score:     float
    building_score: float

class BuildingDistribution(BaseModel):
    count: int
    percentage: float
    area_sqm: float

class ZoningResponse(BaseModel):
    zoning_score:               float
    zone_type:                  str
    allows_commercial:          bool
    building_count_500m:        int
    total_built_area_sqm:       float
    zone_distribution_500m_pct: Dict[str, float]
    building_distribution_500m: Dict[str, BuildingDistribution]
    breakdown:                  ZoningBreakdown
    buildings_geojson:          Any = None
    zones_geojson:              Any = None