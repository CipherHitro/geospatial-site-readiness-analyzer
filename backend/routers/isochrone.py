"""
routers/isochrone.py
--------------------
FastAPI router for catchment-area (isochrone) endpoints.

Registered in main.py via:
    from routers import isochrone
    app.include_router(isochrone.router)

Endpoints
---------
POST /api/catchment-direct
    Body: { "lat": 23.0225, "lon": 72.5714, "time_mins": 10, "mode": "drive" }
    Returns: total_population, point_count, isochrone_geojson

Data source: population_grid PostGIS table (H3 hex cells) — same dataset
             used by demographics_service.get_demographics_score().
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from schemas.isochrone import CatchmentRequest, CatchmentResponse
from services.catchment_service import get_catchment_population

router = APIRouter(prefix="/api", tags=["Catchment / Isochrone"])


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/catchment-direct",
    response_model=CatchmentResponse,
    summary="Isochrone catchment population (H3 population_grid)",
    description=(
        "Calls the **Geoapify Isochrone API** to generate a travel-time polygon, "
        "then runs a **PostGIS ST_Intersects** query against the `population_grid` "
        "table (H3 hex cells) — the same dataset used by the Demographics score — "
        "to return the real aggregated population inside the catchment area."
    ),
)
def catchment_direct(
    req: CatchmentRequest,
    db: Session = Depends(get_db),
) -> CatchmentResponse:
    """
    POST /api/catchment-direct

    Body: { "lat": 23.0225, "lon": 72.5714, "time_mins": 10, "mode": "drive" }
    """
    try:
        result = get_catchment_population(
            lat=req.lat,
            lon=req.lon,
            db=db,
            time_mins=req.time_mins,
            mode=req.mode,
        )
    except EnvironmentError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream or database error: {exc}",
        )

    return CatchmentResponse(**result)
