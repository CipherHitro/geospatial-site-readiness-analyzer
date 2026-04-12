import React from 'react';

const SCORE_METRICS = [
  { key: 'demographics', label: 'Demographics', icon: 'fa-users', color: '#58a6ff' },
  { key: 'competition', label: 'Competition', icon: 'fa-store', color: '#a371f7' },
  { key: 'landuse', label: 'Land Use', icon: 'fa-map', color: '#3fb950' },
  { key: 'bus_score', label: 'Bus Access', icon: 'fa-bus', color: '#d29922' },
  { key: 'station_score', label: 'Rail Access', icon: 'fa-train', color: '#e3883e' },
  { key: 'road_score', label: 'Road Quality', icon: 'fa-road', color: '#58a6ff' },
  { key: 'risk', label: 'Flood Risk', icon: 'fa-water', color: '#f85149' },
];

const INCOME_COLORS = {
  upper_class: '#3fb950',
  upper_middle_class: '#58a6ff',
  middle_class: '#d29922',
  lower_middle_class: '#e3883e',
  lower_class: '#f85149',
};

function ScoreRing({ score }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * Math.min(score, 100)) / 100;
  const color = score >= 70 ? '#3fb950' : score >= 40 ? '#d29922' : '#f85149';
  const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';

  return (
    <div className="sp-ring-wrap">
      <svg className="sp-ring-svg" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="sp-ring-inner">
        <span className="sp-ring-score" style={{ color }}>{Math.round(score)}</span>
        <span className="sp-ring-grade" style={{ color }}>{grade}</span>
      </div>
    </div>
  );
}

function ProgressBar({ label, icon, value, color }) {
  const pct = Math.min(Math.max(value || 0, 0), 100);
  return (
    <div className="sp-bar-row">
      <div className="sp-bar-meta">
        <span className="sp-bar-label"><i className={`fa-solid ${icon}`} style={{ color, marginRight: 6 }} />{label}</span>
        <span className="sp-bar-val" style={{ color }}>{Math.round(pct)}</span>
      </div>
      <div className="sp-bar-track">
        <div
          className="sp-bar-fill"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
          }}
        />
      </div>
    </div>
  );
}

export default function ScorePanel({ scoreData, demographicsDetail, isVisible = true, onClose, onToggle, onCompareAdd }) {
  const hasData = scoreData !== null && scoreData !== undefined;
  const isOpen = hasData && isVisible;
  const demo = scoreData?.demographics || demographicsDetail;

  return (
    <>
      {/* ── Floating toggle button ── */}
      {hasData && (
        <button
          className="sp-toggle-btn"
          onClick={onToggle}
          title={isOpen ? 'Hide panel' : 'Show analysis panel'}
          style={{ bottom: isOpen ? 'var(--panel-h)' : 0 }}
        >
          <i className={`fa-solid fa-chevron-${isOpen ? 'down' : 'up'}`} />
          <span>{isOpen ? 'Hide Panel' : 'Show Results'}</span>
        </button>
      )}

      <div className={`score-panel ${isOpen ? 'open' : ''}`}>
        <div className="score-panel__drag" />

        {/* ── Header ── */}
        <div className="score-panel__header">
          <div className="score-panel__location">
            <i className="fa-solid fa-location-pin" />
            <span>
              {scoreData
                ? `${Number(scoreData.lat).toFixed(4)}, ${Number(scoreData.lng).toFixed(4)}`
                : 'Site Analysis'}
            </span>
            {scoreData?.constraint_failures?.length > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 11, color: '#f85149',
                background: 'rgba(248,81,73,0.1)', padding: '2px 8px',
                borderRadius: 4, fontWeight: 600,
              }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />
                {scoreData.constraint_failures[0]}
              </span>
            )}
          </div>
          <div className="score-panel__actions">
            <button className="pill-btn" onClick={() => onCompareAdd && onCompareAdd(scoreData)}>
              <i className="fa-solid fa-code-compare" /> Compare
            </button>
            <button className="icon-btn icon-btn--sm" onClick={onClose}>
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {scoreData && (
          <div className="score-panel__body">

            {/* ── LEFT: Overall Score Ring + Progress Bars ── */}
            <div className="sp-left">
              {/* Ring */}
              <div className="sp-ring-section">
                <ScoreRing score={scoreData.composite_score || scoreData.score || 0} />
                <div className="sp-ring-lbl">
                  {scoreData.composite_score ? `Unified Site Readiness: ${scoreData.score_label}` : 'Site Readiness Score'}
                </div>
              </div>

              {scoreData.layer_details?.zoning?.zone_type === 'restricted' && (
                <div style={{
                  margin: '12px 16px',
                  padding: '10px 12px',
                  background: 'rgba(248,81,73,0.1)',
                  border: '1px solid rgba(248,81,73,0.2)',
                  borderRadius: '8px',
                  color: '#f85149',
                  fontSize: '12px',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center'
                }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '16px' }}></i>
                  <span><strong>Restricted Zone Alert:</strong> This location is within a restricted area; viability is severely limited.</span>
                </div>
              )}

              {scoreData.ai_insight && (
                <div className="sp-ai-card" style={{
                  margin: '0 16px 16px',
                  padding: '16px',
                  background: 'linear-gradient(135deg, rgba(163, 113, 247, 0.15) 0%, rgba(88, 166, 255, 0.1) 100%)',
                  border: '1px solid rgba(163, 113, 247, 0.3)',
                  borderRadius: '12px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute', top: -10, right: -10,
                    fontSize: 60, opacity: 0.05, transform: 'rotate(15deg)', pointerEvents: 'none'
                  }}>
                    <i className="fa-solid fa-brain"></i>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <i className="fa-solid fa-sparkles" style={{ color: '#a371f7' }}></i>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#a371f7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      AI Strategic Insight
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-main)', fontStyle: 'italic' }}>
                    "{scoreData.ai_insight}"
                  </p>
                </div>
              )}

              {/* Progress bars for each active breakdown metric */}
              <div className="sp-bars-section">
                <div className="sp-section-title">Score Breakdown</div>
                <div className="sp-bars-list">
                  {SCORE_METRICS.map(({ key, label, icon, color }) => {
                    const val = scoreData.breakdown?.[key];
                    if (val === undefined || val === null) return null;
                    return (
                      <ProgressBar key={key} label={label} icon={icon} value={val} color={color} />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── RIGHT: Demographics Detail ── */}
            <div className="sp-right">
              {demo ? (
                <>
                  <div className="sp-section-title" style={{ marginBottom: 12 }}>
                    <i className="fa-solid fa-users" style={{ marginRight: 6, color: '#58a6ff' }} />
                    Market Demographics
                  </div>

                  {/* Score KPIs */}
                  <div className="sp-kpi-grid">
                    <div className="sp-kpi" style={{ borderColor: 'rgba(88,166,255,0.3)', background: 'rgba(88,166,255,0.05)' }}>
                      <span className="sp-kpi-val" style={{ color: '#58a6ff' }}>
                        {demo.demographics_score ?? '—'}
                      </span>
                      <span className="sp-kpi-lbl">Demo Score</span>
                    </div>
                    <div className="sp-kpi">
                      <span className="sp-kpi-val">{demo.pop_score != null ? Math.round(demo.pop_score) : '—'}</span>
                      <span className="sp-kpi-lbl">Pop Score</span>
                    </div>
                    <div className="sp-kpi">
                      <span className="sp-kpi-val">{demo.wealth_score != null ? Math.round(demo.wealth_score) : '—'}</span>
                      <span className="sp-kpi-lbl">Wealth Score</span>
                    </div>
                    <div className="sp-kpi">
                      <span className="sp-kpi-val">{demo.income_score != null ? Math.round(demo.income_score) : '—'}</span>
                      <span className="sp-kpi-lbl">Income Score</span>
                    </div>
                  </div>

                  {/* Raw stats */}
                  <div className="sp-stat-rows">
                    <div className="sp-stat-row">
                      <span className="sp-stat-lbl"><i className="fa-solid fa-people-group" /> Population (1km)</span>
                      <span className="sp-stat-val">{demo.population != null ? Number(demo.population).toLocaleString() : '—'}</span>
                    </div>
                    <div className="sp-stat-row">
                      <span className="sp-stat-lbl"><i className="fa-solid fa-coins" /> Wealth Index</span>
                      <span className="sp-stat-val">
                        {demo.relative_wealth_index != null ? Number(demo.relative_wealth_index).toFixed(3) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Income distribution */}
                  {demo.people_grouping && (
                    <div className="sp-income-dist">
                      <div className="sp-section-title" style={{ marginBottom: 8, marginTop: 4 }}>Income Distribution</div>
                      {Object.entries(demo.people_grouping).map(([group, pct]) => (
                        <div className="sp-income-row" key={group}>
                          <span className="sp-income-lbl">
                            <span
                              className="sp-income-dot"
                              style={{ background: INCOME_COLORS[group] || '#8b949e' }}
                            />
                            {group.replace(/_/g, ' ')}
                          </span>
                          <div className="sp-income-track">
                            <div
                              className="sp-income-fill"
                              style={{
                                width: `${pct}%`,
                                background: INCOME_COLORS[group] || '#8b949e',
                              }}
                            />
                          </div>
                          <span className="sp-income-val">{pct}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* POI summary if available */}
                  {scoreData.poi && (
                    <div className="sp-poi-summary">
                      <div className="sp-section-title" style={{ marginTop: 12, marginBottom: 8 }}>
                        <i className="fa-solid fa-map-location-dot" style={{ marginRight: 6, color: '#a371f7' }} />
                        POI: {scoreData.poi.label}
                      </div>

                      <div className="sp-kpi-grid">
                        <div className="sp-kpi" style={{ borderColor: 'rgba(163,113,247,0.3)', background: 'rgba(163,113,247,0.05)' }}>
                          <span className="sp-kpi-val" style={{ color: '#a371f7' }}>
                            {scoreData.poi.poi_score ? Math.round(scoreData.poi.poi_score) : (Math.round(scoreData.poi.score) || '—')}
                          </span>
                          <span className="sp-kpi-lbl">POI Score</span>
                        </div>
                        <div className="sp-kpi">
                          <span className="sp-kpi-val" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Anchors: {Math.round((scoreData.poi.weights_used?.anchor || 0) * 100)}%<br />
                            Compl.: {Math.round((scoreData.poi.weights_used?.complementary || 0) * 100)}%<br />
                            Comp.: {Math.round((scoreData.poi.weights_used?.competitor || 0) * 100)}%
                          </span>
                          <span className="sp-kpi-lbl">Active Weights</span>
                        </div>
                      </div>

                      <div className="sp-stat-rows">
                        <div className="sp-stat-row">
                          <span className="sp-stat-lbl" style={{ width: '120px' }}>
                            <i className="fa-solid fa-anchor" style={{ width: 14, color: '#58a6ff' }} /> Anchors
                          </span>
                          <span className="sp-stat-val" style={{ textAlign: 'right', color: '#58a6ff' }}>
                            {scoreData.poi.anchor_count ?? scoreData.poi.counts?.anchors ?? 0}
                            {scoreData.poi.anchor_score != null && (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                                ({Math.round(scoreData.poi.anchor_score)} pt)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="sp-stat-row">
                          <span className="sp-stat-lbl" style={{ width: '120px' }}>
                            <i className="fa-solid fa-thumbs-up" style={{ width: 14, color: '#3fb950' }} /> Complementary
                          </span>
                          <span className="sp-stat-val" style={{ textAlign: 'right', color: '#3fb950' }}>
                            {scoreData.poi.complementary_count ?? scoreData.poi.counts?.complementary ?? 0}
                            {scoreData.poi.complementary_score != null && (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                                ({Math.round(scoreData.poi.complementary_score)} pt)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="sp-stat-row">
                          <span className="sp-stat-lbl" style={{ width: '120px' }}>
                            <i className="fa-solid fa-store-slash" style={{ width: 14, color: '#f85149' }} /> Competitors
                          </span>
                          <span className="sp-stat-val" style={{ textAlign: 'right', color: '#f85149' }}>
                            {scoreData.poi.competitor_count ?? scoreData.poi.counts?.competitors ?? 0}
                            {scoreData.poi.competitor_score != null && (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                                ({Math.round(scoreData.poi.competitor_score)} pt)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Transport summary if available */}
                  {scoreData.transport && (
                    <div className="sp-poi-summary" style={{ marginTop: 16 }}>
                      <div className="sp-section-title" style={{ marginBottom: 12 }}>
                        <i className="fa-solid fa-car" style={{ marginRight: 6, color: '#e3883e' }} />
                        Transport & Accessibility
                      </div>
                      <div className="sp-kpi-grid">
                        <div className="sp-kpi" style={{ borderColor: 'rgba(210,153,34,0.3)', background: 'rgba(210,153,34,0.05)' }}>
                          <span className="sp-kpi-val" style={{ color: '#d29922' }}>
                            {scoreData.transport.transport_score ?? '—'}
                          </span>
                          <span className="sp-kpi-lbl">Transport Score</span>
                        </div>
                        <div className="sp-kpi">
                          <span className="sp-kpi-val" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Bus: {Math.round(scoreData.transport.weights_used?.bus * 100)}%<br />
                            Rail: {Math.round(scoreData.transport.weights_used?.station * 100)}%<br />
                            Road: {Math.round(scoreData.transport.weights_used?.road * 100)}%
                          </span>
                          <span className="sp-kpi-lbl">Active Weights</span>
                        </div>
                      </div>

                      <div className="sp-stat-rows">
                        <div className="sp-stat-row">
                          <span className="sp-stat-lbl" style={{ width: '120px' }}>
                            <i className="fa-solid fa-bus" style={{ width: 14 }} /> Nearest Bus
                          </span>
                          <span className="sp-stat-val" style={{ textAlign: 'right' }}>
                            {scoreData.transport.nearest_bus_stop}
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>
                              ({scoreData.transport.bus_stop_distance_m}m)
                            </span>
                          </span>
                        </div>
                        <div className="sp-stat-row">
                          <span className="sp-stat-lbl" style={{ width: '120px' }}>
                            <i className="fa-solid fa-train" style={{ width: 14 }} /> Nearest Station
                          </span>
                          <span className="sp-stat-val" style={{ textAlign: 'right' }}>
                            {scoreData.transport.nearest_station}
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>
                              ({scoreData.transport.station_distance_m}m)
                            </span>
                          </span>
                        </div>
                        <div className="sp-stat-row">
                          <span className="sp-stat-lbl">
                            <i className="fa-solid fa-road" style={{ width: 14 }} /> Primary Roads (500m)
                          </span>
                          <span className="sp-stat-val">
                            {Number(scoreData.transport.total_road_length_m).toLocaleString()}m
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Zoning summary if available */}
                  {scoreData.zoning && (
                    <div className="sp-poi-summary" style={{ marginTop: 16 }}>
                      <div className="sp-section-title" style={{ marginBottom: 12 }}>
                        <i className="fa-solid fa-city" style={{ marginRight: 6, color: '#f85149' }} />
                        Land Use & Zoning
                      </div>
                      <div className="sp-kpi-grid">
                        <div className="sp-kpi" style={{ borderColor: 'rgba(248,81,73,0.3)', background: 'rgba(248,81,73,0.05)' }}>
                          <span className="sp-kpi-val" style={{ color: '#f85149' }}>
                            {scoreData.zoning.zoning_score ?? '—'}
                          </span>
                          <span className="sp-kpi-lbl">Zoning Score</span>
                        </div>
                        <div className="sp-kpi">
                          <span className="sp-kpi-val" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Zone: {Math.round((scoreData.zoning.weights_used?.zone || 0) * 100)}%<br />
                            Den: {Math.round((scoreData.zoning.weights_used?.density || 0) * 100)}%<br />
                            Mix: {Math.round((scoreData.zoning.weights_used?.mix || 0) * 100)}%
                          </span>
                          <span className="sp-kpi-lbl">Active Weights</span>
                        </div>
                      </div>

                      <div className="sp-stat-rows">
                        <div className="sp-stat-row">
                          <span className="sp-stat-lbl" style={{ width: '120px' }}>
                            <i className="fa-solid fa-building" style={{ width: 14 }} /> Zone Type
                          </span>
                          <span className="sp-stat-val" style={{ textAlign: 'right', textTransform: 'capitalize' }}>
                            {scoreData.zoning.zone_type}
                            {scoreData.zoning.breakdown?.zone_score != null && (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                                ({Math.round(scoreData.zoning.breakdown.zone_score)} pt)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="sp-stat-row">
                          <span className="sp-stat-lbl" style={{ width: '120px' }}>
                            <i className="fa-solid fa-layer-group" style={{ width: 14 }} /> Density
                          </span>
                          <span className="sp-stat-val" style={{ textAlign: 'right' }}>
                            {scoreData.zoning.building_count_500m} Bldgs
                            {scoreData.zoning.breakdown?.building_density_score != null && (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                                ({Math.round(scoreData.zoning.breakdown.building_density_score)} pt)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="sp-stat-row">
                          <span className="sp-stat-lbl" style={{ width: '120px' }}>
                            <i className="fa-solid fa-chart-pie" style={{ width: 14 }} /> Mix Score
                          </span>
                          <span className="sp-stat-val" style={{ textAlign: 'right' }}>
                            {scoreData.zoning.breakdown?.commercial_mix_score != null ? Math.round(scoreData.zoning.breakdown.commercial_mix_score) : '—'} pt
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Environment summary if available */}
                  {scoreData.environment && (
                    <div className="sp-poi-summary" style={{ marginTop: 16 }}>
                      <div className="sp-section-title" style={{ marginBottom: 12 }}>
                        <i className="fa-solid fa-leaf" style={{ marginRight: 6, color: '#3fb950' }} />
                        Environment & Safety
                      </div>
                      <div className="sp-kpi-grid">
                        <div className="sp-kpi" style={{ borderColor: 'rgba(63,185,80,0.3)', background: 'rgba(63,185,80,0.05)' }}>
                          <span className="sp-kpi-val" style={{ color: '#3fb950' }}>
                            {scoreData.environment.environment_score ?? '—'}
                          </span>
                          <span className="sp-kpi-lbl">Risk Score</span>
                        </div>
                        <div className="sp-kpi">
                          <span className="sp-kpi-val" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Fld: {Math.round((scoreData.environment.weights_used?.flood || 0) * 100)}%<br />
                            AQI: {Math.round((scoreData.environment.weights_used?.aqi || 0) * 100)}%<br />
                            Eq: {Math.round((scoreData.environment.weights_used?.earthquake || 0) * 100)}%
                          </span>
                          <span className="sp-kpi-lbl">Active Weights</span>
                        </div>
                      </div>

                      <div className="sp-stat-rows">
                        <div className="sp-stat-row">
                          <span className="sp-stat-lbl" style={{ width: '120px' }}>
                            <i className="fa-solid fa-water" style={{ width: 14 }} /> Flood Risk
                          </span>
                          <span className="sp-stat-val" style={{ textAlign: 'right' }}>
                            {(scoreData.environment.flood_score_raw * 100).toFixed(0)}%
                            {scoreData.environment.flood_safety_score != null && (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                                ({Math.round(scoreData.environment.flood_safety_score)} pt)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="sp-stat-row">
                          <span className="sp-stat-lbl" style={{ width: '120px' }}>
                            <i className="fa-solid fa-smog" style={{ width: 14 }} /> AQI
                          </span>
                          <span className="sp-stat-val" style={{ textAlign: 'right' }}>
                            {scoreData.environment.aqi ?? 'N/A'}
                            {scoreData.environment.aqi_score != null && (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                                ({Math.round(scoreData.environment.aqi_score)} pt)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="sp-stat-row">
                          <span className="sp-stat-lbl" style={{ width: '120px' }}>
                            <i className="fa-solid fa-house-crack" style={{ width: 14 }} /> Seismic
                          </span>
                          <span className="sp-stat-val" style={{ textAlign: 'right' }}>
                            Zone 3
                            {scoreData.environment.earthquake_score != null && (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                                ({Math.round(scoreData.environment.earthquake_score)} pt)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="sp-empty-state">
                  <i className="fa-solid fa-users" style={{ fontSize: 32, color: 'var(--border)', marginBottom: 12 }} />
                  <p>Enable the <strong>Demographics</strong> layer<br />to see market insights here.</p>
                </div>
              )}
            </div>

            {/* ── RECOMMENDATIONS ── */}
            {scoreData.recommendations?.length > 0 && (
              <div className="sp-recs">
                <div className="sp-section-title" style={{ marginBottom: 10 }}>
                  <i className="fa-solid fa-lightbulb" style={{ color: '#d29922', marginRight: 6 }} />
                  Insights
                </div>
                <ul className="sp-recs-list">
                  {scoreData.recommendations.slice(0, 4).map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
