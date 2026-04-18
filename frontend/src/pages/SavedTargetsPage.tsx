// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Saved Targets Page (Rewritten)
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useMemo } from 'react';
import { useMissionStore } from '@/store/missionStore';
import { api } from '@/services/api';
import { StatusBadge, SectionHeader, EmptyState } from '@/components/shared';
import type { SavedTarget } from '@/types';

export default function SavedTargetsPage() {
  const targets = useMissionStore((s) => s.savedTargets);
  const fetchSavedTargets = useMissionStore((s) => s.fetchSavedTargets);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<SavedTarget | null>(null);

  useEffect(() => {
    fetchSavedTargets();
    const i = setInterval(fetchSavedTargets, 3000);
    return () => clearInterval(i);
  }, [fetchSavedTargets]);

  const handleClearAll = async () => {
    try {
      await fetch(`${(api as any).baseUrl || 'http://localhost:8080'}/api/targets`, { method: 'DELETE' });
      useMissionStore.getState().setSavedTargets([]);
    } catch {}
  };

  const filteredTargets = useMemo(() => {
    return targets.filter(t => 
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.pose?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [targets, searchTerm]);

  return (
    <div className="gcs-page">
      <div className="gcs-page-header">
        <div>
          <h1 className="gcs-page-title">Saved Targets</h1>
          <p className="gcs-page-desc">Database of all identified subjects and coordinates</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gcs-text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input 
              type="text" 
              placeholder="Search ID or Pose..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="gcs-input"
              style={{ width: 240, paddingLeft: 36 }}
            />
          </div>
          <button className="gcs-btn gcs-btn-danger" style={{ padding: '8px 16px', fontSize: 12 }} onClick={handleClearAll}>
            Clear All
          </button>
        </div>
      </div>

      <div className="gcs-card" style={{ overflow: 'hidden' }}>
        {filteredTargets.length === 0 ? (
          <EmptyState 
            title="No targets found" 
            description={searchTerm ? `No results for "${searchTerm}"` : "Target database is empty"} 
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="gcs-table">
              <thead>
                <tr>
                  <th>Target ID</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Pose</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTargets.map(t => (
                  <tr 
                    key={t.id} 
                    onClick={() => setSelectedTarget((t as any))} // Type workaround for UI display
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="gcs-mono" style={{ fontWeight: 600, color: 'var(--gcs-accent)' }}>{t.id}</span>
                    </td>
                    <td>
                      <span className="gcs-mono" style={{ color: 'var(--gcs-text3)' }}>
                        {t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : '--:--'}
                      </span>
                    </td>
                    <td>
                      <span className="gcs-mono" style={{ color: 'var(--gcs-text2)' }}>
                        {t.gps_lat?.toFixed(5) || '---'}, {t.gps_lon?.toFixed(5) || '---'}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{t.pose || 'Unknown'}</td>
                    <td>
                      <span className="gcs-mono" style={{ fontWeight: 500 }}>{t.severity}/10</span>
                    </td>
                    <td>
                      <StatusBadge 
                        status={t.severity >= 7 ? 'danger' : t.severity >= 4 ? 'warning' : 'success'} 
                        label={t.status || 'DETECTED'} 
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedTarget && (
        <div className="gcs-modal-overlay" onClick={() => setSelectedTarget(null)}>
          <div className="gcs-modal" style={{ width: 500, padding: 24 }} onClick={e => e.stopPropagation()}>
            <SectionHeader 
              title="Target Details" 
              actions={<button onClick={() => setSelectedTarget(null)} className="gcs-btn gcs-btn-ghost" style={{ padding: '4px 8px' }}>✕</button>}
            />
            
            <div className="gcs-stack gcs-stack-lg">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="gcs-mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--gcs-accent)', lineHeight: 1 }}>{selectedTarget.id}</div>
                  <div className="gcs-mono" style={{ fontSize: 11, color: 'var(--gcs-text3)', marginTop: 8 }}>
                    {selectedTarget.timestamp ? new Date(selectedTarget.timestamp).toLocaleString() : 'Time unknown'}
                  </div>
                </div>
                <StatusBadge 
                  status={selectedTarget.severity >= 7 ? 'danger' : selectedTarget.severity >= 4 ? 'warning' : 'success'} 
                  label={`SEVERITY ${selectedTarget.severity}/10`} 
                />
              </div>

              <div className="gcs-grid-2">
                <div style={{ background: 'var(--gcs-surface)', padding: 16, borderRadius: 'var(--gcs-radius-sm)', border: '1px solid var(--gcs-border)' }}>
                  <div className="gcs-mono" style={{ fontSize: 10, color: 'var(--gcs-text3)', marginBottom: 8 }}>LOCATION (WGS84)</div>
                  <div className="gcs-mono" style={{ fontSize: 13 }}>LAT: {selectedTarget.gps_lat?.toFixed(6) || '---'}</div>
                  <div className="gcs-mono" style={{ fontSize: 13, marginTop: 4 }}>LON: {selectedTarget.gps_lon?.toFixed(6) || '---'}</div>
                </div>
                <div style={{ background: 'var(--gcs-surface)', padding: 16, borderRadius: 'var(--gcs-radius-sm)', border: '1px solid var(--gcs-border)' }}>
                  <div className="gcs-mono" style={{ fontSize: 10, color: 'var(--gcs-text3)', marginBottom: 8 }}>SUBJECT STATE</div>
                  <div style={{ fontSize: 13, textTransform: 'capitalize' }}>Pose: {selectedTarget.pose || 'Unknown'}</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Status: {selectedTarget.status || 'Detected'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="gcs-btn gcs-btn-primary" style={{ flex: 1 }}>Deploy Payload</button>
                <button className="gcs-btn gcs-btn-ghost" style={{ flex: 1 }} onClick={() => {
                  setSelectedTarget(null);
                  useMissionStore.getState().setActiveTab('tactical-map');
                }}>View on Map</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
