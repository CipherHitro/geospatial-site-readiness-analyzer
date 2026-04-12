from fastapi import APIRouter

router = APIRouter(prefix="/api/score", tags=["Score"])

# ── Per-use-case default weights ──────────────────────────────────────────────
# Each use case specifies the importance (0–1, sums to 1.0) of each scoring layer.
# These values reflect the domain logic for each business type:
#   - demographics:   population density, income levels, age distribution
#   - transportation: road access, bus/rail connectivity
#   - competition:    density of direct competitors / anchors (POI score)
#   - landuse:        zoning compatibility (commercial, industrial, etc.)
#   - risk:           environmental risk (flood, AQI, industrial proximity)

USE_CASE_PRESETS = {
    "retail": {
        "label": "Retail Store",
        "icon": "fa-store",
        "description": "Foot-traffic driven. Prioritises dense residential populations, multi-modal transport access, and favourable zoning.",
        "weights": {
            "demographics":    0.30,   # High – population & income are key
            "transportation":  0.25,   # High – walkability & public transit
            "competition":     0.20,   # Medium – competitor proximity matters
            "landuse":         0.15,   # Medium – must be commercially zoned
            "risk":            0.10,   # Low – flood / AQI minor concern
        },
        "rationale": {
            "demographics":   "Dense, high-income catchments drive sales.",
            "transportation": "Footfall depends on easy public transit & road access.",
            "competition":    "Competitor saturation reduces addressable market.",
            "landuse":        "Commercial zoning is required for operations.",
            "risk":           "Some resilience needed, but retail recovers quickly.",
        },
    },
    "ev_charging": {
        "label": "EV Charging Station",
        "icon": "fa-charging-station",
        "description": "Infrastructure use case. Prioritises road network density, parking anchors, and low environmental risk.",
        "weights": {
            "demographics":    0.15,   # Low – EV ownership crosses demographics
            "transportation":  0.35,   # Very High – road network & traffic volume
            "competition":     0.15,   # Low – EV charger density still low
            "landuse":         0.20,   # Medium – needs commercial or parking zone
            "risk":            0.15,   # Medium – electricity + flood = risk
        },
        "rationale": {
            "demographics":   "EV owners are spread across income segments.",
            "transportation": "High-traffic roads and parking lots maximise utilisation.",
            "competition":    "EV charger supply is still underpenetrated.",
            "landuse":        "Parking zones and commercial areas are ideal.",
            "risk":           "Electrical infrastructure is sensitive to flood risk.",
        },
    },
    "warehouse": {
        "label": "Warehouse / Logistics Hub",
        "icon": "fa-warehouse",
        "description": "Freight-optimised. Road and highway connectivity is paramount; demographics are largely irrelevant.",
        "weights": {
            "demographics":    0.05,   # Very Low – labour availability only
            "transportation":  0.40,   # Very High – truck routes & highway access
            "competition":     0.10,   # Low – market is less saturated
            "landuse":         0.35,   # Very High – industrial/logistics zoning needed
            "risk":            0.10,   # Medium – flood damage to stock is costly
        },
        "rationale": {
            "demographics":   "Only a small workforce catchment is required.",
            "transportation": "Last-mile logistics demand primary road access.",
            "competition":    "Warehouse clusters provide agglomeration benefits.",
            "landuse":        "Industrial or logistics-designated land is essential.",
            "risk":           "Flood or AQI can disrupt supply-chain continuity.",
        },
    },
    "telecom": {
        "label": "Telecom Tower / Infrastructure",
        "icon": "fa-tower-cell",
        "description": "Coverage-driven. Elevated, unobstructed sites close to dense demand zones. Environmental risk is critical.",
        "weights": {
            "demographics":    0.25,   # High – signal demand follows population
            "transportation":  0.10,   # Low – access only for maintenance
            "competition":     0.20,   # Medium – avoid overlapping coverage
            "landuse":         0.20,   # Medium – needs permissible zone
            "risk":            0.25,   # High – lightning, flood, industrial EMI
        },
        "rationale": {
            "demographics":   "Tower placement targets high-user-density zones.",
            "transportation": "Minimal – only periodic maintenance vehicles required.",
            "competition":    "Overlapping towers waste capital; spacing matters.",
            "landuse":        "Height restrictions and zoning approvals are key.",
            "risk":           "Telecoms infrastructure is highly sensitive to environmental hazards.",
        },
    },
    "renewable_energy": {
        "label": "Renewable Energy Installation",
        "icon": "fa-solar-panel",
        "description": "Land-area and environmental-risk dominated. Solar/wind needs large, flat, low-risk plots with grid connectivity.",
        "weights": {
            "demographics":    0.05,   # Very Low – remote sites are fine
            "transportation":  0.15,   # Low – grid connection & access roads
            "competition":     0.10,   # Low – energy market is less local
            "landuse":         0.40,   # Very High – large open land required
            "risk":            0.30,   # Very High – flood/wind/soil stability
        },
        "rationale": {
            "demographics":   "Renewable installations serve the grid, not local users.",
            "transportation": "Grid interconnect proximity reduces transmission losses.",
            "competition":    "Energy market competition is regional, not local.",
            "landuse":        "Vast unobstructed land is the primary siting factor.",
            "risk":           "Severe weather and flood risk directly damage assets.",
        },
    },
}


@router.get("/presets")
def get_presets():
    """
    Returns the default scoring-layer weights and metadata for each supported use case.
    Frontend uses this to initialise weight sliders and power the 'Restore Defaults' button.
    """
    return {"presets": USE_CASE_PRESETS}
