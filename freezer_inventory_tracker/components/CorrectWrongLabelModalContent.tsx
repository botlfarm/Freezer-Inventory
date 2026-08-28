import React, { useState } from 'react';
import { Action, InventoryState } from '../types';
import { SearchableProductSelect } from './SearchableProductSelect';
import { AlertTriangle } from 'lucide-react';

interface CorrectWrongLabelModalContentProps {
  dispatch: React.Dispatch<Action>;
  state: InventoryState;
  meatCutId: string;
  onClose: () => void;
}

export const CorrectWrongLabelModalContent: React.FC<CorrectWrongLabelModalContentProps> = ({ 
  dispatch, 
  state,
  meatCutId, 
  onClose 
}) => {
  const meatCut = state.meatCuts.find(m => m.id === meatCutId);
  const currentProduct = meatCut ? state.products.find(p => p.id === meatCut.productId) : null;

  const [selectedProductId, setSelectedProductId] = useState<string>(meatCut?.productId || '');
  const [notes, setNotes] = useState<string>(meatCut?.notes || '');

  if (!meatCut || !currentProduct) {
    return (
      <div className="text-red-400 text-sm py-4">
        Error: Item or product definition not found.
      </div>
    );
  }

  const handleSave = () => {
    if (!selectedProductId) return;
    dispatch({ 
      type: 'CORRECT_MEAT_LABEL', 
      payload: { 
        meatCutId, 
        correctProductId: selectedProductId,
        notes: notes.trim() || undefined
      } 
    });
    onClose();
  };

  return (
    <div className="space-y-4 text-left">
      <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div className="text-xs text-cool-gray-300 space-y-1">
          <p className="font-bold text-cool-gray-200">Marking Labeled Wrong</p>
          <p>
            You are correcting a wrong label. The current wrong label <strong className="text-amber-400">"{currentProduct.name}"</strong> will be preserved in the <code className="bg-cool-gray-800 px-1 py-0.5 rounded text-red-400 font-mono">⚠️ Labeled As</code> tag for historical record.
          </p>
        </div>
      </div>

      {(Boolean(meatCut.wrongLabel || meatCut.isWrongLabel || meatCut.originalCutName)) && (
        <div className="p-3 bg-cyan-950/25 border border-cyan-800/40 rounded-lg flex items-center justify-between gap-3">
          <div className="text-xs text-cool-gray-300">
            <span className="font-bold text-cyan-400 block">Previously Corrected</span>
            This item's physical label was originally <strong className="text-red-400">"{
              (meatCut.wrongLabel ? state.products.find(p => p.id === meatCut.wrongLabel)?.name : null) || meatCut.originalCutName || 'Original Cut'
            }"</strong>.
          </div>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'REVERT_MEAT_LABEL', payload: { meatCutId } });
              onClose();
            }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[10.5px] rounded transition cursor-pointer shrink-0 shadow-md"
          >
            Undo & Revert
          </button>
        </div>
      )}

      <div>
        <label className="block text-[11px] text-cool-gray-400 font-bold mb-1.5 uppercase tracking-wide">
          1. Select the CORRECT Cut / Product from Catalog
        </label>
        <SearchableProductSelect
          products={state.products}
          value={selectedProductId}
          onChange={setSelectedProductId}
          placeholder="Search correct catalog product..."
          autoFocus={true}
        />
        <p className="text-[10px] text-cool-gray-500 mt-1">
          This will update the item's main identity to the selected product.
        </p>
      </div>

      <div>
        <label className="block text-[11px] text-cool-gray-400 font-bold mb-1.5 uppercase tracking-wide">
          2. Add Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full text-sm bg-cool-gray-800 border border-cool-gray-650 p-3 rounded-lg text-cool-gray-100 focus:ring-1 focus:ring-cyan-500 outline-none h-24 min-h-[60px] resize-y"
          placeholder="Any additional notes about this label discrepancy..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button 
          type="button"
          onClick={onClose} 
          className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
        >
          Cancel
        </button>
        <button 
          type="button"
          onClick={handleSave} 
          disabled={!selectedProductId || selectedProductId === meatCut.productId}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer text-white ${
            !selectedProductId || selectedProductId === meatCut.productId
              ? 'bg-cyan-800/40 text-cool-gray-400 cursor-not-allowed'
              : 'bg-cyan-600 hover:bg-cyan-500 shadow-lg'
          }`}
        >
          Save Correct Label
        </button>
      </div>
    </div>
  );
};
