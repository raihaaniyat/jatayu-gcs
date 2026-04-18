// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Route Planner Zustand Store
// ════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type {
  Coordinate,
  TraversalMode,
  BlockedZone,
  RouteResult,
  ActiveTool,
  TerrainCursorInfo,
} from '@/types/routePlannerTypes';

interface RoutePlannerState {
  // ── Points ───────────────────────────────────────────────────────────
  startPoint: Coordinate | null;
  goalPoint: Coordinate | null;
  setStartPoint: (c: Coordinate | null) => void;
  setGoalPoint: (c: Coordinate | null) => void;

  // ── Traversal ────────────────────────────────────────────────────────
  traversalMode: TraversalMode;
  setTraversalMode: (m: TraversalMode) => void;

  // ── Active Tool ──────────────────────────────────────────────────────
  activeTool: ActiveTool;
  setActiveTool: (t: ActiveTool) => void;

  // ── Blocked Zones ────────────────────────────────────────────────────
  blockedZones: BlockedZone[];
  addBlockedZone: (z: BlockedZone) => void;
  removeBlockedZone: (id: string) => void;
  clearBlockedZones: () => void;

  // ── Drawing State ────────────────────────────────────────────────────
  drawingPolygon: Coordinate[];
  addDrawingPoint: (c: Coordinate) => void;
  commitDrawingPolygon: () => void;
  cancelDrawing: () => void;

  // ── Route Result ─────────────────────────────────────────────────────
  routeResult: RouteResult | null;
  isComputing: boolean;
  computeError: string | null;
  setRouteResult: (r: RouteResult | null) => void;
  setIsComputing: (v: boolean) => void;
  setComputeError: (e: string | null) => void;

  // ── Cursor Info ──────────────────────────────────────────────────────
  cursorInfo: TerrainCursorInfo | null;
  setCursorInfo: (info: TerrainCursorInfo | null) => void;

  // ── Layer Visibility ─────────────────────────────────────────────────
  layers: {
    route: boolean;
    blockedZones: boolean;
    terrainOverlay: boolean;
  };
  toggleLayer: (key: keyof RoutePlannerState['layers']) => void;

  // ── Panel ────────────────────────────────────────────────────────────
  rightPanelOpen: boolean;
  setRightPanelOpen: (v: boolean) => void;

  // ── Grid Resolution ──────────────────────────────────────────────────
  gridResolution: number;
  setGridResolution: (v: number) => void;

  // ── Reset ────────────────────────────────────────────────────────────
  resetAll: () => void;
}

let _zoneIdCounter = 1;

export const useRoutePlannerStore = create<RoutePlannerState>((set, get) => ({
  startPoint: null,
  goalPoint: null,
  setStartPoint: (c) => set({ startPoint: c }),
  setGoalPoint: (c) => set({ goalPoint: c }),

  traversalMode: 'FOOT_TEAM',
  setTraversalMode: (m) => set({ traversalMode: m }),

  activeTool: 'select',
  setActiveTool: (t) => set({ activeTool: t }),

  blockedZones: [],
  addBlockedZone: (z) => set((s) => ({ blockedZones: [...s.blockedZones, z] })),
  removeBlockedZone: (id) => set((s) => ({ blockedZones: s.blockedZones.filter((z) => z.id !== id) })),
  clearBlockedZones: () => set({ blockedZones: [] }),

  drawingPolygon: [],
  addDrawingPoint: (c) => set((s) => ({ drawingPolygon: [...s.drawingPolygon, c] })),
  commitDrawingPolygon: () => {
    const { drawingPolygon } = get();
    if (drawingPolygon.length >= 3) {
      const zone: BlockedZone = {
        id: `zone-${_zoneIdCounter++}`,
        polygon: [...drawingPolygon, drawingPolygon[0]], // close polygon
      };
      set((s) => ({ blockedZones: [...s.blockedZones, zone], drawingPolygon: [], activeTool: 'select' }));
    } else {
      set({ drawingPolygon: [], activeTool: 'select' });
    }
  },
  cancelDrawing: () => set({ drawingPolygon: [], activeTool: 'select' }),

  routeResult: null,
  isComputing: false,
  computeError: null,
  setRouteResult: (r) => set({ routeResult: r }),
  setIsComputing: (v) => set({ isComputing: v }),
  setComputeError: (e) => set({ computeError: e }),

  cursorInfo: null,
  setCursorInfo: (info) => set({ cursorInfo: info }),

  layers: {
    route: true,
    blockedZones: true,
    terrainOverlay: false,
  },
  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),

  rightPanelOpen: true,
  setRightPanelOpen: (v) => set({ rightPanelOpen: v }),

  gridResolution: 30,
  setGridResolution: (v) => set({ gridResolution: v }),

  resetAll: () =>
    set({
      startPoint: null,
      goalPoint: null,
      routeResult: null,
      blockedZones: [],
      drawingPolygon: [],
      activeTool: 'select',
      computeError: null,
      isComputing: false,
    }),
}));
