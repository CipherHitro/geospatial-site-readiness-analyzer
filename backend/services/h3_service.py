# services/h3_service.py
"""
H3 hexagonal grid service — provides spatial lookups against the h3_grid
PostGIS table (443 hex cells covering Ahmedabad at resolution 8).

Functions
---------
get_h3_cell_for_point  — find the H3 cell that contains a given lat/lng
get_all_h3_grid        — return all cells as a GeoJSON FeatureCollection
"""

import json
import logging
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def get_h3_cell_for_point(lat: float, lng: float, db: Session) -> dict | None:
    """
    Find which H3 cell contains the given point.  Returns the full cell
    data including its hex boundary geometry, or None if the point falls
    outside the Ahmedabad H3 grid.
    """
    query = text("""
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
        WHERE ST_Contains(
            geometry,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
        )
        LIMIT 1;
    """)

    row = db.execute(query, {"lat": lat, "lng": lng}).mappings().first()

    if not row:
        return None

    total_age = (
        int(row["child_0_18"] or 0)
        + int(row["youth_19_25"] or 0)
        + int(row["adult_26_45"] or 0)
        + int(row["senior_46_60"] or 0)
        + int(row["senior_citizen_60plus"] or 0)
    )

    def _pct(val):
        return round((int(val or 0) / total_age) * 100, 1) if total_age > 0 else 0.0

    return {
        "h3_index":              row["h3_index"],
        "population":            float(row["population"] or 0),
        "lat":                   float(row["lat"] or 0),
        "lon":                   float(row["lon"] or 0),
        "age_distribution": {
            "child_0_18":            int(row["child_0_18"] or 0),
            "youth_19_25":           int(row["youth_19_25"] or 0),
            "adult_26_45":           int(row["adult_26_45"] or 0),
            "senior_46_60":          int(row["senior_46_60"] or 0),
            "senior_citizen_60plus": int(row["senior_citizen_60plus"] or 0),
        },
        "age_distribution_pct": {
            "child_0_18":            _pct(row["child_0_18"]),
            "youth_19_25":           _pct(row["youth_19_25"]),
            "adult_26_45":           _pct(row["adult_26_45"]),
            "senior_46_60":          _pct(row["senior_46_60"]),
            "senior_citizen_60plus": _pct(row["senior_citizen_60plus"]),
        },
        "est_per_capita_inr":    float(row["est_per_capita_inr"] or 0),
        "geometry":              json.loads(row["geojson"]) if row["geojson"] else None,
    }


def get_all_h3_grid(db: Session) -> dict:
    """
    Return all 443 H3 hexagonal cells as a GeoJSON FeatureCollection.
    Used for the map overlay (toggle ON to show the grid).
    """
    query = text("""
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
        ORDER BY h3_index;
    """)

    rows = db.execute(query).mappings().all()

    features = []
    for row in rows:
        geojson = row["geojson"]
        if not geojson:
            continue

        features.append({
            "type": "Feature",
            "geometry": json.loads(geojson),
            "properties": {
                "h3_index":              row["h3_index"],
                "population":            float(row["population"] or 0),
                "lat":                   float(row["lat"] or 0),
                "lon":                   float(row["lon"] or 0),
                "child_0_18":            int(row["child_0_18"] or 0),
                "youth_19_25":           int(row["youth_19_25"] or 0),
                "adult_26_45":           int(row["adult_26_45"] or 0),
                "senior_46_60":          int(row["senior_46_60"] or 0),
                "senior_citizen_60plus": int(row["senior_citizen_60plus"] or 0),
                "est_per_capita_inr":    float(row["est_per_capita_inr"] or 0),
            },
        })

    logger.info("H3 grid: returning %d hexagonal cells", len(features))

    return {
        "type": "FeatureCollection",
        "features": features,
    }
