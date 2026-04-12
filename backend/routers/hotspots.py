from fastapi import APIRouter, Query
from database import get_db_connection
import json

router = APIRouter()


@router.get("/api/hotspots")
async def get_hotspots(
    use_case: str = Query(default="retail"),
    min_score: float = Query(default=0),
    limit: int = Query(default=2000),
):
    """
    Returns full H3 hexagon GeoJSON for Leaflet heatmap.
    Called once on map load per use case.
    """
    conn = await get_db_connection()

    rows = await conn.fetch("""
        SELECT 
            hex_id, center_lat, center_lng,
            composite_score, score_label,
            demographics_score, transport_score,
            poi_score, zoning_score, environment_score,
            ST_AsGeoJSON(geometry) as geojson
        FROM hotspot_grid
        WHERE use_case = $1 AND composite_score >= $2
        ORDER BY composite_score DESC
        LIMIT $3
    """, use_case, min_score, limit)

    await conn.close()

    features = []
    for row in rows:
        features.append({
            "type": "Feature",
            "geometry": json.loads(row["geojson"]),
            "properties": {
                "hex_id": row["hex_id"],
                "composite_score": row["composite_score"],
                "score_label": row["score_label"],
                "demographics_score": row["demographics_score"],
                "transport_score": row["transport_score"],
                "poi_score": row["poi_score"],
                "zoning_score": row["zoning_score"],
                "environment_score": row["environment_score"],
                "color": score_to_color(row["composite_score"]),
                "fillOpacity": score_to_opacity(row["composite_score"]),
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {
            "use_case": use_case,
            "total_hexagons": len(features),
        }
    }


@router.get("/api/hotspots/top")
async def get_top_hotspots(
    use_case: str = Query(default="retail"),
    n: int = Query(default=10),
):
    """Returns top N scoring hexagons — used for 'Best Areas' panel."""
    conn = await get_db_connection()

    rows = await conn.fetch("""
        SELECT hex_id, center_lat, center_lng,
               composite_score, score_label,
               demographics_score, transport_score,
               poi_score, zoning_score, environment_score
        FROM hotspot_grid
        WHERE use_case = $1
        ORDER BY composite_score DESC
        LIMIT $2
    """, use_case, n)

    await conn.close()

    return {
        "use_case": use_case,
        "top_sites": [dict(row) for row in rows]
    }


def score_to_color(score: float) -> str:
    if score >= 80: return "#22c55e"    # green
    elif score >= 65: return "#84cc16"  # lime
    elif score >= 50: return "#eab308"  # yellow
    elif score >= 35: return "#f97316"  # orange
    else: return "#ef4444"              # red


def score_to_opacity(score: float) -> float:
    # Higher score = more opaque = more visible
    return round(0.3 + (score / 100) * 0.5, 2)