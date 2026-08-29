import React from 'react';
import { Unit } from '../core/Unit';
import { JOBS } from '../content/jobs';
import { Users, Shield, Heart, Activity, Package, X, Compass, Hammer, Axe, Pickaxe, Sparkles } from 'lucide-react';

interface UnitInspectorProps {
  unit: Unit;
  onClose: () => void;
  onAssignJob?: (unitId: string, jobId: string | null) => void;
}

export const UnitInspector: React.FC<UnitInspectorProps> = ({ unit, onClose, onAssignJob }) => {
  const isSoldier = unit.data.type === 'soldier';
  const job = unit.data.jobId ? JOBS[unit.data.jobId] : undefined;

  const stateLabels: Record<string, string> = {
    idle: 'Resting / Idle',
    move_to_source: 'Traveling to resource',
    move_to_building: 'Traveling to workplace',
    move_to_store: 'Transporting goods',
    work: 'Gathering / Crafting',
    carry: 'Routing to Storehouse',
    deliver: 'Depositing Goods',
    build: 'Erecting Structure 🔨',
    patrol: 'Patrolling Perimeter',
    attack: 'Engaging Hostiles',
  };

  const availableJobs: Array<{ id: string | null; name: string; icon: React.ReactNode; color: string; desc: string }> = [
    { id: 'builder', name: 'Master Builder', icon: <Hammer className="w-3.5 h-3.5" />, color: 'text-amber-400 border-amber-500/40 hover:bg-amber-500/20', desc: 'Prioritize building new foundations' },
    { id: 'lumberjack', name: 'Lumberjack', icon: <Axe className="w-3.5 h-3.5" />, color: 'text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20', desc: 'Fell trees to gather raw timber logs' },
    { id: 'stone_miner', name: 'Stone Miner', icon: <Pickaxe className="w-3.5 h-3.5" />, color: 'text-neutral-300 border-neutral-500/40 hover:bg-neutral-500/20', desc: 'Quarry stone outcroppings' },
    { id: 'sawyer', name: 'Sawyer', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-amber-300 border-amber-500/40 hover:bg-amber-500/20', desc: 'Refine logs into planks at Sawmill' },
    { id: 'coal_miner', name: 'Coal Miner', icon: <Pickaxe className="w-3.5 h-3.5 text-zinc-400" />, color: 'text-zinc-400 border-zinc-500/40 hover:bg-zinc-500/20', desc: 'Mine coal veins for furnaces' },
    { id: 'iron_miner', name: 'Iron Miner', icon: <Pickaxe className="w-3.5 h-3.5 text-sky-400" />, color: 'text-sky-400 border-sky-500/40 hover:bg-sky-500/20', desc: 'Mine iron ore for blacksmith' },
    { id: 'weaponsmith', name: 'Weaponsmith', icon: <Hammer className="w-3.5 h-3.5 text-rose-400" />, color: 'text-rose-400 border-rose-500/40 hover:bg-rose-500/20', desc: 'Forge weapons at Smithy' },
    { id: null, name: 'Free Settler', icon: <Users className="w-3.5 h-3.5 text-slate-400" />, color: 'text-slate-400 border-slate-600/40 hover:bg-slate-700/30', desc: 'General settler / auto-assigned' },
  ];

  return (
    <aside className="fixed bottom-20 right-4 z-20 w-80 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-2xl shadow-2xl p-4 flex flex-col gap-2.5 text-xs text-neutral-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          {isSoldier ? <Shield className="w-4 h-4 text-sky-400" /> : <Users className="w-4 h-4 text-amber-400" />}
          <div>
            <h3 className="font-serif font-bold text-sm text-neutral-100">{unit.data.name}</h3>
            <p className="text-[10px] text-neutral-400">
              {isSoldier ? 'Colony Defender' : job?.name || 'Free Settler'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Role / Profession */}
      <div className="bg-neutral-800/60 p-2 rounded-xl border border-neutral-700/40 flex items-center justify-between">
        <span className="text-neutral-400">Current Role</span>
        <span className="font-semibold text-amber-300">
          {isSoldier ? 'Colony Guard' : job?.name || 'Free Settler'}
        </span>
      </div>

      {/* Health */}
      <div className="bg-neutral-800/60 p-2 rounded-xl border border-neutral-700/40 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-rose-400">
          <Heart className="w-3.5 h-3.5" />
          <span>Health</span>
        </div>
        <span className="font-mono text-neutral-100">
          {unit.data.health} / {unit.data.maxHealth}
        </span>
      </div>

      {/* Current Task */}
      <div className="bg-neutral-800/60 p-2 rounded-xl border border-neutral-700/40 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sky-400">
          <Activity className="w-3.5 h-3.5" />
          <span>Current Task</span>
        </div>
        <span className="font-medium text-sky-200 text-right">
          {stateLabels[unit.state] || unit.state}
        </span>
      </div>

      {/* Carried Goods */}
      {unit.carry ? (
        <div className="bg-emerald-950/40 p-2 rounded-xl border border-emerald-800/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Package className="w-3.5 h-3.5" />
            <span>Carrying</span>
          </div>
          <span className="font-mono font-bold text-emerald-300">
            +{unit.carry.qty} {unit.carry.res}
          </span>
        </div>
      ) : null}

      {/* Manual Job / Task Assignment Section */}
      {!isSoldier && onAssignJob && (
        <div className="mt-1 flex flex-col gap-1.5 border-t border-neutral-800 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-300">Assign Profession / Task:</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
            {availableJobs.map((item) => {
              const isCurrent = (unit.data.jobId || null) === item.id;
              return (
                <button
                  key={item.name}
                  onClick={() => onAssignJob(unit.id, item.id)}
                  title={item.desc}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[11px] font-medium text-left transition ${
                    isCurrent
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-sm'
                      : `bg-neutral-800/80 ${item.color} border-neutral-700/60`
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid Coordinates */}
      <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1 border-t border-neutral-800/60">
        <span className="flex items-center gap-1">
          <Compass className="w-3 h-3" /> Grid Position:
        </span>
        <span className="font-mono">
          ({unit.gridX}, {unit.gridY})
        </span>
      </div>
    </aside>
  );
};
