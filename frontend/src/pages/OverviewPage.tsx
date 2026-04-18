// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Overview Page
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useMissionStore } from '@/store/missionStore';
import { api } from '@/services/api';
import './overview.css';

export default function OverviewPage() {
  const telemetry = useMissionStore((s) => s.telemetry);
  const systemStatus = useMissionStore((s) => s.systemStatus);
  const detections = useMissionStore((s) => s.detections);
  const savedTargets = useMissionStore((s) => s.savedTargets);
  const isRecording = useMissionStore((s) => s.isRecording);
  const setActiveTab = useMissionStore((s) => s.setActiveTab);
  const addActionLog = useMissionStore((s) => s.addActionLog);
  const actionLog = useMissionStore((s) => s.actionLog);

  const [elapsed, setElapsed] = useState('00:00:00');

  // Fetch browser geolocation as fallback
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const store = useMissionStore.getState();
        const t = store.telemetry;
        // If it's the exact placeholder coordinates, update to real browser location
        if (t.lat === 26.25104 && t.lon === 78.17124) {
          store.setTelemetry({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          // Optionally also push to backend config if you had a mutation for it
        }
      }, () => {}, { enableHighAccuracy: true });
    }
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const t = await api.getTelemetry();
        const h = await api.getHealth();
        useMissionStore.getState().setTelemetry(t);
        useMissionStore.getState().setSystemStatus(h);
      } catch {}
    };
    poll();
    const i = setInterval(poll, 1000);
    return () => clearInterval(i);
  }, []);

  // Periodically refresh saved targets, recordings, and detections
  useEffect(() => {
    const refresh = async () => {
      try { useMissionStore.getState().fetchSavedTargets(); } catch {}
      try { const r = await api.getRecordings(); useMissionStore.getState().setRecordings(r); } catch {}
      try { const d = await api.getActiveDetections(); useMissionStore.getState().setDetections(d); } catch {}
    };
    refresh();
    const i = setInterval(refresh, 3000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const start = Date.now();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timer = setInterval(() => {
      const ms = Date.now() - start;
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      setElapsed(`${pad(h)}:${pad(m % 60)}:${pad(s % 60)}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleMode = async (mode: string) => {
    addActionLog({ timestamp: new Date().toISOString(), action_type: 'MODE_CHANGE', context: `→ ${mode}`, status: 'pending' });
    try {
      await api.setDroneMode(mode);
      addActionLog({ timestamp: new Date().toISOString(), action_type: 'MODE_CHANGE', context: `Mode set: ${mode}`, status: 'success' });
    } catch {
      addActionLog({ timestamp: new Date().toISOString(), action_type: 'MODE_CHANGE', context: `Failed: ${mode}`, status: 'failure' });
    }
  };
  
  const handleAlt = async (delta: number) => {
    try {
      const newAlt = Math.max(0, telemetry.alt_m + delta);
      useMissionStore.getState().setTelemetry({ alt_m: newAlt });
      await api.setDroneAltitude(newAlt);
    } catch {}
  };

  const getTargetRisk = (label?: string) => {
      if (!label) return 'TGT';
      if (label.toLowerCase().includes('critical')) return 'CRIT';
      if (label.toLowerCase().includes('high')) return 'HIGH';
      if (label.toLowerCase().includes('mobile')) return 'MOB';
      return 'TGT';
  };

  const getTargetColor = (label?: string) => {
    if (!label) return 'blue';
    if (label.toLowerCase().includes('critical')) return 'red';
    if (label.toLowerCase().includes('high')) return 'amber';
    if (label.toLowerCase().includes('mobile')) return 'green';
    return 'blue';
};

  return (
    <div className="gcs-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto', padding: '18px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '19px', fontWeight: 700, color: 'var(--gcs-text)' }}>Mission Overview</div>
          <div style={{ fontSize: '11px', color: 'var(--gcs-text3)', marginTop: '1px' }}>SAR-ALPHA-07 · <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--gcs-accent)' }}>{elapsed}</span> elapsed</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className={`ov-badge ${systemStatus.status === 'ok' ? 'b-green' : 'b-red'}`}>
            <div className={`gcs-dot ${systemStatus.status === 'ok' ? 'gcs-dot-pulse' : ''}`} style={{ background: systemStatus.status === 'ok' ? 'var(--gcs-success)' : 'var(--gcs-danger)' }}></div>
            {systemStatus.status === 'ok' ? 'MISSION ACTIVE' : 'MISSION DEGRADED'}
          </div>
          <button className="ov-btn ov-btn-primary" onClick={() => setActiveTab('mission')}>MISSION CONTROL →</button>
        </div>
      </div>

      {/* Row 1: Telemetry */}
      <div className="gcs-grid-4">
        <div className="ov-card ov-card-sm al-blue">
          <div className="ov-card-label">Mode</div>
          <div className="ov-card-value cv-blue">{telemetry.mode || 'UNKNOWN'}</div>
          <div className="ov-card-sub">{telemetry.link === 'online' ? 'Link active' : 'Link offline'}</div>
        </div>
        <div className="ov-card ov-card-sm al-blue">
          <div className="ov-card-label">Altitude</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
            <div className="ov-card-value cv-blue">{telemetry.alt_m.toFixed(1)}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--gcs-text3)' }}>m AGL</div>
          </div>
          <div className="ov-card-sub">±0.3m variance</div>
        </div>
        <div className="ov-card ov-card-sm al-blue">
          <div className="ov-card-label">Heading</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
            <div className="ov-card-value">{telemetry.hdg.toFixed(0)}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--gcs-text3)' }}>°</div>
          </div>
          <div className="ov-card-sub">{telemetry.hdg === 0 ? '↑ North' : 'Heading'}</div>
        </div>
        <div className="ov-card ov-card-sm al-blue">
          <div className="ov-card-label">Position</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px', fontWeight: 500, color: 'var(--gcs-text)', lineHeight: 1.5 }}>
            {telemetry.lat.toFixed(5)}<br /><span style={{ color: 'var(--gcs-text3)', fontSize: '11px' }}>{telemetry.lon.toFixed(5)} E</span>
          </div>
        </div>
      </div>

      {/* Row 2: Status */}
      <div className="gcs-grid-4">
        <div className="ov-card ov-card-sm">
          <div className="ov-card-label">MAVLink</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
            <div className="gcs-dot gcs-dot-pulse" style={{ background: systemStatus.mavlink_connected ? 'var(--gcs-success)' : 'var(--gcs-danger)' }}></div>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: 500, color: systemStatus.mavlink_connected ? 'var(--gcs-success)' : 'var(--gcs-danger)' }}>
              {systemStatus.mavlink_connected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="ov-card-sub" style={{ marginTop: '5px' }}>COM4 · 57600 baud</div>
        </div>
        <div className="ov-card ov-card-sm">
          <div className="ov-card-label">Video Feed</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
            <div className={`gcs-dot ${!systemStatus.video_active ? 'gcs-dot-pulse' : ''}`} style={{ background: systemStatus.video_active ? 'var(--gcs-success)' : 'var(--gcs-warning)' }}></div>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: 500, color: systemStatus.video_active ? 'var(--gcs-success)' : 'var(--gcs-warning)' }}>
              {systemStatus.video_active ? 'Streaming' : 'No Feed'}
            </span>
          </div>
          <div className="ov-card-sub" style={{ marginTop: '5px' }}>{systemStatus.video_active ? '1080p 30fps' : 'Check VRX'}</div>
        </div>
        <div className="ov-card ov-card-sm">
          <div className="ov-card-label">AI Model</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
            <div className="gcs-dot" style={{ background: systemStatus.model_loaded ? 'var(--gcs-success)' : 'var(--gcs-danger)' }}></div>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: 500, color: systemStatus.model_loaded ? 'var(--gcs-success)' : 'var(--gcs-danger)' }}>
              {systemStatus.model_loaded ? 'Running' : 'Not Loaded'}
            </span>
          </div>
          <div className="ov-card-sub" style={{ marginTop: '5px' }}>yolo26n-pose · Track</div>
        </div>
        <div className="ov-card ov-card-sm">
          <div className="ov-card-label">Recording</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
            <div className="gcs-dot" style={{ background: isRecording ? 'var(--gcs-danger)' : 'var(--gcs-text3)' }}></div>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: 500, color: isRecording ? 'var(--gcs-danger)' : 'var(--gcs-text3)' }}>
              {isRecording ? 'Active' : 'Stopped'}
            </span>
          </div>
          <div className="ov-card-sub" style={{ marginTop: '5px' }}>{isRecording ? 'Writing...' : 'Ready'}</div>
        </div>
      </div>

      {/* Row 3: Complex layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr 0.9fr', gap: '10px' }}>
        
        {/* Col 1: Clickable Mission Navigator Placeholder */}
        <div className="video-card" onClick={() => setActiveTab('mission')} style={{ cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s', border: '1px solid var(--gcs-border)' }}>
          <div className="video-screen" style={{ 
            backgroundImage: 'url(/blurred_snip.png)', 
            backgroundSize: 'cover', 
            backgroundPosition: 'center',
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '12px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Dark Overlay for Text Readability */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 1 }}></div>

            <div className="video-grid" style={{ zIndex: 2 }}></div>
            <div className="video-scanline" style={{ zIndex: 2 }}></div>
            
            <div style={{ zIndex: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ 
                width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(8px)'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
              </div>
              <div className="gcs-mono" style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.08em', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                ENTERING MISSION CONTROL
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '4px', maxWidth: '200px', fontWeight: 500 }}>
                Access live video intelligence & detection controls
              </div>
            </div>

            <div className="video-live-badge" style={{ 
              zIndex: 10,
              background: systemStatus.video_active ? 'rgba(34, 208, 138, 0.2)' : 'rgba(240, 69, 74, 0.2)', 
              color: systemStatus.video_active ? '#22d08a' : '#f0454a', 
              border: '1px solid currentColor',
              backdropFilter: 'blur(4px)',
              fontWeight: 600
            }}>
              <div className="gcs-dot gcs-dot-pulse" style={{ background: 'currentColor' }}></div>
              <span>{systemStatus.video_active ? 'STREAM ACTIVE' : 'NO SIGNAL'}</span>
            </div>

            <div className="vcorn vc-tl"></div><div className="vcorn vc-tr"></div>
            <div className="vcorn vc-bl"></div><div className="vcorn vc-br"></div>
          </div>
          <div className="video-bottom" style={{ background: 'var(--gcs-surface2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="ov-badge b-dim">MJPEG STREAMING</span>
              <span className="ov-badge b-dim">YOLO26n-POSE</span>
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <div style={{ fontSize: '10px', color: 'var(--gcs-text3)', fontFamily: "'IBM Plex Mono', monospace" }}>GSC-M-LINK-01</div>
            </div>
          </div>
        </div>

        {/* Col 2: Targets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="ov-card al-red" style={{ flex: 0 }}>
            <div className="ov-card-label" style={{ marginBottom: '8px' }}>Active detections</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
              <div className="survivors-num">{detections.length}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'var(--gcs-text3)', lineHeight: 1.4 }}>survivors<br />tracked</div>
            </div>
          </div>
          <div className="ov-card" style={{ flex: 1 }}>
            <div className="ov-card-label" style={{ marginBottom: '7px' }}>Live targets</div>
            {savedTargets.length === 0 && <div style={{fontSize: 11, color: 'var(--gcs-text3)', padding: '10px 0'}}>No saved targets.</div>}
            {savedTargets.slice(0,3).map(tgt => (
              <div key={tgt.id} className="target-row" onClick={() => setActiveTab('targets')}>
                <div className="gcs-dot gcs-dot-pulse" style={{ background: `var(--gcs-${getTargetColor(tgt.status)})`, flexShrink: 0 }}></div>
                <div style={{ flex: 1 }}>
                  <div className="target-id">{tgt.status.toUpperCase()}</div>
                  <div className="target-coords">{tgt.gps_lat.toFixed(4)}°N · {tgt.gps_lon.toFixed(4)}°E</div>
                </div>
                <span className={`ov-badge b-${getTargetColor(tgt.status)}`}>{getTargetRisk(tgt.status)}</span>
              </div>
            ))}
            <button className="ov-btn ov-btn-primary" style={{ width: '100%', marginTop: '9px', fontSize: '10px' }} onClick={() => setActiveTab('targets')}>SAVE ALL TARGETS →</button>
          </div>
        </div>

        {/* Col 3: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="ov-card ov-card-sm" style={{ flex: 0 }}>
            <div className="ov-card-label" style={{ marginBottom: '7px' }}>Drone mode</div>
            <div className="mode-grid">
              <div className={`mode-btn ${telemetry.mode === 'GUIDED' ? 'active' : ''}`} onClick={() => handleMode('GUIDED')}>GUIDED</div>
              <div className={`mode-btn ${telemetry.mode === 'AUTO' ? 'active' : ''}`} onClick={() => handleMode('AUTO')}>AUTO</div>
              <div className={`mode-btn ${telemetry.mode === 'LOITER' ? 'active' : ''}`} onClick={() => handleMode('LOITER')}>LOITER</div>
              <div className={`mode-btn ${telemetry.mode === 'QLOITER' ? 'active' : ''}`} onClick={() => handleMode('QLOITER')}>QLOITER</div>
            </div>
          </div>
          <div className="ov-card ov-card-sm" style={{ flex: 0 }}>
            <div className="ov-card-label" style={{ marginBottom: '6px' }}>Altitude</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', marginBottom: '8px' }}>
              <span className="alt-num">{telemetry.alt_m.toFixed(0)}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: 'var(--gcs-text3)' }}>m</span>
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button className="ov-btn" style={{ flex: 1, fontSize: '14px', padding: '6px' }} onClick={() => handleAlt(-5)}>−</button>
              <button className="ov-btn" style={{ flex: 1, fontSize: '14px', padding: '6px' }} onClick={() => handleAlt(5)}>+</button>
            </div>
          </div>
          <div className="ov-card ov-card-sm" style={{ flex: 1 }}>
            <div className="ov-card-label" style={{ marginBottom: '8px' }}>System health</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--gcs-text3)' }}>Battery</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'var(--gcs-success)' }}>{telemetry.battery || 0}%</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${telemetry.battery || 0}%`, background: 'var(--gcs-success)' }}></div></div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--gcs-text3)' }}>Signal</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'var(--gcs-accent)' }}>-62 dBm</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: '65%', background: 'var(--gcs-accent)' }}></div></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', color: 'var(--gcs-text3)' }}>GPS sats</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'var(--gcs-text)' }}>
                  {telemetry.gps_sats !== undefined ? telemetry.gps_sats : 0} · {telemetry.gps_fix_type && telemetry.gps_fix_type >= 3 ? '3D fix' : telemetry.gps_fix_type === 2 ? '2D fix' : 'No fix'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Map & Log */}
      <div className="gcs-grid-2">
        <div className="ov-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
            <div className="ov-card-label">Tactical overview</div>
            <button className="ov-btn" style={{ fontSize: '9px' }} onClick={() => setActiveTab('tactical-map')}>FULL MAP →</button>
          </div>
          <div className="mini-map">
            <div className="mm-grid"></div>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 200 100">
              <line x1="58" y1="68" x2="100" y2="44" stroke="#4f8ef730" strokeWidth="0.6" strokeDasharray="3 2" />
            </svg>
            <div className="mm-marker" style={{ top: '66%', left: '28%', background: '#fff', width: '7px', height: '7px', borderRadius: 0, clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}></div>
            {savedTargets.slice(0,3).map((t, idx) => (
                <div key={t.id} className="mm-marker" style={{ top: `${40 + idx*5}%`, left: `${40 + idx*8}%`, background: `var(--gcs-${getTargetColor(t.status)})`, width: '6px', height: '6px' }}></div>
            ))}
            <div style={{ position: 'absolute', bottom: '6px', left: '8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6b7280' }}>
              {telemetry.lat.toFixed(2)}°N {telemetry.lon.toFixed(2)}°E
            </div>
            <div style={{ position: 'absolute', bottom: '6px', right: '8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6b7280' }}>
              {savedTargets.length} targets pinned
            </div>
          </div>
        </div>

        <div className="ov-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
            <div className="ov-card-label">Command log</div>
            <span className="ov-badge b-blue">LIVE</span>
          </div>
          <div>
            {actionLog.slice(0, 5).map(log => (
              <div key={log.id} className="log-row">
                <div className="log-time">{new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}</div>
                <div className="log-text">
                  {log.action_type} → <strong>{log.context}</strong>
                  <small>{log.status}</small>
                </div>
                <span className={`ov-badge ${log.status === 'success' ? 'b-green' : log.status === 'failure' ? 'b-red' : 'b-amber'}`}>
                  {log.status === 'success' ? 'OK' : log.status === 'failure' ? 'ERR' : '...'}
                </span>
              </div>
            ))}
            {actionLog.length === 0 && <div className="log-text" style={{paddingTop: 10, color: 'var(--gcs-text3)'}}>No recent operations.</div>}
          </div>
        </div>
      </div>

    </div>
  );
}
