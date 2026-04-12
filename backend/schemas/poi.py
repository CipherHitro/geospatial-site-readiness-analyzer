from pydantic import BaseModel
from typing import Optional, Literal

class PoiScoreRequest(BaseModel):
    lat: float
    lng: float
    radius: Optional[float] = 1500.0  # Search radius in meters
    use_case: Optional[str] = "retail"  # retail | ev_charging | warehouse | telecom | renewable_energy
