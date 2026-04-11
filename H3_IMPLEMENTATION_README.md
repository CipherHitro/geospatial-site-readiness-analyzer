# H3 Hexagonal Grid Implementation Guide

This document explains the comprehensive implementation of the Geospatial H3 Grid functionality in the Site Readiness Analyzer. The implementation relies on Uber's H3 indexing system alongside PostGIS for efficient spatial querying, moving seamlessly from the database up to the React MapLibre frontend.

---

## 1. Database Layer (PostGIS)

The core foundation relies on the `h3_grid` table sitting within a PostgreSQL database with the PostGIS extension enabled.

### **Table Schema**
The `h3_grid` table is seeded with fixed resolution H3 indices (e.g., resolution size 8 or 9) covering the analysis area (Ahmedabad). Key columns include:
- `h3_index`: Text string representing the unique Uber H3 hexagonal identifier.
- `geometry`: PostGIS spatial column (`ST_Polygon`) holding the physical boundary coordinates.
- **Demographics**: `population`, `child_0_18`, `youth_19_25`, `adult_26_45`, `senior_46_60`, `senior_citizen_60plus`.
- **Socio-Economic & Risks**: `est_per_capita_inr`, `flood_score`.

### **Seeding Strategy**
Scripts such as `seed_postgre.py` iterate through localized CSVs (like `FLood_score.csv` or enriched Indian demographic files), converting raw H3 strings into geometries and performing bulk inserts into the table to rapidly establish the spatial grid bounds.

---

## 2. Backend Layer (Python / FastAPI)

The FastAPI backend interacts with PostGIS using SQLAlchemy to calculate aggregations and perform spatial-point intersections.

### **Services (`h3_service.py`)**

1. **`get_all_h3_grid()`**:
   - Queries the entire `h3_grid` table.
   - Computes spatial representation via `ST_AsGeoJSON(geometry)`.
   - Structures everything into a standard GeoJSON `FeatureCollection` format containing node properties (population, flood scores, age groups).
   
2. **`get_h3_cell_for_point(lat, lng)`**:
   - Accepts a specific geographic point.
   - Performs a spatial Point-in-Polygon query using PostGIS: `ST_Contains(geometry, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)) LIMIT 1`.
   - Returns rich statistics explicitly related to *that specific hexagon*.

### **Routers & API Endpoints (`routers/h3.py`)**

- **GET `/api/h3/grid`**: Returns the massive GeoJSON network of hexagons for frontend batch rendering.
- **POST `/api/h3/cell`**: Returns a specific hexagon's metrics required by UI Popups when selecting an area on the map.

---

## 3. Frontend Layer (React / MapLibre)

The frontend is responsible for fetching these GeoJSON files and applying hardware-accelerated "data-driven styling."

### **State Tracking (`App.jsx`)**
When the user toggles a layer that relies on the H3 Grid (like `H3 Grid Overlay` or `Environmental Risk`), an effect hook conditionally requests the network grid:
```javascript
  useEffect(() => {
    if ((activeLayers.h3grid || activeLayers.risk) && !h3GridData) {
      fetch('http://localhost:8000/api/h3/grid')
        .then(r => r.json())
        .then(data => setH3GridData(data));
    }
  }, [activeLayers.h3grid, activeLayers.risk]);
```

### **Map Visualization (`MapComponent.jsx`)**

The GeoJSON is passed into a react-map-gl `<Source>` component, making the data accessible. It utilizes MapBox/MapLibre's **interpolated paint properties** dynamically color shading each hexagon based on an extracted parameter.

**Population Mapping:**
```javascript
  'fill-color': [
    'interpolate', ['linear'],
    ['get', 'population'],
    0, '#1a1b26',
    32000, '#fbbf24'
  ]
```

**Environmental Risk Mapping:**
```javascript
  'fill-color': [
    'interpolate', ['linear'],
    ['get', 'flood_score'],
    0, '#3fb950', // Safe
    100, '#8b0000' // High risk
  ]
```

### **Interactivity (Popups & Highlighting)**
- **Highlighting**: When a user clicks a point on the map, `App.jsx` shoots a POST request to `/api/h3/cell`. The returned localized H3 boundary is loaded as `h3CellHighlightGeoJSON`, drawing a thick bordered ring around the active hex.
- **Hover Popups**:
   - `onMouseEnter` registers the map element being moused over (`layer_risk`, `h3_cell_highlight_fill`), assigning the logical `setRiskHover(true)` or `setDemoHover(true)`.
   - Conditionally drawn React `<Popup>` components extract properties directly from `h3CellDetail` containing `h3_index`, `flood_score`, and segmented `age_distribution_pct` to give real-time tooltip feedback.
