import React, { useState } from 'react';
import { InventoryState, Action } from '../types';
import { GitFork, Tag, AlertTriangle, Check, Minus, Plus } from 'lucide-react';

interface SplitItemModalContentProps {
  dispatch: React.Dispatch<Action>;
  state: InventoryState;
  meatCutId: string;
  onClose: () => void;
}

export const SplitItemModalContent: React.FC<SplitItemModalContentProps> = ({
  dispatch,
  state,
  meatCutId,
  onClose
}) => {
  const meatCut = state.meatCuts.find(mc => mc.id === meatCutId);
  const tags = state.tags || [];

  if (!meatCut) {
    return (
      <div className="p-4 text-center text-red-400">
        Inventory item not found.
      </div>
    );
  }

  const product = state.products.find(p => p.id === meatCut.productId);
  const container = state.containers.find(c => c.id === meatCut.containerId);

  const maxSplitQuantity = Math.max(1, meatCut.quantity - 1);
  const [splitQuantity, setSplitQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>(meatCut.notes || '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([...(meatCut.tagIds || [])]);

  const sourceNotesNorm = (meatCut.notes || '').trim();
  const currentNotesNorm = notes.trim();

  const sourceTagIdsSorted = [...(meatCut.tagIds || [])].sort().join(',');
  const currentTagIdsSorted = [...selectedTagIds].sort().join(',');

  const isIdentical = currentNotesNorm === sourceNotesNorm && currentTagIdsSorted === sourceTagIdsSorted;

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSplitSubmit = () => {
    if (isIdentical || splitQuantity < 1 || splitQuantity >= meatCut.quantity) return;

    dispatch({
      type: 'SPLIT_MEAT_CUT',
      payload: {
        meatCutId: meatCut.id,
        splitQuantity,
        notes: currentNotesNorm,
        tagIds: selectedTagIds
      }
    });

    onClose();
  };

  return (
    <div className="flex flex-col gap-4 p-1 text-sm text-left select-none">
      {/* Header Info */}
      <div className="bg-cool-gray-850 p-3 rounded-lg border border-cool-gray-750 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block mb-0.5">Source Item</label>
          <span className="text-base font-extrabold text-amber-400 truncate block">{product?.name || 'Unknown Product'}</span>
          <span className="text-xs text-cool-gray-400 block mt-0.5">
            Location: <span className="text-cyan-400 font-semibold">{container?.name || 'Unknown Container'}</span>
          </span>
        </div>
        <div className="text-right bg-cool-gray-800 px-3 py-2 rounded-lg border border-cool-gray-700 flex-shrink-0">
          <span className="text-[10px] text-cool-gray-400 block font-bold uppercase">Current Total</span>
          <span className="text-lg font-black text-white">{meatCut.quantity} <span className="text-xs font-normal text-cool-gray-400">pkgs</span></span>
        </div>
      </div>

      {/* Split Quantity Selector */}
      <div className="bg-cool-gray-850 p-3 rounded-lg border border-cool-gray-750 space-y-2">
        <label className="text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider flex items-center justify-between">
          <span>Packages to Split Off:</span>
          <span className="text-cyan-400 font-extrabold text-sm">{splitQuantity} of {meatCut.quantity}</span>
        </label>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSplitQuantity(prev => Math.max(1, prev - 1))}
            disabled={splitQuantity <= 1}
            className="p-2 rounded-lg bg-cool-gray-700 hover:bg-cool-gray-600 disabled:opacity-30 disabled:hover:bg-cool-gray-700 text-white font-bold transition cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>

          <input
            type="range"
            min={1}
            max={maxSplitQuantity}
            value={splitQuantity}
            onChange={(e) => setSplitQuantity(Number(e.target.value))}
            className="flex-1 accent-cyan-450 cursor-pointer h-2 bg-cool-gray-700 rounded-lg"
          />

          <button
            type="button"
            onClick={() => setSplitQuantity(prev => Math.min(maxSplitQuantity, prev + 1))}
            disabled={splitQuantity >= maxSplitQuantity}
            className="p-2 rounded-lg bg-cool-gray-700 hover:bg-cool-gray-600 disabled:opacity-30 disabled:hover:bg-cool-gray-700 text-white font-bold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-cool-gray-400">
          Remaining in main group: <span className="font-bold text-white">{meatCut.quantity - splitQuantity}</span> packages.
        </p>
      </div>

      {/* Distinction Warning Requirement */}
      {isIdentical && (
        <div className="bg-amber-950/40 border border-amber-500/50 p-3 rounded-lg flex items-start gap-2.5 text-amber-200 animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-amber-300">Unique Note or Tag Required</p>
            <p className="text-amber-200/90 leading-relaxed">
              To split packages into a distinct row, you must specify a unique note (e.g. <em>"For Dog"</em>) or change its tags below so it is distinguishable from the main group.
            </p>
          </div>
        </div>
      )}

      {/* Notes Input */}
      <div>
        <label className="block text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider mb-1">
          Note for Split Packages: <span className="text-amber-400 font-normal">(Required if tags unchanged)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Extra Lean, For Dog, Smaller Portions..."
          className="w-full text-sm bg-cool-gray-800 border border-cool-gray-650 p-2.5 rounded-lg text-cool-gray-100 focus:ring-1 focus:ring-cyan-500 outline-none h-20 resize-y"
        />
      </div>

      {/* Tags Selector */}
      <div>
        <label className="text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
          <Tag className="w-3.5 h-3.5 text-cyan-400" /> Tags for Split Group:
        </label>
        
        {tags.length === 0 ? (
          <p className="text-xs text-cool-gray-500 italic">No tags configured in system.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
            {tags.map(tag => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggleTag(tag.id)}
                  style={{
                    backgroundColor: isSelected ? `${tag.color || '#06b6d4'}25` : undefined,
                    borderColor: isSelected ? tag.color || '#06b6d4' : undefined,
                    color: isSelected ? tag.color || '#38bdf8' : undefined
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'border-cyan-500 text-cyan-300'
                      : 'bg-cool-gray-800 border-cool-gray-700 text-cool-gray-400 hover:text-cool-gray-200 hover:border-cool-gray-600'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                  <span>{tag.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="flex justify-end gap-2.5 pt-3 border-t border-cool-gray-800 mt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSplitSubmit}
          disabled={isIdentical}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <GitFork className="w-3.5 h-3.5" />
          <span>Split {splitQuantity} Package{splitQuantity > 1 ? 's' : ''}</span>
        </button>
      </div>
    </div>
  );
};

export default SplitItemModalContent;
