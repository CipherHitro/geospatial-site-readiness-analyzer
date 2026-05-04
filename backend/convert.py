import osmnx as ox
import geopandas as gpd

GRAPHML_PATH = "dataset/ahmedabad_roads.graphml"
OUTPUT_PATH = "dataset/roads.geojson"

print("Loading GraphML...")
G = ox.load_graphml(GRAPHML_PATH)

print("Converting to GeoDataFrame...")
edges = ox.graph_to_gdfs(G, nodes=False)

edges = edges[['highway', 'length', 'geometry']]

print("Saving as GeoJSON...")
edges.to_file(OUTPUT_PATH, driver="GeoJSON")

print("✅ roads.geojson created successfully")