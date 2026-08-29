import React from 'react';
import { BuildingInstance } from '../types';
import { getBuilding } from '../content/buildings';
import { JOBS } from '../content/jobs';
import {
  Hammer,
  Users,
  Shield,
  Trash2,
  X,
  Clock,
  Sparkles,
  Swords,
  Box,
} from 'lucide-react';

interface BuildingInspectorProps {
  building: BuildingInstance;
  onClose: () => void;
  onDemolish: (building: BuildingInstance) => void;
  onTrainSoldier?: (buildingId: string) => void;
  currentInventory: Record<string, number>;
}

export const BuildingInspector: React.FC<BuildingInspectorProps> = ({
  building,
  onClose,
  onDemolish,
  onTrainSoldier,
  currentInventory,
}) => {
  const def = getBuilding(building.defId);
  if (!def) return null;

  const jobDef = def.workJob ? JOBS[def.workJob] : undefined;
  const isConstructing = !building.isConstructed;
  const progressPercent = Math.min(100, Math.floor((building.buildProgressMs / building.totalBuildMs) * 100));

  return (
    <aside className="fixed bottom-20 right-4 z-20 w-80 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-xs text-neutral-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="font-serif font-bold text-sm text-neutral-100">{def.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
      <p className="text-neutral-400 text-[11px] leading-relaxed">{def.description}</p>

      {/* Construction Progress */}
      {isConstructing ? (
        <div className="bg-neutral-800/80 p-2.5 rounded-xl border border-neutral-700/60 flex flex-col gap-1.5">
          <div className="flex items-center justify-between font-medium">
            <span className="text-amber-300">Under Construction</span>
            <span className="font-mono text-amber-200">{progressPercent}%</span>
          </div>
          <div className="w-full bg-neutral-700 h-2 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="text-[10px] text-neutral-400">Builders are actively hauling materials to the site.</p>
        </div>
      ) : (
        <>
          {/* Worker Stats */}
          {def.maxWorkers ? (
            <div className="bg-neutral-800/60 p-2 rounded-xl border border-neutral-700/40 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-neutral-300">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                <span>Assigned Staff</span>
              </div>
              <span className="font-semibold text-neutral-100">
                {building.assignedWorkerIds.length} / {def.maxWorkers} {jobDef?.name || 'Workers'}
              </span>
            </div>
          ) : null}

          {/* Job Recipe Details */}
          {jobDef && (
            <div className="bg-neutral-800/40 p-2 rounded-xl border border-neutral-700/30 flex flex-col gap-1">
              <span className="text-[10.5px] font-semibold text-neutral-300">Production Recipe</span>
              <div className="flex items-center gap-2 text-neutral-400 text-[10.5px]">
                <span>Inputs:</span>
                {jobDef.inputs.map((i) => (
                  <span key={i.res} className="bg-neutral-700/70 text-amber-200 px-1.5 py-0.5 rounded font-mono">
                    {i.qty} {i.res}
                  </span>
                ))}
                <span>→</span>
                <span>Outputs:</span>
                {jobDef.outputs.map((o) => (
                  <span key={o.res} className="bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                    {o.qty} {o.res}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Barracks Military Training */}
          {def.trains && (
            <div className="bg-neutral-800/80 p-2.5 rounded-xl border border-neutral-700/60 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-sky-400" />
                  Military Training
                </span>
                {building.trainingProgressMs !== undefined && (
                  <span className="text-[10px] text-amber-300 animate-pulse">Drilling...</span>
                )}
              </div>

              <p className="text-[10.5px] text-neutral-400">
                Converts 1 Villager + 1 Sword + 1 Shield into a trained combat Soldier.
              </p>

              <button
                onClick={() => onTrainSoldier && onTrainSoldier(building.id)}
                disabled={building.trainingProgressMs !== undefined}
                className={`w-full py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition ${
                  building.trainingProgressMs !== undefined
                    ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-95'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{building.trainingProgressMs !== undefined ? 'Training in progress...' : 'Train Soldier (1 Sword, 1 Shield)'}</span>
              </button>
            </div>
          )}

          {/* Turret Defense Stats */}
          {def.attacks && (
            <div className="bg-neutral-800/60 p-2 rounded-xl border border-neutral-700/40 flex items-center justify-between">
              <span className="text-neutral-300">Defense Ballista</span>
              <span className="text-amber-300 font-mono">
                {def.attacks.damage} Dmg / {def.attacks.rangeTiles} Tiles Range
              </span>
            </div>
          )}
        </>
      )}

      {/* Demolish Button (disabled for town hall) */}
      {def.id !== 'town_hall' && (
        <button
          onClick={() => onDemolish(building)}
          className="mt-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/50 rounded-lg transition active:scale-95"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Demolish Structure</span>
        </button>
      )}
    </aside>
  );
};
