// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Bottom Ticker (Live Telemetry Marquee)
//  Matches the dual-theme HTML design's constantly scrolling bottom bar
// ════════════════════════════════════════════════════════════════════════

import { useMissionStore } from '@/store/missionStore';

export default function Ticker() {
  const telemetry = useMissionStore((s) => s.telemetry);
  const detections = useMissionStore((s) => s.detections);
  const savedTargets = useMissionStore((s) => s.savedTargets);

  // Build target items from saved targets
  const targetItems = savedTargets.slice(0, 4).map((t) => {
    const sev = t.severity >= 8 ? 'CRITICAL' : t.severity >= 5 ? 'HIGH' : 'MOBILE';
    return `T-${t.id.slice(-3)} ${t.gps_lat.toFixed(4)}°N ${t.gps_lon.toFixed(4)}°E · ${sev} · ${t.pose} · SEV ${t.severity}`;
  });

  // Telemetry line
  const telLine = `ALT ${telemetry.alt_m.toFixed(1)}m AGL · HDG ${telemetry.hdg.toFixed(0)}° · MODE ${telemetry.mode} · BAT ${telemetry.battery || 0}%`;

  // Combine into one long ticker tape (duplicated for seamless looping)
  const items = [
    ...targetItems,
    telLine,
    `MISSION SAR-ALPHA-07 · ${detections.length} ACTIVE DETECTIONS · YOLOv8s + BoTSORT`,
  ];

  return (
    <div style={{
      borderTop: '1px solid var(--gcs-border)',
      background: 'var(--gcs-card)',
      overflow: 'hidden',
      transition: 'background 0.2s',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        gap: 36,
        padding: '7px 18px',
        whiteSpace: 'nowrap',
        animation: 'ticker 28s linear infinite',
        width: 'max-content',
      }}>
        {/* First set */}
        {items.map((item, i) => (
          <span key={`a-${i}`} className="gcs-mono" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 9,
            color: 'var(--gcs-text3)',
            letterSpacing: '0.04em',
          }}>
            <strong style={{ color: 'var(--gcs-text)' }}>
              {item.split(' ')[0]}
            </strong>
            {item.split(' ').slice(1).join(' ')}
          </span>
        ))}
        {/* Duplicate for seamless loop */}
        {items.map((item, i) => (
          <span key={`b-${i}`} className="gcs-mono" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 9,
            color: 'var(--gcs-text3)',
            letterSpacing: '0.04em',
          }}>
            <strong style={{ color: 'var(--gcs-text)' }}>
              {item.split(' ')[0]}
            </strong>
            {item.split(' ').slice(1).join(' ')}
          </span>
        ))}
      </div>
    </div>
  );
}
