import React, { useState } from 'react';

const layersConfig = [
  { id: 'demographics', name: 'Demographics', sub: 'Population · Income · Age', color: '#d9b15b' },
  { id: 'transportation', name: 'Transportation', sub: 'Roads · Highways', color: '#c7895a' },
  { id: 'poi', name: 'Points of Interest', sub: 'Competitors · Anchors · Amenities', color: '#8a6f4e' },
  { id: 'landuse', name: 'Land Use & Zoning', sub: 'Commercial · Industrial · Residential', color: '#6f9a7a' },
  { id: 'risk', name: 'Environmental Risk', sub: 'Flood · Industrial · Air Quality', color: '#c96a5f' }
];

const renderMarkdown = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    let content = line.trim();
    if (!content) return <br key={i} />;

    const isBullet = content.startsWith('-') || content.startsWith('*') || content.startsWith('•');
    if (isBullet) content = content.replace(/^[-*•]\s?/, '');

    const parts = content.split(/(\*\*.*?\*\*)/g);
    const renderedLine = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (isBullet) {
      return (
        <li key={i} style={{ marginLeft: '1.2em', marginBottom: '6px', listStyleType: 'disc' }}>
          {renderedLine}
        </li>
      );
    }
    return <p key={i} style={{ marginBottom: '8px' }}>{renderedLine}</p>;
  });
};

export default function Sidebar({
  isOpen,
  onToggle,
  activeLayers,
  toggleLayer,
  weights,
  setWeights,
  selectionMode,
  onSelectionModeChange,
  areaDrawingActive,
  areaSelection,
  areaDrawVertexCount,
  onStartRedrawArea,
  onFinishAreaPolygon,
  onHotspotsRun,
  onHotspotsCancel,
  isHotspotsRunning,
  onCatchmentRun,
  onResetWeights,
  onRunAI,
  scoreData,
  activeTab,
  setActiveTab,
  onRescore,
  hotspotsData,
  catchmentData,
  visitedHistory,
  onDeleteHistory,
  onCompareOpen,
  onHistoryClick
}) {
  const [travelMode, setTravelMode] = useState('drive');
  const [catchBands, setCatchBands] = useState([10, 20]);

  const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleWeightChange = (key, val) => {
    setWeights(prev => ({ ...prev, [key]: Number(val) }));
  };

  const toggleBand = (val) => {
    setCatchBands(prev => prev.includes(val) ? prev.filter(b => b !== val) : [...prev, val]);
  };

  return (
    <aside className={`sidebar ${isOpen ? '' : 'collapsed'}`} id="sidebar">
      <button
        type="button"
        className="sidebar-toggle-btn"
        onClick={onToggle}
        aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <i className={`fa-solid ${isOpen ? 'fa-chevron-left' : 'fa-chevron-right'}`}></i>
      </button>

      {/* TABS */}
      <div className="sidebar__tabs" role="tablist">
        <button className={`tab-btn ${activeTab === 'layers' ? 'active' : ''}`} onClick={() => setActiveTab('layers')}>
          <i className="fa-solid fa-layer-group"></i><span>Layers</span>
        </button>
        <button className={`tab-btn ${activeTab === 'weights' ? 'active' : ''}`} onClick={() => setActiveTab('weights')}>
          <i className="fa-solid fa-sliders"></i><span>Weights</span>
        </button>
        <button className={`tab-btn ${activeTab === 'catchment' ? 'active' : ''}`} onClick={() => setActiveTab('catchment')}>
          <i className="fa-solid fa-circle-dot"></i><span>Catchment</span>
        </button>
        <button className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
          <i className="fa-solid fa-chart-simple"></i><span>Analysis</span>
        </button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <i className="fa-solid fa-clock-rotate-left"></i><span>History</span>
        </button>
      </div>

      {/* PANELS */}
      {/* LAYERS TAB */}
      <div className={`tab-panel ${activeTab === 'layers' ? 'active' : ''}`}>
        <div className="panel-section">
          <h3 className="section-title"><i className="fa-solid fa-draw-polygon"></i> Site selection</h3>
          <p className="section-desc">Score one map click, or draw a polygon to combine several H3 hex cells.</p>
          <div className="radio-group">
            <label className="radio-opt">
              <input
                type="radio"
                name="mapSelectionMode"
                checked={selectionMode === 'point'}
                onChange={() => onSelectionModeChange?.('point')}
              />
              <span><i className="fa-solid fa-location-dot"></i> Point</span>
            </label>
            <label className="radio-opt">
              <input
                type="radio"
                name="mapSelectionMode"
                checked={selectionMode === 'area'}
                onChange={() => onSelectionModeChange?.('area')}
              />
              <span><i className="fa-solid fa-vector-square"></i> Draw area</span>
            </label>
          </div>
          {selectionMode === 'area' && areaDrawingActive && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <p className="section-desc" style={{ marginBottom: 8 }}>
                Corners on map: <strong>{areaDrawVertexCount}</strong> (need at least 3)
              </p>
              <button
                type="button"
                className="action-btn"
                style={{ width: '100%' }}
                disabled={areaDrawVertexCount < 3}
                onClick={() => onFinishAreaPolygon?.()}
              >
                <i className="fa-solid fa-check"></i> Complete polygon
              </button>
            </div>
          )}
          {selectionMode === 'area' && areaSelection?.count > 0 && !areaDrawingActive && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <p className="section-desc" style={{ marginBottom: 8 }}>
                <strong>{areaSelection.count}</strong> H3 cells inside your shape.
              </p>
              <button type="button" className="action-btn action-btn--ghost" style={{ width: '100%' }} onClick={() => onStartRedrawArea?.()}>
                <i className="fa-solid fa-rotate"></i> Redraw area
              </button>
            </div>
          )}
        </div>

        <div className="panel-section">
          <h3 className="section-title"><i className="fa-solid fa-database"></i> Data Layers</h3>
          <div className="layer-list">
            {layersConfig.map(layer => (
              <div key={layer.id} className="layer-item">
                <div className="layer-item__left">
                  <div className="layer-dot" style={{ backgroundColor: layer.color }}></div>
                  <div>
                    <div className="layer-name">{layer.name}</div>
                    <div className="layer-sub">{layer.sub}</div>
                  </div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={!!activeLayers[layer.id]} onChange={() => toggleLayer(layer.id)} />
                  <span className="toggle-track"></span>
                </label>
              </div>
            ))}
          </div>

          <div className="legend-box">
            <div className="legend-title">POI Categories</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#c96a5f' }}></span>Competitor</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#d9b15b' }}></span>Anchor Tenant</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#6f9a7a' }}></span>Complementary</div>
          </div>

          <div className="legend-box" style={{ marginTop: '12px' }}>
            <div className="legend-title">Transport Infrastructure</div>
            <div className="legend-row"><i className="fa-solid fa-bus" style={{ color: '#d9b15b', width: '16px', marginRight: '6px', textAlign: 'center' }}></i>Bus Stop</div>
            <div className="legend-row"><i className="fa-solid fa-train" style={{ color: '#c7895a', width: '16px', marginRight: '6px', textAlign: 'center' }}></i>Station</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#b96a5f', borderRadius: '2px', height: '4px' }}></span>Motorway / Trunk</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#c7895a', borderRadius: '2px', height: '4px' }}></span>Primary Road</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#d9b15b', borderRadius: '2px', height: '4px' }}></span>Secondary Road</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#6f9a7a', borderRadius: '2px', height: '4px' }}></span>Tertiary Road</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#aab9b2', borderRadius: '2px', height: '4px' }}></span>Residential Road</div>
          </div>

          <div className="h3-legend-box" style={{ display: activeLayers.h3grid ? 'block' : 'none' }}>
            <div className="legend-title">H3 Grid — Population Density</div>
            <div className="h3-legend-gradient"></div>
            <div className="h3-legend-labels">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
              <span>Very High</span>
            </div>
          </div>

          <div className="h3-legend-box" style={{ display: activeLayers.risk ? 'block' : 'none', marginTop: '12px' }}>
            <div className="legend-title">Environmental Risk — Flood Exposure</div>
            <div className="h3-legend-gradient" style={{ background: 'linear-gradient(to right, #6f9a7a, #d9b15b, #c7895a, #c96a5f)' }}></div>
            <div className="h3-legend-labels">
              <span>Safe</span>
              <span>Medium</span>
              <span>High</span>
              <span>Severe</span>
            </div>
          </div>
        </div>
      </div>

      {/* WEIGHTS TAB */}
      <div className={`tab-panel ${activeTab === 'weights' ? 'active' : ''}`}>
        <div className="panel-section">
          <h3 className="section-title"><i className="fa-solid fa-sliders"></i> Scoring Weights</h3>
          <p className="section-desc">Adjust factor importance. Weights auto-normalise to 100%.</p>
          <div className="weight-sliders">
            {Object.keys(weights).map(w => (
              <div key={w} className="slider-row">
                <div className="slider-header">
                  <span className="slider-label" style={{ textTransform: 'capitalize' }}>
                    {w === 'demographics' && <i className="fa-solid fa-people-group"></i>}
                    {w === 'transportation' && <i className="fa-solid fa-road"></i>}
                    {w === 'competition' && <i className="fa-solid fa-store"></i>}
                    {w === 'landuse' && <i className="fa-solid fa-map"></i>}
                    {w === 'risk' && <i className="fa-solid fa-triangle-exclamation"></i>}
                    {w}
                  </span>
                  <span className="slider-val">{weights[w]}%</span>
                </div>
                <input type="range" className="weight-slider" min="0" max="100" step="5" value={weights[w]} onChange={e => handleWeightChange(w, e.target.value)} />
              </div>
            ))}
          </div>

          <div className="weight-total-row">
            <span>Total</span>
            <span className="weight-total-val" style={{ color: weightTotal === 100 ? 'var(--success)' : 'var(--danger)' }}>
              {weightTotal}%
            </span>
          </div>
          <button className="action-btn action-btn--ghost" onClick={onResetWeights} style={{ marginTop: 12, width: '100%' }}>
            <i className="fa-solid fa-arrow-rotate-left"></i> Reset Weights
          </button>
        </div>
      </div>

      {/* CATCHMENT TAB */}
      <div className={`tab-panel ${activeTab === 'catchment' ? 'active' : ''}`}>
        <div className="panel-section">
          <h3 className="section-title"><i className="fa-solid fa-circle-dot"></i> Catchment Analysis</h3>
          <p className="section-desc">Drive or walk time from a selected site.</p>

          <div className="form-group">
            <label className="form-label">Travel Mode</label>
            <div className="radio-group">
              <label className="radio-opt">
                <input type="radio" value="drive" checked={travelMode === 'drive'} onChange={() => setTravelMode('drive')} />
                <span><i className="fa-solid fa-car"></i> Drive</span>
              </label>
              <label className="radio-opt">
                <input type="radio" value="walk" checked={travelMode === 'walk'} onChange={() => setTravelMode('walk')} />
                <span><i className="fa-solid fa-person-walking"></i> Walk</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Time Bands (minutes)</label>
            <div className="checkbox-group">
              <label className="check-opt">
                <input type="checkbox" checked={catchBands.includes(10)} onChange={() => toggleBand(10)} />
                <span className="check-badge" style={{ background: '#6f9a7a' }}>10 min</span>
              </label>
              <label className="check-opt">
                <input type="checkbox" checked={catchBands.includes(20)} onChange={() => toggleBand(20)} />
                <span className="check-badge" style={{ background: '#d9b15b' }}>20 min</span>
              </label>
              <label className="check-opt">
                <input type="checkbox" checked={catchBands.includes(30)} onChange={() => toggleBand(30)} />
                <span className="check-badge" style={{ background: '#c96a5f' }}>30 min</span>
              </label>
            </div>
          </div>

          <button className="action-btn" onClick={() => onCatchmentRun(travelMode, catchBands)}>
            <i className="fa-solid fa-bullseye"></i> Compute Catchment
          </button>

          {catchmentData && catchmentData.catchment && (
            <div className="catchment-result" style={{ marginTop: 16 }}>
              <h4 className="catchment-title" style={{ fontSize: 13, color: '#f7f2e8', marginBottom: 8 }}>Population Catchment</h4>
              <div id="catchment-bands">
                {Object.entries(catchmentData.catchment).map(([mins, pop]) => (
                  <div key={mins} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--surface)', borderRadius: 6, marginBottom: 4 }}>
                    <span style={{ color: '#d7e0d8', fontSize: 13 }}>{mins} Min</span>
                    <span style={{ color: '#d9b15b', fontSize: 13, fontWeight: 600 }}>{Number(pop).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ANALYSIS TAB */}
      <div className={`tab-panel ${activeTab === 'analysis' ? 'active' : ''}`}>
        <div className="panel-section">
          <h3 className="section-title"><i className="fa-solid fa-fire"></i> Hotspot & AI Analysis</h3>
          <p className="section-desc">Run comprehensive site evaluation or AI cluster detection across Ahmedabad.</p>

          <button className="action-btn" onClick={onRunAI} style={{ marginBottom: 8, background: '#a371f7', color: '#fff', borderColor: '#a371f7' }}>
            <i className="fa-solid fa-brain"></i> AI Site Readiness Analysis
          </button>

          {isHotspotsRunning ? (
            <button className="action-btn action-btn--ghost" onClick={onHotspotsCancel}>
              <i className="fa-solid fa-ban"></i> Cancel Hotspot
            </button>
          ) : (
            <button className="action-btn" onClick={onHotspotsRun}>
              <i className="fa-solid fa-fire"></i> Run Hotspot Clustering
            </button>
          )}

          {!isHotspotsRunning && hotspotsData && (
            <button className="action-btn action-btn--ghost" onClick={onHotspotsCancel} style={{ marginTop: 8 }}>
              <i className="fa-solid fa-xmark"></i> Clear Hotspot Grid
            </button>
          )}

          {hotspotsData && hotspotsData.summary && (
            <div className="hotspot-stats" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <div className="stat-card" style={{ flex: 1, padding: 12, background: 'var(--surface)', borderRadius: 8, textAlign: 'center' }}>
                <span className="stat-num" style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#c96a5f' }}>{hotspotsData.summary.hot_spots}</span>
                <span className="stat-lbl" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hot Spots</span>
              </div>
              <div className="stat-card" style={{ flex: 1, padding: 12, background: 'var(--surface)', borderRadius: 8, textAlign: 'center' }}>
                <span className="stat-num" style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#d9b15b' }}>{hotspotsData.summary.cold_spots}</span>
                <span className="stat-lbl" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cold Spots</span>
              </div>
              <div className="stat-card" style={{ flex: 1, padding: 12, background: 'var(--surface)', borderRadius: 8, textAlign: 'center' }}>
                <span className="stat-num" style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#8a6f4e' }}>{hotspotsData.summary.cluster_count}</span>
                <span className="stat-lbl" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Clusters</span>
              </div>
            </div>
          )}

          {scoreData && scoreData.ai_insight && (
            <div className="sidebar-ai-hint" style={{
              marginTop: 20,
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(163, 113, 247, 0.1) 0%, rgba(88, 166, 255, 0.05) 100%)',
              border: '1px solid rgba(163, 113, 247, 0.2)',
              borderRadius: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <i className="fa-solid fa-sparkles" style={{ color: '#a371f7', fontSize: '14px' }}></i>
                <span style={{ fontWeight: 600, fontSize: '12px', color: '#a371f7', textTransform: 'uppercase' }}>
                  AI Site Recommendations
                </span>
              </div>
              <div style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: '#d7e0d8' }}>
                {renderMarkdown(scoreData.ai_insight)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* HISTORY TAB */}
      <div className={`tab-panel ${activeTab === 'history' ? 'active' : ''}`}>
        <div className="panel-section">
          <h3 className="section-title"><i className="fa-solid fa-clock-rotate-left"></i> Visited Sites History</h3>
          <p className="section-desc">History of analyzed sites.</p>

          <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            {(!visitedHistory || visitedHistory.length === 0) ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                No sites visited yet.
              </div>
            ) : (
              visitedHistory.map((site, idx) => (
                <div
                  key={idx}
                  onClick={() => onHistoryClick?.(site)}
                  style={{
                    background: 'var(--surface-3)',
                    padding: '12px',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#d9b15b';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#f7f2e8', fontWeight: 600, fontSize: '14px' }}>{site.name}</span>
                    <span style={{ color: '#d9b15b', fontSize: '13px' }}>Score: {site.score} ({site.grade})</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHistory(idx);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#c96a5f', cursor: 'pointer', padding: '6px' }}
                    title="Delete History"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            className="action-btn"
            style={{ marginTop: 16, width: '100%', background: visitedHistory?.length >= 2 ? '#d9b15b' : 'var(--surface-3)', color: visitedHistory?.length >= 2 ? '#1a1c1a' : 'var(--text-muted)', cursor: visitedHistory?.length >= 2 ? 'pointer' : 'not-allowed' }}
            disabled={!visitedHistory || visitedHistory.length < 2}
            onClick={() => {
              if (onCompareOpen) onCompareOpen();
            }}
          >
            <i className="fa-solid fa-layer-group"></i> Compare Sites
          </button>
        </div>
      </div>
    </aside>
  );
}
