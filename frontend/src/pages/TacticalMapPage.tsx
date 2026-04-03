// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Tactical Map Page (Rewritten)
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { useMissionStore } from '@/store/missionStore';
import { SectionHeader, StatusBadge } from '@/components/shared';
// We use leaflet for the map. We need to handle SSR / React strict mode carefully.
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons
const createTargetIcon = (severity: number) => {
  const color = severity >= 7 ? '#f87171' : severity >= 4 ? '#fbbf24' : '#34d399';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

const droneIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #38bdf8; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 8px #38bdf8, 0 0 4px rgba(0,0,0,0.5);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function TacticalMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const droneMarker = useRef<L.Marker | null>(null);
  const targetLayer = useRef<L.LayerGroup | null>(null);
  
  const telemetry = useMissionStore((s) => s.telemetry);
  const mapTargets = useMissionStore((s) => s.savedTargets);
  const fetchMapTargets = useMissionStore((s) => s.fetchSavedTargets);
  
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    fetchMapTargets();
  }, [fetchMapTargets]);

  // Init map
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Initialize map
    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([26.2306, 78.2070], 16);
      
      L.control.zoom({ position: 'bottomright' }).addTo(leafletMap.current);
      
      // Add satellite layer
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
      }).addTo(leafletMap.current);
      
      // Layers
      targetLayer.current = L.layerGroup().addTo(leafletMap.current);
      
      // Drone marker
      droneMarker.current = L.marker([telemetry.lat, telemetry.lon], { icon: droneIcon }).addTo(leafletMap.current);
    }
    
    return () => {
      // Cleanup happens only on full unmount
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update drone position
  useEffect(() => {
    if (droneMarker.current && telemetry.lat && telemetry.lon) {
      const newPos = new L.LatLng(telemetry.lat, telemetry.lon);
      droneMarker.current.setLatLng(newPos);
      // Optional: auto-pan if drone flies off screen
      // if (leafletMap.current && !leafletMap.current.getBounds().contains(newPos)) {
      //   leafletMap.current.panTo(newPos);
      // }
    }
  }, [telemetry.lat, telemetry.lon]);

  const [routesData, setRoutesData] = useState<any[]>([]);

  // Update targets and routes
  useEffect(() => {
    if (!targetLayer.current || !leafletMap.current) return;
    
    targetLayer.current.clearLayers();
    
    // Draw Operator Marker (Ground Station)
    const opLat = 26.2306;
    const opLon = 78.2070;
    const gcsIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: #8b5cf6; width: 14px; height: 14px; border-radius: 2px; border: 2px solid #fff; box-shadow: 0 0 8px #8b5cf6, 0 0 4px rgba(0,0,0,0.5);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker([opLat, opLon], { icon: gcsIcon })
      .bindPopup(`<div style="font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: #8b5cf6;">GCS Operator</div>`)
      .addTo(targetLayer.current);

    // Fetch and draw direct aerial lines
    import('@/services/api').then(({ api }) => {
      api.getMapRoutes(opLat, opLon, 0, telemetry.lat || undefined, telemetry.lon || undefined, telemetry.alt_m || 0)
        .then(routes => {
          setRoutesData(routes);
          if (!targetLayer.current || !leafletMap.current) return;
          routes.forEach(route => {
            if (route.type === 'direct_aerial' && route.coordinates.length > 1) {
              L.polyline(route.coordinates as [number, number][], {
                color: route.color || '#8b5cf6',
                weight: 2,
                opacity: 0.6,
                dashArray: '5, 10',
              }).addTo(targetLayer.current!);
              
              // Optional: Add distance label to the middle of the line
              const midLat = (route.coordinates[0][0] + route.coordinates[1][0]) / 2;
              const midLon = (route.coordinates[0][1] + route.coordinates[1][1]) / 2;
              
              const distanceIcon = L.divIcon({
                className: 'distance-label-icon',
                html: `<div style="background: rgba(0,0,0,0.7); color: #fff; padding: 2px 4px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 9px; white-space: nowrap; border: 1px solid ${route.color};">${(route.distance_m/1000).toFixed(2)} km</div>`,
                iconSize: [60, 20],
                iconAnchor: [30, 10]
              });
              L.marker([midLat, midLon], { icon: distanceIcon }).addTo(targetLayer.current!);
            }
          });
        });
    });
    
    mapTargets.forEach(t => {
      if (t.gps_lat && t.gps_lon) {
        const marker = L.marker([t.gps_lat, t.gps_lon], { icon: createTargetIcon(t.severity) });
        marker.bindPopup(`
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 12px; margin-bottom: 4px; font-weight: 700; color: var(--gcs-accent);">${t.id}</div>
          <div style="display: flex; gap: 8px; margin-bottom: 4px;">
            <div style="font-size: 10px; color: var(--gcs-text3);">SEV</div>
            <div style="font-size: 11px; font-weight: 500;">${t.severity}/10</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <div style="font-size: 10px; color: var(--gcs-text3);">POSE</div>
            <div style="font-size: 11px; font-weight: 500; text-transform: uppercase;">${t.pose || 'UNKNOWN'}</div>
          </div>
        `);
        marker.on('click', () => setSelectedTargetId(t.id));
        targetLayer.current?.addLayer(marker);
      }
    });
  }, [mapTargets, telemetry.lat, telemetry.lon, telemetry.alt_m]);

  const handleTargetClick = (target: any) => {
    setSelectedTargetId(target.id);
    if (leafletMap.current && target.gps_lat && target.gps_lon) {
      leafletMap.current.flyTo([target.gps_lat, target.gps_lon], 18, { duration: 1 });
    }
  };

  return (
    <div className="gcs-split">
      {/* Main Map Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        
        {/* Map Overlays */}
        <div style={{ 
          position: 'absolute', top: 20, left: 20, zIndex: 1000,
          background: 'var(--gcs-surface)', padding: '12px 16px',
          borderRadius: 'var(--gcs-radius-sm)', border: '1px solid var(--gcs-border)',
          boxShadow: 'var(--gcs-shadow)'
        }}>
          <div className="gcs-mono" style={{ fontSize: 10, color: 'var(--gcs-text3)', marginBottom: 8 }}>LEGEND</div>
          <div className="gcs-stack gcs-stack-xs">
            <div className="gcs-row gcs-row-sm">
              <span className="gcs-dot" style={{ background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
              <span style={{ fontSize: 12 }}>Drone Position</span>
            </div>
            <div className="gcs-row gcs-row-sm">
              <span className="gcs-dot" style={{ background: '#f87171' }} />
              <span style={{ fontSize: 12 }}>Critical (7+)</span>
            </div>
            <div className="gcs-row gcs-row-sm">
              <span className="gcs-dot" style={{ background: '#fbbf24' }} />
              <span style={{ fontSize: 12 }}>High (4-6)</span>
            </div>
            <div className="gcs-row gcs-row-sm">
              <span className="gcs-dot" style={{ background: '#34d399' }} />
              <span style={{ fontSize: 12 }}>Low (1-3)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Target Panel */}
      <div className="gcs-split-panel">
        <SectionHeader title="Map Targets" />
        
        <div className="gcs-stack gcs-stack-sm">
          {mapTargets.length === 0 ? (
            <div className="gcs-empty" style={{ padding: 24, border: '1px dashed var(--gcs-border)', borderRadius: 'var(--gcs-radius-sm)' }}>
              <div style={{ fontSize: 12, color: 'var(--gcs-text3)' }}>No targets saved yet</div>
            </div>
          ) : (
            mapTargets.map((t: any) => (
              <div 
                key={t.id}
                className="gcs-card gcs-card-clickable"
                style={{ 
                  padding: '12px 14px',
                  borderColor: selectedTargetId === t.id ? 'var(--gcs-accent-border)' : 'var(--gcs-border)',
                  background: selectedTargetId === t.id ? 'var(--gcs-surface)' : 'var(--gcs-card)'
                }}
                onClick={() => handleTargetClick(t)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="gcs-mono" style={{ fontSize: 13, fontWeight: 600 }}>{t.id}</span>
                  <StatusBadge 
                    status={t.severity >= 7 ? 'danger' : t.severity >= 4 ? 'warning' : 'success'} 
                    label={`SEV ${t.severity}`} 
                  />
                </div>
                <div className="gcs-mono" style={{ fontSize: 10, color: 'var(--gcs-text3)' }}>
                  {t.gps_lat?.toFixed(5) || '---'}, {t.gps_lon?.toFixed(5) || '---'}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 24 }}>
          <SectionHeader title="3D Slant Distances (from GCS)" />
          <div className="gcs-stack gcs-stack-sm">
            {routesData.length === 0 ? (
              <div className="gcs-empty" style={{ padding: 24, border: '1px dashed var(--gcs-border)', borderRadius: 'var(--gcs-radius-sm)' }}>
                <div style={{ fontSize: 12, color: 'var(--gcs-text3)' }}>No tracking data</div>
              </div>
            ) : (
              routesData.map((route: any) => (
                <div key={route.id} className="gcs-card" style={{ padding: '12px 14px', borderLeft: `3px solid ${route.color || 'var(--gcs-border)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{route.name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div className="gcs-mono" style={{ fontSize: 14, color: 'var(--gcs-text)', fontWeight: 600 }}>
                        {(route.distance_m / 1000).toFixed(2)} km
                      </div>
                      <div className="gcs-mono" style={{ fontSize: 10, color: 'var(--gcs-text3)' }}>
                        {route.distance_m.toFixed(0)} meters
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
