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

  const toggleLayer = (layerId) => setActiveLayers(prev => ({...prev, [layerId]: !prev[layerId]}));

  const handleMapClick = async (lngLat) => {
    const total = Object.values(weights).reduce((a,b) => a + b, 0);
    if (total !== 100) {
      alert("Weights must sum exactly to 100% before scoring.");
      return;
    }

    setLastClicked(lngLat);

    if (activeLayers.transportation) {
      try {
        const res = await fetch('http://localhost:8000/api/transport/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: lngLat.lat,
            lng: lngLat.lng
          })
        });
        const data = await res.json();
        
        setScoreData({
          lat: lngLat.lat,
          lng: lngLat.lng,
          score: Math.round(data.transport_score),
          grade: data.transport_score > 80 ? 'A' : data.transport_score > 60 ? 'B' : 'C',
          breakdown: {
            "bus_score": data.breakdown.bus_score,
            "station_score": data.breakdown.station_score,
            "road_score": data.breakdown.road_score
          },
          recommendations: [
            `Nearest bus stop: ${data.nearest_bus_stop} (${data.bus_stop_distance_m}m)`,
            `Nearest station: ${data.nearest_station} (${data.station_distance_m}m)`,
            `Total road length in 500m: ${Math.round(data.total_road_length_m)}m`
          ],
          constraint_failures: []
        });

        // Convert isochrones to catchment GEOJSON format for MapComponent
        setCatchmentData(null) // Isochrones are removed from standard transport call

        // Setup infrastructure data 
        if (data.roads_nearby || data.bus_stops_nearby || data.stations_nearby) {
            setMapInfrastructure({
                roads: data.roads_nearby || [],
                busStops: data.bus_stops_nearby || [],
                stations: data.stations_nearby || []
            })
        }

      } catch (e) { console.error('Transport Scoring error', e); }
    } else {
      // Mock score logic for non-transport clicks (or call existing API)
      try {
        const res = await fetch('http://localhost:8000/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: lngLat.lat,
            lng: lngLat.lng,
            weights: {
              demographics: weights.demographics / 100,
              transportation: weights.transportation / 100,
              competition: weights.competition / 100,
              landuse: weights.landuse / 100,
              risk: weights.risk / 100
            },
            use_case: useCase
          })
        });
        const data = await res.json();
        setScoreData({
          lat: data.lat,
          lng: data.lng,
          score: Math.round(data.composite_score),
          grade: data.grade,
          breakdown: Object.keys(data.breakdown).reduce((acc, key) => { acc[key] = data.breakdown[key].score; return acc; }, {}),
          recommendations: data.recommendations,
          constraint_failures: data.constraint_failures
        });
      } catch (e) { console.error('Scoring error', e); }
    }
  };

  const handleHotspotsRun = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/hotspots?use_case=${useCase}`);
      const data = await res.json();
      setHotspotsData(data);
    } catch(e) { console.error('Hotspots error', e); }
  };

  const handleCatchmentRun = async (mode, bands) => {
    if (!lastClicked) {
      alert("Please click a location on the map first!");
      return;
    }
    try {
      const res = await fetch('http://localhost:8000/api/isochrone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: lastClicked.lat,
          lng: lastClicked.lng,
          time_minutes: bands.map(Number),
          mode: mode
        })
      });
      const data = await res.json();
      setCatchmentData(data);
    } catch(e) { console.error('Catchment error', e); }
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
