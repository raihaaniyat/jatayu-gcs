// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Overview Page (Rewritten)
// ════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useMissionStore } from '@/store/missionStore';
import { api } from '@/services/api';
import { MetricCard, StatusBadge, SectionHeader, QuickAction } from '@/components/shared';

export default function OverviewPage() {
  const telemetry = useMissionStore((s) => s.telemetry);
  const systemStatus = useMissionStore((s) => s.systemStatus);
  const detections = useMissionStore((s) => s.detections);
  const savedTargets = useMissionStore((s) => s.savedTargets);
  const isRecording = useMissionStore((s) => s.isRecording);
  const payloadStatus = useMissionStore((s) => s.payloadStatus);
  const setActiveTab = useMissionStore((s) => s.setActiveTab);
  const addActionLog = useMissionStore((s) => s.addActionLog);
  const actionLog = useMissionStore((s) => s.actionLog);

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

  const handleMode = async (mode: string) => {
    addActionLog({ timestamp: new Date().toISOString(), action_type: 'MODE_CHANGE', context: `→ ${mode}`, status: 'pending' });
    try {
      await api.setDroneMode(mode);
      addActionLog({ timestamp: new Date().toISOString(), action_type: 'MODE_CHANGE', context: `Mode set: ${mode}`, status: 'success' });
    } catch {
      addActionLog({ timestamp: new Date().toISOString(), action_type: 'MODE_CHANGE', context: `Failed: ${mode}`, status: 'failure' });
    }
  };

  return (
    <div className="gcs-page">
      {/* Header */}
      <div className="gcs-page-header">
        <div>
          <h1 className="gcs-page-title">Mission Overview</h1>
          <p className="gcs-page-desc">Real-time status of all mission systems</p>
        </div>
        <StatusBadge
          status={systemStatus.status === 'ok' ? 'online' : 'offline'}
          label={systemStatus.status === 'ok' ? 'SYSTEMS OK' : 'DEGRADED'}
          pulse
        />
      </div>

      <div className="gcs-stack gcs-stack-xl">
        {/* Telemetry */}
        <div>
          <SectionHeader title="Telemetry" />
          <div className="gcs-grid-4">
            <MetricCard label="Mode" value={telemetry.mode} accent="var(--gcs-accent)" subtext={telemetry.link === 'online' ? 'Link active' : 'No link'} />
            <MetricCard label="Altitude" value={telemetry.alt_m.toFixed(1)} unit="m AGL" accent="var(--gcs-success)" />
            <MetricCard label="Heading" value={telemetry.hdg.toFixed(0)} unit="°" />
            <MetricCard label="Position" value={telemetry.lat.toFixed(5)} subtext={`LON ${telemetry.lon.toFixed(5)}`} />
          </div>
        </div>

        {/* System Status */}
        <div>
          <SectionHeader title="System Status" />
          <div className="gcs-grid-4">
            <MetricCard label="MAVLink" value={systemStatus.mavlink_connected ? 'Connected' : 'Offline'} accent={systemStatus.mavlink_connected ? 'var(--gcs-success)' : 'var(--gcs-danger)'} />
            <MetricCard label="Video Feed" value={systemStatus.video_active ? 'Active' : 'No Feed'} accent={systemStatus.video_active ? 'var(--gcs-success)' : 'var(--gcs-text3)'} />
            <MetricCard label="AI Model" value={systemStatus.model_loaded ? 'Loaded' : 'Offline'} accent={systemStatus.model_loaded ? 'var(--gcs-success)' : 'var(--gcs-danger)'} />
            <MetricCard label="Recording" value={isRecording ? 'Active' : 'Stopped'} accent={isRecording ? 'var(--gcs-danger)' : 'var(--gcs-text3)'} />
          </div>
        </div>

        {/* Detections */}
        <div>
          <SectionHeader title="Detection Summary" />
          <div className="gcs-grid-4">
            <MetricCard label="Active Detections" value={detections.length} accent="var(--gcs-warning)" />
            <MetricCard label="Saved Targets" value={savedTargets.length} accent="var(--gcs-accent)" onClick={() => setActiveTab('targets')} />
            <MetricCard label="Payload" value={payloadStatus.ready ? 'Ready' : 'Not Ready'} accent={payloadStatus.ready ? 'var(--gcs-payload)' : 'var(--gcs-text3)'} onClick={() => setActiveTab('payload')} />
            <MetricCard label="Actions" value={actionLog.length} subtext="Recent operations" />
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <SectionHeader title="Quick Actions" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <QuickAction label="GUIDED" variant="primary" onClick={() => handleMode('GUIDED')} />
            <QuickAction label="AUTO" variant="success" onClick={() => handleMode('AUTO')} />
            <QuickAction label="LOITER" variant="warning" onClick={() => handleMode('LOITER')} />
            <QuickAction label="QLOITER" variant="danger" onClick={() => handleMode('QLOITER')} />
            <QuickAction label="Tactical Map" variant="ghost" onClick={() => setActiveTab('tactical-map')} />
            <QuickAction label="Payload Drop" variant="ghost" onClick={() => setActiveTab('payload')} />
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <SectionHeader title="Recent Activity" />
          <div className="gcs-card" style={{ overflow: 'hidden' }}>
            {actionLog.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--gcs-text3)' }}>
                No recent activity
              </div>
            ) : (
              actionLog.slice(0, 5).map((entry) => (
                <div key={entry.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px', borderBottom: '1px solid var(--gcs-border)',
                }}>
                  <StatusBadge status={entry.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gcs-text)' }}>{entry.action_type}</span>
                    <span style={{ fontSize: 12, color: 'var(--gcs-text3)', marginLeft: 10 }}>{entry.context}</span>
                  </div>
                  <span className="gcs-mono" style={{ fontSize: 11, color: 'var(--gcs-text3)', flexShrink: 0 }}>
                    {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
