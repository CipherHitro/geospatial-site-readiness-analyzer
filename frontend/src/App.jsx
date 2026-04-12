import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import ScorePanel from './components/ScorePanel';
import CompareModal from './components/CompareModal';

function App() {
  const [mapMode, setMapMode] = useState('standard');
  const [useCase, setUseCase] = useState('retail');
  const [presets, setPresets] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [activeLayers, setActiveLayers] = useState({ demographics: true });
  const [weights, setWeights] = useState({
    demographics: 25, transportation: 20, competition: 20, landuse: 20, risk: 15
  });

  const [lastClicked, setLastClicked] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [hotspotsData, setHotspotsData] = useState(null);
  const [catchmentData, setCatchmentData] = useState(null);

  const [savedSites, setSavedSites] = useState([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const [mapInfrastructure, setMapInfrastructure] = useState(null);
  const [demographicsDetail, setDemographicsDetail] = useState(null);
  const [zoningDetail, setZoningDetail] = useState(null);
  const [poiDetail, setPoiDetail] = useState(null);
  const [environmentDetail, setEnvironmentDetail] = useState(null);

  // ── H3 Grid State ──────────────────────────────────────────
  const [h3GridData, setH3GridData] = useState(null);
  const [h3CellDetail, setH3CellDetail] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/score/presets')
      .then(r => r.json())
      .then(d => setPresets(d.presets))
      .catch(console.error);
  }, []);

  // Fetch H3 grid data when the h3grid is toggled on
  useEffect(() => {
    if (activeLayers.h3grid && !h3GridData) {
      fetch('http://localhost:8000/api/h3/grid')
        .then(r => r.json())
        .then(data => setH3GridData(data))
        .catch(e => console.error('H3 Grid fetch error', e));
    }
  }, [activeLayers.h3grid]);

  const isInitialMount = React.useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else if (lastClicked) {
      handleMapClick(lastClicked, true);
    }
  }, [activeLayers]);

  // Re-fetch all active layer data when the use case changes
  const isFirstUseCase = React.useRef(true);
  useEffect(() => {
    if (isFirstUseCase.current) {
      isFirstUseCase.current = false;
    } else if (lastClicked) {
      handleMapClick(lastClicked);
    }
  }, [useCase]);

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

  const handleMapClick = async (lngLat, isRefresh = false) => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (total !== 100) {
      alert("Weights must sum exactly to 100% before scoring.");
      return;
    }

    setLastClicked(lngLat);
    if (!isRefresh) {
      setDemographicsDetail(null);
      setZoningDetail(null);
      setMapInfrastructure(null);
      setPoiDetail(null);
      setEnvironmentDetail(null);
      setH3CellDetail(null);
    }

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

    // ── H3 Cell Lookup (always runs — invisible data source) ──
    const h3Promise = fetch('http://localhost:8000/api/h3/cell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: lngLat.lat, lng: lngLat.lng })
    })
      .then(res => {
        if (res.ok) return res.json();
        return null;
      })
      .then(data => {
        if (data) setH3CellDetail(data);
      })
      .catch(e => console.warn('H3 cell lookup failed', e));

    fetchPromises.push(h3Promise);

    // Demographic Layer
    if (activeLayers.demographics) {
      const demoPromise = fetch('http://localhost:8000/api/demographics/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: lngLat.lat, lng: lngLat.lng, use_case: useCase })
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
          newScoreData.score += data.demographics_score * (weights.demographics / 100);
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
          body: JSON.stringify({ lat: lngLat.lat, lng: lngLat.lng, use_case: useCase })
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
            newScoreData.score += data.transport_score * (weights.transportation / 100);

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

    // Zoning / Land Use Layer
    if (activeLayers.landuse) {
      fetchPromises.push(
        fetch('http://localhost:8000/api/zoning/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: lngLat.lat, lng: lngLat.lng, use_case: useCase })
        })
          .then(res => res.json())
          .then(data => {
            setZoningDetail(data);
            newScoreData.zoning = data;
            newScoreData.breakdown.landuse = data.zoning_score;
            newScoreData.score += data.zoning_score * (weights.landuse / 100);
          })
          .catch(e => console.error('Zoning Scoring error', e))
      );
    }

    // POI / Competition Layer
    if (activeLayers.poi) {
      fetchPromises.push(
        fetch('http://localhost:8000/api/poi/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: lngLat.lat, lng: lngLat.lng, radius: 500, use_case: useCase })
        })
          .then(res => res.json())
          .then(data => {
            setPoiDetail(data);
            newScoreData.poi = data;
            newScoreData.breakdown.competition = data.poi_score || data.score;
            newScoreData.score += (data.poi_score || data.score) * (weights.competition / 100);
          })
          .catch(e => console.error('POI Scoring error', e))
      );
    }

    // Environmental Risk Layer (AQI + Flood)
    if (activeLayers.risk) {
      fetchPromises.push(
        fetch('http://localhost:8000/api/environment/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: lngLat.lat, lng: lngLat.lng, use_case: useCase })
        })
          .then(async (res) => {
            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Environment API ${res.status}: ${errText}`);
            }
            return res.json();
          })
          .then(data => {
            const normalizedEnvironment = {
              ...data,
              flood_score: data.flood_score ?? data.flood_score_raw ?? null,
            };

            setEnvironmentDetail(normalizedEnvironment);
            newScoreData.environment = data;
            newScoreData.breakdown.risk = data.environment_score;
            newScoreData.score += data.environment_score * (weights.risk / 100);
          })
          .catch(e => console.error('Environment Scoring error', e))
      );
    }

    if (fetchPromises.length > 0) {
      await Promise.all(fetchPromises);

      if (newScoreData.score > 0) {
        newScoreData.score = Math.round(newScoreData.score);
        newScoreData.grade = newScoreData.score > 80 ? 'A' : newScoreData.score > 60 ? 'B' : 'C';
      }
      setScoreData(newScoreData);
      setIsPanelVisible(true);
      setCatchmentData(null);
    }
  };

  const [sidebarTab, setSidebarTab] = useState('layers');

  const handleRunOrchestrator = async () => {
    if (!lastClicked) {
      alert("Please select a point on the map first!");
      return;
    }

    setSidebarTab('analysis');

    // Convert current percentage weights to floats (sum to 1.0)
    const weightPayload = {
      demographics: weights.demographics / 100,
      transport: weights.transportation / 100,
      poi: weights.competition / 100,
      zoning: weights.landuse / 100,
      environment: weights.risk / 100
    };

    try {
      const res = await fetch('http://localhost:8000/api/site/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: lastClicked.lat,
          lng: lastClicked.lng,
          use_case: useCase,
          weights: weightPayload
        })
      });

      const data = await res.json();

      // Inject AI response and new score label straight into scoreData
      setScoreData(prev => ({
        ...prev,
        ai_insight: data.ai_insight,
        composite_score: data.composite_score,
        score_label: data.score_label,
        hard_cap_applied: data.hard_cap_applied
      }));


    } catch (e) {
      console.error('Orchestrator error', e);
      alert("Failed to run AI Orchestrator API.");
    }
  };

  const handleHotspotsRun = async () => {
    try {
      // Overriding to 'retail' since retail uploading is done and ready to be viewed
      const res = await fetch(`http://localhost:8000/api/hotspots?use_case=retail`);
      const data = await res.json();

      // Ensure summary exists so the Sidebar renders the stats
      if (!data.summary && data.features) {
        let hot = 0, cold = 0;
        data.features.forEach(f => {
          if (f.properties.composite_score >= 65) hot++;
          else if (f.properties.composite_score <= 35) cold++;
        });
        data.summary = {
          hot_spots: hot,
          cold_spots: cold,
          cluster_count: Math.floor(hot / 5) || 0
        };
      }

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
        mapMode={mapMode}
        onMapModeToggle={() => setMapMode(prev => (prev === 'standard' ? 'satellite' : 'standard'))}
        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onHotspotsRun={handleHotspotsRun}
        onRunAI={handleRunOrchestrator}
        isSidebarOpen={isSidebarOpen}
      />
      <main className={`app-layout ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`} id="app-layout">
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          activeLayers={activeLayers}
          toggleLayer={toggleLayer}
          weights={weights}
          setWeights={setWeights}
          onHotspotsRun={handleHotspotsRun}
          onCatchmentRun={handleCatchmentRun}
          onRescore={() => lastClicked ? handleMapClick(lastClicked) : alert("Click a point first")}
          onRunAI={handleRunOrchestrator}
          hotspotsData={hotspotsData}
          catchmentData={catchmentData}
          scoreData={scoreData}
          activeTab={sidebarTab}
          setActiveTab={setSidebarTab}
        />
        <div className="map-area">
          <MapComponent
            activeLayers={activeLayers}
            onMapClick={handleMapClick}
            hotspotsData={hotspotsData}
            catchmentData={catchmentData}
            mapInfrastructure={mapInfrastructure}
            demographicsDetail={demographicsDetail}
            zoningDetail={zoningDetail}
            poiDetail={poiDetail}
            environmentDetail={environmentDetail}
            scoreData={scoreData}
            mapMode={mapMode}
            lastClicked={lastClicked}
            useCase={useCase}
            h3GridData={h3GridData}
            h3CellDetail={h3CellDetail}
          />
          <ScorePanel
            scoreData={scoreData}
            demographicsDetail={demographicsDetail}
            isVisible={isPanelVisible}
            onClose={() => setScoreData(null)}
            onToggle={() => setIsPanelVisible(v => !v)}
            onCompareAdd={handleCompareAdd}
          />
        </div>
      </main>
      <CompareModal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} savedSites={savedSites} />
    </>
  );
}

export default App;
