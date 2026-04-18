import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';

export default function CompareModal({ isOpen, onClose, savedSites = [], useCase = 'retail' }) {
  const [userNeed, setUserNeed] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendedSiteId, setRecommendedSiteId] = useState(null);
  const chartRef = useRef(null);
  const canvasRef = useRef(null);

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
          label: site.name || `Site ${i + 1}`,
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
      <div className="modal" style={{ animation: 'slideUp .25s ease' }}>
        <div className="modal__header">
          <h2 className="modal__title"><i className="fa-solid fa-code-compare"></i> Site Comparison</h2>
          <button className="icon-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="compare-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="action-btn" onClick={async () => {
              const { default: jsPDF } = await import('jspdf');
              const { default: autoTable } = await import('jspdf-autotable');
              const doc = new jsPDF();
              doc.setFontSize(20);
              doc.text("Site Comparison Report", 14, 22);
              doc.setFontSize(12);
              doc.text(`Use Case: ${useCase.toUpperCase()}`, 14, 32);

              const head = [['Metric', ...savedSites.map(s => `${s.name} (${s.score})`)]];
              const rows = ['demographics', 'transportation', 'competition', 'landuse', 'risk'].map(metric => [
                metric.charAt(0).toUpperCase() + metric.slice(1),
                ...savedSites.map(s => Math.round(s.breakdown?.[metric] || 0).toString())
              ]);

              autoTable(doc, { startY: 40, head, body: rows, theme: 'grid', headStyles: { fillColor: [44, 46, 44] } });

              if (analysisResult) {
                const finalY = doc.lastAutoTable.finalY || 100;
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text("AI Analysis & Recommendation", 14, finalY + 15);

                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');

                let currentY = finalY + 22;
                const lines = analysisResult.split('\n');

                lines.forEach(line => {
                  let content = line.trim();
                  if (!content) {
                    currentY += 5;
                    return;
                  }

                  const isBullet = content.startsWith('-') || content.startsWith('*') || content.startsWith('•');
                  let startX = 14;
                  if (isBullet) {
                    doc.text("•", 14, currentY);
                    startX = 19;
                    content = content.replace(/^[-*•]\s?/, '');
                  }

                  // Split content into bold and normal parts
                  const parts = content.split(/(\*\*.*?\*\*)/g);
                  let currentX = startX;

                  parts.forEach(part => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      doc.setFont(undefined, 'bold');
                      const text = part.slice(2, -2);
                      doc.text(text, currentX, currentY);
                      currentX += doc.getTextWidth(text);
                    } else {
                      doc.setFont(undefined, 'normal');
                      doc.text(part, currentX, currentY);
                      currentX += doc.getTextWidth(part);
                    }
                  });

                  currentY += 7;
                  if (currentY > 280) {
                    doc.addPage();
                    currentY = 20;
                  }
                });
              }
              doc.save('site-comparison-report.pdf');
            }} style={{ width: 'auto', padding: '8px 18px' }}><i className="fa-solid fa-file-pdf"></i> Export PDF</button>
          </div>

          <div className="compare-layout">
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {savedSites.map((site, i) => <th key={i}>{site.name || `Site ${i + 1}`} ({site.score})</th>)}
                  </tr>
                </thead>
                <tbody>
                  {['demographics', 'transportation', 'competition', 'landuse', 'risk'].map(metric => (
                    <tr key={metric}>
                      <td style={{ textTransform: 'capitalize' }}>{metric}</td>
                      {savedSites.map((site, i) => (
                        <td key={i}>{Math.round(site.breakdown?.[metric] || 0)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="radar-wrap" style={{ width: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Radar Chart injects here */}
              <canvas ref={canvasRef} height="300"></canvas>
            </div>
          </div>

          {savedSites.length > 1 && (
            <div className="ai-analysis-section" style={{ background: '#1c1e1c', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
              <h3 style={{ marginBottom: '15px', color: '#d9b15b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px' }}>
                <i className="fa-solid fa-robot"></i> AI Site Recommendation
              </h3>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#d7e0d8', fontSize: '16px' }}>
                  Specific Needs or Context (Optional)
                </label>
                <textarea
                  value={userNeed}
                  onChange={(e) => setUserNeed(e.target.value)}
                  placeholder="E.g., I need a site with high foot traffic but low environmental risk..."
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #444', background: '#2c2e2c', color: '#fff', minHeight: '80px', fontFamily: 'Inter', fontSize: '15px' }}
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
                        demographics: s.demographics ? {
                          population: s.demographics.population,
                          wealth_index: s.demographics.relative_wealth_index,
                          income_score: s.demographics.income_score,
                          people_grouping: s.demographics.people_grouping
                        } : {},
                        transport: s.transport ? {
                          bus_score: s.transport.breakdown?.bus_score,
                          station_score: s.transport.breakdown?.station_score,
                          road_score: s.transport.breakdown?.road_score,
                          nearest_bus: s.transport.nearest_bus_stop,
                          nearest_station: s.transport.nearest_station
                        } : {},
                        zoning: s.zoning ? {
                          type: s.zoning.zone_type,
                          score: s.zoning.zoning_score,
                          density: s.zoning.building_count_500m
                        } : {},
                        poi: s.poi ? {
                          score: s.poi.poi_score || s.poi.score,
                          anchors: s.poi.anchor_count || s.poi.counts?.anchors,
                          competitors: s.poi.competitor_count || s.poi.counts?.competitors
                        } : {},
                        environment: s.environment ? {
                          aqi: s.environment.aqi,
                          flood_risk: s.environment.flood_score_raw,
                          score: s.environment.environment_score
                        } : {}
                      }
                    }))
                  };

                  try {
                    const res = await fetch(`${API_BASE_URL}/api/ai/compare`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
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
                style={{ background: '#d9b15b', color: '#1a1c1a', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}
              >
                {isAnalyzing ? <><i className="fa-solid fa-spinner fa-spin"></i> Analyzing...</> : <><i className="fa-solid fa-magic"></i> Suggest Best Site</>}
              </button>

              {analysisResult && (
                <div style={{ marginTop: '20px', padding: '20px', background: '#2c2e2c', borderRadius: '6px', fontSize: '16px', color: '#f7f2e8', lineHeight: '1.6' }}>
                  {renderMarkdown(analysisResult)}
                </div>
              )}
            </div>
          )}

          {savedSites.length === 0 && (
            <div className="compare-empty" style={{ textAlign: 'center', padding: '32px', color: '#d7e0d8', fontSize: '16px' }}>
              <i className="fa-solid fa-map-pin fa-2x" style={{ marginBottom: 12 }}></i>
              <p>Click map points → tap <strong>Compare</strong> in the score panel to add sites.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
