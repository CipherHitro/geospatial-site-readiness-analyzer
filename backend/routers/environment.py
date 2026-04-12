from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from shapely.geometry import shape
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
    return get_environment_score(req.lat, req.lng, db, use_case=req.use_case)


@router.post("/select-area")
def select_area(polygon: dict, db: Session = Depends(get_db)):
    """
    Accepts a GeoJSON polygon and calculates the H3 hexagons covered by more than 50% of the area.
    """
    # Convert GeoJSON to Shapely geometry
    selected_shape = shape(polygon)

    # Query all H3 hexagons in Ahmedabad
    query = "SELECT h3_index, geometry FROM h3_grid;"
    rows = db.execute(query).fetchall()

    selected_hexagons = []

    for row in rows:
        h3_index = row["h3_index"]
        hex_geometry = shape(row["geometry"])

        # Calculate intersection area
        intersection = selected_shape.intersection(hex_geometry)
        if intersection.area / hex_geometry.area > 0.5:
            selected_hexagons.append(h3_index)

    return {"selected_hexagons": selected_hexagons}
