import { ResourceDef } from '../types';

export const RESOURCES: Record<string, ResourceDef> = {
  tree: {
    id: 'tree',
    name: 'Tree',
    category: 'raw',
    description: 'Raw standing timber from forest tiles',
    color: '#2e7d32',
    iconName: 'Trees',
  },
  log: {
    id: 'log',
    name: 'Log',
    category: 'raw',
    description: 'Harvested timber logs ready for processing',
    color: '#8d6e63',
    iconName: 'Logs',
  },
  wood: {
    id: 'wood',
    name: 'Wood Planks',
    category: 'processed',
    description: 'Finished timber used for building construction',
    color: '#d7ccc8',
    iconName: 'Hammer',
  },
  stone: {
    id: 'stone',
    name: 'Stone Block',
    category: 'raw',
    description: 'Quarried stone blocks for masonry and fortifications',
    color: '#9e9e9e',
    iconName: 'Mountain',
  },
  coal: {
    id: 'coal',
    name: 'Coal',
    category: 'raw',
    description: 'High-energy fuel mined for smithing and smelting',
    color: '#37474f',
    iconName: 'Flame',
  },
  iron_ore: {
    id: 'iron_ore',
    name: 'Iron Ore',
    category: 'raw',
    description: 'Raw metal ore mined for tool & weapon fabrication',
    color: '#a1887f',
    iconName: 'Gem',
  },
  sword: {
    id: 'sword',
    name: 'Steel Sword',
    category: 'military',
    description: 'Tempered steel blade forged at the Smithy',
    color: '#64b5f6',
    iconName: 'Sword',
  },
  shield: {
    id: 'shield',
    name: 'Iron Shield',
    category: 'military',
    description: 'Reinforced defensive shield for soldier training',
    color: '#ffd54f',
    iconName: 'Shield',
  },
  villager: {
    id: 'villager',
    name: 'Villager',
    category: 'population',
    description: 'Worker inhabitant requiring a residential bed',
    color: '#ffb74d',
    iconName: 'Users',
  },
  soldier: {
    id: 'soldier',
    name: 'Soldier',
    category: 'military',
    description: 'Equipped combat unit trained at the Barracks',
    color: '#e57373',
    iconName: 'ShieldAlert',
  },
};

export function getResource(id: string): ResourceDef | undefined {
  return RESOURCES[id];
}

export const RESOURCE_IDS = Object.keys(RESOURCES);
