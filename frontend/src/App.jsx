import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import ScorePanel from './components/ScorePanel';
import CompareModal from './components/CompareModal';
import { API_BASE_URL } from './config';

/** First ring centroid (GeoJSON lng/lat). */
function polygonCentroid(geometry) {
  if (!geometry?.coordinates) return { lat: 23.0225, lng: 72.5714 };
  const ringCentroid = (ring) => {
    const closed = ring.length > 1
      && ring[0][0] === ring[ring.length - 1][0]
      && ring[0][1] === ring[ring.length - 1][1];
    const n = closed ? ring.length - 1 : ring.length;
    if (n <= 0) return { lat: 23.0225, lng: 72.5714 };
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < n; i++) {
      sx += ring[i][0];
      sy += ring[i][1];
    }
    return { lng: sx / n, lat: sy / n };
  };
  if (geometry.type === 'Polygon') return ringCentroid(geometry.coordinates[0]);
  if (geometry.type === 'MultiPolygon') {
    let best = null;
    let bestA = -1;
    for (const poly of geometry.coordinates) {
      const ring = poly[0];
      let a = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      }
      a = Math.abs(a / 2);
      if (a > bestA) {
        bestA = a;
        best = poly;
      }
    }
    return best ? ringCentroid(best[0]) : { lat: 23.0225, lng: 72.5714 };
  }
  return { lat: 23.0225, lng: 72.5714 };
}

function aggregateSelectedCells(cells) {
  if (!cells?.length) return null;
  const keys = ['child_0_18', 'youth_19_25', 'adult_26_45', 'senior_46_60', 'senior_citizen_60plus'];
  const sums = Object.fromEntries(keys.map((k) => [k, 0]));
  let pop = 0;
  let incW = 0;
  let wLat = 0;
  let wLng = 0;
  for (const c of cells) {
    const p = Number(c.population) || 0;
    pop += p;
    for (const k of keys) sums[k] += Number(c[k]) || 0;
    incW += (Number(c.est_per_capita_inr) || 0) * p;
    wLat += (Number(c.lat) || 0) * p;
    wLng += (Number(c.lon) || 0) * p;
  }
  const totalAge = keys.reduce((a, k) => a + sums[k], 0);
  const pct = (k) => (totalAge > 0 ? Math.round((sums[k] / totalAge) * 1000) / 10 : 0);
  const centerLat = pop > 0 ? wLat / pop : Number(cells[0].lat) || 0;
  const centerLng = pop > 0 ? wLng / pop : Number(cells[0].lon) || 0;
  return {
    h3_index: `area:${cells.length}_cells`,
    population: pop,
    lat: centerLat,
    lon: centerLng,
    age_distribution_pct: {
      child_0_18: pct('child_0_18'),
      youth_19_25: pct('youth_19_25'),
      adult_26_45: pct('adult_26_45'),
      senior_46_60: pct('senior_46_60'),
      senior_citizen_60plus: pct('senior_citizen_60plus'),
    },
    est_per_capita_inr: pop > 0 ? incW / pop : 0,
    geometry: null,
    is_area_aggregate: true,
    hex_count: cells.length,
  };
}

function App() {
  const [mapMode, setMapMode] = useState('standard');
  const [useCase, setUseCase] = useState('retail');
  const [presets, setPresets] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [activeLayers, setActiveLayers] = useState({ demographics: false, transportation: false, competition: false, landuse: false, risk: false });
  const [weights, setWeights] = useState({
    demographics: 25, transportation: 20, competition: 20, landuse: 20, risk: 15
  });

  const [lastClicked, setLastClicked] = useState(null);
  /** 'point' = map click scoring; 'area' = draw polygon then score at polygon centroid with hex overlay */
  const [selectionMode, setSelectionMode] = useState('point');
  /** While true, map shows polygon draw tool (only when selectionMode === 'area'). */
  const [areaDrawingActive, setAreaDrawingActive] = useState(false);
  /** Last drawn area: user polygon + highlighted hexes from API */
  const [areaSelection, setAreaSelection] = useState(null);
  const [areaDrawVertexCount, setAreaDrawVertexCount] = useState(0);
  const mapComponentRef = React.useRef(null);

  const [scoreData, setScoreData] = useState(null);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [hotspotsData, setHotspotsData] = useState(null);
  const [isHotspotsRunning, setIsHotspotsRunning] = useState(false);
  const [catchmentData, setCatchmentData] = useState(null);
  const hotspotAbortRef = React.useRef(null);

  const [visitedHistory, setVisitedHistory] = useState([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const [mapInfrastructure, setMapInfrastructure] = useState(null);
  const [demographicsDetail, setDemographicsDetail] = useState(null);
  const [zoningDetail, setZoningDetail] = useState(null);
  const [poiDetail, setPoiDetail] = useState(null);
  const [environmentDetail, setEnvironmentDetail] = useState(null);

  // ── H3 Grid State ──────────────────────────────────────────
  const [h3GridData, setH3GridData] = useState(null);
  const [h3CellDetail, setH3CellDetail] = useState(null);

  const selectionRef = React.useRef({ selectionMode, areaSelection, lastClicked });
  // eslint-disable-next-line react-hooks/refs
  selectionRef.current = { selectionMode, areaSelection, lastClicked };

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/score/presets`)
      .then(r => r.json())
      .then(d => setPresets(d.presets))
      .catch(console.error);

    // Load visited history from localStorage if available
    const saved = localStorage.getItem('visitedHistory');
    if (saved) {
      try {
        setVisitedHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history', e);
      }
    }
  }, []);

  useEffect(() => {
    // Save to local storage whenever it changes
    localStorage.setItem('visitedHistory', JSON.stringify(visitedHistory));
  }, [visitedHistory]);

  // Fetch H3 grid data when the h3grid is toggled on
  useEffect(() => {
    if (activeLayers.h3grid && !h3GridData) {
      fetch(`${API_BASE_URL}/api/h3/grid`)
        .then(r => r.json())
        .then(data => setH3GridData(data))
        .catch(e => console.error('H3 Grid fetch error', e));
    }
  }, [activeLayers.h3grid]);

  const handleUseCaseChange = (uc) => {
    setUseCase(uc);
    localStorage.setItem('compareUseCase', uc);
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

  const handleDeleteHistory = (index) => {
    setVisitedHistory(prev => prev.filter((_, i) => i !== index));
  };

  const handleCompareAdd = (data) => {
    setVisitedHistory(prev => {
      const isDuplicate = prev.some(site => 
        Math.abs(site.lat - data.lat) < 0.0001 && Math.abs(site.lng - data.lng) < 0.0001
      );
      if (isDuplicate) return prev;

      const d = new Date();
      const timeStr = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      const name = `Site ${prev.length + 1} (${timeStr})`;
      return [...prev, { ...data, name }];
    });
    setIsCompareOpen(true);
  };

  const handleHistoryClick = (site) => {
    setScoreData(site);
    setLastClicked({ lat: site.lat, lng: site.lng });
    setIsPanelVisible(true);

    // Also restore individual detail sections if They exist in the history item
    if (site.demographics) setDemographicsDetail(site.demographics);
    if (site.transport) setMapInfrastructure({
      roads: site.transport.roads_nearby || [],
      busStops: site.transport.bus_stops_nearby || [],
      stations: site.transport.stations_nearby || []
    });
    if (site.zoning) setZoningDetail(site.zoning);
    if (site.poi) setPoiDetail(site.poi);
    if (site.environment) setEnvironmentDetail(site.environment);
  };

  const toggleLayer = (layerId) => setActiveLayers(prev => ({ ...prev, [layerId]: !prev[layerId] }));

  const handleMapClick = async (lngLat, isRefresh = false, options = {}) => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (total !== 100) {
      alert("Weights must sum exactly to 100% before scoring.");
      return;
    }

    if (!options.presetH3CellDetail) setAreaSelection(null);

    const effectiveLayers = options.activeLayersOverride || activeLayers;

    setLastClicked(lngLat);
    if (!isRefresh) {
      setDemographicsDetail(null);
      setZoningDetail(null);
      setMapInfrastructure(null);
      setPoiDetail(null);
      setEnvironmentDetail(null);
      if (!options.presetH3CellDetail) setH3CellDetail(null);
    }

    let newScoreData = {
      lat: lngLat.lat,
      lng: lngLat.lng,
      score: 0,
      grade: 'C',
      breakdown: {},
      recommendations: [],
      constraint_failures: [],
      selectionKind: options.selectionKind || 'point',
      hex_count: options.hexCount ?? null
    };

    const fetchPromises = [];

    // ── H3 cell: single-point lookup, or preset aggregate for drawn areas ──
    if (options.presetH3CellDetail) {
      setH3CellDetail(options.presetH3CellDetail);
    } else {
      const h3Promise = fetch(`${API_BASE_URL}/api/h3/cell`, {
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
    }

    // Demographic Layer
    if (effectiveLayers.demographics) {
      const demoPromise = fetch(`${API_BASE_URL}/api/demographics/score`, {
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
    if (effectiveLayers.transportation) {
      fetchPromises.push(
        fetch(`${API_BASE_URL}/api/transport/score`, {
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
            newScoreData.breakdown.transportation = data.transport_score;
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
    if (effectiveLayers.landuse) {
      fetchPromises.push(
        fetch(`${API_BASE_URL}/api/zoning/score`, {
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
    if (effectiveLayers.poi) {
      fetchPromises.push(
        fetch(`${API_BASE_URL}/api/poi/score`, {
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
    if (effectiveLayers.risk) {
      fetchPromises.push(
        fetch(`${API_BASE_URL}/api/environment/score`, {
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
    } else {
      setIsPanelVisible(false);
      setScoreData(null);
    }
  };

  const isInitialMount = React.useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const { selectionMode: sm, areaSelection: ar, lastClicked: lc } = selectionRef.current;
    if (!lc) return;
    if (sm === 'area' && ar?.selected_cells?.length) {
      handleMapClick(polygonCentroid(ar.userPolygon), true, {
        presetH3CellDetail: aggregateSelectedCells(ar.selected_cells),
        selectionKind: 'area',
        hexCount: ar.count
      });
    } else if (sm === 'point') {
      handleMapClick(lc, true);
    }
  }, [activeLayers]);

  const isFirstUseCase = React.useRef(true);
  useEffect(() => {
    if (isFirstUseCase.current) {
      isFirstUseCase.current = false;
      return;
    }

    if (hotspotsData) {
      handleHotspotsRun(); // Re-run hotspot generation automatically when use_case changes
    }

    const { selectionMode: sm, areaSelection: ar, lastClicked: lc } = selectionRef.current;
    if (!lc) return;
    if (sm === 'area' && ar?.selected_cells?.length) {
      handleMapClick(polygonCentroid(ar.userPolygon), false, {
        presetH3CellDetail: aggregateSelectedCells(ar.selected_cells),
        selectionKind: 'area',
        hexCount: ar.count
      });
    } else if (sm === 'point') {
      handleMapClick(lc);
    }
  }, [useCase]);

  const handleSelectionModeChange = (mode) => {
    setSelectionMode(mode);
    if (mode === 'point') {
      setAreaDrawingActive(false);
      setAreaSelection(null);
    } else {
      setAreaSelection(null);
      setAreaDrawingActive(true);
      setLastClicked(null);
      setScoreData(null);
      setH3CellDetail(null);
    }
  };

  const handleStartRedrawArea = () => {
    setAreaSelection(null);
    setAreaDrawingActive(true);
  };

  const handleFinishAreaPolygon = () => {
    const ok = mapComponentRef.current?.finishPolygonDraw?.();
    if (!ok) {
      alert('Place at least 3 corners on the map first, then click Complete polygon.');
    }
  };

  const handleDrawnPolygonGeometry = async (polygonGeometry) => {
    setAreaDrawingActive(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/environment/select-area`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(polygonGeometry)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || `Area selection failed (${res.status})`);
        setAreaDrawingActive(true);
        return;
      }
      const data = await res.json();
      const count = data.count ?? (data.selected_hexagons?.length || 0);
      if (!count) {
        alert('No H3 cells are at least 50% inside that shape (try a larger area or move within Ahmedabad coverage).');
        setAreaDrawingActive(true);
        return;
      }
      const centroid = polygonCentroid(polygonGeometry);
      const preset = aggregateSelectedCells(data.selected_cells || []);
      setAreaSelection({
        userPolygon: polygonGeometry,
        hexGeojson: data.hexagons_geojson,
        count,
        selected_cells: data.selected_cells || []
      });
      await handleMapClick(centroid, false, {
        presetH3CellDetail: preset,
        selectionKind: 'area',
        hexCount: count
      });
    } catch (e) {
      console.error('select-area', e);
      alert('Could not analyze drawn area. Is the API running?');
      setAreaDrawingActive(true);
    }
  };

  const handleSearchLocationSelect = (lat, lon) => {
    setSelectionMode('point');
    setAreaDrawingActive(false);
    setAreaSelection(null);
    handleMapClick({ lat, lng: lon });
  };

  const [sidebarTab, setSidebarTab] = useState('layers');

  const handleRunOrchestrator = async () => {
    if (!lastClicked) {
      alert("Please select a location on the map (point or drawn area) first!");
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
      const res = await fetch(`${API_BASE_URL}/api/site/score`, {
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
    if (isHotspotsRunning) return;
    const controller = new AbortController();
    hotspotAbortRef.current = controller;
    setIsHotspotsRunning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/hotspots?use_case=${useCase}`, { signal: controller.signal });
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
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Hotspots error', e);
    } finally {
      hotspotAbortRef.current = null;
      setIsHotspotsRunning(false);
    }
  };

  const handleCancelHotspots = () => {
    if (hotspotAbortRef.current) {
      hotspotAbortRef.current.abort();
      hotspotAbortRef.current = null;
    }
    setIsHotspotsRunning(false);
    setHotspotsData(null);
  };

  const CATCHMENT_COLORS = { 10: '#4ade80', 20: '#fbbf24', 30: '#f87171' };

  const handleCatchmentRun = async (mode, bands) => {
    if (!lastClicked) {
      alert("Please select a location on the map first (point or area centroid)!");
      return;
    }

    // Sort bands descending so larger areas render behind smaller ones
    const sortedBands = [...bands].sort((a, b) => b - a);

    try {
      const results = await Promise.all(
        sortedBands.map(async (mins) => {
          const res = await fetch(`${API_BASE_URL}/api/catchment-direct`, {
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
          selectionMode={selectionMode}
          onSelectionModeChange={handleSelectionModeChange}
          areaDrawingActive={areaDrawingActive}
          areaSelection={areaSelection}
          areaDrawVertexCount={areaDrawVertexCount}
          onStartRedrawArea={handleStartRedrawArea}
          onFinishAreaPolygon={handleFinishAreaPolygon}
          onHotspotsRun={handleHotspotsRun}
          onHotspotsCancel={handleCancelHotspots}
          isHotspotsRunning={isHotspotsRunning}
          onCatchmentRun={handleCatchmentRun}
          onResetWeights={() => {
            if (presets[useCase]) {
              const w = presets[useCase].weights;
              setWeights({
                demographics: Math.round(w.demographics * 100),
                transportation: Math.round(w.transportation * 100),
                competition: Math.round(w.competition * 100),
                landuse: Math.round(w.landuse * 100),
                risk: Math.round(w.risk * 100)
              });
            } else {
              setWeights({ demographics: 25, transportation: 20, competition: 20, landuse: 20, risk: 15 });
            }
          }}
          onRunAI={handleRunOrchestrator}
          hotspotsData={hotspotsData}
          catchmentData={catchmentData}
          scoreData={scoreData}
          activeTab={sidebarTab}
          setActiveTab={setSidebarTab}
          visitedHistory={visitedHistory}
          onDeleteHistory={handleDeleteHistory}
          onCompareOpen={() => setIsCompareOpen(true)}
          onHistoryClick={handleHistoryClick}
        />
        <div className="map-area">
          <MapComponent
            ref={mapComponentRef}
            activeLayers={activeLayers}
            selectionMode={selectionMode}
            areaDrawingActive={areaDrawingActive}
            areaSelection={areaSelection}
            onMapClick={handleMapClick}
            onDrawnPolygonGeometry={handleDrawnPolygonGeometry}
            onSearchLocationSelect={handleSearchLocationSelect}
            onDrawingVertexCountChange={setAreaDrawVertexCount}
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
            onToggle={() => setIsPanelVisible(v => !v)}
            onCompareAdd={handleCompareAdd}
          />
        </div>
      </main>
      <CompareModal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} savedSites={visitedHistory} useCase={useCase} />
    </>
  );
}

export default App;
