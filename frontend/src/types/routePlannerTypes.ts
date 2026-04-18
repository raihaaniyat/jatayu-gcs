// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Route Planner Type Definitions
// ════════════════════════════════════════════════════════════════════════

export interface Coordinate {
  lat: number;
  lon: number;
}

export type TraversalMode = 'FOOT_TEAM' | 'LIGHT_VEHICLE' | 'ROVER' | 'SUPPLY_DROP';

export type RouteQuality = 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'NO_FEASIBLE_ROUTE';

export type ActiveTool = 'select' | 'set-start' | 'set-goal' | 'draw-block' | 'erase-block';

export interface BlockedZone {
  id: string;
  polygon: Coordinate[];
}

export interface RouteWarning {
  type: string;
  message: string;
  severity: 'info' | 'caution' | 'danger';
}

export interface RouteSegment {
  lat: number;
  lon: number;
  elevation: number;
  slope: number;
  cost: number;
  terrain_category: string;
}

export interface RouteResult {
  route_id: string;
  polyline: Coordinate[];
  segments: RouteSegment[];
  total_distance_m: number;
  total_cost: number;
  avg_slope: number;
  max_slope: number;
  steep_percentage: number;
  terrain_breakdown: Record<string, number>;
  warnings: RouteWarning[];
  quality: RouteQuality;
  traversal_mode: string;
  computation_time_ms: number;
}

export interface ElevationData {
  lat: number;
  lon: number;
  elevation: number;
  slope: number;
  terrain_category: string;
  traversability_cost: number;
}

export interface RoutePlanRequest {
  start: Coordinate;
  goal: Coordinate;
  traversal_mode: TraversalMode;
  blocked_zones: BlockedZone[];
  grid_resolution: number;
}

export interface TerrainCursorInfo {
  lat: number;
  lon: number;
  elevation: number;
  slope: number;
  terrain_category: string;
  cost: number;
}
