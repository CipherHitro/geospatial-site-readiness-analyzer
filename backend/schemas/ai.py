from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class SiteScore(BaseModel):
    overall: float
    demographics: float
    transportation: float
    competition: float
    landuse: float
    risk: float

class SiteData(BaseModel):
    id: str
    name: str # user provided or auto-generated name
    lat: float
    lng: float
    scores: SiteScore
    layer_data: Dict[str, Any] # Contains demographics, risk, environment stuff

class CompareSitesRequest(BaseModel):
    use_case: str # e.g. "retail", "ev_charging"
    sites: List[SiteData]
    user_need: Optional[str] = None # Added for user's specific context

class CompareSitesResponse(BaseModel):
    analysis: str
    recommended_site_id: str
