// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — REST API Service Layer
// ════════════════════════════════════════════════════════════════════════

import { API_CONFIG, ENDPOINTS } from '@/config/api';
import type {
  Telemetry,
  Detection,
  SavedTarget,
  Recording,
  PayloadStatus,
  PayloadDropEvent,
  ActionLogEntry,
  BackendHealth,
  MapTarget,
  RouteGeometry,
} from '@/types';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
    if (!res.ok) {
      throw new Error(`API ${res.status}: ${res.statusText}`);
    }
    return res.json();
  }

  // ── Telemetry ───────────────────────────────────────────────────────
  async getTelemetry(): Promise<Telemetry> {
    return this.request<Telemetry>(ENDPOINTS.telemetry);
  }

  async getHealth(): Promise<BackendHealth> {
    return this.request<BackendHealth>(ENDPOINTS.health);
  }

  // ── Drone Control ──────────────────────────────────────────────────
  async setDroneMode(mode: string): Promise<{ success: boolean; message: string }> {
    return this.request(ENDPOINTS.droneMode, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  }

  async setDroneAltitude(altitude_m: number): Promise<{ success: boolean; message: string }> {
    return this.request(ENDPOINTS.droneAltitude, {
      method: 'POST',
      body: JSON.stringify({ altitude_m }),
    });
  }

  // ── Detections ─────────────────────────────────────────────────────
  async getActiveDetections(): Promise<Detection[]> {
    return this.request<Detection[]>(ENDPOINTS.detectionsActive);
  }

  // ── Targets ────────────────────────────────────────────────────────
  async getTargets(): Promise<SavedTarget[]> {
    return this.request<SavedTarget[]>(ENDPOINTS.targets);
  }

  async getTargetById(id: string): Promise<SavedTarget> {
    return this.request<SavedTarget>(ENDPOINTS.targetById(id));
  }

  async saveTarget(data: {
    severity: number;
    pose: string;
    bbox: [number, number, number, number];
    gps_lat: number;
    gps_lon: number;
  }): Promise<SavedTarget> {
    return this.request<SavedTarget>(ENDPOINTS.targetSave, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── Recordings ─────────────────────────────────────────────────────
  async startRecording(): Promise<{ success: boolean; recording_id: string }> {
    return this.request(ENDPOINTS.recordingsStart, { method: 'POST' });
  }

  async stopRecording(): Promise<{ success: boolean }> {
    return this.request(ENDPOINTS.recordingsStop, { method: 'POST' });
  }

  async getRecordings(): Promise<Recording[]> {
    return this.request<Recording[]>(ENDPOINTS.recordings);
  }

  // ── Payload ────────────────────────────────────────────────────────
  async dropPayload(data: {
    target_id: string;
    gps_lat: number;
    gps_lon: number;
    drop_mode: 'SERVO';
  }): Promise<PayloadDropEvent> {
    return this.request<PayloadDropEvent>(ENDPOINTS.payloadDrop, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPayloadStatus(): Promise<PayloadStatus> {
    return this.request<PayloadStatus>(ENDPOINTS.payloadStatus);
  }

  async getPayloadHistory(): Promise<PayloadDropEvent[]> {
    return this.request<PayloadDropEvent[]>(ENDPOINTS.payloadHistory);
  }

  // ── Map ────────────────────────────────────────────────────────────
  async getMapTargets(): Promise<MapTarget[]> {
    return this.request<MapTarget[]>(ENDPOINTS.mapTargets);
  }

  async getMapRoutes(
    opLat: number = 26.2306, opLon: number = 78.2070, opAlt: number = 0,
    droneLat?: number, droneLon?: number, droneAlt: number = 0
  ): Promise<RouteGeometry[]> {
    let url = `${ENDPOINTS.mapRoutes}?op_lat=${opLat}&op_lon=${opLon}&op_alt=${opAlt}`;
    if (droneLat !== undefined && droneLon !== undefined) {
      url += `&drone_lat=${droneLat}&drone_lon=${droneLon}&drone_alt=${droneAlt}`;
    }
    return this.request<RouteGeometry[]>(url);
  }

  // ── Action Log ─────────────────────────────────────────────────────
  async getActionLog(): Promise<ActionLogEntry[]> {
    return this.request<ActionLogEntry[]>(ENDPOINTS.actionsLog);
  }

  async addActionLog(entry: Omit<ActionLogEntry, 'id'>): Promise<ActionLogEntry> {
    return this.request<ActionLogEntry>(ENDPOINTS.actionsLog, {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  // ── Video Stream & AI ──────────────────────────────────────────────
  getVideoStreamUrl(): string {
    return `${this.baseUrl}${ENDPOINTS.videoStream}`;
  }

  async getVideoStatus(): Promise<{ model_loaded: boolean, current_source: string | null, available_videos: string[] }> {
    return this.request(ENDPOINTS.videoStatus);
  }

  async toggleVideoModel(): Promise<{ success: boolean, model_loaded: boolean, message: string }> {
    return this.request(ENDPOINTS.videoModelToggle, { method: 'POST' });
  }

  async setVideoSource(source: string): Promise<{ success: boolean }> {
    return this.request(ENDPOINTS.videoSource, {
      method: 'POST',
      body: JSON.stringify({ source }),
    });
  }

  async deleteVideo(filename: string): Promise<{ success: boolean }> {
    return this.request(ENDPOINTS.videoDelete(filename), { method: 'DELETE' });
  }
}

export const api = new ApiService();
