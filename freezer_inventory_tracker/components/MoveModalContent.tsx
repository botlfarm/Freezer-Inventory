import React, { useState, useRef } from 'react';
import { Action, InventoryState, Container } from '../types';
import AddForms from './AddForms';
import { PackageIcon, PlusIcon, MinusIcon } from './icons';
import { getContainerIcon } from './ContainerIconsMap';
import { generateUUID } from './uuidHelper';

interface CommonMoveProps {
  dispatch: React.Dispatch<Action>;
  state: InventoryState;
  onClose: () => void;
}

// Removed hardcoded local icons Map in favor of shared getContainerIcon

type MoveDestination = 'existing' | 'retired' | 'new';

const MoveMeat: React.FC<CommonMoveProps & { meatCutId: string }> = ({ dispatch, state, onClose, meatCutId }) => {
  const meatCut = state.meatCuts.find(m => m.id === meatCutId);
  const defaultContainerId = React.useMemo(() => {
    const specialFreezers = state.freezers.filter(f => f.isSpecial);
    for (const freezer of specialFreezers) {
      const looseContainer = state.containers.find(c => c.id === freezer.id + "_loose");
      if (looseContainer && looseContainer.id !== meatCut?.containerId) {
        return looseContainer.id;
      }
      const anyContainer = state.containers.find(c => c.freezerId === freezer.id && c.id !== meatCut?.containerId);
      if (anyContainer) {
        return anyContainer.id;
      }
    }
    const firstSpecial = state.freezers.find(f => f.isSpecial);
    if (firstSpecial) {
      return firstSpecial.id + "_loose";
    }
    return '';
  }, [state.freezers, state.containers, meatCut]);

  const [targetContainerId, setTargetContainerId] = useState<string>(defaultContainerId);
  const [quantityStr, setQuantityStr] = useState(meatCut ? meatCut.quantity.toString() : "1");
  const [destinationType, setDestinationType] = useState<MoveDestination>('existing');
  const [searchRetiredText, setSearchRetiredText] = useState('');
  const [targetFreezerId, setTargetFreezerId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const hasRetiredConflict = React.useMemo(() => {
    if (destinationType !== 'retired' || !targetContainerId || !targetFreezerId) return false;
    const targetContainer = state.containers.find(c => c.id === targetContainerId) ||
      (state.containerTemplates || []).find(t => t.id === targetContainerId);
    if (!targetContainer) return false;
    return state.containers.some(c => 
      c.id !== targetContainer.id &&
      c.freezerId === targetFreezerId &&
      c.name.trim().toLowerCase() === targetContainer.name.trim().toLowerCase()
    );
  }, [destinationType, targetContainerId, targetFreezerId, state.containers, state.containerTemplates]);

  if (!meatCut) return <p>Error: Meat cut not found.</p>;
  
  const product = state.products.find(p => p.id === meatCut.productId);
  if (!product) return <p>Error: Product not found.</p>;

  const sourceContainer = state.containers.find(c => c.id === meatCut.containerId);

  const evaluateMathExpression = (input: string, baseValue: number, maxLimit: number): number | null => {
    const sanitized = input.replace(/\s+/g, '');
    
    // Explicit delta e.g., "+3" or "-2"
    if (sanitized.startsWith('+') || sanitized.startsWith('-')) {
      try {
        const delta = parseInt(sanitized, 10);
        if (!isNaN(delta)) {
          return Math.min(maxLimit, Math.max(1, baseValue + delta));
        }
      } catch (e) {}
    }
    
    // Formula e.g. "5+2"
    if (/^\d+[\+\-]\d+$/.test(sanitized)) {
      try {
        const match = sanitized.match(/^(\d+)([\+\-])(\d+)$/);
        if (match) {
          const op1 = parseInt(match[1], 10);
          const sign = match[2];
          const op2 = parseInt(match[3], 10);
          const result = sign === '+' ? op1 + op2 : op1 - op2;
          return Math.min(maxLimit, Math.max(1, result));
        }
      } catch (e) {}
    }
    
    const parsed = parseInt(sanitized, 10);
    if (!isNaN(parsed)) return Math.min(maxLimit, Math.max(1, parsed));
    return null;
  };

  const evalQty = evaluateMathExpression(quantityStr, 1, meatCut.quantity) ?? 1;

  const handleModifyQuantity = (delta: number) => {
    const currentVal = evalQty;
    const newVal = Math.min(meatCut.quantity, Math.max(1, currentVal + delta));
    setQuantityStr(newVal.toString());
  };

  const handleContainerCreated = async (newContainerId: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await dispatch({ 
        type: 'MOVE_MEAT_QUANTITY', 
        payload: { 
          meatCutId, 
          productId: meatCut.productId,
          newContainerId, 
          quantity: evalQty, 
          sourceContainerId: meatCut.containerId,
          notes: meatCut.notes,
          tagIds: meatCut.tagIds,
          originalCutName: meatCut.originalCutName
        } 
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to move item.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    
    try {
      if (targetContainerId && targetContainerId !== meatCut.containerId && evalQty > 0) {
        let finalTargetContainerId = targetContainerId;

        if (destinationType === 'retired') {
          if (!targetFreezerId) {
            setErrorMsg("Please assign a freezer location to un-retire this container.");
            return;
          }

          const existingContainer = state.containers.find(c => c.id === targetContainerId);
          const matchedTemplate = (state.containerTemplates || []).find(t => t.id === targetContainerId || t.name.toLowerCase().trim() === targetContainerId.toLowerCase().trim());

          if (existingContainer) {
            if (existingContainer.isArchived) {
              await dispatch({ type: 'TOGGLE_CONTAINER_ARCHIVED', payload: { containerId: existingContainer.id, isArchived: false } });
            }
            await dispatch({ type: 'MOVE_CONTAINER', payload: { containerId: existingContainer.id, newFreezerId: targetFreezerId } });
            finalTargetContainerId = existingContainer.id;
          } else if (matchedTemplate) {
            const generatedId = generateUUID();
            const newContainerPayload = {
              id: generatedId,
              name: matchedTemplate.name,
              icon: matchedTemplate.icon || 'Folder',
              templateId: matchedTemplate.id,
              imageUrl: matchedTemplate.imageUrl || undefined,
              deleteOnEmpty: false,
              freezerId: targetFreezerId,
              isArchived: false
            };

            const success = await dispatch({ type: 'ADD_CONTAINER', payload: newContainerPayload });
            if (!success) {
              setErrorMsg('Failed to instantiate container from template.');
              return;
            }
            finalTargetContainerId = generatedId;
          }
        }
        
        const success = await dispatch({ 
          type: 'MOVE_MEAT_QUANTITY', 
          payload: { 
            meatCutId, 
            productId: meatCut.productId,
            newContainerId: finalTargetContainerId, 
            quantity: evalQty, 
            sourceContainerId: meatCut.containerId,
            notes: meatCut.notes,
            tagIds: meatCut.tagIds,
            originalCutName: meatCut.originalCutName
          } 
        });
        if (success) {
          onClose();
        }
      }
    } catch (err: any) {
      console.error("Error moving meat cut:", err);
      setErrorMsg(err?.message || "Failed to move meat cut.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const renderContainerOption = (container: Container) => {
      const Icon = getContainerIcon(container.icon || 'generic');
      const freezer = state.freezers.find(f => f.id === container.freezerId);

      return (
        <button
          type="button"
          key={container.id}
          onClick={() => {
            setTargetContainerId(container.id);
            setErrorMsg('');
          }}
          className={`w-full text-left p-2 rounded-md flex items-center gap-3 transition ${targetContainerId === container.id ? 'bg-cyan-600 ring-2 ring-cyan-300' : 'bg-cool-gray-700 hover:bg-cool-gray-600'}`}
        >
          {container.imageUrl ? (
            <img 
              src={container.imageUrl} 
              alt={container.name} 
              className="w-10 h-10 rounded-md object-cover flex-shrink-0 cursor-zoom-in hover:scale-110 active:scale-95 transition-transform duration-200" 
              onClick={(e) => {
                e.stopPropagation();
                (window as any).__showImagePreview?.(container.imageUrl, container.name);
              }}
              title="Click to zoom in"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-md bg-cool-gray-800 flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-cyan-300"/>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{container.name}</p>
            {freezer && <p className="text-xs text-cool-gray-300">{freezer.name}</p>}
          </div>
        </button>
      )
  };
  
  const renderDestinationSelector = () => {
    let containerList: Container[] = [];
    const searchWords = searchRetiredText.toLowerCase().trim().split(/\s+/).filter(Boolean);

    if (destinationType === 'existing') {
        containerList = state.containers.filter(c => c.freezerId && c.id !== meatCut.containerId && !c.isBox && !c.id.startsWith('box-') && !c.isArchived);
        if (searchWords.length > 0) {
            containerList = containerList.filter(c => {
                const nameLower = c.name.toLowerCase();
                let freezerMatch = false;
                const freezer = state.freezers.find(f => f.id === c.freezerId);
                if (freezer) {
                    const freezerNameLower = freezer.name.toLowerCase();
                    freezerMatch = searchWords.every(word => freezerNameLower.includes(word));
                }
                const containerNameMatch = searchWords.every(word => nameLower.includes(word));
                return containerNameMatch || freezerMatch;
            });
        }
    } else if (destinationType === 'retired') {
        const templateItems: Container[] = (state.containerTemplates || []).map(tpl => ({
            id: tpl.id,
            name: tpl.name,
            icon: tpl.icon || 'Folder',
            imageUrl: tpl.imageUrl,
            templateId: tpl.id,
            deleteOnEmpty: false,
            isArchived: false
        }));

        const existingTemplateIds = new Set((state.containerTemplates || []).map(t => t.id));
        const existingTemplateNames = new Set((state.containerTemplates || []).map(t => t.name.toLowerCase().trim()));

        const unplacedContainers = state.containers.filter(c => {
            if (c.isBox || c.id.startsWith('box-') || c.id.endsWith('_loose') || c.id === 'staging_loose') return false;
            const isUnplaced = !c.freezerId || c.isArchived;
            if (!isUnplaced) return false;
            if (c.templateId && existingTemplateIds.has(c.templateId)) return false;
            if (existingTemplateNames.has(c.name.toLowerCase().trim())) return false;
            return true;
        });

        containerList = [...templateItems, ...unplacedContainers];
        if (searchWords.length > 0) {
            containerList = containerList.filter(c => {
                const nameLower = c.name.toLowerCase();
                return searchWords.every(word => nameLower.includes(word));
            });
        }
    }
    containerList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    if (destinationType === 'new') {
        return (
             <AddForms.ContainerForm 
                dispatch={dispatch}
                onClose={onClose}
                state={state}
                freezerId={sourceContainer?.freezerId}
                onContainerCreated={handleContainerCreated}
             />
        );
    }

    return (
        <div className="space-y-3">
            {(destinationType === 'retired' || destinationType === 'existing') && (
                <div className="space-y-1">
                    <label className="block text-xs font-bold text-cool-gray-300 uppercase tracking-wider">
                        {destinationType === 'retired' ? 'Search reusable templates & retired containers:' : 'Search existing containers by name:'}
                    </label>
                    <input 
                        type="text" 
                        value={searchRetiredText}
                        onChange={(e) => setSearchRetiredText(e.target.value)}
                        placeholder="Type bag/box name to filter..."
                        className="w-full px-3 py-1.5 text-xs bg-cool-gray-750 border border-cool-gray-650 rounded text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans"
                    />
                </div>
            )}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {containerList.length > 0 ? containerList.map(renderContainerOption) : <p className="text-cool-gray-400 text-center text-sm py-4">No matching containers available.</p>}
            </div>
            
            {targetContainerId && destinationType === 'retired' && (() => {
                const selectedContainer = state.containers.find(c => c.id === targetContainerId) ||
                  (state.containerTemplates || []).find(t => t.id === targetContainerId);
                return (
                    <div className="bg-amber-955/25 border border-amber-500/25 p-2.5 rounded-md space-y-2 animate-scale-up text-left">
                        <label className="block text-xs font-extrabold text-amber-400 uppercase tracking-wider">
                           Assign Freezer Location to Container Location:
                        </label>
                        <select
                            required
                            value={targetFreezerId} 
                            onChange={(e) => {
                                setTargetFreezerId(e.target.value);
                                setErrorMsg('');
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-cool-gray-800 border border-cool-gray-750 text-white rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                        >
                            <option value="">-- Select Freezer --</option>
                            {state.freezers.filter(f => !f.isPallet && !f.id.startsWith('pallet-') && !f.isArchived).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(f => (
                                <option key={f.id} value={f.id}>{f.name} {f.isSpecial ? " (Display Case)" : ""}</option>
                            ))}
                        </select>
                        {hasRetiredConflict && (
                            <p className="text-yellow-400 text-xs">
                                ⚠️ Warning: The selected freezer already contains a container named "{selectedContainer?.name}". You may proceed, but duplicates will exist in this freezer.
                            </p>
                        )}
                        <p className="text-[10px] text-cool-gray-400 leading-normal">
                            * Selecting freezer location will automatically place container "{selectedContainer?.name}" into that freezer.
                        </p>
                    </div>
                );
            })()}
        </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className='text-cool-gray-300 text-sm'>Move <span className='font-bold text-white'>{product.name}</span>:</p>
      
      <div className="space-y-2">
          <label className="block text-xs font-bold text-cool-gray-300 uppercase tracking-wider">
             Quantity (Math is supported, e.g. "+3", "-5", "5+2"):
          </label>
          <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleModifyQuantity(-1)}
                className="p-2.5 rounded-lg bg-cool-gray-750 hover:bg-cool-gray-650 text-cool-gray-200 border border-cool-gray-650 hover:text-white transition shadow-sm w-10 h-10 flex items-center justify-center cursor-pointer shrink-0"
                title="Decrease quantity by 1"
              >
                <MinusIcon className="w-5 h-5"/>
              </button>
              
              <input
                type="text"
                value={quantityStr}
                onChange={(e) => setQuantityStr(e.target.value)}
                className="flex-grow px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-white text-md text-center font-bold"
                placeholder="Type quantity or offset..."
              />
              
              <button
                type="button"
                onClick={() => handleModifyQuantity(1)}
                className="p-2.5 rounded-lg bg-cool-gray-750 hover:bg-cool-gray-650 text-cool-gray-200 border border-cool-gray-650 hover:text-white transition shadow-sm w-10 h-10 flex items-center justify-center cursor-pointer shrink-0"
                title="Increase quantity by 1"
              >
                <PlusIcon className="w-5 h-5"/>
              </button>
          </div>
          
          <p className="text-[11px] text-cool-gray-400 font-mono text-right">
            Parsed Quantity: <span className="text-cyan-400 font-bold">{evalQty}</span> / {meatCut.quantity} pcs total
          </p>
      </div>
      
      <div className="flex bg-cool-gray-900/50 p-1 rounded-md">
          <button type="button" onClick={() => { setDestinationType('existing'); setTargetContainerId(''); setTargetFreezerId(''); setErrorMsg(''); }} className={`flex-1 py-1 text-xs rounded ${destinationType === 'existing' ? 'bg-cyan-600 text-white' : 'hover:bg-cool-gray-700 text-cool-gray-405 font-medium'}`}>Existing Containers</button>
          <button type="button" onClick={() => { setDestinationType('retired'); setTargetContainerId(''); setTargetFreezerId(''); setErrorMsg(''); }} className={`flex-1 py-1 text-xs rounded ${destinationType === 'retired' ? 'bg-cyan-600 text-white' : 'hover:bg-cool-gray-700 text-cool-gray-405 font-medium'}`}>Retired Bags</button>
          <button type="button" onClick={() => { setDestinationType('new'); setTargetContainerId(''); setTargetFreezerId(''); setErrorMsg(''); }} className={`flex-1 py-1 text-xs rounded ${destinationType === 'new' ? 'bg-cyan-600 text-white' : 'hover:bg-cool-gray-700 text-cool-gray-405 font-medium'}`}>New Container</button>
      </div>

      {renderDestinationSelector()}

      {errorMsg && (
          <p className="text-red-400 text-xs font-bold animate-pulse bg-red-950/20 p-2 rounded border border-red-500/20">
              ⚠️ {errorMsg}
          </p>
      )}
      
      {destinationType !== 'new' && (
        <button 
            type="submit" 
            disabled={isSubmitting || !targetContainerId || (destinationType === 'retired' && !targetFreezerId)} 
            className="w-full py-2.5 px-4 bg-cyan-600 text-white font-extrabold rounded-lg hover:bg-cyan-700 transition disabled:bg-cool-gray-800 disabled:text-cool-gray-500 disabled:cursor-not-allowed text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer active:scale-95"
        >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Moving Item...</span>
              </>
            ) : (
              'Move Item'
            )}
        </button>
      )}
    </form>
  );
};

const MoveContainer: React.FC<CommonMoveProps & { containerId: string }> = ({ dispatch, state, onClose, containerId }) => {
    const container = state.containers.find(c => c.id === containerId);
    const defaultFreezerId = React.useMemo(() => {
        const special = state.freezers.find(f => f.isSpecial && f.id !== container?.freezerId);
        return special ? special.id : '';
    }, [state.freezers, container]);
    const [targetFreezerId, setTargetFreezerId] = useState<string>(defaultFreezerId);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);
  
    if (!container) {
      return <p>Error: Container not found.</p>;
    }

    const hasDuplicateInTarget = state.containers.some(c => 
      c.id !== container.id && 
      c.freezerId === targetFreezerId && 
      c.name.trim().toLowerCase() === container.name.trim().toLowerCase() &&
      targetFreezerId !== ''
    );
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      try {
        if (targetFreezerId !== container.freezerId) {
          await dispatch({ type: 'MOVE_CONTAINER', payload: { containerId, newFreezerId: targetFreezerId || undefined } });
        }
        onClose();
      } catch (err) {
        console.error("Failed to move container:", err);
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    };
    
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className='text-cool-gray-300'>Move <span className='font-bold text-white'>{container.name}</span> to:</p>
        <select
          value={targetFreezerId}
          onChange={(e) => setTargetFreezerId(e.target.value)}
          className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="" >🛒 Move to Staging Area & Sorting Table</option>
          {state.freezers
            .filter(f => f.id !== container.freezerId && !f.isPallet && !f.id.startsWith('pallet-') && !f.isArchived)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
            .map(freezer => (
              <option key={freezer.id} value={freezer.id}>
                {freezer.name}
              </option>
            ))}
        </select>
        
        {hasDuplicateInTarget && (
          <p className="text-yellow-400 text-xs">
            ⚠️ Warning: The selected freezer already containing a container named "{container.name}". You are allowed to proceed, but they will share the same name.
          </p>
        )}

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full py-2 px-4 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          {isSubmitting ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Moving Container...</span>
            </>
          ) : (
            'Move Container'
          )}
        </button>
      </form>
    );
  };


const ChangeContainerFlow: React.FC<CommonMoveProps & { containerId: string }> = ({ dispatch, state, onClose, containerId }) => {
  const sourceContainer = state.containers.find(c => c.id === containerId);
  const containerCuts = React.useMemo(() => {
    return state.meatCuts.filter(mc => mc.containerId === containerId && mc.quantity > 0);
  }, [state.meatCuts, containerId]);

  // Track selected cuts and their move quantities
  const [selectedCuts, setSelectedCuts] = useState<Record<string, { selected: boolean; quantityStr: string }>>(() => {
    const initial: Record<string, { selected: boolean; quantityStr: string }> = {};
    containerCuts.forEach(mc => {
      initial[mc.id] = { selected: true, quantityStr: mc.quantity.toString() };
    });
    return initial;
  });

  const [targetContainerId, setTargetContainerId] = useState<string>('');
  const [destinationType, setDestinationType] = useState<MoveDestination>('existing');
  const [searchRetiredText, setSearchRetiredText] = useState('');
  const [targetFreezerId, setTargetFreezerId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  if (!sourceContainer) return <p className="text-red-400 font-bold p-4 text-center">Error: Source container not found.</p>;

  const handleToggleSelect = (mcId: string) => {
    setSelectedCuts(prev => ({
      ...prev,
      [mcId]: {
        ...prev[mcId],
        selected: !prev[mcId].selected
      }
    }));
  };

  const handleQuantityChange = (mcId: string, val: string) => {
    setSelectedCuts(prev => ({
      ...prev,
      [mcId]: {
        ...prev[mcId],
        quantityStr: val
      }
    }));
  };

  const handleModifyQuantity = (mcId: string, delta: number, maxLimit: number) => {
    const currentVal = parseInt(selectedCuts[mcId]?.quantityStr || '0', 10) || 0;
    const newVal = Math.min(maxLimit, Math.max(1, currentVal + delta));
    handleQuantityChange(mcId, newVal.toString());
  };

  const handleSelectAll = () => {
    const allSelected = containerCuts.every(mc => selectedCuts[mc.id]?.selected);
    setSelectedCuts(prev => {
      const updated = { ...prev };
      containerCuts.forEach(mc => {
        updated[mc.id] = { ...updated[mc.id], selected: !allSelected };
      });
      return updated;
    });
  };

  const evaluateMathExpression = (input: string, baseValue: number, maxLimit: number): number | null => {
    const sanitized = input.replace(/\s+/g, '');
    
    // Explicit delta e.g., "+3" or "-2"
    if (sanitized.startsWith('+') || sanitized.startsWith('-')) {
      try {
        const delta = parseInt(sanitized, 10);
        if (!isNaN(delta)) {
          return Math.min(maxLimit, Math.max(1, baseValue + delta));
        }
      } catch (e) {}
    }
    
    // Formula e.g. "5+2"
    if (/^\d+[\+\-]\d+$/.test(sanitized)) {
      try {
        const match = sanitized.match(/^(\d+)([\+\-])(\d+)$/);
        if (match) {
          const op1 = parseInt(match[1], 10);
          const sign = match[2];
          const op2 = parseInt(match[3], 10);
          const result = sign === '+' ? op1 + op2 : op1 - op2;
          return Math.min(maxLimit, Math.max(1, result));
        }
      } catch (e) {}
    }
    
    const parsed = parseInt(sanitized, 10);
    if (!isNaN(parsed)) return Math.min(maxLimit, Math.max(1, parsed));
    return null;
  };

  const handleSubmit = async (e?: React.FormEvent, finalTargetContainerId?: string) => {
    if (e) e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      let destContainerId = finalTargetContainerId || targetContainerId;
      if (!destContainerId) {
        setErrorMsg("Please select a target container.");
        return;
      }

      if (destinationType === 'retired') {
        if (!targetFreezerId) {
          setErrorMsg("Please assign a freezer location to un-retire this container.");
          return;
        }
        const existingContainer = state.containers.find(c => c.id === destContainerId);
        const matchedTemplate = (state.containerTemplates || []).find(t => t.id === destContainerId || t.name.toLowerCase().trim() === destContainerId.toLowerCase().trim());

        if (existingContainer) {
          if (existingContainer.isArchived) {
            await dispatch({ type: 'TOGGLE_CONTAINER_ARCHIVED', payload: { containerId: existingContainer.id, isArchived: false } });
          }
          await dispatch({ type: 'MOVE_CONTAINER', payload: { containerId: existingContainer.id, newFreezerId: targetFreezerId } });
          destContainerId = existingContainer.id;
        } else if (matchedTemplate) {
          const generatedId = generateUUID();
          const newContainerPayload = {
            id: generatedId,
            name: matchedTemplate.name,
            icon: matchedTemplate.icon || 'Folder',
            templateId: matchedTemplate.id,
            imageUrl: matchedTemplate.imageUrl || undefined,
            deleteOnEmpty: false,
            freezerId: targetFreezerId,
            isArchived: false
          };

          const success = await dispatch({ type: 'ADD_CONTAINER', payload: newContainerPayload });
          if (!success) {
            setErrorMsg('Failed to instantiate container from template.');
            return;
          }
          destContainerId = generatedId;
        }
      }

      // Filter cuts that are selected and have valid quantities
      const cutsToMove: Array<{ id: string; qty: number }> = [];
      for (const mc of containerCuts) {
        const stateForMc = selectedCuts[mc.id];
        if (stateForMc?.selected) {
          const parsedQty = evaluateMathExpression(stateForMc.quantityStr, 1, mc.quantity) ?? mc.quantity;
          if (parsedQty > 0) {
            cutsToMove.push({ id: mc.id, qty: parsedQty });
          }
        }
      }

      if (cutsToMove.length === 0) {
        setErrorMsg("Please select at least one cut to move with a quantity greater than zero.");
        return;
      }

      // Execute moves sequentially to maintain consistency
      for (const item of cutsToMove) {
        await dispatch({
          type: 'MOVE_MEAT_QUANTITY',
          payload: {
            meatCutId: item.id,
            newContainerId: destContainerId,
            quantity: item.qty,
            sourceContainerId: containerId
          }
        });
      }
      onClose();
    } catch (err: any) {
      console.error("Error moving cuts:", err);
      setErrorMsg(err.message || "Failed to complete the transfer.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleContainerCreated = async (newContainerId: string) => {
    await handleSubmit(undefined, newContainerId);
  };

  const renderContainerOption = (container: Container) => {
      const Icon = getContainerIcon(container.icon || 'generic');
      const freezer = state.freezers.find(f => f.id === container.freezerId);

      return (
        <button
          type="button"
          key={container.id}
          onClick={() => {
            setTargetContainerId(container.id);
            setErrorMsg('');
          }}
          className={`w-full text-left p-2 rounded-md flex items-center gap-3 transition ${targetContainerId === container.id ? 'bg-cyan-600 ring-2 ring-cyan-300 text-white' : 'bg-cool-gray-700 hover:bg-cool-gray-600 text-cool-gray-100'}`}
        >
          {container.imageUrl ? (
            <img 
              src={container.imageUrl} 
              alt={container.name} 
              className="w-10 h-10 rounded-md object-cover flex-shrink-0 cursor-zoom-in hover:scale-110 active:scale-95 transition-transform duration-200" 
              onClick={(e) => {
                e.stopPropagation();
                (window as any).__showImagePreview?.(container.imageUrl, container.name);
              }}
              title="Click to zoom in"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-md bg-cool-gray-800 flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-cyan-300"/>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-xs truncate">{container.name}</p>
            {freezer && <p className="text-[10px] text-cool-gray-300">{freezer.name}</p>}
          </div>
        </button>
      );
  };

  const renderDestinationSelector = () => {
    let containerList: Container[] = [];
    const searchWords = searchRetiredText.toLowerCase().trim().split(/\s+/).filter(Boolean);

    if (destinationType === 'existing') {
        containerList = state.containers.filter(c => c.freezerId && c.id !== containerId && !c.isBox && !c.id.startsWith('box-') && !c.isArchived);
        if (searchWords.length > 0) {
            containerList = containerList.filter(c => {
                const nameLower = c.name.toLowerCase();
                let freezerMatch = false;
                const freezer = state.freezers.find(f => f.id === c.freezerId);
                if (freezer) {
                    const freezerNameLower = freezer.name.toLowerCase();
                    freezerMatch = searchWords.every(word => freezerNameLower.includes(word));
                }
                const containerNameMatch = searchWords.every(word => nameLower.includes(word));
                return containerNameMatch || freezerMatch;
            });
        }
    } else if (destinationType === 'retired') {
        const templateItems: Container[] = (state.containerTemplates || []).map(tpl => ({
            id: tpl.id,
            name: tpl.name,
            icon: tpl.icon || 'Folder',
            imageUrl: tpl.imageUrl,
            templateId: tpl.id,
            deleteOnEmpty: false,
            isArchived: false
        }));

        const existingTemplateIds = new Set((state.containerTemplates || []).map(t => t.id));
        const existingTemplateNames = new Set((state.containerTemplates || []).map(t => t.name.toLowerCase().trim()));

        const unplacedContainers = state.containers.filter(c => {
            if (c.isBox || c.id.startsWith('box-') || c.id.endsWith('_loose') || c.id === 'staging_loose') return false;
            const isUnplaced = !c.freezerId || c.isArchived;
            if (!isUnplaced) return false;
            if (c.templateId && existingTemplateIds.has(c.templateId)) return false;
            if (existingTemplateNames.has(c.name.toLowerCase().trim())) return false;
            return true;
        });

        containerList = [...templateItems, ...unplacedContainers];
        if (searchWords.length > 0) {
            containerList = containerList.filter(c => {
                const nameLower = c.name.toLowerCase();
                return searchWords.every(word => nameLower.includes(word));
            });
        }
    }
    containerList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    if (destinationType === 'new') {
        return (
             <AddForms.ContainerForm 
                dispatch={dispatch}
                onClose={onClose}
                state={state}
                freezerId={sourceContainer?.freezerId}
                onContainerCreated={handleContainerCreated}
             />
        );
    }

    return (
        <div className="space-y-3">
            {(destinationType === 'retired' || destinationType === 'existing') && (
                <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider">
                        {destinationType === 'retired' ? 'Search reusable templates & retired containers:' : 'Search existing containers by name:'}
                    </label>
                    <input 
                        type="text" 
                        value={searchRetiredText}
                        onChange={(e) => setSearchRetiredText(e.target.value)}
                        placeholder="Type bag/box name to filter..."
                        className="w-full px-3 py-1.5 text-xs bg-cool-gray-750 border border-cool-gray-650 rounded text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans"
                    />
                </div>
            )}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {containerList.length > 0 ? containerList.map(renderContainerOption) : <p className="text-cool-gray-400 text-center text-xs py-4">No matching containers available.</p>}
            </div>
            
            {targetContainerId && destinationType === 'retired' && (() => {
                const selectedContainer = state.containers.find(c => c.id === targetContainerId) ||
                  (state.containerTemplates || []).find(t => t.id === targetContainerId);
                return (
                    <div className="bg-amber-950/25 border border-amber-500/20 p-2.5 rounded-md space-y-2 text-left">
                        <label className="block text-[11px] font-extrabold text-amber-400 uppercase tracking-wider">
                           Assign Freezer Location to Container Location:
                        </label>
                        <select
                            required
                            value={targetFreezerId} 
                            onChange={(e) => {
                                setTargetFreezerId(e.target.value);
                                setErrorMsg('');
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-cool-gray-800 border border-cool-gray-750 text-white rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                        >
                            <option value="">-- Select Freezer --</option>
                            {state.freezers.filter(f => !f.isPallet && !f.id.startsWith('pallet-') && !f.isArchived).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(f => (
                                <option key={f.id} value={f.id}>{f.name} {f.isSpecial ? " (Display Case)" : ""}</option>
                            ))}
                        </select>
                        <p className="text-[9px] text-cool-gray-400 leading-normal">
                            * Selecting freezer location will automatically place container "{selectedContainer?.name}" into that freezer.
                        </p>
                    </div>
                );
            })()}
        </div>
    );
  };

  const allSelected = containerCuts.every(mc => selectedCuts[mc.id]?.selected);
  const selectedCount = containerCuts.filter(mc => selectedCuts[mc.id]?.selected).length;

  return (
    <form onSubmit={(e) => handleSubmit(e)} className="space-y-5">
      {/* Step 1: List the cuts currently inside this container */}
      <div className="space-y-2 text-left">
        <div className="flex justify-between items-center pb-2 border-b border-cool-gray-800">
          <label className="text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider">
            Select Cuts to Move from <span className="text-cyan-400 font-extrabold">"{sourceContainer.name}"</span>:
          </label>
          {containerCuts.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition cursor-pointer"
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>

        {containerCuts.length === 0 ? (
          <div className="text-center py-6 bg-cool-gray-850/50 rounded-lg border border-cool-gray-800">
            <p className="text-cool-gray-400 text-xs">This container is currently empty. There are no cuts to transfer.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {containerCuts.map(mc => {
              const product = state.products.find(p => p.id === mc.productId);
              const cutState = selectedCuts[mc.id] || { selected: false, quantityStr: '0' };
              const currentVal = parseInt(cutState.quantityStr, 10) || 0;

              return (
                <div 
                  key={mc.id} 
                  className={`p-2 rounded-lg border transition flex items-center justify-between gap-3 ${cutState.selected ? 'bg-cool-gray-800/85 border-cyan-500/40 shadow-sm' : 'bg-cool-gray-900/40 border-cool-gray-800/80'}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input 
                      type="checkbox"
                      checked={cutState.selected}
                      onChange={() => handleToggleSelect(mc.id)}
                      className="w-4 h-4 rounded border-cool-gray-650 bg-cool-gray-750 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-cool-gray-100 truncate">{product?.name || "Unknown Cut"}</p>
                      {mc.notes && <p className="text-[10px] text-cool-gray-400 truncate">"{mc.notes}"</p>}
                    </div>
                  </div>

                  {cutState.selected && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleModifyQuantity(mc.id, -1, mc.quantity)}
                        disabled={currentVal <= 1}
                        className="p-1 rounded bg-cool-gray-700 hover:bg-cool-gray-600 text-cool-gray-200 hover:text-white transition w-6 h-6 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold"
                      >
                        -
                      </button>
                      <input
                        type="text"
                        value={cutState.quantityStr ?? ''}
                        onChange={(e) => handleQuantityChange(mc.id, e.target.value)}
                        className="w-10 text-center py-0.5 bg-cool-gray-750 border border-cool-gray-650 rounded text-white text-xs font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleModifyQuantity(mc.id, 1, mc.quantity)}
                        disabled={currentVal >= mc.quantity}
                        className="p-1 rounded bg-cool-gray-700 hover:bg-cool-gray-600 text-cool-gray-200 hover:text-white transition w-6 h-6 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold"
                      >
                        +
                      </button>
                      <span className="text-[10px] text-cool-gray-400 font-mono ml-1">/ {mc.quantity}</span>
                    </div>
                  )}

                  {!cutState.selected && (
                    <span className="text-xs text-cool-gray-400 shrink-0 font-mono font-medium">Qty: {mc.quantity}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {containerCuts.length > 0 && (
        <>
          {/* Step 2: Choose destination container type */}
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider block">
              Choose Destination Container:
            </label>
            <div className="flex bg-cool-gray-900/50 p-1 rounded-md">
              <button 
                type="button" 
                onClick={() => { setDestinationType('existing'); setTargetContainerId(''); setTargetFreezerId(''); setErrorMsg(''); }} 
                className={`flex-1 py-1 text-xs rounded transition cursor-pointer ${destinationType === 'existing' ? 'bg-cyan-600 text-white font-bold' : 'hover:bg-cool-gray-700 text-cool-gray-400 font-medium'}`}
              >
                Existing Containers
              </button>
              <button 
                type="button" 
                onClick={() => { setDestinationType('retired'); setTargetContainerId(''); setTargetFreezerId(''); setErrorMsg(''); }} 
                className={`flex-1 py-1 text-xs rounded transition cursor-pointer ${destinationType === 'retired' ? 'bg-cyan-600 text-white font-bold' : 'hover:bg-cool-gray-700 text-cool-gray-400 font-medium'}`}
              >
                Retired Bags
              </button>
              <button 
                type="button" 
                onClick={() => { setDestinationType('new'); setTargetContainerId(''); setTargetFreezerId(''); setErrorMsg(''); }} 
                className={`flex-1 py-1 text-xs rounded transition cursor-pointer ${destinationType === 'new' ? 'bg-cyan-600 text-white font-bold' : 'hover:bg-cool-gray-700 text-cool-gray-400 font-medium'}`}
              >
                New Container
              </button>
            </div>
          </div>

          {renderDestinationSelector()}

          {errorMsg && (
            <p className="text-red-400 text-xs font-bold animate-pulse bg-red-950/20 p-2 rounded border border-red-500/20">
              ⚠️ {errorMsg}
            </p>
          )}

          {destinationType !== 'new' && (
            <button 
              type="submit" 
              disabled={isSubmitting || selectedCount === 0 || !targetContainerId || (destinationType === 'retired' && !targetFreezerId)} 
              className="w-full py-2.5 px-4 bg-cyan-600 text-white font-extrabold rounded-lg hover:bg-cyan-700 transition disabled:bg-cool-gray-850 disabled:text-cool-gray-500 disabled:cursor-not-allowed text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Transferring cuts...
                </>
              ) : (
                `Transfer ${selectedCount} Selected Cut${selectedCount !== 1 ? 's' : ''}`
              )}
            </button>
          )}
        </>
      )}
    </form>
  );
};


const MoveModalContent = {
    MoveMeat,
    MoveContainer,
    ChangeContainerFlow
}
export default MoveModalContent;
