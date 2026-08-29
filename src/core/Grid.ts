import { TileData, TerrainType, FeatureType } from '../types';
import { TERRAIN_COSTS, ROAD_COST } from '../constants';

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
  canPlaceBuilding(x: number, y: number, w: number, h: number): boolean {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        const tile = this.getTile(tx, ty);
        if (!tile) return false;
        if (tile.terrain === 'water') return false;
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
        if (distFromCenter < 5.5) {
          terrain = 'grass';
          if (distFromCenter > 3.2 && Math.random() < 0.22) {
            feature = 'tree';
          }
        } else if (isRiver) {
          // Continuous river ribbon
          terrain = 'water';
          feature = riverDist < 0.6 ? 'deep_water' : 'shallow_water';
        } else {
          if (preset === 'valley') {
            // River Valley: Lush plains, rivers/lakes, rich rock ridges and forest groves
            if (nElevation < 0.30 || (nMoisture > 0.72 && nElevation < 0.42)) {
              terrain = 'water';
              feature = nElevation < 0.22 ? 'deep_water' : 'shallow_water';
            } else if (nElevation > 0.62) {
              terrain = 'rocky';
              const r = Math.random();
              if (r < 0.55) feature = 'rock_outcrop';
              else if (r < 0.75) feature = 'iron_seam';
              else feature = 'coal_seam';
            } else if (nMoisture > 0.48) {
              terrain = 'forest';
              if (Math.random() < 0.75) feature = 'tree';
              if (Math.random() < 0.08) feature = 'rock_outcrop';
            } else {
              terrain = 'grass';
              if (Math.random() < 0.15) feature = 'tree';
              if (Math.random() < 0.08) feature = 'rock_outcrop';
              if (nElevation > 0.52 && Math.random() < 0.12) feature = 'coal_seam';
            }
          } else if (preset === 'mountains') {
            // Mountain Quarry Outpost: Abundant rock outcrops, mineral veins, mountain lakes
            if (nElevation < 0.26) {
              terrain = 'water';
              feature = 'shallow_water';
            } else if (nElevation > 0.45) {
              terrain = 'rocky';
              const r = Math.random();
              if (r < 0.60) feature = 'rock_outcrop';
              else if (r < 0.80) feature = 'iron_seam';
              else feature = 'coal_seam';
            } else if (nMoisture > 0.55) {
              terrain = 'forest';
              feature = 'tree';
            } else {
              terrain = 'grass';
              if (Math.random() < 0.15) feature = 'rock_outcrop';
              if (Math.random() < 0.12) feature = 'tree';
            }
          } else {
            // Dense Timber Forest: Endless wood, streams, scattered mossy stones
            if (nElevation < 0.24 || nMoisture > 0.82) {
              terrain = 'water';
              feature = 'shallow_water';
            } else if (nElevation > 0.70) {
              terrain = 'rocky';
              feature = Math.random() < 0.7 ? 'rock_outcrop' : 'iron_seam';
            } else if (nMoisture > 0.28) {
              terrain = 'forest';
              if (Math.random() < 0.85) feature = 'tree';
              if (Math.random() < 0.06) feature = 'rock_outcrop';
            } else {
              terrain = 'grass';
              if (Math.random() < 0.35) feature = 'tree';
              if (Math.random() < 0.06) feature = 'rock_outcrop';
            }
          }
        }

        grid.setTile(x, y, { terrain, feature });
      }
    }

    return grid;
  }
}
