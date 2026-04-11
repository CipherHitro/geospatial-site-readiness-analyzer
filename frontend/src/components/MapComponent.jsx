import React, { useRef, useState, useEffect } from 'react';
import Map, { NavigationControl, Source, Layer, Marker, Popup } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MapComponent({ activeLayers = {}, onMapClick, hotspotsData, catchmentData, mapInfrastructure, theme, lastClicked }) {
  const mapRef = useRef(null);

  const [viewState, setViewState] = useState({
    longitude: 72.5714,
    latitude: 23.0225,
    zoom: 11,
    pitch: 45
  });

  const [layerData, setLayerData] = useState({});
  const [hoverInfo, setHoverInfo] = useState(null);

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
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={(e) => onMapClick && onMapClick(e.lngLat)}
        mapLib={maplibregl}
        mapStyle={theme === 'light' ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"}
        ref={mapRef}
        interactiveLayerIds={['layer_demographics', 'layer_landuse', 'layer_risk']}
      >
        <NavigationControl position="bottom-right" />

        {lastClicked && (
          <Marker 
            longitude={lastClicked.lng} 
            latitude={lastClicked.lat} 
            color="#f85149" 
            anchor="bottom" />
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

        {mapInfrastructure && mapInfrastructure.busStops && mapInfrastructure.busStops.length > 0 && mapInfrastructure.busStops.filter(s => s.geometry).map((station, i) => (
          <Marker key={`bus-${i}`} longitude={station.geometry.coordinates[0]} latitude={station.geometry.coordinates[1]} anchor="bottom">
            <div 
              onMouseEnter={() => setHoverInfo({ type: 'Bus Stop', name: station.name, dist: station.dist_m, lng: station.geometry.coordinates[0], lat: station.geometry.coordinates[1], color: '#58a6ff' })}
              onMouseLeave={() => setHoverInfo(null)}
              style={{ color: '#58a6ff', fontSize: '18px', cursor: 'pointer', textShadow: '0 0 2px #000' }}>
              <i className="fa-solid fa-bus"></i>
            </div>
          </Marker>
        ))}
        
        {mapInfrastructure && mapInfrastructure.stations && mapInfrastructure.stations.length > 0 && mapInfrastructure.stations.filter(s => s.geometry).map((station, i) => (
          <Marker key={`train-${i}`} longitude={station.geometry.coordinates[0]} latitude={station.geometry.coordinates[1]} anchor="bottom">
            <div 
              onMouseEnter={() => setHoverInfo({ type: 'Railway Station', name: station.name, dist: station.dist_m, lng: station.geometry.coordinates[0], lat: station.geometry.coordinates[1], color: '#ab7df8' })}
              onMouseLeave={() => setHoverInfo(null)}
              style={{ color: '#ab7df8', fontSize: '22px', cursor: 'pointer', textShadow: '0 0 2px #000' }}>
              <i className="fa-solid fa-train"></i>
            </div>
          </Marker>
        ))}

        {hoverInfo && (
          <Popup
            longitude={hoverInfo.lng}
            latitude={hoverInfo.lat}
            anchor="bottom"
            offset={25}
            closeButton={false}
            closeOnClick={false}
            className="poi-popup"
            maxWidth="250px"
          >
            <div style={{ padding: '4px', textAlign: 'left', pointerEvents: 'none' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: hoverInfo.color, fontWeight: 'bold', marginBottom: '4px' }}>{hoverInfo.type}</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hoverInfo.name}</div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>
                <i className="fa-solid fa-person-walking" style={{marginRight: '4px'}}></i>
                {hoverInfo.dist} m away
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
            <Layer id="layer_demographics" type="fill" paint={{'fill-color': '#58a6ff', 'fill-opacity': 0.3}} />
          </Source>
        )}

        {activeLayers.transportation && layerData.transportation && (
          <Source id="src_transportation" type="geojson" data={layerData.transportation}>
            <Layer id="layer_transportation" type="line" paint={{'line-color': '#d29922', 'line-width': 2}} />
          </Source>
        )}

        {activeLayers.landuse && layerData.landuse && (
          <Source id="src_landuse" type="geojson" data={layerData.landuse}>
            <Layer id="layer_landuse" type="fill" paint={{'fill-color': '#3fb950', 'fill-opacity': 0.4}} />
          </Source>
        )}

        {activeLayers.risk && layerData.risk && (
          <Source id="src_risk" type="geojson" data={layerData.risk}>
            <Layer id="layer_risk" type="fill" paint={{'fill-color': '#f85149', 'fill-opacity': 0.4}} />
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
