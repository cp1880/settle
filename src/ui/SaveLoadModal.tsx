import React, { useState, useEffect } from 'react';
import { SaveSystem } from '../core/SaveSystem';
import { World } from '../core/World';
import { Save, Download, Upload, RotateCcw, X, Trash2, CheckCircle2 } from 'lucide-react';
import { globalAudio } from '../core/AudioSystem';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  world: World;
  camera: { x: number; y: number; zoom: number };
  onLoadGame: (data: { world: World; camera: { x: number; y: number; zoom: number } }) => void;
  onStartScenario: (preset: 'valley' | 'mountains' | 'forest') => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  isOpen,
  onClose,
  world,
  camera,
  onLoadGame,
  onStartScenario,
}) => {
  const [savedSlots, setSavedSlots] = useState<Array<{ key: string; name: string; timestamp: number }>>([]);
  const [slotName, setSlotName] = useState('Colony 1');
  const [jsonExport, setJsonExport] = useState('');
  const [jsonImport, setJsonImport] = useState('');
  const [activeTab, setActiveTab] = useState<'slots' | 'json' | 'scenarios'>('slots');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSavedSlots(SaveSystem.listSavedSlots());
      setJsonExport(SaveSystem.exportToJson(world, camera));
      setStatusMsg(null);
    }
  }, [isOpen, world, camera]);

  if (!isOpen) return null;

  const handleSave = (name: string) => {
    const success = SaveSystem.saveToSlot(world, camera, name);
    if (success) {
      setSavedSlots(SaveSystem.listSavedSlots());
      setStatusMsg(`Successfully saved "${name}"!`);
      globalAudio.play('click');
    }
  };

  const handleLoad = (key: string) => {
    const res = SaveSystem.loadFromSlot(key);
    if (res) {
      onLoadGame(res);
      globalAudio.play('fanfare');
      onClose();
    }
  };

  const handleImport = () => {
    if (!jsonImport.trim()) return;
    const res = SaveSystem.importFromJson(jsonImport);
    if (res) {
      onLoadGame(res);
      globalAudio.play('fanfare');
      onClose();
    } else {
      setStatusMsg('Invalid JSON save file format.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-xs text-neutral-200">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center gap-2">
            <Save className="w-5 h-5 text-amber-400" />
            <h2 className="font-serif font-bold text-sm text-neutral-100">SAVE & LOAD MANAGEMENT</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/50 p-1.5 gap-1">
          <button
            onClick={() => setActiveTab('slots')}
            className={`flex-1 py-1.5 font-medium rounded-lg transition ${
              activeTab === 'slots' ? 'bg-amber-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Save Slots
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex-1 py-1.5 font-medium rounded-lg transition ${
              activeTab === 'json' ? 'bg-amber-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Export / Import JSON
          </button>
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`flex-1 py-1.5 font-medium rounded-lg transition ${
              activeTab === 'scenarios' ? 'bg-amber-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            New Scenarios
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div className="mx-4 mt-3 p-2 bg-amber-500/20 border border-amber-500/40 text-amber-200 rounded-lg flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-4 overflow-y-auto flex flex-col gap-4">
          {activeTab === 'slots' && (
            <>
              {/* Create new save */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={slotName}
                  onChange={(e) => setSlotName(e.target.value)}
                  placeholder="Enter save name..."
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => handleSave(slotName)}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded-lg transition active:scale-95"
                >
                  Save Game
                </button>
              </div>

              {/* Saved Slots List */}
              <div className="flex flex-col gap-2">
                <span className="font-semibold text-neutral-400 text-[11px]">Existing Saves:</span>
                {savedSlots.length === 0 ? (
                  <p className="text-neutral-500 italic py-2">No saved games found yet.</p>
                ) : (
                  savedSlots.map((slot) => (
                    <div
                      key={slot.key}
                      className="flex items-center justify-between p-2.5 bg-neutral-800/70 border border-neutral-700/60 rounded-xl"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-200">{slot.name}</span>
                        <span className="text-[10px] text-neutral-400">
                          {new Date(slot.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleLoad(slot.key)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-md transition"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => handleSave(slot.key)}
                          className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-md transition"
                        >
                          Overwrite
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'json' && (
            <div className="flex flex-col gap-3">
              <div>
                <span className="font-semibold text-neutral-300 block mb-1">Export JSON:</span>
                <textarea
                  readOnly
                  value={jsonExport}
                  rows={4}
                  className="w-full bg-neutral-950 p-2 rounded-lg font-mono text-[10px] text-neutral-400 border border-neutral-800"
                />
              </div>
              <div>
                <span className="font-semibold text-neutral-300 block mb-1">Import JSON:</span>
                <textarea
                  value={jsonImport}
                  onChange={(e) => setJsonImport(e.target.value)}
                  placeholder="Paste JSON save data string here..."
                  rows={4}
                  className="w-full bg-neutral-800 p-2 rounded-lg font-mono text-[10px] text-white border border-neutral-700"
                />
                <button
                  onClick={handleImport}
                  className="mt-2 w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition"
                >
                  Import Save & Launch
                </button>
              </div>
            </div>
          )}

          {activeTab === 'scenarios' && (
            <div className="flex flex-col gap-2.5">
              <span className="font-semibold text-neutral-300">Choose Map Biome Preset:</span>
              <button
                onClick={() => {
                  onStartScenario('valley');
                  onClose();
                }}
                className="p-3 bg-neutral-800 hover:bg-neutral-700/90 border border-neutral-700 rounded-xl text-left transition"
              >
                <div className="font-bold text-amber-300">🌿 River Valley (Balanced)</div>
                <div className="text-[10.5px] text-neutral-400">
                  Fertile grasslands, gentle rivers, balanced forest clusters, and moderate mountain rims.
                </div>
              </button>

              <button
                onClick={() => {
                  onStartScenario('mountains');
                  onClose();
                }}
                className="p-3 bg-neutral-800 hover:bg-neutral-700/90 border border-neutral-700 rounded-xl text-left transition"
              >
                <div className="font-bold text-stone-300">⛰️ Mountain Quarry Outpost</div>
                <div className="text-[10.5px] text-neutral-400">
                  Rocky cliffs rich in coal and iron ore deposits. Requires smart road logistics.
                </div>
              </button>

              <button
                onClick={() => {
                  onStartScenario('forest');
                  onClose();
                }}
                className="p-3 bg-neutral-800 hover:bg-neutral-700/90 border border-neutral-700 rounded-xl text-left transition"
              >
                <div className="font-bold text-emerald-300">🌲 Ancient Timber Forest</div>
                <div className="text-[10.5px] text-neutral-400">
                  Dense woodland with boundless timber resources. Great for rapid wood construction.
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
