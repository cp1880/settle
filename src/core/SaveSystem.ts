import { World } from './World';
import { Grid } from './Grid';
import { Store } from './Store';
import { Unit } from './Unit';
import { SaveGameData } from '../types';

const SAVE_KEY_PREFIX = 'iso_settlers_save_';
const AUTOSAVE_KEY = 'iso_settlers_autosave';

export class SaveSystem {
  static saveToSlot(world: World, camera: { x: number; y: number; zoom: number }, slotName: string = 'default'): boolean {
    try {
      const data: SaveGameData = {
        version: 1,
        timestamp: Date.now(),
        name: slotName,
        mapSize: { w: world.grid.width, h: world.grid.height },
        tiles: world.grid.getTiles(),
        buildings: world.buildings,
        units: world.units.map((u) => u.data),
        globalInventory: world.store.getInventory(),
        stats: world.store.getStats(),
        camera,
      };

      const json = JSON.stringify(data);
      const key = slotName === 'autosave' ? AUTOSAVE_KEY : `${SAVE_KEY_PREFIX}${slotName}`;
      localStorage.setItem(key, json);
      return true;
    } catch (err) {
      console.error('Save failed:', err);
      return false;
    }
  }

  static loadFromSlot(slotName: string = 'default'): { world: World; camera: { x: number; y: number; zoom: number } } | null {
    try {
      const key = slotName === 'autosave' ? AUTOSAVE_KEY : `${SAVE_KEY_PREFIX}${slotName}`;
      const json = localStorage.getItem(key);
      if (!json) return null;

      const data: SaveGameData = JSON.parse(json);
      return this.restoreFromData(data);
    } catch (err) {
      console.error('Load failed:', err);
      return null;
    }
  }

  static restoreFromData(data: SaveGameData): { world: World; camera: { x: number; y: number; zoom: number } } {
    const grid = new Grid(data.mapSize.w, data.mapSize.h, data.tiles);
    const store = new Store(data.globalInventory);
    store.setStats(data.stats);

    const world = new World(grid, store);
    world.buildings = data.buildings || [];
    world.units = (data.units || []).map((uData) => new Unit(uData));
    world.updateStoreCapacity();

    return {
      world,
      camera: data.camera || { x: 0, y: 0, zoom: 1 },
    };
  }

  static exportToJson(world: World, camera: { x: number; y: number; zoom: number }): string {
    const data: SaveGameData = {
      version: 1,
      timestamp: Date.now(),
      name: `Export_${new Date().toISOString()}`,
      mapSize: { w: world.grid.width, h: world.grid.height },
      tiles: world.grid.getTiles(),
      buildings: world.buildings,
      units: world.units.map((u) => u.data),
      globalInventory: world.store.getInventory(),
      stats: world.store.getStats(),
      camera,
    };
    return JSON.stringify(data, null, 2);
  }

  static importFromJson(jsonString: string): { world: World; camera: { x: number; y: number; zoom: number } } | null {
    try {
      const data: SaveGameData = JSON.parse(jsonString);
      return this.restoreFromData(data);
    } catch (err) {
      console.error('Import JSON failed:', err);
      return null;
    }
  }

  static listSavedSlots(): Array<{ key: string; name: string; timestamp: number }> {
    const slots: Array<{ key: string; name: string; timestamp: number }> = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(SAVE_KEY_PREFIX) || key === AUTOSAVE_KEY)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const data: SaveGameData = JSON.parse(raw);
              slots.push({
                key: key.replace(SAVE_KEY_PREFIX, ''),
                name: data.name || key,
                timestamp: data.timestamp,
              });
            } catch {}
          }
        }
      }
    } catch {}
    return slots.sort((a, b) => b.timestamp - a.timestamp);
  }
}
