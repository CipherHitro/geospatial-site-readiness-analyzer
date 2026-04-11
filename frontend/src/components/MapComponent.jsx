import React, { useRef, useState, useEffect, useCallback } from 'react';
import Map, { NavigationControl, Source, Layer, Marker, Popup } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import SearchBox from './SearchBox';

export default function MapComponent({ activeLayers = {}, onMapClick, hotspotsData, catchmentData, mapInfrastructure, demographicsDetail, scoreData, theme, lastClicked }) {
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

  // Helper to create 1km circle
  const circleGeoJSON = React.useMemo(() => {
    if (!lastClicked || !activeLayers.demographics) return null;
    const points = 64;
    const coords = [];
    const radiusKm = 1;
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
  }, [lastClicked, activeLayers.demographics]);

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
      if (activeLayers[key]) fetchLayer(key);
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
        interactiveLayerIds={['layer_demographics', 'layer_landuse', 'layer_risk', 'demo_highlight_fill']}
        onMouseEnter={(e) => {
          if (e.features && e.features[0].layer.id === 'demo_highlight_fill') setDemoHover(true);
        }}
        onMouseLeave={() => setDemoHover(false)}
      >
        <NavigationControl position="bottom-right" />

        {lastClicked && (
          <Marker
            longitude={lastClicked.lng}
            latitude={lastClicked.lat}
            color="#f85149"
            anchor="bottom" />
        )}

        {/* DEMOGRAPHIC HIGHLIGHT CIRCLE */}
        {circleGeoJSON && (
          <Source id="demo_highlight_src" type="geojson" data={circleGeoJSON}>
            <Layer
              id="demo_highlight_fill"
              type="fill"
              paint={{ 'fill-color': '#58a6ff', 'fill-opacity': demoHover ? 0.3 : 0.15 }}
            />
            <Layer
              id="demo_highlight_line"
              type="line"
              paint={{ 'line-color': '#58a6ff', 'line-width': 2, 'line-dasharray': [2, 1] }}
            />
          </Source>
        )}

        {/* DEMOGRAPHIC POPUP */}
        {demographicsDetail && (demoHover || !scoreData) && (
          <Popup
            longitude={lastClicked.lng}
            latitude={lastClicked.lat}
            anchor="left"
            offset={15}
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
              </div>
            </div>
          </Popup>
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
              <div style={{ fontSize: '12px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <i className="fa-solid fa-person-walking"></i>
                <span>{Math.round(hoverInfo.dist)} m away</span>
              </div>
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

      </Map>
    </div>
  );
}
