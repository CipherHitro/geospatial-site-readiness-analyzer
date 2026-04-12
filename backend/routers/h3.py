# routers/h3.py
"""
H3 Hexagonal Grid API
---------------------
GET  /api/h3/grid  — all 443 H3 cells as GeoJSON (for the map overlay)
POST /api/h3/cell  — resolve a lat/lng to its containing H3 cell
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from schemas.h3 import H3CellRequest, H3CellResponse, H3GridResponse
from services.h3_service import get_h3_cell_for_point, get_all_h3_grid

router = APIRouter(prefix="/api/h3", tags=["H3 Grid"])

@router.get("/grid", response_model=H3GridResponse)
def h3_grid(db: Session = Depends(get_db)):
    """
    GET /api/h3/grid
    Returns all H3 hexagonal cells as a GeoJSON FeatureCollection.
    Used by the frontend to render the hex grid overlay on the map.
    """
    return get_all_h3_grid(db)


@router.post("/cell", response_model=H3CellResponse)
def h3_cell(req: H3CellRequest, db: Session = Depends(get_db)):
    """
    POST /api/h3/cell
    Body: { "lat": 23.0225, "lng": 72.5714 }
    Returns the H3 cell containing the given point with full demographics.
    """
    cell = get_h3_cell_for_point(req.lat, req.lng, db)
    if cell is None:
        raise HTTPException(
            status_code=404,
            detail="No H3 cell found for this location. The point may be outside Ahmedabad city coverage."
        )
    return cell
