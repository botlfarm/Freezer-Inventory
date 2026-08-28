import React, { useState } from 'react';
import { InventoryState, Action } from '../types';
import { Tag, CheckSquare, Square } from 'lucide-react';

interface SelectTagsModalContentProps {
  dispatch: React.Dispatch<Action>;
  state: InventoryState;
  meatCutId: string;
  onClose: () => void;
}

export const SelectTagsModalContent: React.FC<SelectTagsModalContentProps> = ({ dispatch, state, meatCutId, onClose }) => {
  const meatCut = state.meatCuts.find(mc => mc.id === meatCutId);
  const tags = state.tags || [];

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => [...(meatCut?.tagIds || [])]);

  if (!meatCut) {
    return (
      <div className="p-4 text-center text-red-400">
        Inventory item not found.
      </div>
    );
  }

  const product = state.products.find(p => p.id === meatCut.productId);
  const container = state.containers.find(c => c.id === meatCut.containerId);

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSave = () => {
    const initialTags = meatCut.tagIds || [];
    const tagsToAdd = selectedTagIds.filter(id => !initialTags.includes(id));
    const tagsToRemove = initialTags.filter(id => !selectedTagIds.includes(id));

    tagsToAdd.forEach(tagId => {
      dispatch({
        type: 'TOGGLE_MEAT_TAG',
        payload: { meatCutId, tagId }
      });
    });

    tagsToRemove.forEach(tagId => {
      dispatch({
        type: 'TOGGLE_MEAT_TAG',
        payload: { meatCutId, tagId }
      });
    });

    onClose();
  };

  return (
    <div className="flex flex-col gap-4 p-2 text-sm">
      <div className="bg-cool-gray-850 p-3 rounded-lg border border-cool-gray-750">
        <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block mb-0.5">Item Info</label>
        <span className="text-base font-extrabold text-cool-gray-100">{product?.name || 'Unknown Product'}</span>
        <span className="text-xs text-cool-gray-400 block mt-0.5">
          Located in: <span className="text-amber-400 font-semibold">{container?.name || 'Unknown Container'}</span>
        </span>
      </div>

      <div className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider mt-2 flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5 text-cyan-400" /> Select Tags for this Item:
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
