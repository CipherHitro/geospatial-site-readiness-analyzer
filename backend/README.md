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

### 5. Run the Application
Start the Uvicorn development server:
```bash
uvicorn main:app --reload --port 8000
```
Your backend will now be actively running at `http://127.0.0.1:8000`. 
Check FastAPI interactive docs at `http://127.0.0.1:8000/docs`.