// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Route Planner API Service
// ════════════════════════════════════════════════════════════════════════

import type { RoutePlanRequest, RouteResult, ElevationData } from '@/types/routePlannerTypes';

const BASE = '/api';

export const routePlannerApi = {
  async planRoute(req: RoutePlanRequest): Promise<RouteResult> {
    const res = await fetch(`${BASE}/route/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async getElevation(lat: number, lon: number, mode = 'FOOT_TEAM'): Promise<ElevationData> {
    const res = await fetch(`${BASE}/terrain/elevation?lat=${lat}&lon=${lon}&mode=${mode}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};
