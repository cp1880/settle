import { JobSpec } from '../types';

export const JOBS: Record<string, JobSpec> = {
  lumberjack: {
    id: 'lumberjack',
    name: 'Lumberjack',
    description: 'Chops trees in surrounding forests and delivers 2 Logs to the nearest storehouse.',
    inputs: [{ res: 'tree', from: 'terrain', qty: 1 }],
    outputs: [{ res: 'log', to: 'store', qty: 2 }],
    workMs: 4000,
    toolType: 'axe',
  },
  sawyer: {
    id: 'sawyer',
    name: 'Sawyer',
    description: 'Processes 1 raw Log from storage into 2 finished Wood planks at the Sawmill.',
    inputs: [{ res: 'log', from: 'store', qty: 1 }],
    outputs: [{ res: 'wood', to: 'store', qty: 2 }],
    workMs: 3000,
    atBuilding: 'sawmill',
    toolType: 'saw',
  },
  stone_miner: {
    id: 'stone_miner',
    name: 'Stone Miner',
    description: 'Extracts 2 Stone blocks from rocky formations and carries them to storage.',
    inputs: [{ res: 'stone', from: 'terrain', qty: 1 }],
    outputs: [{ res: 'stone', to: 'store', qty: 2 }],
    workMs: 4500,
    atBuilding: 'quarry',
    toolType: 'pickaxe',
  },
  coal_miner: {
    id: 'coal_miner',
    name: 'Coal Miner',
    description: 'Mines 2 units of Coal fuel from subterranean coal deposits.',
    inputs: [{ res: 'coal', from: 'terrain', qty: 1 }],
    outputs: [{ res: 'coal', to: 'store', qty: 2 }],
    workMs: 4500,
    atBuilding: 'coal_mine',
    toolType: 'pickaxe',
  },
  iron_miner: {
    id: 'iron_miner',
    name: 'Iron Miner',
    description: 'Extracts 2 units of raw Iron Ore for metallurgical refining.',
    inputs: [{ res: 'iron_ore', from: 'terrain', qty: 1 }],
    outputs: [{ res: 'iron_ore', to: 'store', qty: 2 }],
    workMs: 5000,
    atBuilding: 'iron_mine',
    toolType: 'pickaxe',
  },
  weaponsmith: {
    id: 'weaponsmith',
    name: 'Weaponsmith',
    description: 'Forges 1 Steel Sword or 1 Iron Shield from 2 Coal and 2 Iron Ore at the Smithy.',
    inputs: [
      { res: 'coal', from: 'store', qty: 2 },
      { res: 'iron_ore', from: 'store', qty: 2 },
    ],
    outputs: [
      { res: 'sword', to: 'store', qty: 1 },
      { res: 'shield', to: 'store', qty: 1 },
    ],
    workMs: 6000,
    atBuilding: 'smithy',
    toolType: 'hammer',
  },
  builder: {
    id: 'builder',
    name: 'Master Builder',
    description: 'Transports building materials to foundation sites and erects structures.',
    inputs: [],
    outputs: [],
    workMs: 3000,
    toolType: 'hammer',
  },
  soldier: {
    id: 'soldier',
    name: 'Soldier',
    description: 'Equipped defender that patrols perimeters and neutralizes hostile creatures.',
    inputs: [],
    outputs: [],
    workMs: 0,
    toolType: 'sword',
  },
};

export function getJob(id: string): JobSpec | undefined {
  return JOBS[id];
}

export const JOB_IDS = Object.keys(JOBS);
