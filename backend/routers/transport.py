from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor
import logging

from database import get_db
from schemas.transport import LocationRequest, TransportResponse
from services.transport_service import get_transport_score
from services.isochrone_service import get_isochrones

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/transport", tags=["Transport"])

@router.post("/score", response_model=TransportResponse)
def transport_score(req: LocationRequest, db: Session = Depends(get_db)):
    """
    POST /api/transport/score
    Body: { "lat": 23.12, "lng": 72.54 }
    Returns: full transport score with transport infrastructure (roads, stations, bus stops)
    """
    with ThreadPoolExecutor(max_workers=1) as executor:
        # submit isochrone to a background thread
        isochrone_future = executor.submit(get_isochrones, req.lat, req.lng)
        
        # run DB score synchronously here so SQLAlchemy session is safe
        score_data = get_transport_score(req.lat, req.lng, db)
        
        try:
            # wait up to 10 seconds for isochrone thread (with 5s requests timeout it should return earlier)
            isochrones = isochrone_future.result(timeout=10)
        except Exception as exc:
            logger.warning(f"Isochrone fetch failed in executor: {exc}")
            isochrones = []

    return {**score_data, "isochrones": isochrones}

