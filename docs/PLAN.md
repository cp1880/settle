# Isometric Settlers-like Economy Game — Plan

A 2D isometric-grid mobile strategy game (iOS/Android) in TypeScript, with a
data-driven "generic engine": new materials, workers, and buildings are added
as **data**, not code.

## 1. Goals

- 2D isometric (2:1) grid, roads, units that walk roads.
- Settlers-like production chains (see §6 content catalog).
- Generic unit/building/economy engine: adding content = adding a data entry.
- Single codebase shipped to iOS + Android.

## 2. Tech stack

| Piece | Choice | Why |
|---|---|---|
| Language | TypeScript 5 | requirement |
| Game lib | **Phaser 3** (WebGL) | TS-first, mature mobile support, camera/tweens/particles, RenderTexture baking |
| Bundler | Vite | fast dev server, simple |
| Mobile shell | **Capacitor** | wraps the web build into native iOS/Android apps, one codebase |
| Tests | Vitest | unit tests for pathfinding, economy, job specs |
| Saves | JSON → Capacitor LocalStorage | offline single-player |

Alternatives considered: Godot 4 (great 2D, but GDScript-first),
React Native + Pixi (more friction, two rendering worlds). Phaser + Capacitor
is the standard fast path for a TS 2D mobile game.

## 3. Architecture

Strict layering — the core engine knows **nothing** about trees, swords, or
barracks:

```
src/
  core/      Generic engine (no game content)
    GameLoop.ts        fixed-timestep simulation, decoupled from render
    Grid.ts            tile grid, occupancy, tile defs
    Pathfinding.ts     A* on 4-dir grid with per-tile movement costs
    Unit.ts            actor base: position, path, carry, state machine
    Camera.ts          iso camera: pan, pinch-zoom, screen<->world math
    Renderer.ts        painter's-algorithm depth sort, static-layer baking
    SaveSystem.ts      (de)serialize world state to JSON
    EventBus.ts        loose coupling (unit-finished, build-ready, ...)
  content/   Data ONLY — the extension point
    resources.ts       ResourceDef catalog
    buildings.ts       BuildingDef catalog
    jobs.ts            JobSpec catalog (worker types)
  game/      World + economy glue
    World.ts           grid + entities + save/load
    Economy.ts         inventories, demand, build-order validation
    Construction.ts    build queue, progress, placement rules
    Assignment.ts      worker assignment: which job, which store, which source
  scenes/    Phaser scenes + UI
    BootScene.ts  GameScene.ts
    ui/BuildMode.ts  ui/HUD.ts  ui/TouchInput.ts
  main.ts
```

### 3.1 Grid & map

- 4-directional grid; tiles are data: `{ terrain, feature?, road?, buildingRef? }`.
- Terrain: grass / forest / rocky / coal / iron / water (water & uncut trees block).
- `road` is a tile flag → cheap pathfinding cost, drawn as a road tile.
- Maps are hand-authored JSON files (procedural generation later, if wanted).

### 3.2 Pathfinding & movement

- A* over the grid; cost per tile: **road = 1, grass = 3, blocked = ∞**.
  Units therefore naturally prefer roads — satisfies "move down the roads".
- Occupancy grid for dynamic obstacles (units, buildings); units re-path
  waypoint-to-waypoint, which keeps re-planning cheap.

### 3.3 Isometric rendering

- 2:1 diamonds, e.g. 128×64 px. `sx = (x−y)·W/2`, `sy = (x+y)·H/2`.
- Painter's algorithm: draw order by `(x + y)` then height.
- Static ground baked into a RenderTexture → a handful of draw calls;
  units/buildings/features drawn individually on top.
- Input: 1-finger drag = pan, pinch = zoom (0.5×–2×), tap = select/command,
  HUD buttons for build/train modes.

### 3.4 The generic unit engine (the core requirement)

A worker type is **pure data** (`JobSpec`), not a class:

```ts
interface JobSpec {
  id: string;                    // 'lumberjack'
  inputs:  { res: string; from: 'terrain' | 'store'; qty: number }[];
  outputs: { res: string; to:   'store'   | 'building'; qty: number }[];
  workMs: number;                // duration of one run
  atBuilding?: string;           // 'sawmill' | 'smithy' | ... (work location)
}

interface BuildingDef {
  id: string;
  size: { w: number; h: number };
  cost: { res: string; qty: number }[];   // consumed from storehouse
  buildMs: number;
  capacity?: number;                             // storehouse, house (beds)
  trains?: { input: string; output: string; timeMs: number }; // barracks
  attacks?: { rangeTiles: number; damage: number; fireMs: number }; // turret
}
```

- **Lumberjack** `{inputs:[tree@terrain] → outputs:[log@store]}`
- **Sawyer** `{inputs:[log@store] → outputs:[wood@store], atBuilding:'sawmill'}`
- **Miners** — one spec per ore (stone/coal/iron) or one spec + ore param.
- **Weaponsmith** `{inputs:[iron, coal] → outputs:[sword|shield], atBuilding:'smithy'}`
  (multi-input is first-class in the spec).
- **Barracks** = building with `trains: villager → soldier`.
- **House** = building with `capacity` (beds). Hiring a new worker requires a
  free bed → "villagers need somewhere to live".
- **Turret** = building with `attacks`; **wall** blocks the grid; **gate** is a
  walkable wall tile.
- `Unit` runtime: state machine `idle → move → work → carry → deliver`,
  carrying `{res, qty}`. A new worker type = one `JobSpec` entry; no new class.

### 3.5 Economy

- Inventories per storehouse: `Map<resourceId, qty>`, global view for UI.
- Production graph (data-driven, all the above chains fall out of JobSpecs):
  - tree → log → wood → buildings
  - stone (terrain) → stone
  - coal + iron ore → sword / shield
  - villager → soldier (barracks)
- Build orders: validate cost against storehouses, builder unit works the site,
  progress bar, building appears (occupies tiles, may block roads → gate it).
- Worker assignment: simple nearest-work assignment + idle pool at the
  town hall; no auction-style AI for v1.

### 3.6 Save/load

- Whole world (grid, units, inventories, build queue) is one serializable
  object → JSON → localStorage. Autosave every N seconds + manual save.

## 4. Initial content catalog

- **Resources:** tree, log, wood, stone, coal, iron ore, sword, shield,
  villager, soldier
- **Workers:** builder, lumberjack, sawyer, stone-miner, coal-miner,
  iron-miner, weaponsmith, guard (soldier w/ sword + shield)
- **Buildings:** town hall (beds + spawns), storehouse, sawmill, quarry,
  smithy, barracks, house, wall, gate, turret
- **Terrain features:** tree, stone outcrop, coal seam, iron seam

## 5. Milestones (build order)

- **M0 — Scaffold:** Vite + TS + Phaser + Capacitor; render an iso grid from a
  JSON map; pan/pinch; placeholder art. *Acceptance: map visible, camera fluid
  on a phone.*
- **M1 — Movement:** A* with road costs, occupancy; one villager tap-to-move;
  depth-sorted rendering. *Acceptance: unit follows roads around obstacles.*
- **M2 — First chain:** build mode UI, storehouse + builder, lumberjack
  tree → log → storehouse. *Acceptance: logs accumulate in the storehouse.*
- **M3 — Processing:** sawmill log → wood; quarry → stone; build costs
  enforced; construction progress. *Acceptance: wood+stone used to build a
  second sawmill.*
- **M4 — Metals & military:** coal/iron seams, smithy → sword/shield, barracks
  → soldier, housing demand enforced.
- **M5 — Fortifications:** walls, gates, turrets (+ whatever they attack — see
  open questions).
- **M6 — Polish:** save/load + autosave, performance pass (baking, pooling),
  sounds, app store builds.

## 6. Open questions (need a call before M0)

1. **Phaser + Capacitor** — OK with that stack? (vs. Godot, vs. RN+Pixi)
2. **Combat scope:** turrets/soldiers need targets. Enemy waves later, or a
   passive sandbox first (turrets idle / train-only)?
3. **Maps:** hand-authored JSON first (recommended), procedural later?
4. **Art:** placeholder vector art now, real art later? (recommended)
5. **Scope:** single town per map, fully offline? (assumed yes)
6. **Villager model:** workers *are* villagers (consumes a bed) — vs. workers
   being separate hireables? (assumed: workers are villagers)

## 7. Conventions

- Content files export typed consts; a startup validator cross-checks that
  every `res` id referenced by jobs/buildings exists in the resource catalog
  (catches typos at dev time, not gameplay time).
- Fixed-timestep sim (e.g. 20 Hz) + render at display rate; all durations in
  ms in data.
- No game-specific knowledge in `core/`; enforced by not importing `content/`
  there (lint rule later if desired).
