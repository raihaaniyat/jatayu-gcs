// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Zustand Mission Store
//  Central reactive state for the entire frontend
// ════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type {
  Telemetry,
  Detection,
  SavedTarget,
  Recording,
  PayloadStatus,
  PayloadDropEvent,
  ActionLogEntry,
  BackendHealth,
  TabId,
  ActionStatus,
} from '@/types';

interface MissionState {
  // ── Navigation ─────────────────────────────────────────────────────
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;

  // ── Theme ──────────────────────────────────────────────────────────
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // ── Telemetry ──────────────────────────────────────────────────────
  telemetry: Telemetry;
  setTelemetry: (t: Partial<Telemetry>) => void;

  // ── Detections ─────────────────────────────────────────────────────
  detections: Detection[];
  setDetections: (d: Detection[]) => void;

  // ── Clusters ───────────────────────────────────────────────────────
  clusters: unknown[];
  setClusters: (c: unknown[]) => void;

  // ── Saved Targets ──────────────────────────────────────────────────
  savedTargets: SavedTarget[];
  setSavedTargets: (t: SavedTarget[]) => void;
  addSavedTarget: (t: SavedTarget) => void;
  fetchSavedTargets: () => Promise<void>;

  // ── Recordings ─────────────────────────────────────────────────────
  recordings: Recording[];
  setRecordings: (r: Recording[]) => void;
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;

  // ── Payload ────────────────────────────────────────────────────────
  payloadStatus: PayloadStatus;
  setPayloadStatus: (s: PayloadStatus) => void;
  payloadHistory: PayloadDropEvent[];
  setPayloadHistory: (h: PayloadDropEvent[]) => void;
  addPayloadEvent: (e: PayloadDropEvent) => void;

  // ── Action Log ─────────────────────────────────────────────────────
  actionLog: ActionLogEntry[];
  addActionLog: (entry: Omit<ActionLogEntry, 'id'>) => void;
  clearActionLog: () => void;
  actionLogOpen: boolean;
  setActionLogOpen: (v: boolean) => void;

  // ── System Status ──────────────────────────────────────────────────
  systemStatus: BackendHealth;
  setSystemStatus: (s: Partial<BackendHealth>) => void;

  // ── WebSocket ──────────────────────────────────────────────────────
  wsConnected: boolean;
  setWsConnected: (v: boolean) => void;

  // ── Map ────────────────────────────────────────────────────────────
  mapFocusTarget: { lat: number; lon: number } | null;
  focusMapTarget: (lat: number, lon: number) => void;
  clearMapFocus: () => void;

  // ── Selected Target ────────────────────────────────────────────────
  selectedTarget: SavedTarget | null;
  setSelectedTarget: (t: SavedTarget | null) => void;
}

export const useMissionStore = create<MissionState>((set) => ({
  // Navigation
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Theme
  theme: 'light',
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      return { theme: next };
    }),

  // Telemetry
  telemetry: {
    lat: 0, lon: 0, alt_m: 0, hdg: 0,
    mode: 'UNKNOWN', battery: null, link: 'offline',
  },
  setTelemetry: (t) => set((s) => ({ telemetry: { ...s.telemetry, ...t } })),

  // Detections
  detections: [],
  setDetections: (d) => set({ detections: d }),

  // Clusters
  clusters: [],
  setClusters: (c) => set({ clusters: c }),

  // Saved Targets
  savedTargets: [],
  setSavedTargets: (t) => set({ savedTargets: t }),
  addSavedTarget: (t) => set((s) => ({ savedTargets: [t, ...s.savedTargets] })),
  fetchSavedTargets: async () => {
    try {
      // Need to dynamically import to avoid circular dependency if api depends on store
      const { api } = await import('@/services/api');
      const targets = await api.getTargets();
      set({ savedTargets: targets });
    } catch (e) {
      console.error('Failed to fetch saved targets', e);
    }
  },

  // Recordings
  recordings: [],
  setRecordings: (r) => set({ recordings: r }),
  isRecording: false,
  setIsRecording: (v) => set({ isRecording: v }),

  // Payload
  payloadStatus: {
    ready: false, servo_connected: false,
    last_drop_time: null, payload_count: 0,
  },
  setPayloadStatus: (s) => set({ payloadStatus: s }),
  payloadHistory: [],
  setPayloadHistory: (h) => set({ payloadHistory: h }),
  addPayloadEvent: (e) => set((s) => ({ payloadHistory: [e, ...s.payloadHistory] })),

  // Action Log
  actionLog: [],
  addActionLog: (entry) =>
    set((s) => ({
      actionLog: [
        { ...entry, id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
        ...s.actionLog,
      ].slice(0, 200),
    })),
  clearActionLog: () => set({ actionLog: [] }),
  actionLogOpen: false,
  setActionLogOpen: (v) => set({ actionLogOpen: v }),

  // System Status
  systemStatus: {
    status: 'offline',
    mavlink_connected: false,
    model_loaded: false,
    video_active: false,
    pipeline_running: false,
    cluster_count: 0,
  },
  setSystemStatus: (s) => set((prev) => ({ systemStatus: { ...prev.systemStatus, ...s } })),

  // WebSocket
  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),

  // Map
  mapFocusTarget: null,
  focusMapTarget: (lat, lon) => set({ mapFocusTarget: { lat, lon } }),
  clearMapFocus: () => set({ mapFocusTarget: null }),

  // Selected Target
  selectedTarget: null,
  setSelectedTarget: (t) => set({ selectedTarget: t }),
}));
