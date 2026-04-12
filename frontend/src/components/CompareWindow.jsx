import React, { useEffect, useRef, useState } from 'react';

export default function CompareWindow() {
  const [savedSites, setSavedSites] = useState([]);
  const [userNeed, setUserNeed] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendedSiteId, setRecommendedSiteId] = useState(null);
  const chartRef = useRef(null);
  const canvasRef = useRef(null);
  const useCase = localStorage.getItem('compareUseCase') || 'retail';

  useEffect(() => {
    // Load visited history from localStorage when the component mounts
    const saved = localStorage.getItem('visitedHistory');
    if (saved) {
      try {
        setSavedSites(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history', e);
      }
    }
  }, []);

  useEffect(() => {
    if (canvasRef.current && savedSites.length > 0) {
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const colors = ['#d9b15b', '#6f9a7a', '#c7895a', '#c96a5f', '#8a6f4e', '#aab9b2'];
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
          backgroundColor: `${colors[i % colors.length]}33`,
          borderColor: colors[i % colors.length],
          pointBackgroundColor: colors[i % colors.length],
          borderWidth: 2,
        };
      });

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
                pointLabels: { color: '#d7e0d8', font: { size: 13, family: 'Inter' } },
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
  }, [savedSites]);

  return (
    <div className="compare-window" style={{ minHeight: '100vh', background: 'var(--surface-2)', padding: '40px', color: '#f7f2e8', fontFamily: 'Inter' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', background: 'var(--surface)', borderRadius: '12px', padding: '30px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', border: '1px solid var(--surface-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '28px', color: '#d9b15b', margin: 0 }}><i className="fa-solid fa-code-compare"></i> In-Depth Site Comparison</h2>
          <div>
            <button className="action-btn" style={{ marginRight: '10px' }} onClick={() => window.close()}><i className="fa-solid fa-xmark"></i> Close Window</button>
          </div>
        </div>

        {savedSites.length === 0 ? (
           <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-map-pin fa-3x" style={{ marginBottom: '16px' }}></i>
              <p>No sites to compare. Please explore the map and try again.</p>
           </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div className="compare-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '30px' }}>
              <div className="compare-table-wrap" style={{ overflowX: 'auto', background: 'var(--surface-3)', borderRadius: '8px', padding: '1px' }}>
                <table className="compare-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <th style={{ padding: '16px', borderBottom: '1px solid var(--border)', color: '#d7e0d8' }}>Metric</th>
                      {savedSites.map((site, i) => (
                        <th key={i} style={{ padding: '16px', borderBottom: '1px solid var(--border)', color: '#f7f2e8' }}>
                          {site.name || `Site ${i+1}`} <br/><span style={{ color: '#d9b15b', fontWeight: 'normal', fontSize: '14px' }}>Score: {site.score}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['demographics', 'transportation', 'competition', 'landuse', 'risk'].map((metric, idx) => (
                      <tr key={metric} style={{ background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                        <td style={{ padding: '16px', borderBottom: '1px solid var(--border)', textTransform: 'capitalize', color: '#d7e0d8' }}>{metric}</td>
                        {savedSites.map((site, i) => (
                          <td key={i} style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{Math.round(site.breakdown[metric] || 0)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="radar-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-3)', borderRadius: '8px', padding: '20px' }}>
                <canvas ref={canvasRef} height="350"></canvas>
              </div>
            </div>

            {savedSites.length > 1 && (
              <div className="ai-analysis-section" style={{ background: 'var(--surface-3)', padding: '30px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h3 style={{ marginBottom: '20px', color: '#d9b15b', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '20px' }}>
                  <i className="fa-solid fa-robot"></i> AI Site Recommendation
                </h3>
                
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '10px', color: '#d7e0d8', fontSize: '15px' }}>
                    Specific Needs or Context (Optional)
                  </label>
                  <textarea 
                    value={userNeed}
                    onChange={(e) => setUserNeed(e.target.value)}
                    placeholder="E.g., I need a site with high foot traffic but low environmental risk..."
                    style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: '#fff', minHeight: '100px', fontFamily: 'Inter', resize: 'vertical' }}
                  />
                </div>

                <button 
                  onClick={async () => {
                    setIsAnalyzing(true);
                    setAnalysisResult('');
                    
                    const payload = {
                      use_case: useCase,
                      user_need: userNeed,
                      sites: savedSites.map((s, idx) => ({
                        id: `site_${idx}`,
                        name: s.name,
                        lat: s.lat,
                        lng: s.lng,
                        scores: {
                          overall: s.score || 0,
                          demographics: s.breakdown?.demographics || 0,
                          transportation: s.breakdown?.transportation || 0,
                          competition: s.breakdown?.competition || 0,
                          landuse: s.breakdown?.landuse || 0,
                          risk: s.breakdown?.risk || 0
                        },
                        layer_data: {
                          demographics: s.demographics || {},
                          transport: s.transport || {},
                          zoning: s.zoning || {},
                          poi: s.poi || {},
                          environment: s.environment || {}
                        }
                      }))
                    };
                    
                    try {
                      const res = await fetch('http://localhost:8000/api/ai/compare', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(payload)
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.detail || 'Analysis failed');
                      setAnalysisResult(data.analysis);
                      setRecommendedSiteId(data.recommended_site_id);
                    } catch (err) {
                      setAnalysisResult(`Error: ${err.message}`);
                    } finally {
                      setIsAnalyzing(false);
                    }
                  }}
                  disabled={isAnalyzing}
                  style={{ background: '#d9b15b', color: '#1a1c1a', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}
                >
                  {isAnalyzing ? <><i className="fa-solid fa-spinner fa-spin"></i> Analyzing...</> : <><i className="fa-solid fa-magic"></i> Suggest Best Site</>}
                </button>

                {analysisResult && (
                  <div style={{ marginTop: '25px', padding: '20px', background: 'var(--surface-2)', borderRadius: '8px', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '15px', color: '#f7f2e8', border: '1px solid var(--border)' }}>
                    {analysisResult}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
