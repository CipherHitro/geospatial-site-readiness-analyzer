import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session

def get_transport_score(lat: float, lng: float, db: Session) -> dict:
    engine = db.get_bind()

    bus_query = f"""
        SELECT name,
        ST_Distance(
            geometry::geography,
            ST_SetSRID(ST_MakePoint({lng},{lat}),4326)::geography
        ) AS dist_m
        FROM bus_stops
        WHERE geometry IS NOT NULL
        ORDER BY dist_m ASC LIMIT 1;
    """
    bus = pd.read_sql(bus_query, engine).iloc[0]

    station_query = f"""
        SELECT name,
        ST_Distance(
            geometry::geography,
            ST_SetSRID(ST_MakePoint({lng},{lat}),4326)::geography
        ) AS dist_m
        FROM stations
        WHERE geometry IS NOT NULL
        ORDER BY dist_m ASC LIMIT 1;
    """
    station = pd.read_sql(station_query, engine).iloc[0]

    road_query = f"""
        SELECT COALESCE(SUM(
            ST_Length(ST_Intersection(
                ST_Transform(geometry, 32643),
                ST_Buffer(ST_Transform(ST_SetSRID(ST_MakePoint({lng},{lat}),4326),32643), 500)
            ))
        ), 0) AS total_road_length_m
        FROM roads
        WHERE ST_DWithin(
            geometry::geography,
            ST_SetSRID(ST_MakePoint({lng},{lat}),4326)::geography, 500
        );
    """
    road_length = float(pd.read_sql(road_query, engine).iloc[0]['total_road_length_m'])

    bus_score     = max(0, 100 - (bus["dist_m"] / 1000 * 100))
    station_score = max(0, 100 - (station["dist_m"] / 3000 * 100))
    road_score    = min(100, (road_length / 5000) * 100)
    final_score   = (bus_score * 0.35) + (station_score * 0.40) + (road_score * 0.25)

    return {
        "transport_score":     round(float(final_score), 1),
        "nearest_bus_stop":    bus["name"],
        "bus_stop_distance_m": int(round(bus["dist_m"])),
        "nearest_station":     station["name"],
        "station_distance_m":  int(round(station["dist_m"])),
        "total_road_length_m": round(road_length),
        "breakdown": {
            "bus_score":     round(float(bus_score), 1),
            "station_score": round(float(station_score), 1),
            "road_score":    round(float(road_score), 1),
        }
    }