# STEP 01: Scaffold Project (Vite + TS + Phaser + Capacitor)

## Goal
Set up the base project structure with Vite, TypeScript, Phaser 3, and Capacitor for iOS/Android mobile support.

## Acceptance Criteria
- `package.json` has all dependencies installed
- `vite.config.ts` configured for dev server
- `index.html` entry point exists
- `src/main.ts` bootstraps Phaser game
- `public/` folder with placeholder assets
- Capacitor config ready (even if not yet wrapped)

## Files to Create

### 1. package.json
```json
{
  "name": "isometric-settlers",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "phaser": "^3.70.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^6.0.0",
    "@capacitor/core": "^6.0.0",
    "typescript": "~5.4.0",
    "vite": "^5.4.0"
  }
}
```

### 2. vite.config.ts
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    outDir: 'dist'
  },
  server: {
    port: 3000,
    open: true
  }
});
```

### 3. tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

### 4. index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Isometric Settlers</title>
</head>
<body>
  <div id="game"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### 5. src/main.ts (Phaser bootstrap)
```ts
import Phaser from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: document.getElementById('game')!,
  width: window.innerWidth,
  height: window.innerHeight,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene],
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  }
};

const game = new Phaser.Game(config);
```

### 6. src/BootScene.ts (Placeholder)
```ts
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // Placeholder - will be replaced by MenuScene in Step 2
    this.add.text(10, 10, 'Loading...');
  }
}
```

### 7. src/MenuScene.ts (Preview for Step 2)
```ts
import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    // Placeholder - will be implemented in Step 2
    this.add.text(10, 10, 'New Game');
  }
}
```

### 8. src/iso.ts (Isometric math utilities)
```ts
// Isometric projection: sx = (x-y)*W/2, sy = (x+y)*H/2
export const isoToScreen = (x: number, y: number, width: number, height: number): { x: number; y: number } => ({
  x: (x - y) * width / 2,
  y: (x + y) * height / 2
});

export const screenToIso = (sx: number, sy: number, width: number, height: number): { x: number; y: number } => ({
  x: (sy - sx) / (height / 2),
  y: (sy + sx) / (height / 2)
});
```

### 9. src/constants.ts (Game constants)
```ts
export const TILE_WIDTH = 128; // px, for 2:1 isometric ratio
export const TILE_HEIGHT = 64; // px
export const GRID_SIZE_X = 32; // tiles
export const GRID_SIZE_Y = 32; // tiles
```

## Commands to Run
```bash
npm install
npm run dev
```

## Next Step
Once the grid renders, move to **STEP02** for menu pages.