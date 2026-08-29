import React, { useState } from 'react';
import { BUILDINGS, BUILDING_IDS } from '../content/buildings';
import { BuildingDef } from '../types';
import {
  Hammer,
  TreePine,
  Mountain,
  Users,
  Shield,
  Home,
  Layers,
  Flame,
  Gem,
  Swords,
  Castle,
  Warehouse,
  X,
  ChevronUp,
} from 'lucide-react';
import { globalAudio } from '../core/AudioSystem';

interface BuildMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleOpen: () => void;
  selectedDefId: string | null;
  onSelectBuilding: (defId: string | null) => void;
  currentInventory: Record<string, number>;
}

type CategoryType = 'all' | 'logistics' | 'production' | 'industry' | 'housing_military' | 'fortifications';

export const BuildMenu: React.FC<BuildMenuProps> = ({
  isOpen,
  onClose,
  onToggleOpen,
  selectedDefId,
  onSelectBuilding,
  currentInventory,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');

  const categories: Array<{ id: CategoryType; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'All', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'logistics', label: 'Logistics', icon: <Warehouse className="w-3.5 h-3.5" /> },
    { id: 'production', label: 'Production', icon: <TreePine className="w-3.5 h-3.5" /> },
    { id: 'industry', label: 'Industry', icon: <Flame className="w-3.5 h-3.5" /> },
    { id: 'housing_military', label: 'Housing & Military', icon: <Home className="w-3.5 h-3.5" /> },
    { id: 'fortifications', label: 'Defense', icon: <Castle className="w-3.5 h-3.5" /> },
  ];

  const filteredBuildings = BUILDING_IDS.map((id) => BUILDINGS[id]).filter((bld) => {
    if (!bld) return false;
    if (activeCategory === 'all') return true;
    return bld.category === activeCategory;
  });

  const canAfford = (def: BuildingDef): boolean => {
    return def.cost.every((cost) => (currentInventory[cost.res] || 0) >= cost.qty);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none flex flex-col items-center">
      {/* Floating Toggle Button when closed */}
      {!isOpen && (
        <button
          id="open-build-menu-btn"
          onClick={onToggleOpen}
          className="mb-4 pointer-events-auto flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-sm rounded-full shadow-2xl border-2 border-amber-400/80 transition transform hover:scale-105 active:scale-95"
        >
          <Hammer className="w-4 h-4" />
          <span>BUILDINGS & ROADS (B)</span>
          <ChevronUp className="w-4 h-4" />
        </button>
      )}

      {/* Expanded Drawer */}
      {isOpen && (
        <div className="w-full max-w-5xl bg-neutral-900/95 backdrop-blur-xl border-t border-neutral-700/80 rounded-t-2xl shadow-2xl pointer-events-auto p-4 flex flex-col gap-3 transition-transform animate-in slide-in-from-bottom duration-200">
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Hammer className="w-5 h-5 text-amber-400" />
              <h2 className="font-serif font-bold text-neutral-100 text-sm tracking-wider">CONSTRUCTION CATALOG</h2>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    globalAudio.play('click');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-medium transition ${
                    activeCategory === cat.id
                      ? 'bg-amber-500 text-neutral-950 font-semibold shadow'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                  }`}
                >
                  {cat.icon}
                  <span className="hidden sm:inline">{cat.label}</span>
                </button>
              ))}
            </div>

            <button
              id="close-build-menu-btn"
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {filteredBuildings.map((def) => {
              const affordable = canAfford(def);
              const isSelected = selectedDefId === def.id;

              return (
                <button
                  key={def.id}
                  id={`build-card-${def.id}`}
                  onClick={() => {
                    if (isSelected) {
                      onSelectBuilding(null);
                    } else {
                      onSelectBuilding(def.id);
                      globalAudio.play('click');
                    }
                  }}
                  className={`flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs relative ${
                    isSelected
                      ? 'bg-amber-600/30 border-amber-400 shadow-md ring-2 ring-amber-500/50'
                      : affordable
                      ? 'bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700/80 hover:border-neutral-600 text-neutral-200'
                      : 'bg-neutral-900/60 border-neutral-800 text-neutral-500 opacity-60'
                  }`}
                >
                  {/* Building Title & Size Badge */}
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-semibold text-neutral-100 truncate">{def.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-neutral-700/60 rounded text-neutral-300">
                      {def.size.w}x{def.size.h}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-[10.5px] text-neutral-400 line-clamp-2 mb-2 leading-relaxed">
                    {def.description}
                  </p>

                  {/* Cost Badges */}
                  <div className="mt-auto flex flex-wrap gap-1">
                    {def.cost.map((c) => {
                      const hasEnough = (currentInventory[c.res] || 0) >= c.qty;
                      return (
                        <span
                          key={c.res}
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            hasEnough ? 'bg-neutral-700 text-amber-200' : 'bg-red-950/80 text-red-300 font-bold'
                          }`}
                        >
                          {c.qty} {c.res}
                        </span>
                      );
                    })}
                  </div>

                  {/* Build Time */}
                  <div className="mt-1 text-[9.5px] text-neutral-500">
                    ⏱️ {(def.buildMs / 1000).toFixed(0)}s
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
