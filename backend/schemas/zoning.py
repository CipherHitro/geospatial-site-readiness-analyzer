# schemas/zoning.py
from pydantic import BaseModel

class ZoningBreakdown(BaseModel):
    zone_score:     float
    building_score: float

class ZoningResponse(BaseModel):
    zoning_score:         float
    zone_type:            str
    allows_commercial:    bool
    building_count_500m:  int
    total_built_area_sqm: float
    breakdown:            ZoningBreakdown