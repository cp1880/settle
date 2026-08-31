# STEP 11: Storehouse + Builder Economy

## Goal
Implement the core economy system with storehouses, inventories, and builder units that can construct buildings.

## Acceptance Criteria
- `Store` class manages resource inventories per tile
- `Builder` unit type can carry resources to build sites
- Resources are consumed from stores when building starts
- Build progress tracks elapsed time vs total build time

## Files to Create/Modify

### 1. src/core/Store.ts (Resource inventory management)
```ts
// Resource inventory for a single tile (storehouse or building with storage)
export interface Inventory {
  [resourceId: string]: number; // resource ID -> quantity
}

// Store class manages resources at a location
export class Store {
  private capacity: number = 10000; // Default storage capacity
  private inventory: Inventory = {};
  
  constructor(capacity?: number) {
    if (capacity !== undefined) {
      this.capacity = capacity;
    }
  }

  // Add resources to store
  addResources(resources: Inventory): void {
    for (const [resId, qty] of Object.entries(resources)) {
      const currentQty = this.inventory[resId] || 0;
      
      if (currentQty + qty <= this.capacity) {
        this.inventory[resId] = currentQty + qty;
      } else {
        // Store is full, add what fits
        const remainingCapacity = this.capacity - currentQty;
        this.inventory[resId] = currentQty + remainingCapacity;
      }
    }
  }

  // Remove resources from store (for building costs)
  removeResources(resources: Inventory): boolean {
    let allRemoved = true;
    
    for (const [resId, qty] of Object.entries(resources)) {
      const currentQty = this.inventory[resId] || 0;
      
      if (currentQty >= qty) {
        this.inventory[resId] = currentQty - qty;
        
        // Remove zero quantities to keep inventory clean
        if (this.inventory[resId] === 0) {
          delete this.inventory[resId];
        }
      } else {
        allRemoved = false;
        break;
      }
    }
    
    return allRemoved;
  }

  // Check if store has enough resources for a build cost
  canAfford(resources: Inventory): boolean {
    for (const [resId, qty] of Object.entries(resources)) {
      const currentQty = this.inventory[resId] || 0;
      
      if (currentQty < qty) {
        return false;
      }
    }
    
    return true;
  }

  // Get copy of inventory
  getInventory(): Inventory {
    return { ...this.inventory };
  }

  // Check capacity
  getCapacity(): number {
    return this.capacity;
  }

  // Get remaining capacity
  getRemainingCapacity(): number {
    let used = 0;
    for (const qty of Object.values(this.inventory)) {
      used += qty;
    }
    return this.capacity - used;
  }
}
```

### 2. src/core/Store.ts (Add grid-based store management)
```ts
import { Grid, TerrainType } from './Grid';

// Store class manages resources at a location
export interface Inventory {
  [resourceId: string]: number; // resource ID -> quantity
}

// Store class manages resources at a location
export class Store {
  private capacity: number = 10000; // Default storage capacity
  private inventory: Inventory = {};
  
  constructor(capacity?: number) {
    if (capacity !== undefined) {
      this.capacity = capacity;
    }
  }

  addResources(resources: Inventory): void {
    for (const [resId, qty] of Object.entries(resources)) {
      const currentQty = this.inventory[resId] || 0;
      
      if (currentQty + qty <= this.capacity) {
        this.inventory[resId] = currentQty + qty;
      } else {
        // Store is full, add what fits
        const remainingCapacity = this.capacity - currentQty;
        this.inventory[resId] = currentQty + remainingCapacity;
      }
    }
  }

  removeResources(resources: Inventory): boolean {
    let allRemoved = true;
    
    for (const [resId, qty] of Object.entries(resources)) {
      const currentQty = this.inventory[resId] || 0;
      
      if (currentQty >= qty) {
        this.inventory[resId] = currentQty - qty;
        
        // Remove zero quantities to keep inventory clean
        if (this.inventory[resId] === 0) {
          delete this.inventory[resId];
        }
      } else {
        allRemoved = false;
        break;
      }
    }
    
    return allRemoved;
  }

  canAfford(resources: Inventory): boolean {
    for (const [resId, qty] of Object.entries(resources)) {
      const currentQty = this.inventory[resId] || 0;
      
      if (currentQty < qty) {
        return false;
      }
    }
    
    return true;
  }

  getInventory(): Inventory {
    return { ...this.inventory };
  }

  getCapacity(): number {
    return this.capacity;
  }

  getRemainingCapacity(): number {
    let used = 0;
    for (const qty of Object.values(this.inventory)) {
      used += qty;
    }
    return this.capacity - used;
  }
}

// Grid-based store management (for buildings with storage)
export class GridStoreManager {
  private grid: Grid;
  private stores: Map<string, Store> = new Map(); // Building ID -> Store
  
  constructor(grid: Grid) {
    this.grid = grid;
  }

  // Get or create store for a building
  getOrCreateStore(buildingId: string): Store {
    if (!this.stores.has(buildingId)) {
      const buildingDef = BUILDINGS[buildingId];
      
      // Default capacity based on building type
      let capacity = 10000;
      if (buildingDef.capacity !== undefined) {
        capacity = buildingDef.capacity * 1000; // Scale by beds/capacity
      }
      
      this.stores.set(buildingId, new Store(capacity));
    }
    
    return this.stores.get(buildingId)!;
  }

  // Add resources to a store
  addResourcesToStore(buildingId: string, resources: Inventory): void {
    const store = this.getOrCreateStore(buildingId);
    store.addResources(resources);
  }

  // Remove resources from a store (for building costs)
  removeResourcesFromStore(buildingId: string, resources: Inventory): boolean {
    const store = this.getOrCreateStore(buildingId);
    return store.removeResources(resources);
  }

  // Check if store can afford resources
  canAfford(buildingId: string, resources: Inventory): boolean {
    const store = this.getOrCreateStore(buildingId);
    return store.canAfford(resources);
  }

  // Get inventory for a building's store
  getInventory(buildingId: string): Inventory {
    const store = this.getOrCreateStore(buildingId);
    return store.getInventory();
  }
}
```

### 3. src/core/Unit.ts (Add Builder unit type)
```ts
import { Grid } from './Grid';
import { Pathfinder } from './Pathfinding';
import { UnitState, CarryResource } from './Unit';

// Add builder-specific properties to UnitDef
export interface UnitDef extends UnitDefBase {
  id: string;
  state: UnitState;
  position: [number, number];
  path?: [number, number][];
  carry?: CarryResource;
  workTimeMs?: number;
  workCompleteAt?: Date | null;
  
  // Builder-specific
  buildTargetId?: string; // Building ID being built (for builders)
}

// Add builder state to UnitState
export type UnitState = 'idle' | 'move' | 'work' | 'carry' | 'deliver' | 'build';

// Update Unit class with builder support
export class Unit {
  private id: string;
  private state: UnitState = 'idle';
  private position: [number, number] = [0, 0];
  private path: [number, number][] | undefined;
  private carry?: CarryResource;
  private workTimeMs?: number;
  private workCompleteAt?: Date | null;
  
  // Builder-specific
  private buildTargetId?: string;

  constructor(def: UnitDef) {
    this.id = def.id;
    this.state = def.state;
    this.position = def.position;
    this.path = def.path;
    this.carry = def.carry;
    this.workTimeMs = def.workTimeMs;
    this.workCompleteAt = def.workCompleteAt || null;
    this.buildTargetId = def.buildTargetId;
  }

  // ... (existing getters/setters) ...

  get buildTargetId(): string | undefined { return this.buildTargetId; }

  setBuildTargetId(buildingId: string | undefined): void {
    this.buildTargetId = buildingId;
  }

  // Builder state machine methods
  private handleBuild(deltaTimeMs: number, gridStoreManager: GridStoreManager): void {
    if (!this.buildTargetId) return;

    const buildingDef = BUILDINGS[this.buildTargetId];
    if (!buildingDef) return;

    // Check if build is complete
    const elapsed = Date.now() - (this.workCompleteAt?.getTime() || 0);
    
    if (elapsed >= buildingDef.buildMs) {
      // Build complete!
      this.setState('idle');
      
      // Remove resources from store
      gridStoreManager.removeResourcesFromStore(this.buildTargetId, buildingDef.cost);
      
      console.log(`Building ${this.buildTargetId} completed at position ${this.position[0]},${this.position[1]}`);
      
      // TODO: Create building object and add to scene
    } else {
      // Still building
      this.setState('build');
    }
  }

  private handleCarry(grid: Grid): void {
    if (!this.carry) return;

    // Find nearest delivery location (storehouse, building, etc.)
    const target = this.findNearestDeliveryLocation();
    
    if (target) {
      // Start moving to delivery location
      this.setState('move');
      
      // Update path to go to delivery location
      const pathfinder = new Pathfinder(grid);
      const path = pathfinder.findPath(
        this.position[0], 
        this.position[1], 
        target.x, 
        target.y
      );
      
      if (path) {
        this.setPath(path);
      } else {
        // No path found, go idle
        this.setState('idle');
      }
    } else {
      // No delivery location found, go idle
      this.setState('idle');
    }
  }

  private findNearestDeliveryLocation(): { x: number; y: number; type: string } | undefined {
    // Simplified: find nearest storehouse or building with inventory
    // TODO: Implement proper delivery location finding
    
    return undefined;
  }
}
```

### 4. src/core/Unit.ts (Add build state handling)
```ts
import { Grid } from './Grid';
import { Pathfinder } from './Pathfinding';
import { UnitState, CarryResource } from './Unit';
import { BUILDINGS, getBuilding } from '../content/buildings';

export interface UnitDef extends UnitDefBase {
  id: string;
  state: UnitState;
  position: [number, number];
  path?: [number, number][];
  carry?: CarryResource;
  workTimeMs?: number;
  workCompleteAt?: Date | null;
  
  // Builder-specific
  buildTargetId?: string;
}

export type UnitState = 'idle' | 'move' | 'work' | 'carry' | 'deliver' | 'build';

export class Unit {
  private id: string;
  private state: UnitState = 'idle';
  private position: [number, number] = [0, 0];
  private path: [number, number][] | undefined;
  private carry?: CarryResource;
  private workTimeMs?: number;
  private workCompleteAt?: Date | null;
  
  // Builder-specific
  private buildTargetId?: string;

  constructor(def: UnitDef) {
    this.id = def.id;
    this.state = def.state;
    this.position = def.position;
    this.path = def.path;
    this.carry = def.carry;
    this.workTimeMs = def.workTimeMs;
    this.workCompleteAt = def.workCompleteAt || null;
    this.buildTargetId = def.buildTargetId;
  }

  get id(): string { return this.id; }
  get state(): UnitState { return this.state; }
  get position(): [number, number] { return this.position; }
  getPath(): [number, number][] | undefined { return this.path; }
  get carry(): CarryResource | undefined { return this.carry; }
  get workTimeMs(): number | undefined { return this.workTimeMs; }
  get workCompleteAt(): Date | null { return this.workCompleteAt; }
  get buildTargetId(): string | undefined { return this.buildTargetId; }

  setState(newState: UnitState): void {
    this.state = newState;
  }

  setPosition(newPos: [number, number]): void {
    this.position = newPos;
  }

  setPath(newPath: [number, number][] | undefined): void {
    this.path = newPath;
  }

  setCarry(resource: CarryResource | undefined): void {
    this.carry = resource;
  }

  setWorkTimeMs(ms: number | undefined): void {
    this.workTimeMs = ms;
  }

  setWorkCompleteAt(date: Date | null): void {
    this.workCompleteAt = date;
  }

  setBuildTargetId(buildingId: string | undefined): void {
    this.buildTargetId = buildingId;
  }

  isAtPosition(x: number, y: number): boolean {
    return this.position[0] === x && this.position[1] === y;
  }

  getDistanceTo(targetX: number, targetY: number): number {
    const dx = Math.abs(this.position[0] - targetX);
    const dy = Math.abs(this.position[1] - targetY);
    return dx + dy;
  }

  getPathProgress(): number | null {
    if (!this.path || this.path.length === 0) return null;
    
    const currentIndex = this.path.findIndex(([px, py]) => 
      px === this.position[0] && py === this.position[1]
    );
    
    if (currentIndex < 0) return null;
    
    return Math.min(1.0, currentIndex / (this.path.length - 1));
  }

  getNextWaypoint(): [number, number] | undefined {
    const currentPos = this.position;
    
    for (const waypoint of this.path!) {
      if (currentPos[0] === waypoint[0] && currentPos[1] === waypoint[1]) {
        continue;
      }
      
      return waypoint;
    }
    
    return undefined;
  }

  getRemainingPathLength(): number | null {
    if (!this.path || this.path.length === 0) return null;
    
    const currentIndex = this.path.findIndex(([px, py]) => 
      px === this.position[0] && py === this.position[1]
    );
    
    if (currentIndex < 0) return null;
    
    return this.path.length - 1 - currentIndex;
  }

  getCurrentTileType(grid: Grid): string | undefined {
    const tile = grid.getTile(this.position[0], this.position[1]);
    return tile?.type || undefined;
  }

  isCarrying(): boolean {
    return !!this.carry;
  }

  getCarryResourceId(): string | undefined {
    return this.carry?.id || undefined;
  }

  getCarryQuantity(): number | undefined {
    return this.carry?.qty || undefined;
  }

  update(grid: Grid, deltaTimeMs: number): void {
    switch (this.state) {
      case 'idle':
        this.handleIdle();
        break;
      case 'move':
        this.handleMove(deltaTimeMs);
        break;
      case 'work':
        this.handleWork(deltaTimeMs, grid);
        break;
      case 'carry':
        this.handleCarry(grid);
        break;
      case 'deliver':
        this.handleDeliver();
        break;
      case 'build':
        this.handleBuild(deltaTimeMs, (grid as any).storeManager || null);
        break;
    }
  }

  private handleIdle(): void {
    if (this.path) {
      const next = this.getNextWaypoint();
      if (next) {
        this.setState('move');
      } else {
        this.setState('idle');
      }
    }
  }

  private handleMove(deltaTimeMs: number): void {
    if (!this.path || this.path.length === 0) {
      this.setState('idle');
      return;
    }

    const next = this.getNextWaypoint();
    if (!next) {
      this.setState('idle');
      return;
    }

    const currentPos = this.position;
    
    if (currentPos[0] === next[0] && currentPos[1] === next[1]) {
      this.setState('idle');
    } else {
      // Still moving
    }
  }

  private handleWork(deltaTimeMs: number, grid: Grid): void {
    if (!this.workTimeMs) return;

    const elapsed = Date.now() - (this.workCompleteAt?.getTime() || 0);
    
    if (elapsed >= this.workTimeMs) {
      this.setState('carry');
    } else {
      // Still working
    }
  }

  private handleCarry(grid: Grid): void {
    if (!this.carry) return;

    const target = this.findNearestDeliveryLocation();
    
    if (target) {
      this.setState('move');
      
      const pathfinder = new Pathfinder(grid);
      const path = pathfinder.findPath(
        this.position[0], 
        this.position[1], 
        target.x, 
        target.y
      );
      
      if (path) {
        this.setPath(path);
      } else {
        this.setState('idle');
      }
    } else {
      this.setState('idle');
    }
  }

  private handleDeliver(): void {
    if (!this.carry) return;

    const target = this.findNearestDeliveryLocation();
    
    if (target) {
      console.log(`Delivered ${this.carry.id} (${this.carry.qty}) to ${target.type}`);
      
      this.setCarry(undefined);
      this.setState('idle');
    } else {
      this.setState('idle');
    }
  }

  private handleBuild(deltaTimeMs: number, gridStoreManager?: GridStoreManager): void {
    if (!this.buildTargetId) return;

    const buildingDef = getBuilding(this.buildTargetId);
    if (!buildingDef) return;

    // Check if build is complete
    const elapsed = Date.now() - (this.workCompleteAt?.getTime() || 0);
    
    if (elapsed >= buildingDef.buildMs) {
      this.setState('idle');
      
      gridStoreManager?.removeResourcesFromStore(this.buildTargetId, buildingDef.cost);
      
      console.log(`Building ${this.buildTargetId} completed at position ${this.position[0]},${this.position[1]}`);
    } else {
      this.setState('build');
    }
  }

  private findNearestDeliveryLocation(): { x: number; y: number; type: string } | undefined {
    return undefined;
  }
}
```

### 5. src/scenes/GameScene.ts (Add store manager and build handling)
```ts
import Phaser from 'phaser';
import { isoToScreen, screenToIso, drawIsoTile } from '../iso';
import { TILE_WIDTH, TILE_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';
import { TouchInputManager, TouchEvent } from '../input/TouchInput';
import { Grid, TerrainType } from '../core/Grid';
import { Pathfinder } from '../core/Pathfinding';
import { Unit, UnitState, CarryResource } from '../core/Unit';
import { Renderer, DepthLayer } from '../core/Renderer';
import { BuildModeUI } from '../ui/BuildMode';
import { GridStoreManager } from '../core/Store';

export class GameScene extends Phaser.Scene {
  private grid: Grid;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private isoGridGraphics: Phaser.GameObjects.Graphics;
  private terrainLayer: any[] = [];
  private featureLayers: Phaser.GameObjects.Group[] = [];
  private touchInput: TouchInputManager | null = null;
  private pathfinder: Pathfinder | null = null;
  private units: Unit[] = [];
  private renderer: Renderer | null = null;
  private buildModeUI: BuildModeUI | null = null;
  private storeManager: GridStoreManager | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.terrainLayer = generateTerrainMap(GRID_SIZE_X, GRID_SIZE_Y);
    
    const mapWidth = GRID_SIZE_X * TILE_WIDTH;
    const mapHeight = GRID_SIZE_Y * TILE_HEIGHT;
    
    this.camera = new Phaser.Cameras.Scene2D.Camera(this, mapWidth, mapHeight);
    this.camera.scrollX = mapWidth / 2;
    this.camera.scrollY = mapHeight / 2;
    this.camera.zoom = 1.0;
    this.camera.minZoom = 0.5;
    this.camera.maxZoom = 2.0;
    
    // Initialize grid and pathfinder
    this.grid = new Grid(GRID_SIZE_X, GRID_SIZE_Y);
    for (let x = 0; x < GRID_SIZE_X; x++) {
      for (let y = 0; y < GRID_SIZE_Y; y++) {
        const tileData = this.terrainLayer[x][y];
        this.grid.setTile(x, y, tileData);
      }
    }
    
    this.pathfinder = new Pathfinder(this.grid);
    
    // Initialize renderer with depth-sorted layers
    this.renderer = new Renderer(this, this.grid);
    
    // Draw initial state
    this.renderer.drawBackground();
    this.renderer.drawFeatures();
    
    // Initialize build mode UI
    this.buildModeUI = new BuildModeUI(this);
    
    // Initialize store manager for grid-based storage
    this.storeManager = new GridStoreManager(this.grid);
  }

  private drawIsoGrid(): void {
    const graphics = this.add.graphics();
    graphics.clear();
    
    for (let i = 0; i < GRID_SIZE_X + GRID_SIZE_Y; i++) {
      for (let x = 0; x < GRID_SIZE_X; x++) {
        for (let y = 0; y < GRID_SIZE_Y; y++) {
          if ((x + y) === i) {
            const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
            const tileData = this.terrainLayer[x][y];
            
            let color: string;
            switch (tileData.type) {
              case 'grass':
                color = 0x4a7c59;
                break;
              case 'forest':
                color = 0x3d6b4f;
                break;
              case 'rocky':
                color = 0x8b7355;
                break;
              case 'water':
                color = Math.random() < 0.5 ? 0x4a90c2 : 0x3d7ab1;
                break;
            }
            
            drawIsoTile(graphics, x, y, color);
          }
        }
      }
    }

    graphics.draw();
    
    for (let i = 0; i < this.featureLayers.length; i++) {
      const layer = this.featureLayers[i];
      
      for (let x = 0; x < GRID_SIZE_X; x++) {
        for (let y = 0; y < GRID_SIZE_Y; y++) {
          if ((x + y) === i) {
            const tileData = this.terrainLayer[x][y];
            
            switch (tileData.type) {
              case 'forest':
                if (tileData.feature === 'tree') {
                  this.addTree(layer, x, y);
                }
                break;
              case 'rocky':
                if (tileData.feature === 'rock_outcrop') {
                  this.addRock(layer, x, y);
                }
                break;
              case 'water':
                if (tileData.feature === 'cliff') {
                  this.addCliffFeature(layer, x, y);
                } else if (tileData.feature) {
                  this.addWaterFeature(layer, x, y);
                }
                break;
            }
          }
        }
      }
    }
  }

  private addTree(layer: Phaser.GameObjects.Group, x: number, y: number): void {
    const graphics = layer.add.graphics();
    const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
    
    graphics.fillStyle(0x5c4033);
    graphics.fillRect(screenPos.x - 6, screenPos.y + 12, 12, 24);
    
    graphics.fillStyle(0x2d5a3f);
    graphics.fillTriangle(
      screenPos.x - 16, screenPos.y - 48,
      screenPos.x + 16, screenPos.y - 48,
      screenPos.x, screenPos.y + 16
    );
  }

  private addRock(layer: Phaser.GameObjects.Group, x: number, y: number): void {
    const graphics = layer.add.graphics();
    const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
    
    graphics.fillStyle(0x7a6e5f);
    graphics.fillPolygon([
      { x: screenPos.x - 12, y: screenPos.y + 8 },
      { x: screenPos.x + 12, y: screenPos.y + 4 },
      { x: screenPos.x + 8, y: screenPos.y + 20 },
      { x: screenPos.x - 8, y: screenPos.y + 16 }
    ]);
  }

  private addCliffFeature(layer: Phaser.GameObjects.Group, x: number, y: number): void {
    const graphics = layer.add.graphics();
    const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
    
    graphics.fillStyle(0x6a5f4f);
    graphics.fillRect(screenPos.x - 12, screenPos.y - 8, 24, 32);
  }

  private addWaterFeature(layer: Phaser.GameObjects.Group, x: number, y: number): void {
    const graphics = layer.add.graphics();
    const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
    
    graphics.fillStyle(0x5a90c2);
    graphics.fillCircle(screenPos.x, screenPos.y + 16, 8);
  }

  // Handle tap events for movement (placeholder)
  private handleTap(isoX: number, isoY: number): void {
    console.log(`Tap at isometric (${isoX}, ${isoY})`);
    
    if (this.pathfinder && this.touchInput) {
      const nearest = this.pathfinder.findNearestWalkable(
        this.camera.scrollX + (this.camera.width / 2) * this.camera.scale,
        this.camera.scrollY + (this.camera.height / 2) * this.camera.scale
      );
      
      if (nearest) {
        console.log(`Nearest walkable: ${nearest[0]}, ${nearest[1]}`);
        
        // TODO: Spawn or move unit to nearest position
      }
    }
    
    // Check if in build mode and tap is for placement
    if (this.buildModeUI && this.buildModeUI.active) {
      this.handleBuildTap(isoX, isoY);
    }
  }

  private handleBuildTap(isoX: number, isoY: number): void {
    // Show placement preview at tapped location
    this.buildModeUI.showPlacementPreview(Math.floor(isoX), Math.floor(isoY));
    
    // TODO: Start building if resources available and builder unit present
  }

  private addTree(layer: Phaser.GameObjects.Group, x: number, y: number): void {
    const graphics = layer.add.graphics();
    const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
    
    graphics.fillStyle(0x5c4033);
    graphics.fillRect(screenPos.x - 6, screenPos.y + 12, 12, 24);
    
    graphics.fillStyle(0x2d5a3f);
    graphics.fillTriangle(
      screenPos.x - 16, screenPos.y - 48,
      screenPos.x + 16, screenPos.y - 48,
      screenPos.x, screenPos.y + 16
    );
  }

  private addRock(layer: Phaser.GameObjects.Group, x: number, y: number): void {
    const graphics = layer.add.graphics();
    const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
    
    graphics.fillStyle(0x7a6e5f);
    graphics.fillPolygon([
      { x: screenPos.x - 12, y: screenPos.y + 8 },
      { x: screenPos.x + 12, y: screenPos.y + 4 },
      { x: screenPos.x + 8, y: screenPos.y + 20 },
      { x: screenPos.x - 8, y: screenPos.y + 16 }
    ]);
  }

  private addCliffFeature(layer: Phaser.GameObjects.Group, x: number, y: number): void {
    const graphics = layer.add.graphics();
    const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
    
    graphics.fillStyle(0x6a5f4f);
    graphics.fillRect(screenPos.x - 12, screenPos.y - 8, 24, 32);
  }

  private addWaterFeature(layer: Phaser.GameObjects.Group, x: number, y: number): void {
    const graphics = layer.add.graphics();
    const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
    
    graphics.fillStyle(0x5a90c2);
    graphics.fillCircle(screenPos.x, screenPos.y + 16, 8);
  }

  // Update loop for units (placeholder)
  private updateUnits(deltaTimeMs: number): void {
    for (const unit of this.units) {
      unit.update(this.grid, deltaTimeMs);
      
      // TODO: Render unit at position
    }
  }

  // Main render loop using painter's algorithm
  private render(): void {
    if (!this.renderer) return;
    
    this.renderer.drawBackground();
    this.renderer.drawFeatures();
    this.renderer.drawUnits();
    this.renderer.drawBuildings();
  }

  // Called every frame for smooth rendering
  private update(): void {
    if (!this.renderer) return;
    
    this.updateUnits(16);
    this.render();
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    
    if (this.renderer) {
      this.update();
    }
    
    // Update build mode progress bars
    if (this.buildModeUI && this.buildModeUI.active) {
      this.checkBuildProgress();
    }
  }

  private checkBuildProgress(): void {
    // TODO: Implement build progress tracking
  }
}
```

## Testing
Run `npm run dev` and "New Game":
- Build mode UI should show selection panel when building is selected
- Progress bar should appear during construction
- Store manager should track resources for buildings

## Next Step
Once storehouse + builder economy works, move to **STEP12** for the lumberjack chain (tree → log → storehouse).