import React from 'react';
import {
  X,
  Warehouse,
  Hammer,
  TreePine,
  Mountain,
  Flame,
  Gem,
  Swords,
  Shield,
  Box,
  TrendingUp,
  Info,
  ArrowRight,
} from 'lucide-react';
import { RESOURCES, RESOURCE_IDS } from '../content/resources';
import { ResourceDef } from '../types';

interface ResourceLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<string, number>;
  totalStored: number;
  totalCapacity: number;
}

export const ResourceLedgerModal: React.FC<ResourceLedgerModalProps> = ({
  isOpen,
  onClose,
  inventory,
  totalStored,
  totalCapacity,
}) => {
  if (!isOpen) return null;

  const storagePercent = Math.min(100, Math.round((totalStored / Math.max(1, totalCapacity)) * 100));

  const resourceCategories: Array<{
    title: string;
    description: string;
    items: string[];
  }> = [
    {
      title: 'Construction & Basic Materials',
      description: 'Primary structural components required for erecting buildings, roads, and fortifications.',
      items: ['wood', 'log', 'stone'],
    },
    {
      title: 'Mining & Metallurgical Fuel',
      description: 'Raw excavated ores and combustible fuel extracted from subterranean seams.',
      items: ['coal', 'iron_ore'],
    },
    {
      title: 'Military Equipment & Armaments',
      description: 'Finished weapons and defensive armor forged at the Smithy to train garrison soldiers.',
      items: ['sword', 'shield'],
    },
  ];

  const getResourceIcon = (id: string) => {
    switch (id) {
      case 'wood':
        return <Hammer className="w-4 h-4 text-amber-300" />;
      case 'log':
        return <TreePine className="w-4 h-4 text-amber-500" />;
      case 'stone':
        return <Mountain className="w-4 h-4 text-stone-300" />;
      case 'coal':
        return <Flame className="w-4 h-4 text-neutral-300" />;
      case 'iron_ore':
        return <Gem className="w-4 h-4 text-orange-400" />;
      case 'sword':
        return <Swords className="w-4 h-4 text-sky-400" />;
      case 'shield':
        return <Shield className="w-4 h-4 text-yellow-400" />;
      default:
        return <Box className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-xs text-neutral-200">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-amber-400" />
            <h2 className="font-serif font-bold text-base text-neutral-100">COLONY RESOURCE LEDGER & STOCKPILES</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage Capacity Global Overview */}
        <div className="bg-neutral-800/60 p-4 border-b border-neutral-800 flex flex-col gap-2">
          <div className="flex items-center justify-between font-medium">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-sky-400" />
              <span className="text-sm font-semibold text-neutral-100">Total Settlement Storage</span>
            </div>
            <span className="font-mono text-sm font-bold text-amber-300">
              {totalStored} / {totalCapacity} Units ({storagePercent}%)
            </span>
          </div>

          <div className="w-full bg-neutral-700/70 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                storagePercent >= 90
                  ? 'bg-rose-500'
                  : storagePercent >= 70
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${storagePercent}%` }}
            />
          </div>

          <p className="text-[11px] text-neutral-400">
            Build additional <strong className="text-neutral-200">Storehouses</strong> (+500 capacity each) to expand storage limits and prevent resource overflow.
          </p>
        </div>

        {/* Resources Grid by Category */}
        <div className="p-4 overflow-y-auto flex flex-col gap-5">
          {resourceCategories.map((cat) => (
            <div key={cat.title} className="flex flex-col gap-2">
              <div className="flex flex-col">
                <h3 className="font-bold text-amber-300 text-xs tracking-wide uppercase">{cat.title}</h3>
                <span className="text-[10.5px] text-neutral-400">{cat.description}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {cat.items.map((resId) => {
                  const def: ResourceDef | undefined = RESOURCES[resId];
                  const qty = inventory[resId] || 0;

                  return (
                    <div
                      key={resId}
                      className="bg-neutral-800/80 border border-neutral-700/70 rounded-xl p-3 flex flex-col gap-2 relative shadow"
                    >
                      {/* Top Row: Icon + Name + Quantity */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-neutral-900/80 rounded-lg border border-neutral-700/60">
                            {getResourceIcon(resId)}
                          </div>
                          <div>
                            <span className="font-semibold text-neutral-100 block">{def?.name || resId}</span>
                            <span className="text-[10px] text-neutral-400 uppercase tracking-wider">{def?.category || 'resource'}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-mono text-base font-extrabold text-amber-300">{qty}</span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-[10.5px] text-neutral-400 leading-snug">
                        {def?.description || 'Colony material.'}
                      </p>

                      {/* Recipe & Origin Hint */}
                      <div className="mt-auto pt-1.5 border-t border-neutral-700/50 flex items-center justify-between text-[10px] text-neutral-400">
                        {resId === 'wood' && (
                          <span className="text-amber-200">Sawmill: 2 Logs → 1 Wood</span>
                        )}
                        {resId === 'log' && (
                          <span className="text-emerald-300">Harvest from Forest Trees</span>
                        )}
                        {resId === 'stone' && (
                          <span className="text-stone-300">Mined from Rocky Formations</span>
                        )}
                        {resId === 'coal' && (
                          <span className="text-neutral-300">Mined from Coal Seams</span>
                        )}
                        {resId === 'iron_ore' && (
                          <span className="text-orange-300">Extracted from Iron Seams</span>
                        )}
                        {resId === 'sword' && (
                          <span className="text-sky-300">Smithy: 2 Coal + 2 Iron</span>
                        )}
                        {resId === 'shield' && (
                          <span className="text-yellow-300">Smithy: 2 Coal + 2 Iron</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-900/90 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>Materials are stored safely at Town Hall and Storehouses.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded-lg text-xs transition"
          >
            Close Stockpile
          </button>
        </div>
      </div>
    </div>
  );
};
