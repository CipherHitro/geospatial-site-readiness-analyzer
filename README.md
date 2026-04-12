# Geospatial Site Readiness Analyzer

A comprehensive geospatial analytics platform designed to evaluate and score potential sites across Ahmedabad for various use cases (Retail, EV Charging, Warehousing, Telecom, and Energy). The system leverages Uber's H3 Hexagonal Hierarchical Spatial Index, advanced PostGIS queries, and predictive AI modeling to provide deep insights into localized demographics, transportation access, competitive POIs, zoning, and environmental risk.

## 🌟 Features

- **Interactive Layers:** Toggle layers for Demographics, Transportation (roads/stations), Risk factors (Flood/AQI), Landuse, and POIs.
- **H3 Hotspot Analysis:** Hexagon-based heatmaps showing composite scores and individual metric breakdowns for specific use cases.
- **Catchment Area (Isochrone) Analysis:** Visualize reachable areas within specific timeframes via walking, cycling, or driving.
- **AI Site Orchestrator:** Intelligent insights automatically synthesized based on raw geospatial metrics for any clicked location.
- **Detailed Scoring System:** 100-point composite scoring dynamically generated from:
  - Demographics (population, age grouping, income)
  - Transportation Infrastructure
  - Points of Interest / Competition 
  - Environment / Risk profiles
  - Zoning & Building classifications

## 🛠️ Tech Stack

- **Frontend:** React, Vite, MapLibre GL JS
- **Backend:** Python, FastAPI, SQLAlchemy, asyncpg, H3 (v4)
- **Database:** PostgreSQL with the PostGIS extension 
- **Geodata Processing:** GeoPandas, Shapely

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v18+ recommended)
- Python 3.12+
- PostgreSQL (with PostGIS extension installed and running)

### 1. Backend Setup

The backend serves the FastAPI APIs and calculates geospatial scores on the fly.

```bash
# Navigate to the backend directory
cd backend

# Create and activate a python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install the required dependencies
pip install -r requirement.txt

# Configure your database
# Ensure your PostgreSQL instance is running with PostGIS.
# You will need to load schema.sql and seed the data first:
# psql -U your_user -d your_db -f schema.sql
# python seed_postgre.py

# Run the background H3 hotspot grid builder (optional/if needed)
python script/build_hotspot_grid.py

# Start the FastAPI server
fastapi dev main.py 
# OR: uvicorn main:app --reload
```
*The backend API will run at `http://localhost:8000`*

### 2. Frontend Setup

The frontend provides the interactive map interface and analysis dashboard.

```bash
# Open a new terminal and navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```
*The frontend will run at `http://localhost:5173` (or the port specified by Vite).*

---

## 🗺️ How to Use
1. Open the frontend in your browser.
2. Select a targeted **Use Case** at the top of the map (e.g., Retail, EV Charging).
3. Toggle different map **Layers** via the sidebar to view zoning, POIs, demographic areas, or transportation.
4. Click anywhere on the map to place a pin. The system will retrieve backend data and display a detailed scorecard of the site.
5. In the **Analysis** tab, click **Run Hotspot Clustering** to overlay pre-calculated H3 scores over the entire city, letting you easily identify prime high-scoring locations. Hover over hexagons to see detailed breakdowns.
