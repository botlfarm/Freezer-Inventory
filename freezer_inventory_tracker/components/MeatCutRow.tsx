import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MeatCut, ModalType, Action, InventoryState } from '../types';
import { PlusIcon, MinusIcon, MeatIcon } from './icons';
import { MoreVertical, Move, History, Trash2, Search, Tag, Edit, Package, AlertTriangle, GitFork, Combine } from 'lucide-react';

interface MeatCutRowProps {
  meatCut: MeatCut;
  dispatch: React.Dispatch<Action>;
  openModal: (modal: ModalType) => void;
  state: InventoryState;
  isDimmed: boolean;
  onFindProduct: (productId: string) => void;
  isMenuExpanded?: boolean;
  onMenuExpandToggle?: (isOpen: boolean) => void;
}

const MeatCutRow: React.FC<MeatCutRowProps> = ({ 
  meatCut, 
  dispatch, 
  openModal, 
  state, 
  isDimmed, 
  onFindProduct,
  isMenuExpanded,
  onMenuExpandToggle
}) => {
  const [localQuantity, setLocalQuantity] = useState(meatCut.quantity.toString());
  const [isEditing, setIsEditing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const lastQuantityRef = useRef<number>(meatCut.quantity);
  const lastDispatchedQuantityRef = useRef<number | null>(null);

  // Parse and evaluate math deltas like +20 or -6
  const evaluateMathExpression = (input: string, baseValue: number): number | null => {
    const sanitized = input.replace(/\s+/g, '');
    
    // Check for explicit delta prefix e.g., "+20" or "-6"
    if (sanitized.startsWith('+') || sanitized.startsWith('-')) {
      try {
        const delta = parseInt(sanitized, 10);
        if (!isNaN(delta)) {
          return Math.max(0, baseValue + delta);
        }
      } catch (e) {}
    }
    
    // Check for inline math expression e.g., "12+20"
    if (/^\d+[\+\-]\d+$/.test(sanitized)) {
      try {
        const match = sanitized.match(/^(\d+)([\+\-])(\d+)$/);
        if (match) {
          const op1 = parseInt(match[1], 10);
          const sign = match[2];
          const op2 = parseInt(match[3], 10);
          if (sign === '+') return op1 + op2;
          if (sign === '-') return Math.max(0, op1 - op2);
        }
      } catch (e) {}
    }
    
    const parsedInt = parseInt(sanitized, 10);
    if (!isNaN(parsedInt)) return Math.max(0, parsedInt);
    return null;
  };

  useEffect(() => {
    // Sync with global state if it changes
    // Only update if we are not actively editing, AND if either:
    // 1. lastDispatchedQuantityRef is null (not in a click sequence)
    // 2. The incoming meatCut.quantity has caught up to our last dispatched quantity
    if (lastDispatchedQuantityRef.current === null || meatCut.quantity === lastDispatchedQuantityRef.current) {
      lastQuantityRef.current = meatCut.quantity;
      if (!isEditing) {
        setLocalQuantity(meatCut.quantity.toString());
      }
      lastDispatchedQuantityRef.current = null; // Clear out since we've caught up
    }
  }, [meatCut.quantity, isEditing]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    if (isMenuOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // 9-item dropdown is ~280px tall. 300px filter is perfect.
      setOpenUpwards(spaceBelow < 300);
    }
  }, [isMenuOpen]);

  useEffect(() => {
    onMenuExpandToggle?.(isMenuOpen);
  }, [isMenuOpen, onMenuExpandToggle]);

  useEffect(() => {
    if (isMenuExpanded === false) {
      setIsMenuOpen(false);
    }
  }, [isMenuExpanded]);

  const handleQuantityChange = (amount: number) => {
    const newQuantity = Math.max(0, lastQuantityRef.current + amount);
    lastQuantityRef.current = newQuantity;
    lastDispatchedQuantityRef.current = newQuantity;
    setLocalQuantity(newQuantity.toString());
    dispatch({ type: 'UPDATE_MEAT_QUANTITY', payload: { meatCutId: meatCut.id, newQuantity } });
  };
  
  const handleDirectInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuantity(e.target.value);
  };

  const handleCommitQuantity = () => {
    const evaluated = evaluateMathExpression(localQuantity, meatCut.quantity);
    if (evaluated !== null && evaluated >= 0 && evaluated !== meatCut.quantity) {
      lastQuantityRef.current = evaluated;
      lastDispatchedQuantityRef.current = evaluated;
      dispatch({ type: 'UPDATE_MEAT_QUANTITY', payload: { meatCutId: meatCut.id, newQuantity: evaluated } });
    } else {
      // Revert if formula is invalid or evaluated same
      setLocalQuantity(meatCut.quantity.toString());
    }
  };

  // Drag and drop start handler for inventory items
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation(); // Stop event propagation to prevent triggering parent container dragging!
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'meat-cut',
      id: meatCut.id,
      productId: meatCut.productId,
      containerId: meatCut.containerId,
      quantity: meatCut.quantity,
      notes: meatCut.notes,
      tagIds: meatCut.tagIds,
      originalCutName: meatCut.originalCutName,
      name: product?.name || 'Unknown Item'
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const product = state.products.find(p => p.id === meatCut.productId);

  if (!product) {
      return (
          <div className="flex items-center justify-between bg-red-900/50 p-2 rounded-md">
              <p className="text-red-300">Error: Product definition not found.</p>
          </div>
      );
  }

  const parentContainer = state.containers.find(c => c.id === meatCut.containerId);
  const isDraggable = parentContainer ? !parentContainer.freezerId : false;
  
  const siblingCuts = state.meatCuts.filter(mc => mc.containerId === meatCut.containerId && mc.productId === meatCut.productId);
  const isSplitVariant = siblingCuts.length > 1;
  const splitIndex = isSplitVariant ? siblingCuts.findIndex(mc => mc.id === meatCut.id) + 1 : 1;

  const handleClearNotesAndTags = () => {
    dispatch({ 
      type: 'UPDATE_MEAT_NOTES', 
      payload: { 
        meatCutId: meatCut.id, 
        notes: '', 
        originalCutName: meatCut.originalCutName 
      } 
    });
    if (meatCut.tagIds && meatCut.tagIds.length > 0) {
      meatCut.tagIds.forEach(tagId => {
        dispatch({ type: 'TOGGLE_MEAT_TAG', payload: { meatCutId: meatCut.id, tagId } });
      });
    }
  };
  
  return (
    <div 
      draggable={isDraggable}
      onDragStart={isDraggable ? handleDragStart : undefined}
      style={isSplitVariant ? { borderLeftColor: 'var(--ha-accent-color, #fbbf24)' } : undefined}
      className={`flex items-center justify-between p-1 sm:p-1.5 rounded-md group border transition-all duration-300 gap-1 sm:gap-1.5 ${isSplitVariant ? 'border-l-4 border-l-amber-400' : ''} ${(isDimmed && !isMenuOpen) ? 'opacity-30' : 'opacity-100'} ${isMenuOpen ? 'relative z-50 bg-cool-gray-800 shadow-xl border-cool-gray-600' : 'relative z-0 bg-cool-gray-700/40 hover:bg-cool-gray-700/60 border-transparent hover:border-cool-gray-600'} ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {isSplitVariant && (
        <div 
          className="w-1.5 self-stretch rounded-full bg-amber-400 shrink-0 my-0.5 shadow-sm"
          style={{ backgroundColor: 'var(--ha-accent-color, #fbbf24)' }}
          title={`Split variant ${splitIndex} of ${siblingCuts.length}`}
        />
      )}
      {isDraggable && (
        <div className="flex items-center gap-2 text-cool-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Drag to move item to another container">
          <Move className="w-3.5 h-3.5 pointer-events-none hidden sm:block" />
        </div>
      )}

      <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0 select-none">
        {product.imageUrl ? (
            <img 
              src={product.imageUrl} 
              alt={product.name} 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-md object-cover flex-shrink-0 shadow cursor-zoom-in hover:scale-115 active:scale-90 transition-transform duration-200" 
              referrerPolicy="no-referrer" 
              onClick={(e) => {
                e.stopPropagation();
                (window as any).__showImagePreview?.(product.imageUrl, product.name);
              }}
              title="Click to zoom in"
            />
        ) : (
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-cool-gray-600 flex items-center justify-center flex-shrink-0 shadow">
                <MeatIcon className="w-4 h-4 sm:w-6 sm:h-6 text-red-300 pointer-events-none"/>
            </div>
        )}
        <div className="flex-1 min-w-0 pointer-events-none">
            <p className="text-amber-400 font-bold text-xs sm:text-sm break-words whitespace-normal leading-tight flex flex-wrap items-center gap-1.5" title={product.name}>
              {product.name}
              {isSplitVariant && (
                <span 
                  className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] bg-amber-950/60 border border-amber-500/50 text-amber-400 px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wide select-none"
                  style={{ borderColor: 'var(--ha-accent-color, #fbbf24)', color: 'var(--ha-accent-color, #fbbf24)' }}
                  title={`Split variant in this container (${splitIndex} of ${siblingCuts.length})`}
                >
                  <GitFork className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--ha-accent-color, #fbbf24)' }} />
                  <span>Variant {splitIndex}</span>
                </span>
              )}
              {(meatCut.tagIds || []).map(tagId => {
                const tag = state.tags?.find(t => t.id === tagId);
                if (!tag) return null;
                return (
                  <span 
                    key={tag.id}
                    style={{ backgroundColor: `${tag.color}15`, borderColor: `${tag.color}35`, color: tag.color || '#60a5fa' }}
                    className="inline-flex items-center gap-0.5 text-[8px] sm:text-[9px] border px-1 sm:px-1.5 py-0.2 rounded font-semibold tracking-wide uppercase select-none" 
                    title={tag.description}
                  >
                    {tag.id === 'use-first' ? '🍳 ' : tag.id === 'not-for-sale' ? '🛑 ' : '🏷️ '}{tag.name}
                  </span>
                );
              })}
            </p>
            <p className="text-[10px] sm:text-[11px] text-cyan-400 font-bold mt-0.5 sm:mt-0.5 truncate max-w-[150px] sm:max-w-none">{product.primaryCategory} &gt; {product.subCategory}</p>
            {meatCut.originalCutName && meatCut.originalCutName.trim().toLowerCase() !== product.name.trim().toLowerCase() && (
              <p className="text-[10px] sm:text-[11px] text-red-400 font-semibold mt-0.5 break-words whitespace-normal" title={meatCut.originalCutName}>
                ⚠️ Labeled As: <span className="underline">{meatCut.originalCutName}</span>
              </p>
            )}
            {meatCut.notes && <p className="text-[10px] sm:text-[11px] text-amber-500/80 mt-0.5 break-words whitespace-normal" title={meatCut.notes}>Notes: {meatCut.notes}</p>}
        </div>
      </div>

      {/* Right control panel */}
      <div className="flex items-center gap-1 sm:gap-1.5 justify-end relative flex-shrink-0 select-none">
        
        {/* Decrement Button */}
        <button 
          onClick={() => handleQuantityChange(-1)} 
          className="p-0.5 sm:p-1 rounded-full bg-cool-gray-600 hover:bg-red-500 focus:bg-red-500 text-cool-gray-200 hover:text-white focus:text-white transition shadow-sm outline-none"
          title="Decrease by 1"
        >
          <MinusIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
        </button>

        {/* Quantity input, triggers inline math on highlight */}
        <input
          type="text"
          value={isEditing ? localQuantity : meatCut.quantity.toString()}
          onChange={handleDirectInputChange}
          onFocus={(e) => {
            setIsEditing(true);
            setLocalQuantity(meatCut.quantity.toString());
            e.target.select();
          }}
          onBlur={() => {
            handleCommitQuantity();
            setIsEditing(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="font-mono w-9 sm:w-11 text-center py-0.5 text-xs sm:text-md md:text-lg bg-cool-gray-800 border border-cool-gray-650 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 text-cool-gray-100 font-semibold"
          title="Type quantity or +20 / -6"
        />

        {/* Increment Button */}
        <button 
          onClick={() => handleQuantityChange(1)} 
          className="p-0.5 sm:p-1 rounded-full bg-cool-gray-600 hover:bg-green-500 focus:bg-green-500 text-cool-gray-200 hover:text-white focus:text-white transition shadow-sm outline-none"
          title="Increase by 1"
        >
          <PlusIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
        </button>

        {/* 3-dots Menu Button container (stable width to prevent any movement!) */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className={`p-0.5 sm:p-1 rounded hover:bg-cool-gray-650 transition cursor-pointer ${isMenuOpen ? 'text-white' : 'text-cool-gray-400 hover:text-white'}`}
            title="Item options"
          >
            <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>
          </button>

          {/* Context Dropdown menu */}
          {isMenuOpen && (
            <div className={`absolute right-0 bg-cool-gray-900 border border-cool-gray-700 rounded-md shadow-2xl py-1 z-50 w-44 select-none ${openUpwards ? 'bottom-full mb-1' : 'top-8'}`}>
              <button 
                onClick={() => { 
                  setIsMenuOpen(false); 
                  if ((window as any).__showProductQuickInfo) {
                    (window as any).__showProductQuickInfo({ productId: meatCut.productId });
                  }
                }} 
                className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium border-b border-cool-gray-800 pb-1.5 mb-1"
              >
                <Search className="w-3.5 h-3.5 text-cyan-400" /> View Product Info
              </button>

              <button 
                onClick={() => { setIsMenuOpen(false); onFindProduct(meatCut.productId); }} 
                className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium"
              >
                <Search className="w-3.5 h-3.5 text-amber-400" /> Find more of this item
              </button>
              
              <button 
                onClick={() => { setIsMenuOpen(false); openModal({ type: 'EDIT_NOTE', meatCutId: meatCut.id, initialNotes: meatCut.notes || '', initialOriginalCutName: meatCut.originalCutName || '' }); }} 
                className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium"
              >
                <Tag className="w-3.5 h-3.5 text-amber-400" /> Edit Note
              </button>

              <button 
                onClick={() => { setIsMenuOpen(false); openModal({ type: 'SELECT_MEAT_TAGS', meatCutId: meatCut.id }); }} 
                className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium"
              >
                <Tag className="w-3.5 h-3.5 text-cyan-400" /> Select Tags...
              </button>

              {meatCut.quantity > 1 && (
                <button 
                  onClick={() => { setIsMenuOpen(false); openModal({ type: 'SPLIT_ITEM', meatCutId: meatCut.id }); }} 
                  className="w-full text-left px-3 py-2 text-xs text-cyan-300 hover:bg-cool-gray-700 transition flex items-center gap-2 font-bold"
                >
                  <GitFork className="w-3.5 h-3.5 text-cyan-400" /> Split Item...
                </button>
              )}

              {(meatCut.notes || (meatCut.tagIds && meatCut.tagIds.length > 0)) && (
                <button 
                  onClick={() => { 
                    setIsMenuOpen(false); 
                    handleClearNotesAndTags();
                  }} 
                  className="w-full text-left px-3 py-2 text-xs text-amber-300 hover:bg-cool-gray-700 transition flex items-center gap-2 font-semibold"
                >
                  <Combine className="w-3.5 h-3.5 text-amber-400" /> Clear Notes & Tags (Merge)
                </button>
              )}
              
              <button 
                onClick={() => { setIsMenuOpen(false); openModal({ type: 'MOVE_MEAT', meatCutId: meatCut.id }); }} 
                className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium"
              >
                <Move className="w-3.5 h-3.5 text-cyan-400" /> Move to Container
              </button>
              
              <button 
                onClick={() => { setIsMenuOpen(false); openModal({ type: 'HISTORY', targetId: meatCut.id, targetName: product.name }); }} 
                className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium"
              >
                <History className="w-3.5 h-3.5 text-indigo-400" /> View Item History
              </button>
              
              <button 
                onClick={() => { setIsMenuOpen(false); openModal({ type: 'EDIT_PRODUCT', productId: product.id }); }} 
                className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium border-t border-cool-gray-800"
              >
                <Edit className="w-3.5 h-3.5 text-teal-400" /> Edit Item Info
              </button>

              <button 
                onClick={() => { setIsMenuOpen(false); openModal({ type: 'WRONG_LABEL', meatCutId: meatCut.id }); }} 
                className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium border-t border-cool-gray-800"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Labeled Wrong
              </button>

              <button 
                onClick={() => { 
                  setIsMenuOpen(false); 
                  openModal({ type: 'ADD_TO_LIST', productId: product.id });
                }} 
                className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium"
              >
                <Package className="w-3.5 h-3.5 text-cyan-400" />
                Add to List...
              </button>
              
              <div className="border-t border-cool-gray-700 my-1"></div>
              
              <button 
                onClick={() => { 
                  setIsMenuOpen(false); 
                  setShowRemoveConfirm(true);
                }} 
                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-950/20 hover:text-red-300 transition flex items-center gap-2 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove Item
              </button>
            </div>
          )}
        </div>

        {showRemoveConfirm && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="w-full max-w-sm p-5 bg-cool-gray-800 border border-cool-gray-750 rounded-lg shadow-xl animate-scale-up text-left">
                  <h4 className="text-md font-bold text-red-400 mb-2">Remove Item</h4>
                  <p className="text-sm text-cool-gray-300">Are you sure you want to remove <span className="font-semibold text-white">"{product.name}"</span> from this container?</p>
                  <div className="flex justify-end gap-2.5 mt-5">
                      <button 
                          onClick={() => setShowRemoveConfirm(false)} 
                          className="px-3 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-650 text-white text-xs font-semibold rounded transition"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={() => {
                              dispatch({ type: 'UPDATE_MEAT_QUANTITY', payload: { meatCutId: meatCut.id, newQuantity: 0 } });
                              setShowRemoveConfirm(false);
                          }} 
                          className="px-3 py-1.5 bg-red-650 hover:bg-red-550 text-white text-xs font-semibold rounded transition"
                      >
                          Yes, Remove
                      </button>
                  </div>
              </div>
          </div>,
          document.body
        )}

      </div>
    </div>
  );
};

export default MeatCutRow;
