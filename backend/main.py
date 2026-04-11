from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models.spatial   # import so SQLAlchemy registers the table classes

from routers import transport
from routers import zoning
from routers import demographics, transport, isochrone, poi

# from routers import demographics, poi, score  ← add as you build more layers

# Auto-create any NEW tables defined in models/ that don't exist yet
# Your existing bus_stops / stations / roads tables are untouched
Base.metadata.create_all(bind=engine)

app = FastAPI(title="GeoSpatial Site Readiness API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local hackathon dev
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transport.router)
app.include_router(zoning.router)
# app.include_router(demographics.router)   ← plug in as you build
app.include_router(demographics.router)
app.include_router(isochrone.router)   # GET /api/catchment-direct
app.include_router(poi.router)         # POST /api/poi/score

@app.get("/health")
def health():
    return {"status": "ok"}