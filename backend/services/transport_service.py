import json
from sqlalchemy import text
from sqlalchemy.orm import Session

def get_transport_score(lat: float, lng: float, db: Session) -> dict:
    bus_query = text(f"""
        SELECT name,
        ST_Distance(
            geometry::geography,
            ST_SetSRID(ST_MakePoint({lng},{lat}),4326)::geography
        ) AS dist_m
        FROM bus_stops
        WHERE geometry IS NOT NULL
        ORDER BY dist_m ASC LIMIT 1;
    """)
    bus = db.execute(bus_query).mappings().first()

    station_query = text(f"""
        SELECT name,
        ST_Distance(
            geometry::geography,
            ST_SetSRID(ST_MakePoint({lng},{lat}),4326)::geography
        ) AS dist_m
        FROM stations
        WHERE geometry IS NOT NULL
        ORDER BY dist_m ASC LIMIT 1;
    """)
    station = db.execute(station_query).mappings().first()

    road_query = text(f"""
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
    """)
    road_row = db.execute(road_query).mappings().first()
    road_length = float(road_row['total_road_length_m']) if road_row and road_row['total_road_length_m'] is not None else 0.0

    # Fetch geometry details to display on map for nearby infrastructure
    bus_stops_query = text(f"""
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
    """)
    bus_stops_nearby = []
    for row in db.execute(bus_stops_query).mappings():
        val_name = row.get("name")
        val_geojson = row.get("geojson")
        bus_stops_nearby.append({
            "name": str(val_name) if val_name is not None and val_name else "Unnamed Bus Stop",
            "dist_m": int(row["dist_m"]),
            "geometry": json.loads(val_geojson) if val_geojson is not None and val_geojson else None
        })

    stations_query = text(f"""
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
    """)
    stations_nearby = []
    for row in db.execute(stations_query).mappings():
        val_name = row.get("name")
        val_geojson = row.get("geojson")
        stations_nearby.append({
            "name": str(val_name) if val_name is not None and val_name else "Unnamed Station",
            "dist_m": int(row["dist_m"]),
            "geometry": json.loads(val_geojson) if val_geojson is not None and val_geojson else None
        })

    roads_nearby_query = text(f"""
        SELECT highway, length AS length_m, ST_AsGeoJSON(geometry) as geojson
        FROM roads
        WHERE ST_DWithin(
            geometry::geography,
            ST_SetSRID(ST_MakePoint({lng},{lat}),4326)::geography, 500
        );
    """)
    roads_nearby = []
    for row in db.execute(roads_nearby_query).mappings():
        val_hw = row.get("highway")
        val_len = row.get("length_m")
        val_geojson = row.get("geojson")
        roads_nearby.append({
            "highway": str(val_hw) if val_hw is not None and val_hw else "unknown",
            "length_m": float(val_len) if val_len is not None else 0.0,
            "geometry": json.loads(val_geojson) if val_geojson is not None and val_geojson else None
        })

    bus_name = bus.get("name") if bus else None
    bus_dist = float(bus.get("dist_m")) if bus and bus.get("dist_m") is not None else 10000.0

    station_name = station.get("name") if station else None
    station_dist = float(station.get("dist_m")) if station and station.get("dist_m") is not None else 10000.0

    bus_score     = max(0, 100 - (bus_dist / 1000 * 100))
    station_score = max(0, 100 - (station_dist / 3000 * 100))
    road_score    = min(100, (road_length / 5000) * 100)
    final_score   = (bus_score * 0.35) + (station_score * 0.40) + (road_score * 0.25)

    return {
        "transport_score":     round(float(final_score), 1),
        "nearest_bus_stop":    str(bus_name) if bus_name else "Unnamed Bus Stop",
        "bus_stop_distance_m": int(round(bus_dist)),
        "nearest_station":     str(station_name) if station_name else "Unnamed Station",
        "station_distance_m":  int(round(station_dist)),
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