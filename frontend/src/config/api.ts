// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — API Configuration
// ════════════════════════════════════════════════════════════════════════

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws',
  TELEMETRY_POLL_MS: 500,
  HEALTH_POLL_MS: 5000,
  VIDEO_STREAM_URL: '/api/video/stream',
} as const;

export const ENDPOINTS = {
  // Telemetry
  telemetry: '/api/telemetry',
  health: '/api/health',

  // Drone control
  droneMode: '/api/drone/mode',
  droneAltitude: '/api/drone/altitude',

  // Detections
  detectionsActive: '/api/detections/active',

  // Targets
  targets: '/api/targets',
  targetById: (id: string) => `/api/targets/${id}`,
  targetSave: '/api/targets/save',

  // Recordings
  recordingsStart: '/api/recordings/start',
  recordingsStop: '/api/recordings/stop',
  recordings: '/api/recordings',

  // Payload
  payloadDrop: '/api/payload/drop',
  payloadStatus: '/api/payload/status',
  payloadHistory: '/api/payload/history',

  // Map
  mapTargets: '/api/map/targets',
  mapRoutes: '/api/map/routes',

  // Actions
  actionsLog: '/api/actions/log',

  // Video
  videoStream: '/api/video/stream',
  videoStatus: '/api/video/status',
  videoCameras: '/api/video/cameras',
  videoModelToggle: '/api/video/model/toggle',
  videoSource: '/api/video/source',
  videoDelete: (f: string) => `/api/video/upload/${encodeURIComponent(f)}`,
} as const;
