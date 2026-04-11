CREATE INDEX IF NOT EXISTS idx_zones_geom     ON zones     USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_buildings_geom ON buildings USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_poi_locations_geom ON poi_locations USING GIST(geometry);
