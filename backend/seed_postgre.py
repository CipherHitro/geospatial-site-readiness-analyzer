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
