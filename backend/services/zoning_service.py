# services/zoning_service.py
import pandas as pd
from sqlalchemy.orm import Session

def get_zoning_score(lat: float, lng: float, db: Session) -> dict:
    engine = db.get_bind()

    # ── QUERY 1: What zone is this point inside? ──────────────────
    # ST_Within checks if the point falls inside a zone polygon
    # If point is not inside any zone (open land etc), returns nothing
    zone_query = f"""
        SELECT zone_type, allows_commercial
        FROM zones
        WHERE ST_Within(
            ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326),
            geometry
        )
        LIMIT 1;
    """
    zone_result = pd.read_sql(zone_query, engine)

    if zone_result.empty:
        # Point not inside any mapped zone — treat as unknown/other
        zone_type = "unknown"
        allows_commercial = False
    else:
        zone_type = zone_result.iloc[0]["zone_type"]
        allows_commercial = bool(zone_result.iloc[0]["allows_commercial"])

    # ── QUERY 2: Building density within 500m ────────────────────
    # Get total count, area, and breakdown by building_type
    building_query = f"""
        WITH h3 AS (
            SELECT geometry as geom 
            FROM h3_grid 
            WHERE ST_Contains(geometry, ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326))
            LIMIT 1
        )
        SELECT
            b.building_type,
            COUNT(*) AS count,
            COALESCE(SUM(b.area_sqm), 0) AS total_area_sqm
        FROM buildings b, h3
        WHERE ST_Intersects(b.geometry, h3.geom)
        GROUP BY b.building_type;
    """
    building_df = pd.read_sql(building_query, engine)
    
    building_count = int(building_df["count"].sum()) if not building_df.empty else 0
    total_built_area = float(building_df["total_area_sqm"].sum()) if not building_df.empty else 0.0

    building_distribution = {}
    if building_count > 0:
        for _, row in building_df.iterrows():
            b_type = row['building_type']
            pct = (row['count'] / building_count) * 100
            building_distribution[b_type] = {
                "count": int(row['count']),
                "percentage": round(pct, 1),
                "area_sqm": round(float(row['total_area_sqm']), 1)
            }

    # ── QUERY 3: Surrounding Zone Distribution (500m) ────────────────
    # We buffer point by 500m in meters CRS (32643) then intersect with zones
    zone_dist_query = f"""
        WITH h3 AS (
            SELECT geometry as geom 
            FROM h3_grid 
            WHERE ST_Contains(geometry, ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326))
            LIMIT 1
        )
        SELECT 
            z.zone_type,
            ST_Area(ST_Intersection(z.geometry, h3.geom)::geography) as overlap_area_sqm,
            ST_AsGeoJSON(ST_Intersection(z.geometry, h3.geom)) as geojson
        FROM zones z, h3
        WHERE ST_Intersects(z.geometry, h3.geom)
    """
    zone_dist_df = pd.read_sql(zone_dist_query, engine)
    
    total_intersect_area = zone_dist_df["overlap_area_sqm"].sum() if not zone_dist_df.empty else 0
    zone_distribution_500m = {}
    zones_geojson = {"type": "FeatureCollection", "features": []}

    import json
    if total_intersect_area > 0:
        # Calculate percentages securely grouped by type
        grouped = zone_dist_df.groupby("zone_type")["overlap_area_sqm"].sum()
        for z_type, area in grouped.items():
            pct = (area / total_intersect_area) * 100
            if pct > 0.1:  # keep visually relevant values
                zone_distribution_500m[z_type] = round(pct, 1)
        
        # Build geojson
        for _, row in zone_dist_df.iterrows():
            if pd.notna(row["geojson"]) and row["geojson"]:
                zones_geojson["features"].append({
                    "type": "Feature",
                    "geometry": json.loads(row["geojson"]),
                    "properties": {"type": row["zone_type"]}
                })
                
    # ── QUERY 4: Surrounding Buildings Geometries (500m) ────────────────
    buildings_features_query = f"""
        WITH h3 AS (
            SELECT geometry as geom 
            FROM h3_grid 
            WHERE ST_Contains(geometry, ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326))
            LIMIT 1
        )
        SELECT 
            b.building_type, 
            ST_AsGeoJSON(b.geometry) as geojson
        FROM buildings b, h3
        WHERE ST_Intersects(b.geometry, h3.geom);
    """
    buildings_features_df = pd.read_sql(buildings_features_query, engine)
    buildings_geojson = {"type": "FeatureCollection", "features": []}
    
    for _, row in buildings_features_df.iterrows():
        if pd.notna(row["geojson"]) and row["geojson"]:
            buildings_geojson["features"].append({
                "type": "Feature",
                "geometry": json.loads(row["geojson"]),
                "properties": {"type": row["building_type"]}
            })

    # ── SCORING ──────────────────────────────────────────────────

    # Zone score — based on zone type
    # Commercial = best, residential = moderate, industrial = poor,
    # restricted/unknown = very bad
    zone_scores = {
        "commercial":  100,
        "residential":  60,
        "industrial":   30,
        "restricted":   10,
        "other":        40,
        "unknown":      30,
    }
    zone_score = zone_scores.get(zone_type, 30)

    # Building density score
    # 0 buildings     → 0   (empty land, undeveloped)
    # 50 buildings    → 50  (developing area)
    # 100+ buildings  → 100 (dense developed area)
    building_score = min(100, (building_count / 100) * 100)

    # Hard constraint — if zone does NOT allow commercial,
    # cap the final score at 40 regardless of building density
    # This is what the problem statement calls "threshold constraint"
    raw_score = (zone_score * 0.65) + (building_score * 0.35)
    final_score = min(40.0, raw_score) if not allows_commercial else raw_score

    return {
        "zoning_score":               round(float(final_score), 1),
        "zone_type":                  zone_type,
        "allows_commercial":          allows_commercial,
        "building_count_500m":        building_count,
        "total_built_area_sqm":       round(total_built_area),
        "zone_distribution_500m_pct": zone_distribution_500m,
        "building_distribution_500m": building_distribution,
        "breakdown": {
            "zone_score":     round(float(zone_score), 1),
            "building_score": round(float(building_score), 1),
        },
        "buildings_geojson": buildings_geojson,
        "zones_geojson": zones_geojson
    }