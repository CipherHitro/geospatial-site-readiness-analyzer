import React, { useState } from 'react';

const layersConfig = [
  { id: 'demographics', name: 'Demographics', sub: 'Population · Income · Age', color: '#58a6ff' },
  { id: 'transportation', name: 'Transportation', sub: 'Roads · Highways', color: '#d29922' },
  { id: 'poi', name: 'Points of Interest', sub: 'Competitors · Anchors · Amenities', color: '#e3883e' },
  { id: 'landuse', name: 'Land Use & Zoning', sub: 'Commercial · Industrial · Residential', color: '#3fb950' },
  { id: 'risk', name: 'Environmental Risk', sub: 'Flood · Industrial · Air Quality', color: '#f85149' },
  { id: 'h3grid', name: 'H3 Grid Overlay', sub: 'Hexagonal cell boundaries · Ahmedabad', color: '#79c0ff' }
];

export default function Sidebar({
  activeLayers, toggleLayer, weights, setWeights, onHotspotsRun, onCatchmentRun, onRescore, onRunAI, hotspotsData, catchmentData, scoreData,
  activeTab, setActiveTab
}) {
  const [catchMode, setCatchMode] = useState('drive');
  const [catchBands, setCatchBands] = useState([10, 20]);

  const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleWeightChange = (key, val) => {
    setWeights(prev => ({ ...prev, [key]: Number(val) }));
  };

  const toggleBand = (val) => {
    setCatchBands(prev => prev.includes(val) ? prev.filter(b => b !== val) : [...prev, val]);
  };

  return (
    <aside className="sidebar" id="sidebar">
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
      </div>

      {/* PANELS */}
      {/* LAYERS TAB */}
      <div className={`tab-panel ${activeTab === 'layers' ? 'active' : ''}`}>
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
            <div className="legend-row"><span className="legend-dot" style={{ background: '#f85149' }}></span>Competitor</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#58a6ff' }}></span>Anchor Tenant</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#3fb950' }}></span>Complementary</div>
          </div>

          <div className="legend-box" style={{ marginTop: '12px' }}>
            <div className="legend-title">Transport Infrastructure</div>
            <div className="legend-row"><i className="fa-solid fa-bus" style={{ color: '#58a6ff', width: '16px', marginRight: '6px', textAlign: 'center' }}></i>Bus Stop</div>
            <div className="legend-row"><i className="fa-solid fa-train" style={{ color: '#ab7df8', width: '16px', marginRight: '6px', textAlign: 'center' }}></i>Station</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#e63946', borderRadius: '2px', height: '4px' }}></span>Motorway / Trunk</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#f4a261', borderRadius: '2px', height: '4px' }}></span>Primary Road</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#e9c46a', borderRadius: '2px', height: '4px' }}></span>Secondary Road</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#2a9d8f', borderRadius: '2px', height: '4px' }}></span>Tertiary Road</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#8ab17d', borderRadius: '2px', height: '4px' }}></span>Residential Road</div>
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
            <div className="h3-legend-gradient" style={{ background: 'linear-gradient(to right, #3fb950, #d29922, #f85149, #8b0000)' }}></div>
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
          <button className="action-btn" onClick={onRescore} style={{ marginTop: 12, width: '100%' }}>
            <i className="fa-solid fa-rotate"></i> Re-Score Last Point
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
                <input type="radio" value="drive" checked={catchMode === 'drive'} onChange={() => setCatchMode('drive')} />
                <span><i className="fa-solid fa-car"></i> Drive</span>
              </label>
              <label className="radio-opt">
                <input type="radio" value="walk" checked={catchMode === 'walk'} onChange={() => setCatchMode('walk')} />
                <span><i className="fa-solid fa-person-walking"></i> Walk</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Time Bands (minutes)</label>
            <div className="checkbox-group">
              <label className="check-opt">
                <input type="checkbox" checked={catchBands.includes(10)} onChange={() => toggleBand(10)} />
                <span className="check-badge" style={{ background: '#4ade80' }}>10 min</span>
              </label>
              <label className="check-opt">
                <input type="checkbox" checked={catchBands.includes(20)} onChange={() => toggleBand(20)} />
                <span className="check-badge" style={{ background: '#fbbf24' }}>20 min</span>
              </label>
              <label className="check-opt">
                <input type="checkbox" checked={catchBands.includes(30)} onChange={() => toggleBand(30)} />
                <span className="check-badge" style={{ background: '#f87171' }}>30 min</span>
              </label>
            </div>
          </div>

          <button className="action-btn" onClick={() => onCatchmentRun(catchMode, catchBands)}>
            <i className="fa-solid fa-bullseye"></i> Compute Catchment
          </button>

          {catchmentData && catchmentData.catchment && (
            <div className="catchment-result" style={{ marginTop: 16 }}>
              <h4 className="catchment-title" style={{ fontSize: 13, color: '#c9d1d9', marginBottom: 8 }}>Population Catchment</h4>
              <div id="catchment-bands">
                {Object.entries(catchmentData.catchment).map(([mins, pop]) => (
                  <div key={mins} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--surface)', borderRadius: 6, marginBottom: 4 }}>
                    <span style={{ color: '#8b949e', fontSize: 13 }}>{mins} Min</span>
                    <span style={{ color: '#58a6ff', fontSize: 13, fontWeight: 600 }}>{Number(pop).toLocaleString()}</span>
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

          <button className="action-btn" onClick={onHotspotsRun}>
            <i className="fa-solid fa-fire"></i> Run Hotspot Clustering
          </button>

          {hotspotsData && hotspotsData.summary && (
            <div className="hotspot-stats" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <div className="stat-card" style={{ flex: 1, padding: 12, background: 'var(--surface)', borderRadius: 8, textAlign: 'center' }}>
                <span className="stat-num" style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#f85149' }}>{hotspotsData.summary.hot_spots}</span>
                <span className="stat-lbl" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hot Spots</span>
              </div>
              <div className="stat-card" style={{ flex: 1, padding: 12, background: 'var(--surface)', borderRadius: 8, textAlign: 'center' }}>
                <span className="stat-num" style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#58a6ff' }}>{hotspotsData.summary.cold_spots}</span>
                <span className="stat-lbl" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cold Spots</span>
              </div>
              <div className="stat-card" style={{ flex: 1, padding: 12, background: 'var(--surface)', borderRadius: 8, textAlign: 'center' }}>
                <span className="stat-num" style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#d29922' }}>{hotspotsData.summary.cluster_count}</span>
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
              <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.5', color: '#8b949e', fontStyle: 'italic' }}>
                "{scoreData.ai_insight}"
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
