import pandas as pd
from sqlalchemy.orm import Session

# ── USE-CASE DEFINITIONS ────────────────────────────────────────
# For each use case we define:
#   competitors  – categories that directly compete with the user's business
#   anchors      – high-footfall / infrastructure POIs that HELP the business
#   complementary – nearby amenities that indirectly support the business
#
# Any POI whose category does NOT appear in any list keeps its original poi_type.

USE_CASE_CONFIG = {
    "retail": {
        "label": "Retail Store",
        "competitors": [
            "retail_store", "clothing_store", "electronics_shop",
            "supermarket", "mall",
        ],
        "anchors": [
            "hospital", "school", "college", "university", "bank",
            "sports_centre", "stadium",
        ],
        "complementary": [
            "restaurant", "cafe", "pharmacy", "salon", "gym",
            "office_building", "hotel", "cinema", "park",
            "bus_terminal", "market", "food_court", "parking_lot",
        ],
        "scoring": {
            "anchor_weight": 12, "anchor_cap": 45,
            "comp_weight": 5,   "comp_cap": 35,
            "penalty_weight": 15, "penalty_cap": 30,
        },
    },
    "ev_charging": {
        "label": "EV Charging Station",
        "competitors": [
            "electronics_shop",  # proxy for existing EV stations
        ],
        "anchors": [
            "mall", "supermarket", "parking_lot",
            "office_building", "hotel",
        ],
        "complementary": [
            "restaurant", "cafe", "gym", "cinema", "food_court",
            "hospital", "bank", "bus_terminal", "market", "park",
        ],
        "scoring": {
            "anchor_weight": 15, "anchor_cap": 50,
            "comp_weight": 4,   "comp_cap": 30,
            "penalty_weight": 20, "penalty_cap": 25,
        },
    },
    "warehouse": {
        "label": "Warehouse / Logistics Hub",
        "competitors": [
            "retail_store", "clothing_store",  # other warehouses
        ],
        "anchors": [
            "bus_terminal", "market", "parking_lot",
        ],
        "complementary": [
            "office_building", "food_court", "restaurant", "cafe",
            "bank", "hotel",
        ],
        "scoring": {
            "anchor_weight": 18, "anchor_cap": 50,
            "comp_weight": 3,   "comp_cap": 25,
            "penalty_weight": 10, "penalty_cap": 20,
        },
    },
    "telecom": {
        "label": "Telecom Tower / Infrastructure",
        "competitors": [
            "electronics_shop",  # proxy for existing towers
        ],
        "anchors": [
            "hospital", "school", "college", "university",
            "office_building", "mall", "stadium",
        ],
        "complementary": [
            "bank", "hotel", "bus_terminal", "park",
            "restaurant", "cafe", "market",
        ],
        "scoring": {
            "anchor_weight": 10, "anchor_cap": 40,
            "comp_weight": 5,   "comp_cap": 35,
            "penalty_weight": 20, "penalty_cap": 30,
        },
    },
    "renewable_energy": {
        "label": "Renewable Energy Installation",
        "competitors": [],  # very few direct competitors in POI data
        "anchors": [
            "office_building", "mall", "supermarket",
            "hospital", "university", "stadium",
        ],
        "complementary": [
            "parking_lot", "bus_terminal", "market",
            "hotel", "bank",
        ],
        "scoring": {
            "anchor_weight": 12, "anchor_cap": 50,
            "comp_weight": 4,   "comp_cap": 30,
            "penalty_weight": 25, "penalty_cap": 25,
        },
    },
}

# Fallback if an unknown use_case is passed
DEFAULT_CONFIG = USE_CASE_CONFIG["retail"]


def _classify(row, cfg):
    """Classify a POI row as competitor / anchor / complementary based on config."""
    cat = row["category"].lower()
    if cat in cfg["competitors"]:
        return "competitor"
    if cat in cfg["anchors"]:
        return "anchor"
    if cat in cfg["complementary"]:
        return "complementary"
    # Fall back to whatever was stored in the DB
    return row["poi_type"]


def get_poi_score(lat: float, lng: float, radius: float, use_case: str, db: Session) -> dict:
    engine = db.get_bind()
    cfg = USE_CASE_CONFIG.get(use_case, DEFAULT_CONFIG)
    scoring = cfg["scoring"]

    query = f"""
        SELECT
            name,
            category,
            poi_type,
            ST_X(geometry) AS lng,
            ST_Y(geometry) AS lat,
            ST_Distance(
                geometry::geography,
                ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography
            ) AS distance_m
        FROM poi_locations
        WHERE ST_DWithin(
            geometry::geography,
            ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography,
            {radius}
        )
        ORDER BY distance_m;
    """

    try:
        df = pd.read_sql(query, engine)
    except Exception as e:
        print(f"Error querying poi_locations: {e}")
        df = pd.DataFrame()

    if df.empty:
        return {
            "score": 50,
            "label": cfg["label"],
            "use_case": use_case,
            "summary": "No POIs found in this area.",
            "counts": {"anchors": 0, "competitors": 0, "complementary": 0},
            "anchors": [],
            "competitors": [],
            "complementary": [],
            "features": [],
        }

    # Dynamic classification
    df["dynamic_type"] = df.apply(lambda r: _classify(r, cfg), axis=1)

    anchors_df = df[df["dynamic_type"] == "anchor"]
    competitors_df = df[df["dynamic_type"] == "competitor"]
    complementary_df = df[df["dynamic_type"] == "complementary"]

    # ── Score calculation ───────────────────────────────────────
    def _competitor_score(count):
        if count == 0: return 30
        if 1 <= count <= 2: return 60
        if 3 <= count <= 5: return 90
        if 6 <= count <= 8: return 100
        if 9 <= count <= 12: return 75
        if 13 <= count <= 18: return 45
        return 20

    def _complementary_score(count):
        return min(100, count * 12)

    def _anchor_score(count):
        if count == 0: return 0
        if count == 1: return 55
        if count == 2: return 80
        if count == 3: return 95
        return 100

    USE_CASE_POI_WEIGHTS = {
        "retail":      {"competitor": 0.35, "complementary": 0.35, "anchor": 0.30},
        "ev_charging": {"competitor": 0.25, "complementary": 0.20, "anchor": 0.55},
        "warehouse":   {"competitor": 0.05, "complementary": 0.10, "anchor": 0.85},
        "telecom":     {"competitor": 0.05, "complementary": 0.10, "anchor": 0.85},
        "energy":      {"competitor": 0.05, "complementary": 0.05, "anchor": 0.90},
    }

    anchor_count = len(anchors_df)
    competitor_count = len(competitors_df)
    complementary_count = len(complementary_df)

    anchor_sc = _anchor_score(anchor_count)
    comp_sc = _competitor_score(competitor_count)
    compl_sc = _complementary_score(complementary_count)

    weights = USE_CASE_POI_WEIGHTS.get(use_case, USE_CASE_POI_WEIGHTS["retail"])
    
    total_score = (
        anchor_sc * weights["anchor"] +
        comp_sc * weights["competitor"] +
        compl_sc * weights["complementary"]
    )

    if use_case in ["retail", "ev_charging"] and anchor_count == 0 and competitor_count == 0:
        total_score = min(total_score, 35.0)

    # ── GeoJSON features for the map ────────────────────────────
    POI_COLORS = {
        "anchor": "#58a6ff",
        "competitor": "#f85149",
        "complementary": "#3fb950",
    }

    features = []
    for _, row in df.iterrows():
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [row["lng"], row["lat"]],
            },
            "properties": {
                "name": row["name"],
                "category": row["category"],
                "poi_type": row["dynamic_type"],
                "distance_m": round(row["distance_m"]),
                "color": POI_COLORS.get(row["dynamic_type"], "#e3883e"),
            },
        })

    def to_dict_list(dframe):
        return [
            {
                "name": r["name"],
                "category": r["category"],
                "lat": r["lat"],
                "lng": r["lng"],
                "distance_m": round(r["distance_m"]),
            }
            for _, r in dframe.iterrows()
        ]

    return {
        "poi_score": total_score,
        "score": total_score, # Keep 'score' for backward compatibility
        "competitor_score": comp_sc,
        "complementary_score": compl_sc,
        "anchor_score": anchor_sc,
        "anchor_count": anchor_count,
        "competitor_count": competitor_count,
        "complementary_count": complementary_count,
        "weights_used": weights,
        "label": cfg["label"],
        "use_case": use_case,
        "summary": (
            f"Found {anchor_count} anchors, "
            f"{complementary_count} complementary places, "
            f"and {competitor_count} direct competitors "
            f"for {cfg['label']}."
        ),
        "counts": {
            "anchors": anchor_count,
            "competitors": competitor_count,
            "complementary": complementary_count,
        },
        "anchors": to_dict_list(anchors_df),
        "competitors": to_dict_list(competitors_df),
        "complementary": to_dict_list(complementary_df),
        "features": features,
    }