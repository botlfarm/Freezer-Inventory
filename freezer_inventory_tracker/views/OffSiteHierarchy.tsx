import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, MapPin, Layers, PackageOpen, Edit3, FileText } from 'lucide-react';
import { compareBoxLabels } from '../utils/boxSort';

export const OffSiteHierarchy = ({ state, dispatch }) => {
  const entries = (state.offSiteEntries || []).filter(e => {
    if (e.archived) return false;
    if (e.box && state.containers?.some(c => c.isBox && c.isArchived && c.name.toLowerCase().trim() === e.box.toLowerCase().trim())) {
      return false;
    }
    return true;
  });
  
  const [expandedLocs, setExpandedLocs] = useState<Record<string, boolean>>({});
  const [expandedPallets, setExpandedPallets] = useState<Record<string, boolean>>({});

  const [renamePalletModal, setRenamePalletModal] = useState<{ isOpen: boolean; oldName: string; newName: string } | null>(null);
  const [palletNotesModal, setPalletNotesModal] = useState<{ isOpen: boolean; palletId: string; palletName: string; notes: string } | null>(null);

  const handleRenamePallet = async () => {
    if (!renamePalletModal || !renamePalletModal.newName.trim() || renamePalletModal.newName === renamePalletModal.oldName) return;
    await dispatch({
      type: 'RENAME_PALLET',
      payload: {
        oldName: renamePalletModal.oldName,
        newName: renamePalletModal.newName
      }
    });
    setRenamePalletModal(null);
  };

  const handleSavePalletNotes = async () => {
    if (!palletNotesModal) return;
    await dispatch({
      type: 'UPDATE_PALLET_NOTES',
      payload: {
        palletId: palletNotesModal.palletId,
        notes: palletNotesModal.notes
      }
    });
    setPalletNotesModal(null);
  };

  const hierarchy = useMemo(() => {
    // Structure: Location -> Pallet -> Box -> Items
    const locMap: Record<string, {
      name: string;
      totalWeight: number;
      pallets: Record<string, {
        name: string;
        totalWeight: number;
        boxes: Record<string, {
          id: string;
          totalWeight: number;
          items: typeof entries;
        }>
      }>
    }> = {};

    const products = state.products || [];

    entries.forEach(rawE => {
      // Find matching product
      const cutsStr = (rawE.cuts || '').trim();
      const origStr = (rawE.originalCutName || '').trim();
      const normStr = (rawE.normalizedCutName || '').trim();

      let matchedProduct = null;
      if (normStr) {
        matchedProduct = products.find((p: any) => p.name.trim().toLowerCase() === normStr.toLowerCase());
      }
      if (!matchedProduct) {
        const getPrefixNumber = (str: string) => {
          const m = str.match(/^(\d+[a-zA-Z0-9-]*)/);
          return m ? m[1] : null;
        };
        const origNum = getPrefixNumber(origStr) || getPrefixNumber(cutsStr);
        if (origNum) {
          matchedProduct = products.find((p: any) => 
            p.productNumbers && p.productNumbers.some((num: string) => 
              num.toLowerCase() === origNum.toLowerCase()
            )
          );
        }
      }
      if (!matchedProduct) {
        const getNamePart = (str: string) => {
          const m = str.match(/^\d+\s+(.*)$/);
          return m ? m[1].trim() : str.trim();
        };
        const origNamePart = getNamePart(origStr) || getNamePart(cutsStr);
        if (origNamePart) {
          matchedProduct = products.find((p: any) => p.name.trim().toLowerCase() === origNamePart.toLowerCase());
        }
      }

      const e = {
        ...rawE,
        cuts: matchedProduct ? matchedProduct.name : (rawE.normalizedCutName || rawE.cuts),
      };

      const locName = e.location || 'Unassigned / Unknown';
      const palletName = e.currentLocation || 'Loose Items';
      const boxId = (e.box || '').trim() || 'Unassigned Box';

      if (!locMap[locName]) {
        locMap[locName] = { name: locName, totalWeight: 0, pallets: {} };
      }
      
      const locNode = locMap[locName];
      locNode.totalWeight += (e.netWeight || 0);

      if (!locNode.pallets[palletName]) {
        locNode.pallets[palletName] = { name: palletName, totalWeight: 0, boxes: {} };
      }

      const palletNode = locNode.pallets[palletName];
      palletNode.totalWeight += (e.netWeight || 0);

      if (!palletNode.boxes[boxId]) {
        palletNode.boxes[boxId] = { id: boxId, totalWeight: 0, items: [] };
      }

      const boxNode = palletNode.boxes[boxId];
      boxNode.totalWeight += (e.netWeight || 0);
      boxNode.items.push(e);
    });

    return locMap;
  }, [entries, state.products]);

  const toggleLoc = (loc: string) => setExpandedLocs(p => ({...p, [loc]: !p[loc]}));
  const togglePallet = (locPallet: string) => setExpandedPallets(p => ({...p, [locPallet]: !p[locPallet]}));

  const locKeys = Object.keys(hierarchy).sort();

  return (
    <div className="space-y-4" id="offsite-hierarchy-view">
      <div className="bg-cool-gray-800 p-4 rounded-xl border border-cool-gray-700 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers size={20} className="text-emerald-400" />
            Storage Hierarchy
          </h3>
          <p className="text-sm text-cool-gray-400 mt-1">Browse items by system location and pallet grouping.</p>
        </div>
      </div>

      <div className="space-y-3">
        {locKeys.map(locKey => {
          const locNode = hierarchy[locKey];
          const isLocExp = expandedLocs[locKey];
          const palletKeys = Object.keys(locNode.pallets).sort();

          return (
            <div key={locKey} className="bg-cool-gray-850 rounded-2xl border border-cool-gray-750 overflow-hidden shadow-xs">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-cool-gray-800 transition-colors"
                onClick={() => toggleLoc(locKey)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${isLocExp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cool-gray-800 text-cool-gray-400'}`}>
                    {isLocExp ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={18} className="text-emerald-500" />
                    <span className="font-bold text-white text-lg">{locNode.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-cool-gray-400">{palletKeys.length} Pallets</span>
                  <span className="bg-cool-gray-800 px-3 py-1 rounded-full text-sm font-bold text-emerald-400 border border-cool-gray-700">
                    {locNode.totalWeight.toFixed(2)} lbs
                  </span>
                </div>
              </div>

              {isLocExp && (
                <div className="p-4 border-t border-cool-gray-750 bg-cool-gray-900/50 space-y-3">
                  {palletKeys.map(pKey => {
                    const pNode = locNode.pallets[pKey];
                    const pId = `${locKey}-${pKey}`;
                    const isPExp = expandedPallets[pId];
                    const boxKeys = Object.keys(pNode.boxes).sort(compareBoxLabels);

                    const palletObj = (state.pallets || []).find((p: any) => 
                      p.name?.toLowerCase().trim() === pNode.name.toLowerCase().trim() || 
                      p.id?.toLowerCase().trim() === pNode.name.toLowerCase().trim()
                    );
                    const palletNotes = palletObj?.notes || '';

                    return (
                      <div key={pKey} className="bg-cool-gray-800 rounded-xl border border-cool-gray-700 overflow-hidden">
                        <div 
                          className="p-3 flex items-center justify-between cursor-pointer hover:bg-cool-gray-750 transition-colors"
                          onClick={() => togglePallet(pId)}
                        >
                          <div className="flex items-center gap-3 group">
                            <div className="text-cool-gray-500">
                              {isPExp ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>
                            <span className="font-bold text-cool-gray-200">{pNode.name}</span>
                            {palletNotes && (
                              <span 
                                className="text-xs text-cyan-300 bg-cyan-950/60 border border-cyan-850 rounded px-1.5 py-0.5 max-w-[200px] truncate cursor-help select-none flex items-center gap-1"
                                title={palletNotes}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPalletNotesModal({
                                    isOpen: true,
                                    palletId: palletObj?.id || pNode.name,
                                    palletName: pNode.name,
                                    notes: palletNotes
                                  });
                                }}
                              >
                                <FileText size={10} className="text-cyan-400" />
                                {palletNotes}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamePalletModal({ isOpen: true, oldName: pNode.name, newName: pNode.name });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-cool-gray-500 hover:text-amber-400 transition-all rounded hover:bg-cool-gray-700 cursor-pointer"
                              title="Rename Pallet"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPalletNotesModal({
                                  isOpen: true,
                                  palletId: palletObj?.id || pNode.name,
                                  palletName: pNode.name,
                                  notes: palletNotes
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-cool-gray-500 hover:text-cyan-400 transition-all rounded hover:bg-cool-gray-700 cursor-pointer"
                              title="Pallet Notes"
                            >
                              <FileText size={14} />
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-cool-gray-400">{boxKeys.length} Boxes</span>
                            <span className="text-sm font-bold text-cool-gray-300">{pNode.totalWeight.toFixed(2)} lbs</span>
                          </div>
                        </div>

                        {isPExp && (
                          <div className="p-3 border-t border-cool-gray-700 bg-cool-gray-850 space-y-2">
                            {boxKeys.map(bKey => {
                              const bNode = pNode.boxes[bKey];
                              return (
                                <div key={bKey} className="flex items-start justify-between bg-cool-gray-900 p-2.5 rounded-lg border border-cool-gray-750/50">
                                  <div>
                                    <div className="font-mono text-sm font-bold text-emerald-400 flex items-center gap-2 flex-wrap">
                                      <PackageOpen size={14} className="text-emerald-500/50" />
                                      {bNode.id}
                                    </div>
                                    <div className="text-xs text-cool-gray-400 mt-1">
                                      {bNode.items.length} items
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-bold text-cool-gray-300">{bNode.totalWeight.toFixed(2)} lbs</div>
                                    <div className="text-xs text-cool-gray-500 mt-1">{Array.from(new Set(bNode.items.map(i => i.cuts))).join(', ')}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {locKeys.length === 0 && (
          <div className="p-12 text-center text-cool-gray-500 bg-cool-gray-850 rounded-2xl border border-cool-gray-750">
            No items registered in the system yet.
          </div>
        )}
      </div>

      {renamePalletModal?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-white mb-2">Rename Pallet</h3>
            <p className="text-sm text-cool-gray-400 mb-4">
              Renaming <span className="font-mono text-amber-400">{renamePalletModal.oldName}</span> will update all existing off-site items and movement targets using this pallet.
            </p>
            <input
              type="text"
              value={renamePalletModal.newName || ''}
              onChange={(e) => setRenamePalletModal({ ...renamePalletModal, newName: e.target.value })}
              className="w-full bg-cool-gray-950 border border-cool-gray-800 rounded-xl p-3 text-white mb-6 focus:border-amber-500 focus:outline-none"
              placeholder="New Pallet Name"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRenamePalletModal(null)}
                className="px-4 py-2 rounded-xl text-cool-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRenamePallet}
                disabled={!renamePalletModal.newName.trim() || renamePalletModal.newName === renamePalletModal.oldName}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {palletNotesModal?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <FileText size={18} className="text-cyan-400" />
              Pallet Notes
            </h3>
            <p className="text-xs text-cool-gray-400 mb-4">
              Add or edit notes for pallet <span className="font-mono text-cyan-400">{palletNotesModal.palletName}</span>.
            </p>
            <textarea
              value={palletNotesModal.notes || ''}
              onChange={(e) => setPalletNotesModal({ ...palletNotesModal, notes: e.target.value })}
              className="w-full bg-cool-gray-950 border border-cool-gray-800 rounded-xl p-3 text-white mb-6 focus:border-cyan-500 focus:outline-none text-sm min-h-[100px] resize-y"
              placeholder="Enter notes about this pallet..."
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPalletNotesModal(null)}
                className="px-4 py-2 rounded-xl text-cool-gray-400 hover:text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePalletNotes}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition-colors cursor-pointer"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
