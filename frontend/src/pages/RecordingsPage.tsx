// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Recordings Page (Rewritten)
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useMissionStore } from '@/store/missionStore';
import { api } from '@/services/api';
import { API_CONFIG } from '@/config/api';
import { MetricCard, SectionHeader, StatusBadge, EmptyState } from '@/components/shared';

export default function RecordingsPage() {
  const isRecording = useMissionStore((s) => s.isRecording);
  const setIsRecording = useMissionStore((s) => s.setIsRecording);
  const addActionLog = useMissionStore((s) => s.addActionLog);
  
  const [recordings, setRecordings] = useState<any[]>([]);

  useEffect(() => {
    const fetchRecs = async () => { try { const r = await api.getRecordings(); setRecordings(r); } catch {} };
    fetchRecs();
    const interval = setInterval(fetchRecs, 2000);
    return () => clearInterval(interval);
  }, [isRecording]); // re-fetch more aggressively if recording state changes

  const handleToggle = async () => {
    try {
      if (isRecording) {
        await api.stopRecording();
        setIsRecording(false);
        addActionLog({ timestamp: new Date().toISOString(), action_type: 'RECORDING', context: 'Stopped', status: 'success' });
      } else {
        await api.startRecording();
        setIsRecording(true);
        addActionLog({ timestamp: new Date().toISOString(), action_type: 'RECORDING', context: 'Started', status: 'success' });
      }
    } catch {
      addActionLog({ timestamp: new Date().toISOString(), action_type: 'RECORDING', context: 'Failed to toggle', status: 'failure' });
    }
  };

  const totalDuration = recordings.reduce((acc, r) => acc + (r.duration_s || 0), 0);
  const totalSize = recordings.reduce((acc, r) => acc + (r.size_bytes || 0), 0);

  return (
    <div className="gcs-page">
      <div className="gcs-page-header">
        <div>
          <h1 className="gcs-page-title">Mission Recordings</h1>
          <p className="gcs-page-desc">Video evidence and HUD telemetry capture</p>
        </div>
        <button 
          onClick={handleToggle} 
          className={`gcs-btn ${isRecording ? 'gcs-btn-danger' : 'gcs-btn-primary'}`}
          style={{ padding: '12px 24px', fontSize: 14 }}
        >
          {isRecording ? (
            <>
              <span className="gcs-dot gcs-dot-pulse" style={{ background: '#fff' }} /> Stop Recording
            </>
          ) : (
             <>
              <span className="gcs-dot" style={{ background: '#080c12' }} /> Start New Recording
             </>
          )}
        </button>
      </div>

      <div className="gcs-stack gcs-stack-xl">
        {/* Stats */}
        <div className="gcs-grid-4">
          <MetricCard 
            label="Total Recordings" 
            value={recordings.length} 
          />
          <MetricCard 
            label="Storage Used" 
            value={(totalSize / (1024 * 1024)).toFixed(1)} 
            unit="MB" 
          />
          <MetricCard 
            label="Total Duration" 
            value={(totalDuration / 60).toFixed(1)} 
            unit="min" 
          />
          <MetricCard 
            label="Current Status" 
            value={isRecording ? 'RECORDING' : 'IDLE'} 
            accent={isRecording ? 'var(--gcs-danger)' : 'var(--gcs-text3)'} 
          />
        </div>

        {/* List */}
        <div>
          <SectionHeader title="Recording Archive" />
          <div className="gcs-card" style={{ overflow: 'hidden' }}>
            {recordings.length === 0 ? (
              <EmptyState title="No recordings" description="Start a recording to capture mission video" />
            ) : (
              <table className="gcs-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Start Time</th>
                    <th>Duration</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recordings.map(r => (
                    <tr key={r.id}>
                      <td>
                        <span className="gcs-mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gcs-text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="12" cy="15" r="3"/></svg>
                          {r.filename}
                        </span>
                      </td>
                      <td className="gcs-mono">{new Date(r.timestamp).toLocaleString()}</td>
                      <td className="gcs-mono">{r.duration_s ? `${r.duration_s.toFixed(1)}s` : '--'}</td>
                      <td className="gcs-mono">{r.size_bytes ? `${(r.size_bytes / (1024*1024)).toFixed(2)} MB` : '--'}</td>
                      <td>
                        <StatusBadge 
                          status={r.status === 'recording' ? 'danger' : 'success'} 
                          label={r.status.toUpperCase()} 
                          pulse={r.status === 'recording'}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <a 
                          href={`${API_CONFIG.BASE_URL}/api/recordings/play/${r.filename}`}
                          target="_blank" 
                          rel="noreferrer" 
                          className="gcs-btn gcs-btn-ghost" 
                          style={{ padding: '6px 10px', fontSize: 11, textDecoration: 'none', display: 'inline-block' }}
                        >
                          ▶ Play
                        </a>
                      </td>
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
