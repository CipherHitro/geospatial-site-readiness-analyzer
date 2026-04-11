from pydantic import BaseModel, Field
from typing import Any, Literal


# ---------------------------------------------------------------------------
# Request model (used as query-parameter group via Depends)
# ---------------------------------------------------------------------------

class CatchmentRequest(BaseModel):
    """JSON body accepted by POST /api/catchment-direct."""

    lat: float = Field(
        ...,
        description="Latitude of the analysis point (decimal degrees).",
        examples=[23.0225],
    )
    lon: float = Field(
        ...,
        description="Longitude of the analysis point (decimal degrees).",
        examples=[72.5714],
    )
    time_mins: int = Field(
        default=10,
        ge=1,
        le=60,
        description="Travel-time radius in minutes (1–60). Converted to seconds internally.",
    )
    mode: Literal["drive", "walk"] = Field(
        default="drive",
        description="Routing mode – 'drive' for car travel, 'walk' for pedestrian.",
    )


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------

class CatchmentResponse(BaseModel):
    """Payload returned by POST /api/catchment-direct."""

    total_population: int = Field(
        ...,
        description=(
            "Sum of population values for all H3 hex cells in population_grid "
            "that intersect the isochrone polygon (PostGIS ST_Intersects)."
        ),
    )
    point_count: int = Field(
        ...,
        description="Number of H3 hex cells from population_grid captured inside the isochrone polygon.",
    )
    isochrone_geojson: Any = Field(
        ...,
        description="Raw GeoJSON geometry object (Polygon / MultiPolygon) returned by Geoapify.",
    )
