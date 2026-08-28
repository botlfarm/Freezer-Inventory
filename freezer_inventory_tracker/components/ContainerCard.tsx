import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Container, MeatCut, ModalType, Action, InventoryState } from '../types';
import { PlusIcon, HistoryIcon, MoveIcon, RetireIcon, EditIcon } from './icons';
import { getContainerIcon } from './ContainerIconsMap';
import MeatCutRow from './MeatCutRow';
import { Move, MoreVertical } from 'lucide-react';

const ContainerCard: React.FC<ContainerCardProps> = ({ container, meatCuts, dispatch, openModal, state, isDimmed, highlightedMeatCutIds, isHighlighted, onFindProduct }) => {
  const Icon = getContainerIcon(container?.icon || 'generic');
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCardDraggable, setIsCardDraggable] = useState(false);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [openMenuRowId, setOpenMenuRowId] = useState<string | null>(null);
  const [isCardMenuOpen, setIsCardMenuOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const cardMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (cardMenuRef.current && !cardMenuRef.current.contains(target)) {
        setIsCardMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  React.useEffect(() => {
    if (isCardMenuOpen && cardMenuRef.current) {
      const rect = cardMenuRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpwards(spaceBelow < 240);
    }
  }, [isCardMenuOpen]);

  const hasSameNameInFreezer = React.useMemo(() => {
    if (!container.freezerId) return false;
    return state.containers.some(c => 
      c.id !== container.id && 
      c.freezerId === container.freezerId && 
      c.name.trim().toLowerCase() === container.name.trim().toLowerCase()
    );
  }, [container.id, container.freezerId, container.name, state.containers]);

  const freezer = React.useMemo(() => {
    return state.freezers.find(f => f.id === container.freezerId);
  }, [container.freezerId, state.freezers]);

  const handleRetire = () => {
    setShowRetireConfirm(true);
  };

  const cardRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (isHighlighted) {
      const timer = setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'container', id: container.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (dataStr) {
        const data = JSON.parse(dataStr);
        if (data.type === 'meat-cut') {
          if (data.containerId === container.id) return;
          dispatch({ 
            type: 'MOVE_MEAT_QUANTITY', 
            payload: { 
              meatCutId: data.id, 
              productId: data.productId,
              newContainerId: container.id, 
              quantity: data.quantity, 
              sourceContainerId: data.containerId,
              notes: data.notes,
              tagIds: data.tagIds,
              originalCutName: data.originalCutName
            } 
          });
        }
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  const isStaged = !container.freezerId;

  const isAnyMenuOpen = openMenuRowId !== null || isCardMenuOpen;

  return (
    <div 
      ref={cardRef} 
      draggable={isCardDraggable} 
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`container-card bg-cool-gray-900/50 rounded-md border-2 transition-all duration-300 relative ${
        isDragOver 
          ? 'border-emerald-400 bg-emerald-950/20 scale-[1.01] shadow-emerald-900/30 shadow-md' 
          : isHighlighted 
            ? 'border-cyan-400 shadow-lg' 
            : 'border-cool-gray-750 hover:border-cool-gray-700'
      } ${
        isAnyMenuOpen 
          ? 'z-50 relative' 
          : 'hover:z-20 focus-within:z-20'
      } ${isDimmed ? 'opacity-30' : ''}`}
    >
      {/* Tiny Drag indicator */}
      {isStaged && !container.id.endsWith('_loose') && (
        <div className="absolute top-1 right-24 text-cool-gray-500 opacity-0 hover:opacity-100 group-hover:opacity-100 transition cursor-grab" title="Drag Container to another freezer">
          <Move className="w-4 h-4" />
        </div>
      )}
      
      <div className="p-1 sm:p-2">
        <div 
            style={{ top: 'var(--header-height, 64px)' }}
            className={`sticky bg-cool-gray-900 py-1 sm:py-1 px-1.5 -mx-1 sm:-mx-2 mb-1.5 border-b border-cool-gray-800/60 rounded-t-md flex justify-between items-center ${
              isCardMenuOpen ? 'z-[60]' : 'z-20'
            }`}
        >
            <div 
              className={`flex items-center gap-1.5 ${isStaged && !container.id.endsWith('_loose') ? 'cursor-grab border border-transparent hover:border-cool-gray-700/50 hover:bg-cool-gray-800/45 px-1 py-0.5 rounded' : ''} transition select-none min-w-0 flex-1`}
              title={isStaged && !container.id.endsWith('_loose') ? "Drag container to another freezer" : undefined}
              onMouseEnter={() => isStaged && !container.id.endsWith('_loose') && setIsCardDraggable(true)}
              onMouseLeave={() => setIsCardDraggable(false)}
              onMouseDown={() => isStaged && !container.id.endsWith('_loose') && setIsCardDraggable(true)}
              onMouseUp={() => setIsCardDraggable(false)}
            >
              {isStaged && !container.id.endsWith('_loose') && <Move className="w-3.5 h-3.5 text-cool-gray-400 flex-shrink-0" />}
              {container.imageUrl ? (
                <img 
                  src={container.imageUrl} 
                  alt={container.name} 
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-md object-cover cursor-zoom-in border border-cool-gray-700/60 flex-shrink-0 hover:scale-110 active:scale-[0.95] transition-all duration-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    (window as any).__showImagePreview?.(container.imageUrl, container.name);
                  }}
                  title="Click to zoom in"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-cool-gray-700/60 flex items-center justify-center flex-shrink-0 border border-cool-gray-750/30">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-300 pointer-events-none flex-shrink-0" />
                </div>
              )}
              <h3 className="font-semibold leading-none text-xs sm:text-sm flex items-center gap-1.5 flex-wrap min-w-0">
                {freezer && !isStaged && (
                  <>
                    <span className="text-emerald-400 font-bold truncate max-w-[120px]" title={freezer.name}>{freezer.name}</span>
                    <span className="text-cool-gray-550 font-light">-</span>
                  </>
                )}
                <span className="font-extrabold text-cyan-400 truncate max-w-[180px] sm:max-w-[240px]" title={container.name}>{container.name}</span>
                {container.deleteOnEmpty && (
                  <span className="text-[9px] bg-amber-950/70 text-amber-400 border border-amber-800/50 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider select-none animate-pulse shrink-0" title="This container will automatically be deleted/retired when it runs out of items">
                    🗑️ Retire on Empty
                  </span>
                )}
                {hasSameNameInFreezer && (
                  <span 
                    className="text-amber-400 font-bold text-[10px] bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded cursor-help shrink-0 flex items-center gap-0.5 select-none" 
                    title={`Warning: Same name conflict. There are multiple containers named "${container.name}" inside this freezer.`}
                  >
                    ⚠️ Dup
                  </span>
                )}
              </h3>
            </div>
            <div className="relative select-none" ref={cardMenuRef}>
                <button
                    id={`btn-menu-${container.id}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsCardMenuOpen(!isCardMenuOpen);
                    }}
                    className={`p-1 rounded hover:bg-cool-gray-850 text-cool-gray-400 hover:text-white transition cursor-pointer flex items-center justify-center`}
                    title="Container options"
                >
                    <MoreVertical className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>

                {isCardMenuOpen && (
                    <div 
                        id={`menu-${container.id}`}
                        className={`absolute right-0 bg-cool-gray-900 border border-cool-gray-750/90 rounded-md shadow-2xl py-1 z-50 w-48 text-left ${
                            openUpwards ? 'bottom-full mb-1.5' : 'top-8'
                        } animate-fade-in`}
                    >
                        {/* Option 1: Add Meat (Always available for all containers) */}
                        <button
                            id={`opt-add-meat-${container.id}`}
                            onClick={() => {
                                setIsCardMenuOpen(false);
                                openModal({ type: 'ADD_MEAT', containerId: container.id });
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-950/40 hover:text-white transition flex items-center gap-2 font-bold select-none cursor-pointer"
                        >
                            <PlusIcon className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                            <span>Add Meat / Cut</span>
                        </button>

                        <div className="border-b border-cool-gray-800/60 my-1"></div>

                        {/* Option 2: Edit Container (Only for non-loose containers) */}
                        {!container.id.endsWith('_loose') && (
                            <button
                                id={`opt-edit-${container.id}`}
                                onClick={() => {
                                    setIsCardMenuOpen(false);
                                    openModal({ type: 'EDIT_CONTAINER', containerId: container.id });
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-800 hover:text-white transition flex items-center gap-2 font-medium select-none cursor-pointer"
                            >
                                <EditIcon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                <span>Edit Container</span>
                            </button>
                        )}

                        {/* Option 3: Move Container (Only for non-loose containers) */}
                        {!container.id.endsWith('_loose') && (
                            <button
                                id={`opt-move-${container.id}`}
                                onClick={() => {
                                    setIsCardMenuOpen(false);
                                    openModal({ type: 'MOVE_CONTAINER', containerId: container.id });
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-800 hover:text-white transition flex items-center gap-2 font-medium select-none cursor-pointer"
                            >
                                <MoveIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                <span>Move Container</span>
                            </button>
                        )}

                        {/* Option 3.5: Change Container */}
                        <button
                            id={`opt-change-container-${container.id}`}
                            onClick={() => {
                                setIsCardMenuOpen(false);
                                openModal({ type: 'CHANGE_CONTAINER_FLOW', containerId: container.id });
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-800 hover:text-white transition flex items-center gap-2 font-medium select-none cursor-pointer"
                        >
                            <Move className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <span>Change Container</span>
                        </button>

                        {/* Option 4: View Container History */}
                        <button
                            id={`opt-history-${container.id}`}
                            onClick={() => {
                                setIsCardMenuOpen(false);
                                openModal({ type: 'HISTORY', targetId: container.id, targetName: container.name });
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-cool-gray-200 hover:bg-cool-gray-800 hover:text-white transition flex items-center gap-2 font-medium select-none cursor-pointer"
                        >
                            <HistoryIcon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            <span>View History</span>
                        </button>

                        {/* Option 5: Retire Container (Only for non-loose with a freezerId assigned) */}
                        {!container.id.endsWith('_loose') && container.freezerId && (
                            <>
                                <div className="border-b border-cool-gray-800/60 my-1"></div>
                                <button
                                    id={`opt-retire-${container.id}`}
                                    onClick={() => {
                                        setIsCardMenuOpen(false);
                                        handleRetire();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 transition flex items-center gap-2 font-semibold select-none cursor-pointer"
                                >
                                    <RetireIcon className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                                    <span>Retire Container</span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
        <div className="space-y-1">
            {meatCuts.map(cut => (
            <MeatCutRow 
                key={cut.id} 
                meatCut={cut} 
                dispatch={dispatch} 
                openModal={openModal} 
                state={state}
                isDimmed={highlightedMeatCutIds ? !highlightedMeatCutIds.has(cut.id) : false}
                onFindProduct={onFindProduct}
                isMenuExpanded={openMenuRowId === cut.id}
                onMenuExpandToggle={(isOpen) => {
                    if (isOpen) {
                        setOpenMenuRowId(cut.id);
                    } else {
                        setOpenMenuRowId(prev => prev === cut.id ? null : prev);
                    }
                }}
            />
            ))}
        </div>

        {showRetireConfirm && createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs text-left">
                <div className="w-full max-w-sm p-5 bg-cool-gray-800 border border-cool-gray-750 rounded-lg shadow-xl animate-scale-up">
                    <h4 className="text-md font-bold text-cyan-400 mb-2">Retire Container</h4>
                    <p className="text-sm text-cool-gray-300">
                      {meatCuts.length > 0 ? (
                        <span>Are you sure you want to retire the container <span className="font-semibold text-white">"{container.name}"</span>? It currently contains <span className="font-semibold text-yellow-400">{meatCuts.length} different item(s)</span>. <span className="text-red-400 font-semibold block mt-1.5">Retiring will empty all its contents first!</span></span>
                      ) : (
                        <span>Are you sure you want to retire the container <span className="font-semibold text-white">"{container.name}"</span>? It will be removed from the freezer but can be used again later.</span>
                      )}
                    </p>
                    <div className="flex justify-end gap-2.5 mt-5">
                        <button 
                            onClick={() => setShowRetireConfirm(false)} 
                            className="px-3 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-650 text-white text-xs font-semibold rounded transition"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                dispatch({ type: 'MOVE_CONTAINER', payload: { containerId: container.id, newFreezerId: undefined, emptyCuts: true } });
                                setShowRetireConfirm(false);
                            }} 
                            className="px-3 py-1.5 bg-cyan-650 hover:bg-cyan-550 text-white text-xs font-semibold rounded transition"
                        >
                            Yes, Retire
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

export default ContainerCard;
interface ContainerCardProps {
  container: Container;
  meatCuts: MeatCut[];
  dispatch: React.Dispatch<Action>;
  openModal: (modal: ModalType) => void;
  state: InventoryState;
  isDimmed: boolean;
  highlightedMeatCutIds: Set<string> | null;
  isHighlighted: boolean;
  onFindProduct: (productId: string) => void;
  id?: string;
}
