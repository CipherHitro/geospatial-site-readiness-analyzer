import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
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
    Returns indices plus full cell rows and a GeoJSON FeatureCollection for the map.
    """
    selected_shape = shape(polygon)

    query = text("""
        SELECT h3_index, ST_AsGeoJSON(geometry) AS geojson
        FROM h3_grid;
    """)
    rows = db.execute(query).mappings().all()

    selected_hexagons = []

    for row in rows:
        h3_index = row["h3_index"]
        raw = row["geojson"]
        if not raw:
            continue
        hex_geometry = shape(json.loads(raw) if isinstance(raw, str) else raw)

        intersection = selected_shape.intersection(hex_geometry)
        if intersection.area / hex_geometry.area > 0.5:
            selected_hexagons.append(h3_index)

    if not selected_hexagons:
        return {
            "count": 0,
            "selected_hexagons": [],
            "selected_cells": [],
            "hexagons_geojson": {"type": "FeatureCollection", "features": []},
        }

    escaped = "', '".join(h.replace("'", "''") for h in selected_hexagons)
    detail_query = text(f"""
        SELECT
            h3_index,
            population,
            lat,
            lon,
            child_0_18,
            youth_19_25,
            adult_26_45,
            senior_46_60,
            senior_citizen_60plus,
            est_per_capita_inr,
            ST_AsGeoJSON(geometry) AS geojson
        FROM h3_grid
        WHERE h3_index IN ('{escaped}')
    """)
    detail_rows = db.execute(detail_query).mappings().all()

    selected_cells = []
    features = []
    for row in detail_rows:
        rgj = row["geojson"]
        gj = json.loads(rgj) if isinstance(rgj, str) and rgj else (rgj if isinstance(rgj, dict) else None)
        selected_cells.append(
            {
                "h3_index": row["h3_index"],
                "population": float(row["population"] or 0),
                "lat": float(row["lat"] or 0),
                "lon": float(row["lon"] or 0),
                "child_0_18": int(row["child_0_18"] or 0),
                "youth_19_25": int(row["youth_19_25"] or 0),
                "adult_26_45": int(row["adult_26_45"] or 0),
                "senior_46_60": int(row["senior_46_60"] or 0),
                "senior_citizen_60plus": int(row["senior_citizen_60plus"] or 0),
                "est_per_capita_inr": float(row["est_per_capita_inr"] or 0),
            }
        )
        if gj:
            features.append(
                {
                    "type": "Feature",
                    "geometry": gj,
                    "properties": {"h3_index": row["h3_index"]},
                }
            )

    return {
        "count": len(selected_hexagons),
        "selected_hexagons": selected_hexagons,
        "selected_cells": selected_cells,
        "hexagons_geojson": {"type": "FeatureCollection", "features": features},
    }
