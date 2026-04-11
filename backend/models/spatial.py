from sqlalchemy import Column, Integer, String, Float, Boolean
from geoalchemy2 import Geometry   # pip install geoalchemy2
from database import Base

# These mirror your existing PostGIS tables
# SQLAlchemy reads them — does NOT recreate if they already exist

class BusStop(Base):
    __tablename__ = "bus_stops"
    id       = Column(Integer, primary_key=True)
    name     = Column(String)
    geometry = Column(Geometry("POINT", srid=4326))

class Station(Base):
    __tablename__ = "stations"
    id       = Column(Integer, primary_key=True)
    name     = Column(String)
    geometry = Column(Geometry("POINT", srid=4326))

class Road(Base):
    __tablename__ = "roads"
    id       = Column(Integer, primary_key=True)
    name     = Column(String)
    geometry = Column(Geometry("LINESTRING", srid=4326))


class PopulationGrid(Base):
    __tablename__ = "population_grid"
    id         = Column(Integer, primary_key=True)
    population = Column(Float)
    geometry   = Column(Geometry("GEOMETRY", srid=4326))

class Zone(Base):
    __tablename__ = "zones"
    id                = Column(Integer, primary_key=True)
    zone_type         = Column(String)
    allows_commercial = Column(Boolean)
    geometry          = Column(Geometry("GEOMETRY", srid=4326))

class Building(Base):
    __tablename__ = "buildings"
    id            = Column(Integer, primary_key=True)
    building_type = Column(String)
    area_sqm      = Column(Float)
    geometry      = Column(Geometry("GEOMETRY", srid=4326))


class PoiLocation(Base):
    __tablename__ = "poi_locations"
    id            = Column(Integer, primary_key=True)
    name          = Column(String)
    category      = Column(String)
    poi_type      = Column(String)
    geometry      = Column(Geometry("POINT", srid=4326))