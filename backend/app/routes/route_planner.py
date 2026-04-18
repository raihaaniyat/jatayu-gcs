"""
JATAYU GCS — Terrain-Aware Rescue Route Planner
A* pathfinding over elevation-derived cost maps with traversal mode support.
"""
from __future__ import annotations

import heapq
import math
import time
import logging
from typing import List, Tuple, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

log = logging.getLogger("gcs.route_planner")
router = APIRouter()

# ═══════════════════════════════════════════════════════════════════════
#  DATA MODELS
# ═══════════════════════════════════════════════════════════════════════

class Coordinate(BaseModel):
    lat: float
    lon: float

class BlockedZone(BaseModel):
    id: str
    polygon: List[Coordinate]  # closed polygon vertices

class RoutePlanRequest(BaseModel):
    start: Coordinate
    goal: Coordinate
    traversal_mode: str = Field(default="FOOT_TEAM", description="FOOT_TEAM | LIGHT_VEHICLE | ROVER | SUPPLY_DROP")
    blocked_zones: List[BlockedZone] = Field(default_factory=list)
    grid_resolution: float = Field(default=30.0, description="Grid cell size in meters")

class RouteSegment(BaseModel):
    lat: float
    lon: float
    elevation: float
    slope: float
    cost: float
    terrain_category: str

class RouteWarning(BaseModel):
    type: str  # STEEP_SLOPE | NEAR_BLOCKED | LOW_CONFIDENCE | LONG_ROUTE
    message: str
    severity: str  # info | caution | danger

class RouteResult(BaseModel):
    route_id: str
    polyline: List[Coordinate]
    segments: List[RouteSegment]
    total_distance_m: float
    total_cost: float
    avg_slope: float
    max_slope: float
    steep_percentage: float
    terrain_breakdown: dict
    warnings: List[RouteWarning]
    quality: str  # SAFE | CAUTION | HIGH_RISK | NO_FEASIBLE_ROUTE
    traversal_mode: str
    computation_time_ms: float

class ElevationResponse(BaseModel):
    lat: float
    lon: float
    elevation: float
    slope: float
    terrain_category: str
    traversability_cost: float

class CostMapCell(BaseModel):
    row: int
    col: int
    lat: float
    lon: float
    elevation: float
    slope: float
    cost: float
    blocked: bool
    terrain_category: str

class CostMapResponse(BaseModel):
    bounds: dict
    resolution_m: float
    rows: int
    cols: int
    cells: List[CostMapCell]

# ═══════════════════════════════════════════════════════════════════════
#  TERRAIN ENGINE
# ═══════════════════════════════════════════════════════════════════════

# Traversal mode cost multipliers for different terrain situations
MODE_COSTS = {
    "FOOT_TEAM": {
        "flat": 1.0, "gentle_slope": 1.5, "moderate_slope": 3.0,
        "steep_slope": 6.0, "very_steep": 15.0, "vegetation": 2.5,
        "water": 50.0, "road": 0.5,
    },
    "LIGHT_VEHICLE": {
        "flat": 0.5, "gentle_slope": 1.0, "moderate_slope": 4.0,
        "steep_slope": 20.0, "very_steep": 999.0, "vegetation": 5.0,
        "water": 999.0, "road": 0.3,
    },
    "ROVER": {
        "flat": 0.6, "gentle_slope": 1.2, "moderate_slope": 3.5,
        "steep_slope": 10.0, "very_steep": 30.0, "vegetation": 4.0,
        "water": 999.0, "road": 0.4,
    },
    "SUPPLY_DROP": {
        "flat": 0.8, "gentle_slope": 1.3, "moderate_slope": 2.5,
        "steep_slope": 5.0, "very_steep": 12.0, "vegetation": 2.0,
        "water": 40.0, "road": 0.4,
    },
}


def _get_elevation(lat: float, lon: float) -> float:
    """
    Procedural terrain elevation generator based on coordinates.
    Produces realistic-looking terrain with hills, valleys, and ridges.
    Tuned for the Gwalior region (~200-400m base elevation).
    """
    # Base elevation for the region
    base = 250.0

    # Large-scale terrain features (hills/valleys)
    x = lat * 1000.0
    y = lon * 1000.0

    # Multi-octave noise approximation using sin/cos
    e = 0.0
    e += 80.0 * math.sin(x * 0.007 + 1.3) * math.cos(y * 0.009 + 0.7)
    e += 40.0 * math.sin(x * 0.017 + 2.1) * math.cos(y * 0.023 + 1.4)
    e += 20.0 * math.cos(x * 0.041 + 0.5) * math.sin(y * 0.037 + 3.2)
    e += 10.0 * math.sin(x * 0.097 + 4.1) * math.cos(y * 0.083 + 2.8)
    e += 5.0 * math.cos(x * 0.193 + 1.7) * math.sin(y * 0.167 + 0.3)

    # Ridge feature
    ridge = 30.0 * max(0, math.sin(x * 0.012 + y * 0.008))

    return max(base + e + ridge, 100.0)


def _get_slope(lat: float, lon: float, delta: float = 0.0003) -> float:
    """Compute slope in degrees from elevation gradient."""
    e_center = _get_elevation(lat, lon)
    e_north = _get_elevation(lat + delta, lon)
    e_east = _get_elevation(lat, lon + delta)

    # Distance in meters (approximate)
    d_lat = delta * 111320.0
    d_lon = delta * 111320.0 * math.cos(math.radians(lat))

    dx = (e_east - e_center) / d_lon if d_lon > 0 else 0
    dy = (e_north - e_center) / d_lat if d_lat > 0 else 0

    gradient = math.sqrt(dx * dx + dy * dy)
    slope_deg = math.degrees(math.atan(gradient))
    return round(slope_deg, 2)


def _classify_terrain(slope: float) -> str:
    """Classify terrain based on slope."""
    if slope < 3:
        return "flat"
    elif slope < 8:
        return "gentle_slope"
    elif slope < 15:
        return "moderate_slope"
    elif slope < 25:
        return "steep_slope"
    else:
        return "very_steep"


def _get_terrain_category_label(slope: float) -> str:
    mapping = {
        "flat": "OPEN_GROUND",
        "gentle_slope": "OPEN_GROUND",
        "moderate_slope": "VEGETATION",
        "steep_slope": "STEEP_TERRAIN",
        "very_steep": "BLOCKED",
    }
    return mapping.get(_classify_terrain(slope), "UNKNOWN")


def _cell_cost(slope: float, mode: str) -> float:
    terrain = _classify_terrain(slope)
    costs = MODE_COSTS.get(mode, MODE_COSTS["FOOT_TEAM"])
    return costs.get(terrain, 5.0)


def _point_in_polygon(lat: float, lon: float, polygon: List[Coordinate]) -> bool:
    """Ray-casting point-in-polygon test."""
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        yi, xi = polygon[i].lat, polygon[i].lon
        yj, xj = polygon[j].lat, polygon[j].lon
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in meters between two lat/lon points."""
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ═══════════════════════════════════════════════════════════════════════
#  A* PATH PLANNER
# ═══════════════════════════════════════════════════════════════════════

def _plan_route(
    start: Coordinate,
    goal: Coordinate,
    mode: str,
    blocked_zones: List[BlockedZone],
    resolution_m: float = 30.0,
) -> RouteResult:
    t0 = time.perf_counter()

    # Build grid bounds with padding
    lat_min = min(start.lat, goal.lat)
    lat_max = max(start.lat, goal.lat)
    lon_min = min(start.lon, goal.lon)
    lon_max = max(start.lon, goal.lon)

    lat_pad = (lat_max - lat_min) * 0.3 + 0.005
    lon_pad = (lon_max - lon_min) * 0.3 + 0.005

    lat_min -= lat_pad
    lat_max += lat_pad
    lon_min -= lon_pad
    lon_max += lon_pad

    # Grid dimensions
    d_lat = resolution_m / 111320.0
    d_lon = resolution_m / (111320.0 * math.cos(math.radians((lat_min + lat_max) / 2)))

    rows = max(int((lat_max - lat_min) / d_lat), 2)
    cols = max(int((lon_max - lon_min) / d_lon), 2)

    # Cap grid size for performance
    MAX_CELLS = 80000
    if rows * cols > MAX_CELLS:
        scale = math.sqrt(MAX_CELLS / (rows * cols))
        rows = max(int(rows * scale), 2)
        cols = max(int(cols * scale), 2)
        d_lat = (lat_max - lat_min) / rows
        d_lon = (lon_max - lon_min) / cols

    # Convert start/goal to grid indices
    start_r = max(0, min(rows - 1, int((start.lat - lat_min) / d_lat)))
    start_c = max(0, min(cols - 1, int((start.lon - lon_min) / d_lon)))
    goal_r = max(0, min(rows - 1, int((goal.lat - lat_min) / d_lat)))
    goal_c = max(0, min(cols - 1, int((goal.lon - lon_min) / d_lon)))

    # Precompute elevation + blocked mask
    elevations = {}
    blocked_mask = set()

    for r in range(rows):
        for c in range(cols):
            lat = lat_min + r * d_lat
            lon = lon_min + c * d_lon
            elevations[(r, c)] = _get_elevation(lat, lon)

            # Check blocked zones
            for bz in blocked_zones:
                if _point_in_polygon(lat, lon, bz.polygon):
                    blocked_mask.add((r, c))
                    break

    # A* search
    # Neighbors: 8-directional
    DIRS = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]
    DIAG_COST = 1.414

    def heuristic(r: int, c: int) -> float:
        dr = abs(r - goal_r)
        dc = abs(c - goal_c)
        return (dr + dc) * 0.5

    open_set: list = [(0.0, start_r, start_c)]
    came_from: dict = {}
    g_score: dict = {(start_r, start_c): 0.0}

    while open_set:
        _, cr, cc = heapq.heappop(open_set)

        if (cr, cc) == (goal_r, goal_c):
            break

        for dr, dc in DIRS:
            nr, nc = cr + dr, cc + dc
            if nr < 0 or nr >= rows or nc < 0 or nc >= cols:
                continue
            if (nr, nc) in blocked_mask:
                continue

            # Slope between cells
            elev_diff = abs(elevations.get((nr, nc), 0) - elevations.get((cr, cc), 0))
            cell_dist = resolution_m * (DIAG_COST if abs(dr) + abs(dc) == 2 else 1.0)
            slope_deg = math.degrees(math.atan(elev_diff / cell_dist)) if cell_dist > 0 else 0

            move_cost = _cell_cost(slope_deg, mode) * (DIAG_COST if abs(dr) + abs(dc) == 2 else 1.0)
            tentative_g = g_score.get((cr, cc), float('inf')) + move_cost

            if tentative_g < g_score.get((nr, nc), float('inf')):
                came_from[(nr, nc)] = (cr, cc)
                g_score[(nr, nc)] = tentative_g
                f = tentative_g + heuristic(nr, nc)
                heapq.heappush(open_set, (f, nr, nc))

    # Reconstruct path
    path_cells: List[Tuple[int, int]] = []
    current = (goal_r, goal_c)
    if current not in came_from and current != (start_r, start_c):
        # No path found
        return RouteResult(
            route_id=f"route-{int(time.time())}",
            polyline=[start, goal],
            segments=[],
            total_distance_m=_haversine(start.lat, start.lon, goal.lat, goal.lon),
            total_cost=0,
            avg_slope=0,
            max_slope=0,
            steep_percentage=0,
            terrain_breakdown={},
            warnings=[RouteWarning(type="NO_FEASIBLE_ROUTE", message="No feasible route found. Terrain may be fully blocked or too steep.", severity="danger")],
            quality="NO_FEASIBLE_ROUTE",
            traversal_mode=mode,
            computation_time_ms=round((time.perf_counter() - t0) * 1000, 1),
        )

    while current in came_from:
        path_cells.append(current)
        current = came_from[current]
    path_cells.append((start_r, start_c))
    path_cells.reverse()

    # Convert to polyline + compute stats
    polyline: List[Coordinate] = []
    segments: List[RouteSegment] = []
    total_distance = 0.0
    slopes: List[float] = []
    terrain_counts: dict = {}

    for i, (r, c) in enumerate(path_cells):
        lat = lat_min + r * d_lat
        lon = lon_min + c * d_lon
        elev = elevations.get((r, c), 0)
        slope = 0.0

        if i > 0:
            pr, pc = path_cells[i - 1]
            plat = lat_min + pr * d_lat
            plon = lon_min + pc * d_lon
            total_distance += _haversine(plat, plon, lat, lon)
            elev_diff = abs(elev - elevations.get((pr, pc), 0))
            cell_d = _haversine(plat, plon, lat, lon)
            slope = math.degrees(math.atan(elev_diff / cell_d)) if cell_d > 0 else 0

        terrain_cat = _classify_terrain(slope)
        label = _get_terrain_category_label(slope)
        cost = _cell_cost(slope, mode)

        polyline.append(Coordinate(lat=round(lat, 6), lon=round(lon, 6)))
        segments.append(RouteSegment(
            lat=round(lat, 6), lon=round(lon, 6),
            elevation=round(elev, 1), slope=round(slope, 1),
            cost=round(cost, 2), terrain_category=label,
        ))
        slopes.append(slope)
        terrain_counts[label] = terrain_counts.get(label, 0) + 1

    # Thin polyline for performance (keep every Nth point)
    if len(polyline) > 200:
        step = max(len(polyline) // 200, 1)
        polyline = [polyline[i] for i in range(0, len(polyline), step)]
        if polyline[-1] != Coordinate(lat=round(lat_min + goal_r * d_lat, 6), lon=round(lon_min + goal_c * d_lon, 6)):
            polyline.append(Coordinate(lat=round(lat_min + goal_r * d_lat, 6), lon=round(lon_min + goal_c * d_lon, 6)))

    avg_slope = sum(slopes) / len(slopes) if slopes else 0
    max_slope = max(slopes) if slopes else 0
    steep_segments = sum(1 for s in slopes if s >= 15)
    steep_pct = (steep_segments / len(slopes) * 100) if slopes else 0

    # Generate warnings
    warnings: List[RouteWarning] = []
    if max_slope > 25:
        warnings.append(RouteWarning(type="STEEP_SLOPE", message=f"Route includes very steep terrain ({max_slope:.0f}°). Proceed with extreme caution.", severity="danger"))
    elif max_slope > 15:
        warnings.append(RouteWarning(type="STEEP_SLOPE", message=f"Route includes steep segments (max {max_slope:.0f}°). Plan for slower progress.", severity="caution"))

    if total_distance > 5000:
        warnings.append(RouteWarning(type="LONG_ROUTE", message=f"Route distance is {total_distance/1000:.1f}km. Consider vehicle support.", severity="info"))

    if steep_pct > 30:
        warnings.append(RouteWarning(type="STEEP_SLOPE", message=f"{steep_pct:.0f}% of route traverses steep terrain.", severity="caution"))

    # Quality assessment
    quality = "SAFE"
    if max_slope > 25 or steep_pct > 40:
        quality = "HIGH_RISK"
    elif max_slope > 15 or steep_pct > 20:
        quality = "CAUTION"

    total_cost = g_score.get((goal_r, goal_c), 0)
    comp_time = round((time.perf_counter() - t0) * 1000, 1)

    log.info(f"Route planned: {len(path_cells)} cells, {total_distance:.0f}m, {comp_time}ms, quality={quality}")

    return RouteResult(
        route_id=f"route-{int(time.time())}",
        polyline=polyline,
        segments=segments,
        total_distance_m=round(total_distance, 1),
        total_cost=round(total_cost, 2),
        avg_slope=round(avg_slope, 1),
        max_slope=round(max_slope, 1),
        steep_percentage=round(steep_pct, 1),
        terrain_breakdown=terrain_counts,
        warnings=warnings,
        quality=quality,
        traversal_mode=mode,
        computation_time_ms=comp_time,
    )


# ═══════════════════════════════════════════════════════════════════════
#  API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

@router.post("/route/plan", response_model=RouteResult)
async def plan_route(req: RoutePlanRequest):
    """Compute a terrain-aware rescue route using A* pathfinding."""
    try:
        result = _plan_route(
            start=req.start,
            goal=req.goal,
            mode=req.traversal_mode,
            blocked_zones=req.blocked_zones,
            resolution_m=req.grid_resolution,
        )
        return result
    except Exception as e:
        log.error(f"Route planning failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/terrain/elevation", response_model=ElevationResponse)
async def get_elevation(lat: float, lon: float, mode: str = "FOOT_TEAM"):
    """Query terrain elevation and traversability at a point."""
    elev = _get_elevation(lat, lon)
    slope = _get_slope(lat, lon)
    terrain = _classify_terrain(slope)
    cost = _cell_cost(slope, mode)
    label = _get_terrain_category_label(slope)

    return ElevationResponse(
        lat=lat, lon=lon,
        elevation=round(elev, 1),
        slope=round(slope, 1),
        terrain_category=label,
        traversability_cost=round(cost, 2),
    )


@router.post("/terrain/costmap", response_model=CostMapResponse)
async def get_costmap(
    center_lat: float,
    center_lon: float,
    radius_m: float = 500.0,
    resolution_m: float = 50.0,
    mode: str = "FOOT_TEAM",
):
    """Generate a cost map grid centered on a point."""
    d_lat = resolution_m / 111320.0
    d_lon = resolution_m / (111320.0 * math.cos(math.radians(center_lat)))

    radius_deg_lat = radius_m / 111320.0
    radius_deg_lon = radius_m / (111320.0 * math.cos(math.radians(center_lat)))

    lat_min = center_lat - radius_deg_lat
    lon_min = center_lon - radius_deg_lon
    lat_max = center_lat + radius_deg_lat
    lon_max = center_lon + radius_deg_lon

    rows = int((lat_max - lat_min) / d_lat)
    cols = int((lon_max - lon_min) / d_lon)

    # Cap
    rows = min(rows, 50)
    cols = min(cols, 50)

    cells = []
    for r in range(rows):
        for c in range(cols):
            lat = lat_min + r * d_lat
            lon = lon_min + c * d_lon
            elev = _get_elevation(lat, lon)
            slope = _get_slope(lat, lon)
            cost = _cell_cost(slope, mode)
            label = _get_terrain_category_label(slope)
            cells.append(CostMapCell(
                row=r, col=c,
                lat=round(lat, 6), lon=round(lon, 6),
                elevation=round(elev, 1), slope=round(slope, 1),
                cost=round(cost, 2), blocked=False,
                terrain_category=label,
            ))

    return CostMapResponse(
        bounds={"lat_min": lat_min, "lat_max": lat_max, "lon_min": lon_min, "lon_max": lon_max},
        resolution_m=resolution_m,
        rows=rows, cols=cols,
        cells=cells,
    )
