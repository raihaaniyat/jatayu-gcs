// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — WebSocket Manager
// ════════════════════════════════════════════════════════════════════════

import { API_CONFIG } from '@/config/api';
import { useMissionStore } from '@/store/missionStore';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 10000;

export function connectWebSocket() {
  if (ws?.readyState === WebSocket.OPEN) return;

  const store = useMissionStore.getState();

  try {
    ws = new WebSocket(API_CONFIG.WS_URL);

    ws.onopen = () => {
      reconnectAttempts = 0;
      store.setWsConnected(true);
      store.addActionLog({
        timestamp: new Date().toISOString(),
        action_type: 'SYSTEM',
        context: 'WebSocket connected',
        status: 'success',
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWsMessage(data);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      store.setWsConnected(false);
      scheduleReconnect();
    };

    ws.onerror = () => {
      store.setWsConnected(false);
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, delay);
}

function handleWsMessage(data: { type: string; payload: unknown }) {
  const store = useMissionStore.getState();

  switch (data.type) {
    case 'telemetry':
      store.setTelemetry(data.payload as Parameters<typeof store.setTelemetry>[0]);
      break;
    case 'detections':
      store.setDetections(data.payload as Parameters<typeof store.setDetections>[0]);
      break;
    case 'clusters':
      store.setClusters(data.payload as Parameters<typeof store.setClusters>[0]);
      break;
    case 'status':
      store.setSystemStatus(data.payload as Parameters<typeof store.setSystemStatus>[0]);
      break;
    case 'event':
      store.addActionLog(data.payload as Parameters<typeof store.addActionLog>[0]);
      break;
  }
}

export function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}
