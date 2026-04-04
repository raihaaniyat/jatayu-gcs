// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Action Log Panel (Rewritten)
// ════════════════════════════════════════════════════════════════════════

import { useMissionStore } from '@/store/missionStore';
import type { ActionStatus } from '@/types';

const STATUS_COLORS: Record<ActionStatus, { fg: string; bg: string; label: string }> = {
  success: { fg: 'var(--gcs-success)', bg: 'var(--gcs-success-dim)', label: 'OK' },
  failure: { fg: 'var(--gcs-danger)',  bg: 'var(--gcs-danger-dim)',  label: 'FAIL' },
  pending: { fg: 'var(--gcs-warning)', bg: 'var(--gcs-warning-dim)', label: 'PEND' },
  warning: { fg: 'var(--gcs-warning)', bg: 'var(--gcs-warning-dim)', label: 'WARN' },
};

export default function ActionLogPanel() {
  const actionLog = useMissionStore((s) => s.actionLog);
  const actionLogOpen = useMissionStore((s) => s.actionLogOpen);
  const setActionLogOpen = useMissionStore((s) => s.setActionLogOpen);
  const clearActionLog = useMissionStore((s) => s.clearActionLog);

  if (!actionLogOpen) {
    return (
      <button
        id="action-log-toggle"
        onClick={() => setActionLogOpen(true)}
        className="gcs-btn gcs-btn-ghost"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 2000,
          background: 'var(--gcs-card)', boxShadow: 'var(--gcs-shadow-lg)',
          gap: 8,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gcs-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span className="gcs-mono" style={{ fontSize: 11 }}>LOG</span>
        {actionLog.length > 0 && (
          <span style={{
            minWidth: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, background: 'var(--gcs-accent)', color: '#080c12',
          }}>
            {actionLog.length > 99 ? '99+' : actionLog.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 2000,
      width: 440, maxHeight: 500,
      display: 'flex', flexDirection: 'column',
      background: 'var(--gcs-card)', border: '1px solid var(--gcs-border)',
      borderRadius: 'var(--gcs-radius-lg)', boxShadow: 'var(--gcs-shadow-lg)',
      animation: 'slideIn 0.25s ease-out',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: '1px solid var(--gcs-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gcs-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', color: 'var(--gcs-text)' }}>COMMAND LOG</span>
          <span className="gcs-mono" style={{ fontSize: 10, color: 'var(--gcs-text3)' }}>({actionLog.length})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={clearActionLog} style={{ fontSize: 11, color: 'var(--gcs-text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
          <button onClick={() => setActionLogOpen(false)} style={{ fontSize: 14, color: 'var(--gcs-text3)', background: 'none', border: 'none', cursor: 'pointer', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8, maxHeight: 420 }}>
        {actionLog.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gcs-text3)' }}>
            No actions recorded
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {actionLog.map((entry) => {
              const s = STATUS_COLORS[entry.status];
              return (
                <div key={entry.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 'var(--gcs-radius-sm)',
                  background: 'var(--gcs-surface)', animation: 'fadeIn 0.15s ease-out',
                }}>
                  <span className="gcs-mono" style={{
                    flexShrink: 0, padding: '3px 7px', borderRadius: 4,
                    fontSize: 9, fontWeight: 700, background: s.bg, color: s.fg,
                    marginTop: 1,
                  }}>{s.label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gcs-text)' }}>{entry.action_type}</span>
                      <span className="gcs-mono" style={{ fontSize: 10, color: 'var(--gcs-text3)', flexShrink: 0 }}>
                        {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gcs-text3)', marginTop: 2 }}>{entry.context}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
