import React from 'react';

export default function Header({ onCompareOpen, useCase, onUseCaseChange, theme, onThemeToggle, onSidebarToggle, onHotspotsRun }) {
  return (
    <header className="topnav" id="topnav">
      <div className="topnav__brand">
        <div className="topnav__logo">
          <i className="fa-solid fa-location-crosshairs"></i>
        </div>
        <div>
          <span className="topnav__title">SiteReadiness<span className="topnav__title--accent">AI</span></span>
          <span className="topnav__sub">Ahmedabad Intelligence Platform</span>
        </div>
      </div>

      <div className="topnav__presets" id="preset-bar">
        <span className="preset-label">Use Case:</span>
        <button className={`preset-btn ${useCase === 'retail' ? 'active' : ''}`} onClick={() => onUseCaseChange('retail')}>
          <i className="fa-solid fa-store"></i> Retail
        </button>
        <button className={`preset-btn ${useCase === 'ev_charging' ? 'active' : ''}`} onClick={() => onUseCaseChange('ev_charging')}>
          <i className="fa-solid fa-charging-station"></i> EV Charging
        </button>
        <button className={`preset-btn ${useCase === 'warehouse' ? 'active' : ''}`} onClick={() => onUseCaseChange('warehouse')}>
          <i className="fa-solid fa-warehouse"></i> Warehouse
        </button>
        <button className={`preset-btn ${useCase === 'telecom' ? 'active' : ''}`} onClick={() => onUseCaseChange('telecom')}>
          <i className="fa-solid fa-tower-cell"></i> Telecom
        </button>
        <button className={`preset-btn ${useCase === 'renewable_energy' ? 'active' : ''}`} onClick={() => onUseCaseChange('renewable_energy')}>
          <i className="fa-solid fa-solar-panel"></i> Energy
        </button>
      </div>

      <div className="topnav__actions">
        <button className="icon-btn" title="Toggle Theme" onClick={onThemeToggle}>
          <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>
        <button className="icon-btn" title="Run Hotspot Analysis" onClick={onHotspotsRun}>
          <i className="fa-solid fa-fire"></i>
        </button>
        <button className="icon-btn" title="Compare Sites" onClick={onCompareOpen}>
          <i className="fa-solid fa-code-compare"></i>
        </button>
        <button className="icon-btn" title="Toggle Sidebar" onClick={onSidebarToggle}>
          <i className="fa-solid fa-sidebar"></i>
        </button>
        <div className="status-dot" title="API Status">
          <span className="dot dot--green" style={{ boxShadow: '0 0 6px #3fb950', background: '#3fb950' }}></span>
        </div>
      </div>
    </header>
  );
}
