import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Package } from 'lucide-react';
import { InventoryState, Action, ModalType } from '../types';
import ContainerCard from '../components/ContainerCard';
import { FreezerIcon } from '../components/icons';

interface FreezerViewProps {
    state: InventoryState;
    dispatch: React.Dispatch<Action>;
    openModal: (modal: ModalType) => void;
    searchResults: {
        freezerIds: Set<string>;
        containerIds: Set<string>;
        meatCutIds: Set<string>;
    } | null;
    startReconciliation: (freezerId: string) => void;
    highlightContainerId: string | null;
    setHighlightContainerId: (id: string | null) => void;
    onFindProduct: (productId: string) => void;
    selectedPrimary: string | null;
    selectedSub: string | null;
    selectedFreezerId: string;
    hideZeroQuantity: boolean;
    activeCheckedTags: string[];
    setSelectedPrimary: (cat: string | null) => void;
    setSelectedSub: (sub: string | null) => void;
    onNavigateToOffsiteStaging?: () => void;
}

const FreezerView: React.FC<FreezerViewProps> = ({ 
    state, 
    dispatch, 
    openModal, 
    searchResults, 
    startReconciliation, 
    highlightContainerId, 
    setHighlightContainerId, 
    onFindProduct,
    selectedPrimary,
    selectedSub,
    selectedFreezerId,
    hideZeroQuantity,
    activeCheckedTags = [],
    setSelectedPrimary,
    setSelectedSub,
    onNavigateToOffsiteStaging
}) => {
    const [dragOverFreezerId, setDragOverFreezerId] = useState<string | null>(null);
    const [isDragOverStaging, setIsDragOverStaging] = useState<boolean>(false);
    const [isStagingMenuOpen, setIsStagingMenuOpen] = useState<boolean>(false);
    const [isConfirmingMove, setIsConfirmingMove] = useState<boolean>(false);
    const stagingMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (stagingMenuRef.current && !stagingMenuRef.current.contains(event.target as Node)) {
                setIsStagingMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    useEffect(() => {
        if (!isStagingMenuOpen) {
            setIsConfirmingMove(false);
        }
    }, [isStagingMenuOpen]);
    const [pendingMove, setPendingMove] = useState<{ containerId: string; freezerId: string; freezerName: string; containerName: string } | null>(null);

    useEffect(() => {
        // Clear highlight after animation
        if (highlightContainerId) {
            const timer = setTimeout(() => {
                setHighlightContainerId(null);
            }, 2000); // 2 seconds to view highlight
            return () => clearTimeout(timer);
        }
    }, [highlightContainerId, setHighlightContainerId]);

    const handleDragOverFreezer = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDragEnterFreezer = (e: React.DragEvent, freezerId: string) => {
        e.preventDefault();
        setDragOverFreezerId(freezerId);
    };

    const handleDragLeaveFreezer = () => {
        setDragOverFreezerId(null);
    };

    const handleDropContainerOnFreezer = (e: React.DragEvent, freezerId: string) => {
        e.preventDefault();
        setDragOverFreezerId(null);
        try {
            const dataStr = e.dataTransfer.getData('text/plain');
            if (dataStr) {
                const data = JSON.parse(dataStr);
                if (data.type === 'container') {
                    const draggingContainer = state.containers.find(c => c.id === data.id);
                    if (draggingContainer) {
                        const targetFreezer = state.freezers.find(f => f.id === freezerId);
                        const hasConflict = state.containers.some(c => 
                            c.id !== draggingContainer.id && 
                            c.freezerId === freezerId && 
                            c.name.trim().toLowerCase() === draggingContainer.name.trim().toLowerCase()
                        );
                        if (hasConflict && targetFreezer) {
                            setPendingMove({
                                containerId: draggingContainer.id,
                                freezerId,
                                freezerName: targetFreezer.name,
                                containerName: draggingContainer.name
                            });
                            return;
                        }
                    }
                    dispatch({ 
                        type: 'MOVE_CONTAINER', 
                        payload: { containerId: data.id, newFreezerId: freezerId } 
                    });
                } else if (data.type === 'meat-cut') {
                    const targetFreezer = state.freezers.find(f => f.id === freezerId);
                    if (targetFreezer && targetFreezer.isSpecial) {
                        const targetLooseContainerId = freezerId + "_loose";
                        if (data.containerId === targetLooseContainerId) return;
                        dispatch({ 
                            type: 'MOVE_MEAT_QUANTITY', 
                            payload: { 
                                meatCutId: data.id, 
                                productId: data.productId,
                                newContainerId: targetLooseContainerId, 
                                quantity: data.quantity, 
                                sourceContainerId: data.containerId,
                                notes: data.notes,
                                tagIds: data.tagIds,
                                originalCutName: data.originalCutName
                            } 
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error dropping item:', err);
        }
    };

    const filteredMeatCuts = useMemo(() => {
        return state.meatCuts.filter(mc => {
            if (hideZeroQuantity && mc.quantity === 0) return false;

            // Match tags against activeCheckedTags
            const itemTagIds = mc.tagIds || [];
            const resolvedItemTagIds = [...itemTagIds];

            if (resolvedItemTagIds.length === 0) {
                if (!activeCheckedTags.includes('untagged')) return false;
            } else {
                if (!resolvedItemTagIds.some(tid => activeCheckedTags.includes(tid))) return false;
            }
            
            const product = state.products.find(p => p.id === mc.productId);
            if (!product) return false;
            
            if (selectedPrimary && product.primaryCategory !== selectedPrimary) return false;
            if (selectedSub && product.subCategory !== selectedSub) return false;
            
            if (selectedFreezerId !== 'all') {
                const container = state.containers.find(c => c.id === mc.containerId);
                if (!container || container.freezerId !== selectedFreezerId) return false;
            }
            
            return true;
        });
    }, [state.meatCuts, state.products, state.containers, hideZeroQuantity, activeCheckedTags, selectedPrimary, selectedSub, selectedFreezerId]);

    const stagedContainers = useMemo(() => {
        return state.containers.filter(c => {
            if (c.isArchived || c.freezerId) return false;
            if (c.id.endsWith('_loose') && c.id !== 'staging_loose') return false;
            if (hideZeroQuantity) {
                return filteredMeatCuts.some(mc => mc.containerId === c.id && mc.quantity > 0);
            }
            return true;
        }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    }, [state.containers, filteredMeatCuts, hideZeroQuantity]);

    const displayedStagedContainers = useMemo(() => {
        if (!searchResults) return stagedContainers;
        return stagedContainers.filter(c => searchResults.containerIds.has(c.id));
    }, [stagedContainers, searchResults]);

    const displayedFreezers = useMemo(() => {
        const matchingFreezers = searchResults 
            ? state.freezers.filter(f => searchResults.freezerIds.has(f.id))
            : state.freezers;
        return matchingFreezers.filter(f => !f.isPallet && (selectedFreezerId === 'all' || f.id === selectedFreezerId)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    }, [state.freezers, searchResults, selectedFreezerId]);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const isDraggingRef = useRef(false);

    const handleContainerMouseDownByMouse = (e: React.MouseEvent<HTMLDivElement>) => {
        const container = e.currentTarget;
        const initialX = e.pageX - container.offsetLeft;
        const initialScrollLeft = container.scrollLeft;
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

    const freezerSections = useMemo(() => {
        const sections: { id: string; name: string; isStaging?: boolean; isSpecial?: boolean }[] = [];
        if (stagedContainers.length > 0) {
            sections.push({
                id: 'freezer-section-staging',
                name: 'Staging Area',
                isStaging: true
            });
        }
        displayedFreezers.forEach(f => {
            sections.push({
                id: `freezer-section-${f.id}`,
                name: f.name,
                isSpecial: f.isSpecial
            });
        });
        return sections;
    }, [stagedContainers.length, displayedFreezers]);

    // Track active scroll-spy items accurately as the user scrolls
    useEffect(() => {
        if (freezerSections.length === 0) return;

        const handleScroll = () => {
            const isMobile = window.innerWidth < 1024;
            const threshold = isMobile ? 195 : 150;
            let currentActive: string | null = null;
            let maxTop = -Infinity;

            freezerSections.forEach(sec => {
                const el = document.getElementById(sec.id);
                if (el) {
                    const rect = el.getBoundingClientRect();
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

        handleScroll();

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
        };
    }, [freezerSections]);

    // Automatically scroll the active pill into view as scrollspy updates
    useEffect(() => {
        if (activeSectionId) {
            const container = document.getElementById('freezer-pillbar');
            const activePill = document.getElementById(`freezer-pill-${activeSectionId}`);
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
            
            let offset = 140; // Default fallback spacer
            const header = document.querySelector('header');
            const pillbar = document.getElementById('freezer-pillbar');
            
            if (header) {
                offset = header.offsetHeight;
                if (pillbar && window.getComputedStyle(pillbar).display !== 'none') {
                    offset += pillbar.offsetHeight + 10;
                } else {
                    offset += 20;
                }
            }

            window.scrollTo({
                top: rect.top + scrollTop - offset,
                left: 0,
                behavior: 'smooth'
            });

            setActiveSectionId(id);
        }
    };
 
    return (
        <div className="flex flex-col gap-2.5 sm:gap-3 relative w-full" id="freezer-panel-container">
            {/* Sticky Horizontal Navigation Bar for Freezers */}
            {freezerSections.length > 1 && (
                <div 
                    style={{ 
                        top: 'var(--header-height, 68px)' 
                    }}
                    className="sticky z-30 w-full group/pillbar"
                >
                    {/* Left Scroll Chevron */}
                    <button 
                        type="button"
                        onClick={() => {
                            const container = document.getElementById('freezer-pillbar');
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
                                const container = document.getElementById('freezer-pillbar');
                                if (container) {
                                    container.scrollLeft += e.deltaY;
                                }
                            }
                        }}
                        onMouseDown={handleContainerMouseDownByMouse}
                        className="w-full overflow-x-auto bg-cool-gray-900 py-2 px-3 md:pl-12 md:pr-12 rounded-lg border border-cool-gray-750 flex items-center gap-1.5 scroll-smooth cursor-grab select-none [&::-webkit-scrollbar]:hidden animate-fade-in"
                        id="freezer-pillbar"
                    >
                        <div className="text-[10px] font-black uppercase text-cool-gray-400 tracking-wider pl-1.5 border-r border-cool-gray-750 pr-2 flex-shrink-0 select-none">
                            Jump:
                        </div>
                        {freezerSections.map((sec) => {
                            const isActive = activeSectionId === sec.id;
                            
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
                                    id={`freezer-pill-${sec.id}`}
                                    className={`px-2.5 py-1 text-xs rounded-full font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 select-none ${
                                        isActive
                                            ? sec.isStaging
                                                ? 'bg-amber-950/80 border border-amber-500/50 text-amber-300 shadow-xs'
                                                : sec.isSpecial
                                                ? 'bg-amber-950/80 border border-amber-500/50 text-amber-300 shadow-xs'
                                                : 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 shadow-xs'
                                            : 'bg-cool-gray-850/60 text-cool-gray-350 hover:bg-cool-gray-750 hover:text-cool-gray-150 border border-transparent'
                                    }`}
                                >
                                    <span>{sec.isStaging ? '🍳' : sec.isSpecial ? '🏪' : '❄️'}</span>
                                    <span>{sec.name}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right Scroll Chevron */}
                    <button 
                        type="button"
                        onClick={() => {
                            const container = document.getElementById('freezer-pillbar');
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

            <div className="bg-cool-gray-800 rounded-lg shadow-lg p-1 sm:p-3 border border-cool-gray-700 animate-fade-in text-left space-y-4" id="freezer-cards-panel">
                 <div className="space-y-4">
                     {/* --- Staging & Sorting Table Section (Always shown to allow drag and drop) --- */}
                     {stagedContainers.length > 0 && (
                         <div 
                             id="freezer-section-staging"
                             onDragOver={(e) => {
                                 e.preventDefault();
                             }}
                         onDragEnter={(e) => {
                             e.preventDefault();
                             setIsDragOverStaging(true);
                         }}
                         onDragLeave={() => {
                             setIsDragOverStaging(false);
                         }}
                         onDrop={(e) => {
                             e.preventDefault();
                             setIsDragOverStaging(false);
                             try {
                                 const dataStr = e.dataTransfer.getData('text/plain');
                                 if (dataStr) {
                                     const data = JSON.parse(dataStr);
                                     if (data.type === 'container') {
                                         dispatch({ 
                                             type: 'MOVE_CONTAINER', 
                                             payload: { containerId: data.id, newFreezerId: undefined } 
                                         });
                                     } else if (data.type === 'meat-cut') {
                                         return; // disabled to prevent loose drops
                                         dispatch({
                                             type: 'MOVE_MEAT_QUANTITY',
                                             payload: {
                                                 meatCutId: data.id,
                                                 productId: data.productId,
                                                 newContainerId: 'staging_loose',
                                                 quantity: data.quantity,
                                                 sourceContainerId: data.containerId
                                             }
                                         });
                                     }
                                 }
                             } catch (err) {
                                 console.error('Staging drop error:', err);
                             }
                         }}
                         className={`mb-4 bg-amber-950/10 border-2 border-dashed rounded-lg p-3 flex flex-col gap-2 transition-all duration-300 shadow-lg shadow-amber-950/20 ${
                             isDragOverStaging 
                                 ? 'border-amber-400 bg-amber-900/20 scale-[1.01]' 
                                 : 'border-amber-500/50'
                         }`}
                     >
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                 <span className="text-xl">🍳</span>
                                 <h2 className="text-sm font-bold text-amber-400">Staging Area</h2>
                             </div>
                             <div className="relative" ref={stagingMenuRef}>
                                 <button 
                                     onClick={() => setIsStagingMenuOpen(!isStagingMenuOpen)}
                                     className={`p-1 rounded transition-colors cursor-pointer ${isStagingMenuOpen ? 'bg-amber-900/40 text-amber-400' : 'hover:bg-amber-900/40 text-amber-500/70 hover:text-amber-400'}`}
                                 >
                                     <MoreVertical size={16} />
                                 </button>
                                 {isStagingMenuOpen && (
                                     <div className="absolute right-0 mt-1 w-48 bg-cool-gray-850 border border-cool-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                                         {isConfirmingMove ? (
                                             <div className="p-3 text-center">
                                                 <p className="text-xs text-amber-400 font-bold mb-2">Move staging items to Off-Site Storage?</p>
                                                 <div className="flex gap-2 justify-center">
                                                     <button
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             dispatch({ type: 'MOVE_STAGING_TO_OFFSITE' });
                                                             setIsConfirmingMove(false);
                                                             setIsStagingMenuOpen(false);
                                                         }}
                                                         className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded cursor-pointer transition-colors"
                                                     >
                                                         Confirm
                                                     </button>
                                                     <button
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             setIsConfirmingMove(false);
                                                         }}
                                                         className="px-2 py-1 bg-cool-gray-700 hover:bg-cool-gray-650 text-white text-xs font-bold rounded cursor-pointer transition-colors"
                                                     >
                                                         Cancel
                                                     </button>
                                                 </div>
                                             </div>
                                         ) : (
                                             <button 
                                                 onClick={(e) => {
                                                     e.stopPropagation();
                                                     setIsConfirmingMove(true);
                                                 }}
                                                 className="w-full text-left px-4 py-3 text-sm text-amber-400 hover:bg-cool-gray-800 font-bold transition-colors cursor-pointer flex items-center gap-2"
                                             >
                                                 <Package size={14} />
                                                 Move to Off-Site
                                             </button>
                                         )}
                                     </div>
                                 )}
                             </div>
                         </div>
 
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                            {displayedStagedContainers.map(container => (
                                <ContainerCard 
                                    key={container.id}
                                    container={container}
                                    meatCuts={filteredMeatCuts.filter(mc => mc.containerId === container.id)}
                                    dispatch={dispatch}
                                    openModal={openModal}
                                    state={state}
                                    highlightedMeatCutIds={searchResults?.meatCutIds || null}
                                    isHighlighted={highlightContainerId === container.id}
                                    onFindProduct={onFindProduct}
                                />
                            ))}
                        </div>
                     </div>
                 )}

                  {displayedFreezers.map(freezer => {
                    let containers = state.containers.filter(c => c.freezerId === freezer.id && !c.isArchived).sort((a,b) => {
                        if (a.id.endsWith('_loose')) return -1;
                        if (b.id.endsWith('_loose')) return 1;
                        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                    });
                    
                    if (searchResults) {
                        containers = containers.filter(c => searchResults.containerIds.has(c.id));
                    }

                    if (hideZeroQuantity) {
                        containers = containers.filter(container => 
                            filteredMeatCuts.some(mc => mc.containerId === container.id && mc.quantity > 0)
                        );
                    }
                    
                    const nonLooseContainers = containers.filter(c => !c.id.endsWith('_loose'));
                    const containerNames = nonLooseContainers.map(c => c.name.trim().toLowerCase());
                    const uniqueNames = new Set(containerNames);
                    const hasDuplicateInFreezer = containerNames.length !== uniqueNames.size;

                    const isTargeted = dragOverFreezerId === freezer.id;
                    
                    return (
                        <div 
                            key={freezer.id} 
                            id={`freezer-section-${freezer.id}`}
                            onDragOver={handleDragOverFreezer}
                            onDragEnter={(e) => handleDragEnterFreezer(e, freezer.id)}
                            onDragLeave={handleDragLeaveFreezer}
                            onDrop={(e) => handleDropContainerOnFreezer(e, freezer.id)}
                            className={`bg-cool-gray-700/40 p-1 sm:p-3.5 rounded-xl shadow-lg flex flex-col gap-2.5 border transition-all duration-300 ${
                                isTargeted 
                                    ? 'border-emerald-400 bg-emerald-950/20 ring-2 ring-emerald-500/25 scale-[1.01]' 
                                    : 'border-cool-gray-700/50 hover:border-cool-gray-650'
                            }`}
                        >
                            <div 
                                className="flex justify-between items-center pb-1.5 px-2 sm:px-3.5 -mx-1 sm:-mx-3.5 border-b border-cool-gray-750/30"
                            >
                                <div className="flex items-center gap-3">
                                    
                                    <h2 className="text-base sm:text-lg font-black tracking-tight text-emerald-400">{freezer.name}</h2>
                                    {freezer.isSpecial && (
                                        <span className="text-[9px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-500/20 font-black">Display Case</span>
                                    )}
                                    {hasDuplicateInFreezer && (
                                        <span className="text-[10px] bg-amber-950/80 text-amber-400 px-2.5 py-0.5 rounded border border-amber-500/30 font-black animate-pulse flex items-center gap-1 cursor-help" title="Warning: This freezer currently contains multiple containers with the same name.">
                                            ⚠️ Duplicate Containers
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => startReconciliation(freezer.id)}
                                    className="px-3 py-1 cursor-pointer border border-indigo-500/30 bg-indigo-650 hover:bg-indigo-600 text-indigo-100 rounded-lg text-xs leading-none font-extrabold shadow-sm transition"
                                >
                                    Reconcile
                                </button>
                            </div>
                            <div className="flex flex-col gap-2.5">
                                {containers.length > 0 ? (
                                    containers.map(container => (
                                        <ContainerCard 
                                            key={container.id}
                                            container={container}
                                            meatCuts={filteredMeatCuts.filter(mc => mc.containerId === container.id)}
                                            dispatch={dispatch}
                                            openModal={openModal}
                                            state={state}
                                            highlightedMeatCutIds={searchResults?.meatCutIds || null}
                                            isHighlighted={highlightContainerId === container.id}
                                            onFindProduct={onFindProduct}
                                        />
                                    ))
                                ) : (
                                    <p className="text-cool-gray-400 text-center py-4 text-xs italic col-span-full">
                                        {hideZeroQuantity ? "No active items or containers in this freezer." : "No containers in this freezer."}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
                </div>
            </div>

            {pendingMove && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs text-left">
                    <div className="w-full max-w-sm p-5 bg-cool-gray-800 border border-cool-gray-750 rounded-lg shadow-xl animate-scale-up">
                        <h4 className="text-md font-bold text-yellow-500 mb-2">Name Conflict Warning</h4>
                        <p className="text-sm text-cool-gray-300">
                            The freezer <span className="font-semibold text-white">"{pendingMove.freezerName}"</span> already has a container named <span className="font-semibold text-white">"{pendingMove.containerName}"</span>. Do you want to proceed with the move anyway?
                        </p>
                        <div className="flex justify-end gap-2.5 mt-5">
                            <button 
                                onClick={() => setPendingMove(null)} 
                                className="px-3 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-650 text-white text-xs font-semibold rounded transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    dispatch({ 
                                        type: 'MOVE_CONTAINER', 
                                        payload: { containerId: pendingMove.containerId, newFreezerId: pendingMove.freezerId } 
                                    });
                                    setPendingMove(null);
                                }} 
                                className="px-3 py-1.5 bg-cyan-650 hover:bg-cyan-550 text-white text-xs font-semibold rounded transition"
                            >
                                Yes, Move
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default FreezerView;
