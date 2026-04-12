import React, { useEffect, useRef } from 'react';

export default function CompareModal({ isOpen, onClose, savedSites = [] }) {
  const chartRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Only draw the chart if modal is open and we have sites
    if (isOpen && canvasRef.current && savedSites.length > 0) {
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      // Hardcoded colors for rendering sites
      const colors = ['#d9b15b', '#6f9a7a', '#c7895a', '#c96a5f'];

      const labels = ['Demographics', 'Transportation', 'Competition', 'Land Use', 'Risk'];
      
      const datasets = savedSites.map((site, i) => {
        const bd = site.breakdown || {};
        return {
          label: site.name || `Site ${i+1}`,
          data: [
            bd.demographics || 0,
            bd.transportation || 0,
            bd.competition || 0,
            bd.landuse || 0,
            bd.risk || 0
          ],
          backgroundColor: `${colors[i % colors.length]}33`, // 20% opacity
          borderColor: colors[i % colors.length],
          pointBackgroundColor: colors[i % colors.length],
          borderWidth: 2,
        };
      });

      // Assume Chart is globally available via CDN or script tag
      if (window.Chart) {
        chartRef.current = new window.Chart(canvasRef.current, {
          type: 'radar',
          data: { labels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              r: {
                angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                pointLabels: { color: '#d7e0d8', font: { size: 11, family: 'Inter' } },
                ticks: { display: false, min: 0, max: 100 }
              }
            },
            plugins: {
              legend: { labels: { color: '#f7f2e8', font: { family: 'Inter' } } }
            }
          }
        });
      }
    }

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [isOpen, savedSites]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{animation: 'slideUp .25s ease'}}>
        <div className="modal__header">
          <h2 className="modal__title"><i className="fa-solid fa-code-compare"></i> Site Comparison</h2>
          <button className="icon-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        
        <div className="modal__body">
          <div className="compare-toolbar">
             <button className="action-btn" style={{width: 'auto', padding: '8px 18px'}}><i className="fa-solid fa-file-csv"></i> Export CSV</button>
          </div>

          <div className="compare-layout">
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {savedSites.map((site, i) => <th key={i}>{site.name || `Site ${i+1}`} ({site.score})</th>)}
                  </tr>
                </thead>
                <tbody>
                  {['demographics', 'transportation', 'competition', 'landuse', 'risk'].map(metric => (
                    <tr key={metric}>
                      <td style={{textTransform:'capitalize'}}>{metric}</td>
                      {savedSites.map((site, i) => (
                        <td key={i}>{Math.round(site.breakdown[metric] || 0)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="radar-wrap" style={{width: 280, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              {/* Radar Chart injects here */}
              <canvas ref={canvasRef} height="300"></canvas>
            </div>
          </div>
          
          {savedSites.length === 0 && (
            <div className="compare-empty" style={{textAlign: 'center', padding: '32px', color: '#d7e0d8'}}>
              <i className="fa-solid fa-map-pin fa-2x" style={{marginBottom: 12}}></i>
              <p>Click map points → tap <strong>Compare</strong> in the score panel to add sites.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
