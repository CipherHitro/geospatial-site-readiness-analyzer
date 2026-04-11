import geopandas as gpd
import pandas as pd
from sqlalchemy import create_engine
import os
import numpy as np
from shapely.geometry import Point
from database import DATABASE_URL

engine = create_engine(DATABASE_URL)

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



def _detect_population_column(df: gpd.GeoDataFrame) -> str:
	preferred = [
		"population",
		"pop",
		"population_count",
		"population_sum",
		"pop_total",
		"total_population",
	]
	for col in preferred:
		if col in df.columns:
			return col

	numeric_cols = [
		col for col in df.columns
		if col != "geometry" and pd.api.types.is_numeric_dtype(df[col])
	]
	if not numeric_cols:
		raise ValueError("No numeric population column found in Kontur dataset")

	return numeric_cols[0]


# Import Kontur population polygons
population_path = os.path.join(DATASET_DIR, "kontur_population_IN_20231101.gpkg")
population = gpd.read_file(population_path)

if population.crs is None:
	population = population.set_crs(epsg=4326)
else:
	population = population.to_crs(epsg=4326)

population_col = _detect_population_column(population)
population = population[[population_col, "geometry"]].rename(columns={population_col: "population"})
population["population"] = pd.to_numeric(population["population"], errors="coerce").fillna(0)
population = population[population.geometry.notnull() & ~population.geometry.is_empty]
population.to_postgis("population_grid", engine, if_exists="replace", index=False)


# ── POI LOCATIONS ────────────────────────────────────────────────
anchors_path = os.path.join(DATASET_DIR, "anchors.geojson")
if os.path.exists(anchors_path):
	anchors_gdf = gpd.read_file(anchors_path)
	anchors_gdf = anchors_gdf[["name", "category", "poi_type", "geometry"]].copy()
	anchors_gdf = anchors_gdf.set_crs(4326, allow_override=True)

	print(f"📍 Anchors loaded: {len(anchors_gdf)} rows")

	# Ahmedabad bounding box
	LAT_MIN, LAT_MAX = 22.87, 23.13
	LNG_MIN, LNG_MAX = 72.45, 72.65

	def random_points_in_ahmedabad(n):
		"""Generate n random Point geometries within the Ahmedabad bbox."""
		lats = np.random.uniform(LAT_MIN, LAT_MAX, n)
		lngs = np.random.uniform(LNG_MIN, LNG_MAX, n)
		return [Point(lng, lat) for lng, lat in zip(lngs, lats)]

	competitor_categories = [
		"retail_store", "restaurant", "pharmacy", "gym",
		"salon", "electronics_shop", "clothing_store", "cafe",
	]

	np.random.seed(42)
	N_COMPETITORS = 800

	competitor_rows = []
	for _ in range(N_COMPETITORS):
		competitor_rows.append({
			"name":     f"Business_{np.random.randint(1000, 9999)}",
			"category": np.random.choice(competitor_categories),
			"poi_type": "competitor",
			"geometry": random_points_in_ahmedabad(1)[0],
		})

	competitors_gdf = gpd.GeoDataFrame(competitor_rows, crs=4326)
	print(f"🏪 Competitors generated: {len(competitors_gdf)} rows")

	complementary_categories = [
		"office_building", "hotel", "cinema", "park",
		"bus_terminal", "market", "food_court", "parking_lot",
	]

	N_COMPLEMENTARY = 600

	complementary_rows = []
	for _ in range(N_COMPLEMENTARY):
		complementary_rows.append({
			"name":     f"Place_{np.random.randint(1000, 9999)}",
			"category": np.random.choice(complementary_categories),
			"poi_type": "complementary",
			"geometry": random_points_in_ahmedabad(1)[0],
		})

	complementary_gdf = gpd.GeoDataFrame(complementary_rows, crs=4326)
	print(f"🏢 Complementary generated: {len(complementary_gdf)} rows")

	all_poi = pd.concat([
		anchors_gdf,          # real OSM data
		competitors_gdf,      # synthetic
		complementary_gdf,    # synthetic
	], ignore_index=True)

	all_poi_gdf = gpd.GeoDataFrame(all_poi, crs=4326)
	all_poi_gdf.to_postgis("poi_locations", engine, if_exists="replace", index=False)

	print(f"\n✅ poi_locations table: {len(all_poi_gdf)} rows")
else:
	print("\n⚠️ anchors.geojson not found. Skipping POI seeding.")

