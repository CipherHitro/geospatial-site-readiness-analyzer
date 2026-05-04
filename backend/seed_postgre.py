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
print("Importing bus stops...")
bus_stops = gpd.read_file(os.path.join(DATASET_DIR, "bus_stops.geojson"))
bus_stops = bus_stops[['name', 'geometry']]  # keep only what matters
bus_stops.to_postgis("bus_stops", engine, if_exists='replace')
print("✅ bus_stops table seeded")

# Import stations
print("Importing stations...")
stations = gpd.read_file(os.path.join(DATASET_DIR, "stations.geojson"))
stations = stations[['name', 'geometry']]
stations.to_postgis("stations", engine, if_exists='replace')
print("✅ stations table seeded")

# Roads — convert graphml to GeoDataFrame first
# Roads — load directly from pre-generated GeoJSON
print("Importing roads from geojson...")

roads = gpd.read_file(os.path.join(DATASET_DIR, "roads.geojson"))
roads = roads[['highway', 'length', 'geometry']]

roads.to_postgis("roads", engine, if_exists='replace', chunksize=1000)

print("✅ roads table seeded")  

# ── ZONES & BUILDINGS from Unified H3 Grid Dataset ────────────────
print("Importing unified zoning/building data from full dataset...")
unified_data = gpd.read_file(os.path.join(DATASET_DIR, "full_city_zoning_with_h3_grids.geojson"))
unified_data = unified_data.set_crs(4326, allow_override=True)

# 1. ZONES (extract where 'landuse' is present)
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

if 'landuse' in unified_data.columns:
    landuse = unified_data[unified_data['landuse'].notna()].copy()
    if not landuse.empty:
        landuse["zone_type"] = landuse["landuse"].map(zone_map).fillna("other")
        landuse["allows_commercial"] = landuse["zone_type"] == "commercial"
        zones_df = landuse[["zone_type", "allows_commercial", "geometry"]].copy()
        zones_df.to_postgis("zones", engine, if_exists="replace", index=False)
        print(f"✅ zones table: {len(zones_df)} rows")
    else:
        print("⚠️ No landuse features found in the dataset.")

# 2. BUILDINGS (extract where 'building' is present)
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

if 'building' in unified_data.columns:
    buildings = unified_data[unified_data['building'].notna()].copy()
    buildings["building_type"] = buildings["building"].map(building_type_map)
    # Drop irrelevant buildings (beach_hut, yurt, cowshed etc)
    buildings = buildings[buildings["building_type"].notna()].copy()
    
    # Calculate area in sqm using UTM Zone 43N (meters-based CRS for Gujarat)
    buildings_utm = buildings.to_crs(32643)
    buildings["area_sqm"] = buildings_utm.geometry.area.round(1)
    
    buildings_df = buildings[["building_type", "area_sqm", "geometry"]].copy()
    buildings_df.to_postgis("buildings", engine, if_exists="replace", index=False)
    print(f"✅ buildings table: {len(buildings_df)} rows")


# def _detect_population_column(df: gpd.GeoDataFrame) -> str:
# 	preferred = [
# 		"population",
# 		"pop",
# 		"population_count",
# 		"population_sum",
# 		"pop_total",
# 		"total_population",
# 	]
# 	for col in preferred:
# 		if col in df.columns:
# 			return col

# 	numeric_cols = [
# 		col for col in df.columns
# 		if col != "geometry" and pd.api.types.is_numeric_dtype(df[col])
# 	]
# 	if not numeric_cols:
# 		raise ValueError("No numeric population column found in Kontur dataset")

# 	return numeric_cols[0]


# population_col = _detect_population_column(population)
# population = population[[population_col, "geometry"]].rename(columns={population_col: "population"})
# population["population"] = pd.to_numeric(population["population"], errors="coerce").fillna(0)
# population = population[population.geometry.notnull() & ~population.geometry.is_empty]
# population.to_postgis("population_grid", engine, if_exists="replace", index=False)



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



# ── H3 HEXAGONAL GRID ──────────────────────────────────────────
# Reads the 443 unique H3 cells from ahmedabad_h3_with_demography.csv,
# converts each H3 index to its hexagonal boundary polygon using the h3
# library, and seeds the h3_grid PostGIS table.


import h3
from shapely.geometry import Polygon

h3_csv_path = os.path.join(DATASET_DIR, "ahmedabad_h3_with_demography.csv")
h3_df = pd.read_csv(h3_csv_path)

flood_csv_path = os.path.join(DATASET_DIR, "flood_score.geojson")
if os.path.exists(flood_csv_path):
    flood_df = gpd.read_file(flood_csv_path)
    # Merge on the 'h3' column
    h3_df = h3_df.merge(flood_df[['h3', 'flood_score']], on='h3', how='left')
    h3_df['flood_score'] = pd.to_numeric(h3_df['flood_score'], errors='coerce').fillna(0)
else:
    h3_df['flood_score'] = 0.0

# Build hexagonal boundary polygons from H3 indices
hex_polygons = []
for _, row in h3_df.iterrows():
    h3_index = row["h3"]
    # h3.cell_to_boundary returns list of (lat, lng) tuples
    boundary = h3.cell_to_boundary(h3_index)
    # Convert to (lng, lat) for GeoJSON/Shapely and close the ring
    coords = [(lng, lat) for lat, lng in boundary]
    coords.append(coords[0])
    hex_polygons.append(Polygon(coords))

h3_gdf = gpd.GeoDataFrame(
    {
        "h3_index":              h3_df["h3"],
        "population":            pd.to_numeric(h3_df["population"], errors="coerce").fillna(0),
        "lat":                   h3_df["lat"],
        "lon":                   h3_df["lon"],
        "child_0_18":            h3_df["child_0_18"],
        "youth_19_25":           h3_df["youth_19_25"],
        "adult_26_45":           h3_df["adult_26_45"],
        "senior_46_60":          h3_df["senior_46_60"],
        "senior_citizen_60plus": h3_df["senior_citizen_60plus"],
        "est_per_capita_inr":    pd.to_numeric(h3_df["est_per_capita_inr"], errors="coerce").fillna(0),
        "flood_score":           h3_df["flood_score"],
    },
    geometry=hex_polygons,
    crs="EPSG:4326",
)

h3_gdf.to_postgis("h3_grid", engine, if_exists="replace", index=False)
print(f"✅ h3_grid table: {len(h3_gdf)} rows ({len(h3_gdf)} hexagonal cells)")