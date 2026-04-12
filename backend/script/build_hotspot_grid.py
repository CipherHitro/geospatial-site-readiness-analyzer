"""
Run once: python scripts/build_hotspot_grid.py
Re-run if your layer data changes significantly.
Takes ~10-15 minutes for all 5 use cases.
"""

import asyncio
import h3
import json
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db_connection, SessionLocal
from services import (
    demographics_service,
    transport_service,
    poi_service,
    zoning_service,
    environment_service,
)

# Ahmedabad bounding polygon (GeoJSON format)
AHMEDABAD_BOUNDARY = {
    "type": "Polygon",
    "coordinates": [[
        [72.4500, 22.9500],
        [72.7000, 22.9500],
        [72.7000, 23.1800],
        [72.4500, 23.1800],
        [72.4500, 22.9500],
    ]]
}

H3_RESOLUTION = 8   # ~460m hexagons → ~800 hexagons over Ahmedabad

USE_CASES = ["retail", "ev_charging", "warehouse", "telecom", "energy"]

DEFAULT_WEIGHTS = {
    "retail":      {"demographics": 0.30, "transport": 0.20, "poi": 0.25, "zoning": 0.15, "environment": 0.10},
    "ev_charging": {"demographics": 0.20, "transport": 0.35, "poi": 0.15, "zoning": 0.20, "environment": 0.10},
    "warehouse":   {"demographics": 0.10, "transport": 0.35, "poi": 0.10, "zoning": 0.30, "environment": 0.15},
    "telecom":     {"demographics": 0.20, "transport": 0.25, "poi": 0.10, "zoning": 0.25, "environment": 0.20},
    "energy":      {"demographics": 0.10, "transport": 0.20, "poi": 0.10, "zoning": 0.35, "environment": 0.25},
}

def get_score_label(score):
    if score >= 80: return "Excellent"
    elif score >= 65: return "Good"
    elif score >= 50: return "Moderate"
    elif score >= 35: return "Poor"
    else: return "Not Recommended"


async def score_single_hex(lat, lng, use_case, db):
    """Score one hex center point — calls service functions directly, no HTTP."""
    try:
        demo    = demographics_service.get_demographics_score(lat, lng, db, use_case)
        trans   = transport_service.get_transport_score(lat, lng, db, use_case)
        poi     = poi_service.get_poi_score(lat, lng, 1000, use_case, db)
        zoning  = zoning_service.get_zoning_score(lat, lng, db, use_case)
        env     = environment_service.get_environment_score(lat, lng, db, use_case)

        layer_scores = {
            "demographics": demo.get("demographics_score", 0),
            "transport":    trans.get("transport_score", 0),
            "poi":          poi.get("poi_score", 0),
            "zoning":       zoning.get("zoning_score", 0),
            "environment":  env.get("environment_score", 0),
        }

        w = DEFAULT_WEIGHTS[use_case]
        composite = sum(w[k] * layer_scores[k] for k in w)

        if not zoning.get("allows_commercial", True):
            composite = min(composite, 40)

        return {
            "composite": round(composite, 1),
            "layers": layer_scores,
        }

    except Exception as e:
        print(f"    Error scoring ({lat:.4f}, {lng:.4f}): {e}")
        return {"composite": 0, "layers": {k: 0 for k in DEFAULT_WEIGHTS[use_case]}}


async def build_for_use_case(use_case, hexagons, conn):
    print(f"\n  Building {use_case} ({len(hexagons)} hexagons)...")
    
    db = SessionLocal()
    batch = []
    try:
        for i, hex_id in enumerate(hexagons):
            lat, lng = h3.cell_to_latlng(hex_id)
            
            result = await score_single_hex(lat, lng, use_case, db)
            
            # Get hex boundary as WKT polygon for PostGIS
            boundary = h3.cell_to_boundary(hex_id)
            # In h3 v4 cell_to_boundary returns (lat, lng) tuples
            coords = ", ".join(f"{lng} {lat}" for lat, lng in boundary)
            # Close the polygon
            first = boundary[0]
            coords += f", {first[1]} {first[0]}"
            wkt = f"POLYGON(({coords}))"

            batch.append((
                hex_id,
                use_case,
                lat,
                lng,
                result["composite"],
                get_score_label(result["composite"]),
                result["layers"]["demographics"],
                result["layers"]["transport"],
                result["layers"]["poi"],
                result["layers"]["zoning"],
                result["layers"]["environment"],
                wkt,
            ))

            if (i + 1) % 50 == 0:
                print(f"    {i + 1}/{len(hexagons)} done...")

            # Batch insert every 100 rows
            if len(batch) >= 100:
                await insert_batch(conn, batch)
                batch = []

        # Insert remaining
        if batch:
            await insert_batch(conn, batch)

        print(f"  {use_case} complete.")
    finally:
        db.close()


async def insert_batch(conn, batch):
    await conn.executemany("""
        INSERT INTO hotspot_grid 
            (hex_id, use_case, center_lat, center_lng, composite_score, score_label,
             demographics_score, transport_score, poi_score, zoning_score, 
             environment_score, geometry)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, ST_GeomFromText($12, 4326))
        ON CONFLICT (hex_id, use_case) DO UPDATE SET
            composite_score = EXCLUDED.composite_score,
            score_label = EXCLUDED.score_label,
            demographics_score = EXCLUDED.demographics_score,
            transport_score = EXCLUDED.transport_score,
            poi_score = EXCLUDED.poi_score,
            zoning_score = EXCLUDED.zoning_score,
            environment_score = EXCLUDED.environment_score,
            computed_at = NOW()
    """, batch)


async def main():
    print("Starting hotspot grid build...")
    
    # Get all H3 hexagons covering Ahmedabad
    # Using h3 4.0+ API
    exterior = [(lat, lng) for lng, lat in AHMEDABAD_BOUNDARY["coordinates"][0]]
    poly = h3.LatLngPoly(exterior)
    hexagons = list(h3.polygon_to_cells(poly, H3_RESOLUTION))
    print(f"Total hexagons to score: {len(hexagons)}")
    print(f"Use cases: {USE_CASES}")
    print(f"Total scoring operations: {len(hexagons) * len(USE_CASES)}")

    conn = await get_db_connection()

    for use_case in USE_CASES:
        await build_for_use_case(use_case, hexagons, conn)

    await conn.close()
    print("\nHotspot grid build complete.")


if __name__ == "__main__":
    asyncio.run(main())