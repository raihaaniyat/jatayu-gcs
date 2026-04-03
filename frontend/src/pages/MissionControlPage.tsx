// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Mission Control Page (Rewritten)
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useMissionStore } from '@/store/missionStore';
import { api } from '@/services/api';
import { MetricCard, StatusBadge, SectionHeader, QuickAction } from '@/components/shared';

export default function MissionControlPage() {
  const telemetry = useMissionStore((s) => s.telemetry);
  const detections = useMissionStore((s) => s.detections);
  const isRecording = useMissionStore((s) => s.isRecording);
  const setIsRecording = useMissionStore((s) => s.setIsRecording);
  const addActionLog = useMissionStore((s) => s.addActionLog);

  const [severity, setSeverity] = useState(5);
  const [altitudeInput, setAltitudeInput] = useState('');
  const [selectedDetection, setSelectedDetection] = useState<string | null>(null);

  useEffect(() => {
    const poll = async () => { try { const d = await api.getActiveDetections(); useMissionStore.getState().setDetections(d); } catch {} };
    poll(); const i = setInterval(poll, 500); return () => clearInterval(i);
  }, []);

  const handleMode = useCallback(async (mode: string) => {
    addActionLog({ timestamp: new Date().toISOString(), action_type: 'MODE_CHANGE', context: `→ ${mode}`, status: 'pending' });
    try { await api.setDroneMode(mode); addActionLog({ timestamp: new Date().toISOString(), action_type: 'MODE_CHANGE', context: `Mode: ${mode}`, status: 'success' }); }
    catch { addActionLog({ timestamp: new Date().toISOString(), action_type: 'MODE_CHANGE', context: `Failed: ${mode}`, status: 'failure' }); }
  }, [addActionLog]);

  const handleAltitude = useCallback(async () => {
    const alt = parseFloat(altitudeInput); if (isNaN(alt) || alt <= 0) return;
    addActionLog({ timestamp: new Date().toISOString(), action_type: 'ALTITUDE', context: `→ ${alt}m`, status: 'pending' });
    try { await api.setDroneAltitude(alt); addActionLog({ timestamp: new Date().toISOString(), action_type: 'ALTITUDE', context: `Set: ${alt}m`, status: 'success' }); setAltitudeInput(''); }
    catch { addActionLog({ timestamp: new Date().toISOString(), action_type: 'ALTITUDE', context: `Failed: ${alt}m`, status: 'failure' }); }
  }, [altitudeInput, addActionLog]);

  const handleSave = useCallback(async () => {
    const det = detections.find((d) => d.id === selectedDetection) || detections[0];
    if (!det) { addActionLog({ timestamp: new Date().toISOString(), action_type: 'SAVE_TARGET', context: 'No target in FOV', status: 'failure' }); return; }
    try { const s = await api.saveTarget({ severity, pose: det.pose, bbox: det.bbox, gps_lat: det.gps_lat, gps_lon: det.gps_lon });
    useMissionStore.getState().addSavedTarget(s); addActionLog({ timestamp: new Date().toISOString(), action_type: 'SAVE_TARGET', context: `Saved: ${s.id}`, status: 'success' }); }
    catch { addActionLog({ timestamp: new Date().toISOString(), action_type: 'SAVE_TARGET', context: 'Save failed', status: 'failure' }); }
  }, [detections, selectedDetection, severity, addActionLog]);

  const handleRecordToggle = useCallback(async () => {
    try { if (isRecording) { await api.stopRecording(); setIsRecording(false); addActionLog({ timestamp: new Date().toISOString(), action_type: 'RECORDING', context: 'Stopped', status: 'success' }); }
    else { await api.startRecording(); setIsRecording(true); addActionLog({ timestamp: new Date().toISOString(), action_type: 'RECORDING', context: 'Started', status: 'success' }); } }
    catch { addActionLog({ timestamp: new Date().toISOString(), action_type: 'RECORDING', context: 'Failed', status: 'failure' }); }
  }, [isRecording, setIsRecording, addActionLog]);

  const activeTarget = detections.find((d) => d.id === selectedDetection) || detections[0] || null;

  return (
    <div className="gcs-split">
      {/* Main: Video Feed */}
      <div className="gcs-split-main">
        <div style={{
          flex: 1, position: 'relative', borderRadius: 'var(--gcs-radius)',
          overflow: 'hidden', background: '#000', border: '1px solid var(--gcs-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0,
        }}>
          <img src={api.getVideoStreamUrl()} alt="Live Feed" style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />

          {/* No-feed text */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="gcs-mono" style={{ fontSize: 14, color: 'var(--gcs-text3)' }}>VIDEO FEED</div>
              <div style={{ fontSize: 11, color: 'var(--gcs-muted)', marginTop: 4 }}>Awaiting MJPEG stream from backend</div>
            </div>
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div style={{
              position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 100, background: 'var(--gcs-danger-dim)',
              border: '1px solid rgba(248,113,113,0.4)',
            }}>
              <span className="gcs-dot gcs-dot-pulse" style={{ background: 'var(--gcs-danger)' }} />
              <span className="gcs-mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--gcs-danger)' }}>REC</span>
            </div>
          )}

          {/* HUD overlay */}
          <div className="gcs-glass" style={{ position: 'absolute', bottom: 14, left: 14, padding: '10px 16px' }}>
            <div className="gcs-mono" style={{ fontSize: 11, color: 'var(--gcs-text2)', lineHeight: 1.8 }}>
              LAT {telemetry.lat.toFixed(6)} &nbsp; LON {telemetry.lon.toFixed(6)}<br />
              ALT {telemetry.alt_m.toFixed(1)}m &nbsp; HDG {telemetry.hdg.toFixed(0)}° &nbsp; MODE {telemetry.mode}
            </div>
          </div>

          {/* Detection count */}
          <div className="gcs-glass" style={{ position: 'absolute', top: 14, right: 14, padding: '8px 14px' }}>
            <span className="gcs-mono" style={{ fontSize: 12, fontWeight: 600, color: detections.length > 0 ? 'var(--gcs-warning)' : 'var(--gcs-text3)' }}>
              {detections.length} DETECTED
            </span>
          </div>
        </div>

        {/* Status */}
        {detections.length === 0 && (
          <div style={{
            padding: '10px 20px', borderRadius: 'var(--gcs-radius-sm)', textAlign: 'center',
            fontSize: 12, background: 'var(--gcs-surface)', border: '1px solid var(--gcs-border)',
            color: 'var(--gcs-text3)', fontFamily: "'JetBrains Mono', monospace",
          }}>
            NO HUMAN TARGET IN FRAME — Scanning...
          </div>
        )}
      </div>

      {/* Right Panel */}
      <div className="gcs-split-panel">
        {/* Flight Mode */}
        <div>
          <SectionHeader title="Flight Mode" />
          <div className="gcs-grid-2">
            <QuickAction label="GUIDED" variant="primary" onClick={() => handleMode('GUIDED')} />
            <QuickAction label="AUTO" variant="success" onClick={() => handleMode('AUTO')} />
            <QuickAction label="LOITER" variant="warning" onClick={() => handleMode('LOITER')} />
            <QuickAction label="QLOITER" variant="danger" onClick={() => handleMode('QLOITER')} />
          </div>
        </div>

        {/* Altitude */}
        <div>
          <SectionHeader title="Altitude" />
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="number" value={altitudeInput} onChange={(e) => setAltitudeInput(e.target.value)}
              placeholder={`${telemetry.alt_m.toFixed(0)}m`} className="gcs-input gcs-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleAltitude()} style={{ flex: 1 }} />
            <button onClick={handleAltitude} className="gcs-btn gcs-btn-primary" style={{ minWidth: 60 }}>SET</button>
          </div>
        </div>

        {/* Active Detection */}
        <div>
          <SectionHeader title="Active Target" />
          {activeTarget ? (
            <div className="gcs-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span className="gcs-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--gcs-accent)' }}>{activeTarget.id}</span>
                <StatusBadge status="warning" label={`${(activeTarget.confidence * 100).toFixed(0)}%`} />
              </div>
              <div className="gcs-grid-2" style={{ gap: 10 }}>
                <div><span className="gcs-mono" style={{ fontSize: 10, color: 'var(--gcs-text3)' }}>GPS </span><span className="gcs-mono" style={{ fontSize: 11, color: 'var(--gcs-text)' }}>{activeTarget.gps_lat.toFixed(6)}</span></div>
                <div><span className="gcs-mono" style={{ fontSize: 10, color: 'var(--gcs-text3)' }}>LON </span><span className="gcs-mono" style={{ fontSize: 11, color: 'var(--gcs-text)' }}>{activeTarget.gps_lon.toFixed(6)}</span></div>
                <div><span className="gcs-mono" style={{ fontSize: 10, color: 'var(--gcs-text3)' }}>Pose </span><span style={{ fontSize: 11, color: 'var(--gcs-text)' }}>{activeTarget.pose}</span></div>
                <div><span className="gcs-mono" style={{ fontSize: 10, color: 'var(--gcs-text3)' }}>Sev </span><span className="gcs-mono" style={{ fontSize: 11, color: 'var(--gcs-warning)' }}>{activeTarget.severity}/10</span></div>
              </div>
            </div>
          ) : (
            <div className="gcs-card" style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--gcs-text3)' }}>
              No target locked
            </div>
          )}
        </div>

        {/* Severity + Save */}
        <div>
          <SectionHeader title="Save Target" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="gcs-mono" style={{ fontSize: 11, color: 'var(--gcs-text3)', display: 'block', marginBottom: 8 }}>
                Severity: {severity}/10
              </label>
              <input type="range" min="1" max="10" value={severity} onChange={(e) => setSeverity(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#38bdf8' }} />
            </div>
            <button onClick={handleSave} disabled={!activeTarget} className="gcs-btn gcs-btn-primary"
              style={{ width: '100%', opacity: activeTarget ? 1 : 0.4 }}>
              Save to Database
            </button>
          </div>
        </div>

        {/* Recording */}
        <div>
          <SectionHeader title="Recording" />
          <button onClick={handleRecordToggle} className={`gcs-btn ${isRecording ? 'gcs-btn-danger' : 'gcs-btn-ghost'}`} style={{ width: '100%' }}>
            <span className="gcs-dot" style={{ background: isRecording ? 'var(--gcs-danger)' : 'var(--gcs-danger)', width: 8, height: 8 }} />
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>

        {/* Quick Telemetry */}
        <div className="gcs-grid-2">
          <MetricCard label="ALT" value={telemetry.alt_m.toFixed(1)} unit="m" />
          <MetricCard label="HDG" value={telemetry.hdg.toFixed(0)} unit="°" />
        </div>
      </div>
    </div>
  );
}
