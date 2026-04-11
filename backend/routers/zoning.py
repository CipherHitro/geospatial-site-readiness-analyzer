# routers/zoning.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from schemas.zoning import ZoningResponse
from schemas.transport import LocationRequest   # reuse same request shape
from services.zoning_service import get_zoning_score

router = APIRouter(prefix="/api/zoning", tags=["Zoning"])

@router.post("/score", response_model=ZoningResponse)
def zoning_score(req: LocationRequest, db: Session = Depends(get_db)):
    return get_zoning_score(req.lat, req.lng, db)