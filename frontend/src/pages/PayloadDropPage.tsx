// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Payload Drop Page (Rewritten)
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useMissionStore } from '@/store/missionStore';
import { api } from '@/services/api';
import { MetricCard, SectionHeader, EmptyState } from '@/components/shared';

export default function PayloadDropPage() {
  const status = useMissionStore((s) => s.payloadStatus);
  const addActionLog = useMissionStore((s) => s.addActionLog);
  const targets = useMissionStore((s) => s.savedTargets);
  const fetchMapTargets = useMissionStore((s) => s.fetchSavedTargets);
  
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [isDropping, setIsDropping] = useState(false);
  const [dropState, setDropState] = useState<'idle' | 'arming' | 'dropped'>('idle');
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => { fetchMapTargets(); }, [fetchMapTargets]);

  useEffect(() => {
    const fetchHistory = async () => { try { const h = await api.getPayloadHistory(); setHistory(h); } catch {} };
    fetchHistory();
  }, [dropState]);

  const handleDrop = async () => {
    if (!selectedTargetId) return;
    const target = targets.find(t => t.id === selectedTargetId);
    if (!target) return;

    setIsDropping(true);
    setDropState('arming');
    addActionLog({ timestamp: new Date().toISOString(), action_type: 'PAYLOAD', context: `Arming for ${target.id}...`, status: 'warning' });

    setTimeout(async () => {
      try {
        await api.dropPayload({ target_id: target.id, gps_lat: target.gps_lat, gps_lon: target.gps_lon, drop_mode: 'SERVO' });
        setDropState('dropped');
        addActionLog({ timestamp: new Date().toISOString(), action_type: 'PAYLOAD', context: `Dropped on ${target.id}`, status: 'success' });
        // Reset after 3s
        setTimeout(() => { setDropState('idle'); setIsDropping(false); setSelectedTargetId(''); }, 3000);
      } catch {
        setDropState('idle');
        setIsDropping(false);
        addActionLog({ timestamp: new Date().toISOString(), action_type: 'PAYLOAD', context: `Drop failed for ${target.id}`, status: 'failure' });
      }
    }, 1500); // simulate arming delay
  };

  return (
    <div className="gcs-page">
      <div className="gcs-page-header">
        <div>
          <h1 className="gcs-page-title">Payload Delivery</h1>
          <p className="gcs-page-desc">Manage and deploy emergency relief payloads</p>
        </div>
      </div>

      <div className="gcs-stack gcs-stack-xl">
        {/* Status System */}
        <div className="gcs-grid-4">
          <MetricCard 
            label="System" 
            value={status.ready ? 'Ready' : 'Not Ready'} 
            accent={status.ready ? 'var(--gcs-success)' : 'var(--gcs-danger)'} 
          />
          <MetricCard 
            label="Servo" 
            value={status.servo_connected ? 'Connected' : 'Offline'} 
            accent={status.servo_connected ? 'var(--gcs-success)' : 'var(--gcs-text3)'} 
          />
          <MetricCard 
            label="Payloads" 
            value={status.payload_count} 
            accent="var(--gcs-payload)" 
          />
          <MetricCard 
            label="Last Drop" 
            value={status.last_drop_time ? new Date(status.last_drop_time).toLocaleTimeString() : '---'} 
            subtext={history[0]?.target_id ? `Target: ${history[0].target_id}` : undefined}
          />
        </div>

        {/* Action Area */}
        <div className="gcs-grid-2">
          {/* Controls */}
          <div className="gcs-card" style={{ padding: 24 }}>
            <SectionHeader title="Deployment Control" />
            <div className="gcs-stack gcs-stack-md">
              <div>
                <label className="gcs-mono" style={{ fontSize: 11, color: 'var(--gcs-text3)', display: 'block', marginBottom: 8 }}>SELECT TARGET</label>
                <select 
                  className="gcs-select" 
                  value={selectedTargetId} 
                  onChange={e => setSelectedTargetId(e.target.value)}
                  disabled={isDropping}
                  style={{ width: '100%', fontSize: 14 }}
                >
                  <option value="">-- Select a saved target --</option>
                  {targets.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.id} [{t.severity}/10]
                    </option>
                  ))}
                </select>
              </div>

              {selectedTargetId && targets.find(t => t.id === selectedTargetId) && (
                <div style={{ background: 'var(--gcs-surface)', padding: 16, borderRadius: 'var(--gcs-radius-sm)', border: '1px solid var(--gcs-border)' }}>
                  <div className="gcs-mono" style={{ fontSize: 10, color: 'var(--gcs-text3)', marginBottom: 8 }}>TARGET COORDINATES</div>
                  <div className="gcs-mono" style={{ fontSize: 13 }}>
                    {targets.find(t => t.id === selectedTargetId)?.gps_lat?.toFixed(6) || '---'}, {targets.find(t => t.id === selectedTargetId)?.gps_lon?.toFixed(6) || '---'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Visual Indicator */}
          <div className="gcs-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', 
              background: 'var(--gcs-surface)', borderBottom: '1px solid var(--gcs-border)',
              borderTopLeftRadius: 'var(--gcs-radius)', borderTopRightRadius: 'var(--gcs-radius)',
            }}>
              {dropState === 'idle' && (
                <div style={{ textAlign: 'center', opacity: 0.5 }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                  <div className="gcs-mono" style={{ fontSize: 12 }}>SYSTEM IDLE</div>
                </div>
              )}
              {dropState === 'arming' && (
                <div style={{ textAlign: 'center', color: 'var(--gcs-warning)' }}>
                  <div className="gcs-dot gcs-dot-pulse" style={{ width: 48, height: 48, margin: '0 auto 12px', background: 'var(--gcs-warning)', borderRadius: '50%' }} />
                  <div className="gcs-mono" style={{ fontSize: 14, fontWeight: 700 }}>ARMING SERVO...</div>
                </div>
              )}
              {dropState === 'dropped' && (
                <div style={{ textAlign: 'center', color: 'var(--gcs-success)' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <div className="gcs-mono" style={{ fontSize: 14, fontWeight: 700 }}>PAYLOAD RELEASED</div>
                </div>
              )}
            </div>
            
            <button 
              onClick={handleDrop}
              disabled={!selectedTargetId || isDropping || !status.ready || status.payload_count <= 0}
              style={{
                padding: 24, background: isDropping ? 'var(--gcs-surface)' : 'var(--gcs-danger-dim)',
                color: isDropping ? 'var(--gcs-text)' : 'var(--gcs-danger)', 
                border: 'none', borderTop: '1px solid var(--gcs-border)',
                borderBottomLeftRadius: 'var(--gcs-radius)', borderBottomRightRadius: 'var(--gcs-radius)',
                fontSize: 16, fontWeight: 700, letterSpacing: '2px', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.2s', opacity: (!selectedTargetId || isDropping) ? 0.5 : 1
              }}
            >
              INITIATE DROP
            </button>
          </div>
        </div>

        {/* History */}
        <div>
          <SectionHeader title="Deployment Log" />
          <div className="gcs-card" style={{ overflow: 'hidden' }}>
            {history.length === 0 ? (
              <EmptyState title="No drops recorded" description="Payload drop history will appear here" />
            ) : (
              <table className="gcs-table">
                <thead>
                  <tr>
                    <th>Target ID</th>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td><span className="gcs-mono" style={{ fontWeight: 600, color: 'var(--gcs-accent)' }}>{h.target_id}</span></td>
                      <td className="gcs-mono">{new Date(h.timestamp).toLocaleTimeString()}</td>
                      <td className="gcs-mono">{h.gps_lat.toFixed(5)}, {h.gps_lon.toFixed(5)}</td>
                      <td style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 600, color: 'var(--gcs-success)' }}>{h.status.replace('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
