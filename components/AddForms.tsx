import React, { useState, useMemo, useEffect } from 'react';
import { Action, Container, Product, InventoryState, MeatCut } from '../types';
import { ManagementForms } from './ManagementForms';
import { PlusIcon, XIcon, MinusIcon, PackageIcon } from './icons';
import { MediaSelector } from './MediaSelector';
import { getContainerIcon } from './ContainerIconsMap';
import { generateUUID } from './uuidHelper';
import { SearchableProductSelect } from './SearchableProductSelect';
import { SearchableContainerSelect } from './SearchableContainerSelect';
import { ComboboxInput } from './ComboboxInput';

interface CommonFormProps {
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
}

// Removed hardcoded local icons map in favor of shared getContainerIcon

const FreezerForm: React.FC<CommonFormProps> = ({ dispatch, onClose }) => {
  const [name, setName] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      dispatch({ type: 'ADD_FREEZER', payload: { name } });
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Freezer Name (e.g., Garage Chest)"
        className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
        autoFocus
      />
      <button type="submit" className="w-full py-2 px-4 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition">Add Freezer</button>
    </form>
  );
};

interface ContainerFormProps extends CommonFormProps {
  state: InventoryState;
  freezerId?: string;
  onContainerCreated?: (newContainerId: string) => void;
  isNested?: boolean;
}

const ContainerForm: React.FC<ContainerFormProps> = ({ dispatch, onClose, freezerId, state, onContainerCreated, isNested = false }) => {
  const [name, setName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [icon, setIcon] = useState('generic');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFreezerId, setSelectedFreezerId] = useState(freezerId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const finalFreezerId = selectedFreezerId || undefined;

  const handleTemplateSelect = (tplId: string) => {
    setSelectedTemplateId(tplId);
    if (tplId) {
      const template = (state.containerTemplates || []).find(t => t.id === tplId);
      if (template) {
        setName(template.name);
        if (template.icon) setIcon(template.icon);
        if (template.imageUrl) {
          setImageUrl(template.imageUrl);
        }
      }
    }
  };

  const generateContainerName = () => {
    const existingNames = new Set(state.containers.map(c => c.name.toLowerCase().trim()));
    
    const ShortNouns = [
      'Jim', 'Bob', 'Sam', 'Hal', 'Leo', 'Max', 'Ben', 'Roy', 'Ted', 'Kai',
      'Sky', 'Val', 'Gus', 'Jed', 'Kip', 'Sid', 'Dan', 'Tim', 'Ron', 'Art',
      'Mac', 'Guy', 'Asa', 'Ian', 'Dex', 'Ray', 'Joe', 'Ned', 'Ken', 'Don',
      'Jersey', 'York', 'Paris', 'Rome', 'Austin', 'Denver', 'Vegas', 'Miami', 'Car', 'Star',
      'Moon', 'Sun', 'Tree', 'River', 'Lake', 'Bird', 'Bear', 'Fox', 'Wolf', 'Hawk',
      'Eagle', 'Ridge', 'Stone', 'Wood', 'Iron', 'Gold', 'Silver', 'Cloud', 'Storm', 'Rain',
      'Wind', 'Snow', 'Ice', 'Fire', 'Earth', 'Sea', 'Wave', 'Leaf', 'Root', 'Seed'
    ];
    
    let shuffled = [...ShortNouns].sort(() => Math.random() - 0.5);
    let chosenName = '';
    for (const noun of shuffled) {
      const candidate = `Box ${noun}`;
      if (!existingNames.has(candidate.toLowerCase().trim())) {
        chosenName = candidate;
        break;
      }
    }

    if (!chosenName) {
      let suffix = 1;
      do {
        chosenName = `Box #${suffix}`;
        suffix++;
      } while (existingNames.has(chosenName.toLowerCase().trim()));
    }

    setName(chosenName);
  };

  useEffect(() => {
    if (!name.trim()) {
      generateContainerName();
    }
  }, []);

  const existingContainerNames = useMemo(() => {
    const names = state.containers.map(c => c.name.trim());
    return ([...new Set(names)] as string[]).sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [state.containers]);

  const existingContainer = useMemo(() => 
    state.containers.find(c => c.name.trim().toLowerCase() === name.trim().toLowerCase()),
    [name, state.containers]
  );

  // Live container search matching across placed, spare, and template containers
  const liveContainerMatches = useMemo(() => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return [];
    const searchWords = trimmed.split(/\s+/).filter(Boolean);

    const allContainers = state.containers || [];
    return allContainers
      .filter(c => {
        const nameLower = (c.name || '').toLowerCase();
        const freezer = c.freezerId ? state.freezers?.find(f => f.id === c.freezerId) : null;
        const freezerLower = (freezer?.name || '').toLowerCase();
        return searchWords.every(word => nameLower.includes(word) || freezerLower.includes(word));
      })
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aExact = aName === trimmed;
        const bExact = bName === trimmed;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Prioritize unassigned/spare containers so user sees they can reuse them
        if (!a.freezerId && b.freezerId) return -1;
        if (a.freezerId && !b.freezerId) return 1;

        return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
      })
      .slice(0, 5);
  }, [name, state.containers, state.freezers]);

  const duplicateInCurrentFreezer = useMemo(() => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed || !finalFreezerId) return null;
    return state.containers.find(c => c.freezerId === finalFreezerId && c.name.trim().toLowerCase() === trimmed);
  }, [name, finalFreezerId, state.containers]);

  const handlePlaceExistingSpare = async (spareContainerId: string) => {
    setIsSubmitting(true);
    try {
      if (finalFreezerId) {
        await dispatch({
          type: 'MOVE_CONTAINER',
          payload: { containerId: spareContainerId, newFreezerId: finalFreezerId }
        } as any);
      }
      if (onContainerCreated) {
        onContainerCreated(spareContainerId);
      } else {
        onClose();
      }
    } catch (err) {
      console.error("Failed to place existing spare container:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (name.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        let createdTplId = selectedTemplateId || undefined;
        if (saveAsTemplate && !createdTplId) {
          const tplId = generateUUID();
          await dispatch({
            type: 'ADD_CONTAINER_TEMPLATE',
            payload: { id: tplId, name: name.trim(), icon, imageUrl }
          } as any);
          createdTplId = tplId;
        }

        const newContainerId = generateUUID();
        const payload = { 
          id: newContainerId, 
          name: name.trim(), 
          icon, 
          freezerId: finalFreezerId, 
          templateId: createdTplId,
          imageUrl 
        };
        
        const success = await dispatch({ type: 'ADD_CONTAINER', payload } as any);
        
        if (success) {
          if (onContainerCreated) {
            onContainerCreated(newContainerId);
          } else {
            onClose();
          }
        }
      } catch (err) {
        console.error("Failed to add container:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const content = (
    <>
      {state.containerTemplates && state.containerTemplates.length > 0 && (
        <div className="space-y-1">
          <label className="block text-xs font-bold text-cool-gray-400 uppercase tracking-wider">Use Container Template:</label>
          <select 
            value={selectedTemplateId} 
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-white"
          >
            <option value="">(Custom / One-Off Container)</option>
            {state.containerTemplates.map(t => (
              <option key={t.id} value={t.id}>📋 Template: {t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs font-bold text-cool-gray-400 uppercase tracking-wider">Freezer Location:</label>
        <select 
          value={selectedFreezerId} 
          onChange={(e) => setSelectedFreezerId(e.target.value)}
          className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-white"
        >
          <option value="">(No Freezer - Unassigned)</option>
          {state.freezers.filter(f => !f.isPallet && !f.id.startsWith('pallet-') && !f.isArchived).map(f => <option key={f.id} value={f.id}>{f.name}{f.isSpecial ? " ★" : ""}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <label className="block text-xs font-bold text-cool-gray-400 uppercase tracking-wider">Container Name:</label>
          {liveContainerMatches.length > 0 && (
            <span className="text-[10px] text-cyan-400 font-bold">
              🔍 {liveContainerMatches.length} matching {liveContainerMatches.length === 1 ? 'container' : 'containers'}
            </span>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex-grow">
            <ComboboxInput
              value={name}
              onChange={setName}
              options={existingContainerNames}
              placeholder="Container Name (e.g., Red Stripe)"
              required
              className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm placeholder-cool-gray-500 text-white"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={() => generateContainerName()}
            className="h-[38px] px-3 py-2 bg-cool-gray-850 hover:bg-cool-gray-750 border border-cool-gray-650 rounded-md text-xs font-semibold text-cyan-400 flex items-center gap-1 shrink-0 transition cursor-pointer"
            title="Suggest a generic name"
          >
            🎲 Suggest Name
          </button>
        </div>

        {/* Duplicate Warning in Same Freezer */}
        {duplicateInCurrentFreezer && (
          <div className="p-2.5 rounded bg-amber-950/70 border border-amber-500/60 text-amber-200 text-xs mt-1 animate-fadeIn">
            ⚠️ <strong>Duplicate warning:</strong> A container named "{duplicateInCurrentFreezer.name}" is already placed in this freezer.
          </div>
        )}

        {/* Live Matching Containers in Inventory */}
        {liveContainerMatches.length > 0 && (
          <div className="mt-1.5 p-2.5 bg-cool-gray-850 border border-cool-gray-700 rounded-lg text-xs space-y-1.5 animate-fadeIn shadow-lg">
            <div className="flex items-center justify-between pb-1 border-b border-cool-gray-750">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-cool-gray-400 flex items-center gap-1">
                <span>📦 Existing Containers Matching "{name}":</span>
              </span>
            </div>
            <div className="divide-y divide-cool-gray-750 max-h-40 overflow-y-auto space-y-1 pr-0.5">
              {liveContainerMatches.map(mc => {
                const freezer = mc.freezerId ? state.freezers?.find(f => f.id === mc.freezerId) : null;
                const cutsCount = (state.meatCuts || []).filter(cut => cut.containerId === mc.id).reduce((s, cut) => s + cut.quantity, 0);
                const isSpare = !mc.freezerId;

                return (
                  <div key={mc.id} className="pt-1.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-1 rounded hover:bg-cool-gray-800 transition">
                    <div className="flex items-center gap-2 min-w-0">
                      {mc.imageUrl ? (
                        <img src={mc.imageUrl} alt={mc.name} className="w-6 h-6 rounded object-cover border border-cool-gray-700 shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-cool-gray-800 border border-cool-gray-700 flex items-center justify-center shrink-0 text-xs">
                          📦
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-white truncate">{mc.name}</p>
                        <p className="text-[10px] text-cool-gray-400 flex items-center gap-1">
                          {freezer ? (
                            <span className="text-cyan-300">❄️ {freezer.name}</span>
                          ) : (
                            <span className="text-amber-300 font-semibold">📦 Spare Pool (Unassigned)</span>
                          )}
                          <span>• {cutsCount} {cutsCount === 1 ? 'item' : 'items'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                      {isSpare && (
                        <button
                          type="button"
                          onClick={() => handlePlaceExistingSpare(mc.id)}
                          className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10.5px] rounded transition cursor-pointer shadow-xs"
                          title="Move and place this existing spare container here"
                        >
                          📍 Place This Spare Here
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!selectedTemplateId && (
        <div className="flex items-center pt-1">
          <input 
            id="save-as-template" 
            type="checkbox" 
            checked={saveAsTemplate} 
            onChange={e => setSaveAsTemplate(e.target.checked)} 
            className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-600" 
          />
          <label htmlFor="save-as-template" className="ml-2 block text-xs font-medium text-cyan-300">
            Save as reusable Container Template in Catalog
          </label>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-semibold text-cool-gray-400">Container Image</label>
        <MediaSelector imageUrl={imageUrl} onChange={setImageUrl} placeholder="Image URL (optional)" />
      </div>
      <div className="flex gap-2">
        {onContainerCreated && (
            <button type="button" onClick={onClose} className="w-full py-2 px-4 bg-cool-gray-600 text-white font-semibold rounded-lg hover:bg-cool-gray-500 transition">Cancel</button>
        )}
        <button 
          type={isNested ? 'button' : 'submit'} 
          onClick={isNested ? () => handleSubmit() : undefined}
          disabled={!name.trim() || isSubmitting} 
          className="w-full py-2 px-4 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition disabled:bg-cool-gray-600 disabled:cursor-not-allowed"
        >
            {isSubmitting ? 'Creating...' : onContainerCreated ? 'Create & Select' : 'Add Container'}
        </button>
      </div>
    </>
  );

  if (isNested) {
    return (
      <div className="space-y-4 p-2 my-2 border border-cool-gray-700 rounded-md">
        {content}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-2 my-2 border border-cool-gray-700 rounded-md">
      {content}
    </form>
  );
};

interface MeatFormProps extends CommonFormProps {
    containerId: string;
    products: Product[];
    initialProductId?: string;
    state?: InventoryState;
}

const MeatForm: React.FC<MeatFormProps> = ({ dispatch, onClose, containerId, products, initialProductId, state }) => {
  const [productId, setProductId] = useState(initialProductId || '');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);
  
  const handleProductCreated = (newProduct: Product) => {
      dispatch({ type: 'ADD_PRODUCT', payload: { product: newProduct } });
      setProductId(newProduct.id);
      setShowProductForm(false);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productId && quantity > 0) {
      dispatch({ type: 'ADD_MEAT_CUT', payload: { productId, quantity, containerId, notes } });
      onClose();
    }
  };

  if (showProductForm) {
      return (
          <div>
              <h3 className="text-lg font-semibold mb-2 text-cool-gray-200">Create New Product</h3>
              <ManagementForms.ProductForm 
                dispatch={dispatch} 
                onClose={() => setShowProductForm(false)} 
                products={products}
                onProductCreated={handleProductCreated}
                state={state}
              />
          </div>
      );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
            <label className="text-sm font-medium text-cool-gray-300">Product</label>
            <div className="flex gap-2">
                <SearchableProductSelect
                    products={products}
                    value={productId}
                    onChange={setProductId}
                    autoFocus
                />
                <button type="button" onClick={() => setShowProductForm(true)} className="px-3 py-2 bg-cool-gray-600 text-white font-semibold rounded-lg hover:bg-cool-gray-500 transition shrink-0" title="Create New Product font-bold flex items-center justify-center">
                    <PlusIcon />
                </button>
            </div>
        </div>

      <input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10)))}
        min="1"
        className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
      <button type="submit" disabled={!productId} className="w-full py-2 px-4 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition disabled:bg-cool-gray-600">Add Meat</button>
    </form>
  );
};

interface BulkMeatFormProps extends CommonFormProps {
    state: InventoryState;
}

type ExistingItem = { meatCut: MeatCut; product: Product; currentQuantity: number };

const BulkMeatForm: React.FC<BulkMeatFormProps> = ({ dispatch, onClose, state }) => {
    const [containerId, setContainerId] = useState('');
    const [targetFreezerId, setTargetFreezerId] = useState('');
    const [newItems, setNewItems] = useState<Array<{ id: string, productId: string, quantity: number, notes: string }>>([]);
    const [existingItems, setExistingItems] = useState<ExistingItem[]>([]);
    const [showAddContainer, setShowAddContainer] = useState(false);
    const [isDuplicating, setIsDuplicating] = useState(false);
    
    const selectedContainer = useMemo(() => state.containers.find(c => c.id === containerId), [containerId, state.containers]);
    const isUnassignedContainer = selectedContainer && !selectedContainer.freezerId;
    const IconForSelected = selectedContainer ? getContainerIcon(selectedContainer.icon || 'generic') : null;

    const hasUnassignedDuplicateInTarget = useMemo(() => {
        if (!isUnassignedContainer || !targetFreezerId || !selectedContainer) return false;
        return state.containers.some(c => 
            c.id !== selectedContainer.id &&
            c.freezerId === targetFreezerId &&
            c.name.trim().toLowerCase() === selectedContainer.name.trim().toLowerCase()
        );
    }, [isUnassignedContainer, targetFreezerId, selectedContainer, state.containers]);

    const handleDuplicateBag = async () => {
        if (!selectedContainer) return;
        setIsDuplicating(true);
        try {
            // Find if there is an existing unassigned container with the SAME name
            const existingUnassigned = state.containers.find(
                c => c.name.trim().toLowerCase() === selectedContainer.name.trim().toLowerCase() && !c.freezerId
            );
            if (existingUnassigned) {
                // Grab/Reuse the existing unassigned container! Move it to this freezer
                const success = await dispatch({ 
                    type: 'MOVE_CONTAINER', 
                    payload: { containerId: existingUnassigned.id, newFreezerId: selectedContainer.freezerId } 
                } as any);
                if (success) {
                    setContainerId(existingUnassigned.id);
                }
            } else {
                // Otherwise, create a new one
                const newContainerId = generateUUID();
                const payload = {
                    id: newContainerId,
                    name: selectedContainer.name,
                    icon: selectedContainer.icon || 'generic',
                    deleteOnEmpty: true,
                    freezerId: selectedContainer.freezerId,
                    imageUrl: selectedContainer.imageUrl
                };
                const success = await dispatch({ type: 'ADD_CONTAINER', payload } as any);
                if (success) {
                    setContainerId(newContainerId);
                }
            }
        } catch (err) {
            console.error('Failed to duplicate bag:', err);
        } finally {
            setIsDuplicating(false);
        }
    };

    useEffect(() => {
        if(containerId) {
            const cutsInContainer = state.meatCuts.filter(mc => mc.containerId === containerId);
            const items = cutsInContainer.map(meatCut => {
                const product = state.products.find(p => p.id === meatCut.productId);
                return product ? { meatCut, product, currentQuantity: meatCut.quantity } : null;
            }).filter((item): item is ExistingItem => item !== null);
            setExistingItems(items);
            setNewItems([]);
        } else {
            setExistingItems([]);
        }
    }, [containerId, state.meatCuts, state.products]);

    const handleNewItemChange = (id: string, field: 'productId' | 'quantity' | 'notes', value: string | number) => {
        setNewItems(currentItems => currentItems.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleExistingItemQuantityChange = (meatCutId: string, amount: number) => {
        setExistingItems(current => current.map(item => 
            item.meatCut.id === meatCutId 
                ? { ...item, currentQuantity: Math.max(0, item.currentQuantity + amount) }
                : item
        ));
    };

    const addNewItem = () => {
        setNewItems([...newItems, { id: generateUUID(), productId: '', quantity: 1, notes: '' }]);
    };

    const removeNewItem = (id: string) => {
        setNewItems(newItems.filter(item => item.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (isUnassignedContainer && !targetFreezerId) {
            alert("Please select a freezer for this unassigned container.");
            return;
        }

        if (isUnassignedContainer && targetFreezerId) {
            dispatch({ type: 'MOVE_CONTAINER', payload: { containerId, newFreezerId: targetFreezerId }});
        }
        
        existingItems.forEach(item => {
            if (item.currentQuantity !== item.meatCut.quantity) {
                dispatch({ type: 'UPDATE_MEAT_QUANTITY', payload: { meatCutId: item.meatCut.id, newQuantity: item.currentQuantity } });
            }
        });

        const validNewItems = newItems.filter(i => i.productId && i.quantity > 0).map(({productId, quantity, notes}) => ({productId, quantity, notes}));
        if (containerId && validNewItems.length > 0) {
            dispatch({ type: 'BULK_ADD_MEAT_CUTS', payload: { containerId, items: validNewItems } });
        }
        onClose();
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-cool-gray-300 mb-1">Select Container</label>
                <div className="flex gap-1.5">
                    <div className="flex-grow min-w-0">
                        <SearchableContainerSelect
                            containers={state.containers}
                            value={containerId}
                            onChange={(val) => setContainerId(val)}
                            placeholder="Type container/bag name to filter..."
                            freezers={state.freezers}
                        />
                    </div>
                    {selectedContainer && (
                        <button 
                            type="button" 
                            onClick={handleDuplicateBag}
                            disabled={isDuplicating}
                            className="flex-shrink-0 px-2.5 py-2 font-semibold text-xs rounded-lg transition bg-amber-600 hover:bg-amber-700 disabled:bg-cool-gray-700 text-amber-100 disabled:text-cool-gray-400 shadow-md flex items-center justify-center gap-1 border border-amber-500/35"
                            title="Quick duplicate bag (clones selected setup with 1-click)"
                        >
                            {isDuplicating ? 'Duping...' : 'Duplicate bag'}
                        </button>
                    )}
                    <button 
                        type="button" 
                        onClick={() => setShowAddContainer(!showAddContainer)} 
                        className={`flex-shrink-0 px-2.5 py-2 font-semibold text-xs rounded-lg transition ${showAddContainer ? 'bg-indigo-650 hover:bg-indigo-700' : 'bg-cyan-600 hover:bg-cyan-700'} text-white shadow-md flex items-center justify-center`}
                        title="Add New Container inline"
                    >
                        {showAddContainer ? 'Cancel' : '+ Inline'}
                    </button>
                </div>
                {showAddContainer ? (
                    <div className="mt-2 bg-cool-gray-850 p-2 rounded border border-cool-gray-700">
                        <p className="text-xs text-cyan-300 font-semibold mb-1">Inline Create New / Duplicate Container:</p>
                        <ContainerForm 
                            dispatch={dispatch} 
                            state={state} 
                            isNested={true}
                            onClose={() => setShowAddContainer(false)} 
                            onContainerCreated={(newId) => {
                                setContainerId(newId);
                                setShowAddContainer(false);
                            }}
                        />
                    </div>
                ) : (
                    <p className="text-xs text-cool-gray-400 mt-1">Select a container or click "+ Inline Container" to make an identical or new container on-the-fly.</p>
                )}
            </div>
            
            {selectedContainer && (
                <div className="p-2 bg-cool-gray-700/50 rounded-md flex items-center gap-3">
                    {selectedContainer.imageUrl ? (
                        <img src={selectedContainer.imageUrl} alt={selectedContainer.name} className="w-10 h-10 rounded object-cover" />
                    ) : (
                        IconForSelected && <div className="w-10 h-10 rounded bg-cool-gray-800 flex items-center justify-center flex-shrink-0"><IconForSelected className="w-6 h-6 text-cyan-300" /></div>
                    )}
                    <div>
                        <p className="font-semibold text-cool-gray-200">{selectedContainer.name}</p>
                    </div>
                </div>
            )}

            {isUnassignedContainer && (
                 <div>
                    <label htmlFor="freezer-select" className="block text-sm font-medium text-cool-gray-300 mb-1">Place in Freezer</label>
                    <select id="freezer-select" value={targetFreezerId} onChange={e => setTargetFreezerId(e.target.value)} className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                        <option value="" disabled>Select destination freezer...</option>
                        {state.freezers.filter(f => !f.isPallet && !f.id.startsWith('pallet-') && !f.isArchived).map(f => <option key={f.id} value={f.id}>{f.name}{f.isSpecial ? " ★" : ""}</option>)}
                    </select>
                    {hasUnassignedDuplicateInTarget && (
                        <p className="text-yellow-405 text-xs mt-1.5 leading-normal">
                            ⚠️ Warning: The selected freezer already contains a container named "{selectedContainer?.name}". You may proceed, but duplicates will exist in this freezer.
                        </p>
                    )}
                </div>
            )}

            {containerId && (
                <div className="space-y-4">
                    {existingItems.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-cool-gray-200 mb-2 border-b border-cool-gray-600 pb-1">Existing Contents</h3>
                            <div className="space-y-2 pr-0">
                                {existingItems.map(item => (
                                    <div key={item.meatCut.id} className="flex items-center justify-between bg-cool-gray-700/50 p-2 rounded-md">
                                        <span className="text-cool-gray-200 text-sm truncate animate-fade-in" title={item.product.name}>{item.product.name}</span>
                                        <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => handleExistingItemQuantityChange(item.meatCut.id, -1)} className="p-1 rounded-full bg-cool-gray-600 hover:bg-red-500 focus:bg-red-500 hover:text-white focus:text-white transition cursor-pointer outline-none"><MinusIcon className="w-4 h-4"/></button>
                                            <span className="font-mono w-8 text-center text-md">{item.currentQuantity}</span>
                                            <button type="button" onClick={() => handleExistingItemQuantityChange(item.meatCut.id, 1)} className="p-1 rounded-full bg-cool-gray-600 hover:bg-green-500 focus:bg-green-500 hover:text-white focus:text-white transition cursor-pointer outline-none"><PlusIcon className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <h3 className="font-semibold text-cool-gray-200 mb-2 border-b border-cool-gray-600 pb-1">Add New Items</h3>
                        <div className="space-y-3 pr-0">
                            {newItems.map((item) => (
                                <div key={item.id} className="p-3 bg-cool-gray-700/50 rounded-md space-y-2 relative animate-fade-in">
                                    {newItems.length > 0 && (
                                        <button type="button" onClick={() => removeNewItem(item.id)} className="absolute top-2 right-2 text-cool-gray-400 hover:text-red-400"><XIcon className="w-4 h-4" /></button>
                                    )}
                                    <SearchableProductSelect
                                        products={state.products}
                                        value={item.productId}
                                        onChange={(val) => handleNewItemChange(item.id, 'productId', val)}
                                        placeholder="Search product..."
                                    />
                                    <div className="grid grid-cols-3 gap-2">
                                        <input type="number" value={item.quantity ?? ''} onChange={(e) => handleNewItemChange(item.id, 'quantity', parseInt(e.target.value, 10) || 0)} min="1" placeholder="Qty" className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                        <input type="text" value={item.notes || ''} onChange={(e) => handleNewItemChange(item.id, 'notes', e.target.value)} placeholder="Notes (optional)" className="w-full col-span-2 px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addNewItem} className="w-full flex justify-center items-center gap-2 mt-2 py-1.5 text-sm text-cyan-300 bg-cyan-900/30 rounded-md hover:bg-cyan-900/60 transition">
                            <PlusIcon className="w-4 h-4" /> Add Another Item
                        </button>
                    </div>

                    <button type="submit" className="w-full py-2 px-4 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition">
                        Save Changes to Container
                    </button>
                </div>
            )}
        </form>
    );
};


const AddForms = {
    FreezerForm,
    ContainerForm,
    MeatForm,
    BulkMeatForm,
};

export default AddForms;