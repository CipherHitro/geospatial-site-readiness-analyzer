import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import ScorePanel from './components/ScorePanel';
import CompareModal from './components/CompareModal';

function App() {
  const [theme, setTheme] = useState('dark');
  const [useCase, setUseCase] = useState('retail');
  const [presets, setPresets] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [activeLayers, setActiveLayers] = useState({ demographics: true });
  const [weights, setWeights] = useState({
    demographics: 25, transportation: 20, competition: 20, landuse: 20, risk: 15
  });

  const [lastClicked, setLastClicked] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [hotspotsData, setHotspotsData] = useState(null);
  const [catchmentData, setCatchmentData] = useState(null);

  const [savedSites, setSavedSites] = useState([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const [mapInfrastructure, setMapInfrastructure] = useState(null);
  const [demographicsDetail, setDemographicsDetail] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/score/presets')
      .then(r => r.json())
      .then(d => setPresets(d.presets))
      .catch(console.error);
  }, []);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const handleUseCaseChange = (uc) => {
    setUseCase(uc);
    if (presets[uc]) {
      const w = presets[uc].weights;
      setWeights({
        demographics: Math.round(w.demographics * 100),
        transportation: Math.round(w.transportation * 100),
        competition: Math.round(w.competition * 100),
        landuse: Math.round(w.landuse * 100),
        risk: Math.round(w.risk * 100)
      });
    }
  };

  const handleCompareAdd = (data) => {
    setSavedSites(prev => [...prev, { name: `Site ${prev.length + 1}`, ...data }]);
    setIsCompareOpen(true);
  };

  const toggleLayer = (layerId) => setActiveLayers(prev => ({ ...prev, [layerId]: !prev[layerId] }));

  const handleMapClick = async (lngLat) => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (total !== 100) {
      alert("Weights must sum exactly to 100% before scoring.");
      return;
    }

    setLastClicked(lngLat);
    setDemographicsDetail(null);

    let newScoreData = {
      lat: lngLat.lat,
      lng: lngLat.lng,
      score: 0,
      grade: 'C',
      breakdown: {},
      recommendations: [],
      constraint_failures: []
    };

    const fetchPromises = [];

    // Demographic Layer
    if (activeLayers.demographics) {
      const demoPromise = fetch('http://localhost:8000/api/demographics/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: lngLat.lat, lng: lngLat.lng })
      })
        .then(res => res.json())
        .then(async (data) => {
          let neighborhood = "Unknown Area";
          try {
            const photonRes = await fetch(`https://photon.komoot.io/reverse?lon=${lngLat.lng}&lat=${lngLat.lat}`);
            const photonData = await photonRes.json();
            if (photonData.features && photonData.features.length > 0) {
              const props = photonData.features[0].properties;
              neighborhood = props.district || props.city || props.name || neighborhood;
            }
          } catch (e) { console.warn("Reverse geocode failed", e); }

          setDemographicsDetail({
            ...data,
            neighborhood,
            density: Math.round(data.population / 3.14159)
          });

          newScoreData.demographics = data;
          newScoreData.breakdown.demographics = data.demographics_score;
        })
        .catch(e => console.error('Demographics Scoring error', e));

      fetchPromises.push(demoPromise);
    }

    // Transportation Layer
    if (activeLayers.transportation) {
      fetchPromises.push(
        fetch('http://localhost:8000/api/transport/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: lngLat.lat, lng: lngLat.lng })
        })
          .then(res => res.json())
          .then(data => {
            newScoreData.transport = data;
            newScoreData.breakdown.bus_score = data.breakdown.bus_score;
            newScoreData.breakdown.station_score = data.breakdown.station_score;
            newScoreData.breakdown.road_score = data.breakdown.road_score;
            newScoreData.recommendations.push(
              `Nearest bus stop: ${data.nearest_bus_stop} (${data.bus_stop_distance_m}m)`,
              `Nearest station: ${data.nearest_station} (${data.station_distance_m}m)`
            );
            newScoreData.score = Math.max(newScoreData.score, data.transport_score);

            if (data.roads_nearby || data.bus_stops_nearby || data.stations_nearby) {
              setMapInfrastructure({
                roads: data.roads_nearby || [],
                busStops: data.bus_stops_nearby || [],
                stations: data.stations_nearby || []
              });
            }
          })
          .catch(e => console.error('Transport Scoring error', e))
      );
    }

    if (fetchPromises.length > 0) {
      await Promise.all(fetchPromises);

      // If ONLY demographics is active, we don't open the ScorePanel
      if (activeLayers.demographics && !activeLayers.transportation) {
        setScoreData(null);
      } else {
        if (newScoreData.score > 0) {
          newScoreData.grade = newScoreData.score > 80 ? 'A' : newScoreData.score > 60 ? 'B' : 'C';
        }
        setScoreData(newScoreData);
      }
      setCatchmentData(null);
    }
  };

  const handleHotspotsRun = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/hotspots?use_case=${useCase}`);
      const data = await res.json();
      setHotspotsData(data);
    } catch (e) { console.error('Hotspots error', e); }
  };

  const CATCHMENT_COLORS = { 10: '#4ade80', 20: '#fbbf24', 30: '#f87171' };

  const handleCatchmentRun = async (mode, bands) => {
    if (!lastClicked) {
      alert("Please click a location on the map first!");
      return;
    }

    // Sort bands descending so larger areas render behind smaller ones
    const sortedBands = [...bands].sort((a, b) => b - a);

    try {
      const results = await Promise.all(
        sortedBands.map(async (mins) => {
          const res = await fetch('http://localhost:8000/api/catchment-direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: lastClicked.lat,
              lon: lastClicked.lng,
              time_mins: mins,
              mode: mode
            })
          });
          const data = await res.json();
          return { mins, ...data };
        })
      );

      // Build a GeoJSON FeatureCollection for map rendering
      const geojson = {
        type: 'FeatureCollection',
        features: results.map(r => ({
          type: 'Feature',
          geometry: r.isochrone_geojson,
          properties: {
            mins: r.mins,
            fillColor: CATCHMENT_COLORS[r.mins] || '#a78bfa',
            total_population: r.total_population,
            point_count: r.point_count
          }
        }))
      };

      // Build catchment summary for sidebar display
      const catchment = {};
      results.forEach(r => { catchment[r.mins] = r.total_population; });

      setCatchmentData({ geojson, catchment });
    } catch (e) { console.error('Catchment error', e); }
  };

  return (
    <>
      <Header
        onCompareOpen={() => setIsCompareOpen(true)}
        useCase={useCase}
        onUseCaseChange={handleUseCaseChange}
        theme={theme}
        onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onHotspotsRun={handleHotspotsRun}
      />
      <main className={`app-layout ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`} id="app-layout">
        <Sidebar
          activeLayers={activeLayers}
          toggleLayer={toggleLayer}
          weights={weights}
          setWeights={setWeights}
          onHotspotsRun={handleHotspotsRun}
          onCatchmentRun={handleCatchmentRun}
          onRescore={() => lastClicked ? handleMapClick(lastClicked) : alert("Click a point first")}
          hotspotsData={hotspotsData}
          catchmentData={catchmentData}
        />
        <MapComponent
          activeLayers={activeLayers}
          onMapClick={handleMapClick}
          hotspotsData={hotspotsData}
          catchmentData={catchmentData}
          mapInfrastructure={mapInfrastructure}
          demographicsDetail={demographicsDetail}
          scoreData={scoreData}
          theme={theme}
          lastClicked={lastClicked}
        />
      </main>
      <ScorePanel scoreData={scoreData} onClose={() => setScoreData(null)} onCompareAdd={handleCompareAdd} />
      <CompareModal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} savedSites={savedSites} />
    </>
  );
}

export default App;
