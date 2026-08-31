# STEP 10: Build Mode UI

## Goal
Create a simple build mode UI that lets players select buildings and place them on the grid.

## Acceptance Criteria
- "Build" button appears in HUD when active
- Building selection panel shows available buildings with costs
- Tap on valid placement location shows preview
- Progress bar shows construction progress
- Build completes and places building at selected location

## Files to Create/Modify

### 1. src/ui/BuildMode.ts (Build mode UI)
```ts
import Phaser from 'phaser';
import { BUILDINGS, getBuilding } from '../content/buildings';
import { ResourceDef } from '../content/resources';

// Build mode UI component
export class BuildModeUI {
  private scene: Phaser.Scene;
  private active: boolean = false;
  private selectedBuildingId: string | null = null;
  private placementPreview: Phaser.GameObjects.Graphics | null = null;
  private progressContainer: Phaser.GameObjects.Container | null = null;
  private progressBar: Phaser.GameObjects.Rectangle | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Activate build mode (called from HUD button)
  activate(): void {
    if (!this.active) {
      this.active = true;
      
      // Show UI elements
      this.createUI();
      
      // Emit event to game logic
      this.scene.events.emit('build-mode-activated');
    }
  }

  // Deactivate build mode (called from HUD button or cancel)
  deactivate(): void {
    if (this.active) {
      this.active = false;
      
      // Hide UI elements
      if (this.placementPreview) {
        this.placementPreview.destroy();
        this.placementPreview = null;
      }
      
      if (this.progressContainer) {
        this.progressContainer.destroy();
        this.progressContainer = null;
      }
      
      // Emit event to game logic
      this.scene.events.emit('build-mode-deactivated');
    }
  }

  // Select a building for placement
  selectBuilding(buildingId: string): void {
    if (this.selectedBuildingId === buildingId) {
      // Deselect
      this.selectedBuildingId = null;
      return;
    }
    
    const buildingDef = getBuilding(buildingId);
    if (!buildingDef) return;
    
    this.selectedBuildingId = buildingId;
    this.showSelectionPanel(buildingDef);
  }

  // Show selection panel for a building
  private showSelectionPanel(buildingDef: any): void {
    const graphics = new Phaser.GameObjects.Graphics(this.scene);
    graphics.fillStyle(0x2d5a3f, 0.8);
    graphics.fillRect(10, 10, 200, 150);
    
    // Building name
    graphics.fillStyle('#ffffff');
    graphics.setFontSize(24);
    graphics.fillText(buildingDef.name, 20, 40);
    
    // Cost display
    graphics.setFontSize(16);
    let yPos = 70;
    for (const cost of buildingDef.cost) {
      const resDef = this.scene.resources.get(cost.res);
      if (resDef) {
        graphics.fillStyle('#ffffff');
        graphics.fillText(`${cost.qty} ${resDef.name}`, 20, yPos);
        yPos += 24;
      }
    }
    
    // Build time
    graphics.setFontSize(16);
    graphics.fillStyle('#ffffaa');
    graphics.fillText(`Build Time: ${(buildingDef.buildMs / 1000).toFixed(1)}s`, 20, yPos + 24);
    
    // Capacity (if applicable)
    if (buildingDef.capacity !== undefined) {
      graphics.setFontSize(16);
      graphics.fillStyle('#ffffaa');
      graphics.fillText(`Capacity: ${buildingDef.capacity}`, 20, yPos + 50);
    }
    
    this.scene.add.graphics().add(graphics);
  }

  // Show placement preview at grid position
  showPlacementPreview(x: number, y: number): void {
    if (!this.selectedBuildingId) return;
    
    const buildingDef = getBuilding(this.selectedBuildingId);
    if (!buildingDef) return;
    
    // Clear old preview
    if (this.placementPreview) {
      this.placementPreview.destroy();
      this.placementPreview = null;
    }
    
    // Create new preview
    const graphics = new Phaser.GameObjects.Graphics(this.scene);
    
    // Draw building outline at isometric position
    for (let dx = 0; dx < buildingDef.size.w; dx++) {
      for (let dy = 0; dy < buildingDef.size.h; dy++) {
        const screenPos = this.isoToScreen(x + dx, y + dy);
        
        // Draw diamond outline
        graphics.lineStyle(2, 0xffffaa, 1.0);
        graphics.strokePolygon([
          { x: screenPos.x - TILE_WIDTH, y: screenPos.y - TILE_HEIGHT / 4 },
          { x: screenPos.x + TILE_WIDTH, y: screenPos.y - TILE_HEIGHT / 4 },
          { x: screenPos.x + TILE_WIDTH, y: screenPos.y + TILE_HEIGHT / 4 },
          { x: screenPos.x - TILE_WIDTH, y: screenPos.y + TILE_HEIGHT / 4 }
        ]);
      }
    }
    
    this.placementPreview = graphics;
    this.scene.add.graphics().add(graphics);
  }

  // Hide placement preview
  hidePlacementPreview(): void {
    if (this.placementPreview) {
      this.placementPreview.destroy();
      this.placementPreview = null;
    }
  }

  // Show construction progress
  showProgress(buildingId: string, elapsedMs: number): void {
    const buildingDef = getBuilding(buildingId);
    if (!buildingDef) return;
    
    // Create or update progress container
    if (!this.progressContainer) {
      this.progressContainer = new Phaser.GameObjects.Container(this.scene);
      this.scene.add.graphics().add(this.progressContainer);
      
      // Progress bar background
      const bg = new Phaser.GameObjects.Rectangle(10, 20, 250, 20, 0x3d6b4f);
      bg.setOrigin(0, 0.5);
      this.progressContainer.add(bg);
      
      // Progress bar foreground
      const fg = new Phaser.GameObjects.Rectangle(10, 20, 0, 20, 0xffffaa);
      fg.setOrigin(0, 0.5);
      this.progressBar = fg;
      this.progressContainer.add(fg);
    }
    
    // Update progress
    const totalMs = buildingDef.buildMs;
    const percentComplete = Math.min(1.0, elapsedMs / totalMs);
    
    if (this.progressBar) {
      this.progressBar.width = 250 * percentComplete;
    }
    
    // Progress text
    const text = new Phaser.GameObjects.Text(
      `${Math.floor(percentComplete * 100)}%`,
      { fontSize: '16px', color: '#ffffff' }
    );
    text.setOrigin(0.5, 0.5);
    this.progressContainer.add(text);
    
    // Update position to center of screen
    const centerX = (this.scene.cameras.main.width / 2) * this.scene.cameras.main.scale;
    const centerY = (this.scene.cameras.main.height / 2) * this.scene.cameras.main.scale;
    this.progressContainer.x = centerX - 135; // Half of 270 width
    this.progressContainer.y = centerY - 60;
    
    return percentComplete;
  }

  // Hide progress
  hideProgress(): void {
    if (this.progressContainer) {
      this.progressContainer.destroy();
      this.progressContainer = null;
    }
  }

  private createUI(): void {
    // Create selection panel (shown when building is selected)
    const graphics = new Phaser.GameObjects.Graphics(this.scene);
    graphics.fillStyle(0x2d5a3f, 0.8);
    graphics.fillRect(10, 10, 200, 150);
    
    // Building name placeholder
    graphics.fillStyle('#ffffff');
    graphics.setFontSize(24);
    graphics.fillText('Select a building', 20, 40);
    
    this.scene.add.graphics().add(graphics);
  }

  private isoToScreen(x: number, y: number): { x: number; y: number } {
    const TILE_WIDTH = 128;
    const TILE_HEIGHT = 64;
    return {
      x: (x - y) * TILE_WIDTH / 2,
      y: (x + y) * TILE_HEIGHT / 2
    };
  }
}

// Export constants for tile size
export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;
```

### 2. src/scenes/GameScene.ts (Integrate build mode UI)
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
    
    // Update build mode progress bars
    if (this.buildModeUI && this.buildModeUI.active) {
      // Check for completed builds and update UI
      this.checkBuildProgress();
    }
  }

  private checkBuildProgress(): void {
    // TODO: Implement build progress tracking
    // This will be expanded in later steps with Construction system
  }
}
```

### 3. src/ui/BuildMode.ts (Add resources reference)
```ts
import Phaser from 'phaser';
import { BUILDINGS, getBuilding } from '../content/buildings';
import { ResourceDef } from '../content/resources';

// Build mode UI component
export class BuildModeUI {
  private scene: Phaser.Scene;
  private active: boolean = false;
  private selectedBuildingId: string | null = null;
  private placementPreview: Phaser.GameObjects.Graphics | null = null;
  private progressContainer: Phaser.GameObjects.Container | null = null;
  private progressBar: Phaser.GameObjects.Rectangle | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Store resources for cost display
    (this as any).resources = RESOURCES;
  }

  activate(): void {
    if (!this.active) {
      this.active = true;
      
      this.createUI();
      
      this.scene.events.emit('build-mode-activated');
    }
  }

  deactivate(): void {
    if (this.active) {
      this.active = false;
      
      if (this.placementPreview) {
        this.placementPreview.destroy();
        this.placementPreview = null;
      }
      
      if (this.progressContainer) {
        this.progressContainer.destroy();
        this.progressContainer = null;
      }
      
      this.scene.events.emit('build-mode-deactivated');
    }
  }

  selectBuilding(buildingId: string): void {
    if (this.selectedBuildingId === buildingId) {
      this.selectedBuildingId = null;
      return;
    }
    
    const buildingDef = getBuilding(buildingId);
    if (!buildingDef) return;
    
    this.selectedBuildingId = buildingId;
    this.showSelectionPanel(buildingDef);
  }

  showPlacementPreview(x: number, y: number): void {
    if (!this.selectedBuildingId) return;
    
    const buildingDef = getBuilding(this.selectedBuildingId);
    if (!buildingDef) return;
    
    if (this.placementPreview) {
      this.placementPreview.destroy();
      this.placementPreview = null;
    }
    
    const graphics = new Phaser.GameObjects.Graphics(this.scene);
    
    for (let dx = 0; dx < buildingDef.size.w; dx++) {
      for (let dy = 0; dy < buildingDef.size.h; dy++) {
        const screenPos = this.isoToScreen(x + dx, y + dy);
        
        graphics.lineStyle(2, 0xffffaa, 1.0);
        graphics.strokePolygon([
          { x: screenPos.x - TILE_WIDTH, y: screenPos.y - TILE_HEIGHT / 4 },
          { x: screenPos.x + TILE_WIDTH, y: screenPos.y - TILE_HEIGHT / 4 },
          { x: screenPos.x + TILE_WIDTH, y: screenPos.y + TILE_HEIGHT / 4 },
          { x: screenPos.x - TILE_WIDTH, y: screenPos.y + TILE_HEIGHT / 4 }
        ]);
      }
    }
    
    this.placementPreview = graphics;
    this.scene.add.graphics().add(graphics);
  }

  hidePlacementPreview(): void {
    if (this.placementPreview) {
      this.placementPreview.destroy();
      this.placementPreview = null;
    }
  }

  showProgress(buildingId: string, elapsedMs: number): void {
    const buildingDef = getBuilding(buildingId);
    if (!buildingDef) return;
    
    if (!this.progressContainer) {
      this.progressContainer = new Phaser.GameObjects.Container(this.scene);
      this.scene.add.graphics().add(this.progressContainer);
      
      const bg = new Phaser.GameObjects.Rectangle(10, 20, 250, 20, 0x3d6b4f);
      bg.setOrigin(0, 0.5);
      this.progressContainer.add(bg);
      
      const fg = new Phaser.GameObjects.Rectangle(10, 20, 0, 20, 0xffffaa);
      fg.setOrigin(0, 0.5);
      this.progressBar = fg;
      this.progressContainer.add(fg);
    }
    
    const totalMs = buildingDef.buildMs;
    const percentComplete = Math.min(1.0, elapsedMs / totalMs);
    
    if (this.progressBar) {
      this.progressBar.width = 250 * percentComplete;
    }
    
    const text = new Phaser.GameObjects.Text(
      `${Math.floor(percentComplete * 100)}%`,
      { fontSize: '16px', color: '#ffffff' }
    );
    text.setOrigin(0.5, 0.5);
    this.progressContainer.add(text);
    
    const centerX = (this.scene.cameras.main.width / 2) * this.scene.cameras.main.scale;
    const centerY = (this.scene.cameras.main.height / 2) * this.scene.cameras.main.scale;
    this.progressContainer.x = centerX - 135;
    this.progressContainer.y = centerY - 60;
    
    return percentComplete;
  }

  hideProgress(): void {
    if (this.progressContainer) {
      this.progressContainer.destroy();
      this.progressContainer = null;
    }
  }

  private createUI(): void {
    const graphics = new Phaser.GameObjects.Graphics(this.scene);
    graphics.fillStyle(0x2d5a3f, 0.8);
    graphics.fillRect(10, 10, 200, 150);
    
    graphics.fillStyle('#ffffff');
    graphics.setFontSize(24);
    graphics.fillText('Select a building', 20, 40);
    
    this.scene.add.graphics().add(graphics);
  }

  private isoToScreen(x: number, y: number): { x: number; y: number } {
    const TILE_WIDTH = 128;
    const TILE_HEIGHT = 64;
    return {
      x: (x - y) * TILE_WIDTH / 2,
      y: (x + y) * TILE_HEIGHT / 2
    };
  }
}

export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;
```

### 4. src/constants.ts (Add tile constants to exports)
```ts
// Tile dimensions for isometric projection
export const TILE_WIDTH = 128; // px, for 2:1 isometric ratio
export const TILE_HEIGHT = 64; // px
export const GRID_SIZE_X = 32; // tiles
export const GRID_SIZE_Y = 32; // tiles

// Terrain type constants for reference
export const TERRAIN_TYPES: { [key in TerrainType]: string } = {
  grass: 'grass',
  forest: 'forest',
  rocky: 'rocky',
  water: 'water'
};

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

## Testing
Run `npm run dev` and "New Game":
- Tap "Build" button to activate build mode
- Select a building from the panel
- Tap on grid to see placement preview
- Progress bar should appear during construction

## Next Step
Once build mode UI works, move to **STEP11** for storehouse + builder economy.