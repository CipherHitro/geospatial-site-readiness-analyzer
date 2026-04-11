CREATE INDEX IF NOT EXISTS idx_zones_geom     ON zones     USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_buildings_geom ON buildings USING GIST(geometry);