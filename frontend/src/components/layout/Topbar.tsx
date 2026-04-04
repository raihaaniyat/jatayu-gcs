// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Topbar
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useMissionStore } from '@/store/missionStore';

export default function Topbar() {
  const [time, setTime] = useState('--:--:--');
  const [dark, setDark] = useState(false);
  const systemStatus = useMissionStore(s => s.systemStatus);

  useEffect(() => {
    // Sync initial theme
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');

    const timer = setInterval(() => {
      const now = new Date();
      setTime(
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0')
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  };

  return (
    <div style={{
      height: 44, background: 'var(--gcs-card)', borderBottom: '1px solid var(--gcs-border)',
      display: 'flex', alignItems: 'center', padding: '0 18px', gap: 14, flexShrink: 0,
      transition: 'background 0.2s'
    }}>
      <div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', color: 'var(--gcs-text)' }}>JATAYU GCS</div>
        <div style={{ fontSize: 10, color: 'var(--gcs-text3)', letterSpacing: '0.05em' }}>GROUND CONTROL STATION</div>
      </div>
      <div style={{ width: 1, height: 22, background: 'var(--gcs-border)', margin: '0 2px' }}></div>
      <span className="gcs-mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--gcs-text3)', textTransform: 'uppercase' }}>MISSION</span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--gcs-accent)' }}>SAR-ALPHA-07</span>
      
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, border: '1px solid', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.03em', color: systemStatus.mavlink_connected ? 'var(--gcs-success)' : 'var(--gcs-danger)', borderColor: systemStatus.mavlink_connected ? 'var(--gcs-success)' : 'var(--gcs-danger)', background: systemStatus.mavlink_connected ? 'var(--gcs-success-dim)' : 'var(--gcs-danger-dim)' }}>
          <div className={`gcs-dot ${systemStatus.mavlink_connected ? 'gcs-dot-pulse' : ''}`} style={{ background: systemStatus.mavlink_connected ? 'var(--gcs-success)' : 'var(--gcs-danger)' }}></div>
          MAVLINK
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, border: '1px solid', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.03em', color: systemStatus.video_active ? 'var(--gcs-success)' : 'var(--gcs-warning)', borderColor: systemStatus.video_active ? 'var(--gcs-success)' : 'var(--gcs-warning)', background: systemStatus.video_active ? 'var(--gcs-success-dim)' : 'var(--gcs-warning-dim)' }}>
          <div className={`gcs-dot ${!systemStatus.video_active ? 'gcs-dot-pulse' : ''}`} style={{ background: systemStatus.video_active ? 'var(--gcs-success)' : 'var(--gcs-warning)' }}></div>
          {systemStatus.video_active ? 'VIDEO LIVE' : 'NO VIDEO'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, border: '1px solid', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.03em', color: systemStatus.model_loaded ? 'var(--gcs-success)' : 'var(--gcs-danger)', borderColor: systemStatus.model_loaded ? 'var(--gcs-success)' : 'var(--gcs-danger)', background: systemStatus.model_loaded ? 'var(--gcs-success-dim)' : 'var(--gcs-danger-dim)' }}>
          <div className="gcs-dot" style={{ background: systemStatus.model_loaded ? 'var(--gcs-success)' : 'var(--gcs-danger)' }}></div>
          {systemStatus.model_loaded ? 'AI RUNNING' : 'AI OFFLINE'}
        </div>
        
        {/* Theme Toggle */}
        <div onClick={toggleTheme} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--gcs-border-h)', background: 'var(--gcs-bg-subtle)', cursor: 'pointer', transition: 'all 0.15s', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--gcs-text3)' }}>
          <div style={{ width: 28, height: 16, borderRadius: 8, background: dark ? 'var(--gcs-accent)' : 'var(--gcs-text3)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: dark ? 14 : 2, transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}></div>
          </div>
          <span>{dark ? 'LIGHT' : 'DARK'}</span>
        </div>
        
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--gcs-text3)' }}>{time}</span>
      </div>
    </div>
  );
}
