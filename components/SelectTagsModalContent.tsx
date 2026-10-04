// Select tags modal content component
import React, { useState } from 'react';
import { InventoryState, Action } from '../types';
import { Tag, CheckSquare, Square, Trash2 } from 'lucide-react';

interface SelectTagsModalContentProps {
  dispatch: React.Dispatch<Action>;
  state: InventoryState;
  meatCutId?: string;
  offSiteEntryId?: string;
  onClose: () => void;
}

export const SelectTagsModalContent: React.FC<SelectTagsModalContentProps> = ({ dispatch, state, meatCutId, offSiteEntryId, onClose }) => {
  const meatCut = meatCutId ? state.meatCuts.find(mc => mc.id === meatCutId) : null;
  const offSiteEntry = offSiteEntryId ? (state.offSiteEntries || []).find(e => e.id === offSiteEntryId) : null;
  const tags = state.tags || [];

  const initialTagIds = meatCut?.tagIds || offSiteEntry?.tagIds || [];
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => [...initialTagIds]);

  if (!meatCut && !offSiteEntry) {
    return (
      <div className="p-4 text-center text-red-400">
        Inventory item not found.
      </div>
    );
  }

  const product = meatCut ? state.products.find(p => p.id === meatCut.productId) : null;
  const container = meatCut ? state.containers.find(c => c.id === meatCut.containerId) : null;

  const itemName = meatCut 
    ? (product?.name || 'Unknown Product')
    : (offSiteEntry?.cuts || offSiteEntry?.originalCutName || 'Off-Site Item');

  const locationInfo = meatCut
    ? (container?.name || 'Unknown Container')
    : (`${offSiteEntry?.location || 'Off-Site'}${offSiteEntry?.currentLocation ? ` • Pallet: ${offSiteEntry.currentLocation}` : ''}${offSiteEntry?.box ? ` • Box: ${offSiteEntry.box}` : ''}`);

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleClearAll = () => {
    setSelectedTagIds([]);
  };

  const handleSave = async () => {
    if (offSiteEntryId) {
      await dispatch({
        type: 'UPDATE_OFFSITE_ENTRY',
        payload: {
          id: offSiteEntryId,
          updates: { tagIds: selectedTagIds }
        }
      });
      onClose();
      return;
    }

    if (meatCutId && meatCut) {
      const initialTags = meatCut.tagIds || [];
      const tagsToAdd = selectedTagIds.filter(id => !initialTags.includes(id));
      const tagsToRemove = initialTags.filter(id => !selectedTagIds.includes(id));

      for (const tagId of tagsToAdd) {
        await dispatch({
          type: 'TOGGLE_MEAT_TAG',
          payload: { meatCutId, tagId }
        });
      }

      for (const tagId of tagsToRemove) {
        await dispatch({
          type: 'TOGGLE_MEAT_TAG',
          payload: { meatCutId, tagId }
        });
      }

      onClose();
    }
  };

  return (
    <div className="flex flex-col gap-4 p-2 text-sm">
      <div className="bg-cool-gray-850 p-3 rounded-lg border border-cool-gray-750">
        <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block mb-0.5">Item Info</label>
        <span className="text-base font-extrabold text-cool-gray-100">{itemName}</span>
        <span className="text-xs text-cool-gray-400 block mt-0.5">
          Located in: <span className="text-amber-400 font-semibold">{locationInfo}</span>
        </span>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-cyan-400" /> Select Tags for this Item:
        </div>
        {selectedTagIds.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[11px] text-red-400 hover:text-red-300 font-bold px-2 py-0.5 rounded bg-red-950/40 border border-red-800/40 hover:bg-red-900/60 transition cursor-pointer flex items-center gap-1 shrink-0"
            title="Remove all tags from item"
          >
            <Trash2 size={12} /> Clear All
          </button>
        )}
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-6 text-cool-gray-500 bg-cool-gray-850 rounded-lg border border-dashed border-cool-gray-800">
          No custom tags configured.
          <p className="text-[10px] text-cool-gray-600 mt-1">Please configure tags in Catalog &gt; Tags first</p>
        </div>
      ) : (
        <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
          {tags.map(tag => {
            const hasTag = selectedTagIds.includes(tag.id);
            return (
              <div 
                key={tag.id} 
                className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                  hasTag 
                    ? 'bg-cyan-950/20 border-cyan-500/30' 
                    : 'bg-cool-gray-850/40 border-cool-gray-800 hover:border-cool-gray-700'
                }`}
                onClick={() => handleToggleTag(tag.id)}
              >
                <div className="flex-grow">
                  <div className="flex items-center gap-2">
                    <span 
                      style={{ 
                        color: tag.color, 
                        borderColor: tag.color ? `${tag.color}35` : '#3b82f635',
                        backgroundColor: tag.color ? `${tag.color}20` : '#3b82f620'
                      }}
                      className="px-2 py-0.5 rounded text-xs font-black border uppercase tracking-wider inline-flex items-center gap-1 select-none"
                    >
                      <span>{tag.id === 'use-first' ? '⚡' : tag.id === 'not-for-sale' ? '🛑' : '🏷️'}</span>
                      <span>{tag.name}</span>
                    </span>
                  </div>
                  {tag.description && (
                    <div className="text-xs text-cool-gray-400 mt-1.5 leading-relaxed">{tag.description}</div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleTag(tag.id);
                  }}
                  className={`p-1 rounded transition-colors flex items-center justify-center cursor-pointer ${
                    hasTag 
                      ? 'text-cyan-455' 
                      : 'text-cool-gray-500 hover:text-cool-gray-300'
                  }`}
                >
                  {hasTag ? (
                    <CheckSquare className="w-5 h-5 text-cyan-450 fill-cyan-450/10" />
                  ) : (
                    <Square className="w-5 h-5 text-cool-gray-600" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-cool-gray-850">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-650 text-cool-gray-100 hover:text-white border border-cool-gray-600 font-semibold rounded-lg transition text-xs cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold rounded-lg transition text-xs shadow-md cursor-pointer"
        >
          OK
        </button>
      </div>
    </div>
  );
};
