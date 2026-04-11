from sqlalchemy import Column, Integer, String, Float
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


class H3Grid(Base):
    __tablename__ = "h3_grid"
    h3_index             = Column(String, primary_key=True)
    population           = Column(Float)
    lat                  = Column(Float)
    lon                  = Column(Float)
    child_0_18           = Column(Integer)
    youth_19_25          = Column(Integer)
    adult_26_45          = Column(Integer)
    senior_46_60         = Column(Integer)
    senior_citizen_60plus = Column(Integer)
    est_per_capita_inr   = Column(Float)
    flood_score          = Column(Float)
    geometry             = Column(Geometry("POLYGON", srid=4326))