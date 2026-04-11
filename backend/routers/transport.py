from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas.transport import LocationRequest, TransportResponse
from services.transport_service import get_transport_score

router = APIRouter(prefix="/api/transport", tags=["Transport"])

@router.post("/score", response_model=TransportResponse)
def transport_score(req: LocationRequest, db: Session = Depends(get_db)):
    """
    POST /api/transport/score
    Body: { "lat": 23.12, "lng": 72.54 }
    Returns: full transport score with transport infrastructure (roads, stations, bus stops)
    """
    score_data  = get_transport_score(req.lat, req.lng, db)

    return score_data

