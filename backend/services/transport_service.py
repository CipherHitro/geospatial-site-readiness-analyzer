from sqlalchemy import text
from sqlalchemy.orm import Session

def get_transport_score(lat: float, lng: float, db: Session) -> dict:
    params = {"lat": lat, "lng": lng}

    bus_query = text(
        """
        SELECT
            name,
            ST_Distance(
                geometry::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
            ) AS dist_m
        FROM bus_stops
        WHERE geometry IS NOT NULL
        ORDER BY dist_m ASC
        LIMIT 1;
        """
    )
    bus = db.execute(bus_query, params).mappings().first()

    station_query = text(
        """
        SELECT
            name,
            ST_Distance(
                geometry::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
            ) AS dist_m
        FROM stations
        WHERE geometry IS NOT NULL
        ORDER BY dist_m ASC
        LIMIT 1;
        """
    )
    station = db.execute(station_query, params).mappings().first()

    road_query = text(
        """
        SELECT
            COALESCE(SUM(
                ST_Length(ST_Intersection(
                    ST_Transform(geometry, 32643),
                    ST_Buffer(ST_Transform(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), 32643), 500)
                ))
            ), 0) AS total_road_length_m
        FROM roads
        WHERE ST_DWithin(
            geometry::geography,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            500
        );
        """
    )
    road_row = db.execute(road_query, params).mappings().first()

    bus_name = bus["name"] if bus and bus.get("name") else "Unknown"
    bus_dist = float(bus["dist_m"]) if bus and bus.get("dist_m") is not None else 10000.0

    station_name = station["name"] if station and station.get("name") else "Unknown"
    station_dist = float(station["dist_m"]) if station and station.get("dist_m") is not None else 10000.0

    road_length = float(road_row["total_road_length_m"]) if road_row and road_row.get("total_road_length_m") is not None else 0.0

    bus_score     = max(0, 100 - (bus_dist / 1000 * 100))
    station_score = max(0, 100 - (station_dist / 3000 * 100))
    road_score    = min(100, (road_length / 5000) * 100)
    final_score   = (bus_score * 0.35) + (station_score * 0.40) + (road_score * 0.25)

    return {
        "transport_score":     round(float(final_score), 1),
        "nearest_bus_stop":    bus_name,
        "bus_stop_distance_m": int(round(bus_dist)),
        "nearest_station":     station_name,
        "station_distance_m":  int(round(station_dist)),
        "total_road_length_m": round(road_length),
        "breakdown": {
            "bus_score":     round(float(bus_score), 1),
            "station_score": round(float(station_score), 1),
            "road_score":    round(float(road_score), 1),
        }
    }