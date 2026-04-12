import os
import json
import logging
import requests
from sqlalchemy import text
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()
WAQI_TOKEN = os.getenv("WAQI_TOKEN", "")

logger = logging.getLogger(__name__)

def get_aqi_data(lat: float, lng: float) -> dict | None:
    if not WAQI_TOKEN:
        logger.warning("WAQI_TOKEN not set in environment.")
        return None
    url = f"https://api.waqi.info/feed/geo:{lat};{lng}/?token={WAQI_TOKEN}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        if data.get("status") == "ok":
            return data.get("data")
    except Exception as e:
        logger.error(f"Failed to fetch WAQI data: {e}")
    return None

def determine_aqi_level(aqi: int) -> str:
    if aqi <= 50: return "Good"
    if aqi <= 100: return "Moderate"
    if aqi <= 150: return "Unhealthy for Sensitive Groups"
    if aqi <= 200: return "Unhealthy"
    if aqi <= 300: return "Very Unhealthy"
    return "Hazardous"

def get_environment_score(lat: float, lng: float, db: Session) -> dict:
    query = text("""
        SELECT
            h3_index,
            flood_score
        FROM h3_grid
        WHERE ST_Contains(
            geometry,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
        )
        LIMIT 1;
    """)
    row = db.execute(query, {"lat": lat, "lng": lng}).mappings().first()
    
    flood_score = float(row["flood_score"] or 0) if row else 0.0
    h3_index = row["h3_index"] if row else None

    # Fetch dynamic AQI
    aqi_result = get_aqi_data(lat, lng)
    aqi = None
    aqi_level = "Unknown"
    dominant = None

    if aqi_result:
        try:
            aqi = int(aqi_result.get("aqi"))
            aqi_level = determine_aqi_level(aqi)
            dominant = aqi_result.get("dominentpol")
        except:
            pass

    return {
        "lat": lat,
        "lng": lng,
        "h3_index": h3_index,
        "flood_score": flood_score,
        "aqi": aqi,
        "aqi_level": aqi_level,
        "dominant_pollutant": dominant
    }


def get_environment_grid(db: Session) -> dict:
    query = text("""
        SELECT
            h3_index,
            flood_score,
            ST_AsGeoJSON(geometry) AS geojson
        FROM h3_grid
        ORDER BY h3_index;
    """)
    rows = db.execute(query).mappings().all()

    features = []
    for row in rows:
        geojson = row["geojson"]
        if not geojson:
            continue
        features.append({
            "type": "Feature",
            "geometry": json.loads(geojson),
            "properties": {
                "h3_index": row["h3_index"],
                "flood_score": float(row["flood_score"] or 0),
            },
        })

    logger.info("Environment grid: returning %d hexagonal cells", len(features))

    return {
        "type": "FeatureCollection",
        "features": features,
    }
