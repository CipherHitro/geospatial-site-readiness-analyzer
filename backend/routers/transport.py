from fastapi import APIRouter, Depends
import logging
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session

from database import get_db
from schemas.transport import LocationRequest, TransportResponse
from services.transport_service import get_transport_score
from services.isochrone_service import get_isochrones

router = APIRouter(prefix="/api/transport", tags=["Transport"])
logger = logging.getLogger(__name__)

@router.post("/score", response_model=TransportResponse)
def transport_score(req: LocationRequest, db: Session = Depends(get_db)):
    """
    POST /api/transport/score
    Body: { "lat": 23.12, "lng": 72.54 }
    Returns: full transport score + isochrones
    """
    with ThreadPoolExecutor(max_workers=1) as executor:
        isochrones_future = executor.submit(get_isochrones, req.lat, req.lng)
        score_data = get_transport_score(req.lat, req.lng, db)

        try:
            isochrones = isochrones_future.result()
        except Exception as exc:
            logger.warning("Isochrone fetch failed for transport score: %s", exc)
            isochrones = []

    return {**score_data, "isochrones": isochrones}

