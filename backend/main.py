from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models.spatial   # import so SQLAlchemy registers the table classes

from routers import transport
from routers import zoning
from routers import demographics, transport, isochrone, poi, environment
from routers import h3 as h3_router
from routers import score as score_router
from routers import site as site_router
from routers import hotspots
from routers import ai as ai_router

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
app.include_router(h3_router.router)   # GET /api/h3/grid, POST /api/h3/cell
app.include_router(environment.router) # GET /api/environment/grid, POST /api/environment/score
app.include_router(score_router.router)  # GET /api/score/presets
app.include_router(site_router.router)
app.include_router(hotspots.router)

app.include_router(ai_router.router)     # POST /api/ai/compare
# app.include_router(poi.router)

@app.get("/health")
def health():
    return {"status": "ok"}