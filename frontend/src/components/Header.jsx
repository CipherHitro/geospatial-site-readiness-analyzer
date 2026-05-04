import React from 'react';

export default function Header({ useCase, onUseCaseChange, mapMode, onMapModeToggle, onSidebarToggle, isSidebarOpen }) {
  return (
    <header className={`floating-header-controls ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`} id="topnav">
      <div className="floating-presets" id="preset-bar">
        <button type="button" className={`preset-btn ${useCase === 'retail' ? 'active' : ''}`} onClick={() => onUseCaseChange('retail')}>
          <i className="fa-solid fa-store"></i> Retail
        </button>
        <button type="button" className={`preset-btn ${useCase === 'ev_charging' ? 'active' : ''}`} onClick={() => onUseCaseChange('ev_charging')}>
          <i className="fa-solid fa-charging-station"></i> EV Charging
        </button>
        <button type="button" className={`preset-btn ${useCase === 'warehouse' ? 'active' : ''}`} onClick={() => onUseCaseChange('warehouse')}>
          <i className="fa-solid fa-warehouse"></i> Warehouse
        </button>
        <button type="button" className={`preset-btn ${useCase === 'telecom' ? 'active' : ''}`} onClick={() => onUseCaseChange('telecom')}>
          <i className="fa-solid fa-tower-cell"></i> Telecom
        </button>
        <button type="button" className={`preset-btn ${useCase === 'renewable_energy' ? 'active' : ''}`} onClick={() => onUseCaseChange('renewable_energy')}>
          <i className="fa-solid fa-solar-panel"></i> Energy
        </button>
      </div>

      <div className="floating-actions">
        <button
          type="button"
          className="icon-btn"
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          onClick={onSidebarToggle}
        >
          <i className={`fa-solid ${isSidebarOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
        </button>
        <button type="button" className={`icon-btn ${mapMode === 'satellite' ? 'active' : ''}`} title="Toggle Satellite Map" onClick={onMapModeToggle}>
          <i className="fa-solid fa-earth-asia"></i>
        </button>
      </div>
    </header>
  );
}
