from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas.demographics import DemographicsRequest, DemographicsResponse
from services.demographics_service import get_demographics_score

router = APIRouter(prefix="/api/demographics", tags=["Demographics"])


@router.post("/score", response_model=DemographicsResponse)
def demographics_score(req: DemographicsRequest, db: Session = Depends(get_db)):
    """
    POST /api/demographics/score
    Body: { "lat": 23.12, "lng": 72.54, "use_case": "retail" }
    Returns: demographic score + population breakdown + sub scores
    """
    return get_demographics_score(req.lat, req.lng, db, req.use_case, req.weights)
