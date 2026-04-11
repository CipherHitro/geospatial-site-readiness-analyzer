"""
catchment_service.py
--------------------
Handles the "Isochrone Catchment Population" calculation using the existing
PostGIS population_grid table — the same H3-hex dataset already used by
demographics_service.py.

Pipeline
--------
1. Call the Geoapify Isochrone API → get a Polygon / MultiPolygon geometry.
2. Run a single PostGIS query:
       SELECT SUM(population), COUNT(*)
       FROM   population_grid
       WHERE  ST_Intersects(geometry, ST_GeomFromGeoJSON(:geojson))
3. Return total_population, hex_count (point_count), and the raw GeoJSON.

No CSV, no Shapely iteration — everything happens in the database.
"""

from __future__ import annotations

import json
import logging
import os
import warnings
from pathlib import Path
from typing import Any

import certifi
import requests
import urllib3
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

GEOAPIFY_API_KEY: str = os.getenv("GEOAPIFY_API_KEY", "")
GEOAPIFY_ISOCHRONE_URL = "https://api.geoapify.com/v1/isoline"

# Allow explicit override via env var: set GEOAPIFY_SSL_VERIFY=false to skip
_SSL_VERIFY_ENV = os.getenv("GEOAPIFY_SSL_VERIFY", "").strip().lower()
_SSL_VERIFY_OVERRIDE: bool | str | None = (
    False if _SSL_VERIFY_ENV == "false"
    else certifi.where() if _SSL_VERIFY_ENV == "certifi"
    else None  # None means "auto-detect"
)


# ---------------------------------------------------------------------------
# Internal SSL helper
# ---------------------------------------------------------------------------

def _make_geoapify_request(url: str, params: dict) -> requests.Response:
    """
    Attempt the HTTPS request with a layered SSL strategy to handle
    corporate / institutional proxies that inject self-signed certificates.

    Strategy (in order):
      1. Default verification (leverages pip-system-certs → Windows cert store).
      2. Explicit certifi CA bundle.
      3. verify=False with a loud warning (dev-only fallback).
    """
    # If the user explicitly set GEOAPIFY_SSL_VERIFY, honour it directly.
    if _SSL_VERIFY_OVERRIDE is not None:
        if _SSL_VERIFY_OVERRIDE is False:
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            logger.warning(
                "SSL verification DISABLED for Geoapify (GEOAPIFY_SSL_VERIFY=false). "
                "Do NOT use in production."
            )
        return requests.get(url, params=params, timeout=15, verify=_SSL_VERIFY_OVERRIDE)

    # --- Auto-detect mode ---
    # Attempt 1: default (pip-system-certs hooks Windows trust store automatically)
    try:
        response = requests.get(url, params=params, timeout=15)
        logger.debug("Geoapify request succeeded with default SSL verification.")
        return response
    except requests.exceptions.SSLError as exc1:
        logger.warning(
            "Default SSL verification failed (%s). "
            "Retrying with explicit certifi bundle ...", exc1
        )

    # Attempt 2: explicit certifi CA bundle
    try:
        response = requests.get(url, params=params, timeout=15, verify=certifi.where())
        logger.debug("Geoapify request succeeded with certifi CA bundle.")
        return response
    except requests.exceptions.SSLError as exc2:
        logger.warning(
            "certifi CA bundle also failed (%s). "
            "This is likely a corporate SSL-inspection proxy. "
            "Falling back to verify=False — add GEOAPIFY_SSL_VERIFY=false "
            "to your .env to suppress this warning.", exc2
        )

    # Attempt 3: disable verification (dev-only fallback)
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    logger.warning(
        "Making Geoapify request with SSL verification DISABLED. "
        "This is safe for development but MUST NOT be used in production. "
        "To silence this warning permanently, set GEOAPIFY_SSL_VERIFY=false in .env"
    )
    return requests.get(url, params=params, timeout=15, verify=False)


# ---------------------------------------------------------------------------
# Geoapify API call
# ---------------------------------------------------------------------------


def _fetch_isochrone(
    lat: float,
    lon: float,
    mode: str,
    time_seconds: int,
) -> dict[str, Any]:
    """
    Call the Geoapify Isochrone (Isoline) API and return the raw
    GeoJSON FeatureCollection.

    Raises
    ------
    EnvironmentError  – GEOAPIFY_API_KEY not set.
    PermissionError   – 401 / 403 from Geoapify.
    requests.HTTPError – any other 4xx / 5xx.
    ValueError         – empty FeatureCollection.
    """
    if not GEOAPIFY_API_KEY:
        raise EnvironmentError(
            "GEOAPIFY_API_KEY environment variable is not set. "
            "Add it to your backend/.env file and restart the server."
        )

    params = {
        "lat":   lat,
        "lon":   lon,
        "type":  "time",
        "mode":  mode,           # 'drive' | 'walk'
        "range": time_seconds,   # seconds
        "apiKey": GEOAPIFY_API_KEY,
    }

    logger.info(
        "Calling Geoapify Isoline API | lat=%s lon=%s mode=%s range=%ss",
        lat, lon, mode, time_seconds,
    )

    response = _make_geoapify_request(GEOAPIFY_ISOCHRONE_URL, params)

    if response.status_code in (401, 403):
        raise PermissionError(
            f"Geoapify API returned {response.status_code}. "
            "Check that GEOAPIFY_API_KEY is valid and has Isoline access."
        )

    response.raise_for_status()

    data = response.json()

    if "features" not in data or not data["features"]:
        raise ValueError(
            "Geoapify returned a FeatureCollection with no features. "
            f"Raw response: {data}"
        )

    return data


# ---------------------------------------------------------------------------
# PostGIS population query
# ---------------------------------------------------------------------------


def _sum_population_in_polygon(
    geometry_geojson: dict[str, Any],
    db: Session,
) -> tuple[int, int]:
    """
    Query the population_grid table (H3 hex cells, same source as
    demographics_service) and return the total population + hex count
    for all cells that intersect the given GeoJSON geometry.

    Parameters
    ----------
    geometry_geojson : GeoJSON geometry dict (Polygon or MultiPolygon)
    db               : Active SQLAlchemy session

    Returns
    -------
    (total_population, hex_count)
    """
    geojson_str = json.dumps(geometry_geojson)

    query = text(
        """
        SELECT
            COALESCE(SUM(population), 0)  AS total_population,
            COUNT(*)                       AS hex_count
        FROM population_grid
        WHERE
            geometry IS NOT NULL
            AND ST_Intersects(
                geometry,
                ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)
            );
        """
    )

    row = db.execute(query, {"geojson": geojson_str}).mappings().first()

    total_population = int(row["total_population"]) if row else 0
    hex_count        = int(row["hex_count"])        if row else 0

    logger.info(
        "PostGIS catchment query → %d hex cells, population=%d",
        hex_count, total_population,
    )

    return total_population, hex_count


# ---------------------------------------------------------------------------
# Public service function
# ---------------------------------------------------------------------------


def get_catchment_population(
    lat: float,
    lon: float,
    db: Session,
    time_mins: int = 10,
    mode: str = "drive",
) -> dict[str, Any]:
    """
    Full catchment pipeline:

      1. Fetch isochrone polygon from Geoapify.
      2. Run ST_Intersects against population_grid (H3 hex cells) in PostGIS.
      3. Return aggregated result.

    Parameters
    ----------
    lat       : Latitude of seed location.
    lon       : Longitude of seed location.
    db        : SQLAlchemy Session (injected by FastAPI via Depends).
    time_mins : Travel-time radius in minutes (default 10).
    mode      : 'drive' or 'walk' (default 'drive').

    Returns
    -------
    dict with keys:
        total_population  (int)   – sum of population in intersecting H3 cells
        point_count       (int)   – number of H3 cells intersected
        isochrone_geojson (dict)  – raw GeoJSON geometry from Geoapify
    """
    time_seconds = time_mins * 60

    # Step 1 — fetch the isochrone polygon from Geoapify
    feature_collection  = _fetch_isochrone(lat, lon, mode, time_seconds)
    isochrone_geometry  = feature_collection["features"][0]["geometry"]

    # Step 2 — query PostGIS population_grid (H3 hexes) via ST_Intersects
    total_population, hex_count = _sum_population_in_polygon(
        isochrone_geometry, db
    )

    logger.info(
        "Catchment result | mode=%s time=%dm → %d H3 cells, population=%d",
        mode, time_mins, hex_count, total_population,
    )

    return {
        "total_population":  total_population,
        "point_count":       hex_count,
        "isochrone_geojson": isochrone_geometry,
    }
