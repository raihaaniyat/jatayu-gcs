// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Terrain-Aware Rescue Route Planner Page
//  Dark tactical 3D mission interface with Cesium terrain
// ════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import './routePlanner.css';
import { useRoutePlannerStore } from '@/store/routePlannerStore';
import { routePlannerApi } from '@/services/routePlannerApi';
import type { Coordinate, TraversalMode } from '@/types/routePlannerTypes';

// ── Cesium dynamic import ─────────────────────────────────────────────
// We lazy-load Cesium to avoid blocking the initial render
let Cesium: typeof import('cesium') | null = null;

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_TOKEN as string;

// Default view: Gwalior region, India
const DEFAULT_LAT = 26.25104;
const DEFAULT_LON = 78.17124;
const DEFAULT_ALT = 3000; // camera height meters

// ── Mode labels ───────────────────────────────────────────────────────
const MODE_LABELS: Record<TraversalMode, string> = {
  FOOT_TEAM: '🦺 Foot Team',
  LIGHT_VEHICLE: '🚙 Light Vehicle',
  ROVER: '🤖 Rover',
  SUPPLY_DROP: '📦 Supply Route',
};

const MODE_OPTIONS: { value: TraversalMode; label: string }[] = [
  { value: 'FOOT_TEAM',      label: '🦺 Foot Team' },
  { value: 'LIGHT_VEHICLE',  label: '🚙 Light Vehicle' },
  { value: 'ROVER',          label: '🤖 Rover' },
  { value: 'SUPPLY_DROP',    label: '📦 Supply Route' },
];

// ── Quality color mapping ─────────────────────────────────────────────
const QUALITY_COLOR = {
  SAFE:               '#34d399',
  CAUTION:            '#f5a623',
  HIGH_RISK:          '#f0454a',
  NO_FEASIBLE_ROUTE:  '#818cf8',
} as const;

// ═══════════════════════════════════════════════════════════════════════
//  ICON COMPONENTS
// ═══════════════════════════════════════════════════════════════════════
const S = 16;

function IconSelect()  { return <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l14 9-7 1-4 7z"/></svg>; }
function IconStart()   { return <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="7"/><path d="M12 17v4"/><path d="M9 21h6"/><circle cx="12" cy="10" r="2.5" fill="currentColor" stroke="none"/></svg>; }
function IconGoal()    { return <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 3 21 12 3 21 3 3"/></svg>; }
function IconBlock()   { return <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 12 3 21 6 21 18 12 21 3 18 3 6"/></svg>; }
function IconErase()   { return <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16l11-11 7 7-3.5 3.5"/><path d="M6.5 17.5l5-5"/></svg>; }
function IconRefresh() { return <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>; }
function IconHome()    { return <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function IconLayers()  { return <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>; }
function IconClose()   { return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconWarn()    { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function IconChevron({ dir }: { dir: 'left' | 'right' }) {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {dir === 'right' ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
  </svg>;
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function RoutePlannerPage() {
  const mapRef     = useRef<HTMLDivElement>(null);
  const viewerRef  = useRef<import('cesium').Viewer | null>(null);
  const entitiesRef = useRef<{ start?: any; goal?: any; route?: any; blocks: any[] }>({ blocks: [] });

  const [cesiumReady, setCesiumReady] = useState(false);
  const [cameraAlt,  setCameraAlt]   = useState(DEFAULT_ALT);

  const store = useRoutePlannerStore();
  const {
    startPoint, goalPoint, traversalMode, activeTool, blockedZones,
    drawingPolygon, routeResult, isComputing, computeError, cursorInfo,
    layers, rightPanelOpen, setActiveTool, setStartPoint, setGoalPoint,
    setTraversalMode, setIsComputing, setRouteResult, setComputeError,
    setCursorInfo, addDrawingPoint, commitDrawingPolygon, cancelDrawing,
    removeBlockedZone, clearBlockedZones, toggleLayer, setRightPanelOpen, resetAll,
  } = store;

  // ── Init Cesium ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || viewerRef.current) return;

    let cancelled = false;

    import('cesium').then(async (CesiumModule) => {
      if (cancelled || !mapRef.current) return;
      Cesium = CesiumModule;

      // Set token BEFORE anything else
      CesiumModule.Ion.defaultAccessToken = CESIUM_TOKEN;

      // Build terrain provider asynchronously (new API in Cesium 1.x+)
      let terrainProvider: CesiumModule.TerrainProvider;
      try {
        terrainProvider = await CesiumModule.createWorldTerrainAsync({
          requestWaterMask: false,
          requestVertexNormals: true,
        });
      } catch {
        terrainProvider = new CesiumModule.EllipsoidTerrainProvider();
      }

      if (cancelled || !mapRef.current) return;

      const viewer = new CesiumModule.Viewer(mapRef.current!, {
        terrainProvider,
        baseLayerPicker:      false,
        geocoder:             false,
        homeButton:           false,
        sceneModePicker:      false,
        navigationHelpButton: false,
        animation:            false,
        timeline:             false,
        fullscreenButton:     false,
        infoBox:              false,
        selectionIndicator:   false,
        shouldAnimate:        false,
        scene3DOnly:          true,
      });

      // Dark background colour
      viewer.scene.backgroundColor = CesiumModule.Color.fromCssColorString('#080a0e');

      // Swap to satellite imagery using the non-deprecated async API
      try {
        const imageryProvider = await CesiumModule.ArcGisMapServerImageryProvider.fromUrl(
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
          { enablePickFeatures: false }
        );
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(imageryProvider);
      } catch {
        // Fall back to default Cesium imagery — still shows terrain
        console.warn('[Route Planner] Could not load ArcGIS imagery, using default');
      }

      if (cancelled) { viewer.destroy(); return; }

      // Fly to Gwalior area
      viewer.camera.flyTo({
        destination: CesiumModule.Cartesian3.fromDegrees(DEFAULT_LON, DEFAULT_LAT, DEFAULT_ALT),
        orientation: { pitch: CesiumModule.Math.toRadians(-45), heading: 0, roll: 0 },
        duration: 2.5,
      });

      // Track camera altitude for status bar
      viewer.scene.postRender.addEventListener(() => {
        if (cancelled) return;
        const cart = CesiumModule.Cartographic.fromCartesian(viewer.camera.position);
        setCameraAlt(Math.round(cart.height));
      });

      // Map click handler
      const handler = new CesiumModule.ScreenSpaceEventHandler(viewer.canvas);

      handler.setInputAction((event: { position: CesiumModule.Cartesian2 }) => {
        const ray = viewer.camera.getPickRay(event.position);
        if (!ray) return;
        const pos = viewer.scene.globe.pick(ray, viewer.scene);
        if (!pos) return;
        const cart = CesiumModule.Cartographic.fromCartesian(pos);
        const lat = CesiumModule.Math.toDegrees(cart.latitude);
        const lon = CesiumModule.Math.toDegrees(cart.longitude);

        const mode = useRoutePlannerStore.getState().activeTool;
        if (mode === 'set-start') {
          useRoutePlannerStore.getState().setStartPoint({ lat, lon });
          useRoutePlannerStore.getState().setActiveTool('select');
        } else if (mode === 'set-goal') {
          useRoutePlannerStore.getState().setGoalPoint({ lat, lon });
          useRoutePlannerStore.getState().setActiveTool('select');
        } else if (mode === 'draw-block') {
          useRoutePlannerStore.getState().addDrawingPoint({ lat, lon });
        }
      }, CesiumModule.ScreenSpaceEventType.LEFT_CLICK);

      // Double-click to commit polygon
      handler.setInputAction(() => {
        if (useRoutePlannerStore.getState().activeTool === 'draw-block') {
          useRoutePlannerStore.getState().commitDrawingPolygon();
        }
      }, CesiumModule.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

      // Mouse move for cursor elevation readout
      handler.setInputAction((event: { endPosition: CesiumModule.Cartesian2 }) => {
        const ray = viewer.camera.getPickRay(event.endPosition);
        if (!ray) return;
        const pos = viewer.scene.globe.pick(ray, viewer.scene);
        if (!pos) return;
        const cart = CesiumModule.Cartographic.fromCartesian(pos);
        const lat = CesiumModule.Math.toDegrees(cart.latitude);
        const lon = CesiumModule.Math.toDegrees(cart.longitude);
        const elev = Math.round(cart.height);
        useRoutePlannerStore.getState().setCursorInfo({
          lat, lon, elevation: elev, slope: 0,
          terrain_category: 'OPEN_GROUND', cost: 1.0,
        });
      }, CesiumModule.ScreenSpaceEventType.MOUSE_MOVE);

      viewerRef.current = viewer;
      if (!cancelled) setCesiumReady(true);
    });


    return () => {
      cancelled = true;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync entities to Cesium ───────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !Cesium || viewer.isDestroyed()) return;

    // Start marker
    if (entitiesRef.current.start) viewer.entities.remove(entitiesRef.current.start);
    if (startPoint) {
      entitiesRef.current.start = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(startPoint.lon, startPoint.lat),
        billboard: {
          image: _makePin('#34d399', 'S'),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          width: 36, height: 48,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: 'ORIGIN',
          font: '500 10px "IBM Plex Mono"',
          fillColor: Cesium.Color.fromCssColorString('#34d399'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -52),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }

    // Goal marker
    if (entitiesRef.current.goal) viewer.entities.remove(entitiesRef.current.goal);
    if (goalPoint) {
      entitiesRef.current.goal = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(goalPoint.lon, goalPoint.lat),
        billboard: {
          image: _makePin('#fb923c', 'G'),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          width: 36, height: 48,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: 'TARGET',
          font: '500 10px "IBM Plex Mono"',
          fillColor: Cesium.Color.fromCssColorString('#fb923c'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -52),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }
  }, [startPoint, goalPoint, cesiumReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync route polyline ───────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !Cesium || viewer.isDestroyed()) return;

    if (entitiesRef.current.route) {
      viewer.entities.remove(entitiesRef.current.route);
      entitiesRef.current.route = undefined;
    }

    if (routeResult && layers.route && routeResult.polyline.length > 1) {
      const positions = routeResult.polyline.map((c) =>
        Cesium!.Cartesian3.fromDegrees(c.lon, c.lat)
      );
      const color = QUALITY_COLOR[routeResult.quality] || '#38bdf8';

      entitiesRef.current.route = viewer.entities.add({
        polyline: {
          positions: new Cesium.ConstantProperty(positions),
          width: 4,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.fromCssColorString(color).withAlpha(0.9),
          }),
          clampToGround: true,
        },
      });

      // Fly to encompass route
      viewer.zoomTo(entitiesRef.current.route);
    }
  }, [routeResult, layers.route, cesiumReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync blocked zones ────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !Cesium || viewer.isDestroyed()) return;

    // Remove old block entities
    for (const e of entitiesRef.current.blocks) viewer.entities.remove(e);
    entitiesRef.current.blocks = [];

    if (!layers.blockedZones) return;

    for (const zone of blockedZones) {
      if (zone.polygon.length < 3) continue;
      const hierarchy = new Cesium.PolygonHierarchy(
        zone.polygon.map((c) => Cesium!.Cartesian3.fromDegrees(c.lon, c.lat))
      );
      const e = viewer.entities.add({
        polygon: {
          hierarchy,
          material: Cesium.Color.fromCssColorString('#f0454a').withAlpha(0.22),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#f0454a').withAlpha(0.7),
          outlineWidth: 2,
          height: 0,
        },
      });
      entitiesRef.current.blocks.push(e);
    }

    // Drawing preview
    if (drawingPolygon.length > 0) {
      const pts = drawingPolygon.map((c) => Cesium!.Cartesian3.fromDegrees(c.lon, c.lat));
      if (pts.length >= 2) {
        const e = viewer.entities.add({
          polyline: {
            positions: new Cesium.ConstantProperty([...pts, pts[0]]),
            width: 2,
            material: Cesium.Color.fromCssColorString('#f0454a').withAlpha(0.6),
          },
        });
        entitiesRef.current.blocks.push(e);
      }
    }
  }, [blockedZones, drawingPolygon, layers.blockedZones, cesiumReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Home camera ───────────────────────────────────────────────────────
  const flyHome = useCallback(() => {
    viewerRef.current?.camera.flyTo({
      destination: Cesium!.Cartesian3.fromDegrees(DEFAULT_LON, DEFAULT_LAT, DEFAULT_ALT),
      orientation: { pitch: Cesium!.Math.toRadians(-45), heading: 0, roll: 0 },
      duration: 1.8,
    });
  }, []);

  // ── Compute Route ─────────────────────────────────────────────────────
  const handleComputeRoute = useCallback(async () => {
    if (!startPoint || !goalPoint) return;
    setIsComputing(true);
    setComputeError(null);
    setRouteResult(null);
    try {
      const result = await routePlannerApi.planRoute({
        start: startPoint,
        goal: goalPoint,
        traversal_mode: traversalMode,
        blocked_zones: store.blockedZones,
        grid_resolution: store.gridResolution,
      });
      setRouteResult(result);
    } catch (err: any) {
      setComputeError(err.message || 'Route planning failed');
    } finally {
      setIsComputing(false);
    }
  }, [startPoint, goalPoint, traversalMode, store.blockedZones, store.gridResolution, setIsComputing, setComputeError, setRouteResult]);

  // ── Elevation profile heights normalised 0–100% ───────────────────────
  const elevProfile = (() => {
    if (!routeResult || routeResult.segments.length < 2) return [];
    const elevs = routeResult.segments.map((s) => s.elevation);
    const mn = Math.min(...elevs), mx = Math.max(...elevs);
    const rng = mx - mn || 1;
    return elevs.filter((_, i) => i % Math.max(1, Math.floor(elevs.length / 60)) === 0)
      .map((e) => ({ pct: ((e - mn) / rng) * 100, e }));
  })();

  const slopeColor = (s: number) =>
    s < 8 ? '#34d399' : s < 15 ? '#f5a623' : '#f0454a';

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="rp-shell">
      {/* ── Cesium Map ──────────────────────────────────────────────── */}
      <div ref={mapRef} className="rp-map" />

      {/* ── Top Mission Bar ─────────────────────────────────────────── */}
      <div className="rp-topbar">
        {/* Title */}
        <span className="rp-topbar-title">Route Planner</span>
        <div className="rp-topbar-sep" />

        {/* Mode selector */}
        <div className="rp-mode-selector">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
          <select
            value={traversalMode}
            onChange={(e) => setTraversalMode(e.target.value as TraversalMode)}
          >
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="rp-topbar-sep" />

        {/* Point status pills */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8,
            background: startPoint ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${startPoint ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.07)'}`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: startPoint ? '#34d399' : 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: startPoint ? '#34d399' : 'rgba(255,255,255,0.25)' }}>
              {startPoint ? `ORIGIN ${startPoint.lat.toFixed(4)}, ${startPoint.lon.toFixed(4)}` : 'ORIGIN — NOT SET'}
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8,
            background: goalPoint ? 'rgba(251,146,60,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${goalPoint ? 'rgba(251,146,60,0.25)' : 'rgba(255,255,255,0.07)'}`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: goalPoint ? '#fb923c' : 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: goalPoint ? '#fb923c' : 'rgba(255,255,255,0.25)' }}>
              {goalPoint ? `TARGET  ${goalPoint.lat.toFixed(4)}, ${goalPoint.lon.toFixed(4)}` : 'TARGET — NOT SET'}
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Compute button */}
        <button
          className={`rp-compute-btn${isComputing ? ' computing' : ''}`}
          onClick={handleComputeRoute}
          disabled={!startPoint || !goalPoint || isComputing}
          id="btn-compute-route"
        >
          {isComputing ? (
            <><span className="rp-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />COMPUTING…</>
          ) : (
            <><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>COMPUTE ROUTE</>
          )}
        </button>

        {/* Reset */}
        <button className="rp-reset-btn" onClick={resetAll} id="btn-reset-route">
          <IconRefresh /> RESET
        </button>
      </div>

      {/* ── Tool Rail ───────────────────────────────────────────────── */}
      <div className="rp-tool-rail">
        <button
          className={`rp-tool-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => setActiveTool('select')}
          data-tooltip="Select / Pan"
          id="tool-select"
        ><IconSelect /></button>

        <div className="rp-tool-rail-sep" />

        <button
          className={`rp-tool-btn ${activeTool === 'set-start' ? 'active-start' : ''}`}
          onClick={() => setActiveTool(activeTool === 'set-start' ? 'select' : 'set-start')}
          data-tooltip="Set Origin Point"
          id="tool-set-start"
        ><IconStart /></button>

        <button
          className={`rp-tool-btn ${activeTool === 'set-goal' ? 'active-goal' : ''}`}
          onClick={() => setActiveTool(activeTool === 'set-goal' ? 'select' : 'set-goal')}
          data-tooltip="Set Target Point"
          id="tool-set-goal"
        ><IconGoal /></button>

        <div className="rp-tool-rail-sep" />

        <button
          className={`rp-tool-btn ${activeTool === 'draw-block' ? 'active-block' : ''}`}
          onClick={() => setActiveTool(activeTool === 'draw-block' ? 'select' : 'draw-block')}
          data-tooltip="Draw Blocked Zone"
          id="tool-draw-block"
        ><IconBlock /></button>

        <button
          className="rp-tool-btn"
          onClick={clearBlockedZones}
          data-tooltip="Clear All Blocks"
          id="tool-clear-blocks"
        ><IconErase /></button>

        <div className="rp-tool-rail-sep" />

        <button
          className="rp-tool-btn"
          onClick={flyHome}
          data-tooltip="Fly to Area"
          id="tool-fly-home"
        ><IconHome /></button>

        <button
          className={`rp-tool-btn ${rightPanelOpen ? 'active' : ''}`}
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          data-tooltip="Toggle Panel"
          id="tool-toggle-panel"
        ><IconLayers /></button>
      </div>

      {/* ── Drawing Hint ─────────────────────────────────────────────── */}
      {activeTool === 'draw-block' && (
        <div className="rp-draw-hint">
          <span style={{ color: '#f0454a', marginRight: 2 }}>●</span>
          Click map to draw blocked zone polygon
          <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 6px' }}>·</span>
          <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{drawingPolygon.length} pts</span>
          {drawingPolygon.length >= 3 && (
            <button className="rp-draw-hint-commit" onClick={commitDrawingPolygon}>✓ COMMIT</button>
          )}
          <button className="rp-draw-hint-action" onClick={cancelDrawing}>✕ CANCEL</button>
        </div>
      )}

      {/* ── Tool hint for start/goal placement ───────────────────────── */}
      {(activeTool === 'set-start' || activeTool === 'set-goal') && (
        <div className="rp-draw-hint" style={{ borderColor: activeTool === 'set-start' ? 'rgba(52,211,153,0.3)' : 'rgba(251,146,60,0.3)' }}>
          <span style={{ color: activeTool === 'set-start' ? '#34d399' : '#fb923c' }}>●</span>
          Click terrain to place {activeTool === 'set-start' ? 'Origin (Start)' : 'Target (Goal)'} marker
          <button className="rp-draw-hint-action" onClick={() => setActiveTool('select')}>✕ CANCEL</button>
        </div>
      )}

      {/* ── Computing Overlay ─────────────────────────────────────────── */}
      {isComputing && (
        <div className="rp-computing-overlay">
          <div className="rp-spinner" />
          <span className="rp-computing-text">Running A* terrain pathfinder…</span>
        </div>
      )}

      {/* ── Right Intelligence Panel ──────────────────────────────────── */}
      <button
        className={`rp-panel-toggle ${!rightPanelOpen ? 'panel-closed' : ''}`}
        style={{ right: rightPanelOpen ? 340 : 0, transition: 'right 0.3s cubic-bezier(0.4,0,0.2,1)' }}
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
        id="btn-panel-toggle"
      >
        <IconChevron dir={rightPanelOpen ? 'right' : 'left'} />
      </button>

      <div className={`rp-right-panel${rightPanelOpen ? '' : ' collapsed'}`}>

        {/* ── Mission Points ─────────────────────────────────── */}
        <div className="rp-panel-section">
          <div className="rp-panel-label">Mission Points</div>

          <div className={`rp-point-row${startPoint ? ' set' : ''}`}>
            <span className="rp-point-dot start" />
            <span className="rp-point-label">ORIG</span>
            <span className={`rp-point-coords${startPoint ? '' : ' unset'}`}>
              {startPoint ? `${startPoint.lat.toFixed(5)}, ${startPoint.lon.toFixed(5)}` : 'Click tool → map'}
            </span>
            {startPoint && (
              <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer' }} onClick={() => setStartPoint(null)}><IconClose /></button>
            )}
          </div>

          <div className={`rp-point-row${goalPoint ? ' set-goal' : ''}`}>
            <span className="rp-point-dot goal" />
            <span className="rp-point-label">GOAL</span>
            <span className={`rp-point-coords${goalPoint ? '' : ' unset'}`}>
              {goalPoint ? `${goalPoint.lat.toFixed(5)}, ${goalPoint.lon.toFixed(5)}` : 'Click tool → map'}
            </span>
            {goalPoint && (
              <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer' }} onClick={() => setGoalPoint(null)}><IconClose /></button>
            )}
          </div>

          {/* Traversal mode compact display */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '1px', textTransform: 'uppercase' }}>Mode</span>
            <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{MODE_LABELS[traversalMode]}</span>
          </div>
        </div>

        {/* ── Route Result ───────────────────────────────────── */}
        <div className="rp-panel-section">
          <div className="rp-panel-label">Route Analysis</div>

          {!routeResult && !computeError && (
            <div className="rp-hint-card">
              <div className="rp-hint-text">
                Set Origin + Target,<br/>then click <strong style={{ color: 'rgba(255,255,255,0.4)' }}>COMPUTE ROUTE</strong>
              </div>
            </div>
          )}

          {computeError && (
            <div className="rp-warning danger" style={{ marginBottom: 0 }}>
              <span className="rp-warning-icon"><IconWarn /></span>
              {computeError}
            </div>
          )}

          {routeResult && (
            <>
              {/* Quality + Compute time */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span className={`rp-quality-badge ${routeResult.quality}`}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: QUALITY_COLOR[routeResult.quality] }} />
                  {routeResult.quality.replace(/_/g, ' ')}
                </span>
                <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                  {routeResult.computation_time_ms}ms
                </span>
              </div>

              {/* Stats grid */}
              <div className="rp-stats-grid" style={{ marginBottom: 12 }}>
                <div className="rp-stat-card">
                  <div className="rp-stat-value">
                    {routeResult.total_distance_m >= 1000
                      ? (routeResult.total_distance_m / 1000).toFixed(2)
                      : routeResult.total_distance_m.toFixed(0)}
                    <span className="rp-stat-unit">{routeResult.total_distance_m >= 1000 ? 'km' : 'm'}</span>
                  </div>
                  <div className="rp-stat-label">Distance</div>
                </div>
                <div className="rp-stat-card">
                  <div className="rp-stat-value">
                    {routeResult.avg_slope.toFixed(1)}<span className="rp-stat-unit">°</span>
                  </div>
                  <div className="rp-stat-label">Avg Slope</div>
                </div>
                <div className="rp-stat-card">
                  <div className="rp-stat-value" style={{ color: slopeColor(routeResult.max_slope) }}>
                    {routeResult.max_slope.toFixed(1)}<span className="rp-stat-unit">°</span>
                  </div>
                  <div className="rp-stat-label">Max Slope</div>
                </div>
                <div className="rp-stat-card">
                  <div className="rp-stat-value" style={{ color: routeResult.steep_percentage > 20 ? '#f0454a' : 'rgba(255,255,255,0.9)' }}>
                    {routeResult.steep_percentage.toFixed(0)}<span className="rp-stat-unit">%</span>
                  </div>
                  <div className="rp-stat-label">Steep Terrain</div>
                </div>
              </div>

              {/* Difficulty bar */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Terrain Difficulty</span>
                  <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                    {routeResult.quality === 'SAFE' ? 'LOW' : routeResult.quality === 'CAUTION' ? 'MEDIUM' : 'HIGH'}
                  </span>
                </div>
                <div className="rp-difficulty-bar">
                  <div
                    className="rp-difficulty-fill"
                    style={{
                      width: `${Math.min(routeResult.steep_percentage * 2.5, 100)}%`,
                      background: `linear-gradient(90deg, #34d399, ${slopeColor(routeResult.max_slope)})`,
                    }}
                  />
                </div>
              </div>

              {/* Elevation profile */}
              {elevProfile.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>
                    Elevation Profile
                  </div>
                  <div className="rp-elev-bars">
                    {elevProfile.map((p, i) => (
                      <div
                        key={i}
                        className="rp-elev-bar"
                        style={{
                          height: `${Math.max(p.pct, 4)}%`,
                          background: `linear-gradient(to top, #0ea5e9, #38bdf8)`,
                          opacity: 0.7,
                        }}
                        title={`${p.e.toFixed(0)}m`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Terrain breakdown */}
              {Object.keys(routeResult.terrain_breakdown).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>
                    Terrain Breakdown
                  </div>
                  {Object.entries(routeResult.terrain_breakdown).map(([cat, count]) => {
                    const total = Object.values(routeResult!.terrain_breakdown).reduce((a, b) => a + b, 0);
                    const pct = Math.round((count / total) * 100);
                    const catColor = cat === 'STEEP_TERRAIN' ? '#f0454a' : cat === 'VEGETATION' ? '#a3e635' : '#38bdf8';
                    return (
                      <div key={cat} style={{ marginBottom: 5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{cat}</span>
                          <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 9, color: catColor }}>{pct}%</span>
                        </div>
                        <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: catColor, borderRadius: 1, opacity: 0.7 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Warnings */}
              {routeResult.warnings.length > 0 && (
                <div>
                  <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6, marginTop: 4}}>
                    Warnings
                  </div>
                  {routeResult.warnings.map((w, i) => (
                    <div key={i} className={`rp-warning ${w.severity}`}>
                      <span className="rp-warning-icon"><IconWarn /></span>
                      {w.message}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Terrain Inspector ──────────────────────────────── */}
        <div className="rp-panel-section">
          <div className="rp-panel-label">Terrain Inspector</div>
          {cursorInfo ? (
            <div>
              <div className="rp-inspector-row">
                <span className="rp-inspector-key">Lat / Lon</span>
                <span className="rp-inspector-val">{cursorInfo.lat.toFixed(5)}, {cursorInfo.lon.toFixed(5)}</span>
              </div>
              <div className="rp-inspector-row">
                <span className="rp-inspector-key">Elevation</span>
                <span className="rp-inspector-val">{cursorInfo.elevation} m</span>
              </div>
            </div>
          ) : (
            <div className="rp-hint-card">
              <div className="rp-hint-text">Move cursor over terrain</div>
            </div>
          )}
        </div>

        {/* ── Layer Toggles ──────────────────────────────────── */}
        <div className="rp-panel-section">
          <div className="rp-panel-label">Layers</div>
          {(Object.keys(layers) as (keyof typeof layers)[]).map((key) => (
            <div key={key} className="rp-layer-row">
              <span className="rp-layer-label">
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: key === 'route' ? '#38bdf8' : key === 'blockedZones' ? '#f0454a' : '#a3e635',
                }} />
                {key === 'route' ? 'Route Path' : key === 'blockedZones' ? 'Blocked Zones' : 'Terrain Overlay'}
              </span>
              <label className="rp-toggle">
                <input type="checkbox" checked={layers[key]} onChange={() => toggleLayer(key)} />
                <span className="rp-toggle-slider" />
              </label>
            </div>
          ))}
        </div>

        {/* ── Blocked Zones ──────────────────────────────────── */}
        {blockedZones.length > 0 && (
        <div className="rp-panel-section">
          <div className="rp-panel-label">Blocked Zones ({blockedZones.length})</div>
          {blockedZones.map((z) => (
            <div key={z.id} className="rp-zone-chip">
              <span className="rp-zone-id">{z.id.toUpperCase()} · {z.polygon.length - 1} pts</span>
              <button className="rp-zone-remove" onClick={() => removeBlockedZone(z.id)}>
                <IconClose />
              </button>
            </div>
          ))}
        </div>
        )}

        {/* ── Resolution ─────────────────────────────────────── */}
        <div className="rp-panel-section">
          <div className="rp-panel-label">Grid Resolution</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range"
              min={15} max={100} step={5}
              value={store.gridResolution}
              onChange={(e) => store.setGridResolution(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#38bdf8' }}
            />
            <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'rgba(255,255,255,0.6)', minWidth: 36 }}>
              {store.gridResolution}m
            </span>
          </div>
          <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
            Lower = more precise, slower
          </div>
        </div>

      </div>{/* end right panel */}

      {/* ── Bottom Status Bar ────────────────────────────────────── */}
      <div className="rp-statusbar">
        <div className="rp-statusbar-item">
          <span className="rp-statusbar-key">LAT</span>
          <span className="rp-statusbar-val">{cursorInfo ? cursorInfo.lat.toFixed(5) : '—'}</span>
        </div>
        <div className="rp-statusbar-item">
          <span className="rp-statusbar-key">LON</span>
          <span className="rp-statusbar-val">{cursorInfo ? cursorInfo.lon.toFixed(5) : '—'}</span>
        </div>
        <div className="rp-statusbar-item">
          <span className="rp-statusbar-key">ELEV</span>
          <span className="rp-statusbar-val">{cursorInfo ? `${cursorInfo.elevation} m` : '—'}</span>
        </div>
        <div className="rp-statusbar-item">
          <span className="rp-statusbar-key">CAM</span>
          <span className="rp-statusbar-val">{(cameraAlt / 1000).toFixed(1)} km</span>
        </div>
        <div className="rp-statusbar-item">
          <span className="rp-statusbar-key">MODE</span>
          <span className="rp-statusbar-val" style={{ textTransform: 'uppercase' }}>{traversalMode.replace('_', ' ')}</span>
        </div>
        <div className="rp-statusbar-spacer" />
        {activeTool !== 'select' && (
          <span className="rp-tool-hint">
            {activeTool === 'set-start' && '● CLICK MAP TO SET ORIGIN'}
            {activeTool === 'set-goal'  && '● CLICK MAP TO SET TARGET'}
            {activeTool === 'draw-block' && `● DRAWING ZONE · ${drawingPolygon.length} PTS · DOUBLE-CLICK TO CLOSE`}
          </span>
        )}
        <div className="rp-statusbar-item" style={{ borderRight: 'none', marginLeft: 12 }}>
          <span className="rp-statusbar-key">CESIUM</span>
          <span className="rp-statusbar-val" style={{ color: cesiumReady ? '#34d399' : '#f5a623' }}>
            {cesiumReady ? 'READY' : 'LOADING'}
          </span>
        </div>
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** Generate a coloured SVG pin as a data URL for Cesium billboards */
function _makePin(color: string, letter: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.5)"/>
      </filter>
    </defs>
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.06 27.94 0 18 0z"
      fill="${color}" filter="url(#shadow)"/>
    <circle cx="18" cy="18" r="9" fill="rgba(0,0,0,0.3)"/>
    <text x="18" y="23" text-anchor="middle" font-family="'Outfit',sans-serif" font-size="12"
      font-weight="700" fill="white">${letter}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
