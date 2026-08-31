# STEP 07: Unit Base Class and State Machine

## Goal
Create a generic `Unit` class with a state machine for movement, work, carrying resources, etc.

## Acceptance Criteria
- `Unit` class has position, path, carry capacity, and state
- States: `idle`, `move`, `work`, `carry`, `deliver`
- Units can be spawned at grid positions
- Units follow paths from tap-to-move events

## Files to Create/Modify

### 1. src/core/Unit.ts (Base unit class)
```ts
import { Grid } from './Grid';
import { Pathfinder } from './Pathfinding';

// Unit states for state machine
export type UnitState = 'idle' | 'move' | 'work' | 'carry' | 'deliver';

// Resource being carried
interface CarryResource {
  id: string;
  qty: number;
}

// Unit interface (data-driven, not a class)
export interface UnitDef {
  id: string; // e.g., 'villager', 'builder', 'lumberjack'
  state: UnitState;
  position: [number, number]; // Grid coordinates
  path?: [number, number][]; // Current path to follow
  carry?: CarryResource; // What they're carrying (if any)
  workTimeMs?: number; // Time spent working at a location
  workCompleteAt?: Date | null; // When work will complete
}

// Unit runtime class
export class Unit {
  private id: string;
  private state: UnitState = 'idle';
  private position: [number, number] = [0, 0];
  private path: [number, number][] | undefined;
  private carry?: CarryResource;
  private workTimeMs?: number;
  private workCompleteAt?: Date | null;
  
  constructor(def: UnitDef) {
    this.id = def.id;
    this.state = def.state;
    this.position = def.position;
    this.path = def.path;
    this.carry = def.carry;
    this.workTimeMs = def.workTimeMs;
    this.workCompleteAt = def.workCompleteAt || null;
  }

  // Getters
  get id(): string { return this.id; }
  get state(): UnitState { return this.state; }
  get position(): [number, number] { return this.position; }
  getPath(): [number, number][] | undefined { return this.path; }
  get carry(): CarryResource | undefined { return this.carry; }
  get workTimeMs(): number | undefined { return this.workTimeMs; }
  get workCompleteAt(): Date | null { return this.workCompleteAt; }

  // Setters
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

  // Check if unit is at a specific position
  isAtPosition(x: number, y: number): boolean {
    return this.position[0] === x && this.position[1] === y;
  }

  // Get distance to target (Manhattan for grid)
  getDistanceTo(targetX: number, targetY: number): number {
    const dx = Math.abs(this.position[0] - targetX);
    const dy = Math.abs(this.position[1] - targetY);
    return dx + dy;
  }

  // Get current progress along path (0-1)
  getPathProgress(): number | null {
    if (!this.path || this.path.length === 0) return null;
    
    const currentIndex = this.path.findIndex(([px, py]) => 
      px === this.position[0] && py === this.position[1]
    );
    
    if (currentIndex < 0) return null; // Not on path
    
    return Math.min(1.0, currentIndex / (this.path.length - 1));
  }

  // Get next waypoint in path
  getNextWaypoint(): [number, number] | undefined {
    const currentPos = this.position;
    
    for (const waypoint of this.path!) {
      if (currentPos[0] === waypoint[0] && currentPos[1] === waypoint[1]) {
        // Skip current position, get next
        continue;
      }
      
      return waypoint;
    }
    
    return undefined;
  }

  // Get remaining path length
  getRemainingPathLength(): number | null {
    if (!this.path || this.path.length === 0) return null;
    
    const currentIndex = this.path.findIndex(([px, py]) => 
      px === this.position[0] && py === this.position[1]
    );
    
    if (currentIndex < 0) return null;
    
    return this.path.length - 1 - currentIndex;
  }

  // Get current tile type at position
  getCurrentTileType(grid: Grid): string | undefined {
    const tile = grid.getTile(this.position[0], this.position[1]);
    return tile?.type || undefined;
  }

  // Check if unit is carrying anything
  isCarrying(): boolean {
    return !!this.carry;
  }

  // Get carry resource ID (if any)
  getCarryResourceId(): string | undefined {
    return this.carry?.id || undefined;
  }

  // Get carry quantity (if any)
  getCarryQuantity(): number | undefined {
    return this.carry?.qty || undefined;
  }
}
```

### 2. src/core/Unit.ts (Add state machine methods)
```ts
import { Grid } from './Grid';
import { Pathfinder } from './Pathfinding';

export type UnitState = 'idle' | 'move' | 'work' | 'carry' | 'deliver';

interface CarryResource {
  id: string;
  qty: number;
}

export interface UnitDef {
  id: string;
  state: UnitState;
  position: [number, number];
  path?: [number, number][];
  carry?: CarryResource;
  workTimeMs?: number;
  workCompleteAt?: Date | null;
}

export class Unit {
  private id: string;
  private state: UnitState = 'idle';
  private position: [number, number] = [0, 0];
  private path: [number, number][] | undefined;
  private carry?: CarryResource;
  private workTimeMs?: number;
  private workCompleteAt?: Date | null;
  
  constructor(def: UnitDef) {
    this.id = def.id;
    this.state = def.state;
    this.position = def.position;
    this.path = def.path;
    this.carry = def.carry;
    this.workTimeMs = def.workTimeMs;
    this.workCompleteAt = def.workCompleteAt || null;
  }

  get id(): string { return this.id; }
  get state(): UnitState { return this.state; }
  get position(): [number, number] { return this.position; }
  getPath(): [number, number][] | undefined { return this.path; }
  get carry(): CarryResource | undefined { return this.carry; }
  get workTimeMs(): number | undefined { return this.workTimeMs; }
  get workCompleteAt(): Date | null { return this.workCompleteAt; }

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

  // State machine: transition to next state based on conditions
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
    }
  }

  private handleIdle(): void {
    // Idle: wait for input or auto-assign work
    if (this.path) {
      const next = this.getNextWaypoint();
      if (next) {
        // Start moving to next waypoint
        this.setState('move');
      } else {
        // Path complete, go idle again
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
      // Reached end of path
      this.setState('idle');
      return;
    }

    // Move towards next waypoint (simplified - in reality, use smooth interpolation)
    const currentPos = this.position;
    
    // Check if we've reached the next waypoint
    if (currentPos[0] === next[0] && currentPos[1] === next[1]) {
      // Reached waypoint, stay idle briefly or continue to next
      this.setState('idle');
    } else {
      // Still moving
      // TODO: Implement smooth movement interpolation here
    }
  }

  private handleWork(deltaTimeMs: number, grid: Grid): void {
    if (!this.workTimeMs) return;

    const elapsed = Date.now() - (this.workCompleteAt?.getTime() || 0);
    
    if (elapsed >= this.workTimeMs) {
      // Work complete, transition to carry or deliver
      this.setState('carry');
    } else {
      // Still working
      // TODO: Update work progress bar here
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

  private handleDeliver(): void {
    if (!this.carry) return;

    // Deliver resource to target (storehouse, building, etc.)
    const target = this.findNearestDeliveryLocation();
    
    if (target) {
      // TODO: Add resource to target inventory
      console.log(`Delivered ${this.carry.id} (${this.carry.qty}) to ${target.type}`);
      
      // Drop off resource
      this.setCarry(undefined);
      
      // Return to idle or find new work
      this.setState('idle');
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

### 3. src/scenes/GameScene.ts (Add unit rendering)
```ts
import Phaser from 'phaser';
import { isoToScreen, screenToIso, drawIsoTile } from '../iso';
import { TILE_WIDTH, TILE_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';
import { TouchInputManager, TouchEvent } from '../input/TouchInput';
import { Grid, TerrainType } from '../core/Grid';
import { Pathfinder } from '../core/Pathfinding';
import { Unit, UnitState, CarryResource } from '../core/Unit';

export class GameScene extends Phaser.Scene {
  private grid: Grid;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private isoGridGraphics: Phaser.GameObjects.Graphics;
  private terrainLayer: any[] = [];
  private featureLayers: Phaser.GameObjects.Group[] = [];
  private touchInput: TouchInputManager | null = null;
  private pathfinder: Pathfinder | null = null;
  private units: Unit[] = []; // Runtime unit instances

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
    
    this.featureLayers = [];
    for (let i = 0; i < GRID_SIZE_X + GRID_SIZE_Y; i++) {
      const layer = new Phaser.GameObjects.Group(this);
      layer.z = i;
      this.featureLayers.push(layer);
    }
    
    // Initialize grid and pathfinder
    this.grid = new Grid(GRID_SIZE_X, GRID_SIZE_Y);
    for (let x = 0; x < GRID_SIZE_X; x++) {
      for (let y = 0; y < GRID_SIZE_Y; y++) {
        const tileData = this.terrainLayer[x][y];
        this.grid.setTile(x, y, tileData);
      }
    }
    
    this.pathfinder = new Pathfinder(this.grid);
    
    // Draw base terrain
    this.drawIsoGrid();
    
    // Initialize touch input manager
    this.touchInput = new TouchInputManager(this, this.camera);
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
}
```

## Testing
Run `npm run dev` and "New Game":
- Units should be able to spawn at grid positions
- State machine should transition between states correctly
- Pathfinding should work for movement

## Next Step
Once the Unit class works, move to **STEP08** for depth-sorted rendering (painter's algorithm).