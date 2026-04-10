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