# STEP 04: Add Terrain Variety (Trees, Rocks, Cliffs, Water Features)

## Goal
Add visual features to the terrain: individual trees on forest tiles, rock outcrops on rocky tiles, water depth variation.

## Acceptance Criteria
- Forest tiles show tree sprites/graphics
- Rocky tiles show rock outcrop graphics
- Water has subtle wave animation or texture
- Features are drawn in painter's algorithm order (below buildings)

## Files to Create/Modify

### 1. src/scenes/GameScene.ts (Add feature rendering)
```ts
import Phaser from 'phaser';
import { isoToScreen, screenToIso, drawIsoTile } from '../iso';
import { TILE_WIDTH, TILE_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';
import { TerrainType, generateTerrainMap } from '../core/terrain';

export class GameScene extends Phaser.Scene {
  private grid: Phaser.Tilemaps.Grid;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private isoGridGraphics: Phaser.GameObjects.Graphics;
  private terrainLayer: any[] = [];
  private featureLayers: Phaser.GameObjects.Group[] = []; // For features

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.terrainLayer = generateTerrainMap(GRID_SIZE_X, GRID_SIZE_Y);
    
    // Create isometric camera
    this.camera = new Phaser.Cameras.Scene2D.Camera(this, TILE_WIDTH * 2, TILE_HEIGHT * 2);
    
    // Initialize feature layers (drawn in painter's order)
    this.featureLayers = [];
    for (let i = 0; i < GRID_SIZE_X + GRID_SIZE_Y; i++) {
      const layer = new Phaser.GameObjects.Group(this);
      layer.z = i; // Painter's algorithm: draw by x+y sum
      this.featureLayers.push(layer);
    }
    
    // Draw base terrain
    this.drawIsoGrid();
  }

  private drawIsoGrid(): void {
    const graphics = this.add.graphics();
    graphics.clear();
    
    for (let x = 0; x < GRID_SIZE_X; x++) {
      for (let y = 0; y < GRID_SIZE_Y; y++) {
        const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
        const tileData = this.terrainLayer[x][y];
        
        // Draw terrain base
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
        
        drawIsoTile(graphics, x, y, 0xffffff, TILE_WIDTH * 2, TILE_HEIGHT * 2);
      }
    }

    graphics.draw();
    
    // Draw features (trees, rocks) in painter's order
    for (let i = 0; i < this.featureLayers.length; i++) {
      const layer = this.featureLayers[i];
      
      for (let x = 0; x < GRID_SIZE_X; x++) {
        for (let y = 0; y < GRID_SIZE_Y; y++) {
          if ((x + y) === i) { // Painter's order
            const tileData = this.terrainLayer[x][y];
            
            // Add features based on terrain type
            switch (tileData.type) {
              case 'forest':
                this.addTree(layer, x, y);
                break;
              case 'rocky':
                this.addRock(layer, x, y);
                break;
              case 'water':
                this.addWaterFeature(layer, x, y);
                break;
            }
          }
        }
      }
    }
  }

  private addTree(layer: Phaser.GameObjects.Group, x: number, y: number): void {
    // Simple tree placeholder (replace with sprite later)
    const tree = layer.create(0, 0, 'tree');
    if (!tree) {
      // Fallback: draw a simple triangle
      const graphics = layer.add.graphics();
      const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
      
      graphics.fillStyle(0x2d5a3f);
      graphics.fillTriangle(
        screenPos.x - 16, screenPos.y - 48,
        screenPos.x + 16, screenPos.y - 48,
        screenPos.x, screenPos.y + 16
      );
    }
  }

  private addRock(layer: Phaser.GameObjects.Group, x: number, y: number): void {
    // Simple rock placeholder (replace with sprite later)
    const graphics = layer.add.graphics();
    const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
    
    graphics.fillStyle(0x7a6e5f);
    graphics.fillCircle(screenPos.x, screenPos.y + 24, 16);
  }

  private addWaterFeature(layer: Phaser.GameObjects.Group, x: number, y: number): void {
    // Subtle wave effect (simple animation placeholder)
    const graphics = layer.add.graphics();
    const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
    
    graphics.fillStyle(0x5a90c2);
    graphics.fillCircle(screenPos.x, screenPos.y + 16, 8);
  }
}
```

### 2. src/core/terrain.ts (Add feature data)
```ts
import { TILE_WIDTH, TILE_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';

export type TerrainType = 'grass' | 'forest' | 'rocky' | 'water';

// Feature types for individual tiles
export type FeatureType = 'tree' | 'rock_outcrop' | 'cliff' | 'shallow_water' | 'deep_water';

interface TileData {
  type: TerrainType;
  feature?: FeatureType; // Optional feature on top of terrain
}

// Enhanced terrain generation with features
export function generateTerrainMap(width: number, height: number): TileData[][] {
  let map = Array.from({ length: width }, () => 
    Array.from({ length: height }, () => ({ type: 'grass' as TerrainType }))
  );

  // Add water bodies
  addWaterBodies(map, 0.15);
  
  // Add rocky areas
  addRockyAreas(map, 0.12);
  
  // Add forests
  addForests(map, 0.08);

  // Add individual features (trees, rocks) on existing terrain
  addFeatures(map);

  return map;
}

function addFeatures(map: TileData[][]): void {
  // Add trees to forest tiles (~60% of forest tiles have a tree)
  for (let x = 0; x < map.length; x++) {
    for (let y = 0; y < map[0].length; y++) {
      if (map[y][x].type === 'forest' && Math.random() < 0.6) {
        map[y][x] = { ...map[y][x], feature: 'tree' };
      }
    }
  }

  // Add rock outcrops to rocky tiles (~50% of rocky tiles have a rock)
  for (let x = 0; x < map.length; x++) {
    for (let y = 0; y < map[0].length; y++) {
      if (map[y][x].type === 'rocky' && Math.random() < 0.5) {
        map[y][x] = { ...map[y][x], feature: 'rock_outcrop' };
      }
    }
  }

  // Add cliff edges at water boundaries
  addCliffs(map);

  // Vary water depth (simple shallow/deep distinction)
  addWaterDepthVariation(map);
}

function addCliffs(map: TileData[][]): void {
  // Find water-land boundaries and mark some as cliffs
  for (let x = 0; x < map.length; x++) {
    for (let y = 0; y < map[0].length; y++) {
      const tile = map[y][x];
      
      if (tile.type === 'water') {
        // Check neighbors for land
        const hasLandNeighbor = [
          [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
        ].some(([nx, ny]) => 
          nx >= 0 && nx < map.length && ny >= 0 && ny < map[0].length &&
          map[ny][nx].type !== 'water'
        );

        if (hasLandNeighbor && Math.random() < 0.3) { // ~30% of boundaries become cliffs
          tile = { ...tile, feature: 'cliff' };
        }
      }
    }
  }
}

function addWaterDepthVariation(map: TileData[][]): void {
  // Randomly vary water depth (for future animation/visuals)
  for (let x = 0; x < map.length; x++) {
    for (let y = 0; y < map[0].length; y++) {
      if (map[y][x].type === 'water') {
        map[y][x] = { 
          ...map[y][x], 
          feature: Math.random() < 0.5 ? 'shallow_water' : 'deep_water'
        };
      }
    }
  }
}
```

### 3. src/scenes/GameScene.ts (Update drawIsoGrid for features)
```ts
// In create(), after initializing featureLayers:

private drawIsoGrid(): void {
  const graphics = this.add.graphics();
  graphics.clear();
  
  // Draw base terrain in painter's order
  for (let i = 0; i < GRID_SIZE_X + GRID_SIZE_Y; i++) {
    for (let x = 0; x < GRID_SIZE_X; x++) {
      for (let y = 0; y < GRID_SIZE_Y; y++) {
        if ((x + y) === i) {
          const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
          const tileData = this.terrainLayer[x][y];
          
          // Draw terrain base with painter's order colors
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
              // Vary water color slightly for depth effect
              color = Math.random() < 0.5 ? 0x4a90c2 : 0x3d7ab1;
              break;
          }
          
          drawIsoTile(graphics, x, y, color);
        }
      }
    }
  }

  graphics.draw();
  
  // Draw features (trees, rocks) in painter's order
  for (let i = 0; i < this.featureLayers.length; i++) {
    const layer = this.featureLayers[i];
    
    for (let x = 0; x < GRID_SIZE_X; x++) {
      for (let y = 0; y < GRID_SIZE_Y; y++) {
        if ((x + y) === i) {
          const tileData = this.terrainLayer[x][y];
          
          // Add features based on terrain type and feature presence
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
              // Water features are drawn separately or as texture overlay
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
  // Simple tree placeholder (replace with sprite later)
  const graphics = layer.add.graphics();
  const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
  
  // Tree trunk
  graphics.fillStyle(0x5c4033);
  graphics.fillRect(screenPos.x - 6, screenPos.y + 12, 12, 24);
  
  // Tree foliage (triangle)
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
  
  // Rock outcrop (irregular shape)
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
  
  // Cliff edge (vertical rock face)
  graphics.fillStyle(0x6a5f4f);
  graphics.fillRect(screenPos.x - 12, screenPos.y - 8, 24, 32);
}

private addWaterFeature(layer: Phaser.GameObjects.Group, x: number, y: number): void {
  const graphics = layer.add.graphics();
  const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
  
  // Subtle wave effect (simple animation placeholder)
  graphics.fillStyle(0x5a90c2);
  graphics.fillCircle(screenPos.x, screenPos.y + 16, 8);
}
```

## Testing
Run `npm run dev` and "New Game":
- Should see varied terrain with individual trees on forest tiles
- Rock outcrops on rocky tiles
- Water bodies with some depth variation
- Cliff edges at water boundaries

## Next Step
Once the grid has good visual variety, move to **STEP05** for camera pan/pinch zoom.