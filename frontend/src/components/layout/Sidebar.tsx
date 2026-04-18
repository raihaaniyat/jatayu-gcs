// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Sidebar Navigation (Rewritten)
// ════════════════════════════════════════════════════════════════════════

import { useMissionStore } from '@/store/missionStore';
import type { TabId } from '@/types';

const NAV_ITEMS: { id: TabId; label: string; shortcut: string }[] = [
  { id: 'overview',      label: 'Overview',        shortcut: '1' },
  { id: 'mission',       label: 'Mission Control', shortcut: '2' },
  { id: 'tactical-map',  label: 'Tactical Map',    shortcut: '3' },
  { id: 'targets',       label: 'Saved Targets',   shortcut: '4' },
  { id: 'payload',       label: 'Payload Drop',    shortcut: '5' },
  { id: 'recordings',    label: 'Recordings',      shortcut: '6' },
  { id: 'settings',      label: 'Settings',        shortcut: '7' },
  { id: 'route-planner', label: 'Route Planner',   shortcut: '8' },
];

// Simple SVG icons
function NavIcon({ id, active }: { id: TabId; active: boolean }) {
  const c = active ? 'var(--gcs-accent)' : 'var(--gcs-text3)';
  const s = 18;
  const icons: Record<string, React.ReactNode> = {
    overview: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    mission: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>,
    'tactical-map': <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/></svg>,
    targets: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>,
    payload: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    recordings: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill={active ? c : 'none'}/></svg>,
    settings: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    'route-planner': <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l4-4 4 4 4-8 4 4"/><path d="M3 21h18"/><circle cx="3" cy="17" r="1.5" fill={c}/><circle cx="21" cy="13" r="1.5" fill={c}/></svg>,
  };
  return <>{icons[id] || null}</>;
}

export default function Sidebar() {
  const activeTab = useMissionStore((s) => s.activeTab);
  const setActiveTab = useMissionStore((s) => s.setActiveTab);
  const telemetry = useMissionStore((s) => s.telemetry);
  const wsConnected = useMissionStore((s) => s.wsConnected);

  return (
    <nav className="gcs-sidebar">
      {/* Brand */}
      <div className="gcs-sidebar-brand" style={{ padding: '24px 20px', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', flexShrink: 0 }}>
          <img 
            src="/favicon_bgremoved.png" 
            alt="Jatayu Logo" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))',
              transform: 'scale(1.15)'
            }} 
          />
        </div>
        <div>
          <div className="gcs-sidebar-title">JATAYU</div>
          <div className="gcs-sidebar-subtitle">GROUND CONTROL</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="gcs-sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`gcs-nav-btn ${activeTab === item.id ? 'active' : ''}`}
          >
            <NavIcon id={item.id} active={activeTab === item.id} />
            <span>{item.label}</span>
            <span className="gcs-nav-shortcut">{item.shortcut}</span>
          </button>
        ))}
      </div>

      {/* Status Footer */}
      <div className="gcs-sidebar-footer">
        <div className="gcs-sidebar-stat">
          <span className="gcs-sidebar-stat-label">LINK</span>
          <span className="gcs-sidebar-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="gcs-dot gcs-dot-pulse" style={{ background: wsConnected ? 'var(--gcs-success)' : 'var(--gcs-danger)' }} />
            <span style={{ color: wsConnected ? 'var(--gcs-success)' : 'var(--gcs-danger)' }}>
              {wsConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </span>
        </div>
        <div className="gcs-sidebar-stat">
          <span className="gcs-sidebar-stat-label">MODE</span>
          <span className="gcs-sidebar-stat-value" style={{ color: 'var(--gcs-accent)' }}>
            {telemetry.mode}
          </span>
        </div>
        <div className="gcs-sidebar-stat">
          <span className="gcs-sidebar-stat-label">ALT</span>
          <span className="gcs-sidebar-stat-value" style={{ color: 'var(--gcs-text)' }}>
            {telemetry.alt_m.toFixed(1)}m
          </span>
        </div>
        
        {/* Branding */}
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--gcs-border-h)', textAlign: 'center', opacity: 0.6 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--gcs-text3)' }}>
            BUILT BY TEAM VRITAM
          </span>
        </div>
      </div>
    </nav>
  );
}
