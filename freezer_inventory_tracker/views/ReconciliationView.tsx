import React, { useState, useMemo } from 'react';
import { InventoryState, Action, Container, MeatCut, Product, ModalType } from '../types';
import { PackageIcon, MeatIcon } from '../components/icons';
import { getContainerIcon } from '../components/ContainerIconsMap';

interface ReconciliationViewProps {
    state: InventoryState;
    dispatch: React.Dispatch<Action>;
    freezerId: string;
    exitReconciliation: () => void;
    openModal: (modal: ModalType) => void;
}

const ReconciliationView: React.FC<ReconciliationViewProps> = ({ state, dispatch, freezerId, exitReconciliation, openModal }) => {
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [verifiedCuts, setVerifiedCuts] = useState<Record<string, boolean>>({});
    
    const [isApplying, setIsApplying] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);
    const [confirmApply, setConfirmApply] = useState(false);
    const [noChangesWarning, setNoChangesWarning] = useState(false);

    const freezer = useMemo(() => state.freezers.find(f => f.id === freezerId), [freezerId, state.freezers]);
    const containersInFreezer = useMemo(() => {
        return state.containers.filter(c => c.freezerId === freezerId).sort((a,b) => {
            if (a.id.endsWith('_loose')) return -1;
            if (b.id.endsWith('_loose')) return 1;
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [freezerId, state.containers]);
    const meatCutsInFreezer = useMemo(() => {
        const containerIds = new Set(containersInFreezer.map(c => c.id));
        return state.meatCuts.filter(mc => containerIds.has(mc.containerId));
    }, [containersInFreezer, state.meatCuts]);

    const handleCountChange = (meatCutId: string, val: string) => {
        let count = parseInt(val, 10);
        if (isNaN(count)) {
            count = 0;
        }
        setCounts(prev => ({...prev, [meatCutId]: Math.max(0, count)}));
        setVerifiedCuts(prev => ({...prev, [meatCutId]: true})); // Auto-verify on edit
    };

    const toggleVerified = (cutId: string) => {
        setVerifiedCuts(prev => ({
            ...prev,
            [cutId]: !prev[cutId]
        }));
    };

    const handleResetAll = () => {
        if (Object.keys(counts).length === 0 && Object.keys(verifiedCuts).length === 0) return;
        if (!confirmReset) {
            setConfirmReset(true);
            setTimeout(() => setConfirmReset(false), 3000);
            return;
        }
        setCounts({});
        setVerifiedCuts({});
        setConfirmReset(false);
    };

    const applyChanges = async () => {
        const changes: {meatCutId: string, newQuantity: number}[] = [];
        meatCutsInFreezer.forEach(mc => {
            const counted = counts[mc.id];
            if (counted !== undefined && counted !== mc.quantity) {
                changes.push({meatCutId: mc.id, newQuantity: counted});
            }
        });
        
        if (changes.length === 0) {
            setNoChangesWarning(true);
            setTimeout(() => setNoChangesWarning(false), 3000);
            return;
        }

        if (!confirmApply) {
            setConfirmApply(true);
            setTimeout(() => setConfirmApply(false), 4000);
            return;
        }

        setIsApplying(true);
        try {
            await dispatch({
                type: 'RECONCILE_QUANTITIES',
                payload: { updates: changes }
            });
            exitReconciliation(); // This returns back to the Freezer tab
        } catch (err) {
            console.error("Failed to apply reconciliation:", err);
        } finally {
            setIsApplying(false);
            setConfirmApply(false);
        }
    };

    if (!freezer) return <p className="text-cool-gray-400 p-4">Freezer not found.</p>;

    const changedCount = Object.keys(counts).filter(k => {
        const cut = meatCutsInFreezer.find(mc => mc.id === k);
        return cut && counts[k] !== cut.quantity;
    }).length;

    return (
        <div className="bg-cool-gray-800/50 p-4 sm:p-6 rounded-lg border border-cool-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 border-b border-cool-gray-700/50 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">Reconcile Freezer</h2>
                    <p className="text-cool-gray-300 font-medium">{freezer.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {(changedCount > 0 || Object.keys(verifiedCuts).length > 0) && (
                        <button 
                            onClick={handleResetAll} 
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${confirmReset ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-md scale-105' : 'bg-cool-gray-700 text-cool-gray-300 hover:bg-cool-gray-600 hover:text-white'}`}
                        >
                            {confirmReset ? 'Confirm Reset?' : 'Reset Actions'}
                        </button>
                    )}
                    <button onClick={exitReconciliation} disabled={isApplying} className="px-4 py-2 bg-cool-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-cool-gray-500 transition disabled:opacity-50 cursor-pointer">Cancel</button>
                    <button 
                        onClick={applyChanges} 
                        disabled={isApplying} 
                        className={`px-4 py-2 text-white font-semibold rounded-lg shadow-md transition-all duration-200 disabled:opacity-50 flex items-center gap-2 cursor-pointer ${confirmApply ? 'bg-amber-600 hover:bg-amber-700 scale-105 shadow-amber-500/20' : noChangesWarning ? 'bg-red-650' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                        {isApplying ? 'Applying...' : noChangesWarning ? 'No changes found' : confirmApply ? 'Click to Confirm Apply' : `Apply Changes (${changedCount})`}
                    </button>
                </div>
            </div>
            
            <p className="text-sm text-cool-gray-400 mb-5">Compare system quantities against direct freezer contents. Update quantities using the buttons below, verify entries, or adjust organization in real-time.</p>

            {/* Quick Actions Panel */}
            <div className="flex flex-wrap items-center gap-3 mb-6 bg-cool-gray-800/40 p-4 rounded-xl border border-cool-gray-700/50 shadow-sm">
                <span className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider mr-1">Organization Actions:</span>
                <button
                    onClick={() => openModal({ type: 'ADD_CONTAINER', freezerId: freezerId })}
                    className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition duration-150 shadow-md cursor-pointer"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Container to Freezer
                </button>
                <button
                    onClick={() => openModal({ type: 'BULK_ADD_MEAT' })}
                    className="px-3.5 py-2 bg-cool-gray-700 hover:bg-cool-gray-650 text-cool-gray-200 font-semibold rounded-lg text-xs flex items-center gap-1.5 border border-cool-gray-600 transition duration-150 shadow cursor-pointer"
                >
                    <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Stock Intake (Bulk Add)
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {containersInFreezer.map(container => {
                    const Icon = getContainerIcon(container?.icon || 'generic');
                    const cuts = meatCutsInFreezer.filter(mc => mc.containerId === container.id);
                    const allCutsVerified = cuts.length > 0 && cuts.every(c => verifiedCuts[c.id]);

                    return (
                        <div key={container.id} className="bg-cool-gray-800/80 border border-cool-gray-700/60 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-2.5 mb-3 border-b border-cool-gray-700/40 pb-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        {container.imageUrl ? (
                                            <img 
                                              src={container.imageUrl} 
                                              alt={container.name} 
                                              className="w-10 h-10 rounded-md object-cover flex-shrink-0 shadow cursor-zoom-in hover:scale-105 transition-transform duration-200" 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                (window as any).__showImagePreview?.(container.imageUrl, container.name);
                                              }}
                                              title="Click to zoom in"
                                              referrerPolicy="no-referrer"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-md bg-cool-gray-700/50 flex items-center justify-center flex-shrink-0 border border-cool-gray-650/40 shadow-inner">
                                                <Icon className="w-5 h-5 text-cyan-300 pointer-events-none" />
                                            </div>
                                        )}
                                        <h3 className="font-bold text-cool-gray-150 leading-tight truncate" title={container.name}>{container.name}</h3>
                                    </div>

                                    {/* Action buttons on container level */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {cuts.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    const allVerified = cuts.every(c => verifiedCuts[c.id]);
                                                    const newVerified = { ...verifiedCuts };
                                                    cuts.forEach(c => {
                                                        newVerified[c.id] = !allVerified;
                                                    });
                                                    setVerifiedCuts(newVerified);
                                                }}
                                                className={`p-1.5 rounded transition flex items-center justify-center border text-xs leading-none cursor-pointer ${allCutsVerified ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-cool-gray-700 bg-cool-gray-850 text-cool-gray-400 hover:text-white hover:border-cool-gray-600'}`}
                                                title={allCutsVerified ? "Unverify All items" : "Verify All items in container"}
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                </svg>
                                            </button>
                                        )}

                                        <button
                                            onClick={() => openModal({ type: 'ADD_MEAT', containerId: container.id })}
                                            className="p-1.5 rounded bg-cool-gray-850 border border-cool-gray-700 text-cool-gray-450 hover:text-cyan-400 hover:border-cool-gray-600 transition flex items-center justify-center cursor-pointer"
                                            title="Add item directly to this container"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                            </svg>
                                        </button>

                                        {!container.id.endsWith('_loose') && (
                                            <button
                                                onClick={() => openModal({ type: 'MOVE_CONTAINER', containerId: container.id })}
                                                className="p-1.5 rounded bg-cool-gray-850 border border-cool-gray-700 text-cool-gray-450 hover:text-emerald-400 hover:border-cool-gray-600 transition flex items-center justify-center cursor-pointer"
                                                title="Move entire container to another freezer"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="space-y-2.5">
                                    {cuts.map(cut => {
                                        const product = state.products.find(p => p.id === cut.productId);
                                        const countedQty = counts[cut.id];
                                        const hasChanged = countedQty !== undefined && countedQty !== cut.quantity;
                                        const activeQty = countedQty ?? cut.quantity;
                                        const isVerified = !!verifiedCuts[cut.id];

                                        let itemCardClass = "bg-cool-gray-700/40 border-cool-gray-700/30";
                                        if (isVerified) {
                                            itemCardClass = "bg-emerald-950/20 border-emerald-500/35 text-emerald-100 shadow-sm shadow-emerald-500/5";
                                        } else if (hasChanged) {
                                            itemCardClass = "bg-yellow-950/30 border-yellow-700/50 text-yellow-105";
                                        }

                                        return (
                                            <div key={cut.id} className={`p-2.5 rounded-lg border transition-all ${itemCardClass}`}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        {/* Verification checkmark trigger */}
                                                        <button
                                                            onClick={() => toggleVerified(cut.id)}
                                                            className="flex-shrink-0 cursor-pointer p-0.5 rounded hover:bg-cool-gray-750 transition"
                                                            title={isVerified ? "Mark Unverified" : "Mark Verified"}
                                                        >
                                                            {isVerified ? (
                                                                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                </svg>
                                                            ) : (
                                                                <svg className="w-5 h-5 text-cool-gray-500 hover:text-cool-gray-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                                    <circle cx="12" cy="12" r="10" />
                                                                </svg>
                                                            )}
                                                        </button>

                                                        {product?.imageUrl ? (
                                                            <img 
                                                              src={product.imageUrl} 
                                                              alt={product.name} 
                                                              className="w-10 h-10 rounded-md object-cover flex-shrink-0 shadow cursor-zoom-in hover:scale-110 active:scale-95 transition-transform duration-200" 
                                                              referrerPolicy="no-referrer"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                (window as any).__showImagePreview?.(product.imageUrl, product.name);
                                                              }}
                                                              title="Click to zoom in"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-md bg-cool-gray-600 flex items-center justify-center flex-shrink-0 shadow-inner">
                                                                <MeatIcon className="w-5 h-5 text-red-350 pointer-events-none" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0 flex-1 leading-tight">
                                                            <p className="text-sm font-bold text-cool-gray-100 truncate" title={product?.name || 'Unknown Product'}>
                                                                {product?.name || 'Unknown Product'}
                                                            </p>
                                                            <p className="text-[10px] sm:text-[11px] text-cool-gray-400 mt-0.5 truncate">
                                                                {product ? `${product.primaryCategory} > ${product.subCategory}` : 'No Category'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Move Item button */}
                                                    <button
                                                        onClick={() => openModal({ type: 'MOVE_MEAT', meatCutId: cut.id })}
                                                        className="px-2 py-1 text-[10px] font-bold text-cool-gray-300 hover:text-white bg-cool-gray-850 hover:bg-cool-gray-750 rounded border border-cool-gray-700/65 flex items-center gap-1 transition-all flex-shrink-0 cursor-pointer"
                                                        title="Move item to another container"
                                                    >
                                                        <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                                        </svg>
                                                        <span>Move</span>
                                                    </button>
                                                </div>
                                                
                                                <div className="flex items-center justify-between mt-2.5 border-t border-cool-gray-700/30 pt-2.5">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-cool-gray-400">System: <strong className="text-cool-gray-200">{cut.quantity}</strong></span>
                                                        {hasChanged && (
                                                            <span className="text-[10px] font-mono mt-0.5 font-bold text-yellow-400">
                                                                {activeQty > cut.quantity ? `+${activeQty - cut.quantity} Surplus` : `-${cut.quantity - activeQty} Deficit`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 bg-cool-gray-950/80 border border-cool-gray-700 rounded-lg p-1">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleCountChange(cut.id, String(Math.max(0, activeQty - 1)))}
                                                            className="w-7 h-7 flex items-center justify-center text-cool-gray-400 hover:text-white focus:text-white hover:bg-red-500 focus:bg-red-500 rounded-md transition font-bold outline-none cursor-pointer"
                                                        >
                                                            -
                                                        </button>
                                                        <input 
                                                            id={`count-${cut.id}`}
                                                            type="number" 
                                                            min="0"
                                                            value={activeQty}
                                                            onChange={e => handleCountChange(cut.id, e.target.value)}
                                                            className="w-10 text-center bg-transparent border-0 focus:ring-0 text-sm font-bold text-cool-gray-100 p-0 focus:outline-none"
                                                        />
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleCountChange(cut.id, String(activeQty + 1))}
                                                            className="w-7 h-7 flex items-center justify-center text-cool-gray-400 hover:text-white focus:text-white hover:bg-green-500 focus:bg-green-500 rounded-md transition font-bold outline-none cursor-pointer"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {cuts.length === 0 && <p className="text-xs text-center text-cool-gray-500 py-4 italic">Container is empty</p>}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default ReconciliationView;
