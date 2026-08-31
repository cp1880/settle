# STEP 03: New Game → Render Isometric Grid from Generated Terrain

## Goal
Replace the placeholder grid with a proper isometric terrain generation system that creates varied ground.

## Acceptance Criteria
- Running "New Game" generates a new random map each time
- Map has grass, forest (trees), rocky areas, water bodies
- Isometric projection renders correctly at 2:1 ratio
- Grid covers full screen with proper tiling

## Files to Create/Modify

### 1. src/scenes/GameScene.ts (Enhanced terrain generation)
```ts
import Phaser from 'phaser';
import { isoToScreen, screenToIso } from '../iso';
import { TILE_WIDTH, TILE_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';
import { TerrainType, generateTerrainMap } from '../core/terrain';

export class GameScene extends Phaser.Scene {
  private grid: Phaser.Tilemaps.Grid;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private isoGridGraphics: Phaser.GameObjects.Graphics;
  private terrainLayer: any[] = []; // Store generated terrain data

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.terrainLayer = generateTerrainMap(GRID_SIZE_X, GRID_SIZE_Y);
    
    // Create isometric camera
    this.camera = new Phaser.Cameras.Scene2D.Camera(this, TILE_WIDTH * 2, TILE_HEIGHT * 2);
    
    // Draw isometric grid with generated terrain
    this.drawIsoGrid();
  }

  private drawIsoGrid(): void {
    const graphics = this.add.graphics();
    graphics.clear();
    
    for (let x = 0; x < GRID_SIZE_X; x++) {
      for (let y = 0; y < GRID_SIZE_Y; y++) {
        const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
        const tileData = this.terrainLayer[x][y];
        
        // Draw terrain based on type
        switch (tileData.type) {
          case 'grass':
            graphics.fillStyle(0x4a7c59);
            break;
          case 'forest':
            graphics.fillStyle(0x3d6b4f);
            break;
          case 'rocky':
            graphics.fillStyle(0x8b7355);
            break;
          case 'water':
            graphics.fillStyle(0x4a90c2);
            break;
        }
        
        // Draw isometric tile (diamond shape)
        const width = TILE_WIDTH * 2;
        const height = TILE_HEIGHT * 2;
        graphics.fillPolygon([
          { x: screenPos.x - width/2, y: screenPos.y - height/4 },
          { x: screenPos.x + width/2, y: screenPos.y - height/4 },
          { x: screenPos.x + width/2, y: screenPos.y + height/4 },
          { x: screenPos.x - width/2, y: screenPos.y + height/4 }
        ]);
      }
    }

    graphics.draw();
  }
}
```

### 2. src/core/terrain.ts (Terrain generation)
```ts
import { TILE_WIDTH, TILE_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';

export type TerrainType = 'grass' | 'forest' | 'rocky' | 'water';

interface TileData {
  type: TerrainType;
}

// Simple cellular automata + noise-based terrain generation
export function generateTerrainMap(width: number, height: number): TileData[][] {
  // Start with random noise
  let map = Array.from({ length: width }, () => 
    Array.from({ length: height }, () => ({ type: 'grass' as TerrainType }))
  );

  // Add water bodies (large connected regions)
  addWaterBodies(map, 0.15); // ~15% chance for water
  
  // Add rocky areas (medium-sized clusters)
  addRockyAreas(map, 0.12); // ~12% chance
  
  // Add forests (smaller clusters in grass/rocky areas)
  addForests(map, 0.08); // ~8% chance

  return map;
}

function addWaterBodies(map: TileData[][], waterChance: number): void {
  for (let i = 0; i < map.length * map[0].length * waterChance; i++) {
    const x = Math.floor(Math.random() * map.length);
    const y = Math.floor(Math.random() * map[0].length);
    
    // Use flood fill to create connected bodies
    const bodySize = 5 + Math.floor(Math.random() * 10);
    floodFill(map, x, y, 'water', bodySize);
  }
}

function addRockyAreas(map: TileData[][], rockChance: number): void {
  for (let i = 0; i < map.length * map[0].length * rockChance; i++) {
    const x = Math.floor(Math.random() * map.length);
    const y = Math.floor(Math.random() * map[0].length);
    
    // Create medium-sized rocky clusters
    const clusterSize = 3 + Math.floor(Math.random() * 6);
    floodFill(map, x, y, 'rocky', clusterSize);
  }
}

function addForests(map: TileData[][], forestChance: number): void {
  for (let i = 0; i < map.length * map[0].length * forestChance; i++) {
    const x = Math.floor(Math.random() * map.length);
    const y = Math.floor(Math.random() * map[0].length);
    
    // Small forest clusters
    const clusterSize = 2 + Math.floor(Math.random() * 4);
    floodFill(map, x, y, 'forest', clusterSize);
  }
}

function floodFill(
  map: TileData[][], 
  startX: number, 
  startY: number, 
  type: TerrainType, 
  maxCells: number
): void {
  const visited = new Set<string>();
  const queue: [number, number][] = [[startX, startY]];
  
  while (queue.length > 0 && map[startY][startX].type !== type) {
    if (map[startY][startX].type === 'grass' || map[startY][startX].type === 'rocky') {
      queue.push([startX, startY]);
    }
    
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;
    
    if (visited.has(key)) continue;
    visited.add(key);
    
    // Add neighbors to queue
    const neighbors: [number, number][] = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
    ];
    
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < map.length && ny >= 0 && ny < map[0].length) {
        queue.push([nx, ny]);
      }
    }
  }

  // Fill the connected region
  const fillQueue: [number, number][] = [[startX, startY]];
  const fillVisited = new Set<string>();
  
  while (fillQueue.length > 0 && map[startY][startX].type !== type) {
    if (map[startY][startX].type === 'grass' || map[startY][startX].type === 'rocky') {
      fillQueue.push([startX, startY]);
    }
    
    const [x, y] = fillQueue.shift()!;
    const key = `${x},${y}`;
    
    if (fillVisited.has(key)) continue;
    fillVisited.add(key);
    
    map[y][x].type = type;
    
    // Add neighbors to queue
    const neighbors: [number, number][] = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
    ];
    
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < map.length && ny >= 0 && ny < map[0].length) {
        fillQueue.push([nx, ny]);
      }
    }
  }
}
```

### 3. src/constants.ts (Update with terrain types)
```ts
export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;
export const GRID_SIZE_X = 32;
export const GRID_SIZE_Y = 32;

// Terrain type constants for reference
export const TERRAIN_TYPES: { [key in TerrainType]: string } = {
  grass: 'grass',
  forest: 'forest',
  rocky: 'rocky',
  water: 'water'
};
```

### 4. src/iso.ts (Isometric projection)
```ts
export const isoToScreen = (x: number, y: number, width: number, height: number): { x: number; y: number } => ({
  x: (x - y) * width / 2,
  y: (x + y) * height / 2
});

export const screenToIso = (sx: number, sy: number, width: number, height: number): { x: number; y: number } => ({
  x: (sy - sx) / (height / 2),
  y: (sy + sx) / (height / 2)
});

// Helper for drawing isometric tiles
export function drawIsoTile(
  graphics: Phaser.GameObjects.Graphics,
  x: number, 
  y: number, 
  color: string,
  width: number = TILE_WIDTH * 2,
  height: number = TILE_HEIGHT * 2
): void {
  const screenPos = isoToScreen(x, y, width, height);
  
  graphics.fillStyle(color);
  graphics.fillPolygon([
    { x: screenPos.x - width/2, y: screenPos.y - height/4 },
    { x: screenPos.x + width/2, y: screenPos.y - height/4 },
    { x: screenPos.x + width/2, y: screenPos.y + height/4 },
    { x: screenPos.x - width/2, y: screenPos.y + height/4 }
  ]);
}
```

## Testing
Run `npm run dev` and "New Game":
- Should see varied terrain (grass, forest patches, rocky areas, water bodies)
- Isometric projection should look correct
- Colors should differentiate terrain types

## Next Step
Once the grid has variety, move to **STEP04** for adding features like trees, rocks, cliffs.