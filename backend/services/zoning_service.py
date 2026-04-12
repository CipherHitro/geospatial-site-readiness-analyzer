# services/zoning_service.py
import pandas as pd
from sqlalchemy.orm import Session

def get_zoning_score(lat: float, lng: float, db: Session, use_case: str = "retail") -> dict:
    engine = db.get_bind()

    # ── QUERY 1: What zone is this point inside? ──────────────────
    # ST_Within checks if the point falls inside a zone polygon
    # If point is not inside any zone (open land etc), returns nothing
    zone_query = f"""
        SELECT zone_type
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
    else:
        zone_type = zone_result.iloc[0]["zone_type"]

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
    def calc_zone_score(z_type, u_case):
        BASE_ZONE_SCORES = {
            "commercial": 100, "residential": 55, "industrial": 35,
            "restricted": 5, "other": 40, "unknown": 30
        }
        base = BASE_ZONE_SCORES.get(z_type, 30)
        ZONE_BONUSES = {
            ("industrial",  "warehouse"):   95,
            ("industrial",  "energy"):      80,
            ("industrial",  "telecom"):     60,
            ("residential", "telecom"):     75,
            ("residential", "ev_charging"): 70,
            ("other",       "energy"):      75,
            ("other",       "telecom"):     65,
            ("commercial",  "retail"):      100,
            ("commercial",  "ev_charging"): 95,
        }
        return ZONE_BONUSES.get((z_type, u_case), base)

    def calc_building_density_score(b_count, t_area, u_case):
        count_score = min(100, b_count * 1.5)
        area_score  = min(100, (t_area / 50000.0) * 100.0)
        raw = (count_score + area_score) / 2.0
        if u_case in ["warehouse", "energy"]:
            return max(0, 100 - raw)   # invert: open space preferred
        return raw

    def calc_commercial_mix_score(z_dist, u_case):
        if not z_dist:
            return 40.0
        commercial_pct  = z_dist.get("commercial", 0)
        industrial_pct  = z_dist.get("industrial", 0)
        residential_pct = z_dist.get("residential", 0)
        other_pct       = z_dist.get("other", 0)
        
        if u_case == "retail":
            return min(100.0, commercial_pct * 1.5)
        elif u_case == "ev_charging":
            return min(100.0, (commercial_pct + residential_pct) * 0.8)
        elif u_case == "warehouse":
            return min(100.0, industrial_pct * 2.0)
        elif u_case == "telecom":
            return min(100.0, 100.0 - z_dist.get("restricted", 0))
        elif u_case == "energy":
            return min(100.0, (other_pct + industrial_pct) * 1.5)
        return 40.0

    def apply_hard_cap(sc, z_type, u_case):
        if z_type == "restricted":
            sc = min(sc, 15.0)
        if z_type == "unknown" and u_case == "retail":
            sc = min(sc, 50.0)
        return sc

    USE_CASE_ZONING_WEIGHTS = {
        "retail":      {"zone": 0.55, "density": 0.25, "mix": 0.20},
        "ev_charging": {"zone": 0.45, "density": 0.30, "mix": 0.25},
        "warehouse":   {"zone": 0.50, "density": 0.30, "mix": 0.20},
        "telecom":     {"zone": 0.40, "density": 0.25, "mix": 0.35},
        "energy":      {"zone": 0.45, "density": 0.25, "mix": 0.30},
    }

    z_score = calc_zone_score(zone_type, use_case)
    density_score = calc_building_density_score(building_count, total_built_area, use_case)
    mix_score = calc_commercial_mix_score(zone_distribution_500m, use_case)

    weights = USE_CASE_ZONING_WEIGHTS.get(use_case, USE_CASE_ZONING_WEIGHTS["retail"])
    
    raw_final = (
        z_score * weights["zone"] +
        density_score * weights["density"] +
        mix_score * weights["mix"]
    )
    
    final_score = apply_hard_cap(raw_final, zone_type, use_case)

    return {
        "zoning_score":               round(float(final_score), 1),
        "zone_type":                  zone_type,
        "building_count_500m":        building_count,
        "total_built_area_sqm":       round(total_built_area),
        "zone_distribution_500m_pct": zone_distribution_500m,
        "building_distribution_500m": building_distribution,
        "breakdown": {
            "zone_score":             round(float(z_score), 1),
            "building_density_score": round(float(density_score), 1),
            "commercial_mix_score":   round(float(mix_score), 1),
        },
        "weights_used":               weights,
        "use_case":                   use_case,
        "buildings_geojson":          buildings_geojson,
        "zones_geojson":              zones_geojson
    }