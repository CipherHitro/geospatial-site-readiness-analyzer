from pydantic import BaseModel
from typing import Optional, Any


class DemographicsRequest(BaseModel):
    lat: float
    lng: float


class DemographicsBreakdown(BaseModel):
    h3_population: float
    containing_cell_population: float


class PeopleGrouping(BaseModel):
    lower_class: float
    lower_middle_class: float
    middle_class: float
    upper_middle_class: float
    upper_class: float


class IncomeClassThresholds(BaseModel):
    p20: float
    p40: float
    p60: float
    p80: float


class IncomeSamplePoint(BaseModel):
    lat: float
    lng: float
    distance_km: float
    rwi: float
    error: float
    rwi_india_relative: Optional[float] = None


class IncomeBreakdown(BaseModel):
    nearest_sample_distance_km: float
    nearest_sample_error: float
    nearest_sample_rwi: float
    samples_considered: int
    samples_in_neighborhood: int
    neighborhood_radius_km: float
    points_used_count: int
    points_used: list[IncomeSamplePoint]
    dataset_source: str
    class_thresholds: IncomeClassThresholds


class IncomeResponse(BaseModel):
    income_level_score: float
    relative_wealth_index: float
    people_grouping: PeopleGrouping
    breakdown: IncomeBreakdown


class DemographicsResponse(BaseModel):
    demographics_score: float
    population: float
    breakdown: DemographicsBreakdown
    income_level_score: float
    relative_wealth_index: float
    people_grouping: PeopleGrouping
    income_breakdown: IncomeBreakdown
    h3_cell: Optional[Any] = None

