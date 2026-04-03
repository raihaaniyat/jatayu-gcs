// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — TypeScript Data Models
//  All interfaces matching the backend API contracts
// ════════════════════════════════════════════════════════════════════════

export interface Telemetry {
  lat: number;
  lon: number;
  alt_m: number;
  hdg: number;
  mode: string;
  battery: number | null;
  link: 'online' | 'offline';
  ground_speed?: number;
  climb_rate?: number;
  roll?: number;
  pitch?: number;
}

export interface Detection {
  id: string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
  pose: string;
  severity: number;
  gps_lat: number;
  gps_lon: number;
}

export interface SavedTarget {
  id: string;
  timestamp: string;
  gps_lat: number;
  gps_lon: number;
  severity: number;
  pose: string;
  snapshot_path: string | null;
  bbox_image_path: string | null;
  track_id: string;
  status: 'detected' | 'RESPONSIVE' | 'HIGH' | 'CRITICAL';
}

export interface Recording {
  id: string;
  filename: string;
  timestamp: string;
  duration_s: number;
  size_bytes: number;
  status: 'recording' | 'completed' | 'failed';
}

export interface RouteGeometry {
  id: string;
  name: string;
  type: 'direct_aerial' | 'shortest_path' | 'straight' | 'road' | 'terrain';
  color?: string;
  coordinates: [number, number][]; // [lat, lon][]
  distance_m: number;
  estimated_time_s?: number;
}

export interface PayloadStatus {
  ready: boolean;
  servo_connected: boolean;
  last_drop_time: string | null;
  payload_count: number;
}

export type PayloadDropState =
  | 'idle'
  | 'command_sent'
  | 'waiting_ack'
  | 'servo_triggered'
  | 'payload_dropped'
  | 'drop_failed'
  | 'drop_completed';

export interface PayloadDropEvent {
  id: string;
  target_id: string;
  gps_lat: number;
  gps_lon: number;
  drop_mode: 'SERVO';
  status: PayloadDropState;
  timestamp: string;
  ack_timestamp?: string;
  error?: string;
}

export type ActionStatus = 'success' | 'failure' | 'pending' | 'warning';

export interface ActionLogEntry {
  id: string;
  timestamp: string;
  action_type: string;
  context: string;
  status: ActionStatus;
  details?: string;
}

export interface BackendHealth {
  status: 'ok' | 'degraded' | 'offline';
  mavlink_connected: boolean;
  model_loaded: boolean;
  video_active: boolean;
  pipeline_running: boolean;
  cluster_count: number;
}

export interface MapTarget {
  id: string;
  gps_lat: number;
  gps_lon: number;
  severity: number;
  status: string;
  pose: string;
  timestamp: string;
  track_id: string;
}

// Navigation tab identifiers
export type TabId =
  | 'overview'
  | 'mission'
  | 'tactical-map'
  | 'targets'
  | 'payload'
  | 'recordings'
  | 'settings';

export interface NavTab {
  id: TabId;
  label: string;
  icon: string;
  shortcut?: string;
}
