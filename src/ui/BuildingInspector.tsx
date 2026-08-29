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
  ChevronLeft,
  ChevronRight,
  Compass,
} from 'lucide-react';

interface BuildingInspectorProps {
  building: BuildingInstance;
  onClose: () => void;
  onDemolish: (building: BuildingInstance) => void;
  onTrainSoldier?: (buildingId: string) => void;
  currentInventory: Record<string, number>;
  currentIndex?: number;
  totalCount?: number;
  onPrevBuilding?: () => void;
  onNextBuilding?: () => void;
}

export const BuildingInspector: React.FC<BuildingInspectorProps> = ({
  building,
  onClose,
  onDemolish,
  onTrainSoldier,
  currentInventory,
  currentIndex,
  totalCount,
  onPrevBuilding,
  onNextBuilding,
}) => {
  const def = getBuilding(building.defId);
  if (!def) return null;

  const jobDef = def.workJob ? JOBS[def.workJob] : undefined;
  const isConstructing = !building.isConstructed;
  const progressPercent = Math.min(100, Math.floor((building.buildProgressMs / building.totalBuildMs) * 100));

  return (
    <aside className="fixed bottom-20 right-4 z-20 w-80 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-xs text-neutral-200">
      {/* Header with Navigation Carousel */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="flex items-center gap-1.5">
            <h3 className="font-serif font-bold text-sm text-neutral-100">{def.name}</h3>
            {currentIndex !== undefined && totalCount !== undefined && (
              <span className="text-[10px] bg-neutral-800 border border-neutral-700/60 text-neutral-400 px-1.5 py-0.2 rounded font-mono">
                {currentIndex + 1}/{totalCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Previous / Next Building Buttons */}
          {onPrevBuilding && onNextBuilding && (
            <div className="flex items-center bg-neutral-800/80 border border-neutral-700/60 rounded-lg p-0.5 mr-1">
              <button
                onClick={onPrevBuilding}
                title="Previous Building (Left Arrow ←)"
                className="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-700 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onNextBuilding}
                title="Next Building (Right Arrow →)"
                className="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-700 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
            title="Close Inspector (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
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

          {/* Productivity Status Alert */}
          {def.workJob && (
            (() => {
              const hasWorkers = building.assignedWorkerIds.length > 0;
              if (!hasWorkers) {
                return (
                  <div className="bg-amber-950/40 border border-amber-500/50 p-2 rounded-xl flex items-center gap-2 text-[11px] text-amber-200">
                    <span className="text-sm">⚠️</span>
                    <div>
                      <span className="font-semibold block text-amber-300">Unstaffed Facility</span>
                      <span className="text-[10px] text-amber-400/80">No workers assigned. Assign or spawn settlers to produce goods.</span>
                    </div>
                  </div>
                );
              }
              if (jobDef) {
                const missingInput = jobDef.inputs.find(
                  (i) => i.from === 'store' && (currentInventory[i.res] || 0) < i.qty
                );
                if (missingInput) {
                  return (
                    <div className="bg-rose-950/40 border border-rose-500/50 p-2 rounded-xl flex items-center gap-2 text-[11px] text-rose-200">
                      <span className="text-sm">📦</span>
                      <div>
                        <span className="font-semibold block text-rose-300">Lacking Raw Materials</span>
                        <span className="text-[10px] text-rose-400/80">
                          Requires {missingInput.qty}x {missingInput.res} in stockpile (currently {currentInventory[missingInput.res] || 0}).
                        </span>
                      </div>
                    </div>
                  );
                }
              }
              return (
                <div className="bg-emerald-950/40 border border-emerald-500/40 p-1.5 rounded-xl flex items-center gap-2 text-[10.5px] text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Actively productive & staffed</span>
                </div>
              );
            })()
          )}

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

      {/* Grid Coordinates & Keyboard Navigation Hint */}
      <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1 border-t border-neutral-800/60">
        <span className="flex items-center gap-1">
          <Compass className="w-3 h-3" /> Grid: ({building.x}, {building.y})
        </span>
        <span className="text-[9.5px] text-neutral-400 font-medium">
          Cycle: <span className="bg-neutral-800 px-1 py-0.5 rounded border border-neutral-700 text-neutral-300">←</span> <span className="bg-neutral-800 px-1 py-0.5 rounded border border-neutral-700 text-neutral-300">→</span>
        </span>
      </div>
    </aside>
  );
};
