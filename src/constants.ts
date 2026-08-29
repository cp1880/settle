// Isometric Settlers Constants

export const TILE_WIDTH = 128; // px (2:1 isometric ratio)
export const TILE_HEIGHT = 64; // px
export const GRID_SIZE_X = 72; // 72x72 expanded map (4x area)
export const GRID_SIZE_Y = 72; // 72x72 expanded map (4x area)

// Terrain movement costs for A* pathfinding
export const TERRAIN_COSTS = {
  grass: 3,
  forest: 4,
  rocky: 5,
  water: Infinity,
} as const;

// Road movement cost (roads make logistics 3x faster than grass)
export const ROAD_COST = 1;

// Simulation parameters
export const SIM_TICK_RATE_HZ = 20; // 20 simulation ticks per second
export const SIM_TICK_MS = 1000 / SIM_TICK_RATE_HZ; // 50ms per tick

// Population settings
export const BEDS_PER_HOUSE = 4;
export const INITIAL_BEDS = 6;
export const VILLAGER_SPAWN_INTERVAL_MS = 12000; // New villager spawns every 12s if beds available

// Initial starting supplies at Town Hall
export const STARTING_RESOURCES: Record<string, number> = {
  wood: 80,
  stone: 40,
  log: 30,
  coal: 20,
  iron_ore: 15,
  sword: 2,
  shield: 2,
};
