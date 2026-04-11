import React from 'react';

export default function ScorePanel({ scoreData, onClose, onCompareAdd }) {
  const isOpen = scoreData !== null;

  return (
    <div className={`score-panel ${isOpen ? 'open' : ''}`}>
      <div className="score-panel__drag"></div>

      <div className="score-panel__header">
        <div className="score-panel__location">
          <i className="fa-solid fa-location-pin"></i>
          <span>{scoreData ? `${scoreData.lat.toFixed(4)}, ${scoreData.lng.toFixed(4)}` : 'Site Analysis'}</span>
        </div>
        <div className="score-panel__actions">
          <button className="pill-btn" onClick={() => onCompareAdd(scoreData)}><i className="fa-solid fa-code-compare"></i> Compare</button>
          <button className="icon-btn icon-btn--sm" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
      </div>

      {scoreData && (
        <div className="score-panel__body">
          <div className="constraint-flags" style={{ display: (scoreData.constraint_failures?.length > 0) ? 'block' : 'none', marginBottom: 12 }}>
            <span className="flag flag--fail" style={{ color: '#f85149', background: 'rgba(248,81,73,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', display: 'inline-block' }}>
              <i className="fa-solid fa-triangle-exclamation"></i> {scoreData.constraint_failures?.[0]}
            </span>
          </div>

          {/* Gauge area */}
          <div className="gauge-zone">
            <div className="gauge-wrap">
              <svg className="gauge-svg" viewBox="0 0 200 120">
                <defs>
                  <linearGradient id="gGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f85149" />
                    <stop offset="50%" stopColor="#d29922" />
                    <stop offset="100%" stopColor="#3fb950" />
                  </linearGradient>
                </defs>
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#21262d" strokeWidth="14" strokeLinecap="round" />
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gGrad)" strokeWidth="14" strokeLinecap="round" strokeDasharray="251.2" strokeDashoffset={`${251.2 - (251.2 * scoreData.score / 100)}`} />
                <text x="18" y="116" fontSize="10" fill="#8b949e">0</text>
                <text x="100" y="18" fontSize="10" fill="#8b949e" textAnchor="middle">50</text>
                <text x="178" y="116" fontSize="10" fill="#8b949e" textAnchor="end">100</text>
              </svg>
              <div className="gauge-score">{scoreData.score}</div>
              <div className="gauge-grade" style={{ background: 'rgba(63,185,80,0.1)', color: '#3fb950' }}>
                Grade {scoreData.grade}
              </div>
            </div>
          </div>

          {/* Breakdown area */}
          <div className="breakdown-section">
            <h4 className="breakdown-title">Score Breakdown</h4>
            <div className="breakdown-bars">
              {Object.entries(scoreData.breakdown).map(([key, val]) => (
                <div key={key}>
                  <div className="breakdown-bar-header">
                    <span className="breakdown-bar-label" style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
                    <span className="breakdown-bar-score">{Math.round(val)}</span>
                  </div>
                  <div className="breakdown-bar-track">
                    <div className="breakdown-bar-fill" style={{ width: `${val}%`, background: val >= 70 ? '#3fb950' : (val >= 40 ? '#d29922' : '#f85149') }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {scoreData.recommendations && scoreData.recommendations.length > 0 && (
            <div className={`recs-section ${scoreData.demographics ? 'with-details' : ''}`}>
              <h4 className="recs-title"><i className="fa-solid fa-lightbulb"></i> AI Recommendations</h4>
              <ul className="recs-list">
                {scoreData.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
              </ul>
            </div>
          )}

          {scoreData.demographics && (
            <div className="demographics-details">
              <h4 className="breakdown-title">Market Demographics</h4>
              <div className="stats-grid">
                <div className="stat-box">
                  <span className="stat-box__val">{scoreData.demographics.population.toLocaleString()}</span>
                  <span className="stat-box__lbl">Population (1km)</span>
                </div>
                <div className="stat-box">
                  <span className="stat-box__val">{scoreData.demographics.relative_wealth_index.toFixed(3)}</span>
                  <span className="stat-box__lbl">Wealth Index</span>
                </div>
              </div>

              <div className="income-dist">
                <h5 className="breakdown-title" style={{ fontSize: '10px', marginBottom: '8px' }}>Income Breakdown</h5>
                {Object.entries(scoreData.demographics.people_grouping).map(([group, val]) => (
                  <div className="dist-row" key={group}>
                    <span className="dist-lbl">{group.replace(/_/g, ' ')}</span>
                    <div className="dist-track">
                      <div className="dist-fill" style={{ width: `${val}%` }}></div>
                    </div>
                    <span className="dist-val">{val}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
