import geopandas as gpd
from sqlalchemy import create_engine
import os

engine = create_engine("postgresql://rohit:thisisme@localhost:5432/geospatial")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")

# Import bus stops
bus_stops = gpd.read_file(os.path.join(DATASET_DIR, "bus_stops.geojson"))
bus_stops = bus_stops[['name', 'geometry']]  # keep only what matters
bus_stops.to_postgis("bus_stops", engine, if_exists='replace')

# Import stations
stations = gpd.read_file(os.path.join(DATASET_DIR, "stations.geojson"))
stations = stations[['name', 'geometry']]
stations.to_postgis("stations", engine, if_exists='replace')

# Roads — convert graphml to GeoDataFrame first
import osmnx as ox
G = ox.load_graphml(os.path.join(DATASET_DIR, "ahmedabad_roads.graphml"))
edges = ox.graph_to_gdfs(G, nodes=False)  # get only the road lines
edges = edges[['highway', 'length', 'geometry']]
edges.to_postgis("roads", engine, if_exists='replace')
print("✅ roads table seeded")

# ── ZONES ──────────────────────────────────────────────────────
landuse = gpd.read_file(os.path.join(DATASET_DIR, "landuse.geojson"))
landuse = landuse.set_crs(4326, allow_override=True)

zone_map = {
    "commercial": "commercial", "retail": "commercial", "parking": "commercial",
    "residential": "residential", "garages": "residential",
    "industrial": "industrial", "railway": "industrial", "construction": "industrial",
    "brownfield": "industrial", "greenfield": "industrial",
    "reservoir": "restricted", "grass": "restricted", "farmland": "restricted",
    "farmyard": "restricted", "recreation_ground": "restricted",
    "cemetery": "restricted", "military": "restricted", "forest": "restricted",
    "basin": "restricted", "landfill": "restricted", "meadow": "restricted",
    "plant_nursery": "restricted", "plantation": "restricted",
    "education": "other", "educational": "other", "religious": "other",
    "government": "other", "garden": "other", "park": "other",
}

landuse["zone_type"] = landuse["landuse"].map(zone_map).fillna("other")
landuse["allows_commercial"] = landuse["zone_type"] == "commercial"

# Only keep the 3 columns PostGIS needs
zones_df = landuse[["zone_type", "allows_commercial", "geometry"]].copy()

zones_df.to_postgis("zones", engine, if_exists="replace", index=False)
print(f"✅ zones table: {len(zones_df)} rows")

# ── BUILDINGS ──────────────────────────────────────────────────
buildings = gpd.read_file(os.path.join(DATASET_DIR, "buildings.geojson"))
buildings = buildings.set_crs(4326, allow_override=True)

building_type_map = {
    "commercial": "commercial", "retail": "commercial", "office": "commercial",
    "hotel": "commercial", "mall": "commercial",
    "hospital": "anchor", "university": "anchor", "college": "anchor",
    "school": "anchor", "train_station": "anchor", "stadium": "anchor",
    "sports_centre": "anchor",
    "industrial": "industrial", "warehouse": "industrial", "depot": "industrial",
    "residential": "residential", "apartments": "residential",
    "house": "residential", "bungalow": "residential",
    "yes": "generic",
}

buildings["building_type"] = buildings["building"].map(building_type_map)

# Drop irrelevant buildings (beach_hut, yurt, cowshed etc)
buildings = buildings[buildings["building_type"].notna()].copy()

# Calculate area in sqm using UTM Zone 43N (meters-based CRS for Gujarat)
buildings_utm = buildings.to_crs(32643)
buildings["area_sqm"] = buildings_utm.geometry.area.round(1)

buildings_df = buildings[["building_type", "area_sqm", "geometry"]].copy()

buildings_df.to_postgis("buildings", engine, if_exists="replace", index=False)
print(f"✅ buildings table: {len(buildings_df)} rows")

