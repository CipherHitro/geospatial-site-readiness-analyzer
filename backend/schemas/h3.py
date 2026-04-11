# schemas/h3.py
from pydantic import BaseModel
from typing import Any, Optional, Dict


class H3CellRequest(BaseModel):
    lat: float
    lng: float


class AgeDistribution(BaseModel):
    child_0_18: int
    youth_19_25: int
    adult_26_45: int
    senior_46_60: int
    senior_citizen_60plus: int


class AgeDistributionPct(BaseModel):
    child_0_18: float
    youth_19_25: float
    adult_26_45: float
    senior_46_60: float
    senior_citizen_60plus: float


class H3CellResponse(BaseModel):
    h3_index: str
    population: float
    lat: float
    lon: float
    age_distribution: AgeDistribution
    age_distribution_pct: AgeDistributionPct
    est_per_capita_inr: float
    flood_score: float
    geometry: Any = None


class H3GridResponse(BaseModel):
    type: str = "FeatureCollection"
    features: list[Any]
