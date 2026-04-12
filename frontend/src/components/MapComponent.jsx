import React, { useRef, useState, useEffect, useCallback } from 'react';
import Map, { NavigationControl, Source, Layer, Marker, Popup } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import SearchBox from './SearchBox';

const AGE_COLORS = {
  'child_0_18': '#58a6ff',
  'youth_19_25': '#3fb950',
  'adult_26_45': '#d29922',
  'senior_46_60': '#e3883e',
  'senior_citizen_60plus': '#f85149',
};

const AGE_LABELS = {
  'child_0_18': 'Children (0–18)',
  'youth_19_25': 'Youth (19–25)',
  'adult_26_45': 'Adults (26–45)',
  'senior_46_60': 'Seniors (46–60)',
  'senior_citizen_60plus': 'Elders (60+)',
};

export default function MapComponent({ activeLayers = {}, onMapClick, hotspotsData, catchmentData, mapInfrastructure, demographicsDetail, zoningDetail, poiDetail, environmentDetail, scoreData, theme, lastClicked, h3GridData, envGridData, h3CellDetail }) {
  const mapRef = useRef(null);

  const [viewState, setViewState] = useState({
    longitude: 72.5714,
    latitude: 23.0225,
    zoom: 11,
    pitch: 45
  });

  const [layerData, setLayerData] = useState({});
  const [hoverInfo, setHoverInfo] = useState(null);
  const [demoHover, setDemoHover] = useState(false);
  const [zoningHover, setZoningHover] = useState(false);

  // Removed 1km circle logic

  const BUILDING_COLORS = { 'commercial': '#3fb950', 'anchor': '#a371f7', 'residential': '#58a6ff', 'generic': '#8b949e' };
  const ZONE_COLORS = { 'commercial': '#3fb950', 'residential': '#58a6ff', 'industrial': '#d29922', 'restricted': '#f85149' };

  // Calculate coordinates East of the clicked point to anchor the popup
  const zoningPopupCoords = React.useMemo(() => {
    if (!lastClicked) return null;
    const kmPerLng = 40075 * Math.cos(lastClicked.lat * Math.PI / 180) / 360;
    return {
      lat: lastClicked.lat,
      lng: lastClicked.lng + (0.3 / kmPerLng)
    };
  }, [lastClicked]);

  // Helper to create 500m circle for POI
  const poiCircleGeoJSON = React.useMemo(() => {
    if (!lastClicked || !activeLayers.poi || !poiDetail) return null;
    const points = 64;
    const coords = [];
    const radiusKm = 0.5; // 500 meters
    const kmPerLat = 111.32;
    const kmPerLng = 40075 * Math.cos(lastClicked.lat * Math.PI / 180) / 360;

    for (let i = 0; i < points; i++) {
      const angle = (i * 360) / points;
      const dx = radiusKm * Math.cos(angle * Math.PI / 180);
      const dy = radiusKm * Math.sin(angle * Math.PI / 180);
      coords.push([
        lastClicked.lng + (dx / kmPerLng),
        lastClicked.lat + (dy / kmPerLat)
      ]);
    }
    coords.push(coords[0]);
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] }
      }]
    };
  }, [lastClicked, activeLayers.poi, poiDetail]);

  // Calculate coordinates 1020m West of the clicked point for Demographics
  const demoPopupCoords = React.useMemo(() => {
    if (!lastClicked) return null;
    const kmPerLng = 40075 * Math.cos(lastClicked.lat * Math.PI / 180) / 360;
    return {
      lat: lastClicked.lat,
      lng: lastClicked.lng - (0.3 / kmPerLng)
    };
  }, [lastClicked]);

  // Calculate coordinates South of the clicked point for Environmental Risk
  const riskPopupCoords = React.useMemo(() => {
    if (!lastClicked) return null;
    return {
      lat: lastClicked.lat - 0.003,
      lng: lastClicked.lng
    };
  }, [lastClicked]);

  // H3 cell highlight GeoJSON — show the hex boundary of the active cell
  const h3CellHighlightGeoJSON = React.useMemo(() => {
    if (!h3CellDetail || !h3CellDetail.geometry) return null;
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: h3CellDetail.geometry,
        properties: { h3_index: h3CellDetail.h3_index }
      }]
    };
  }, [h3CellDetail]);

  // Removed 500m zoning circle logic
  const handleSearchSelect = useCallback((lat, lon) => {
    const map = mapRef.current?.getMap?.();
    if (map) {
      map.flyTo({ center: [lon, lat], zoom: 15, duration: 1800, essential: true });
    }
    // Trigger scoring automatically
    if (onMapClick) {
      onMapClick({ lat, lng: lon });
    }
  }, [onMapClick]);

  useEffect(() => {
    const fetchLayer = async (name) => {
      if (!layerData[name]) {
        try {
          const res = await fetch(`http://localhost:8000/api/layers/${name}`);
          const geojson = await res.json();
          setLayerData(prev => ({ ...prev, [name]: geojson }));
        } catch (e) {
          console.error(`Failed to fetch ${name}`, e);
        }
      }
    };

    Object.keys(activeLayers).forEach(key => {
      if (activeLayers[key] && key !== 'h3grid') fetchLayer(key);
    });
  }, [activeLayers]);

  return (
    <div className="map-container">
      <SearchBox onSelect={handleSearchSelect} />
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={(e) => onMapClick && onMapClick(e.lngLat)}
        mapLib={maplibregl}
        mapStyle={theme === 'light' ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"}
        ref={mapRef}
        interactiveLayerIds={[
          'layer_demographics',
          'layer_landuse',
          'layer_risk',
          'h3_cell_highlight_fill',
          'layer_poi',
          'layer_dynamic_poi'
        ]}
        onMouseEnter={(e) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const lid = feature.layer.id;

            if (lid === 'h3_cell_highlight_fill') {
              setDemoHover(true);
              setZoningHover(true);
            }
          }
        }}
        onMouseLeave={() => { setDemoHover(false); setZoningHover(false); }}
      >
        <NavigationControl position="bottom-right" />

        {lastClicked && (
          <Marker
            longitude={lastClicked.lng}
            latitude={lastClicked.lat}
            color="#f85149"
            anchor="bottom" />
        )}

        {/* ── H3 GRID OVERLAY (toggle-able) ── */}
        {activeLayers.h3grid && h3GridData && (
          <Source id="h3_grid_src" type="geojson" data={h3GridData}>
            <Layer
              id="h3_grid_fill"
              type="fill"
              paint={{
                'fill-color': [
                  'interpolate', ['linear'],
                  ['get', 'population'],
                  0, '#1a1b26',
                  1000, '#1e3a5f',
                  5000, '#2563eb',
                  15000, '#7c3aed',
                  25000, '#dc2626',
                  32000, '#fbbf24'
                ],
                'fill-opacity': 0.25
              }}
            />
            <Layer
              id="h3_grid_line"
              type="line"
              paint={{
                'line-color': '#79c0ff',
                'line-width': 1,
                'line-opacity': 0.5
              }}
            />
          </Source>
        )}

        {/* ── H3 ACTIVE CELL HIGHLIGHT ── */}
        {h3CellHighlightGeoJSON && (
          <Source id="h3_cell_highlight_src" type="geojson" data={h3CellHighlightGeoJSON}>
            <Layer
              id="h3_cell_highlight_fill"
              type="fill"
              paint={{
                'fill-color': '#79c0ff',
                'fill-opacity': 0.2
              }}
            />
            <Layer
              id="h3_cell_highlight_line"
              type="line"
              paint={{
                'line-color': '#79c0ff',
                'line-width': 2.5,
                'line-opacity': 0.9
              }}
            />
          </Source>
        )}

        {/* DEMOGRAPHICS POPUP — enhanced with H3 cell age distribution */}
        {activeLayers.demographics && demographicsDetail && lastClicked && (demoHover || !scoreData) && (
          <Popup
            longitude={demoPopupCoords.lng}
            latitude={demoPopupCoords.lat}
            anchor="bottom-right"
            offset={40}
            closeButton={false}
            className="demographic-popup-map"
          >
            <div className="demo-popup-content">
              <div className="demo-popup-header">{demographicsDetail.neighborhood}</div>
              <div className="demo-popup-body">
                <div className="demo-popup-row">
                  <span className="demo-popup-label">Population:</span>
                  <span className="demo-popup-value">{demographicsDetail.population.toLocaleString()}</span>
                </div>
                {demographicsDetail.people_grouping && Object.entries(demographicsDetail.people_grouping).map(([group, pct]) => (
                  <div className="demo-popup-row" key={group}>
                    <span className="demo-popup-label">{group.replace(/_/g, ' ')}:</span>
                    <span className="demo-popup-value">{pct}%</span>
                  </div>
                ))}

                {/* H3 Cell Age Distribution */}
                {(h3CellDetail || (demographicsDetail.h3_cell && demographicsDetail.h3_cell.age_distribution_pct)) && (() => {
                  const agePct = h3CellDetail?.age_distribution_pct || demographicsDetail.h3_cell?.age_distribution_pct;
                  const cellPop = h3CellDetail?.population || demographicsDetail.h3_cell?.population;
                  if (!agePct) return null;
                  return (
                    <>
                      <div className="zoning-divider"></div>
                      <div className="zoning-section-label">Age Distribution (H3 Cell)</div>
                      {cellPop != null && (
                        <div className="demo-popup-row">
                          <span className="demo-popup-label">Cell Population:</span>
                          <span className="demo-popup-value">{Number(cellPop).toLocaleString()}</span>
                        </div>
                      )}
                      {Object.entries(agePct).map(([key, pct]) => (
                        <div className="age-dist-row" key={key}>
                          <span className="age-dist-label">
                            <span className="age-dist-dot" style={{ background: AGE_COLORS[key] || '#8b949e' }}></span>
                            {AGE_LABELS[key] || key}
                          </span>
                          <div className="age-dist-bar-track">
                            <div className="age-dist-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: AGE_COLORS[key] || '#8b949e' }}></div>
                          </div>
                          <span className="age-dist-val">{pct}%</span>
                        </div>
                      ))}
                      {(h3CellDetail?.est_per_capita_inr || demographicsDetail.h3_cell?.est_per_capita_inr) && (
                        <div className="demo-popup-row" style={{ marginTop: 4 }}>
                          <span className="demo-popup-label">Per Capita Income:</span>
                          <span className="demo-popup-value">₹{Number(h3CellDetail?.est_per_capita_inr || demographicsDetail.h3_cell?.est_per_capita_inr).toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </Popup>
        )}

        {/* ENVIRONMENTAL RISK POPUP */}
        {activeLayers.risk && h3CellDetail && lastClicked && (
          <Popup
            longitude={riskPopupCoords.lng}
            latitude={riskPopupCoords.lat}
            anchor="top"
            offset={40}
            closeButton={false}
            className="zoning-popup-map"
          >
            <div className="demo-popup-content">
              <div className="zoning-popup-header">
                <span>Environmental Risk</span>
                <span className={`zoning-badge ${environmentDetail.flood_score > 50 || (environmentDetail.aqi && environmentDetail.aqi > 150) ? 'zoning-badge--no' : 'zoning-badge--ok'}`}>
                  {environmentDetail.flood_score > 50 ? 'High Risk' : 'Low Risk'}
                </span>
              </div>
              <div className="demo-popup-body">
                {environmentDetail.flood_score !== undefined && (
                  <div className="demo-popup-row">
                    <span className="demo-popup-label">Flood Risk Score:</span>
                    <span className="demo-popup-value">{Number(environmentDetail.flood_score).toFixed(1)} / 100</span>
                  </div>
                )}
                {environmentDetail.aqi !== null && environmentDetail.aqi !== undefined && (
                  <>
                    <div className="demo-popup-row">
                      <span className="demo-popup-label">Live AQI:</span>
                      <span className="demo-popup-value">{environmentDetail.aqi} ({environmentDetail.aqi_level})</span>
                    </div>
                    {environmentDetail.dominant_pollutant && (
                      <div className="demo-popup-row">
                        <span className="demo-popup-label">Pollutant:</span>
                        <span className="demo-popup-value" style={{ textTransform: 'uppercase' }}>{environmentDetail.dominant_pollutant}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="demo-popup-row">
                  <span className="demo-popup-label">H3 Cell:</span>
                  <span className="demo-popup-value">{environmentDetail.h3_index || "N/A"}</span>
                </div>
              </div>
            </div>
          </Popup>
        )}

        {/* ZONING POPUP */}
        {activeLayers.landuse && zoningDetail && lastClicked && (zoningHover || !scoreData) && (
          <Popup
            longitude={zoningPopupCoords.lng}
            latitude={zoningPopupCoords.lat}
            anchor="bottom-left"
            offset={40}
            closeButton={false}
            className="zoning-popup-map"
          >
            <div className="demo-popup-content">
              <div className="zoning-popup-header">
                <span>Land Use & Zoning</span>
                <span className={`zoning-badge ${zoningDetail.allows_commercial ? 'zoning-badge--ok' : 'zoning-badge--no'}`}>
                  {zoningDetail.allows_commercial ? '✅ Commercial' : '❌ No Commercial'}
                </span>
              </div>
              <div className="demo-popup-body">
                <div className="demo-popup-row">
                  <span className="demo-popup-label">Zone Type:</span>
                  <span className="demo-popup-value" style={{ textTransform: 'capitalize' }}>{zoningDetail.zone_type}</span>
                </div>
                <div className="demo-popup-row">
                  <span className="demo-popup-label">Buildings (Hexagon):</span>
                  <span className="demo-popup-value">{zoningDetail.building_count_500m}</span>
                </div>
                <div className="demo-popup-row">
                  <span className="demo-popup-label">Built-up Area:</span>
                  <span className="demo-popup-value">{Math.round(zoningDetail.total_built_area_sqm).toLocaleString()} sqm</span>
                </div>

                <div className="zoning-divider"></div>
                <div className="zoning-section-label">Building Distribution (Hexagon)</div>
                {zoningDetail.building_distribution_500m && Object.entries(zoningDetail.building_distribution_500m).map(([type, info]) => (
                  <div className="demo-popup-row" key={type}>
                    <span className="demo-popup-label" style={{ textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: BUILDING_COLORS[type.toLowerCase()] || '#8b949e' }}></span>
                      {type}:
                    </span>
                    <span className="demo-popup-value">{info.count} ({info.percentage}%)</span>
                  </div>
                ))}

                <div className="zoning-divider"></div>
                <div className="zoning-section-label">Zone Distribution (Hexagon)</div>
                {zoningDetail.zone_distribution_500m_pct && Object.entries(zoningDetail.zone_distribution_500m_pct).map(([zone, pct]) => (
                  <div className="demo-popup-row" key={zone}>
                    <span className="demo-popup-label" style={{ textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ZONE_COLORS[zone.toLowerCase()] || '#8b949e' }}></span>
                      {zone}:
                    </span>
                    <span className="demo-popup-value">{pct}%</span>
                  </div>
                ))}

                {/* H3 cell info in zoning popup */}
                {h3CellDetail && (
                  <>
                    <div className="zoning-divider"></div>
                    <div className="zoning-section-label">H3 Cell Info</div>
                    <div className="demo-popup-row">
                      <span className="demo-popup-label">Cell Population:</span>
                      <span className="demo-popup-value">{Number(h3CellDetail.population).toLocaleString()}</span>
                    </div>
                    <div className="demo-popup-row">
                      <span className="demo-popup-label">Per Capita Income:</span>
                      <span className="demo-popup-value">₹{Number(h3CellDetail.est_per_capita_inr).toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Popup>
        )}

        {/* ZONED AREAS (Polygons) rendering */}
        {activeLayers.landuse && zoningDetail && zoningDetail.zones_geojson && (
          <Source id="zones_geojson_src" type="geojson" data={zoningDetail.zones_geojson}>
            <Layer
              id="zones_geojson_fill"
              type="fill"
              paint={{
                'fill-color': [
                  'match',
                  ['get', 'type'],
                  'commercial', '#3fb950',
                  'residential', '#58a6ff',
                  'industrial', '#d29922',
                  'restricted', '#f85149',
                  '#8b949e'
                ],
                'fill-opacity': 0.3
              }}
            />
            <Layer
              id="zones_geojson_line"
              type="line"
              paint={{
                'line-color': [
                  'match',
                  ['get', 'type'],
                  'commercial', '#3fb950',
                  'residential', '#58a6ff',
                  'industrial', '#d29922',
                  'restricted', '#f85149',
                  '#8b949e'
                ],
                'line-width': 1.5,
                'line-opacity': 0.8
              }}
            />
          </Source>
        )}

        {/* POI HIGHLIGHT CIRCLE (500m) AND POINTS */}
        {poiCircleGeoJSON && (
          <Source id="poi_circle_src" type="geojson" data={poiCircleGeoJSON}>
            <Layer
              id="poi_circle_fill"
              type="fill"
              paint={{ 'fill-color': '#e3883e', 'fill-opacity': 0.1 }}
            />
            <Layer
              id="poi_circle_line"
              type="line"
              paint={{ 'line-color': '#e3883e', 'line-width': 1.5, 'line-dasharray': [2, 2] }}
            />
          </Source>
        )}

        {activeLayers.poi && poiDetail && poiDetail.features && (
          <Source id="poi_detail_points_src" type="geojson" data={{ type: 'FeatureCollection', features: poiDetail.features }}>
            <Layer
              id="poi_detail_points"
              type="circle"
              paint={{
                'circle-color': [
                  'match',
                  ['get', 'poi_type'],
                  'competitor', '#f85149',
                  'anchor', '#58a6ff',
                  'complementary', '#3fb950',
                  '#e3883e'
                ],
                'circle-radius': 6,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
              }}
            />
          </Source>
        )}

        {/* BUILDINGS rendering for Zoning Layer */}
        {activeLayers.landuse && zoningDetail && zoningDetail.buildings_geojson && (
          <Source id="buildings_geojson_src" type="geojson" data={zoningDetail.buildings_geojson}>
            <Layer
              id="buildings_geojson_fill"
              type="fill"
              paint={{
                'fill-color': [
                  'match',
                  ['get', 'type'],
                  'commercial', '#3fb950',
                  'anchor', '#a371f7',
                  'residential', '#58a6ff',
                  'generic', '#8b949e',
                  '#8b949e'
                ],
                'fill-opacity': 0.9
              }}
            />
            <Layer
              id="buildings_geojson_line"
              type="line"
              paint={{
                'line-color': '#000',
                'line-width': 0.5,
                'line-opacity': 0.5
              }}
            />
          </Source>
        )}

        {/* INFRASTRUCTURE rendering for Transport layer details */}
        {mapInfrastructure && mapInfrastructure.roads && (
          <Source id="infra_roads_src" type="geojson" data={{ type: "FeatureCollection", features: mapInfrastructure.roads.filter(r => r.geometry).map(r => ({ type: "Feature", geometry: r.geometry, properties: r })) }}>
            <Layer id="infra_roads_line" type="line" paint={{
              'line-color': [
                'match',
                ['get', 'highway'],
                ['motorway', 'motorway_link'], '#e63946',
                ['trunk', 'trunk_link'], '#e63946',
                ['primary', 'primary_link'], '#f4a261',
                ['secondary', 'secondary_link'], '#e9c46a',
                ['tertiary', 'tertiary_link'], '#2a9d8f',
                ['residential', 'living_street'], '#8ab17d',
                ['pedestrian', 'footway', 'path'], '#457b9d',
                '#a8dadc' // default line color
              ],
              'line-width': [
                'match',
                ['get', 'highway'],
                ['motorway', 'trunk', 'primary'], 4,
                ['secondary', 'tertiary'], 3,
                2 // default line width
              ],
              'line-opacity': 0.8
            }} />
          </Source>
        )}

        {mapInfrastructure && mapInfrastructure.busStops && mapInfrastructure.busStops.length > 0 && mapInfrastructure.busStops.filter(s => s.geometry).map((stop, i) => (
          <Marker key={`bus-${i}`} longitude={stop.geometry.coordinates[0]} latitude={stop.geometry.coordinates[1]} anchor="center">
            <div
              onClick={(e) => {
                e.stopPropagation();
                setHoverInfo(prev => prev && prev.id === `bus-${i}` ? null : {
                  id: `bus-${i}`,
                  type: 'Bus Stop',
                  name: stop.name || 'Bus Stop',
                  dist: stop.dist_m,
                  lng: stop.geometry.coordinates[0],
                  lat: stop.geometry.coordinates[1],
                  color: '#58a6ff'
                });
              }}
              style={{
                color: '#58a6ff', fontSize: '16px', cursor: 'pointer',
                textShadow: '0 0 4px rgba(0,0,0,0.8)',
                width: '28px', height: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                background: hoverInfo && hoverInfo.id === `bus-${i}` ? 'rgba(88,166,255,0.25)' : 'rgba(0,0,0,0.3)',
                transition: 'background 0.15s ease'
              }}>
              <i className="fa-solid fa-bus"></i>
            </div>
          </Marker>
        ))}

        {mapInfrastructure && mapInfrastructure.stations && mapInfrastructure.stations.length > 0 && mapInfrastructure.stations.filter(s => s.geometry).map((station, i) => (
          <Marker key={`train-${i}`} longitude={station.geometry.coordinates[0]} latitude={station.geometry.coordinates[1]} anchor="center">
            <div
              onClick={(e) => {
                e.stopPropagation();
                setHoverInfo(prev => prev && prev.id === `train-${i}` ? null : {
                  id: `train-${i}`,
                  type: 'Station',
                  name: station.name || 'Station',
                  dist: station.dist_m,
                  lng: station.geometry.coordinates[0],
                  lat: station.geometry.coordinates[1],
                  color: '#ab7df8'
                });
              }}
              style={{
                color: '#ab7df8', fontSize: '18px', cursor: 'pointer',
                textShadow: '0 0 4px rgba(0,0,0,0.8)',
                width: '28px', height: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                background: hoverInfo && hoverInfo.id === `train-${i}` ? 'rgba(171,125,248,0.25)' : 'rgba(0,0,0,0.3)',
                transition: 'background 0.15s ease'
              }}>
              <i className="fa-solid fa-train"></i>
            </div>
          </Marker>
        ))}

        {hoverInfo && (
          <Popup
            longitude={hoverInfo.lng}
            latitude={hoverInfo.lat}
            anchor="bottom"
            offset={20}
            closeButton={true}
            closeOnClick={false}
            onClose={() => setHoverInfo(null)}
            className="poi-popup"
            maxWidth="280px"
          >
            <div style={{ padding: '8px 10px', textAlign: 'left', minWidth: '180px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{
                  fontSize: '10px', textTransform: 'uppercase', color: hoverInfo.color,
                  fontWeight: '700', letterSpacing: '0.5px', padding: '2px 8px',
                  background: `${hoverInfo.color}20`, borderRadius: '4px'
                }}>{hoverInfo.type}</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px', lineHeight: '1.3' }}>
                {hoverInfo.name}
              </div>
              {hoverInfo.dist > 0 && (
                <div style={{ fontSize: '12px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <i className="fa-solid fa-person-walking"></i>
                  <span>{Math.round(hoverInfo.dist)} m away</span>
                </div>
              )}
            </div>
          </Popup>
        )}

        {/* CATCHMENTS (Isochrones) rendering */}
        {catchmentData && catchmentData.geojson && (
          <Source id="catchment_src" type="geojson" data={catchmentData.geojson}>
            <Layer
              id="catchment_fill" type="fill"
              paint={{ 'fill-color': ['get', 'fillColor'], 'fill-opacity': 0.3 }}
            />
            <Layer
              id="catchment_line" type="line"
              paint={{ 'line-color': ['get', 'fillColor'], 'line-width': 2 }}
            />
          </Source>
        )}

        {/* Hotspots ML GeoJSON rendering */}
        {hotspotsData && hotspotsData.hexagons && (
          <Source id="hotspots_src" type="geojson" data={hotspotsData.hexagons}>
            <Layer id="hotspots_fill" type="fill" paint={{ 'fill-color': ['get', 'fill_color'], 'fill-opacity': 0.6 }} />
            <Layer id="hotspots_line" type="line" paint={{ 'line-color': '#000', 'line-width': 1, 'line-opacity': 0.3 }} />
          </Source>
        )}

        {/* GEOSPATIAL DATA LAYERS */}

        {activeLayers.demographics && layerData.demographics && (
          <Source id="src_demographics" type="geojson" data={layerData.demographics}>
            <Layer id="layer_demographics" type="fill" paint={{ 'fill-color': '#58a6ff', 'fill-opacity': 0.3 }} />
          </Source>
        )}

        {activeLayers.transportation && layerData.transportation && (
          <Source id="src_transportation" type="geojson" data={layerData.transportation}>
            <Layer id="layer_transportation" type="line" paint={{ 'line-color': '#d29922', 'line-width': 2 }} />
          </Source>
        )}

        {activeLayers.landuse && layerData.landuse && (
          <Source id="src_landuse" type="geojson" data={layerData.landuse}>
            <Layer id="layer_landuse" type="fill" paint={{ 'fill-color': '#3fb950', 'fill-opacity': 0.4 }} />
          </Source>
        )}

        {activeLayers.risk && layerData.risk && (
          <Source id="src_risk" type="geojson" data={layerData.risk}>
            <Layer id="layer_risk" type="fill" paint={{ 'fill-color': '#f85149', 'fill-opacity': 0.4 }} />
          </Source>
        )}

        {activeLayers.poi && layerData.poi && (
          <Source id="src_poi" type="geojson" data={layerData.poi}>
            <Layer id="layer_poi" type="circle" paint={{
              'circle-color': [
                'match',
                ['get', 'category'],
                'competitor', '#f85149',
                'anchor', '#58a6ff',
                'complementary', '#3fb950',
                '#e3883e'
              ],
              'circle-radius': 4
            }} />
          </Source>
        )}

        {/* DYNAMIC POI LAYER (Use-case specific) */}
        {activeLayers.poi && poiDetail && poiDetail.features && (
          <Source id="src_dynamic_poi" type="geojson" data={{ type: "FeatureCollection", features: poiDetail.features }}>
            <Layer id="layer_dynamic_poi" type="circle" paint={{
              'circle-color': ['get', 'color'],
              'circle-radius': 5,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#000000'
            }} />
          </Source>
        )}

      </Map>
    </div>
  );
}
