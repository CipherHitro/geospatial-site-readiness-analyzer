import geopandas as gpd
import pandas as pd
from sqlalchemy import create_engine
import os
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
