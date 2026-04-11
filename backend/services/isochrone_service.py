import os
from pathlib import Path
from functools import lru_cache
import logging

import requests
from dotenv import load_dotenv
from shapely.geometry import shape

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")
logger = logging.getLogger(__name__)

ORS_API_KEY = os.getenv("ORS_API_KEY", "")
AHMEDABAD_DENSITY = 13000  # people per km²

def estimate_population(polygon_geojson: dict) -> int:
    polygon  = shape(polygon_geojson)
    area_deg = polygon.area
    area_km2 = area_deg * (111 * 111 * 0.93)  # corrected for 23°N latitude
    return round(area_km2 * AHMEDABAD_DENSITY)

@lru_cache(maxsize=128)
def get_isochrones(lat: float, lng: float) -> list:
    # Quantize coordinates to ~100m to maximize cache hits
    q_lat = round(lat, 3)
    q_lng = round(lng, 3)

    url = "https://api.openrouteservice.org/v2/isochrones/driving-car"
    headers = {
        "Authorization": ORS_API_KEY,
        "Content-Type": "application/json"
    }
    body = {
        "locations":  [[q_lng, q_lat]],
        "range":      [600, 1200, 1800],
        "range_type": "time"
    }

    try:
        response = requests.post(url, json=body, headers=headers, timeout=5)
        response.raise_for_status()
        features = response.json()["features"]

        result = []
        for feature in features:
            polygon = feature["geometry"]
            result.append({
                "minutes":    int(feature["properties"]["value"] // 60),
                "polygon":    polygon
            })

        # Sort ascending: 10 → 20 → 30
        result.sort(key=lambda x: x["minutes"])
        return result
    except requests.exceptions.Timeout:
        logger.warning(f"Isochrone timeout for {q_lat}, {q_lng}")
        return []
    except requests.exceptions.RequestException as e:
        logger.warning(f"Isochrone error for {q_lat}, {q_lng}: {e}")
        return []