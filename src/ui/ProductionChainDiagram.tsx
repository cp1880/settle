import React from 'react';
import { X, ArrowRight, TreePine, Hammer, Mountain, Flame, Gem, Swords, Shield, Users, Warehouse } from 'lucide-react';

interface ProductionChainDiagramProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<string, number>;
}

export const ProductionChainDiagram: React.FC<ProductionChainDiagramProps> = ({ isOpen, onClose, inventory }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-amber-400" />
            <h2 className="font-serif font-bold text-base text-neutral-100">SETTLERS PRODUCTION CHAINS</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Flowchart Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6 text-xs text-neutral-300">
          {/* Chain 1: Forestry & Lumber */}
          <div className="bg-neutral-800/60 p-4 rounded-xl border border-neutral-700/50 flex flex-col gap-3">
            <h3 className="font-semibold text-amber-300 text-sm flex items-center gap-1.5">
              <TreePine className="w-4 h-4 text-emerald-400" />
              1. Forestry & Lumber Industry
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Step A */}
              <div className="bg-neutral-900/80 p-3 rounded-lg border border-neutral-700/60 flex flex-col gap-1 min-w-36">
                <span className="text-[10.5px] text-neutral-400">Forest Tiles</span>
                <span className="font-bold text-emerald-400">Standing Tree</span>
                <span className="text-[10px] text-neutral-500">Harvested by Lumberjack</span>
              </div>

              <ArrowRight className="w-4 h-4 text-neutral-500" />

              {/* Step B */}
              <div className="bg-neutral-900/80 p-3 rounded-lg border border-neutral-700/60 flex flex-col gap-1 min-w-36">
                <span className="text-[10.5px] text-neutral-400">Storehouse Material</span>
                <span className="font-bold text-amber-500">2x Raw Logs ({inventory.log || 0})</span>
                <span className="text-[10px] text-neutral-500">Processed at Sawmill</span>
              </div>

              <ArrowRight className="w-4 h-4 text-neutral-500" />

              {/* Step C */}
              <div className="bg-neutral-900/80 p-3 rounded-lg border border-neutral-700/60 flex flex-col gap-1 min-w-36">
                <span className="text-[10.5px] text-neutral-400">Finished Product</span>
                <span className="font-bold text-amber-200">1x Wood Plank ({inventory.wood || 0})</span>
                <span className="text-[10px] text-neutral-500">Used for All Buildings</span>
              </div>
            </div>
          </div>

          {/* Chain 2: Masonry & Mining */}
          <div className="bg-neutral-800/60 p-4 rounded-xl border border-neutral-700/50 flex flex-col gap-3">
            <h3 className="font-semibold text-stone-300 text-sm flex items-center gap-1.5">
              <Mountain className="w-4 h-4 text-stone-400" />
              2. Stone Quarrying & Masonry
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-neutral-900/80 p-3 rounded-lg border border-neutral-700/60 flex flex-col gap-1 min-w-36">
                <span className="text-[10.5px] text-neutral-400">Rocky Formations</span>
                <span className="font-bold text-stone-300">Rock Outcrop</span>
                <span className="text-[10px] text-neutral-500">Mined by Quarry Worker</span>
              </div>

              <ArrowRight className="w-4 h-4 text-neutral-500" />

              <div className="bg-neutral-900/80 p-3 rounded-lg border border-neutral-700/60 flex flex-col gap-1 min-w-36">
                <span className="text-[10.5px] text-neutral-400">Storage Supply</span>
                <span className="font-bold text-stone-200">2x Stone Blocks ({inventory.stone || 0})</span>
                <span className="text-[10px] text-neutral-500">Used for Roads, Walls & Smithy</span>
              </div>
            </div>
          </div>

          {/* Chain 3: Metallurgy & Military */}
          <div className="bg-neutral-800/60 p-4 rounded-xl border border-neutral-700/50 flex flex-col gap-3">
            <h3 className="font-semibold text-sky-300 text-sm flex items-center gap-1.5">
              <Swords className="w-4 h-4 text-sky-400" />
              3. Metallurgy, Weaponsmithing & Barracks Drilling
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Ores */}
              <div className="flex flex-col gap-2">
                <div className="bg-neutral-900/80 p-2 rounded-lg border border-neutral-700/60">
                  <span className="font-bold text-neutral-300">Coal Fuel ({inventory.coal || 0})</span>
                </div>
                <div className="bg-neutral-900/80 p-2 rounded-lg border border-neutral-700/60">
                  <span className="font-bold text-orange-400">Iron Ore ({inventory.iron_ore || 0})</span>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-neutral-500" />

              {/* Smithy */}
              <div className="bg-neutral-900/80 p-3 rounded-lg border border-neutral-700/60 flex flex-col gap-1 min-w-36">
                <span className="text-[10.5px] text-neutral-400">Smithy Forge</span>
                <span className="font-bold text-sky-300">Swords ({inventory.sword || 0}) & Shields ({inventory.shield || 0})</span>
                <span className="text-[10px] text-neutral-500">Forged with Coal + Iron Ore</span>
              </div>

              <ArrowRight className="w-4 h-4 text-neutral-500" />

              {/* Barracks */}
              <div className="bg-neutral-900/80 p-3 rounded-lg border border-neutral-700/60 flex flex-col gap-1 min-w-36">
                <span className="text-[10.5px] text-neutral-400">Barracks Training</span>
                <span className="font-bold text-red-400">Elite Soldier Unit ⚔️</span>
                <span className="text-[10px] text-neutral-500">Requires 1 Sword, 1 Shield & 1 Villager</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded-lg text-xs transition"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
