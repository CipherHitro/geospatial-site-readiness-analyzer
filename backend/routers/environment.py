from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from schemas.environment import EnvironmentRequest, EnvironmentScoreResponse, EnvironmentGridResponse
from services.environment_service import get_environment_score, get_environment_grid

router = APIRouter(prefix="/api/environment", tags=["Environmental Risk"])

@router.get("/grid", response_model=EnvironmentGridResponse)
def environment_grid(db: Session = Depends(get_db)):
    """
    GET /api/environment/grid
    Returns the H3 cells enriched with flood_score for visualization.
    """
    return get_environment_grid(db)


@router.post("/score", response_model=EnvironmentScoreResponse)
def environment_score(req: EnvironmentRequest, db: Session = Depends(get_db)):
    """
    POST /api/environment/score
    Body: { "lat": 23.0225, "lng": 72.5714 }
    Combines local flood risk metrics and live WAQI AQI metrics.
    """
    return get_environment_score(req.lat, req.lng, db)
