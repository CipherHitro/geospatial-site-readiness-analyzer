from pydantic import BaseModel
from typing import Dict, Any, Optional

class LayerWeights(BaseModel):
    demographics: float
    transport: float
    poi: float
    zoning: float
    environment: float

class SiteScoreRequest(BaseModel):
    lat: float
    lng: float
    use_case: str = "retail"
    weights: Optional[LayerWeights] = None

class LayerScores(BaseModel):
    demographics: float
    transport: float
    poi: float
    zoning: float
    environment: float

class SiteScoreResponse(BaseModel):
    composite_score: float
    score_label: str
    use_case: str
    lat: float
    lng: float
    layer_scores: LayerScores
    layer_details: Dict[str, Any]
    weights_used: LayerWeights
    ai_insight: str
    hard_cap_applied: bool
    warnings: list[str] = []
    response_time_ms: float
