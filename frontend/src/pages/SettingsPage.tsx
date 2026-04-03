// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Settings Page (Rewritten)
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/shared';

export default function SettingsPage() {
  const [theme, setTheme] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || 'light';
  });
  
  useEffect(() => {
    if (theme !== 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  return (
    <div className="gcs-page" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="gcs-page-header">
        <div>
          <h1 className="gcs-page-title">Settings</h1>
          <p className="gcs-page-desc">Configure operator preferences and connection parameters</p>
        </div>
      </div>

      <div className="gcs-stack gcs-stack-xl">
        {/* Appearance */}
        <section>
          <SectionHeader title="Appearance" />
          <div className="gcs-card" style={{ padding: '0 24px' }}>
            <div className="gcs-settings-row">
              <div>
                <div className="gcs-settings-label">Theme</div>
                <div className="gcs-settings-hint">Switch between dark and light mode UI</div>
              </div>
              <div style={{ display: 'flex', background: 'var(--gcs-surface)', padding: 4, borderRadius: 'var(--gcs-radius-sm)', border: '1px solid var(--gcs-border)' }}>
                <button 
                  onClick={() => setTheme('dark')}
                  className="gcs-btn"
                  style={{ 
                    padding: '6px 12px', background: theme === 'dark' ? 'var(--gcs-card)' : 'transparent',
                    color: theme === 'dark' ? 'var(--gcs-text)' : 'var(--gcs-text3)',
                    border: 'none', boxShadow: theme === 'dark' ? 'var(--gcs-shadow)' : 'none',
                    borderRadius: 4
                  }}
                >Dark</button>
                <button 
                  onClick={() => setTheme('light')}
                  className="gcs-btn"
                  style={{ 
                    padding: '6px 12px', background: theme === 'light' ? 'var(--gcs-card)' : 'transparent',
                    color: theme === 'light' ? 'var(--gcs-text)' : 'var(--gcs-text3)',
                    border: 'none', boxShadow: theme === 'light' ? 'var(--gcs-shadow)' : 'none',
                    borderRadius: 4
                  }}
                >Light</button>
              </div>
            </div>
            
            <div className="gcs-settings-row">
              <div>
                <div className="gcs-settings-label">Map Style</div>
                <div className="gcs-settings-hint">Default map layer provider for Tactical Map</div>
              </div>
              <select className="gcs-select" style={{ width: 200 }}>
                <option>Esri World Imagery</option>
                <option>OpenStreetMap</option>
                <option>CartoDB Dark Matter</option>
              </select>
            </div>
          </div>
        </section>

        {/* Connections */}
        <section>
          <SectionHeader title="Backend Connection" />
          <div className="gcs-card" style={{ padding: '0 24px' }}>
            <div className="gcs-settings-row">
              <div style={{ flex: 1, paddingRight: 40 }}>
                <div className="gcs-settings-label">REST API Base URL</div>
                <div className="gcs-settings-hint">Endpoint for standard HTTP requests</div>
              </div>
              <input type="text" className="gcs-input gcs-mono" defaultValue="http://localhost:8080" style={{ width: 300 }} />
            </div>
            
            <div className="gcs-settings-row">
              <div style={{ flex: 1, paddingRight: 40 }}>
                <div className="gcs-settings-label">WebSocket URL</div>
                <div className="gcs-settings-hint">Endpoint for real-time telemetry stream</div>
              </div>
              <input type="text" className="gcs-input gcs-mono" defaultValue="ws://localhost:8080/ws" style={{ width: 300 }} />
            </div>
          </div>
        </section>

        {/* Telemetry */}
        <section>
          <SectionHeader title="Telemetry & Feed" />
          <div className="gcs-card" style={{ padding: '0 24px' }}>
            <div className="gcs-settings-row">
              <div style={{ flex: 1 }}>
                <div className="gcs-settings-label">Polling Rate</div>
                <div className="gcs-settings-hint">How often to refresh REST data (ms)</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <input type="range" min="100" max="2000" step="100" defaultValue="500" style={{ accentColor: 'var(--gcs-accent)' }} />
                <span className="gcs-mono" style={{ width: 50, textAlign: 'right', fontSize: 13 }}>500ms</span>
              </div>
            </div>

            <div className="gcs-settings-row">
              <div>
                <div className="gcs-settings-label">Video Stream Quality</div>
                <div className="gcs-settings-hint">MJPEG compression preset</div>
              </div>
              <select className="gcs-select" style={{ width: 200 }}>
                <option>High (1080p, Low Compression)</option>
                <option>Medium (720p, Balanced)</option>
                <option>Low (480p, High Compression)</option>
              </select>
            </div>
          </div>
        </section>

        {/* System Info */}
        <section style={{ marginTop: 24, padding: 24, textAlign: 'center' }}>
          <div className="gcs-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--gcs-text)' }}>JATAYU GCS</div>
          <div style={{ fontSize: 12, color: 'var(--gcs-text3)', marginTop: 4 }}>Version 1.0.0 • Hybrid VTOL Build</div>
          <div style={{ fontSize: 11, color: 'var(--gcs-muted)', marginTop: 12 }}>Powered by React, FastAPI, ArduPilot</div>
        </section>
      </div>
    </div>
  );
}
