import React, { useRef, useState, useEffect, useCallback } from 'react';
import Map, { NavigationControl, Source, Layer, Marker, Popup } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import SearchBox from './SearchBox';

const AGE_COLORS = {
  'child_0_18': '#d9b15b',
  'youth_19_25': '#6f9a7a',
  'adult_26_45': '#8a6f4e',
  'senior_46_60': '#c7895a',
  'senior_citizen_60plus': '#c96a5f',
};

const AGE_LABELS = {
  'child_0_18': 'Children (0–18)',
  'youth_19_25': 'Youth (19–25)',
  'adult_26_45': 'Adults (26–45)',
  'senior_46_60': 'Seniors (46–60)',
  'senior_citizen_60plus': 'Elders (60+)',
};

const SATELLITE_STYLE = {
  version: 8,
  sources: {
    esri_satellite: {
      type: 'raster',
      tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri'
    }
  },
  layers: [
    {
      id: 'esri_satellite_layer',
      type: 'raster',
      source: 'esri_satellite'
    }
  ]
};

export default function MapComponent({ activeLayers = {}, onMapClick, hotspotsData, catchmentData, mapInfrastructure, demographicsDetail, zoningDetail, poiDetail, environmentDetail, scoreData, mapMode, lastClicked, h3GridData, envGridData, h3CellDetail }) {
  const mapRef = useRef(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [selectedPointHover, setSelectedPointHover] = useState(false);
  const showLayerHoverPopups = false;
  const hasActiveLayer = Object.values(activeLayers || {}).some(Boolean);

  const baseMapStyle = React.useMemo(() => {
    if (mapMode === 'satellite') return SATELLITE_STYLE;
    return 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
  }, [mapMode]);

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
  const [riskHover, setRiskHover] = useState(false);

  // Removed 1km circle logic

  const BUILDING_COLORS = { 'commercial': '#6f9a7a', 'anchor': '#8a6f4e', 'residential': '#d9b15b', 'generic': '#aab9b2' };
  const ZONE_COLORS = { 'commercial': '#6f9a7a', 'residential': '#d9b15b', 'industrial': '#c7895a', 'restricted': '#c96a5f' };

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
  const focusPointAbovePanel = useCallback((lat, lon, minZoom = null) => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;

    const currentZoom = map.getZoom();
    const targetZoom = minZoom != null ? Math.max(currentZoom, minZoom) : currentZoom;
    const verticalOffset = window.innerHeight < 800 ? -120 : -170;

    map.easeTo({
      center: [lon, lat],
      zoom: targetZoom,
      offset: [0, verticalOffset],
      duration: 900,
      essential: true,
    });
  }, []);

  const handleSearchSelect = useCallback((lat, lon) => {
    focusPointAbovePanel(lat, lon, 15);
    // Trigger scoring automatically
    if (onMapClick) {
      onMapClick({ lat, lng: lon });
    }
  }, [focusPointAbovePanel, onMapClick]);

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

  useEffect(() => {
    setDetailPanelOpen(false);
    setSelectedPointHover(false);
  }, [lastClicked]);

  useEffect(() => {
    if (!hasActiveLayer) {
      setDetailPanelOpen(false);
      setSelectedPointHover(false);
    }
  }, [hasActiveLayer]);

  return (
    <div className="map-container">
      <SearchBox onSelect={handleSearchSelect} />

      {hasActiveLayer && lastClicked && (demographicsDetail || zoningDetail || environmentDetail) && (
        <>
          <button
            type="button"
            className="map-insight-toggle"
            onClick={() => setDetailPanelOpen(prev => !prev)}
          >
            <i className={`fa-solid fa-chevron-${detailPanelOpen ? 'up' : 'down'}`}></i>
            Detail Data
          </button>

          {detailPanelOpen && (
            <aside className="map-insight-panel">
          {demographicsDetail && (
            <section className="insight-section">
              <h4 className="insight-title">Demographics</h4>
              <div className="insight-row"><span>Area</span><strong>{demographicsDetail.neighborhood || 'N/A'}</strong></div>
              <div className="insight-row"><span>Population</span><strong>{Number(demographicsDetail.population || 0).toLocaleString()}</strong></div>
              {(h3CellDetail?.est_per_capita_inr || demographicsDetail.h3_cell?.est_per_capita_inr) && (
                <div className="insight-row"><span>Per Capita</span><strong>₹{Number(h3CellDetail?.est_per_capita_inr || demographicsDetail.h3_cell?.est_per_capita_inr).toLocaleString()}</strong></div>
              )}
              {demographicsDetail.people_grouping && (
                <div className="insight-mini-list">
                  {Object.entries(demographicsDetail.people_grouping).map(([group, pct]) => (
                    <div key={group} className="insight-row"><span>{group.replace(/_/g, ' ')}</span><strong>{pct}%</strong></div>
                  ))}
                </div>
              )}
            </section>
          )}

          {zoningDetail && (
            <section className="insight-section">
              <h4 className="insight-title">Land Use</h4>
              <div className="insight-row"><span>Zone</span><strong style={{ textTransform: 'capitalize' }}>{zoningDetail.zone_type || 'N/A'}</strong></div>
              <div className="insight-row"><span>Commercial</span><strong>{zoningDetail.allows_commercial ? 'Allowed' : 'Not Allowed'}</strong></div>
              <div className="insight-row"><span>Buildings</span><strong>{Number(zoningDetail.building_count_500m || 0).toLocaleString()}</strong></div>
              <div className="insight-row"><span>Built-up Area</span><strong>{Math.round(zoningDetail.total_built_area_sqm || 0).toLocaleString()} sqm</strong></div>
            </section>
          )}

          {environmentDetail && (
            <section className="insight-section">
              <h4 className="insight-title">Environmental Risk</h4>
              <div className="insight-row"><span>Flood Risk</span><strong>{Number(environmentDetail.flood_score ?? environmentDetail.flood_score_raw ?? 0).toFixed(1)} / 100</strong></div>
              {environmentDetail.aqi !== null && environmentDetail.aqi !== undefined && (
                <div className="insight-row"><span>AQI</span><strong>{environmentDetail.aqi} ({environmentDetail.aqi_level})</strong></div>
              )}
              {environmentDetail.dominant_pollutant && (
                <div className="insight-row"><span>Pollutant</span><strong style={{ textTransform: 'uppercase' }}>{environmentDetail.dominant_pollutant}</strong></div>
              )}
            </section>
          )}
            </aside>
          )}
        </>
      )}

      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={(e) => {
          focusPointAbovePanel(e.lngLat.lat, e.lngLat.lng);
          onMapClick && onMapClick(e.lngLat);
        }}
        mapLib={maplibregl}
        mapStyle={baseMapStyle}
        ref={mapRef}
        interactiveLayerIds={[
          'layer_demographics',
          'layer_landuse',
          'layer_risk',
          'h3_cell_highlight_fill',
          'h3_invisible_fill',
          'layer_poi',
          'layer_dynamic_poi',
          'poi_detail_points',
          'hotspots_fill'
        ]}
        onMouseMove={(e) => {
          if (e.features && e.features.length > 0) {
            // Find if mouse is over H3 cell highlight
            const h3Feat = e.features.find(f => f.layer.id === 'h3_cell_highlight_fill' || f.layer.id === 'h3_invisible_fill');
            if (h3Feat) {
              setDemoHover(true);
              setZoningHover(true);
              setRiskHover(true);
            } else {
              // Mouse is inside map container but not over H3 cell
              setDemoHover(false);
              setZoningHover(false);
              setRiskHover(false);
            }

            // Find if mouse is over Hotspot hexagon
            const hotspotFeat = e.features.find(f => f.layer.id === 'hotspots_fill');
            // Find if mouse is over POI point
            const poiFeat = e.features.find(f => f.layer.id === 'layer_poi' || f.layer.id === 'layer_dynamic_poi' || f.layer.id === 'poi_detail_points');

            if (hotspotFeat) {
              setHoverInfo({
                isHotspot: true,
                props: hotspotFeat.properties,
                lng: e.lngLat.lng,
                lat: e.lngLat.lat
              });
            } else if (poiFeat) {
              const props = poiFeat.properties;
              setHoverInfo(prev => {
                const newId = `poi-${props.name}`;
                if (prev && prev.id === newId) return prev; // Avoid unnecessary re-renders
                return {
                  id: newId,
                  type: props.poi_type || props.category || 'POI',
                  name: props.name,
                  dist: props.distance_m || 0,
                  lng: poiFeat.geometry?.coordinates ? poiFeat.geometry.coordinates[0] : e.lngLat.lng,
                  lat: poiFeat.geometry?.coordinates ? poiFeat.geometry.coordinates[1] : e.lngLat.lat,
                  color: props.color || (props.poi_type === 'anchor' ? '#d9b15b' : props.poi_type === 'competitor' ? '#c96a5f' : props.poi_type === 'complementary' ? '#6f9a7a' : '#c7895a')
                };
              });
            } else {
              setHoverInfo(prev => {
                if (prev && (prev.isHotspot || (prev.id && prev.id.startsWith('poi-')))) return null;
                return prev;
              });
            }
          } else {
            // No interactive features hovered
            setDemoHover(false);
            setZoningHover(false);
            setRiskHover(false);
            setHoverInfo(prev => {
              if (prev && (prev.isHotspot || (prev.id && prev.id.startsWith('poi-')))) return null;
              return prev;
            });
          }
        }}
        onMouseLeave={() => {
          setDemoHover(false);
          setZoningHover(false);
          setRiskHover(false);
          // Only clear POI/Hotspot hover if we are actually leaving the point
          if (hoverInfo && (hoverInfo.isHotspot || (hoverInfo.id && hoverInfo.id.startsWith('poi-')))) {
            setHoverInfo(null);
          }
        }}
      >
        <NavigationControl position="bottom-right" />

        {lastClicked && (
          <Marker
            longitude={lastClicked.lng}
            latitude={lastClicked.lat}
            anchor="bottom"
          >
            <div
              className="selected-point-marker"
              onMouseEnter={() => setSelectedPointHover(true)}
              onMouseLeave={() => setSelectedPointHover(false)}
            >
              <i className="fa-solid fa-location-dot"></i>
            </div>
          </Marker>
        )}

        {hasActiveLayer && lastClicked && selectedPointHover && (demographicsDetail || zoningDetail || environmentDetail) && (
          <Popup
            longitude={lastClicked.lng}
            latitude={lastClicked.lat}
            anchor="top"
            offset={24}
            closeButton={false}
            className="selected-point-popup"
          >
            <div className="demo-popup-content">
              <div className="demo-popup-header">Selected Point</div>
              <div className="demo-popup-body">
                {demographicsDetail && (
                  <div className="demo-popup-row">
                    <span className="demo-popup-label">Population:</span>
                    <span className="demo-popup-value">{Number(demographicsDetail.population || 0).toLocaleString()}</span>
                  </div>
                )}
                {zoningDetail && (
                  <div className="demo-popup-row">
                    <span className="demo-popup-label">Zone:</span>
                    <span className="demo-popup-value" style={{ textTransform: 'capitalize' }}>{zoningDetail.zone_type || 'N/A'}</span>
                  </div>
                )}
                {environmentDetail && (
                  <div className="demo-popup-row">
                    <span className="demo-popup-label">Flood Risk:</span>
                    <span className="demo-popup-value">{Number(environmentDetail.flood_score ?? environmentDetail.flood_score_raw ?? 0).toFixed(1)} / 100</span>
                  </div>
                )}
                {environmentDetail && (environmentDetail.aqi !== null && environmentDetail.aqi !== undefined) && (
                  <div className="demo-popup-row">
                    <span className="demo-popup-label">AQI:</span>
                    <span className="demo-popup-value">{environmentDetail.aqi}</span>
                  </div>
                )}
              </div>
            </div>
          </Popup>
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
                'line-color': '#d9b15b',
                'line-width': 1,
                'line-opacity': 0.5
              }}
            />
          </Source>
        )}

        {/* ── H3 ACTIVE CELL HIGHLIGHT ── */}
        {activeLayers.demographics && h3CellHighlightGeoJSON && (
          <Source id="h3_cell_highlight_src" type="geojson" data={h3CellHighlightGeoJSON}>
            <Layer
              id="h3_cell_highlight_fill"
              type="fill"
              paint={{
                'fill-color': '#d9b15b',
                'fill-opacity': 0.2
              }}
            />
            <Layer
              id="h3_cell_highlight_line"
              type="line"
              paint={{
                'line-color': '#d9b15b',
                'line-width': 2.5,
                'line-opacity': 0.9
              }}
            />
          </Source>
        )}

        {/* INVISIBLE H3 CELL (Preserves hover interaction for Risk/Zoning when Demographics visuals are off) */}
        {(!activeLayers.demographics && (activeLayers.risk || activeLayers.landuse)) && h3CellHighlightGeoJSON && (
          <Source id="h3_invisible_src" type="geojson" data={h3CellHighlightGeoJSON}>
            <Layer
              id="h3_invisible_fill"
              type="fill"
              paint={{
                'fill-color': 'transparent',
                'fill-opacity': 0
              }}
            />
          </Source>
        )}

        {/* DEMOGRAPHICS POPUP — enhanced with H3 cell age distribution */}
        {showLayerHoverPopups && activeLayers.demographics && demographicsDetail && lastClicked && (demoHover || !scoreData) && (
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
                {(h3CellDetail?.est_per_capita_inr || demographicsDetail.h3_cell?.est_per_capita_inr) && (
                  <div className="demo-popup-row">
                    <span className="demo-popup-label">Per Capita Income:</span>
                    <span className="demo-popup-value">₹{Number(h3CellDetail?.est_per_capita_inr || demographicsDetail.h3_cell?.est_per_capita_inr).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </Popup>
        )}

        {/* ENVIRONMENTAL RISK POPUP */}
        {showLayerHoverPopups && activeLayers.risk && environmentDetail && h3CellDetail && lastClicked && (riskHover || !scoreData) && (
          <Popup
            longitude={riskPopupCoords.lng}
            latitude={riskPopupCoords.lat}
            anchor="top"
            offset={40}
            closeButton={false}
            className="zoning-popup-map"
          >
            <div className="demo-popup-content">
              {(() => {
                const floodRisk = Number(environmentDetail.flood_score ?? environmentDetail.flood_score_raw ?? 0);
                const isHighRisk = floodRisk > 50 || (environmentDetail.aqi && environmentDetail.aqi > 150);

                return (
                  <>
              <div className="zoning-popup-header">
                <span>Environmental Risk</span>
                <span className={`zoning-badge ${isHighRisk ? 'zoning-badge--no' : 'zoning-badge--ok'}`}>
                  {isHighRisk ? 'High Risk' : 'Low Risk'}
                </span>
              </div>
              <div className="demo-popup-body">
                {(environmentDetail.flood_score !== undefined || environmentDetail.flood_score_raw !== undefined) && (
                  <div className="demo-popup-row">
                    <span className="demo-popup-label">Flood Risk Score:</span>
                    <span className="demo-popup-value">{floodRisk.toFixed(1)} / 100</span>
                  </div>
                )}
                {environmentDetail.aqi !== null && environmentDetail.aqi !== undefined && (
                  <div className="demo-popup-row">
                    <span className="demo-popup-label">Live AQI:</span>
                    <span className="demo-popup-value">{environmentDetail.aqi}</span>
                  </div>
                )}
              </div>
                  </>
                );
              })()}
            </div>
          </Popup>
        )}

        {/* ZONING POPUP */}
        {showLayerHoverPopups && activeLayers.landuse && zoningDetail && lastClicked && (zoningHover || !scoreData) && (
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
                  <span className="demo-popup-label">Commercial:</span>
                  <span className="demo-popup-value">{zoningDetail.allows_commercial ? 'Allowed' : 'Not Allowed'}</span>
                </div>
                <div className="demo-popup-row">
                  <span className="demo-popup-label">Buildings:</span>
                  <span className="demo-popup-value">{Number(zoningDetail.building_count_500m || 0).toLocaleString()}</span>
                </div>
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
                  'commercial', '#6f9a7a',
                  'residential', '#d9b15b',
                  'industrial', '#c7895a',
                  'restricted', '#c96a5f',
                  '#aab9b2'
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
                  'commercial', '#6f9a7a',
                  'residential', '#d9b15b',
                  'industrial', '#c7895a',
                  'restricted', '#c96a5f',
                  '#aab9b2'
                ],
                'line-width': 1.5,
                'line-opacity': 0.8
              }}
            />
          </Source>
        )}

        {/* POI HIGHLIGHT CIRCLE (500m) AND POINTS - Circle intentionally removed as per request */}

        {activeLayers.poi && poiDetail && poiDetail.features && (
          <Source id="poi_detail_points_src" type="geojson" data={{ type: 'FeatureCollection', features: poiDetail.features }}>
            <Layer
              id="poi_detail_points"
              type="circle"
              paint={{
                'circle-color': [
                  'match',
                  ['get', 'poi_type'],
                  'competitor', '#c96a5f',
                  'anchor', '#d9b15b',
                  'complementary', '#6f9a7a',
                  '#c7895a'
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
                  'commercial', '#6f9a7a',
                  'anchor', '#8a6f4e',
                  'residential', '#d9b15b',
                  'generic', '#aab9b2',
                  '#aab9b2'
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
        {activeLayers.transportation && mapInfrastructure && mapInfrastructure.roads && (
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

        {activeLayers.transportation && mapInfrastructure && mapInfrastructure.busStops && mapInfrastructure.busStops.length > 0 && mapInfrastructure.busStops.filter(s => s.geometry).map((stop, i) => (
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
                  color: '#d9b15b'
                });
              }}
              style={{
                color: '#d9b15b', fontSize: '16px', cursor: 'pointer',
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

        {activeLayers.transportation && mapInfrastructure && mapInfrastructure.stations && mapInfrastructure.stations.length > 0 && mapInfrastructure.stations.filter(s => s.geometry).map((station, i) => (
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

        {hoverInfo && hoverInfo.isHotspot && (
          <Popup
            longitude={hoverInfo.lng}
            latitude={hoverInfo.lat}
            anchor="bottom"
            offset={10}
            closeButton={false}
            className="poi-popup"
            maxWidth="280px"
          >
            <div style={{ padding: '8px 10px', textAlign: 'left', minWidth: '180px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{
                  fontSize: '10px', textTransform: 'uppercase', color: hoverInfo.props?.color || '#a371f7',
                  fontWeight: '700', letterSpacing: '0.5px', padding: '2px 8px',
                  background: `${hoverInfo.props?.color || '#a371f7'}20`, borderRadius: '4px'
                }}>Hotspot Grid</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px', lineHeight: '1.3' }}>
                Score: {Math.round(hoverInfo.props?.composite_score || 0)} ({hoverInfo.props?.score_label || 'Moderate'})
              </div>
              <div style={{ fontSize: '12px', color: '#d7e0d8', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Demographics:</span><span>{Math.round(hoverInfo.props?.demographics_score || 0)}/100</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Transport:</span><span>{Math.round(hoverInfo.props?.transport_score || 0)}/100</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>POI/Competition:</span><span>{Math.round(hoverInfo.props?.poi_score || 0)}/100</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Zoning:</span><span>{Math.round(hoverInfo.props?.zoning_score || 0)}/100</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Environment:</span><span>{Math.round(hoverInfo.props?.environment_score || 0)}/100</span></div>
              </div>
            </div>
          </Popup>
        )}

        {hoverInfo && !hoverInfo.isHotspot && (
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
                <div style={{ fontSize: '12px', color: '#d7e0d8', display: 'flex', alignItems: 'center', gap: '5px' }}>
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
        {hotspotsData && hotspotsData.features && (
          <Source id="hotspots_src" type="geojson" data={hotspotsData}>
            <Layer id="hotspots_fill" type="fill" paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'fillOpacity'] }} />
            <Layer id="hotspots_line" type="line" paint={{ 'line-color': '#000', 'line-width': 1, 'line-opacity': 0.3 }} />
          </Source>
        )}

        {/* GEOSPATIAL DATA LAYERS */}

        {activeLayers.demographics && layerData.demographics && (
          <Source id="src_demographics" type="geojson" data={layerData.demographics}>
            <Layer id="layer_demographics" type="fill" paint={{ 'fill-color': '#d9b15b', 'fill-opacity': 0.3 }} />
          </Source>
        )}

        {activeLayers.transportation && layerData.transportation && (
          <Source id="src_transportation" type="geojson" data={layerData.transportation}>
            <Layer id="layer_transportation" type="line" paint={{ 'line-color': '#c7895a', 'line-width': 2 }} />
          </Source>
        )}

        {activeLayers.landuse && layerData.landuse && (
          <Source id="src_landuse" type="geojson" data={layerData.landuse}>
            <Layer id="layer_landuse" type="fill" paint={{ 'fill-color': '#6f9a7a', 'fill-opacity': 0.4 }} />
          </Source>
        )}

        {activeLayers.risk && layerData.risk && (
          <Source id="src_risk" type="geojson" data={layerData.risk}>
            <Layer id="layer_risk" type="fill" paint={{ 'fill-color': '#c96a5f', 'fill-opacity': 0.4 }} />
          </Source>
        )}

        {activeLayers.poi && layerData.poi && (
          <Source id="src_poi" type="geojson" data={layerData.poi}>
            <Layer id="layer_poi" type="circle" paint={{
              'circle-color': [
                'match',
                ['get', 'category'],
                'competitor', '#c96a5f',
                'anchor', '#d9b15b',
                'complementary', '#6f9a7a',
                '#c7895a'
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
