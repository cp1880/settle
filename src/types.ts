// Type definitions for Isometric Settlers Generic Engine

export type TerrainType = 'grass' | 'forest' | 'rocky' | 'water';
export type FeatureType = 'tree' | 'rock_outcrop' | 'coal_seam' | 'iron_seam' | 'cliff' | 'shallow_water' | 'deep_water';

export interface TileData {
  terrain: TerrainType;
  feature?: FeatureType;
  road?: boolean;
  bridge?: boolean; // True when a wooden bridge is built/present
  buildingId?: string; // ID of building placed on this tile
  elevation?: number;
}

export interface ResourceCost {
  res: string;
  qty: number;
}

export interface ResourceDef {
  id: string;
  name: string;
  category: 'raw' | 'processed' | 'military' | 'population';
  description: string;
  color: string;
  iconName: string;
}

export interface BuildingDef {
  id: string;
  name: string;
  category: 'logistics' | 'production' | 'industry' | 'housing_military' | 'fortifications';
  description: string;
  size: { w: number; h: number };
  cost: ResourceCost[];
  buildMs: number;
  capacity?: number; // Storage capacity or Beds
  workJob?: string; // Job assigned to workers at this building
  maxWorkers?: number;
  trains?: {
    inputUnit: string;
    requires: ResourceCost[];
    outputUnit: string;
    timeMs: number;
  };
  attacks?: {
    rangeTiles: number;
    damage: number;
    fireMs: number;
  };
  allowedTerrains?: TerrainType[];
}

export interface JobInput {
  res: string;
  from: 'terrain' | 'store';
  qty: number;
}

export interface JobOutput {
  res: string;
  to: 'store' | 'building';
  qty: number;
}

export interface JobSpec {
  id: string;
  name: string;
  description: string;
  inputs: JobInput[];
  outputs: JobOutput[];
  workMs: number;
  atBuilding?: string;
  toolType?: 'axe' | 'pickaxe' | 'hammer' | 'saw' | 'sword';
}

export type UnitState =
  | 'idle'
  | 'move_to_source'
  | 'move_to_building'
  | 'move_to_store'
  | 'work'
  | 'carry'
  | 'deliver'
  | 'build'
  | 'patrol'
  | 'attack';

export interface CarryResource {
  res: string;
  qty: number;
}

export interface UnitDef {
  id: string;
  name: string;
  type: string; // 'villager' | 'soldier'
  state: UnitState;
  x: number; // Current visual X (world coords)
  y: number; // Current visual Y (world coords)
  gridX: number;
  gridY: number;
  targetX?: number;
  targetY?: number;
  path: [number, number][];
  jobId?: string;
  assignedBuildingId?: string;
  carry?: CarryResource;
  workTimeRemainingMs: number;
  workTotalMs: number;
  health: number;
  maxHealth: number;
  facing: 'SE' | 'SW' | 'NE' | 'NW';
}

export interface BuildingInstance {
  id: string;
  defId: string;
  x: number; // Grid X top-left
  y: number; // Grid Y top-left
  isConstructed: boolean;
  buildProgressMs: number;
  totalBuildMs: number;
  inventory: Record<string, number>;
  assignedWorkerIds: string[];
  trainingProgressMs?: number;
  targetEnemyId?: string;
  lastAttackMs?: number;
}

export type GameSpeed = 0 | 1 | 2 | 5;

export interface ProductionStats {
  produced: Record<string, number>;
  consumed: Record<string, number>;
  ratePerMinute: Record<string, number>;
}

export interface SaveGameData {
  version: number;
  timestamp: number;
  name: string;
  mapSize: { w: number; h: number };
  tiles: TileData[][];
  buildings: BuildingInstance[];
  units: UnitDef[];
  globalInventory: Record<string, number>;
  stats: ProductionStats;
  camera: { x: number; y: number; zoom: number };
}

export type SoundEffectType =
  | 'chop'
  | 'mine'
  | 'hammer'
  | 'saw'
  | 'deliver'
  | 'build_start'
  | 'build_complete'
  | 'train_soldier'
  | 'turret_shot'
  | 'road_place'
  | 'click'
  | 'alert'
  | 'fanfare';
