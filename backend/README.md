# Geospatial Backend

This is the FastAPI backend for the Geospatial project, which includes spatial calculations, routing, and scoring using PostgreSQL and the OpenRouteService API.

## Prerequisites

- Python 3.10+
- PostgreSQL
- [OpenRouteService (ORS) API Key](https://openrouteservice.org/dev/#/home)

## Installation Guide

### 1. Clone & Navigate
Navigate into the `backend` directory:
```bash
cd backend
```

### 2. Set up a Virtual Environment
Create and activate an isolated Python environment:
```bash
python3 -m venv venv
source venv/bin/activate
```
*(On Windows: `venv\Scripts\activate`)*

### 3. Install Dependencies
Install all the required Python packages (from your freeze file):
```bash
pip install -r requirement.txt
```

### 4. Setup Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```
Open `.env` and fill in your database credentials and ORS API key:
- `DATABASE_URL`: Add your PostgreSQL connection URL.
- `ORS_API_KEY`: Your token from OpenRouteService.

### 5. Seed the Database
To populate your PostgreSQL database with the required geospatial data:
1. Ensure your PostgreSQL server has the **PostGIS** extension installed.
```bash
CREATE EXTENSION postgis;
```
2. Inside the `backend` directory, create a folder named `dataset` (if it doesn't exist).
3. Place your raw data files into the `backend/dataset/` folder:
   - `bus_stops.geojson`
   - `stations.geojson`
   - `ahmedabad_roads.graphml`
4. Run the seeding script. The script will automatically create the `postgis` extension in your database and insert the data:
```bash
python seed_postgre.py
```
*(Note: Ensure your `DATABASE_URL` is correctly set in your `.env` file first).*

### 6. Run the Application
Start the Uvicorn development server:
```bash
uvicorn main:app --reload --port 8000
```
Your backend will now be actively running at `http://127.0.0.1:8000`. 
Check FastAPI interactive docs at `http://127.0.0.1:8000/docs`.