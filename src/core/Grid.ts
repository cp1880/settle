import { TileData, TerrainType, FeatureType } from '../types';
import {
  TERRAIN_COSTS,
  ROAD_COST,
  TILE_WIDTH,
  TILE_HEIGHT,
  ELEVATION_ENABLED,
  ELEVATION_MAX_HEIGHT_PX,
  ELEVATION_MAX_GRADIENT_PX,
} from '../constants';
import { isoToScreen } from '../iso';

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
  public vertexElevations: Float32Array;

  constructor(width: number, height: number, initialTiles?: TileData[][]) {
    this.width = width;
    this.height = height;
    this.vertexElevations = new Float32Array((width + 1) * (height + 1));

    if (initialTiles && initialTiles.length === height && initialTiles[0]?.length === width) {
      this.tiles = initialTiles;
      this.computeVertexElevationsFromTiles();
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

  getVertexElevation(vx: number, vy: number): number {
    if (!ELEVATION_ENABLED) return 0;
    if (vx < 0) vx = 0;
    if (vx > this.width) vx = this.width;
    if (vy < 0) vy = 0;
    if (vy > this.height) vy = this.height;
    return this.vertexElevations[vy * (this.width + 1) + vx] || 0;
  }

  setVertexElevation(vx: number, vy: number, val: number): void {
    if (vx >= 0 && vx <= this.width && vy >= 0 && vy <= this.height) {
      this.vertexElevations[vy * (this.width + 1) + vx] = val;
    }
  }

  /**
   * Checks if a grid vertex touches any water tile.
   */
  isWaterVertex(vx: number, vy: number): boolean {
    for (let dy = -1; dy <= 0; dy++) {
      for (let dx = -1; dx <= 0; dx++) {
        const t = this.getTile(vx + dx, vy + dy);
        if (t && t.terrain === 'water') {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Returns the 4 screen coordinate corners of tile (x, y) with vertex elevation applied.
   * Water tiles are guaranteed to be completely level at base height 0.
   */
  getTileCorners(x: number, y: number): {
    top: { x: number; y: number };
    right: { x: number; y: number };
    bottom: { x: number; y: number };
    left: { x: number; y: number };
  } {
    const tile = this.getTile(x, y);
    if (tile && tile.terrain === 'water') {
      return {
        top: isoToScreen(x, y, 0),
        right: isoToScreen(x + 1, y, 0),
        bottom: isoToScreen(x + 1, y + 1, 0),
        left: isoToScreen(x, y + 1, 0),
      };
    }

    const hTop = this.getVertexElevation(x, y);
    const hRight = this.getVertexElevation(x + 1, y);
    const hBottom = this.getVertexElevation(x + 1, y + 1);
    const hLeft = this.getVertexElevation(x, y + 1);

    const top = isoToScreen(x, y, hTop);
    const right = isoToScreen(x + 1, y, hRight);
    const bottom = isoToScreen(x + 1, y + 1, hBottom);
    const left = isoToScreen(x, y + 1, hLeft);

    return { top, right, bottom, left };
  }

  /**
   * Returns the screen position of the center of tile (x, y).
   */
  getTileCenterScreen(x: number, y: number): { x: number; y: number } {
    const corners = this.getTileCorners(x, y);
    return {
      x: (corners.top.x + corners.bottom.x) / 2,
      y: (corners.top.y + corners.right.y + corners.bottom.y + corners.left.y) / 4,
    };
  }

  /**
   * Returns the screen position for continuous grid coordinates (gx, gy),
   * bilinearly interpolating elevation across the 4 corners of the containing tile.
   */
  getContinuousScreenPos(gx: number, gy: number): { x: number; y: number } {
    if (!ELEVATION_ENABLED) {
      return isoToScreen(gx, gy, 0);
    }

    const tx = Math.floor(gx);
    const ty = Math.floor(gy);
    const fx = Math.max(0, Math.min(1, gx - tx));
    const fy = Math.max(0, Math.min(1, gy - ty));

    const h00 = this.getVertexElevation(tx, ty);
    const h10 = this.getVertexElevation(tx + 1, ty);
    const h01 = this.getVertexElevation(tx, ty + 1);
    const h11 = this.getVertexElevation(tx + 1, ty + 1);

    const hTop = h00 * (1 - fx) + h10 * fx;
    const hBot = h01 * (1 - fx) + h11 * fx;
    const h = hTop * (1 - fy) + hBot * fy;

    return isoToScreen(gx, gy, h);
  }

  /**
   * Returns the ground center screen position for a building of size w * h.
   */
  getBuildingCenterScreen(bx: number, by: number, bw: number, bh: number): { x: number; y: number } {
    let sumH = 0;
    let count = 0;
    for (let dy = 0; dy <= bh; dy++) {
      for (let dx = 0; dx <= bw; dx++) {
        sumH += this.getVertexElevation(bx + dx, by + dy);
        count++;
      }
    }
    const avgH = count > 0 ? sumH / count : 0;
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    return isoToScreen(cx, cy, avgH);
  }

  /**
   * Calculates a lighting / shading factor based on 3D terrain slope facing top-left sunlight.
   * Returns a value between -1 (facing away/in shadow) and +1 (facing sun/brightened).
   * Water tiles are flat and return 0.
   */
  getTileSlopeFactor(x: number, y: number): number {
    if (!ELEVATION_ENABLED) return 0;
    const tile = this.getTile(x, y);
    if (tile && tile.terrain === 'water') return 0;

    const hTop = this.getVertexElevation(x, y);
    const hRight = this.getVertexElevation(x + 1, y);
    const hBottom = this.getVertexElevation(x + 1, y + 1);
    const hLeft = this.getVertexElevation(x, y + 1);

    // In 2:1 isometric projection:
    // Screen top is (x, y), Screen right is (x+1, y), Screen bottom is (x+1, y+1), Screen left is (x, y+1).
    // Sunlight comes from top-left (North-West in world / screen space).
    // Slope along North-South diagonal (top to bottom):
    const dNorthSouth = (hTop + hLeft) - (hBottom + hRight);
    // Slope along West-East diagonal (left to right):
    const dWestEast = (hTop + hRight) - (hBottom + hLeft);

    const slope = (dNorthSouth + dWestEast) / (2 * Math.max(1, ELEVATION_MAX_GRADIENT_PX));
    return Math.max(-1, Math.min(1, slope));
  }

  /**
   * Enforces that no adjacent vertices have a vertical step larger than maxGradient.
   * Water vertices are strictly pinned to 0 so all water bodies remain perfectly level.
   */
  enforceMaxGradient(maxGradient: number = ELEVATION_MAX_GRADIENT_PX): void {
    const w = this.width;
    const h = this.height;

    // Identify all water-touching vertices to keep them pinned strictly at 0
    const isWater = new Uint8Array((w + 1) * (h + 1));
    for (let vy = 0; vy <= h; vy++) {
      for (let vx = 0; vx <= w; vx++) {
        if (this.isWaterVertex(vx, vy)) {
          isWater[vy * (w + 1) + vx] = 1;
          this.vertexElevations[vy * (w + 1) + vx] = 0;
        }
      }
    }

    // Bidirectional multi-pass gradient relaxation
    for (let pass = 0; pass < 6; pass++) {
      // Forward pass
      for (let vy = 0; vy <= h; vy++) {
        for (let vx = 0; vx <= w; vx++) {
          const idx = vy * (w + 1) + vx;
          const cur = this.vertexElevations[idx];

          if (vx < w) {
            const rIdx = vy * (w + 1) + (vx + 1);
            if (!isWater[rIdx] && this.vertexElevations[rIdx] > cur + maxGradient) {
              this.vertexElevations[rIdx] = cur + maxGradient;
            }
            if (!isWater[idx] && this.vertexElevations[idx] > this.vertexElevations[rIdx] + maxGradient) {
              this.vertexElevations[idx] = this.vertexElevations[rIdx] + maxGradient;
            }
          }
          if (vy < h) {
            const dIdx = (vy + 1) * (w + 1) + vx;
            if (!isWater[dIdx] && this.vertexElevations[dIdx] > cur + maxGradient) {
              this.vertexElevations[dIdx] = cur + maxGradient;
            }
            if (!isWater[idx] && this.vertexElevations[idx] > this.vertexElevations[dIdx] + maxGradient) {
              this.vertexElevations[idx] = this.vertexElevations[dIdx] + maxGradient;
            }
          }
        }
      }

      // Backward pass for symmetric propagation
      for (let vy = h; vy >= 0; vy--) {
        for (let vx = w; vx >= 0; vx--) {
          const idx = vy * (w + 1) + vx;
          const cur = this.vertexElevations[idx];

          if (vx > 0) {
            const lIdx = vy * (w + 1) + (vx - 1);
            if (!isWater[lIdx] && this.vertexElevations[lIdx] > cur + maxGradient) {
              this.vertexElevations[lIdx] = cur + maxGradient;
            }
            if (!isWater[idx] && this.vertexElevations[idx] > this.vertexElevations[lIdx] + maxGradient) {
              this.vertexElevations[idx] = this.vertexElevations[lIdx] + maxGradient;
            }
          }
          if (vy > 0) {
            const uIdx = (vy - 1) * (w + 1) + vx;
            if (!isWater[uIdx] && this.vertexElevations[uIdx] > cur + maxGradient) {
              this.vertexElevations[uIdx] = cur + maxGradient;
            }
            if (!isWater[idx] && this.vertexElevations[idx] > this.vertexElevations[uIdx] + maxGradient) {
              this.vertexElevations[idx] = this.vertexElevations[uIdx] + maxGradient;
            }
          }
        }
      }
    }

    // Ensure all water vertices remain strictly 0
    for (let vy = 0; vy <= h; vy++) {
      for (let vx = 0; vx <= w; vx++) {
        if (isWater[vy * (w + 1) + vx]) {
          this.vertexElevations[vy * (w + 1) + vx] = 0;
        }
      }
    }
  }

  /**
   * Rebuilds vertex elevations when restoring saved tiles.
   */
  private computeVertexElevationsFromTiles(): void {
    const w = this.width;
    const h = this.height;

    for (let vy = 0; vy <= h; vy++) {
      for (let vx = 0; vx <= w; vx++) {
        if (this.isWaterVertex(vx, vy)) {
          this.setVertexElevation(vx, vy, 0);
          continue;
        }

        let sum = 0;
        let count = 0;

        for (let dy = -1; dy <= 0; dy++) {
          for (let dx = -1; dx <= 0; dx++) {
            const tx = vx + dx;
            const ty = vy + dy;
            const tile = this.getTile(tx, ty);
            if (tile && tile.terrain !== 'water') {
              const elev = tile.elevation !== undefined
                ? tile.elevation
                : (tile.terrain === 'rocky' ? 0.85 : tile.terrain === 'forest' ? 0.55 : 0.35);
              sum += elev * ELEVATION_MAX_HEIGHT_PX;
              count++;
            }
          }
        }

        const val = count > 0 ? sum / count : 0;
        this.setVertexElevation(vx, vy, val);
      }
    }

    this.enforceMaxGradient();
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

        // Assign base elevation based on biome and elevation noise
        let baseElevPx = 0;
        if (terrain === 'water') {
          baseElevPx = 0;
        } else if (terrain === 'rocky') {
          baseElevPx = 54 + Math.max(0, Math.min(1, (nElevation - 0.6) / 0.4)) * 26; // 54px - 80px high peaks
        } else if (terrain === 'forest') {
          baseElevPx = 28 + Math.max(0, Math.min(1, (nElevation - 0.3) / 0.5)) * 24; // 28px - 52px forest hills
        } else {
          baseElevPx = 14 + Math.max(0, Math.min(1, (nElevation - 0.2) / 0.5)) * 20; // 14px - 34px rolling plains
        }

        if (distFromCenter < MAP_GENERATION_CONFIG.CENTER_CLEARING_RADIUS + 2) {
          const blend = Math.max(0, Math.min(1, (distFromCenter - 2) / MAP_GENERATION_CONFIG.CENTER_CLEARING_RADIUS));
          baseElevPx = 16 * (1 - blend) + baseElevPx * blend;
        }

        grid.setTile(x, y, {
          terrain,
          feature,
          resourceRemaining,
          resourceMax,
          elevation: baseElevPx / ELEVATION_MAX_HEIGHT_PX,
        });
      }
    }

    // Generate continuous vertex elevation mesh (vx: 0..width, vy: 0..height)
    for (let vy = 0; vy <= height; vy++) {
      for (let vx = 0; vx <= width; vx++) {
        if (grid.isWaterVertex(vx, vy)) {
          grid.setVertexElevation(vx, vy, 0);
          continue;
        }

        let sum = 0;
        let count = 0;

        for (let dy = -1; dy <= 0; dy++) {
          for (let dx = -1; dx <= 0; dx++) {
            const t = grid.getTile(vx + dx, vy + dy);
            if (t && t.terrain !== 'water') {
              const elev = t.elevation !== undefined ? t.elevation * ELEVATION_MAX_HEIGHT_PX : 20;
              sum += elev;
              count++;
            }
          }
        }

        const elevPx = count > 0 ? sum / count : 0;
        grid.setVertexElevation(vx, vy, elevPx);
      }
    }

    // Apply gradient limiter so no slopes exceed ELEVATION_MAX_GRADIENT_PX (water is locked to 0)
    grid.enforceMaxGradient(ELEVATION_MAX_GRADIENT_PX);

    // Update final computed average tile elevation on TileData
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const currentTile = grid.getTile(x, y);
        if (!currentTile) continue;

        if (currentTile.terrain === 'water') {
          currentTile.elevation = 0;
        } else {
          const h00 = grid.getVertexElevation(x, y);
          const h10 = grid.getVertexElevation(x + 1, y);
          const h01 = grid.getVertexElevation(x, y + 1);
          const h11 = grid.getVertexElevation(x + 1, y + 1);
          const avg = (h00 + h10 + h01 + h11) / 4;
          currentTile.elevation = avg / (ELEVATION_MAX_HEIGHT_PX || 1);
        }
      }
    }

    return grid;
  }
}
