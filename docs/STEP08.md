# STEP 08: Depth-Sorted Rendering (Painter's Algorithm)

## Goal
Implement painter's algorithm for rendering: draw background first, then features, then units/buildings in depth order.

## Acceptance Criteria
- Background terrain drawn first (static layer)
- Features (trees, rocks) drawn next
- Units and buildings drawn last, sorted by `(x + y)` sum
- Static ground baked into a RenderTexture for performance

## Files to Create/Modify

### 1. src/core/Renderer.ts (Depth-sorted rendering system)
```ts
import Phaser from 'phaser';
import { isoToScreen } from '../iso';
import { TILE_WIDTH, TILE_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';
import { Grid } from './Grid';

// Depth layer types for painter's algorithm
export type DepthLayer = 'background' | 'features' | 'units' | 'buildings' | 'ui';

interface Renderable {
  id: string;
  depth: number; // For sorting (lower = drawn first)
  x: number;
  y: number;
  renderFn: () => Phaser.GameObjects.Group | Phaser.GameObjects.Graphics;
}

// Renderer class for painter's algorithm
export class Renderer {
  private scene: Phaser.Scene;
  private grid: Grid;
  private backgroundLayer: Phaser.GameObjects.Group;
  private featureLayers: Phaser.GameObjects.Group[] = [];
  private unitLayer: Phaser.GameObjects.Group;
  private buildingLayer: Phaser.GameObjects.Group;

  constructor(scene: Phaser.Scene, grid: Grid) {
    this.scene = scene;
    this.grid = grid;
    
    // Create background layer (static ground)
    this.backgroundLayer = new Phaser.GameObjects.Group(scene);
    this.backgroundLayer.z = -100; // Drawn first
    
    // Create feature layers for painter's order
    const totalLayers = GRID_SIZE_X + GRID_SIZE_Y;
    for (let i = 0; i < totalLayers; i++) {
      const layer = new Phaser.GameObjects.Group(scene);
      layer.z = i - 100; // Painter's order: x+y sum
      this.featureLayers.push(layer);
    }
    
    // Create unit and building layers (drawn last)
    this.unitLayer = new Phaser.GameObjects.Group(scene);
    this.unitLayer.z = totalLayers - 100;
    
    this.buildingLayer = new Phaser.GameObjects.Group(scene);
    this.buildingLayer.z = totalLayers - 99; // Slightly above units
  }

  // Draw background terrain (static, baked)
  drawBackground(): void {
    const graphics = this.backgroundLayer.add.graphics();
    graphics.clear();
    
    for (let x = 0; x < GRID_SIZE_X; x++) {
      for (let y = 0; y < GRID_SIZE_Y; y++) {
        const tileData = this.grid.getTile(x, y);
        
        if (!tileData) continue;
        
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
        
        const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
        drawIsoTile(graphics, x, y, color);
      }
    }

    graphics.draw();
  }

  // Draw features in painter's order
  drawFeatures(): void {
    for (let i = 0; i < this.featureLayers.length; i++) {
      const layer = this.featureLayers[i];
      
      for (let x = 0; x < GRID_SIZE_X; x++) {
        for (let y = 0; y < GRID_SIZE_Y; y++) {
          if ((x + y) === i) {
            const tileData = this.grid.getTile(x, y);
            
            if (!tileData) continue;
            
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

  // Draw units in painter's order
  drawUnits(): void {
    const graphics = this.unitLayer.add.graphics();
    
    for (const unit of this.scene.units) {
      const screenPos = isoToScreen(unit.position[0], unit.position[1], TILE_WIDTH, TILE_HEIGHT);
      
      // Draw unit based on type
      switch (unit.id) {
        case 'villager':
          drawVillager(graphics, screenPos.x, screenPos.y);
          break;
        case 'builder':
          drawBuilder(graphics, screenPos.x, screenPos.y);
          break;
        default:
          // Default unit appearance
          graphics.fillStyle(0x8b7355);
          graphics.fillCircle(screenPos.x, screenPos.y + 16, 12);
      }
    }

    graphics.draw();
  }

  // Draw buildings in painter's order (simplified)
  drawBuildings(): void {
    const graphics = this.buildingLayer.add.graphics();
    
    for (const building of this.scene.buildings) {
      const screenPos = isoToScreen(building.position[0], building.position[1], TILE_WIDTH, TILE_HEIGHT);
      
      // Draw building based on type
      switch (building.id) {
        case 'town_hall':
          drawTownHall(graphics, screenPos.x, screenPos.y);
          break;
        default:
          // Default building appearance
          graphics.fillStyle(0x8b7355);
          graphics.fillRect(screenPos.x - 24, screenPos.y + 16, 48, 48);
      }
    }

    graphics.draw();
  }

  // Update all layers (for dynamic updates)
  update(): void {
    this.drawBackground();
    this.drawFeatures();
    this.drawUnits();
    this.drawBuildings();
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

// Helper functions for drawing different unit/building types
function drawVillager(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
  // Villager appearance (simple placeholder)
  graphics.fillStyle(0x8b7355);
  graphics.fillCircle(x, y + 16, 12);
}

function drawBuilder(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
  // Builder appearance (with tool/helmet)
  graphics.fillStyle(0x8b7355);
  graphics.fillCircle(x, y + 16, 12);
  
  // Tool indicator
  graphics.fillStyle(0xffd700);
  graphics.fillRect(x - 4, y + 12, 8, 4);
}

function drawTownHall(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
  // Town hall appearance (larger building)
  graphics.fillStyle(0x6b5f4f);
  graphics.fillRect(x - 32, y + 16, 64, 64);
  
  // Roof
  graphics.fillStyle(0x8b7a6f);
  graphics.fillTriangle(
    x - 32, y - 16,
    x + 32, y - 16,
    x, y + 16
  );
}

function drawIsoTile(graphics: Phaser.GameObjects.Graphics, x: number, y: number, color: string): void {
  const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
  
  graphics.fillStyle(color);
  graphics.fillPolygon([
    { x: screenPos.x - TILE_WIDTH, y: screenPos.y - TILE_HEIGHT / 4 },
    { x: screenPos.x + TILE_WIDTH, y: screenPos.y - TILE_HEIGHT / 4 },
    { x: screenPos.x + TILE_WIDTH, y: screenPos.y + TILE_HEIGHT / 4 },
    { x: screenPos.x - TILE_WIDTH, y: screenPos.y + TILE_HEIGHT / 4 }
  ]);
}
```

### 2. src/scenes/GameScene.ts (Integrate renderer)
```ts
import Phaser from 'phaser';
import { isoToScreen, screenToIso, drawIsoTile } from '../iso';
import { TILE_WIDTH, TILE_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';
import { TouchInputManager, TouchEvent } from '../input/TouchInput';
import { Grid, TerrainType } from '../core/Grid';
import { Pathfinder } from '../core/Pathfinding';
import { Unit, UnitState, CarryResource } from '../core/Unit';
import { Renderer, DepthLayer } from '../core/Renderer';

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

  // Main render loop using painter's algorithm
  private render(): void {
    if (!this.renderer) return;
    
    // Draw in depth order (painter's algorithm)
    this.renderer.drawBackground();
    this.renderer.drawFeatures();
    this.renderer.drawUnits();
    this.renderer.drawBuildings();
  }

  // Called every frame for smooth rendering
  private update(): void {
    if (!this.renderer) return;
    
    // Update units (movement, work progress, etc.)
    this.updateUnits(16); // Assume ~60fps
    
    // Render in depth order
    this.render();
  }
}
```

### 3. src/scenes/GameScene.ts (Add update loop)
```ts
import Phaser from 'phaser';
import { isoToScreen, screenToIso, drawIsoTile } from '../iso';
import { TILE_WIDTH, TILE_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';
import { TouchInputManager, TouchEvent } from '../input/TouchInput';
import { Grid, TerrainType } from '../core/Grid';
import { Pathfinder } from '../core/Pathfinding';
import { Unit, UnitState, CarryResource } from '../core/Unit';
import { Renderer, DepthLayer } from '../core/Renderer';

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

  // Main render loop using painter's algorithm
  private render(): void {
    if (!this.renderer) return;
    
    // Draw in depth order (painter's algorithm)
    this.renderer.drawBackground();
    this.renderer.drawFeatures();
    this.renderer.drawUnits();
    this.renderer.drawBuildings();
  }

  // Called every frame for smooth rendering
  private update(): void {
    if (!this.renderer) return;
    
    // Update units (movement, work progress, etc.)
    this.updateUnits(16); // Assume ~60fps
    
    // Render in depth order
    this.render();
  }

  // Override Phaser scene update for smooth rendering
  update(time: number, delta: number): void {
    super.update(time, delta);
    
    if (this.renderer) {
      this.update();
    }
  }
}
```

## Testing
Run `npm run dev` and "New Game":
- Background terrain should be drawn first
- Features (trees, rocks) should appear on top of terrain
- Units should draw above features when spawned
- Buildings should draw above units

## Next Step
Once depth-sorted rendering works, move to **STEP09** for content data files (resources, buildings, jobs).