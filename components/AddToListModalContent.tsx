import React, { useState } from 'react';
import { InventoryState, Action } from '../types';
import { ClipboardList, CheckSquare, Square, FileText } from 'lucide-react';

interface AddToListModalContentProps {
  dispatch: React.Dispatch<Action>;
  state: InventoryState;
  productId: string;
  onClose: () => void;
}

export const AddToListModalContent: React.FC<AddToListModalContentProps> = ({ dispatch, state, productId, onClose }) => {
  const product = state.products.find(p => p.id === productId);
  const customLists = state.customLists || [];

  const [localListState, setLocalListState] = useState<Record<string, { isOnList: boolean; notes: string }>>(() => {
    const initial: Record<string, { isOnList: boolean; notes: string }> = {};
    customLists.forEach(cl => {
      const item = cl.items.find(i => i.productId === productId);
      initial[cl.id] = {
        isOnList: !!item,
        notes: item?.notes || ''
      };
    });
    return initial;
  });

  if (!product) {
    return (
      <div className="p-4 text-center text-red-400">
        Product not found.
      </div>
    );
  }

  const handleToggle = (listId: string) => {
    setLocalListState(prev => {
      const current = prev[listId] || { isOnList: false, notes: '' };
      return {
        ...prev,
        [listId]: {
          ...current,
          isOnList: !current.isOnList
        }
      };
    });
  };

  const handleNoteChange = (listId: string, notes: string) => {
    setLocalListState(prev => {
      const current = prev[listId] || { isOnList: false, notes: '' };
      return {
        ...prev,
        [listId]: {
          ...current,
          notes
        }
      };
    });
  };

  const handleSave = () => {
    customLists.forEach(cl => {
      const initialItem = cl.items.find(i => i.productId === productId);
      const initialIsOnList = !!initialItem;
      const initialNotes = initialItem?.notes || '';

      const current = localListState[cl.id] || { isOnList: false, notes: '' };

      if (current.isOnList !== initialIsOnList) {
        dispatch({
          type: 'TOGGLE_PRODUCT_ON_LIST',
          payload: {
            listId: cl.id,
            productId,
            notes: current.isOnList ? current.notes : undefined,
            forceState: current.isOnList
          }
        });
      } else if (current.isOnList && current.notes !== initialNotes) {
        dispatch({
          type: 'UPDATE_LIST_ITEM_NOTE',
          payload: {
            listId: cl.id,
            productId,
            notes: current.notes
          }
        });
      }
    });

    onClose();
  };

  return (
    <div className="flex flex-col gap-4 p-2 text-sm">
      <div className="bg-cool-gray-850 p-3 rounded-lg border border-cool-gray-750">
        <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block mb-0.5">Product Name</label>
        <span className="text-base font-extrabold text-cool-gray-100">{product.name}</span>
        <span className="text-xs text-cool-gray-400 block mt-0.5">{product.primaryCategory} &gt; {product.subCategory}</span>
      </div>

      <div className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider mt-2 flex items-center gap-1.5">
        <ClipboardList className="w-3.5 h-3.5 text-cyan-400" /> Choose Lists to Add to:
      </div>

      {customLists.length === 0 ? (
        <div className="text-center py-6 text-cool-gray-500 bg-cool-gray-850 rounded-lg border border-dashed border-cool-gray-800">
          No customizable lists configured.
          <p className="text-[10px] text-cool-gray-600 mt-1">Please create lists in Catalog &gt; Lists first</p>
        </div>
      ) : (
        <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
          {customLists.map(cl => {
            const listData = localListState[cl.id] || { isOnList: false, notes: '' };
            const isOnList = listData.isOnList;
            return (
              <div 
                key={cl.id} 
                className={`p-3 rounded-xl border transition ${
                  isOnList 
                    ? 'bg-cyan-950/20 border-cyan-500/30' 
                    : 'bg-cool-gray-850/40 border-cool-gray-800 hover:border-cool-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-grow">
                    <div className="font-extrabold text-cool-gray-200 flex items-center gap-2">
                      {cl.name}
                      {cl.isInventoryControlled && (
                        <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-800/40 px-1.5 py-0.2 rounded-full font-bold uppercase">
                          Auto-Managed
                        </span>
                      )}
                    </div>
                    {cl.description && (
                      <div className="text-xs text-cool-gray-400 mt-0.5">{cl.description}</div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggle(cl.id)}
                    className={`p-1 rounded transition-colors flex items-center justify-center cursor-pointer ${
                      isOnList 
                        ? 'text-cyan-450 hover:bg-cyan-900/30' 
                        : 'text-cool-gray-500 hover:text-cool-gray-300 hover:bg-cool-gray-750'
                    }`}
                  >
                    {isOnList ? (
                      <CheckSquare className="w-5 h-5 text-cyan-450 fill-cyan-450/10" />
                    ) : (
                      <Square className="w-5 h-5 text-cool-gray-600" />
                    )}
                  </button>
                </div>

                {isOnList && cl.allowNotes && (
                  <div className="mt-2.5 pt-2 border-t border-cool-gray-800/80 animate-fade-in">
                    <label className="text-[10px] font-bold text-cool-gray-450 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <FileText className="w-3 h-3 text-cyan-500" /> Item Notes
                    </label>
                    <input
                      type="text"
                      value={listData.notes || ''}
                      onChange={e => handleNoteChange(cl.id, e.target.value)}
                      placeholder="Add specific list notes (e.g. check prices, stock limits...)"
                      className="w-full bg-cool-gray-900 border border-cool-gray-750/70 rounded-md px-2.5 py-1.5 text-xs text-cool-gray-100 placeholder-cool-gray-550 focus:outline-none focus:border-cyan-500 transition"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-cool-gray-800">
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
