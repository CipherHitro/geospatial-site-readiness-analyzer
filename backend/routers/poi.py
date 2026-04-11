from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from schemas.poi import PoiScoreRequest
from services.poi_service import get_poi_score

router = APIRouter(prefix="/api/poi", tags=["POI"])

@router.post("/score")
def calculate_poi_score(request: PoiScoreRequest, db: Session = Depends(get_db)):
    """
    Calculates a viability score based on Points of Interest (POIs) nearby.
    Uses dynamic classification based on the 'use_case' provided.
    Returns the score, summary, and GeoJSON features to render on the map.
    """
    result = get_poi_score(
        lat=request.lat,
        lng=request.lng,
        radius=request.radius,
        use_case=request.use_case,
        db=db
    )
    return result