import { TileData, TerrainType, FeatureType } from '../types';
import { TERRAIN_COSTS, ROAD_COST } from '../constants';

// ============================================================================
// MAP GENERATION CONSTANTS & RESOURCE BALANCING
// ============================================================================

/** Starting resource unit capacity per individual resource node deposit */
export const NODE_RESOURCE_CAPACITY = {
  ROCK_OUTCROP: 20, // Stone units per rock node
  IRON_SEAM: 20,    // Iron Ore units per seam
  COAL_SEAM: 20,    // Coal units per seam
  TREE: 4,          // Timber logs per tree
};

/** Noise thresholds & spawn probabilities for each scenario preset */
export const MAP_GENERATION_CONFIG = {
  // Preset 1: 'valley' (River Valley)
  VALLEY: {
    // Water threshold
    WATER_ELEVATION_MAX: 0.30,
    LAKE_MOISTURE_MIN: 0.72,
    LAKE_ELEVATION_MAX: 0.42,
    DEEP_WATER_ELEVATION_MAX: 0.22,

    // Rocky Mountains / Ridge threshold
    ROCKY_ELEVATION_MIN: 0.74,
    // Mineral distribution within rocky tiles:
    ROCKY_ROCK_CHANCE: 0.20, // 40% stone rock
    ROCKY_IRON_CHANCE: 0.10, // 30% iron seam
    ROCKY_COAL_CHANCE: 0.10, // 30% coal seam

    // Forest biome threshold
    FOREST_MOISTURE_MIN: 0.58,
    FOREST_TREE_CHANCE: 0.65,
    FOREST_ROCK_CHANCE: 0.015,

    // Grassy plains biome
    PLAINS_TREE_CHANCE: 0.10,
    PLAINS_ROCK_CHANCE: 0.015,
    PLAINS_COAL_ELEVATION_MIN: 0.58,
    PLAINS_COAL_CHANCE: 0.05,
  },

  // Preset 2: 'mountains' (Mountain Quarry Outpost)
  MOUNTAINS: {
    // Water threshold
    WATER_ELEVATION_MAX: 0.26,

    // Rocky peaks threshold
    ROCKY_ELEVATION_MIN: 0.60,
    // Mineral distribution within rocky tiles:
    ROCKY_ROCK_CHANCE: 0.45, // 45% stone rock
    ROCKY_IRON_CHANCE: 0.30, // 30% iron seam
    ROCKY_COAL_CHANCE: 0.25, // 25% coal seam

    // Forest slope threshold
    FOREST_MOISTURE_MIN: 0.55,
    FOREST_TREE_CHANCE: 1.00,

    // Valley plains biome
    PLAINS_ROCK_CHANCE: 0.03,
    PLAINS_TREE_CHANCE: 0.15,
  },

  // Preset 3: 'forest' (Dense Timber Forest)
  FOREST: {
    // Water threshold
    WATER_ELEVATION_MAX: 0.24,
    SWAMP_MOISTURE_MIN: 0.82,

    // Rocky outcrop threshold
    ROCKY_ELEVATION_MIN: 0.76,
    ROCKY_ROCK_CHANCE: 0.50, // 50% stone rock
    ROCKY_IRON_CHANCE: 0.50, // 50% iron seam

    // Dense Forest biome threshold
    FOREST_MOISTURE_MIN: 0.28,
    FOREST_TREE_CHANCE: 0.85,
    FOREST_ROCK_CHANCE: 0.012,

    // Grassy clearing biome
    PLAINS_TREE_CHANCE: 0.35,
    PLAINS_ROCK_CHANCE: 0.012,
  },

  // Starter center clearing radius
  CENTER_CLEARING_RADIUS: 5.5,
  CENTER_TREE_CHANCE: 0.22,
};

export class Grid {
  public readonly width: number;
  public readonly height: number;
  private tiles: TileData[][];

  constructor(width: number, height: number, initialTiles?: TileData[][]) {
    this.width = width;
    this.height = height;

    if (initialTiles && initialTiles.length === height && initialTiles[0]?.length === width) {
      this.tiles = initialTiles;
    } else {
      this.tiles = [];
      for (let y = 0; y < height; y++) {
        const row: TileData[] = [];
        for (let x = 0; x < width; x++) {
          row.push({ terrain: 'grass' });
        }
        this.tiles.push(row);
      }
    }
  }

  getTile(x: number, y: number): TileData | undefined {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.tiles[y][x];
    }
    return undefined;
  }

  setTile(x: number, y: number, data: Partial<TileData>): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.tiles[y][x] = { ...this.tiles[y][x], ...data };
    }
  }

  getTiles(): TileData[][] {
    return this.tiles;
  }

  getCost(x: number, y: number): number {
    const tile = this.getTile(x, y);
    if (!tile) return Infinity;

    // Road is fastest
    if (tile.road) return ROAD_COST;

    // Wooden Bridge makes water passable and fast
    if (tile.bridge) return 1.2;

    // Water is blocked
    if (tile.terrain === 'water') return Infinity;

    // Terrain cost
    return TERRAIN_COSTS[tile.terrain] ?? 3;
  }

  isWalkable(x: number, y: number): boolean {
    const cost = this.getCost(x, y);
    return cost < Infinity;
  }

  getNeighbors(x: number, y: number): [number, number][] {
    const neighbors: [number, number][] = [];
    const dirs = [
      [0, -1], // N
      [1, 0],  // E
      [0, 1],  // S
      [-1, 0], // W
    ];

    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
        neighbors.push([nx, ny]);
      }
    }
    return neighbors;
  }

  /**
   * Checks if an area is clear to place a building of size w*h
   */
  canPlaceBuilding(x: number, y: number, w: number, h: number, allowedTerrains?: TerrainType[]): boolean {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        const tile = this.getTile(tx, ty);
        if (!tile) return false;
        if (allowedTerrains && allowedTerrains.length > 0) {
          if (!allowedTerrains.includes(tile.terrain)) return false;
        } else {
          if (tile.terrain === 'water') return false;
        }
        if (tile.buildingId) return false;
      }
    }
    return true;
  }

  /**
   * Procedural terrain generator supporting different biomes/scenarios
   */
  static generateScenario(
    width: number,
    height: number,
    preset: 'valley' | 'mountains' | 'forest' = 'valley'
  ): Grid {
    const grid = new Grid(width, height);

    // Simple pseudo-random coherent noise
    const seed = Math.random() * 10000;
    const noise = (nx: number, ny: number) => {
      const v = Math.sin(nx * 12.9898 + ny * 78.233 + seed) * 43758.5453;
      return v - Math.floor(v);
    };

    const smoothNoise = (x: number, y: number, scale: number) => {
      const nx = x / scale;
      const ny = y / scale;
      const x0 = Math.floor(nx);
      const y0 = Math.floor(ny);
      const fx = nx - x0;
      const fy = ny - y0;
      const s00 = noise(x0, y0);
      const s10 = noise(x0 + 1, y0);
      const s01 = noise(x0, y0 + 1);
      const s11 = noise(x0 + 1, y0 + 1);
      const ix0 = s00 * (1 - fx) + s10 * fx;
      const ix1 = s01 * (1 - fx) + s11 * fx;
      return ix0 * (1 - fy) + ix1 * fy;
    };

    // Center clearance for Town Hall
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);

    // Meandering river parameter
    const riverOffset = (seed % 100);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const distFromCenter = Math.hypot(x - centerX, y - centerY);

        // Multi-frequency noise scaled for large 72x72 maps
        const nElevation =
          smoothNoise(x, y, 18) * 0.55 +
          smoothNoise(x, y, 9) * 0.30 +
          smoothNoise(x, y, 4) * 0.15;

        const nMoisture =
          smoothNoise(x + 100, y + 100, 18) * 0.7 +
          smoothNoise(x + 100, y + 100, 6) * 0.3;

        // River formula: curving path across the map
        const riverCurve = Math.sin((y / 10) + riverOffset) * 6.5 + Math.cos((x / 12) + riverOffset) * 3;
        const riverDist = Math.abs(x - (width * 0.28 + riverCurve));
        const isRiver = riverDist < 1.6 && distFromCenter > 5.0;

        let terrain: TerrainType = 'grass';
        let feature: FeatureType | undefined = undefined;

        // Keep starting area mostly grassy and flat for Town Hall
        if (distFromCenter < MAP_GENERATION_CONFIG.CENTER_CLEARING_RADIUS) {
          terrain = 'grass';
          if (distFromCenter > 3.2 && Math.random() < MAP_GENERATION_CONFIG.CENTER_TREE_CHANCE) {
            feature = 'tree';
          }
        } else if (isRiver) {
          // Continuous river ribbon
          terrain = 'water';
          feature = riverDist < 0.6 ? 'deep_water' : 'shallow_water';
        } else {
          if (preset === 'valley') {
            const cfg = MAP_GENERATION_CONFIG.VALLEY;
            // River Valley: Lush plains, rivers/lakes, gentle rock ridges and forest groves
            if (nElevation < cfg.WATER_ELEVATION_MAX || (nMoisture > cfg.LAKE_MOISTURE_MIN && nElevation < cfg.LAKE_ELEVATION_MAX)) {
              terrain = 'water';
              feature = nElevation < cfg.DEEP_WATER_ELEVATION_MAX ? 'deep_water' : 'shallow_water';
            } else if (nElevation > cfg.ROCKY_ELEVATION_MIN) {
              terrain = 'rocky';
              const r = Math.random();
              if (r < cfg.ROCKY_ROCK_CHANCE) feature = 'rock_outcrop';
              else if (r < cfg.ROCKY_ROCK_CHANCE + cfg.ROCKY_IRON_CHANCE) feature = 'iron_seam';
              else feature = 'coal_seam';
            } else if (nMoisture > cfg.FOREST_MOISTURE_MIN) {
              terrain = 'forest';
              if (Math.random() < cfg.FOREST_TREE_CHANCE) feature = 'tree';
              if (Math.random() < cfg.FOREST_ROCK_CHANCE) feature = 'rock_outcrop';
            } else {
              terrain = 'grass';
              if (Math.random() < cfg.PLAINS_TREE_CHANCE) feature = 'tree';
              if (Math.random() < cfg.PLAINS_ROCK_CHANCE) feature = 'rock_outcrop';
              if (nElevation > cfg.PLAINS_COAL_ELEVATION_MIN && Math.random() < cfg.PLAINS_COAL_CHANCE) feature = 'coal_seam';
            }
          } else if (preset === 'mountains') {
            const cfg = MAP_GENERATION_CONFIG.MOUNTAINS;
            // Mountain Quarry Outpost: Scattered rocky ridges, mineral veins, mountain lakes
            if (nElevation < cfg.WATER_ELEVATION_MAX) {
              terrain = 'water';
              feature = 'shallow_water';
            } else if (nElevation > cfg.ROCKY_ELEVATION_MIN) {
              terrain = 'rocky';
              const r = Math.random();
              if (r < cfg.ROCKY_ROCK_CHANCE) feature = 'rock_outcrop';
              else if (r < cfg.ROCKY_ROCK_CHANCE + cfg.ROCKY_IRON_CHANCE) feature = 'iron_seam';
              else feature = 'coal_seam';
            } else if (nMoisture > cfg.FOREST_MOISTURE_MIN) {
              terrain = 'forest';
              if (Math.random() < cfg.FOREST_TREE_CHANCE) feature = 'tree';
            } else {
              terrain = 'grass';
              if (Math.random() < cfg.PLAINS_ROCK_CHANCE) feature = 'rock_outcrop';
              if (Math.random() < cfg.PLAINS_TREE_CHANCE) feature = 'tree';
            }
          } else {
            const cfg = MAP_GENERATION_CONFIG.FOREST;
            // Dense Timber Forest: Endless wood, streams, rare mossy stones
            if (nElevation < cfg.WATER_ELEVATION_MAX || nMoisture > cfg.SWAMP_MOISTURE_MIN) {
              terrain = 'water';
              feature = 'shallow_water';
            } else if (nElevation > cfg.ROCKY_ELEVATION_MIN) {
              terrain = 'rocky';
              feature = Math.random() < cfg.ROCKY_ROCK_CHANCE ? 'rock_outcrop' : 'iron_seam';
            } else if (nMoisture > cfg.FOREST_MOISTURE_MIN) {
              terrain = 'forest';
              if (Math.random() < cfg.FOREST_TREE_CHANCE) feature = 'tree';
              if (Math.random() < cfg.FOREST_ROCK_CHANCE) feature = 'rock_outcrop';
            } else {
              terrain = 'grass';
              if (Math.random() < cfg.PLAINS_TREE_CHANCE) feature = 'tree';
              if (Math.random() < cfg.PLAINS_ROCK_CHANCE) feature = 'rock_outcrop';
            }
          }
        }

        let resourceRemaining: number | undefined = undefined;
        let resourceMax: number | undefined = undefined;

        if (feature === 'rock_outcrop' || (terrain === 'rocky' && !feature)) {
          feature = 'rock_outcrop';
          resourceRemaining = NODE_RESOURCE_CAPACITY.ROCK_OUTCROP;
          resourceMax = NODE_RESOURCE_CAPACITY.ROCK_OUTCROP;
        } else if (feature === 'iron_seam') {
          resourceRemaining = NODE_RESOURCE_CAPACITY.IRON_SEAM;
          resourceMax = NODE_RESOURCE_CAPACITY.IRON_SEAM;
        } else if (feature === 'coal_seam') {
          resourceRemaining = NODE_RESOURCE_CAPACITY.COAL_SEAM;
          resourceMax = NODE_RESOURCE_CAPACITY.COAL_SEAM;
        } else if (feature === 'tree') {
          resourceRemaining = NODE_RESOURCE_CAPACITY.TREE;
          resourceMax = NODE_RESOURCE_CAPACITY.TREE;
        }

        grid.setTile(x, y, { terrain, feature, resourceRemaining, resourceMax });
      }
    }

    return grid;
  }
}
