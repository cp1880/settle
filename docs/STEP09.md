# STEP 09: Content Data Files (Resources, Buildings, Jobs)

## Goal
Create the data-driven content catalog with typed constants for resources, buildings, and jobs.

## Acceptance Criteria
- `resources.ts` exports resource definitions
- `buildings.ts` exports building definitions  
- `jobs.ts` exports job specifications
- Startup validator checks consistency between files

## Files to Create

### 1. src/content/resources.ts (Resource catalog)
```ts
// Resource definitions - data-driven content
export interface ResourceDef {
  id: string;
  name: string;
  description?: string;
  // Optional: visual properties (for later art implementation)
  color?: string;
  icon?: string;
}

// Export typed constants for all resources
export const RESOURCES: Record<string, ResourceDef> = {
  tree: {
    id: 'tree',
    name: 'Tree',
    description: 'Raw timber from forest tiles'
  },
  log: {
    id: 'log',
    name: 'Log',
    description: 'Processed logs from lumberjacks'
  },
  wood: {
    id: 'wood',
    name: 'Wood',
    description: 'Finished wood product at sawmills'
  },
  stone: {
    id: 'stone',
    name: 'Stone',
    description: 'Quarried stone blocks'
  },
  coal: {
    id: 'coal',
    name: 'Coal',
    description: 'Mined coal for fuel and smelting'
  },
  iron_ore: {
    id: 'iron_ore',
    name: 'Iron Ore',
    description: 'Mined iron ore for weaponsmithing'
  },
  sword: {
    id: 'sword',
    name: 'Sword',
    description: 'Weapon crafted at smithies'
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    description: 'Defense item crafted at smithies'
  },
  villager: {
    id: 'villager',
    name: 'Villager',
    description: 'Basic worker unit (consumes a bed)'
  },
  soldier: {
    id: 'soldier',
    name: 'Soldier',
    description: 'Combat unit trained at barracks'
  }
};

// Helper to get resource by ID safely
export function getResource(id: string): ResourceDef | undefined {
  return RESOURCES[id];
}

// Get all resource IDs as an array
export const RESOURCE_IDS = Object.keys(RESOURCES) as string[];
```

### 2. src/content/buildings.ts (Building catalog)
```ts
import { ResourceDef } from './resources';

// Building definitions - data-driven content
export interface BuildingDef {
  id: string;
  name: string;
  description?: string;
  size: { w: number; h: number }; // Grid tiles (e.g., 2x2)
  cost: Array<{ res: string; qty: number }>; // Resources consumed to build
  buildMs: number; // Construction time in milliseconds
  
  // Optional capabilities
  capacity?: number; // For storehouses, houses (beds), etc.
  trains?: { 
    input: string; 
    output: string; 
    timeMs: number 
  }; // For barracks training
  attacks?: { 
    rangeTiles: number; 
    damage: number; 
    fireMs: number 
  }; // For turrets
}

// Export typed constants for all buildings
export const BUILDINGS: Record<string, BuildingDef> = {
  town_hall: {
    id: 'town_hall',
    name: 'Town Hall',
    description: 'Spawns villagers and provides beds',
    size: { w: 2, h: 2 },
    cost: [
      { res: 'wood', qty: 50 }
    ],
    buildMs: 30000, // 30 seconds
    capacity: 4 // Beds for villagers
  },
  storehouse: {
    id: 'storehouse',
    name: 'Storehouse',
    description: 'Stores resources and supplies workers',
    size: { w: 2, h: 2 },
    cost: [
      { res: 'wood', qty: 30 }
    ],
    buildMs: 15000, // 15 seconds
    capacity: 10000 // Storage capacity
  },
  sawmill: {
    id: 'sawmill',
    name: 'Sawmill',
    description: 'Processes logs into wood',
    size: { w: 2, h: 2 },
    cost: [
      { res: 'wood', qty: 40 }
    ],
    buildMs: 20000, // 20 seconds
    trains: undefined // No training capability
  },
  quarry: {
    id: 'quarry',
    name: 'Quarry',
    description: 'Processes stone into usable blocks',
    size: { w: 2, h: 2 },
    cost: [
      { res: 'stone', qty: 40 }
    ],
    buildMs: 25000, // 25 seconds
    trains: undefined
  },
  smithy: {
    id: 'smithy',
    name: 'Smithy',
    description: 'Crafts weapons from metal ores',
    size: { w: 2, h: 2 },
    cost: [
      { res: 'wood', qty: 30 }
    ],
    buildMs: 25000, // 25 seconds
    trains: undefined
  },
  barracks: {
    id: 'barracks',
    name: 'Barracks',
    description: 'Trains villagers into soldiers',
    size: { w: 2, h: 2 },
    cost: [
      { res: 'wood', qty: 50 }
    ],
    buildMs: 30000, // 30 seconds
    trains: {
      input: 'villager',
      output: 'soldier',
      timeMs: 60000 // 1 minute training time
    }
  },
  house: {
    id: 'house',
    name: 'House',
    description: 'Provides beds for villagers',
    size: { w: 2, h: 2 },
    cost: [
      { res: 'wood', qty: 20 }
    ],
    buildMs: 10000, // 10 seconds
    capacity: 2 // Beds for villagers
  },
  wall: {
    id: 'wall',
    name: 'Wall',
    description: 'Blocks movement (requires gate to pass)',
    size: { w: 1, h: 1 },
    cost: [
      { res: 'stone', qty: 20 }
    ],
    buildMs: 5000 // 5 seconds
  },
  gate: {
    id: 'gate',
    name: 'Gate',
    description: 'Walkable wall tile for passage',
    size: { w: 1, h: 1 },
    cost: [
      { res: 'stone', qty: 25 }
    ],
    buildMs: 6000 // 6 seconds
  },
  turret: {
    id: 'turret',
    name: 'Turret',
    description: 'Automated defense unit',
    size: { w: 1, h: 1 },
    cost: [
      { res: 'wood', qty: 30 },
      { res: 'stone', qty: 20 }
    ],
    buildMs: 20000, // 20 seconds
    attacks: {
      rangeTiles: 4,
      damage: 10,
      fireMs: 500 // Fires every 0.5 seconds
    }
  }
};

// Helper to get building by ID safely
export function getBuilding(id: string): BuildingDef | undefined {
  return BUILDINGS[id];
}

// Get all building IDs as an array
export const BUILDING_IDS = Object.keys(BUILDINGS) as string[];
```

### 3. src/content/jobs.ts (Job specifications)
```ts
import { ResourceDef } from './resources';
import { BuildingDef } from './buildings';

// Job specification - data-driven worker types
export interface JobSpec {
  id: string;
  name: string;
  description?: string;
  
  // Inputs (what the job consumes)
  inputs: Array<{ 
    res: string; 
    from: 'terrain' | 'store'; 
    qty: number 
  }>;
  
  // Outputs (what the job produces)
  outputs: Array<{ 
    res: string; 
    to: 'store' | 'building'; 
    qty: number 
  }>;
  
  workMs: number; // Duration of one work cycle in milliseconds
  
  // Optional: where the work is performed
  atBuilding?: string; // Building ID (e.g., 'sawmill', 'smithy')
}

// Export typed constants for all jobs
export const JOBS: Record<string, JobSpec> = {
  lumberjack: {
    id: 'lumberjack',
    name: 'Lumberjack',
    description: 'Chops down trees and collects logs',
    inputs: [
      { res: 'tree', from: 'terrain', qty: 1 }
    ],
    outputs: [
      { res: 'log', to: 'store', qty: 2 } // 2 logs per tree
    ],
    workMs: 5000, // 5 seconds per tree
    atBuilding: undefined
  },
  
  sawyer: {
    id: 'sawyer',
    name: 'Sawyer',
    description: 'Processes logs into wood at sawmills',
    inputs: [
      { res: 'log', from: 'store', qty: 2 } // Needs 2 logs to make 1 wood
    ],
    outputs: [
      { res: 'wood', to: 'store', qty: 1 }
    ],
    workMs: 3000, // 3 seconds per batch
    atBuilding: 'sawmill'
  },
  
  stone_miner: {
    id: 'stone_miner',
    name: 'Stone Miner',
    description: 'Mines and processes stone',
    inputs: [
      { res: 'rocky', from: 'terrain', qty: 1 } // Mines rocky terrain
    ],
    outputs: [
      { res: 'stone', to: 'store', qty: 3 }
    ],
    workMs: 6000, // 6 seconds per batch
    atBuilding: undefined
  },
  
  coal_miner: {
    id: 'coal_miner',
    name: 'Coal Miner',
    description: 'Mines and processes coal',
    inputs: [
      { res: 'rocky', from: 'terrain', qty: 1 } // Mines rocky terrain (with coal seams)
    ],
    outputs: [
      { res: 'coal', to: 'store', qty: 2 }
    ],
    workMs: 6000, // 6 seconds per batch
    atBuilding: undefined
  },
  
  iron_miner: {
    id: 'iron_miner',
    name: 'Iron Miner',
    description: 'Mines and processes iron ore',
    inputs: [
      { res: 'rocky', from: 'terrain', qty: 1 } // Mines rocky terrain (with iron seams)
    ],
    outputs: [
      { res: 'iron_ore', to: 'store', qty: 2 }
    ],
    workMs: 7000, // 7 seconds per batch
    atBuilding: undefined
  },
  
  weaponsmith: {
    id: 'weaponsmith',
    name: 'Weaponsmith',
    description: 'Crafts swords and shields from metal ores',
    inputs: [
      { res: 'coal', from: 'store', qty: 2 },
      { res: 'iron_ore', from: 'store', qty: 3 }
    ],
    outputs: [
      { res: 'sword', to: 'building', qty: 1, atBuilding: 'smithy' },
      { res: 'shield', to: 'building', qty: 2, atBuilding: 'smithy' } // Can make shields too
    ],
    workMs: 8000, // 8 seconds per batch
    atBuilding: 'smithy'
  },
  
  builder: {
    id: 'builder',
    name: 'Builder',
    description: 'Constructs buildings from resource stores',
    inputs: [
      // Builder takes resources from storehouse and builds
      // The specific building is determined by build order
    ],
    outputs: [],
    workMs: 0, // Variable based on building being built
    atBuilding: undefined
  },
  
  guard: {
    id: 'guard',
    name: 'Guard',
    description: 'Soldier with sword and shield for defense',
    inputs: [
      { res: 'sword', from: 'store', qty: 1 },
      { res: 'shield', from: 'store', qty: 1 }
    ],
    outputs: [],
    workMs: 0, // Guard doesn't "work", just patrols/defends
    atBuilding: undefined
  }
};

// Helper to get job by ID safely
export function getJob(id: string): JobSpec | undefined {
  return JOBS[id];
}

// Get all job IDs as an array
export const JOB_IDS = Object.keys(JOBS) as string[];
```

### 4. src/core/ContentValidator.ts (Startup validator)
```ts
import { RESOURCE_IDS, RESOURCES } from '../content/resources';
import { BUILDING_IDS, BUILDINGS } from '../content/buildings';
import { JOB_IDS, JOBS } from '../content/jobs';

// Content validator - checks consistency at startup
export class ContentValidator {
  private errors: string[] = [];
  
  validate(): void {
    this.validateResources();
    this.validateBuildings();
    this.validateJobs();
    
    if (this.errors.length > 0) {
      console.error('Content validation failed:', this.errors);
      throw new Error('Failed content validation');
    }
    
    console.log('Content validation passed!');
  }

  private validateResources(): void {
    // Check that all resources referenced in buildings exist
    for (const [buildingId, building] of Object.entries(BUILDINGS)) {
      for (const cost of building.cost) {
        if (!RESOURCES[cost.res]) {
          this.errors.push(`Building ${buildingId} references unknown resource: ${cost.res}`);
        }
      }
    }

    // Check that all resources referenced in jobs exist
    for (const [jobId, job] of Object.entries(JOBS)) {
      for (const input of job.inputs) {
        if (!RESOURCES[input.res]) {
          this.errors.push(`Job ${jobId} references unknown resource: ${input.res}`);
        }
      }

      for (const output of job.outputs) {
        if (!RESOURCES[output.res]) {
          this.errors.push(`Job ${jobId} references unknown resource: ${output.res}`);
        }
      }
    }
  }

  private validateBuildings(): void {
    // Check that all buildings have valid sizes
    for (const [buildingId, building] of Object.entries(BUILDINGS)) {
      if (building.size.w <= 0 || building.size.h <= 0) {
        this.errors.push(`Building ${buildingId} has invalid size: ${JSON.stringify(building.size)}`);
      }

      // Check that all costs reference valid resources
      for (const cost of building.cost) {
        if (!RESOURCES[cost.res]) {
          this.errors.push(`Building ${buildingId} references unknown resource in cost: ${cost.res}`);
        }
      }
    }
  }

  private validateJobs(): void {
    // Check that all jobs have valid inputs/outputs
    for (const [jobId, job] of Object.entries(JOBS)) {
      if (job.inputs.length === 0 && job.outputs.length === 0) {
        this.errors.push(`Job ${jobId} has no inputs or outputs defined`);
      }

      // Check that atBuilding references a valid building when specified
      if (job.atBuilding && !BUILDINGS[job.atBuilding]) {
        this.errors.push(`Job ${jobId} references unknown building: ${job.atBuilding}`);
      }
    }
  }

  // Get validation errors (for debugging)
  getErrors(): string[] {
    return this.errors;
  }
}

// Create and run validator at startup
export function validateContent(): void {
  const validator = new ContentValidator();
  validator.validate();
}
```

### 5. src/main.ts (Add content validation)
```ts
import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene';
import GameScene from './scenes/GameScene';
import { validateContent } from './core/ContentValidator';

// Validate content at startup
validateContent();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: document.getElementById('game')!,
  width: window.innerWidth,
  height: window.innerHeight,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [MenuScene, GameScene],
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  }
};

const game = new Phaser.Game(config);
```

## Testing
Run `npm run dev` and "New Game":
- Console should show "Content validation passed!"
- All resources, buildings, and jobs are accessible via their IDs
- No runtime errors from undefined references

## Next Step
Once content data is validated, move to **STEP10** for the build mode UI.