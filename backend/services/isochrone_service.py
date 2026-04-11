import os
from copy import deepcopy
from functools import lru_cache
from pathlib import Path

import requests
from dotenv import load_dotenv
from shapely.geometry import shape

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

ORS_API_KEY = os.getenv("ORS_API_KEY", "")
ORS_TIMEOUT_SECONDS = float(os.getenv("ORS_TIMEOUT_SECONDS", "8"))
AHMEDABAD_DENSITY = 13000  # people per km²

def estimate_population(polygon_geojson: dict) -> int:
    polygon  = shape(polygon_geojson)
    area_deg = polygon.area
    area_km2 = area_deg * (111 * 111 * 0.93)  # corrected for 23°N latitude
    return round(area_km2 * AHMEDABAD_DENSITY)

@lru_cache(maxsize=256)
def _get_isochrones_cached(lat: float, lng: float) -> tuple[dict, ...]:
    if not ORS_API_KEY:
        raise EnvironmentError("ORS_API_KEY is not set")

    url = "https://api.openrouteservice.org/v2/isochrones/driving-car"
    headers = {
        "Authorization": ORS_API_KEY,
        "Content-Type": "application/json"
    }
    body = {
        "locations":  [[lng, lat]],
        "range":      [600, 1200, 1800],
        "range_type": "time"
    }

    response = requests.post(
        url,
        json=body,
        headers=headers,
        timeout=(3.0, ORS_TIMEOUT_SECONDS),
    )
    response.raise_for_status()
    features = response.json()["features"]

    result: list[dict] = []
    for feature in features:
        polygon = feature["geometry"]
        result.append({
            "minutes":    int(feature["properties"]["value"] // 60),
            # "population": estimate_population(polygon),
            "polygon":    polygon
        })

    # Sort ascending: 10 → 20 → 30
    result.sort(key=lambda x: x["minutes"])
    return tuple(result)


def get_isochrones(lat: float, lng: float) -> list:
    # Coordinate quantization improves cache hits for near-identical clicks.
    lat_q = round(lat, 5)
    lng_q = round(lng, 5)
    return deepcopy(list(_get_isochrones_cached(lat_q, lng_q)))