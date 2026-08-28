import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { InventoryState, Action, ModalType, Product, MeatCut, Container, Freezer } from '../types';
import { MeatIcon, PlusIcon, MinusIcon, PackageIcon } from '../components/icons';
import { getContainerIcon } from '../components/ContainerIconsMap';
import { MoreVertical, Move, History, Tag, Edit, Package, Search, PlusCircle, AlertTriangle } from 'lucide-react';
import { evaluateMathExpression } from '../components/QuickCalculatorPanel';

interface ProductLocationRowProps {
    meatCut: MeatCut;
    container: Container;
    freezer: Freezer;
    dispatch: React.Dispatch<Action>;
    openModal: (modal: ModalType) => void;
    state: InventoryState;
    onNavigateToContainer: (containerId: string) => void;
    hideFreezerName?: boolean;
    hideContainerName?: boolean;
}

const ProductLocationRow: React.FC<ProductLocationRowProps> = ({ 
    meatCut, 
    container, 
    freezer, 
    dispatch, 
    openModal, 
    state,
    onNavigateToContainer,
    hideFreezerName = false,
    hideContainerName = false
}) => {
    const [localQuantity, setLocalQuantity] = useState(meatCut.quantity.toString());
    const [isEditing, setIsEditing] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [openUpwards, setOpenUpwards] = useState(false);

    const menuRef = useRef<HTMLDivElement>(null);
    const lastQuantityRef = useRef<number>(meatCut.quantity);
    const lastDispatchedQuantityRef = useRef<number | null>(null);

    // Evaluate math formulas like +20, -5, or 10+5
    const evaluateMathExpression = (input: string, baseValue: number): number | null => {
        const sanitized = input.replace(/\s+/g, '');
        
        if (sanitized.startsWith('+') || sanitized.startsWith('-')) {
            try {
                const delta = parseInt(sanitized, 10);
                if (!isNaN(delta)) {
                    return Math.max(0, baseValue + delta);
                }
            } catch (e) {}
        }
        
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
            setOpenUpwards(spaceBelow < 260);

            const prodCard = menuRef.current.closest('[id^="prod-card-"]');
            if (prodCard) {
                prodCard.classList.add('z-30', 'relative');
            }
        } else if (!isMenuOpen && menuRef.current) {
            const prodCard = menuRef.current.closest('[id^="prod-card-"]');
            if (prodCard) {
                prodCard.classList.remove('z-30', 'relative');
            }
        }
    }, [isMenuOpen]);

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
            setLocalQuantity(meatCut.quantity.toString());
        }
    };

    const ContainerIcon = getContainerIcon(container?.icon || 'generic');
    const product = state.products.find(p => p.id === meatCut.productId);

    const isLabeledDifferently = Boolean(
      meatCut.originalCutName && (
        !product || 
        meatCut.originalCutName.trim().toLowerCase() !== product.name.trim().toLowerCase()
      )
    );

    const hasSameNameInFreezer = useMemo(() => {
        if (!container.freezerId) return false;
        return state.containers.some(c => 
            c.id !== container.id && 
            c.freezerId === container.freezerId && 
            c.name.trim().toLowerCase() === container.name.trim().toLowerCase()
        );
    }, [container.id, container.freezerId, container.name, state.containers]);

    return (
        <li 
            className={`flex items-center justify-between p-1 sm:p-1.5 rounded-lg border transition-all duration-200 gap-2 ${
                isMenuOpen 
                    ? 'relative z-50 bg-cool-gray-850 shadow-lg border-cool-gray-700' 
                    : 'relative z-0 bg-cool-gray-900/50 hover:bg-cool-gray-900/80 border-cool-gray-800/40'
            }`}
        >
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                {container.imageUrl ? (
                    <img 
                      src={container.imageUrl} 
                      alt={container.name} 
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-md object-cover flex-shrink-0 shadow-sm cursor-zoom-in hover:scale-115 active:scale-90 transition-transform duration-200" 
                      onClick={(e) => {
                        e.stopPropagation();
                        (window as any).__showImagePreview?.(container.imageUrl, container.name);
                      }}
                      title="Click to zoom in"
                      referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-cool-gray-700/60 flex items-center justify-center flex-shrink-0 shadow-inner">
                       <ContainerIcon className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 text-cyan-300"/>
                    </div>
                )}
                
                <div className="flex-grow min-w-0 pr-1 sm:pr-2">
                    <div className="flex flex-wrap items-center gap-1.5 leading-tight">
                        {hideFreezerName && hideContainerName ? (
                            <span className="text-xs text-cool-gray-300 font-bold select-none flex items-center gap-1.5" title="Loose stock on display case shelves">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Loose Stock
                            </span>
                        ) : (
                            <>
                                {!hideContainerName ? (
                                    <button 
                                        onClick={() => onNavigateToContainer(container.id)}
                                        className="hover:underline outline-none text-xs sm:text-sm break-words whitespace-normal leading-tight flex flex-wrap items-center gap-1"
                                        title={`Go to Container "${container.name}" in ${freezer.name}`}
                                    >
                                        {!hideFreezerName ? (
                                            <>
                                                <span className="text-emerald-400 font-bold text-[11px] sm:text-xs">{freezer.name}</span>
                                                <span className="text-cool-gray-650 mx-0.5 sm:mx-1">-</span>
                                                <span className="text-cyan-400 font-bold text-xs sm:text-sm">{container.name}</span>
                                                {hasSameNameInFreezer && (
                                                   <span 
                                                     className="text-amber-400 font-bold text-xs bg-amber-500/15 border border-amber-500/30 px-1 py-0.5 rounded cursor-help flex-shrink-0 ml-1" 
                                                     title={`Warning: Same name conflict. There are multiple containers named "${container.name}" inside this freezer.`}
                                                   >
                                                     ⚠️ Dup
                                                   </span>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-1 text-cyan-400 font-bold">
                                                <span>{container.name}</span>
                                                {hasSameNameInFreezer && (
                                                   <span 
                                                     className="text-amber-400 font-bold text-xs bg-amber-500/15 border border-amber-500/30 px-1 py-0.5 rounded cursor-help flex-shrink-0" 
                                                     title={`Warning: Same name conflict. There are multiple containers named "${container.name}" inside this freezer.`}
                                                   >
                                                     ⚠️ Dup
                                                   </span>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                ) : (
                                    <span className="text-xs text-cool-gray-300 font-medium select-none">
                                        {!hideFreezerName ? `${freezer.name} - Loose` : 'Loose'}
                                    </span>
                                )}
                            </>
                        )}
                        {(meatCut.tagIds || []).map(tagId => {
                          const tag = state.tags?.find(t => t.id === tagId);
                          if (!tag) return null;
                          return (
                            <span 
                              key={tag.id}
                              style={{ 
                                backgroundColor: `${tag.color}15`, 
                                borderColor: `${tag.color}35`, 
                                color: tag.color || '#60a5fa' 
                              }}
                              className="inline-flex items-center gap-0.5 text-[8px] sm:text-[9px] border px-1 sm:px-1.5 py-0.2 rounded font-semibold tracking-wide uppercase select-none"
                              title={tag.description || tag.name}
                            >
                              {tag.id === 'use-first' ? '🍳 ' : tag.id === 'not-for-sale' ? '🛑 ' : '🏷️ '}{tag.name}
                            </span>
                          );
                        })}
                    </div>
                    {isLabeledDifferently && (
                        <p className="text-[10px] text-red-400 font-semibold mt-0.5 break-words whitespace-normal" title={meatCut.originalCutName}>
                            ⚠️ Labeled As: <span className="underline">{meatCut.originalCutName}</span>
                        </p>
                    )}
                    {meatCut.notes && <p className="text-[10px] text-amber-500/80 mt-0.5 break-words whitespace-normal" title={meatCut.notes}>Notes: {meatCut.notes}</p>}
                </div>
            </div>

            {/* Stable Control Block (fixed size, prevents component shift on hover) */}
            <div className="flex items-center gap-1 sm:gap-1.5 justify-end relative flex-shrink-0 select-none">
                {/* Decrement */}
                <button 
                    onClick={() => handleQuantityChange(-1)} 
                    className="p-1 rounded-full bg-cool-gray-700 hover:bg-red-500 focus:bg-red-500 text-cool-gray-200 hover:text-white focus:text-white transition shadow-sm cursor-pointer outline-none"
                    title="Decrease by 1"
                >
                    <MinusIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
                </button>

                {/* Direct text input, math in window on commit */}
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
                    className="font-mono w-9 sm:w-11 text-center py-0.5 text-xs sm:text-md bg-cool-gray-800 border border-cool-gray-650 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 text-cool-gray-100 font-semibold shadow-inner"
                    title="Type formula or delta (e.g. +10, -5)"
                />

                {/* Increment */}
                <button 
                    onClick={() => handleQuantityChange(1)} 
                    className="p-1 rounded-full bg-cool-gray-700 hover:bg-green-500 focus:bg-green-500 text-cool-gray-200 hover:text-white focus:text-white transition shadow-sm cursor-pointer outline-none"
                    title="Increase by 1"
                >
                    <PlusIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
                </button>

                {/* Unified 3-dots context options dropdown */}
                <div className="relative" ref={menuRef}>
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)} 
                        className={`p-1 rounded hover:bg-cool-gray-655 transition cursor-pointer ${isMenuOpen ? 'text-white bg-cool-gray-655' : 'text-cool-gray-400 hover:text-white'}`}
                        title="More item options"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                        <div className={`absolute right-0 bg-cool-gray-900 border border-cool-gray-700 rounded-lg shadow-2xl py-1.5 z-50 w-44 text-left ${openUpwards ? 'bottom-full mb-1' : 'top-8'}`}>
                            <button 
                                type="button"
                                onClick={() => { 
                                  setIsMenuOpen(false); 
                                  if ((window as any).__showProductQuickInfo) {
                                    (window as any).__showProductQuickInfo({ productId: meatCut.productId });
                                  }
                                }} 
                                className="w-full text-left px-3 py-2 text-xs text-cool-gray-250 hover:bg-cool-gray-800 transition flex items-center gap-2 font-medium border-b border-cool-gray-800 pb-1.5 mb-1"
                                title="View product details and list memberships"
                            >
                                <Search className="w-3.5 h-3.5 text-cyan-400" /> View Product Info
                            </button>

                            <button 
                                onClick={() => { setIsMenuOpen(false); openModal({ type: 'MOVE_MEAT', meatCutId: meatCut.id }); }} 
                                className="w-full text-left px-3 py-2 text-xs text-cool-gray-250 hover:bg-cool-gray-800 transition flex items-center gap-2 font-medium"
                            >
                                <Move className="w-3.5 h-3.5 text-cyan-455" /> Move to Container
                            </button>

                            {!container.id.endsWith('_loose') && (
                                <button 
                                    onClick={() => { setIsMenuOpen(false); openModal({ type: 'MOVE_CONTAINER', containerId: container.id }); }} 
                                    className="w-full text-left px-3 py-2 text-xs text-cool-gray-250 hover:bg-cool-gray-800 transition flex items-center gap-2 font-medium"
                                    title={`Move the entire container "${container.name}" to another freezer`}
                                >
                                    <span className="w-3.5 h-3.5 text-emerald-400 font-bold flex items-center justify-center">📦</span>
                                    Move Entire Container
                                </button>
                            )}
                            
                            <button 
                                onClick={() => { setIsMenuOpen(false); openModal({ type: 'EDIT_NOTE', meatCutId: meatCut.id, initialNotes: meatCut.notes || '', initialOriginalCutName: meatCut.originalCutName || '' }); }} 
                                className="w-full text-left px-3 py-2 text-xs text-cool-gray-250 hover:bg-cool-gray-800 transition flex items-center gap-2 font-medium"
                            >
                                <Tag className="w-3.5 h-3.5 text-amber-400" /> Edit Note
                            </button>

                            <button 
                                onClick={() => { setIsMenuOpen(false); openModal({ type: 'WRONG_LABEL', meatCutId: meatCut.id }); }} 
                                className="w-full text-left px-3 py-2 text-xs text-cool-gray-250 hover:bg-cool-gray-800 transition flex items-center gap-2 font-medium border-t border-cool-gray-800/80"
                            >
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Labeled Wrong
                            </button>

                            <button 
                                onClick={() => { 
                                  setIsMenuOpen(false); 
                                  openModal({ type: 'SELECT_MEAT_TAGS', meatCutId: meatCut.id }); 
                                }} 
                                className="w-full text-left px-3 py-2 text-xs text-cool-gray-250 hover:bg-cool-gray-800 transition flex items-center gap-2 font-medium"
                            >
                                <Tag className="w-3.5 h-3.5 text-cyan-400" /> Select Tags...
                            </button>



                            <button 
                                onClick={() => { setIsMenuOpen(false); openModal({ type: 'HISTORY', targetId: meatCut.id, targetName: `${product?.name || 'Item'} in ${container.name}` }); }} 
                                className="w-full text-left px-3 py-2 text-xs text-cool-gray-255 hover:bg-cool-gray-800 transition flex items-center gap-2 font-medium"
                            >
                                <History className="w-3.5 h-3.5 text-indigo-405" /> View Item History
                            </button>

                            {product && (
                                <>
                                    <button 
                                        onClick={() => { setIsMenuOpen(false); openModal({ type: 'EDIT_PRODUCT', productId: product.id }); }} 
                                        className="w-full text-left px-3 py-2 text-xs text-cool-gray-255 hover:bg-cool-gray-800 transition flex items-center gap-2 font-medium border-t border-cool-gray-800"
                                    >
                                        <Edit className="w-3.5 h-3.5 text-teal-400" /> Edit Item Info
                                    </button>

                                    <button 
                                        onClick={() => { 
                                          setIsMenuOpen(false); 
                                          openModal({ type: 'ADD_TO_LIST', productId: product.id });
                                        }} 
                                        className="w-full text-left px-3 py-2 text-xs text-cool-gray-255 hover:bg-cool-gray-800 transition flex items-center gap-2 font-medium"
                                    >
                                        <Package className="w-3.5 h-3.5 text-cyan-400" />
                                        Add to List...
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
};


interface BackstockPullControlProps {
    loc: { meatCut: MeatCut, container: Container, freezer: Freezer };
    df: Freezer;
    dispatch: React.Dispatch<Action>;
    state: InventoryState;
}

const BackstockPullControl: React.FC<BackstockPullControlProps> = ({ loc, df, dispatch, state }) => {
    const [mode, setMode] = useState<'pull' | 'put_back'>('pull');

    // Find display cuts of this specific item variant in this specific display freezer (df)
    const displayCutsInDf = useMemo(() => {
        const isSameVariantLocal = (cut: MeatCut, target: MeatCut) => {
            if (cut.productId !== target.productId) return false;
            if ((cut.notes || '').trim() !== (target.notes || '').trim()) return false;
            if ((cut.originalCutName || '').trim() !== (target.originalCutName || '').trim()) return false;
            const cutTags = [...(cut.tagIds || [])].sort().join(',');
            const targetTags = [...(target.tagIds || [])].sort().join(',');
            return cutTags === targetTags;
        };

        return state.meatCuts.filter(mc => {
            if (!isSameVariantLocal(mc, loc.meatCut)) return false;
            const container = state.containers.find(c => c.id === mc.containerId);
            return container && container.freezerId === df.id;
        });
    }, [state.meatCuts, state.containers, loc.meatCut, df.id]);

    const totalQtyOnDisplayInDf = useMemo(() => {
        return displayCutsInDf.reduce((sum, mc) => sum + mc.quantity, 0);
    }, [displayCutsInDf]);

    // Automatically toggle back to pull if display stock goes to 0
    useEffect(() => {
        if (totalQtyOnDisplayInDf === 0 && mode === 'put_back') {
            setMode('pull');
        }
    }, [totalQtyOnDisplayInDf, mode]);

    const maxVal = mode === 'pull' ? loc.meatCut.quantity : totalQtyOnDisplayInDf;

    const [inputValue, setInputValue] = useState(maxVal.toString());

    // Update inputValue when storage/display quantity changes, or mode switches
    useEffect(() => {
        setInputValue(maxVal.toString());
    }, [maxVal]);

    const handlePull = (all: boolean = false) => {
        const quantityToMove = all ? loc.meatCut.quantity : evaluateMathExpression(inputValue, loc.meatCut.quantity) || 1;
        if (quantityToMove <= 0) return;
        dispatch({
            type: 'MOVE_MEAT_QUANTITY',
            payload: {
                meatCutId: loc.meatCut.id,
                newContainerId: df.id + "_loose",
                quantity: quantityToMove,
                sourceContainerId: loc.meatCut.containerId
            }
        });
        setInputValue(Math.max(0, loc.meatCut.quantity - quantityToMove).toString());
    };

    const handlePutBack = (all: boolean = false) => {
        const displayCut = displayCutsInDf[0];
        if (!displayCut) return;

        const quantityToMove = all ? displayCut.quantity : evaluateMathExpression(inputValue, displayCut.quantity) || 1;
        if (quantityToMove <= 0) return;
        dispatch({
            type: 'MOVE_MEAT_QUANTITY',
            payload: {
                meatCutId: displayCut.id,
                newContainerId: loc.container.id,
                quantity: quantityToMove,
                sourceContainerId: displayCut.containerId
            }
        });
        setInputValue(Math.max(0, displayCut.quantity - quantityToMove).toString());
    };

    const handleUpdate = (delta: number) => {
        const currentVal = evaluateMathExpression(inputValue, maxVal) || 0;
        const newVal = Math.min(maxVal, Math.max(1, currentVal + delta));
        setInputValue(newVal.toString());
    };

    const evaluatedVal = evaluateMathExpression(inputValue, maxVal) || 1;

    return (
        <div className="flex flex-wrap items-center gap-1.5 bg-cool-gray-905/75 p-1 px-2 rounded border border-cool-gray-800 text-xs select-none">
            <span className="text-amber-500 font-extrabold text-[10px] uppercase tracking-wider">{df.name}:</span>
            
            {totalQtyOnDisplayInDf > 0 && (
                <div className="flex items-center bg-cool-gray-900 p-0.5 rounded border border-cool-gray-750 text-[10px]">
                    <button
                        type="button"
                        onClick={() => setMode('pull')}
                        className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                            mode === 'pull'
                                ? 'bg-amber-600 text-black shadow-sm shadow-amber-900/40'
                                : 'text-cool-gray-400 hover:text-white'
                        }`}
                        title="Move items from storage to display case"
                    >
                        Pull
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('put_back')}
                        className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                            mode === 'put_back'
                                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-900/40'
                                : 'text-cool-gray-400 hover:text-white'
                        }`}
                        title={`Move items from display case back to storage container (Total on display: ${totalQtyOnDisplayInDf})`}
                    >
                        Put Back
                    </button>
                </div>
            )}

            <div className="flex items-center bg-cool-gray-900 border border-cool-gray-700/70 rounded overflow-hidden">
                <button
                    type="button"
                    onClick={() => handleUpdate(-1)}
                    className="px-2 py-0.5 bg-cool-gray-750 hover:bg-cool-gray-700 hover:text-white text-cool-gray-300 font-bold transition cursor-pointer"
                >
                    -
                </button>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={(e) => {
                        e.target.select();
                    }}
                    className="w-10 bg-transparent text-center font-bold text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono py-0.5"
                />
                <button
                    type="button"
                    onClick={() => handleUpdate(1)}
                    className="px-2 py-0.5 bg-cool-gray-750 hover:bg-cool-gray-700 hover:text-white text-cool-gray-300 font-bold transition cursor-pointer"
                >
                    +
                </button>
            </div>
            
            {mode === 'pull' ? (
                <>
                    <button
                        type="button"
                        onClick={() => handlePull(false)}
                        className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-[10px] rounded transition cursor-pointer flex items-center gap-1"
                        title={`Pull ${evaluatedVal} item(s) from storage to display`}
                    >
                        Pull ({evaluatedVal})
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePull(true)}
                        className="px-2 py-0.5 bg-cool-gray-700 hover:bg-cool-gray-650 hover:text-yellow-400 text-cool-gray-200 font-bold text-[10px] rounded transition cursor-pointer"
                        title="Pull all items from storage to display"
                    >
                        All
                    </button>
                </>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={() => handlePutBack(false)}
                        className="px-2.5 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-[10px] rounded transition cursor-pointer flex items-center gap-1"
                        title={`Put ${evaluatedVal} item(s) back into storage`}
                    >
                        Put Back ({evaluatedVal})
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePutBack(true)}
                        className="px-2 py-0.5 bg-cool-gray-700 hover:bg-cool-gray-650 hover:text-cyan-300 text-cool-gray-200 font-bold text-[10px] rounded transition cursor-pointer"
                        title="Put all items from display back into storage"
                    >
                        All
                    </button>
                </>
            )}
        </div>
    );
};


interface StorageLocationRowProps {
    state: InventoryState;
    loc: { meatCut: MeatCut, container: Container, freezer: Freezer };
    dispatch: React.Dispatch<Action>;
    displayFreezers: Freezer[];
}

const StorageLocationRow: React.FC<StorageLocationRowProps> = ({ state, loc, dispatch, displayFreezers }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(loc.meatCut.quantity.toString());

    // Sync input value if external quantity changes
    useEffect(() => {
        setEditValue(loc.meatCut.quantity.toString());
    }, [loc.meatCut.quantity]);

    const handleSaveAdjustment = () => {
        const newQty = parseInt(editValue, 10);
        if (isNaN(newQty) || newQty < 0) {
            alert("Please enter a valid non-negative number.");
            return;
        }
        dispatch({
            type: 'UPDATE_MEAT_QUANTITY',
            payload: {
                meatCutId: loc.meatCut.id,
                newQuantity: newQty
            }
        });
        setIsEditing(false);
    };

    return (
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 p-2 bg-cool-gray-850/65 rounded border border-cool-gray-750/35 hover:border-cool-gray-700/60 transition">
            <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-cool-gray-250 whitespace-normal break-words text-xs leading-normal">
                        {loc.freezer.name} &gt; {loc.container.name}
                    </span>
                    
                    {(loc.meatCut.tagIds || []).map(tagId => {
                        const tag = state.tags?.find(t => t.id === tagId);
                        if (!tag) return null;
                        return (
                            <span 
                                key={tag.id}
                                style={{ 
                                    backgroundColor: `${tag.color}15`, 
                                    borderColor: `${tag.color}35`, 
                                    color: tag.color || '#60a5fa' 
                                }}
                                className="inline-flex items-center gap-0.5 text-[8px] sm:text-[9px] border px-1 sm:px-1.5 py-0.2 rounded font-semibold tracking-wide uppercase select-none"
                                title={tag.description || tag.name}
                            >
                                {tag.id === 'use-first' ? '🍳 ' : tag.id === 'not-for-sale' ? '🛑 ' : '🏷️ '}{tag.name}
                            </span>
                        );
                    })}
                    
                    {isEditing ? (
                        <div className="flex items-center gap-1 bg-cool-gray-900 p-1 rounded border border-cool-gray-700">
                            <input
                                type="number"
                                min="0"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-14 bg-transparent text-center font-bold text-white text-xs focus:outline-none focus:ring-0 font-mono py-0.5"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveAdjustment();
                                    if (e.key === 'Escape') {
                                        setIsEditing(false);
                                        setEditValue(loc.meatCut.quantity.toString());
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleSaveAdjustment}
                                className="px-1.5 py-0.5 bg-green-600 hover:bg-green-500 text-white rounded text-[10px] font-bold"
                                title="Save correct count"
                            >
                                Save
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditValue(loc.meatCut.quantity.toString());
                                }}
                                className="px-1.5 py-0.5 bg-cool-gray-700 hover:bg-cool-gray-600 text-cool-gray-300 rounded text-[10px]"
                                title="Cancel"
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="text-cyan-300 font-extrabold font-mono text-xs">
                                ({loc.meatCut.quantity} pcs)
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="px-1.5 py-0.5 bg-cool-gray-800 hover:bg-cool-gray-750 hover:text-amber-400 text-cool-gray-400 text-[10px] rounded border border-cool-gray-755 font-semibold transition cursor-pointer flex items-center gap-1"
                                title="Adjust/correct stock at this specific storage location"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013-3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                                </svg>
                                Correct
                            </button>
                        </div>
                    )}
                </div>
                {loc.meatCut.notes && (
                    <p className="text-[10px] text-amber-500/80 mt-0.5 break-words whitespace-normal font-mono">Notes: {loc.meatCut.notes}</p>
                )}
            </div>
            <div className="flex flex-col gap-1.5">
                {displayFreezers.map(df => (
                    <BackstockPullControl
                        key={df.id}
                        loc={loc}
                        df={df}
                        dispatch={dispatch}
                        state={state}
                    />
                ))}
            </div>
        </div>
    );
};


interface ProductMenuDropdownProps {
    product: Product;
    dispatch: React.Dispatch<Action>;
    openModal: (modal: ModalType) => void;
}

const ProductMenuDropdown: React.FC<ProductMenuDropdownProps> = ({ product, dispatch, openModal }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [openUpwards, setOpenUpwards] = useState(false);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (menuRef.current && !menuRef.current.contains(target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, []);

    useEffect(() => {
        if (isOpen && menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            // Short dropdown is ~100px. 120px threshold is extremely safe.
            setOpenUpwards(spaceBelow < 120);

            const stickyHeader = menuRef.current.closest('.sticky');
            if (stickyHeader) {
                stickyHeader.classList.add('z-[60]');
                stickyHeader.classList.remove('z-20');
            }
        } else if (!isOpen && menuRef.current) {
            const stickyHeader = menuRef.current.closest('.sticky');
            if (stickyHeader) {
                stickyHeader.classList.remove('z-[60]');
                stickyHeader.classList.add('z-20');
            }
        }
    }, [isOpen]);

    return (
        <div className="relative font-sans" ref={menuRef}>
            <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
                className={`p-1 flex items-center justify-center rounded-lg hover:bg-cool-gray-700 transition cursor-pointer ${isOpen ? 'text-white bg-cool-gray-750' : 'text-cool-gray-400 hover:text-white'}`}
                title="Product options"
            >
                <MoreVertical className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {isOpen && (
                <div className={`absolute right-0 bg-cool-gray-900 border border-cool-gray-700 rounded-lg shadow-2xl py-1.5 z-40 w-44 text-left ${openUpwards ? 'bottom-full mb-1' : 'top-8'}`}>
                    <button 
                        type="button"
                        onClick={() => { 
                          setIsOpen(false); 
                          if ((window as any).__showProductQuickInfo) {
                            (window as any).__showProductQuickInfo({ productId: product.id });
                          }
                        }} 
                        className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium border-b border-cool-gray-800 pb-1.5 mb-1"
                        title="View product details and list memberships"
                    >
                        <Search className="w-3.5 h-3.5 text-cyan-400" /> View Product Info
                    </button>

                    <button 
                        type="button"
                        onClick={() => { 
                            setIsOpen(false); 
                            openModal({ type: 'BULK_ADD_MEAT', productId: product.id }); 
                        }} 
                        className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium"
                        title="Intake new stock for this product"
                    >
                        <PlusCircle className="w-3.5 h-3.5 text-green-400" /> Intake Product...
                    </button>

                    <button 
                        type="button"
                        onClick={() => { setIsOpen(false); openModal({ type: 'EDIT_PRODUCT', productId: product.id }); }} 
                        className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium"
                    >
                        <Edit className="w-3.5 h-3.5 text-teal-400" /> Edit Item Info
                    </button>

                    <button 
                        type="button"
                        onClick={() => { 
                            setIsOpen(false); 
                            openModal({ type: 'ADD_TO_LIST', productId: product.id });
                        }} 
                        className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-700 transition flex items-center gap-2 font-medium"
                    >
                        <Package className="w-3.5 h-3.5 text-cyan-400" />
                        Add to List...
                    </button>
                </div>
            )}
        </div>
    );
};


interface DisplayCaseViewProps {
    state: InventoryState;
    dispatch: React.Dispatch<Action>;
    openModal: (modal: ModalType) => void;
    searchTerm: string;
    onNavigateToContainer: (containerId: string) => void;
    onNavigateToStaging: () => void;
    selectedPrimary: string | null;
    selectedSub: string | null;
    selectedFreezerId: string;
    hideZeroQuantity: boolean;
    showZeroQtyWithStock?: boolean;
    activeCheckedTags: string[];
    setSelectedPrimary: (cat: string | null) => void;
    setSelectedSub: (sub: string | null) => void;
}

export const DisplayCaseView: React.FC<DisplayCaseViewProps> = ({
    state,
    dispatch,
    openModal,
    searchTerm,
    onNavigateToContainer,
    onNavigateToStaging,
    selectedPrimary,
    selectedSub,
    selectedFreezerId,
    hideZeroQuantity,
    showZeroQtyWithStock = true,
    activeCheckedTags = [],
    setSelectedPrimary,
    setSelectedSub
}) => {
    const [openRestockProductIds, setOpenRestockProductIds] = useState<Record<string, boolean>>({});
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

    // Mouse drag-to-scroll and swipe interaction refs
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const scrollLeftRef = useRef(0);

    const handleContainerMouseDownByMouse = (e: React.MouseEvent<HTMLDivElement>) => {
        const container = e.currentTarget;
        isDraggingRef.current = false;
        const initialX = e.pageX - container.offsetLeft;
        const initialScrollLeft = container.scrollLeft;
        startXRef.current = initialX;
        scrollLeftRef.current = initialScrollLeft;

        container.style.cursor = 'grabbing';
        container.style.userSelect = 'none';

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const x = moveEvent.pageX - container.offsetLeft;
            const walk = (x - initialX) * 1.5;
            if (Math.abs(walk) > 3) {
                isDraggingRef.current = true;
                container.scrollLeft = initialScrollLeft - walk;
            }
        };

        const handleMouseUp = () => {
            container.style.cursor = '';
            container.style.removeProperty('user-select');
            setTimeout(() => {
                isDraggingRef.current = false;
            }, 50);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const hasStagedItems = useMemo(() => {
        const stagedContainers = state.containers.filter(c => !c.freezerId);
        const looseStagingCuts = state.meatCuts.filter(mc => mc.containerId === 'staging_loose');
        return stagedContainers.length > 0 || looseStagingCuts.length > 0;
    }, [state.containers, state.meatCuts]);

    const displayFreezers = useMemo(() => {
        return state.freezers.filter(f => f.isSpecial);
    }, [state.freezers]);

    const hasOnlyOneDisplayFreezer = useMemo(() => {
        return displayFreezers.length <= 1;
    }, [displayFreezers]);

    const displayCuts = useMemo(() => {
        return state.meatCuts.filter(mc => {
            const container = state.containers.find(c => c.id === mc.containerId);
            const freezer = container ? state.freezers.find(f => f.id === container.freezerId) : null;
            return container && freezer && freezer.isSpecial && mc.quantity > 0;
        });
    }, [state.meatCuts, state.containers, state.freezers]);

    const isEverythingLoose = useMemo(() => {
        if (displayCuts.length === 0) return true;
        return displayCuts.every(mc => mc.containerId.endsWith('_loose'));
    }, [displayCuts]);

    const excludedTagIds = useMemo(() => {
        return new Set((state.tags || []).filter(t => t.excludeFromDisplayRestock).map(t => t.id));
    }, [state.tags]);

    const isCutExcludedFromRestock = useCallback((mc: MeatCut) => {
        if (!mc.tagIds || mc.tagIds.length === 0) return false;
        return mc.tagIds.some(tagId => excludedTagIds.has(tagId));
    }, [excludedTagIds]);

    // Find display case locations ONLY (freezer.isSpecial === true)
    const findDisplayLocations = (productId: string) => {
        return state.meatCuts
            .filter(mc => mc.productId === productId)
            .map(mc => {
                const container = state.containers.find(c => c.id === mc.containerId);
                const freezer = container ? state.freezers.find(f => f.id === container.freezerId) : undefined;
                return { meatCut: mc, container, freezer };
            })
            .filter(loc => {
                if (!loc.container || !loc.freezer || !loc.freezer.isSpecial) return false;

                // Match tags against activeCheckedTags
                const itemTagIds = loc.meatCut.tagIds || [];
                const resolvedItemTagIds = [...itemTagIds];

                if (resolvedItemTagIds.length === 0) {
                    if (!activeCheckedTags.includes('untagged')) return false;
                } else {
                    if (!resolvedItemTagIds.some(tid => activeCheckedTags.includes(tid))) return false;
                }

                return true;
            }) as { meatCut: MeatCut, container: Container, freezer: Freezer }[];
    };

    const groupedProducts = useMemo(() => {
        let filteredProducts = state.products.filter(p => !p.isArchived);

        if (selectedPrimary) {
            filteredProducts = filteredProducts.filter(p => p.primaryCategory === selectedPrimary);
        }
        if (selectedPrimary && selectedSub) {
            filteredProducts = filteredProducts.filter(p => p.subCategory === selectedSub);
        }

        return filteredProducts.reduce((acc, product) => {
            let locations = findDisplayLocations(product.id).filter(l => selectedFreezerId === 'all' || l.freezer.id === selectedFreezerId);

            // Compute total backstock in non-display on-site storage (freezers & staging)
            const backStockLocations = state.meatCuts
                .filter(mc => mc.productId === product.id && mc.quantity > 0 && !isCutExcludedFromRestock(mc))
                .map(mc => {
                    const container = state.containers.find(c => c.id === mc.containerId);
                    let freezer = container ? state.freezers.find(f => f.id === container.freezerId) : undefined;
                    if (container && !freezer) {
                        freezer = { id: 'staging', name: '🛒 Staging', isSpecial: false } as Freezer;
                    }
                    return { meatCut: mc, container, freezer };
                })
                .filter(loc => loc.container && loc.freezer && !loc.freezer.isSpecial && !loc.freezer.isPallet && !loc.freezer.id.startsWith('pallet-')) as { meatCut: MeatCut, container: Container, freezer: Freezer }[];

            const totalBackStock = backStockLocations.reduce((sum, l) => sum + l.meatCut.quantity, 0);

            if (searchTerm.trim()) {
                const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
                const productString = [product.name, product.primaryCategory, product.subCategory, product.sku].filter(Boolean).join(' ').toLowerCase();

                const matchedLocations = locations.filter(loc => {
                    const locationString = [
                        loc.container?.name,
                        loc.freezer?.name,
                        loc.meatCut.notes
                    ].filter(Boolean).join(' ').toLowerCase();
                    
                    return searchWords.every(word => 
                        productString.includes(word) || locationString.includes(word)
                    );
                });

                const matchesProductText = searchWords.every(word => productString.includes(word));

                if (!matchesProductText && matchedLocations.length === 0) {
                    return acc;
                }
                locations = matchedLocations;
            }

            const totalQuantity = locations.reduce((sum, loc) => sum + loc.meatCut.quantity, 0);

            if (hideZeroQuantity && totalQuantity === 0) {
                // If showZeroQtyWithStock filter is ON and there is on-site backstock available to restock, keep this product visible!
                if (!showZeroQtyWithStock || totalBackStock === 0) {
                    return acc;
                }
            }

            const { primaryCategory, subCategory } = product;
            if (!acc[primaryCategory]) {
                acc[primaryCategory] = {};
            }
            if (!acc[primaryCategory][subCategory]) {
                acc[primaryCategory][subCategory] = [];
            }
            acc[primaryCategory][subCategory].push({ product, locations, totalQuantity });
            return acc;
        }, {} as Record<string, Record<string, { product: Product, locations: ReturnType<typeof findDisplayLocations>, totalQuantity: number }[]>>);
    }, [state.products, state.meatCuts, state.containers, state.freezers, hideZeroQuantity, showZeroQtyWithStock, activeCheckedTags, searchTerm, selectedPrimary, selectedSub, selectedFreezerId, isCutExcludedFromRestock]);

    const COLOR_CLASSES: Record<string, {
        text: string,
        bgActive: string,
        borderActive: string,
        textActive: string,
        borderHeader: string,
        bgHeader: string,
        bg: string,
        border: string
    }> = {
        rose: {
            text: 'text-rose-400',
            bgActive: 'bg-rose-950/80',
            borderActive: 'border-rose-500/40',
            textActive: 'text-rose-300',
            borderHeader: 'border-rose-900/30',
            bgHeader: 'bg-rose-950/15',
            bg: 'bg-rose-900',
            border: 'border-rose-500/20'
        },
        amber: {
            text: 'text-amber-405',
            bgActive: 'bg-amber-950/80',
            borderActive: 'border-amber-500/40',
            textActive: 'text-amber-300',
            borderHeader: 'border-amber-900/30',
            bgHeader: 'bg-amber-950/15',
            bg: 'bg-amber-900',
            border: 'border-amber-500/20'
        },
        emerald: {
            text: 'text-emerald-400',
            bgActive: 'bg-emerald-950/80',
            borderActive: 'border-emerald-500/40',
            textActive: 'text-emerald-300',
            borderHeader: 'border-emerald-900/30',
            bgHeader: 'bg-emerald-950/15',
            bg: 'bg-emerald-900',
            border: 'border-emerald-500/20'
        },
        cyan: {
            text: 'text-cyan-400',
            bgActive: 'bg-cyan-950/80',
            borderActive: 'border-cyan-500/40',
            textActive: 'text-cyan-300',
            borderHeader: 'border-cyan-900/30',
            bgHeader: 'bg-cyan-950/15',
            bg: 'bg-cyan-900',
            border: 'border-cyan-500/20'
        },
        indigo: {
            text: 'text-indigo-400',
            bgActive: 'bg-indigo-950/80',
            borderActive: 'border-indigo-500/40',
            textActive: 'text-indigo-300',
            borderHeader: 'border-indigo-900/30',
            bgHeader: 'bg-indigo-950/15',
            bg: 'bg-indigo-900',
            border: 'border-indigo-500/20'
        },
        pink: {
            text: 'text-pink-400',
            bgActive: 'bg-pink-950/80',
            borderActive: 'border-pink-500/40',
            textActive: 'text-pink-300',
            borderHeader: 'border-pink-900/30',
            bgHeader: 'bg-pink-950/15',
            bg: 'bg-pink-900',
            border: 'border-pink-500/20'
        },
        slate: {
            text: 'text-cool-gray-300',
            bgActive: 'bg-cool-gray-800',
            borderActive: 'border-cool-gray-700',
            textActive: 'text-cool-gray-150',
            borderHeader: 'border-cool-gray-800',
            bgHeader: 'bg-cool-gray-850/40',
            bg: 'bg-cool-gray-750',
            border: 'border-cool-gray-800'
        }
    };

    // Precompute sections for scroll-spy TOC and jump triggers
    const categorySections = useMemo(() => {
        const sections: { primary: string; sub: string; id: string }[] = [];
        Object.keys(groupedProducts).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).forEach(primary => {
            Object.keys(groupedProducts[primary]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).forEach(sub => {
                sections.push({
                    primary,
                    sub,
                    id: `display-section-${primary.replaceAll(/\s+/g, '-')}-${sub.replaceAll(/\s+/g, '-')}`
                });
            });
        });
        return sections;
    }, [groupedProducts]);

    // Track active scroll-spy items accurately as the user scrolls
    useEffect(() => {
        if (categorySections.length === 0) return;

        const handleScroll = () => {
            const isMobile = window.innerWidth < 1024;
            const threshold = isMobile ? 195 : 150; // Align with scroll-margin-top/sticky headers
            let currentActive: string | null = null;
            let maxTop = -Infinity;

            categorySections.forEach(sec => {
                const el = document.getElementById(sec.id);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    // A section is active if its top border has scrolled past our threshold (rect.top <= threshold)
                    // and it's the topmost one currently visible (maximum rect.top closest to threshold)
                    if (rect.top <= threshold) {
                        if (rect.top > maxTop) {
                            maxTop = rect.top;
                            currentActive = sec.id;
                        }
                    }
                }
            });

            if (currentActive) {
                setActiveSectionId(currentActive);
            }
        };

        // Initialize immediately
        handleScroll();

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
        };
    }, [categorySections]);

    // Automatically scroll the active mobile category pill into view as scrollspy updates
    useEffect(() => {
        if (activeSectionId) {
            const container = document.getElementById('mobile-display-category-pillbar');
            const activePill = document.getElementById(`mob-display-pill-${activeSectionId}`);
            if (container && activePill) {
                const targetLeft = activePill.offsetLeft - (container.offsetWidth / 2) + (activePill.offsetWidth / 2);
                container.scrollTo({ left: targetLeft, behavior: 'smooth' });
            }
        }
    }, [activeSectionId]);

    const handleJumpToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            const rect = el.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            // Calculate height offset dynamically based on sticky elements
            let offset = 140; // Default fallback spacer
            const header = document.querySelector('header');
            const pillbar = document.getElementById('mobile-display-category-pillbar');
            
            if (header) {
                offset = header.offsetHeight;
                if (pillbar && window.getComputedStyle(pillbar).display !== 'none') {
                    offset += pillbar.offsetHeight + 10; // include mobile bar height + buffer
                } else {
                    offset += 20; // 20px extra spacer
                }
            }

            // Scroll strictly vertically to prevent horizontal page displacement
            window.scrollTo({
                top: rect.top + scrollTop - offset,
                left: 0,
                behavior: 'smooth'
            });

            setActiveSectionId(id);
        }
    };

    return (
        <div className="flex flex-col gap-4 relative w-full" id="display-panel-container">
            
            {/* Sticky Horizontal Navigation Bar for All Screen Sizes */}
            {categorySections.length > 1 && (
                <div 
                    style={{ 
                        top: 'var(--header-height, 68px)' 
                    }}
                    className="sticky z-30 w-full group/pillbar"
                >
                    {/* Left Scroll Chevron for Desktop / Overflow */}
                    <button 
                        type="button"
                        onClick={() => {
                            const container = document.getElementById('mobile-display-category-pillbar');
                            if (container) container.scrollBy({ left: -220, behavior: 'smooth' });
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-40 bg-cool-gray-950 border border-cool-gray-700 hover:border-cyan-500/50 text-cyan-400 p-1.5 rounded-full shadow-md transition active:scale-90 hidden md:flex items-center justify-center cursor-pointer select-none"
                        title="Scroll Left"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                    </button>

                    <div 
                        style={{ 
                            scrollbarWidth: 'none', 
                            msOverflowStyle: 'none',
                        }}
                        onWheel={(e) => {
                            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                                e.preventDefault();
                                const container = document.getElementById('mobile-display-category-pillbar');
                                if (container) {
                                    container.scrollLeft += e.deltaY;
                                }
                            }
                        }}
                        onMouseDown={handleContainerMouseDownByMouse}
                        className="w-full overflow-x-auto bg-cool-gray-900/95 backdrop-blur-xs py-2 px-3 md:pl-12 md:pr-12 rounded-lg border border-cool-gray-750/70 flex items-center gap-1.5 scroll-smooth cursor-grab select-none [&::-webkit-scrollbar]:hidden animate-fade-in"
                        id="mobile-display-category-pillbar"
                    >
                        <div className="text-[10px] font-black uppercase text-cool-gray-400 tracking-wider pl-1.5 border-r border-cool-gray-750 pr-2 flex-shrink-0 select-none">
                            Jump:
                        </div>
                        {categorySections.map((sec) => {
                            const isActive = activeSectionId === sec.id;
                            
                            const subDec = state.categories?.find(c => c.type === 'sub' && c.name.toLowerCase().trim() === sec.sub.toLowerCase().trim() && c.parentPrimary?.toLowerCase().trim() === sec.primary.toLowerCase().trim());
                            const primaryDec = state.categories?.find(c => c.type === 'primary' && c.name.toLowerCase().trim() === sec.primary.toLowerCase().trim());
                            
                            const dec = subDec || primaryDec;
                            const colorConfig = dec?.color && dec.color !== 'none' ? COLOR_CLASSES[dec.color] : null;

                            return (
                                <button
                                    key={sec.id}
                                    type="button"
                                    onClick={(e) => {
                                        if (isDraggingRef.current) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            return;
                                        }
                                        handleJumpToSection(sec.id);
                                    }}
                                    id={`mob-display-pill-${sec.id}`}
                                    className={`px-2.5 py-1 text-xs rounded-full font-bold transition flex items-center gap-1 cursor-pointer flex-shrink-0 select-none ${
                                        isActive
                                            ? colorConfig ? `${colorConfig.bgActive} border ${colorConfig.borderActive} ${colorConfig.textActive}` : 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-300'
                                            : 'bg-cool-gray-850/60 text-cool-gray-350 hover:bg-cool-gray-750 border border-transparent'
                                    }`}
                                >
                                    {primaryDec?.icon ? (
                                        <span className="text-[11px] select-none mr-0.5">{primaryDec.icon}</span>
                                    ) : null}
                                    {subDec?.icon ? (
                                        <span className="text-[11px] select-none mr-0.5">{subDec.icon}</span>
                                    ) : null}
                                    <span className="capitalize">
                                        {primaryDec?.icon ? sec.sub : `${sec.primary} › ${sec.sub}`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right Scroll Chevron for Desktop / Overflow */}
                    <button 
                        type="button"
                        onClick={() => {
                            const container = document.getElementById('mobile-display-category-pillbar');
                            if (container) container.scrollBy({ left: 220, behavior: 'smooth' });
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-40 bg-cool-gray-950 border border-cool-gray-700 hover:border-cyan-500/50 text-cyan-400 p-1.5 rounded-full shadow-md transition active:scale-90 hidden md:flex items-center justify-center cursor-pointer select-none"
                        title="Scroll Right"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Main Products Area */}
            <div className="flex-grow w-full bg-cool-gray-800 rounded-lg shadow-lg p-1.5 sm:p-4 border border-cool-gray-700 animate-fade-in text-left" id="display-cards-panel">
                {/* Grouped Display List */}
                {Object.keys(groupedProducts).length === 0 ? (
                    <div className="text-center py-16 bg-cool-gray-900 rounded-xl border border-cool-gray-750">
                        <p className="text-cool-gray-400 font-medium">No display case stock matches active filters.</p>
                    </div>
                ) : (
                    Object.keys(groupedProducts).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).map(primaryCategory => (
                        <div key={primaryCategory} className="space-y-4 mb-4">
                            {Object.keys(groupedProducts[primaryCategory]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).map(subCategory => {
                                const sectionId = `display-section-${primaryCategory.replaceAll(/\s+/g, '-')}-${subCategory.replaceAll(/\s+/g, '-')}`;
                                
                                const primaryDec = state.categories?.find(c => c.type === 'primary' && c.name.toLowerCase().trim() === primaryCategory.toLowerCase().trim());
                                const primaryColorConfig = primaryDec?.color && primaryDec.color !== 'none' ? COLOR_CLASSES[primaryDec.color] : null;

                                const subDec = state.categories?.find(c => c.type === 'sub' && c.name.toLowerCase().trim() === subCategory.toLowerCase().trim() && c.parentPrimary?.toLowerCase().trim() === primaryCategory.toLowerCase().trim());
                                const subColorConfig = subDec?.color && subDec.color !== 'none' ? COLOR_CLASSES[subDec.color] : null;

                                return (
                                    <div 
                                        key={subCategory}
                                        id={sectionId}
                                        className="scroll-mt-[185px] lg:scroll-mt-[140px] transition-all duration-300 space-y-4"
                                    >
                                        
                                        {/* Pure human labels - Categorical heading banner in the scroll stream */}
                                        <div className="pt-4 pb-2 border-b border-cool-gray-750/70">
                                            <div className="flex items-center gap-2 select-none">
                                                <span className={`text-[10px] sm:text-[11px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded border flex items-center gap-1 ${
                                                    primaryColorConfig
                                                        ? `${primaryColorConfig.text} ${primaryColorConfig.bgHeader} ${primaryColorConfig.borderHeader}`
                                                        : 'text-cool-gray-455 bg-cool-gray-900 border-cool-gray-800'
                                                }`}>
                                                    {primaryDec?.icon && <span className="text-xs select-none">{primaryDec.icon}</span>}
                                                    <span>{primaryCategory}</span>
                                                </span>
                                                <span className="text-cool-gray-655 font-light">&gt;</span>
                                                <span className={`text-xs font-black tracking-wide capitalize px-2 py-0.5 rounded border flex items-center gap-1 ${
                                                    subColorConfig
                                                        ? `${subColorConfig.text} ${subColorConfig.bgHeader} border-${subDec?.color}-900/15`
                                                        : 'text-cyan-400 bg-cyan-950/15 border border-cyan-900/15'
                                                }`}>
                                                    {subDec?.icon && <span className="text-[11px] select-none">{subDec.icon}</span>}
                                                    <span>{subCategory}</span>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {groupedProducts[primaryCategory][subCategory].sort((a,b)=> a.product.name.localeCompare(b.product.name, undefined, { numeric: true, sensitivity: 'base' })).map(({ product, locations, totalQuantity }) => {
                                                const backStockLocations = state.meatCuts
                                                    .filter(mc => mc.productId === product.id && mc.quantity > 0 && !isCutExcludedFromRestock(mc))
                                                    .map(mc => {
                                                        const container = state.containers.find(c => c.id === mc.containerId);
                                                        let freezer = container ? state.freezers.find(f => f.id === container.freezerId) : undefined;
                                                        if (container && !freezer) {
                                                            freezer = { id: 'staging', name: '🛒 Staging', isSpecial: false } as Freezer;
                                                        }
                                                        return { meatCut: mc, container, freezer };
                                                    })
                                                    .filter(loc => loc.container && loc.freezer && !loc.freezer.isSpecial) as { meatCut: MeatCut, container: Container, freezer: Freezer }[];
                                                const totalBackStock = backStockLocations.reduce((sum, l) => sum + l.meatCut.quantity, 0);

                                                return (
                                                    <div 
                                                        key={product.id} 
                                                        id={`prod-card-${product.id}`}
                                                        className="product-card bg-cool-gray-850/45 rounded-xl border border-amber-500/25 hover:border-amber-500/40 shadow-sm shadow-amber-950/10 transition-all duration-300"
                                                    >
                                                        <div 
                                                            style={{ 
                                                                top: categorySections.length > 1
                                                                    ? 'calc(var(--header-height, 68px) + 48px)'
                                                                    : 'var(--header-height, 64px)'
                                                            }}
                                                            className="sticky z-20 bg-cool-gray-800 py-2 px-3 sm:px-4 border-b border-cool-gray-750/70 rounded-t-xl flex justify-between items-center gap-3"
                                                        >
                                                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                                                                {product.imageUrl ? (
                                                                     <img 
                                                                        src={product.imageUrl} 
                                                                        alt={product.name} 
                                                                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 shadow border border-cool-gray-700/40 cursor-zoom-in hover:scale-105 active:scale-95 transition-transform duration-200" 
                                                                        referrerPolicy="no-referrer" 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            (window as any).__showImagePreview?.(product.imageUrl, product.name);
                                                                        }}
                                                                        title="Click to zoom in"
                                                                      />
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded-lg bg-cool-gray-700 flex items-center justify-center flex-shrink-0 shadow-inner border border-cool-gray-700/20">
                                                                        <MeatIcon className="w-6 h-6 text-red-300"/>
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col min-w-0">
                                                                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] sm:text-xs text-cyan-400 font-bold tracking-wide capitalize">
                                                                        <span className="truncate">{primaryCategory}</span>
                                                                        <span className="text-cool-gray-650 font-light">•</span>
                                                                        <span className="truncate">{subCategory}</span>
                                                                        {product.sku && (
                                                                            <span className="font-mono text-[9px] bg-cool-gray-900 px-1 py-0.2 rounded border border-cool-gray-850 text-cool-gray-455 ml-1">SKU: {product.sku}</span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-amber-400 font-bold text-xs sm:text-sm md:text-base truncate">
                                                                        {product.name}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                                                                <div 
                                                                    className={`text-right flex items-center gap-1.5 ${totalBackStock > 0 ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : ''}`}
                                                                    onClick={() => {
                                                                        if (totalBackStock > 0) {
                                                                            setOpenRestockProductIds(prev => ({ ...prev, [product.id]: !prev[product.id] }));
                                                                        }
                                                                    }}
                                                                >
                                                                    <span className="hidden md:inline text-[9px] text-cool-gray-400 uppercase font-mono font-semibold tracking-wider">
                                                                        Display Stock:
                                                                    </span>
                                                                    <div className="flex items-center gap-1 bg-cool-gray-900 border border-cool-gray-750 px-2 py-0.5 rounded text-xs select-none">
                                                                        <span className="text-amber-400 font-black font-mono" title="Display count">
                                                                            {totalQuantity}
                                                                        </span>
                                                                        {totalBackStock > 0 && (
                                                                            <>
                                                                                <span className="text-cool-gray-650 text-[10px]">/</span>
                                                                                <span className="text-cyan-400 font-bold font-mono" title="Total count (Display + Storage)">
                                                                                    {totalQuantity + totalBackStock}
                                                                                </span>
                                                                                <span className="text-[10.5px] text-amber-500 animate-pulse font-bold ml-0.5" title="Restock available (Click to Toggle restock panel)">⚡</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                
                                                                <ProductMenuDropdown product={product} dispatch={dispatch} openModal={openModal} />
                                                            </div>
                                                        </div>

                                                        <div className="px-2 pb-2 sm:px-4 sm:pb-3.5 pt-1">
                                                            {/* Quick Restock Drawer logic from backstock storage */}
                                                            {totalBackStock > 0 && openRestockProductIds[product.id] && (
                                                                <div className="mt-2.5 mb-3 w-full bg-cool-gray-900 p-2.5 rounded-lg border border-cool-gray-750/45 animate-fade-in text-left">
                                                                    <div className="flex items-center justify-between gap-2 mb-2 border-b border-cool-gray-800 pb-1.5">
                                                                        <span className="text-[10px] uppercase font-bold tracking-wider text-cool-gray-400">
                                                                            👉 Restock Display Case:
                                                                        </span>
                                                                        <div className="flex gap-2">
                                                                            {state.freezers.filter(f => f.isSpecial).map(df => (
                                                                                <button
                                                                                    key={df.id}
                                                                                    onClick={() => openModal({ type: 'ADD_MEAT', containerId: df.id + "_loose", productId: product.id })}
                                                                                    className="text-[10px] px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-black font-extrabold rounded transition cursor-pointer"
                                                                                >
                                                                                    ➕ Add to {df.name}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        {backStockLocations.map(loc => {
                                                                            const displayFreezers = state.freezers.filter(f => f.isSpecial);
                                                                            return (
                                                                                <StorageLocationRow
                                                                                    key={loc.meatCut.id}
                                                                                    state={state}
                                                                                    loc={loc}
                                                                                    dispatch={dispatch}
                                                                                    displayFreezers={displayFreezers}
                                                                                />
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {totalQuantity === 0 && totalBackStock > 0 && !openRestockProductIds[product.id] && (
                                                                <div className="mt-2.5 pt-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setOpenRestockProductIds(prev => ({ ...prev, [product.id]: true }))}
                                                                        className="w-full py-2 px-3 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-500/50 text-amber-200 text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer shadow-sm hover:shadow-md"
                                                                    >
                                                                        <span className="flex items-center gap-1.5 min-w-0 truncate">
                                                                            <span className="text-amber-400 animate-pulse text-sm flex-shrink-0">⚡</span>
                                                                            <span className="truncate">Out of Display Case stock — <strong className="text-amber-300 font-mono">{totalBackStock}</strong> available in backstock</span>
                                                                        </span>
                                                                        <span className="text-[10px] uppercase font-black bg-amber-500 text-black px-2.5 py-1 rounded shadow hover:bg-amber-400 flex-shrink-0">
                                                                            Restock Now
                                                                        </span>
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {locations.length > 0 && hasOnlyOneDisplayFreezer && isEverythingLoose && (
                                                                <ul className="flex-shrink-0 w-full lg:w-auto mt-2 lg:mt-0 pb-1">
                                                                    {locations.sort((a,b) => a.freezer.name.localeCompare(b.freezer.name, undefined, { numeric: true, sensitivity: 'base' })).map(loc => (
                                                                        <ProductLocationRow 
                                                                            key={loc.meatCut.id}
                                                                            meatCut={loc.meatCut}
                                                                            container={loc.container}
                                                                            freezer={loc.freezer}
                                                                            dispatch={dispatch}
                                                                            openModal={openModal}
                                                                            state={state}
                                                                            onNavigateToContainer={onNavigateToContainer}
                                                                            hideFreezerName={hasOnlyOneDisplayFreezer}
                                                                            hideContainerName={isEverythingLoose}
                                                                        />
                                                                    ))}
                                                                </ul>
                                                            )}

                                                            {!(hasOnlyOneDisplayFreezer && isEverythingLoose) && locations.length > 0 ? (
                                                                <div className="mt-3.5 pt-3 border-t border-cool-gray-800/60">
                                                                    <ul className="text-cool-gray-300 text-sm space-y-2">
                                                                        {locations.sort((a,b) => a.freezer.name.localeCompare(b.freezer.name, undefined, { numeric: true, sensitivity: 'base' })).map(loc => (
                                                                            <ProductLocationRow 
                                                                                key={loc.meatCut.id}
                                                                                meatCut={loc.meatCut}
                                                                                container={loc.container}
                                                                                freezer={loc.freezer}
                                                                                dispatch={dispatch}
                                                                                openModal={openModal}
                                                                                state={state}
                                                                                onNavigateToContainer={onNavigateToContainer}
                                                                                hideFreezerName={hasOnlyOneDisplayFreezer}
                                                                                hideContainerName={isEverythingLoose}
                                                                            />
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            ) : locations.length === 0 ? (
                                                                <div className="mt-3 px-1 bg-cool-gray-850/40 p-3 rounded-lg border border-dashed border-cool-gray-750/50">
                                                                    <p className="text-xs text-cool-gray-400 italic">This product is cataloged but not present in any Display Case container yet.</p>
                                                                    
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
