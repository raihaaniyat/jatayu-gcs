# Jatayu Terrain-Aware Rescue Route Planning System

## Detailed implementation plan and master build prompt for Claude / Cursor / Antigravity

---

# Context

We are building the next major software module for **Project Jatayu**, a hybrid VTOL disaster-response UAV system.

The existing system direction is:
- UAV-based disaster reconnaissance
- AI-based survivor detection from aerial imagery/video
- geo-tagged situational awareness
- ground control station for operators
- planned terrain-aware rescue route recommendation for response teams

This new module is **not** standard map routing and **not** straight-line Haversine distance. The goal is to build a system that can recommend a **feasible off-road rescue path** from a responder origin to an affected victim location using:
- existing elevation terrain sources such as **Copernicus DEM / SRTM / NASADEM**
- optional India-specific support through **Bhuvan** if useful
- **Cesium** as the main 3D terrain visualization layer
- our own terrain interpretation and traversability cost-map logic
- our own path planning pipeline

This system must feel like a **real disaster-response command interface**, not just a student demo.

The UI must be:
- smooth
- modern
- tactical
- intuitive
- fast to understand under pressure
- visually clean but information-rich
- easy for a first-time operator

We are prioritizing a strong MVP that looks polished and is architecturally solid.

---

# Build goal

Design and implement a **terrain-aware rescue route planning feature** inside a professional ground control station frontend.

The system should:
1. display a 3D terrain-based operational map
2. allow the operator to select or receive:
   - responder start point
   - victim location
   - drone position
3. ingest terrain/elevation/map layers
4. build a traversability cost map
5. generate recommended route(s) over off-road terrain
6. visually explain why the route was chosen
7. allow operator correction and terrain editing
8. feel polished enough for demo, presentation, and future expansion

---

# What we are NOT building+


+

Do **not** treat this as:
- Google Maps road navigation
- shortest straight-line route only
- a simple folium toy map
- a backend-only research script
- a cluttered GIS engineer interface

Do **not** build a UI that feels like raw telemetry dumped on screen.

We are building a **decision-support tactical interface**.

---

# Core product vision

The operator should be able to:
- load the disaster operational area
- see terrain in 3D
- inspect detected survivor positions
- understand terrain difficulty visually
- switch between mission layers
- request a route from rescue base to target
- compare fastest/safest/path-for-foot-team options
- edit blocked zones manually if AI is uncertain
- trust the interface quickly

The operator experience should feel like:
- UAV ground station
- disaster intelligence dashboard
- tactical mission planner
- route recommendation console

---

# Recommended stack

Use this as the preferred implementation stack unless there is a very strong reason to deviate.

## Frontend
- **Next.js**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** or similarly clean component system
- **CesiumJS** for 3D terrain map
- optional **Zustand** for state management
- optional **Framer Motion** for micro-interactions and transitions

## Backend
- **FastAPI** preferred
- Python-based processing modules
- terrain cost map generation
- route planning engine
- mission data API

## Geospatial / terrain data
- **Copernicus DEM** or **SRTM/NASADEM** for elevation
- optional **Bhuvan** / India-specific layers if feasible
- Cesium terrain streaming for visualization

## Algorithms / processing
- raster/grid generation
- terrain class to cost conversion
- slope derivation from DEM
- weighted grid route planning using **A*** initially
- later support for Dijkstra / Theta* / D* Lite if needed

## Visualization and mission overlays
- survivor markers
- route polylines
- blocked zones
- terrain heatmap
- slope risk overlay
- confidence overlay

---

# High-level feature breakdown

## 1. 3D tactical terrain map
The center of the application should be a professional **Cesium 3D mission map**.

It should support:
- terrain rendering
- camera controls
- layer toggles
- mission markers
- route overlays
- hover/click interactions
- smooth transitions
- panel-linked focus navigation

Map interactions should include:
- click to set start point
- click to set victim/goal point
- click to inspect terrain cell or region
- click to add blocked zone or edit traversability
- focus camera on drone, survivor, or route

---

## 2. Terrain interpretation and traversability modeling
The system must convert map/terrain information into a **movement cost representation**.

Sources can include:
- DEM-derived slope
- map context
- optional aerial imagery interpretation
- operator-corrected blocked zones
- hazard overlays

The MVP traversability model should use:
- slope
- manually marked obstacles
- terrain category assumptions
- danger buffers

Example cost logic:
- paved/open route: low cost
- open dry terrain: low-medium cost
- dense vegetation: medium-high cost
- steep slope: high cost
- water/flood zone: blocked or severe penalty
- rubble/debris zone: high or blocked depending on mode

Support multiple traversal modes:
- foot rescue team
- light vehicle
- rover
- supply route recommendation

Each mode should have different cost weights.

---

## 3. Route planning engine
The route planner must work on a weighted terrain grid.

The MVP should implement:
- **A*** path planning over grid/raster cost map

It should support:
- configurable start and goal
- multiple route profiles
- obstacle avoidance
- rerun after terrain edits
- route statistics output

Outputs should include:
- route polyline
- total path cost
- approximate path distance
- average terrain difficulty
- steepest segment encountered
- warnings if path quality is poor

Later extensibility:
- safest route
- fastest route
- least-elevation-change route
- dynamic replanning

---

## 4. Operator editing tools
This is a very important feature.

The system should not pretend the AI is perfect.

The UI must let the operator:
- draw blocked regions
- erase blocked regions
- mark suspected debris zones
- raise/lower terrain difficulty
- add no-go regions
- switch traversal mode
- rerun planning instantly

This makes the system far more realistic and defendable.

---

## 5. Route explanation system
The UI must explain the route choice visually.

For example:
- this route avoids steep slope
- this route bypasses blocked flood pocket
- this route is longer but safer
- this segment is uncertain terrain

This can appear in:
- route summary card
- side panel explanation
- hover labels on route segments

This is a strong novelty point because it makes the planner interpretable.

---

# UX / UI direction

The interface must look like a polished mission system, not an academic dashboard.

## Recommended layout
Use a **left control rail + center 3D map + right intelligence panel** layout.

### Left vertical rail
Primary navigation icons:
- Mission
- Terrain
- Route Planning
- Targets
- Layers
- Analytics
- Settings

Keep this compact and elegant.

### Center main panel
Large immersive Cesium mission map.
This is the visual anchor of the whole product.

### Right collapsible intelligence panel
Context-sensitive panel with tabs or stacked cards:
- Selected object info
- Route details
- Terrain breakdown
- Layer controls
- Alerts
- Mission notes

### Top mission bar
Should contain:
- current mission name
- connection state
- data source state
- traversal mode selector
- quick search / coordinate jump
- run route button
- emergency clear / reset tool

### Bottom status strip
Optional but useful:
- cursor coordinates
- altitude/elevation under cursor
- selected cell cost
- current camera height
- backend processing state

---

# Visual design guidance

The design must feel:
- dark tactical
- premium
- calm under pressure
- not over-saturated
- visually layered
- readable from distance

## Style notes
- dark theme by default
- muted slate / charcoal surfaces
- precise typography
- restrained accent colors
- red only for alerts / blocked hazards
- amber for caution
- blue/cyan for active selection
- green sparingly for valid/safe

## Motion
Use subtle motion only:
- panel transitions
- hover elevation
- route load animation
- layer fade in/out
- smooth camera fly-to

Avoid noisy motion.

## Cards and panels
Use:
- rounded corners
- translucent panels where appropriate
- soft shadows
- thin borders
- tight but not cramped spacing
- clear hierarchy

---

# Key screens and UI states

## Screen 1: Mission overview
Purpose:
- enter operational area
- see drone, survivors, terrain state
- understand mission instantly

Must show:
- 3D terrain
- current markers
- mini route summary if available
- mission stats cards

## Screen 2: Terrain analysis mode
Purpose:
- inspect slope and terrain difficulty
- toggle overlays
- view hazard areas

Must show:
- terrain/slope heatmap
- elevation legend
- blocked zone overlays
- cell/region inspector

## Screen 3: Route planning mode
Purpose:
- choose origin and target
- run route solver
- compare route strategies

Must show:
- start marker
- goal marker
- generated route(s)
- route explanation panel
- warnings and quality stats

## Screen 4: Manual correction mode
Purpose:
- let operator override uncertain terrain

Must show:
- draw tools
- paint/erase blocked cells or polygons
- local route rerun button
- version reset / undo

## Screen 5: Target intelligence mode
Purpose:
- inspect survivor markers and rescue feasibility

Must show:
- target cards
- confidence
- terrain around target
- access difficulty
- recommended deployment notes

---

# Functional implementation plan

## Phase 1: Product and state architecture
Design the frontend information architecture first.

Define state models for:
- mission
- map camera state
- selected entity
- terrain layers
- route planning inputs
- route planning outputs
- traversal mode
- manual edits
- backend job status

Recommended entities:
- Mission
- Drone
- SurvivorTarget
- RoutePlan
- TerrainLayer
- TraversabilityEdit
- HazardZone

Create a clean domain model so future features can plug in easily.

---

## Phase 2: 3D map foundation with Cesium
Implement Cesium as the main operational canvas.

Tasks:
- initialize Cesium viewer in app shell
- connect terrain provider
- configure dark tactical base appearance
- add camera bookmarks and fly-to actions
- overlay mission markers and labels
- enable terrain picking and coordinate readout

Important:
- keep map smooth
- avoid UI jank
- ensure panels do not fight the map visually

---

## Phase 3: Mission data layer
Create mocked or real data ingestion for:
- drone coordinates
- survivor positions
- rescue origin/base
- blocked zones
- elevation query results
- route results

Even if backend is incomplete, create realistic mock data flows so the interface feels alive.

---

## Phase 4: Traversability layer model
Build the backend/frontend contract for a terrain cost map.

Possible backend output structure:
- grid metadata
- world bounds
- cell size
- terrain category grid
- cost grid
- blocked mask
- confidence grid

Frontend tasks:
- display traversability overlay
- display blocked areas
- inspect cell cost on click
- switch mode between foot/vehicle/rover

---

## Phase 5: Route planning integration
Implement route planning request flow.

Operator flow:
1. choose start point
2. choose goal point
3. choose traversal mode
4. click compute route
5. display route and metrics

Show loading gracefully.

Output should be rendered as:
- prominent route polyline
- direction indication if useful
- segment emphasis for difficult zones
- summary panel

---

## Phase 6: Manual terrain correction tools
Implement drawing/editing tools.

Tools to add:
- draw blocked polygon
- erase blocked zone
- mark hazard region
- mark uncertain region
- local cost increase/decrease brush

This is a major trust-building feature.

---

## Phase 7: Route insight and explainability
For each route, compute and show:
- total distance
- total estimated traversal difficulty
- percentage through steep terrain
- blocked zones avoided
- average slope exposure
- confidence of terrain interpretation

Present these in a compact but elegant panel.

---

## Phase 8: Polish and mission feel
This phase matters a lot.

Add:
- polished loading states
- skeletons
- empty states
- graceful error messages
- route recalculation transitions
- camera animation presets
- marker interaction microfeedback

The app should feel intentional everywhere.

---

# Detailed component plan

## App shell
Contains:
- left nav rail
- top mission header
- central map viewport
- right contextual panel
- bottom status strip

## Mission header
Include:
- mission title
- system status badges
- data source health
- traversal mode dropdown
- route action button
- quick coordinate jump

## Navigation rail
Icons and labels for:
- Overview
- Terrain
- Routes
- Targets
- Layers
- Logs
- Settings

## Map viewport
Contains:
- Cesium viewer
- overlay controls
- coordinate inspector
- action hints
- route legend

## Right-side panel modules
### Route summary card
- route name
- mode
- distance
- estimated difficulty
- warnings

### Terrain inspector card
- selected cell elevation
- slope
- terrain category
- traversability cost
- confidence

### Target info card
- target ID
- detection confidence
- nearest feasible access point
- path difficulty
- notes

### Layer manager card
- show/hide terrain
- show/hide slope
- show/hide blocked zones
- show/hide route
- show/hide targets

### Mission alerts card
- impassable route warning
- low confidence terrain zone
- missing elevation data
- target inaccessible under current mode

---

# Backend planning contract

The backend should expose endpoints or mocked services such as:

## GET /mission/state
Returns:
- drone position
- targets
- rescue origin
- current overlays

## POST /terrain/costmap
Input:
- area bounds
- traversal mode
- optional edits

Output:
- terrain grid
- cost grid
- blocked cells
- confidence values

## POST /route/plan
Input:
- start coordinate
- goal coordinate
- traversal mode
- terrain/cost map reference
- manual edits

Output:
- route polyline
- distance
- cost
- route metadata
- warnings

## POST /terrain/edit
Input:
- edit polygons / brush actions

Output:
- updated cost map reference

Frontend should be designed so these APIs can be mocked first.

---

# Data modeling guidance

## Route mode types
- FOOT_TEAM
- LIGHT_VEHICLE
- ROVER
- SUPPLY_DROP_SUPPORT

## Terrain categories
- ROAD
- OPEN_GROUND
- VEGETATION
- WATER
- DEBRIS
- STRUCTURE
- BLOCKED
- UNKNOWN

## Route quality flags
- SAFE
- CAUTION
- HIGH_RISK
- INCOMPLETE
- NO_FEASIBLE_ROUTE

---

# UI quality requirements

The build must satisfy these requirements:
- map remains dominant and immersive
- controls are accessible without clutter
- every action has clear feedback
- route computation feels deliberate and premium
- panel spacing and typography are excellent
- operator never feels lost
- first-time user can understand the workflow fast

Avoid:
- cluttered engineering dashboards
- tiny unreadable text
- too many floating panels
- excessive bright colors
- abrupt transitions
- cramped sidebars

---

# Developer expectations

When implementing, do not just generate a rough scaffold.

I want:
- a thoughtful information architecture
- tasteful visual hierarchy
- reusable components
- strong TypeScript typing
- modular code organization
- realistic mocked data if backend is incomplete
- smooth UI behavior
- a layout that can later grow into a real ground station

Make decisions like a senior product engineer designing a mission-critical interface.

---

# Suggested file/module structure

Possible frontend structure:

- `app/` or `src/app/`
- `components/layout/`
- `components/map/`
- `components/terrain/`
- `components/routes/`
- `components/targets/`
- `components/ui/`
- `lib/cesium/`
- `lib/mock-data/`
- `stores/`
- `types/`
- `hooks/`
- `services/api/`

Important modules:
- Cesium viewer wrapper
- mission state store
- terrain layer manager
- route planner controls
- target intelligence panel
- map interaction tools
- route explanation panel

---

# Route planning logic expectations

The frontend should be prepared to visualize and interact with backend route planning logic that uses:
- weighted grid map
- slope-aware penalties
- blocked cell masks
- multiple traversal modes
- A* search in MVP

It should also be easy to later support:
- multiple candidate routes
- safest vs fastest tradeoffs
- uncertainty-aware routing
- dynamic route recomputation

---

# UX workflow to optimize

The best operator flow should be:
1. open mission
2. terrain loads instantly or gracefully
3. targets visible on map
4. operator selects a target
5. target details appear on right panel
6. operator selects rescue origin or confirms default origin
7. chooses route mode
8. clicks compute route
9. system animates to route and shows recommendation
10. operator edits blocked area if needed
11. reruns route
12. exports or reports route recommendation

This flow must feel smooth and obvious.

---

# Deliverables expected from the coding assistant

Please produce:
1. a strong architecture plan
2. the frontend app structure
3. the core UI layout implementation
4. the Cesium 3D map integration
5. mock mission and route data
6. a polished route planning UI
7. terrain layer toggles and inspector
8. manual terrain edit UX concepts or implementation stubs
9. beautiful responsive styling
10. explanation of design decisions

If code generation is being done, provide production-quality code structure rather than a loose prototype.

---

# Final instruction to the coding assistant

Build this as a **serious tactical mission planning interface** for a disaster-response UAV platform.

Prioritize:
- clean architecture
- visual polish
- smooth operator experience
- believable mission workflow
- extensibility
- strong map-centered design

Do not optimize only for code simplicity.
Optimize for **quality, clarity, and mission feel**.

Where implementation details are uncertain, make strong product-minded choices and document them.

The output should look like something that could genuinely be shown in a competition demo, defense-tech pitch, or research prototype presentation.

---

# Optional final add-on request

After the main implementation plan and scaffold, also provide:
- recommended screen wireframe descriptions
- component tree
- API contract suggestions
- mock JSON examples for mission state, terrain grid, and route output
- visual refinement suggestions for making the UI feel more premium and smooth

---

# One-line project framing

**Jatayu Terrain-Aware Rescue Route Planning is a 3D tactical decision-support interface that combines terrain elevation, traversability modeling, and path planning to recommend feasible off-road rescue routes in disaster zones.**

