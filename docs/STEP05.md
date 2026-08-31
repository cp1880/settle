# STEP 05: Camera Pan/Zoom (1-Finger Drag, Pinch)

## Goal
Implement touch input for camera control: pan with drag, zoom with pinch.

## Acceptance Criteria
- 1-finger drag pans the camera smoothly
- 2-finger pinch zooms between 0.5x and 2.0x
- Camera stays within map bounds (optional)
- Smooth interpolation for fluid movement

## Files to Create/Modify

### 1. src/input/TouchInput.ts (Touch input handling)
```ts
import Phaser from 'phaser';

export interface TouchEvent {
  type: 'pan' | 'zoom' | 'tap' | 'double-tap';
  x?: number; // Screen X where event occurred
  y?: number; // Screen Y where event occurred
  isoX?: number; // Isometric grid X (if applicable)
  isoY?: number; // Isometric grid Y (from touch position)
  delta?: { x: number; y: number }; // For pan events
  scale?: number; // For zoom events
}

export class TouchInputManager {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private lastTouchX: number = 0;
  private lastTouchY: number = 0;
  private touchCount: number = 0;
  private minPinchDistance: number = 50; // px, minimum distance to trigger zoom

  constructor(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera) {
    this.scene = scene;
    this.camera = camera;
    
    // Track touch events
    this.scene.input.on('pointerdown', (pointer) => {
      this.touchCount++;
      this.lastTouchX = pointer.worldX;
      this.lastTouchY = pointer.worldY;
      
      if (this.touchCount === 1) {
        // First tap - could be a tap or start of pan/zoom
        setTimeout(() => {
          if (this.touchCount === 1 && !this.isPanning()) {
            this.handleTap(pointer);
          }
        }, 200); // Tap timeout
      }
    });

    this.scene.input.on('pointermove', (pointer) => {
      if (this.touchCount >= 2) {
        this.handlePinch(pointer);
      } else if (this.touchCount === 1 && !this.isPanning()) {
        this.handlePan(pointer);
      }
    });

    this.scene.input.on('pointerup', () => {
      this.touchCount = Math.max(0, this.touchCount - 1);
      
      // Check for double tap
      if (this.touchCount === 0 && !this.isPanning()) {
        const timeSinceTap = Date.now() - (this.lastTapTime || 0);
        if (timeSinceTap < 300) {
          this.handleDoubleTap();
        } else {
          this.handleTap(this.scene.input.activePointer!);
        }
      }
    });
    
    // Track tap time for double-tap detection
    this.lastTapTime = 0;
  }

  private handlePan(pointer: Phaser.Input.Pointer): void {
    const delta = {
      x: pointer.worldX - this.lastTouchX,
      y: pointer.worldY - this.lastTouchY
    };
    
    // Pan camera (invert Y for top-down feel)
    this.camera.scroll(delta.x * 0.5, -delta.y * 0.5);
    
    this.lastTouchX = pointer.worldX;
    this.lastTouchY = pointer.worldY;
  }

  private handlePinch(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.worldX - this.lastTouchX;
    const dy = pointer.worldY - this.lastTouchY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > this.minPinchDistance) {
      // Calculate zoom direction and amount
      const zoomDirection = distance > 0 ? 1 : -1;
      const zoomAmount = 0.05 * (zoomDirection === 1 ? 1 : -1);
      
      // Apply zoom to camera
      this.camera.scale(this.camera.scale + zoomAmount, { x: pointer.worldX, y: pointer.worldY });
      
      // Clamp scale between 0.5x and 2.0x
      const clampedScale = Math.max(0.5, Math.min(2.0, this.camera.scale));
      this.camera.scale(clampedScale);
    }
    
    this.lastTouchX = pointer.worldX;
    this.lastTouchY = pointer.worldY;
  }

  private handleTap(pointer: Phaser.Input.Pointer): void {
    // Convert screen position to isometric grid coordinates
    const isoPos = this.screenToIso(pointer.worldX, pointer.worldY);
    
    // Emit tap event with isometric position
    this.scene.events.emit('tap', isoPos.x, isoPos.y, pointer.worldX, pointer.worldY);
  }

  private handleDoubleTap(): void {
    // Get center of screen or last touch point
    const centerX = this.camera.scrollX + (this.camera.width / 2) * this.camera.scale;
    const centerY = this.camera.scrollY + (this.camera.height / 2) * this.camera.scale;
    
    const isoPos = this.screenToIso(centerX, centerY);
    this.scene.events.emit('double-tap', isoPos.x, isoPos.y);
  }

  private screenToIso(screenX: number, screenY: number): { x: number; y: number } {
    // Inverse isometric projection
    const TILE_WIDTH = 128;
    const TILE_HEIGHT = 64;
    
    return {
      x: (screenY - screenX) / (TILE_HEIGHT / 2),
      y: (screenY + screenX) / (TILE_HEIGHT / 2)
    };
  }

  private isPanning(): boolean {
    // Check if we're currently panning (touch count = 1 and moving)
    return this.touchCount === 1 && this.lastPanDistance > 0;
  }

  private get lastPanDistance(): number {
    return 0; // Simplified - track in handlePan instead
  }
}
```

### 2. src/scenes/GameScene.ts (Add camera and touch input)
```ts
import Phaser from 'phaser';
import { isoToScreen, screenToIso, drawIsoTile } from '../iso';
import { TILE_WIDTH, TILE_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';
import { TouchInputManager, TouchEvent } from '../input/TouchInput';

export class GameScene extends Phaser.Scene {
  private grid: Phaser.Tilemaps.Grid;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private isoGridGraphics: Phaser.GameObjects.Graphics;
  private terrainLayer: any[] = [];
  private featureLayers: Phaser.GameObjects.Group[] = [];
  private touchInput: TouchInputManager | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.terrainLayer = generateTerrainMap(GRID_SIZE_X, GRID_SIZE_Y);
    
    // Create isometric camera with proper bounds
    const mapWidth = GRID_SIZE_X * TILE_WIDTH;
    const mapHeight = GRID_SIZE_Y * TILE_HEIGHT;
    
    this.camera = new Phaser.Cameras.Scene2D.Camera(this, mapWidth, mapHeight);
    this.camera.scrollX = mapWidth / 2;
    this.camera.scrollY = mapHeight / 2;
    this.camera.zoom = 1.0;
    this.camera.minZoom = 0.5;
    this.camera.maxZoom = 2.0;
    
    // Initialize feature layers (drawn in painter's order)
    this.featureLayers = [];
    for (let i = 0; i < GRID_SIZE_X + GRID_SIZE_Y; i++) {
      const layer = new Phaser.GameObjects.Group(this);
      layer.z = i;
      this.featureLayers.push(layer);
    }
    
    // Draw base terrain
    this.drawIsoGrid();
    
    // Initialize touch input manager
    this.touchInput = new TouchInputManager(this, this.camera);
    
    // Connect tap events to scene (for later use)
    this.events.on('tap', (isoX: number, isoY: number, screenX: number, screenY: number) => {
      console.log(`Tap at isometric (${isoX}, ${isoY})`, screenX, screenY);
    });

    this.events.on('double-tap', (isoX: number, isoY: number) => {
      console.log(`Double tap at isometric (${isoX}, ${isoY})`);
    });
  }

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
    
    // Draw features in painter's order
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
}
```

### 3. src/input/TouchInput.ts (Simplified version for now)
```ts
import Phaser from 'phaser';

export class TouchInputManager {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private lastTouchX: number = 0;
  private lastTouchY: number = 0;
  private touchCount: number = 0;
  private minPinchDistance: number = 50;

  constructor(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera) {
    this.scene = scene;
    this.camera = camera;
    
    // Track touch events
    this.scene.input.on('pointerdown', (pointer) => {
      this.touchCount++;
      this.lastTouchX = pointer.worldX;
      this.lastTouchY = pointer.worldY;
      
      if (this.touchCount === 1) {
        setTimeout(() => {
          if (this.touchCount === 1 && !this.isPanning()) {
            this.handleTap(pointer);
          }
        }, 200);
      }
    });

    this.scene.input.on('pointermove', (pointer) => {
      if (this.touchCount >= 2) {
        this.handlePinch(pointer);
      } else if (this.touchCount === 1 && !this.isPanning()) {
        this.handlePan(pointer);
      }
    });

    this.scene.input.on('pointerup', () => {
      this.touchCount = Math.max(0, this.touchCount - 1);
      
      if (this.touchCount === 0 && !this.isPanning()) {
        const timeSinceTap = Date.now() - (this.lastTapTime || 0);
        if (timeSinceTap < 300) {
          this.handleDoubleTap();
        } else {
          this.handleTap(this.scene.input.activePointer!);
        }
      }
    });
    
    this.lastTapTime = 0;
  }

  private handlePan(pointer: Phaser.Input.Pointer): void {
    const delta = {
      x: pointer.worldX - this.lastTouchX,
      y: pointer.worldY - this.lastTouchY
    };
    
    this.camera.scroll(delta.x * 0.5, -delta.y * 0.5);
    
    this.lastTouchX = pointer.worldX;
    this.lastTouchY = pointer.worldY;
  }

  private handlePinch(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.worldX - this.lastTouchX;
    const dy = pointer.worldY - this.lastTouchY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > this.minPinchDistance) {
      const zoomDirection = distance > 0 ? 1 : -1;
      const zoomAmount = 0.05 * (zoomDirection === 1 ? 1 : -1);
      
      this.camera.scale(this.camera.scale + zoomAmount, { x: pointer.worldX, y: pointer.worldY });
      
      const clampedScale = Math.max(0.5, Math.min(2.0, this.camera.scale));
      this.camera.scale(clampedScale);
    }
    
    this.lastTouchX = pointer.worldX;
    this.lastTouchY = pointer.worldY;
  }

  private handleTap(pointer: Phaser.Input.Pointer): void {
    const isoPos = this.screenToIso(pointer.worldX, pointer.worldY);
    
    this.scene.events.emit('tap', isoPos.x, isoPos.y, pointer.worldX, pointer.worldY);
  }

  private handleDoubleTap(): void {
    const centerX = this.camera.scrollX + (this.camera.width / 2) * this.camera.scale;
    const centerY = this.camera.scrollY + (this.camera.height / 2) * this.camera.scale;
    
    const isoPos = this.screenToIso(centerX, centerY);
    this.scene.events.emit('double-tap', isoPos.x, isoPos.y);
  }

  private screenToIso(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenY - screenX) / (TILE_HEIGHT / 2),
      y: (screenY + screenX) / (TILE_HEIGHT / 2)
    };
  }

  private isPanning(): boolean {
    return this.touchCount === 1 && this.lastPanDistance > 0;
  }

  private get lastPanDistance(): number {
    return 0;
  }
}
```

## Testing
Run `npm run dev` and "New Game":
- Drag with one finger → camera should pan smoothly
- Pinch with two fingers → camera should zoom between 0.5x and 2.0x
- Tap → should emit tap event (check console)
- Double-tap → should emit double-tap event

## Next Step
Once camera control works, move to **STEP06** for A* pathfinding with road costs.