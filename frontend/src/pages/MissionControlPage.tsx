// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Mission Control Page (Original Architecture Fixed)
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [availableVideos, setAvailableVideos] = useState<string[]>([]);
  const [aiLoaded, setAiLoaded] = useState(false);
  const [videoConnecting, setVideoConnecting] = useState(true);
  const [streamToken, setStreamToken] = useState(Date.now());
  const [selectedSource, setSelectedSource] = useState('NONE');
  const [detectedCameras, setDetectedCameras] = useState<{ index: number; name: string }[]>([]);
  const [detectingCameras, setDetectingCameras] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCameras = useCallback(async () => {
    setDetectingCameras(true);
    try {
      const cams = await api.getCameras();
      setDetectedCameras(cams);
    } catch {
      // Fallback to default if endpoint not available
      setDetectedCameras([{ index: 0, name: 'Default Camera' }]);
    }
    setDetectingCameras(false);
  }, []);

  useEffect(() => {
    // Load available MP4s and detect cameras on mount
    api.getVideoStatus().then(st => {
      setAiLoaded(st.model_loaded);
      setAvailableVideos(st.available_videos);
    }).catch(() => { });
    loadCameras();
  }, [loadCameras]);

  const handleSourceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const src = e.target.value;

    // 1. Optimistically update UI so it doesn't snap back immediately
    setSelectedSource(src);
    setStreamToken(Date.now());
    setVideoConnecting(true);

    if (src === 'NONE') {
      try { await api.setVideoSource('NONE'); } catch { }
      return;
    }

    try {
      // 2. Send '0', '1', or 'video.mp4' to the backend
      await api.setVideoSource(src);
      addActionLog({ timestamp: new Date().toISOString(), action_type: 'VIDEO', context: `Source switched to ${src}`, status: 'success' });
    } catch {
      addActionLog({ timestamp: new Date().toISOString(), action_type: 'VIDEO', context: `Source switch failed`, status: 'failure' });
      setSelectedSource('NONE');
      setVideoConnecting(false);
    }
  };

  const handleDeleteVideo = async () => {
    // Only allow deletion if the source is a file (not NONE, and not a pure number string like '0' or '1')
    if (!selectedSource || selectedSource === 'NONE' || /^\d+$/.test(selectedSource)) {
      addActionLog({ timestamp: new Date().toISOString(), action_type: 'VIDEO_DELETE', context: `Cannot delete active camera stream`, status: 'failure' });
      return;
    }

    try {
      const res = await api.deleteVideo(selectedSource);
      if (res.success) {
        addActionLog({ timestamp: new Date().toISOString(), action_type: 'VIDEO_DELETE', context: `Deleted: ${selectedSource}`, status: 'success' });
        const st = await api.getVideoStatus();
        setAvailableVideos(st.available_videos);
        await api.setVideoSource('NONE');
        setSelectedSource('NONE');
        setStreamToken(Date.now());
        setVideoConnecting(true);
      } else {
        addActionLog({ timestamp: new Date().toISOString(), action_type: 'VIDEO_DELETE', context: `Failed to delete`, status: 'failure' });
      }
    } catch {
      addActionLog({ timestamp: new Date().toISOString(), action_type: 'VIDEO_DELETE', context: `Network error during delete`, status: 'failure' });
    }
  };

  const handleToggleAi = async () => {
    try {
      const res = await api.toggleVideoModel();
      setAiLoaded(res.model_loaded);
      useMissionStore.getState().setSystemStatus({ ...useMissionStore.getState().systemStatus, model_loaded: res.model_loaded });
      addActionLog({ timestamp: new Date().toISOString(), action_type: 'AI_MODEL', context: res.message, status: 'success' });
    } catch {
      addActionLog({ timestamp: new Date().toISOString(), action_type: 'AI_MODEL', context: `Toggle failed`, status: 'failure' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addActionLog({ timestamp: new Date().toISOString(), action_type: 'VIDEO_UPLOAD', context: `Uploading: ${file.name}`, status: 'pending' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(api.getVideoStreamUrl().replace('/stream', '/upload'), {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        // Automatically switch to the uploaded file if needed, or just refresh list
        setStreamToken(Date.now());
        setVideoConnecting(true);
        addActionLog({ timestamp: new Date().toISOString(), action_type: 'VIDEO_UPLOAD', context: `Loaded: ${file.name}`, status: 'success' });

        // Refresh the video list to show the new MP4
        const st = await api.getVideoStatus();
        setAvailableVideos(st.available_videos);
      } else {
        addActionLog({ timestamp: new Date().toISOString(), action_type: 'VIDEO_UPLOAD', context: 'Upload failed', status: 'failure' });
      }
    } catch (err) {
      addActionLog({ timestamp: new Date().toISOString(), action_type: 'VIDEO_UPLOAD', context: 'Network error', status: 'failure' });
    }

    if (e.target) e.target.value = '';
  };

  useEffect(() => {
    const poll = async () => { try { const d = await api.getActiveDetections(); useMissionStore.getState().setDetections(d); } catch { } };
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
    try {
      const s = await api.saveTarget({ severity, pose: det.pose, bbox: det.bbox, gps_lat: det.gps_lat, gps_lon: det.gps_lon });
      useMissionStore.getState().addSavedTarget(s); addActionLog({ timestamp: new Date().toISOString(), action_type: 'SAVE_TARGET', context: `Saved: ${s.id}`, status: 'success' });
    }
    catch { addActionLog({ timestamp: new Date().toISOString(), action_type: 'SAVE_TARGET', context: 'Save failed', status: 'failure' }); }
  }, [detections, selectedDetection, severity, addActionLog]);

  const handleRecordToggle = useCallback(async () => {
    try {
      if (isRecording) { await api.stopRecording(); setIsRecording(false); addActionLog({ timestamp: new Date().toISOString(), action_type: 'RECORDING', context: 'Stopped', status: 'success' }); }
      else { await api.startRecording(); setIsRecording(true); addActionLog({ timestamp: new Date().toISOString(), action_type: 'RECORDING', context: 'Started', status: 'success' }); }
    }
    catch { addActionLog({ timestamp: new Date().toISOString(), action_type: 'RECORDING', context: 'Failed', status: 'failure' }); }
  }, [isRecording, setIsRecording, addActionLog]);

  const activeTarget = detections.find((d) => d.id === selectedDetection) || detections[0] || null;

  return (
    <div className="gcs-split">
      <div className="gcs-split-main">

        {/* Video Controls Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--gcs-card)', borderRadius: 'var(--gcs-radius-sm)', border: '1px solid var(--gcs-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="gcs-mono" style={{ fontSize: 11, color: 'var(--gcs-text2)', fontWeight: 600 }}>SOURCE</span>
            <select className="gcs-select gcs-mono" value={selectedSource} onChange={handleSourceChange} style={{ padding: '6px 10px', fontSize: 11, width: 200, height: 32 }}>
              <option value="NONE">No Feed</option>
              {detectedCameras.length > 0 && (
                <optgroup label="Detected Cameras">
                  {detectedCameras.map(c => (
                    <option key={c.index} value={String(c.index)}>{c.name}</option>
                  ))}
                </optgroup>
              )}
              {availableVideos.length > 0 && (
                <optgroup label="Uploaded MP4s">
                  {availableVideos.map(v => <option key={v} value={v}>{v}</option>)}
                </optgroup>
              )}
            </select>
            <button
              className="gcs-btn gcs-btn-ghost"
              style={{ padding: '0 8px', height: 32, fontSize: 11, minWidth: 32 }}
              onClick={loadCameras}
              disabled={detectingCameras}
              title="Detect cameras"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: detectingCameras ? 'spin 1s linear infinite' : 'none' }}>
                <polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
            <div style={{ width: 1, height: 16, background: 'var(--gcs-border)', margin: '0 4px' }} />

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="video/*" style={{ display: 'none' }} />
            <button className="gcs-btn gcs-btn-ghost" style={{ padding: '0 12px', height: 32, fontSize: 11 }} onClick={() => fileInputRef.current?.click()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Upload Video
            </button>

            {/* Check if the selected source is NOT a number (meaning it is a file) */}
            {selectedSource && selectedSource !== 'NONE' && !/^\d+$/.test(selectedSource) && (
              <button className="gcs-btn gcs-btn-ghost" style={{ padding: '0 12px', height: 32, fontSize: 11, color: 'var(--gcs-danger)' }} onClick={handleDeleteVideo}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                Remove MP4
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={handleToggleAi} className={`gcs-btn ${aiLoaded ? 'gcs-btn-success' : 'gcs-btn-ghost'}`} style={{ height: 32, padding: '0 12px', fontSize: 11 }}>
              <div className={`gcs-dot ${aiLoaded ? 'gcs-dot-pulse' : ''}`} style={{ background: aiLoaded ? '#fff' : 'var(--gcs-text3)', width: 6, height: 6, marginRight: 6 }}></div>
              {aiLoaded ? 'INTELLIGENCE ON' : 'INTELLIGENCE OFF'}
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div style={{
          flex: 1, position: 'relative', borderRadius: 'var(--gcs-radius)',
          overflow: 'hidden', background: '#000', border: '1px solid var(--gcs-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0,
        }}>
          {selectedSource !== 'NONE' && (
            <img
              key={streamToken}
              src={`${api.getVideoStreamUrl()}?t=${streamToken}`}
              alt="Live Feed"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onLoad={() => { setVideoConnecting(false); }}
              onError={() => { console.error("Stream error"); }}
            />
          )}

          {(selectedSource === 'NONE') && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ textAlign: 'center' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gcs-text3)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, display: 'block', margin: '0 auto 10px auto' }}>
                  <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                </svg>
                <div className="gcs-mono" style={{ fontSize: 12, color: 'var(--gcs-text3)', letterSpacing: '0.08em' }}>
                  {selectedSource === 'NONE' ? 'SELECT A VIDEO SOURCE' : 'CONNECTING TO STREAM...'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--gcs-muted)', marginTop: 4 }}>
                  {selectedSource === 'NONE' ? 'Choose Camera 0/1 or an uploaded MP4 above' : 'Awaiting MJPEG data from backend'}
                </div>
              </div>
            </div>
          )}

          {isRecording && (
            <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, background: 'var(--gcs-danger-dim)', border: '1px solid rgba(248,113,113,0.4)' }}>
              <span className="gcs-dot gcs-dot-pulse" style={{ background: 'var(--gcs-danger)' }} />
              <span className="gcs-mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--gcs-danger)' }}>REC</span>
            </div>
          )}

          <div className="gcs-glass shadow-lg" style={{ position: 'absolute', bottom: 14, left: 14, padding: '12px 18px', border: '1px solid var(--gcs-border-h)' }}>
            <div className="gcs-mono" style={{ fontSize: 11, color: 'var(--gcs-text)', fontWeight: 500, lineHeight: 1.8 }}>
              LAT {telemetry.lat.toFixed(6)} &nbsp; LON {telemetry.lon.toFixed(6)}<br />
              ALT {telemetry.alt_m.toFixed(1)}m &nbsp; HDG {telemetry.hdg.toFixed(0)}° &nbsp; MODE {telemetry.mode}
            </div>
          </div>

          <div className="gcs-glass" style={{ position: 'absolute', top: 14, right: 14, padding: '8px 14px' }}>
            <span className="gcs-mono" style={{ fontSize: 12, fontWeight: 600, color: detections.length > 0 ? 'var(--gcs-warning)' : 'var(--gcs-text3)' }}>
              {detections.length} DETECTED
            </span>
          </div>
        </div>

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
        <div>
          <SectionHeader title="Flight Mode" />
          <div className="gcs-grid-2">
            <QuickAction label="GUIDED" variant="primary" onClick={() => handleMode('GUIDED')} />
            <QuickAction label="AUTO" variant="success" onClick={() => handleMode('AUTO')} />
            <QuickAction label="LOITER" variant="warning" onClick={() => handleMode('LOITER')} />
            <QuickAction label="QLOITER" variant="danger" onClick={() => handleMode('QLOITER')} />
          </div>
        </div>

        <div>
          <SectionHeader title="Altitude" />
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="number" value={altitudeInput} onChange={(e) => setAltitudeInput(e.target.value)}
              placeholder={`${telemetry.alt_m.toFixed(0)}m`} className="gcs-input gcs-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleAltitude()} style={{ flex: 1 }} />
            <button onClick={handleAltitude} className="gcs-btn gcs-btn-primary" style={{ minWidth: 60 }}>SET</button>
          </div>
        </div>

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

        <div>
          <SectionHeader title="Recording" />
          <button onClick={handleRecordToggle} className={`gcs-btn ${isRecording ? 'gcs-btn-danger' : 'gcs-btn-ghost'}`} style={{ width: '100%' }}>
            <span className="gcs-dot" style={{ background: isRecording ? 'var(--gcs-danger)' : 'var(--gcs-danger)', width: 8, height: 8 }} />
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>

        <div className="gcs-grid-2">
          <MetricCard label="ALT" value={telemetry.alt_m.toFixed(1)} unit="m" />
          <MetricCard label="HDG" value={telemetry.hdg.toFixed(0)} unit="°" />
        </div>
      </div>
    </div>
  );
}