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

    # Fetch geometry details to display on map for nearby infrastructure
    bus_stops_query = f"""
        SELECT name,
        ST_Distance(
            geometry::geography,
            ST_SetSRID(ST_MakePoint({lng},{lat}),4326)::geography
        ) AS dist_m,
        ST_AsGeoJSON(ST_Centroid(geometry)) as geojson
        FROM bus_stops
        WHERE ST_DWithin(
            geometry::geography,
            ST_SetSRID(ST_MakePoint({lng},{lat}),4326)::geography, 1000
        )
        ORDER BY dist_m ASC LIMIT 10;
    """
    import json
    bus_stops_df = pd.read_sql(bus_stops_query, engine)
    bus_stops_nearby = []
    for _, row in bus_stops_df.iterrows():
        bus_stops_nearby.append({
            "name": row["name"] or "Unnamed Bus Stop",
            "dist_m": int(row["dist_m"]),
            "geometry": json.loads(row["geojson"]) if row["geojson"] else None
        })

    stations_query = f"""
        SELECT name,
        ST_Distance(
            geometry::geography,
            ST_SetSRID(ST_MakePoint({lng},{lat}),4326)::geography
        ) AS dist_m,
        ST_AsGeoJSON(ST_Centroid(geometry)) as geojson
        FROM stations
        WHERE ST_DWithin(
            geometry::geography,
            ST_SetSRID(ST_MakePoint({lng},{lat}),4326)::geography, 3000
        )
        ORDER BY dist_m ASC LIMIT 10;
    """
    stations_df = pd.read_sql(stations_query, engine)
    stations_nearby = []
    for _, row in stations_df.iterrows():
        stations_nearby.append({
            "name": row["name"] or "Unnamed Station",
            "dist_m": int(row["dist_m"]),
            "geometry": json.loads(row["geojson"]) if row["geojson"] else None
        })

    roads_nearby_query = f"""
        SELECT highway, length AS length_m, ST_AsGeoJSON(geometry) as geojson
        FROM roads
        WHERE ST_DWithin(
            geometry::geography,
            ST_SetSRID(ST_MakePoint({lng},{lat}),4326)::geography, 500
        );
    """
    roads_df = pd.read_sql(roads_nearby_query, engine)
    roads_nearby = []
    for _, row in roads_df.iterrows():
        roads_nearby.append({
            "highway": row["highway"] or "unknown",
            "length_m": float(row["length_m"] or 0.0),
            "geometry": json.loads(row["geojson"]) if row["geojson"] else None
        })

    bus_score     = max(0, 100 - (bus["dist_m"] / 1000 * 100))
    station_score = max(0, 100 - (station["dist_m"] / 3000 * 100))
    road_score    = min(100, (road_length / 5000) * 100)
    final_score   = (bus_score * 0.35) + (station_score * 0.40) + (road_score * 0.25)

    return {
        "transport_score":     round(float(final_score), 1),
        "nearest_bus_stop":    bus["name"] or "Unnamed Bus Stop",
        "bus_stop_distance_m": int(round(bus["dist_m"])),
        "nearest_station":     station["name"] or "Unnamed Station",
        "station_distance_m":  int(round(station["dist_m"])),
        "total_road_length_m": round(road_length),
        "breakdown": {
            "bus_score":     round(float(bus_score), 1),
            "station_score": round(float(station_score), 1),
            "road_score":    round(float(road_score), 1),
        },
        "roads_nearby": roads_nearby,
        "bus_stops_nearby": bus_stops_nearby,
        "stations_nearby": stations_nearby
    }