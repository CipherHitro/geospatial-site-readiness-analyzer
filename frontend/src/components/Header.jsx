import React from 'react';

export default function Header({ onCompareOpen, useCase, onUseCaseChange, mapMode, onMapModeToggle, onSidebarToggle, onHotspotsRun, isSidebarOpen }) {
  return (
    <header className={`floating-header-controls ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`} id="topnav">
      <div className="floating-presets" id="preset-bar">
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

      <div className="floating-actions">
        <button className={`icon-btn ${mapMode === 'satellite' ? 'active' : ''}`} title="Toggle Satellite Map" onClick={onMapModeToggle}>
          <i className="fa-solid fa-earth-asia"></i>
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
      </div>
    </header>
  );
}
