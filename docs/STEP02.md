# STEP 02: Menu Pages (New Game / Exit)

## Goal
Create the main menu with "New Game" and "Exit" options, plus a game-over screen.

## Acceptance Criteria
- Main menu shows "New Game" button
- Tapping "New Game" transitions to `GameScene`
- Tapping "Exit" stops the game (or shows confirmation)
- Game over screen with restart option

## Files to Create/Modify

### 1. src/scenes/MenuScene.ts (Full implementation)
```ts
import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  private newGameBtn: Phaser.GameObjects.Text;
  private exitBtn: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    // Background
    this.add.rectangle(0, 0, 1280, 720, 0x3a5f4b);
    
    // Title
    const title = this.add.text(640, 100, 'Isometric Settlers', {
      fontSize: '64px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // New Game button
    this.newGameBtn = this.add.text(640, 300, 'New Game', {
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Exit button
    this.exitBtn = this.add.text(640, 400, 'Exit', {
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Button events
    this.newGameBtn.on('pointerdown', () => {
      this.scene.start('GameScene');
    });

    this.exitBtn.on('pointerdown', () => {
      if (confirm('Exit to main menu?')) {
        this.scene.stop();
        this.scene.start('MenuScene');
      }
    });
  }
}
```

### 2. src/scenes/GameScene.ts (New Game entry point)
```ts
import Phaser from 'phaser';
import { isoToScreen, screenToIso } from '../iso';
import { TILE_WIDTH, TILE_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';

export class GameScene extends Phaser.Scene {
  private grid: Phaser.Tilemaps.Grid;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private isoGridGraphics: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Load JSON map (placeholder for now)
    const mapData = this.loadMap();
    
    // Create tilemap grid
    this.grid = new Phaser.Tilemaps.Grid(this, GRID_SIZE_X, GRID_SIZE_Y);
    
    // Initialize tiles from map data
    for (let x = 0; x < GRID_SIZE_X; x++) {
      for (let y = 0; y < GRID_SIZE_Y; y++) {
        this.grid.setTile(x, y, mapData[x][y].terrain);
      }
    }

    // Create isometric camera
    this.camera = new Phaser.Cameras.Scene2D.Camera(this, TILE_WIDTH * 2, TILE_HEIGHT * 2);
    
    // Draw isometric grid
    this.isoGridGraphics = this.add.graphics();
    this.drawIsoGrid(mapData);
  }

  private loadMap(): string[][] {
    // Placeholder: simple grass terrain
    return Array(GRID_SIZE_X).fill(null)
      .map(() => Array(GRID_SIZE_Y).fill({ terrain: 'grass' as const }));
  }

  private drawIsoGrid(mapData: any[]): void {
    this.isoGridGraphics.clear();
    
    for (let x = 0; x < GRID_SIZE_X; x++) {
      for (let y = 0; y < GRID_SIZE_Y; y++) {
        const screenPos = isoToScreen(x, y, TILE_WIDTH, TILE_HEIGHT);
        
        // Draw tile based on terrain type
        this.isoGridGraphics.fillStyle(0x4a7c59); // grass color
        this.isoGridGraphics.fillRect(screenPos.x - 64, screenPos.y - 32, 128, 64);
      }
    }

    this.isoGridGraphics.draw();
  }
}
```

### 3. Update src/main.ts (Add GameScene to scene list)
```ts
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: document.getElementById('game')!,
  width: window.innerWidth,
  height: window.innerHeight,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [MenuScene, GameScene], // Add MenuScene first
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  }
};

const game = new Phaser.Game(config);
```

### 4. src/iso.ts (Move from STEP01 to proper location)
```ts
// See STEP01 for full implementation
export const isoToScreen = (x: number, y: number, width: number, height: number): { x: number; y: number } => ({
  x: (x - y) * width / 2,
  y: (x + y) * height / 2
});

export const screenToIso = (sx: number, sy: number, width: number, height: number): { x: number; y: number } => ({
  x: (sy - sx) / (height / 2),
  y: (sy + sx) / (height / 2)
});
```

### 5. src/constants.ts (Move from STEP01 to proper location)
```ts
export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;
export const GRID_SIZE_X = 32;
export const GRID_SIZE_Y = 32;
```

## Testing
Run `npm run dev` and:
- Tap "New Game" → should see isometric grid
- Tap "Exit" → should return to menu

## Next Step
Once the basic grid renders, move to **STEP03** for terrain variety.