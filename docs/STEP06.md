# STEP 06: A* Pathfinding with Road Costs

## Goal
Implement A* pathfinding that respects terrain costs (roads = cheap, grass/forest = medium, rocky/water = expensive/blocked).

## Acceptance Criteria
- Units can move on roads (cost = 1)
- Grass/forest have higher cost (cost = 3)
- Rocky tiles are walkable but more expensive (cost = 5)
- Water is blocked unless special ability (cost = ∞ or very high)
- Pathfinding finds optimal routes considering costs

## Files to Create/Modify

### 1. src/core/Grid.ts (Tile grid with costs)
```ts
import { TILE_WIDTH, TILE_HEIGHT } from '../constants';

export type TerrainType = 'grass' | 'forest' | 'rocky' | 'water';
export type FeatureType = 'tree' | 'rock_outcrop' | 'cliff' | 'shallow_water' | 'deep_water';

interface TileData {
  type: TerrainType;
  feature?: FeatureType;
}

// Grid class for managing tile data and costs
export class Grid {
  private width: number;
  private height: number;
  private tiles: TileData[][] = [];
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    
    // Initialize with grass (default walkable terrain)
    for (let x = 0; x < width; x++) {
      const row: TileData[] = [];
      for (let y = 0; y < height; y++) {
        row.push({ type: 'grass' as TerrainType });
      }
      this.tiles.push(row);
    }
  }

  // Set tile data at position
  setTile(x: number, y: number, data: TileData): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.tiles[y][x] = data;
    }
  }

  // Get tile data at position
  getTile(x: number, y: number): TileData | undefined {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.tiles[y][x];
    }
    return undefined;
  }

  // Get movement cost for a tile
  getCost(x: number, y: number): number {
    const tile = this.getTile(x, y);
    
    if (!tile) return Infinity;
    
    switch (tile.type) {
      case 'grass':
        return 3;
      case 'forest':
        return 4; // Slightly more expensive due to trees
      case 'rocky':
        return 5; // Even more expensive
      case 'water':
        return Infinity; // Blocked by default
    }
  }

  // Check if tile is walkable (cost < ∞)
  isWalkable(x: number, y: number): boolean {
    const cost = this.getCost(x, y);
    return cost !== Infinity;
  }

  // Get all valid neighbors for pathfinding
  getValidNeighbors(x: number, y: number): [number, number][] {
    const neighbors: [number, number][] = [];
    
    // Check all 4 directions (for 4-directional movement)
    const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
        neighbors.push([nx, ny]);
      }
    }
    
    return neighbors;
  }

  // Get tile at screen position (inverse isometric projection)
  getTileAtScreen(screenX: number, screenY: number): TileData | undefined {
    const isoPos = this.screenToIso(screenX, screenY);
    return this.getTile(Math.floor(isoPos.x), Math.floor(isoPos.y));
  }

  private screenToIso(screenX: number, screenY: number): { x: number; y: number } {
    const TILE_WIDTH = 128;
    const TILE_HEIGHT = 64;
    
    return {
      x: (screenY - screenX) / (TILE_HEIGHT / 2),
      y: (screenY + screenX) / (TILE_HEIGHT / 2)
    };
  }

  // Get grid dimensions
  get width(): number { return this.width; }
  get height(): number { return this.height; }
  
  // Get tiles array for iteration
  get tiles(): TileData[][] { return this.tiles; }
}
```

### 2. src/core/Pathfinding.ts (A* implementation)
```ts
import { Grid, TerrainType } from './Grid';

// A* pathfinding with weighted costs
export class Pathfinder {
  private grid: Grid;
  
  constructor(grid: Grid) {
    this.grid = grid;
  }

  // Find shortest path considering terrain costs
  findPath(startX: number, startY: number, endX: number, endY: number): [number, number][] | null {
    if (!this.grid.isWalkable(endX, endY)) {
      return null;
    }
    
    // A* algorithm with cost-based movement
    const openSet = new Set<string>();
    const closedSet = new Set<string>();
    const cameFrom: Record<string, [number, number]> = {};
    const scoreSoFar: Record<string, number> = {};
    
    const startKey = `${startX},${startY}`;
    const endKey = `${endX},${endY}`;
    
    // Initialize start position
    openSet.add(startKey);
    scoreSoFar[startKey] = 0;
    
    while (openSet.size > 0) {
      // Get node with lowest f-score
      let currentKey: string | null = null;
      let minScore = Infinity;
      
      for (const key of openSet) {
        const score = scoreSoFar[key];
        if (score < minScore) {
          minScore = score;
          currentKey = key;
        }
      }
      
      if (!currentKey) break; // Shouldn't happen
      
      const [cx, cy] = this.parseKey(currentKey);
      
      // Check if we reached the goal
      if (cx === endX && cy === endY) {
        return this.reconstructPath(cameFrom, startKey, currentKey);
      }
      
      openSet.delete(currentKey);
      closedSet.add(currentKey);
      
      // Get neighbors and their costs
      const neighbors = this.grid.getValidNeighbors(cx, cy).filter(([nx, ny]) => {
        const neighborKey = `${nx},${ny}`;
        
        // Skip if already in closed set (already evaluated)
        if (closedSet.has(neighborKey)) return false;
        
        // Skip if not walkable
        if (!this.grid.isWalkable(nx, ny)) return false;
        
        return true;
      });
      
      for (const [nx, ny] of neighbors) {
        const neighborKey = `${nx},${ny}`;
        const cost = this.grid.getCost(nx, ny);
        
        // Calculate tentative g-score (cost from start to neighbor through current)
        let tentativeScore = scoreSoFar[currentKey] + cost;
        
        if (!openSet.has(neighborKey)) {
          openSet.add(neighborKey);
          cameFrom[neighborKey] = [cx, cy];
          scoreSoFar[neighborKey] = tentativeScore;
        } else if (tentativeScore < scoreSoFar[neighborKey]) {
          // Found a better path to this neighbor
          cameFrom[neighborKey] = [cx, cy];
          scoreSoFar[neighborKey] = tentativeScore;
        }
      }
    }
    
    return null; // No path found
  }

  private parseKey(key: string): [number, number] {
    const parts = key.split(',');
    return [parseInt(parts[0]), parseInt(parts[1])];
  }

  private reconstructPath(
    cameFrom: Record<string, [number, number]>, 
    startKey: string, 
    currentKey: string
  ): [number, number][] {
    const path = [];
    let key = currentKey;
    
    while (key !== startKey) {
      const [x, y] = this.parseKey(key);
      path.unshift([x, y]);
      key = cameFrom[key]?.[0]?.toString() + ',' + cameFrom[key]?.[1].toString() || '';
    }
    
    return path;
  }

  // Find nearest walkable tile to a screen position (for tap-to-move)
  findNearestWalkable(screenX: number, screenY: number): [number, number] | null {
    const isoPos = this.grid.screenToIso(screenX, screenY);
    
    // Check if the tapped position is walkable
    if (this.grid.isWalkable(Math.floor(isoPos.x), Math.floor(isoPos.y))) {
      return [Math.floor(isoPos.x), Math.floor(isoPos.y)];
    }
    
    // Otherwise, find nearest walkable tile
    const startX = Math.max(0, Math.min(this.grid.width - 1, Math.floor(isoPos.x)));
    const startY = Math.max(0, Math.min(this.grid.height - 1, Math.floor(isoPos.y)));
    
    let bestTile: [number, number] | null = null;
    let minDistance = Infinity;
    
    // Search in expanding rings from the tapped position
    for (let radius = 0; radius < Math.max(this.grid.width, this.grid.height); radius++) {
      const ringTiles = this.getRingTiles(startX, startY, radius);
      
      for (const [x, y] of ringTiles) {
        if (this.grid.isWalkable(x, y)) {
          const distance = Math.sqrt(
            (x - startX) ** 2 + (y - startY) ** 2
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            bestTile = [x, y];
          }
        }
      }
      
      // If we found a walkable tile in this ring, stop searching further rings
      if (bestTile && minDistance <= 1.5 * radius) {
        break;
      }
    }
    
    return bestTile || null;
  }

  private getRingTiles(x: number, y: number, radius: number): [number, number][] {
    const tiles: [number, number][] = [];
    
    // Check all tiles within the ring (Manhattan distance)
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) + Math.abs(dy) === radius) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < this.grid.width && ny >= 0 && ny < this.grid.height) {
            tiles.push([nx, ny]);
          }
        }
      }
    }
    
    return tiles;
  }

  // Get heuristic distance for A* (Manhattan with terrain cost consideration)
  private getHeuristic(x1: number, y1: number, x2: number, y2: number): number {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    
    // Simple Manhattan heuristic (can be improved with terrain-aware heuristics)
    return (dx + dy) * 3; // Use average cost as multiplier
  }

  // Get grid for access
  get grid(): Grid { return this.grid; }
}
```

### 3. src/constants.ts (Update with tile costs reference)
```ts
export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;
export const GRID_SIZE_X = 32;
export const GRID_SIZE_Y = 32;

// Tile movement costs for pathfinding
export const TILES_COSTS: { [key in TerrainType]: number } = {
  grass: 3,
  forest: 4,
  rocky: 5,
  water: Infinity // Blocked by default
};

// Road cost (for when we add roads)
export const ROAD_COST = 1;
```

### 4. src/core/Pathfinding.ts (Add road support)
```ts
import { Grid, TerrainType } from './Grid';

// A* pathfinding with weighted costs
export class Pathfinder {
  private grid: Grid;
  
  constructor(grid: Grid) {
    this.grid = grid;
  }

  // Find shortest path considering terrain costs
  findPath(startX: number, startY: number, endX: number, endY: number): [number, number][] | null {
    if (!this.grid.isWalkable(endX, endY)) {
      return null;
    }
    
    const openSet = new Set<string>();
    const closedSet = new Set<string>();
    const cameFrom: Record<string, [number, number]> = {};
    const scoreSoFar: Record<string, number> = {};
    
    const startKey = `${startX},${startY}`;
    const endKey = `${endX},${endY}`;
    
    openSet.add(startKey);
    scoreSoFar[startKey] = 0;
    
    while (openSet.size > 0) {
      let currentKey: string | null = null;
      let minScore = Infinity;
      
      for (const key of openSet) {
        const score = scoreSoFar[key];
        if (score < minScore) {
          minScore = score;
          currentKey = key;
        }
      }
      
      if (!currentKey) break;
      
      const [cx, cy] = this.parseKey(currentKey);
      
      if (cx === endX && cy === endY) {
        return this.reconstructPath(cameFrom, startKey, currentKey);
      }
      
      openSet.delete(currentKey);
      closedSet.add(currentKey);
      
      const neighbors = this.grid.getValidNeighbors(cx, cy).filter(([nx, ny]) => {
        const neighborKey = `${nx},${ny}`;
        
        if (closedSet.has(neighborKey)) return false;
        if (!this.grid.isWalkable(nx, ny)) return false;
        
        return true;
      });
      
      for (const [nx, ny] of neighbors) {
        const neighborKey = `${nx},${ny}`;
        const cost = this.grid.getCost(nx, ny);
        
        let tentativeScore = scoreSoFar[currentKey] + cost;
        
        if (!openSet.has(neighborKey)) {
          openSet.add(neighborKey);
          cameFrom[neighborKey] = [cx, cy];
          scoreSoFar[neighborKey] = tentativeScore;
        } else if (tentativeScore < scoreSoFar[neighborKey]) {
          cameFrom[neighborKey] = [cx, cy];
          scoreSoFar[neighborKey] = tentativeScore;
        }
      }
    }
    
    return null;
  }

  private parseKey(key: string): [number, number] {
    const parts = key.split(',');
    return [parseInt(parts[0]), parseInt(parts[1])];
  }

  private reconstructPath(
    cameFrom: Record<string, [number, number]>, 
    startKey: string, 
    currentKey: string
  ): [number, number][] {
    const path = [];
    let key = currentKey;
    
    while (key !== startKey) {
      const [x, y] = this.parseKey(key);
      path.unshift([x, y]);
      key = cameFrom[key]?.[0]?.toString() + ',' + cameFrom[key]?.[1].toString() || '';
    }
    
    return path;
  }

  private screenToIso(screenX: number, screenY: number): { x: number; y: number } {
    const TILE_WIDTH = 128;
    const TILE_HEIGHT = 64;
    
    return {
      x: (screenY - screenX) / (TILE_HEIGHT / 2),
      y: (screenY + screenX) / (TILE_HEIGHT / 2)
    };
  }

  private getRingTiles(x: number, y: number, radius: number): [number, number][] {
    const tiles: [number, number][] = [];
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) + Math.abs(dy) === radius) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < this.grid.width && ny >= 0 && ny < this.grid.height) {
            tiles.push([nx, ny]);
          }
        }
      }
    }
    
    return tiles;
  }

  private getHeuristic(x1: number, y1: number, x2: number, y2: number): number {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    
    return (dx + dy) * 3;
  }

  get grid(): Grid { return this.grid; }
}
```

### 5. src/scenes/GameScene.ts (Add pathfinding for tap-to-move)
```ts
import Phaser from 'phaser';
import { isoToScreen, screenToIso, drawIsoTile } from '../iso';
import { TILE_WIDTH, TILE_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';
import { TouchInputManager, TouchEvent } from '../input/TouchInput';
import { Grid, TerrainType } from '../core/Grid';
import { Pathfinder } from '../core/Pathfinding';

export class GameScene extends Phaser.Scene {
  private grid: Grid;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private isoGridGraphics: Phaser.GameObjects.Graphics;
  private terrainLayer: any[] = [];
  private featureLayers: Phaser.GameObjects.Group[] = [];
  private touchInput: TouchInputManager | null = null;
  private pathfinder: Pathfinder | null = null;

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
        
        // TODO: Move unit to nearest position
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
}
```

## Testing
Run `npm run dev` and "New Game":
- Drag to pan camera smoothly
- Pinch to zoom between 0.5x and 2.0x
- Tap on terrain → should find nearest walkable tile (check console)
- Pathfinding should respect terrain costs

## Next Step
Once pathfinding works, move to **STEP07** for the Unit base class and state machine.