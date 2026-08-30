import { ResourceCost, ProductionStats } from '../types';

export class Store {
  private inventory: Record<string, number> = {};
  private baseCapacity: number = 200;
  private extraCapacity: number = 0;
  private stats: ProductionStats = {
    produced: {},
    consumed: {},
    ratePerMinute: {},
  };

  // 1-minute sliding window counters for rate computation
  private recentProduction: Array<{ timestamp: number; res: string; qty: number }> = [];

  constructor(initialInventory?: Record<string, number>, baseCap: number = 200) {
    this.baseCapacity = baseCap;
    if (initialInventory) {
      this.inventory = { ...initialInventory };
    }
  }

  get totalCapacity(): number {
    return this.baseCapacity + this.extraCapacity;
  }

  setExtraCapacity(cap: number): void {
    this.extraCapacity = cap;
  }

  get currentStoredUnits(): number {
    return Object.values(this.inventory).reduce((sum, qty) => sum + (qty || 0), 0);
  }

  get isFull(): boolean {
    return this.currentStoredUnits >= this.totalCapacity;
  }

  get availableSpace(): number {
    return Math.max(0, this.totalCapacity - this.currentStoredUnits);
  }

  getInventory(): Record<string, number> {
    return { ...this.inventory };
  }

  get(resourceId: string): number {
    return this.inventory[resourceId] || 0;
  }

  canAfford(cost: ResourceCost[]): boolean {
    for (const item of cost) {
      if ((this.inventory[item.res] || 0) < item.qty) {
        return false;
      }
    }
    return true;
  }

  deduct(cost: ResourceCost[]): boolean {
    if (!this.canAfford(cost)) {
      return false;
    }
    for (const item of cost) {
      this.inventory[item.res] = (this.inventory[item.res] || 0) - item.qty;
      this.stats.consumed[item.res] = (this.stats.consumed[item.res] || 0) + item.qty;
      if (this.inventory[item.res] <= 0) {
        delete this.inventory[item.res];
      }
    }
    return true;
  }

  add(resourceId: string, quantity: number): number {
    if (quantity <= 0) return 0;

    const currentTotal = this.currentStoredUnits;
    const space = Math.max(0, this.totalCapacity - currentTotal);
    const added = Math.min(space, quantity);

    if (added > 0) {
      this.inventory[resourceId] = (this.inventory[resourceId] || 0) + added;
      this.stats.produced[resourceId] = (this.stats.produced[resourceId] || 0) + added;

      this.recentProduction.push({
        timestamp: Date.now(),
        res: resourceId,
        qty: added,
      });
    }

    return added;
  }

  updateRates(nowMs: number = Date.now()): void {
    const oneMinAgo = nowMs - 60000;
    this.recentProduction = this.recentProduction.filter((p) => p.timestamp >= oneMinAgo);

    const rates: Record<string, number> = {};
    for (const item of this.recentProduction) {
      rates[item.res] = (rates[item.res] || 0) + item.qty;
    }
    this.stats.ratePerMinute = rates;
  }

  getStats(): ProductionStats {
    return {
      produced: { ...this.stats.produced },
      consumed: { ...this.stats.consumed },
      ratePerMinute: { ...this.stats.ratePerMinute },
    };
  }

  setStats(stats: ProductionStats): void {
    this.stats = stats;
  }

  loadInventory(inv: Record<string, number>): void {
    this.inventory = { ...inv };
  }
}
