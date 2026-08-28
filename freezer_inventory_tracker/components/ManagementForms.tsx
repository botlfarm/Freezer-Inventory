import React, { useState, useMemo, useEffect } from 'react';
import { Action, Container, Product, InventoryState, Freezer, ControlSourceType } from '../types';
import { EditIcon, PlusIcon, XIcon, BoxIcon, BinIcon, PillowcaseIcon, PackageIcon } from './icons';
import { MediaSelector } from './MediaSelector';
import { CONTAINER_ICONS, getContainerIcon } from './ContainerIconsMap';
import { generateUUID } from './uuidHelper';
import { ComboboxInput } from './ComboboxInput';
import { generateDefaultUpcABarcode, validateUpcABarcode } from '../utils/barcode';

interface CommonFormProps {
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
}

// Reusable form for both adding and editing a product
const ProductForm: React.FC<CommonFormProps & { products: Product[], existingProduct?: Product, onProductCreated?: (newProduct: Product) => void, state?: InventoryState }> = 
({ dispatch, onClose, products, existingProduct, onProductCreated, state }) => {
    const [name, setName] = useState(existingProduct?.name || '');
    const [primaryCategory, setPrimaryCategory] = useState(existingProduct?.primaryCategory || '');
    const [subCategory, setSubCategory] = useState(existingProduct?.subCategory || '');
    const [imageUrl, setImageUrl] = useState(existingProduct?.imageUrl || '');
    const [listThresholds, setListThresholds] = useState<Record<string, number>>(() => {
        return existingProduct?.listThresholds || {};
    });
    const [listControlSources, setListControlSources] = useState<Record<string, ControlSourceType>>(() => {
        const initial: Record<string, ControlSourceType> = {};
        if (existingProduct) {
            if (existingProduct.listControlSources) {
                Object.assign(initial, existingProduct.listControlSources);
            }
            state?.customLists?.forEach(cl => {
                const item = cl.items?.find(i => i.productId === existingProduct.id);
                if (item?.controlSource && !initial[cl.id]) {
                    initial[cl.id] = item.controlSource;
                }
            });
        }
        return initial;
    });
    const [listActive, setListActive] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        if (state?.customLists) {
            state.customLists.forEach(cl => {
                const hasItem = cl.items?.some(i => i.productId === existingProduct?.id);
                initial[cl.id] = hasItem || false;
            });
        }
        return initial;
    });
    const [listNotes, setListNotes] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        if (state?.customLists) {
            state.customLists.forEach(cl => {
                const item = cl.items?.find(i => i.productId === existingProduct?.id);
                initial[cl.id] = item?.notes || '';
            });
        }
        return initial;
    });
    const [productNumbersInput, setProductNumbersInput] = useState((existingProduct?.productNumbers || []).join(', '));
    const [barcodeInput, setBarcodeInput] = useState(existingProduct?.barcode || '');
    const [salePriceInput, setSalePriceInput] = useState(
        existingProduct?.salePrice !== undefined && existingProduct?.salePrice !== null 
            ? String(existingProduct.salePrice) 
            : ''
    );
    const [salePriceUnit, setSalePriceUnit] = useState<'lb' | 'package'>(existingProduct?.salePriceUnit || 'lb');
    const [defaultTagIds, setDefaultTagIds] = useState<string[]>(() => {
        return existingProduct?.defaultTagIds || [];
    });
    const [isArchived, setIsArchived] = useState<boolean>(existingProduct?.isArchived || false);

    const primaryCategories = useMemo(() => {
        const fromProducts = products.map(p => p.primaryCategory);
        const fromState = state?.categories?.filter(c => c.type === 'primary').map(c => c.name) || [];
        return [...new Set([...fromProducts, ...fromState])].filter(Boolean);
    }, [products, state?.categories]);

    const allCategoryPairs = useMemo(() => {
        const map = new Map<string, Set<string>>();
        products.forEach(p => {
            if (p.primaryCategory) {
                if (!map.has(p.primaryCategory)) map.set(p.primaryCategory, new Set());
                if (p.subCategory) map.get(p.primaryCategory)!.add(p.subCategory);
            }
        });
        state?.categories?.filter(c => c.type === 'primary').forEach(p => {
            if (!map.has(p.name)) map.set(p.name, new Set());
        });
        state?.categories?.filter(c => c.type === 'sub' && c.parentPrimary).forEach(s => {
            if (map.has(s.parentPrimary!)) map.get(s.parentPrimary!)!.add(s.name);
        });

        const result: { primary: string; sub: string }[] = [];
        Array.from(map.keys()).sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).forEach(primary => {
            const subs = Array.from(map.get(primary)!).sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
            if (subs.length === 0) {
                result.push({ primary, sub: '' });
            } else {
                subs.forEach(sub => result.push({ primary, sub }));
            }
        });
        return result;
    }, [products, state?.categories]);

    const subCategories = useMemo(() => {
        if (!primaryCategory.trim()) {
            const fromProducts = products.map(p => p.subCategory);
            const fromState = state?.categories?.filter(c => c.type === 'sub').map(c => c.name) || [];
            return [...new Set([...fromProducts, ...fromState])].filter(Boolean);
        }
        const filteredProducts = products.filter(p => 
            p.primaryCategory.trim().toLowerCase() === primaryCategory.trim().toLowerCase()
        );
        const filteredState = state?.categories?.filter(c => 
            c.type === 'sub' && c.parentPrimary?.trim().toLowerCase() === primaryCategory.trim().toLowerCase()
        ).map(c => c.name) || [];
        return [...new Set([...filteredProducts.map(p => p.subCategory), ...filteredState])].filter(Boolean);
    }, [products, primaryCategory, state?.categories]);

    const onSiteStock = useMemo(() => {
        if (!state || !existingProduct) return 0;
        return (state.meatCuts || [])
            .filter(mc => mc.productId === existingProduct.id)
            .reduce((sum, mc) => sum + (mc.quantity || 0), 0);
    }, [state, existingProduct]);

    const offSiteStock = useMemo(() => {
        if (!state || !existingProduct) return 0;
        return (state.offSiteEntries || [])
            .filter(e => e.productId === existingProduct.id && !e.archived)
            .reduce((sum, e) => sum + (e.pieces || 1), 0);
    }, [state, existingProduct]);

    const totalStock = onSiteStock + offSiteStock;

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !primaryCategory.trim() || !subCategory.trim()) return;

        const isDuplicate = products.some(p => 
            p.name.trim().toLowerCase() === name.trim().toLowerCase() &&
            p.primaryCategory.trim().toLowerCase() === primaryCategory.trim().toLowerCase() &&
            p.subCategory.trim().toLowerCase() === subCategory.trim().toLowerCase() &&
            p.id !== existingProduct?.id
        );

        if (isDuplicate) {
            alert("A product with the same name and categories already exists.");
            return;
        }

        const parsedProductNumbers = productNumbersInput
            .split(',')
            .map(n => n.trim())
            .filter(n => n !== '');

        const finalBarcode = barcodeInput.trim() || generateDefaultUpcABarcode(parsedProductNumbers[0]) || undefined;
        const parsedSalePrice = salePriceInput.trim() !== '' && !isNaN(Number(salePriceInput.trim()))
            ? Number(salePriceInput.trim())
            : 0;

        if (existingProduct && existingProduct.id) {
             const updates: Partial<Omit<Product, 'id'>> = {};
            if (name.trim() !== existingProduct.name) updates.name = name;
            if (primaryCategory.trim() !== existingProduct.primaryCategory) updates.primaryCategory = primaryCategory;
            if (subCategory.trim() !== existingProduct.subCategory) updates.subCategory = subCategory;
            if (imageUrl !== (existingProduct.imageUrl || '')) updates.imageUrl = imageUrl;
            if (finalBarcode !== (existingProduct.barcode || undefined)) updates.barcode = finalBarcode;
            updates.salePrice = parsedSalePrice;
            updates.salePriceUnit = salePriceUnit;
            
            // Send listThresholds and listControlSources updates
            updates.listThresholds = listThresholds;
            updates.listControlSources = listControlSources;
            updates.listActive = listActive;
            updates.listNotes = listNotes;
            updates.defaultTagIds = defaultTagIds;
            updates.isArchived = totalStock > 0 ? false : isArchived;
            
            const isNumbersChanged = JSON.stringify(existingProduct.productNumbers || []) !== JSON.stringify(parsedProductNumbers);
            if (isNumbersChanged) updates.productNumbers = parsedProductNumbers;

            dispatch({ type: 'EDIT_PRODUCT', payload: { productId: existingProduct.id, updates } });
            onClose();
        } else {
            const newProduct: Product = { 
                id: generateUUID(), 
                name, 
                primaryCategory, 
                subCategory, 
                imageUrl, 
                productNumbers: parsedProductNumbers, 
                barcode: finalBarcode,
                salePrice: parsedSalePrice,
                salePriceUnit,
                listThresholds, 
                listControlSources, 
                defaultTagIds, 
                listActive, 
                listNotes,
                isArchived
            };
            if (onProductCreated) {
                onProductCreated(newProduct);
            } else {
                dispatch({ type: 'ADD_PRODUCT', payload: { product: newProduct } });
                onClose();
            }
        }
    };

    const handleDelete = () => {
        setShowDeleteConfirm(true);
    };

    const parsedNumbers = useMemo(() => {
        return productNumbersInput.split(',').map(n => n.trim()).filter(Boolean);
    }, [productNumbersInput]);

    return (
         <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Product Name" required className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" autoFocus />
            {/* Single Category / Subcategory Dropdown Selector */}
            <div className="space-y-1">
                <label className="block text-xs font-semibold text-cool-gray-400">Category / Subcategory</label>
                <select
                    value={primaryCategory && subCategory ? `${primaryCategory}|${subCategory}` : primaryCategory ? `${primaryCategory}|` : ''}
                    onChange={(e) => {
                        if (!e.target.value) return;
                        const [p, s] = e.target.value.split('|');
                        setPrimaryCategory(p || '');
                        setSubCategory(s || '');
                    }}
                    className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                >
                    <option value="">-- Choose Category / Subcategory --</option>
                    {allCategoryPairs.map(({ primary, sub }) => (
                        <option key={`${primary}|${sub}`} value={`${primary}|${sub}`}>
                            {primary}{sub ? ` / ${sub}` : ''}
                        </option>
                    ))}
                </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="block text-xs font-semibold text-cool-gray-400">Primary Category</label>
                    <ComboboxInput 
                        value={primaryCategory} 
                        onChange={setPrimaryCategory} 
                        options={primaryCategories} 
                        placeholder="Primary Category" 
                        required 
                        className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-cool-gray-500" 
                    />
                </div>
                <div className="space-y-1">
                    <label className="block text-xs font-semibold text-cool-gray-400">Sub Category</label>
                    <ComboboxInput 
                        value={subCategory} 
                        onChange={setSubCategory} 
                        options={subCategories} 
                        placeholder="Sub Category" 
                        required 
                        className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-cool-gray-500 text-sm" 
                    />
                </div>
            </div>
            <div className="space-y-1">
                <label className="text-xs font-semibold text-cool-gray-400">Backend Product Numbers (Optional, can assign multiple, comma separated)</label>
                <input 
                    type="text" 
                    value={productNumbersInput} 
                    onChange={(e) => {
                        const val = e.target.value;
                        setProductNumbersInput(val);
                        // If barcode is currently empty and a product number is typed, suggest default barcode
                        if (!barcodeInput.trim()) {
                            const first = val.split(',').map(n => n.trim()).filter(Boolean)[0];
                            if (first) {
                                const gen = generateDefaultUpcABarcode(first);
                                if (gen) setBarcodeInput(gen);
                            }
                        }
                    }} 
                    placeholder="e.g. 810032, 810033, 810037" 
                    className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-cool-gray-500" 
                />
            </div>
            <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <label className="text-xs font-semibold text-cool-gray-400">UPC-A Barcode (Weight-Embedded 0-lb Base)</label>
                    {parsedNumbers.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-cool-gray-400 font-medium">Auto-fill from:</span>
                            {parsedNumbers.map((num, idx) => {
                                const generatedBc = generateDefaultUpcABarcode(num);
                                const isSelected = Boolean(barcodeInput && barcodeInput === generatedBc);
                                return (
                                    <button
                                        key={`${num}-${idx}`}
                                        type="button"
                                        onClick={() => {
                                            if (generatedBc) setBarcodeInput(generatedBc);
                                        }}
                                        className={`text-[11px] px-2 py-0.5 rounded border transition flex items-center gap-1 cursor-pointer ${
                                            isSelected 
                                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-semibold shadow-xs' 
                                                : 'bg-cool-gray-800 hover:bg-cool-gray-750 text-cyan-400 hover:text-cyan-300 border-cool-gray-650 font-medium'
                                        }`}
                                        title={`Generate default 0-lb UPC-A (${generatedBc || 'N/A'}) from item #${num}`}
                                    >
                                        <span>{isSelected ? '✓' : '⚡'}</span>
                                        <span>#{num}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <input 
                    type="text" 
                    value={barcodeInput} 
                    onChange={(e) => setBarcodeInput(e.target.value)} 
                    placeholder="e.g. 215425000003" 
                    maxLength={12}
                    className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-cool-gray-500 font-mono text-sm tracking-wider" 
                />
                <p className="text-[11px] text-cool-gray-400 flex items-center justify-between">
                    <span>12-digit format: Prefix <strong className="text-cyan-300">2</strong> + 5-digit item # + 5-digit weight (00000) + check digit.</span>
                    {barcodeInput && (
                        <span className={validateUpcABarcode(barcodeInput) ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                            {validateUpcABarcode(barcodeInput) ? "✓ Valid UPC-A" : "▲ Check digit mismatch or invalid length"}
                        </span>
                    )}
                </p>
            </div>
            <div className="space-y-1">
                <label className="text-xs font-semibold text-cool-gray-400">Sales Price & Pricing Unit (Optional, used in valuation reports)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-cool-gray-400 font-bold text-sm">$</span>
                        <input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            value={salePriceInput} 
                            onChange={(e) => setSalePriceInput(e.target.value)} 
                            placeholder="0.00" 
                            className="w-full pl-7 pr-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-cool-gray-500 font-mono text-sm" 
                        />
                    </div>
                    <div>
                        <select
                            value={salePriceUnit}
                            onChange={(e) => setSalePriceUnit(e.target.value as 'lb' | 'package')}
                            className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white font-medium text-sm cursor-pointer"
                        >
                            <option value="lb">Per Pound ($ / lb) [Default]</option>
                            <option value="package">Per Package ($ / pkg)</option>
                        </select>
                    </div>
                </div>
            </div>
            <div className="space-y-1">
                <label className="text-xs font-semibold text-cool-gray-400">Product Image</label>
                <MediaSelector imageUrl={imageUrl} onChange={setImageUrl} placeholder="Image URL (optional)" />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-semibold text-cool-gray-400">Default Tags (automatically pre-selected when intaking this product)</label>
                <div className="flex flex-wrap items-center gap-1.5 mt-1 bg-cool-gray-800/40 p-2.5 rounded-lg border border-cool-gray-700/60">
                    {(state?.tags || []).map(tag => {
                        const isSelected = defaultTagIds.includes(tag.id);
                        return (
                            <button
                                type="button"
                                key={tag.id}
                                onClick={() => {
                                    setDefaultTagIds(prev => 
                                        prev.includes(tag.id)
                                            ? prev.filter(id => id !== tag.id)
                                            : [...prev, tag.id]
                                    );
                                }}
                                style={{ 
                                    borderColor: tag.color || '#3b82f6', 
                                    backgroundColor: isSelected ? (tag.color ? `${tag.color}35` : '#3b82f635') : 'transparent',
                                    color: tag.color || '#3b82f6'
                                }}
                                className={`px-2.5 py-1 rounded text-xs font-bold border transition flex items-center gap-1.5 select-none cursor-pointer hover:brightness-110 ${isSelected ? 'ring-1 ring-white/10 shadow-sm' : 'text-cool-gray-300 border-cool-gray-700/60 hover:bg-cool-gray-800'}`}
                            >
                                <span>{tag.id === 'use-first' ? '⚡' : tag.id === 'not-for-sale' ? '🛑' : '🏷️'}</span>
                                <span>{tag.name}</span>
                            </button>
                        );
                    })}
                    {(state?.tags || []).length === 0 && (
                        <p className="text-[11px] text-cool-gray-500">No tags configured. Go to Catalog &gt; Tags tab to create ones.</p>
                    )}
                </div>
            </div>

            {state?.customLists && state.customLists.length > 0 && (
                <div className="p-3 bg-cool-gray-850/60 rounded-lg border border-cool-gray-850 space-y-3.5">
                    <h3 className="text-xs font-bold text-cool-gray-300 uppercase tracking-widest border-b border-cool-gray-800 pb-1.5">Custom Checklist Memberships</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {state.customLists.map(cl => {
                            const isActive = listActive[cl.id] || false;
                            const notesVal = listNotes[cl.id] || '';
                            const conditionLabel = cl.controlCondition === 'max' ? 'maximum' : 'minimum';
                            const val = listThresholds[cl.id];
                            const currentCS = listControlSources[cl.id] || 'onsite_count';
                            
                            return (
                                <div key={cl.id} className={`p-4 rounded-lg border transition-all duration-200 ${isActive ? 'bg-cool-gray-900/80 border-cyan-800/60 shadow-lg ring-1 ring-cyan-500/10' : 'bg-cool-gray-900/20 border-cool-gray-800/60 opacity-75 hover:opacity-100'}`}>
                                    {/* Top Row: Title, Badge, and Toggle Switch */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cool-gray-800/80 pb-3">
                                        <div className="flex items-start gap-2.5">
                                            <span className="text-xl shrink-0 mt-0.5" role="img" aria-label="list">📋</span>
                                            <div className="space-y-1">
                                                <h4 className="font-bold text-cool-gray-100 text-sm leading-snug">
                                                    {cl.name}
                                                </h4>
                                                {cl.description && (
                                                    <p className="text-xs text-cool-gray-400 font-normal leading-relaxed">
                                                        {cl.description}
                                                    </p>
                                                )}
                                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                    {cl.isInventoryControlled ? (
                                                        <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-800/30">
                                                            Controlled ({conditionLabel})
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-cool-gray-850 text-cool-gray-400 border border-cool-gray-700/30">
                                                            Standard List
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Include Toggle Button */}
                                        <div className="flex items-center gap-2 sm:self-center">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setListActive(prev => ({ ...prev, [cl.id]: !isActive }));
                                                }}
                                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 flex items-center gap-1.5 cursor-pointer select-none border ${
                                                    isActive 
                                                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/30 shadow-sm' 
                                                        : 'bg-cool-gray-800 border-cool-gray-700 text-cool-gray-400 hover:bg-cool-gray-750'
                                                }`}
                                            >
                                                <input 
                                                    type="checkbox"
                                                    checked={isActive}
                                                    readOnly
                                                    className="w-3 h-3 text-cyan-500 rounded border-cool-gray-600 bg-cool-gray-700 focus:ring-cyan-500 pointer-events-none cursor-pointer"
                                                />
                                                <span>{isActive ? 'In List' : 'Add to List'}</span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Expandable settings if active */}
                                    {isActive && (
                                        <div className="mt-3.5 space-y-3.5 pt-1.5 animate-fadeIn">
                                            {cl.isInventoryControlled && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3 bg-cool-gray-950/40 rounded-lg border border-cool-gray-850/50">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[11px] font-bold text-cool-gray-450 uppercase tracking-wider block">
                                                            Control Metric
                                                        </label>
                                                        <select
                                                            value={currentCS}
                                                            onChange={(e) => {
                                                                const selectedVal = e.target.value as ControlSourceType;
                                                                setListControlSources(prev => ({ ...prev, [cl.id]: selectedVal }));
                                                            }}
                                                            className="w-full px-3 py-1.5 bg-cool-gray-800 border border-cool-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white text-xs cursor-pointer"
                                                        >
                                                            <option value="onsite_count">On-Site Qty</option>
                                                            <option value="offsite_count">Off-Site Qty</option>
                                                            <option value="offsite_weight">Off-Site Weight</option>
                                                            <option value="total_count">Total Qty</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[11px] font-bold text-cool-gray-450 uppercase tracking-wider block">
                                                            Threshold Value
                                                        </label>
                                                        <input 
                                                            type="number" 
                                                            step={currentCS === 'offsite_weight' ? '0.1' : '1'}
                                                            value={val ?? ''} 
                                                            onChange={(e) => {
                                                                const isWeight = currentCS === 'offsite_weight';
                                                                const numericVal = e.target.value === '' ? undefined : (isWeight ? parseFloat(e.target.value) : parseInt(e.target.value, 10));
                                                                setListThresholds(prev => {
                                                                    const copy = { ...prev };
                                                                    if (numericVal === undefined || isNaN(numericVal)) {
                                                                        delete copy[cl.id];
                                                                    } else {
                                                                        copy[cl.id] = numericVal;
                                                                    }
                                                                    return copy;
                                                                });
                                                            }} 
                                                            placeholder={currentCS === 'offsite_weight' ? 'e.g. 50.5 lbs' : 'e.g. 5'} 
                                                            min="0"
                                                            className="w-full px-3 py-1.5 bg-cool-gray-800 border border-cool-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white text-xs placeholder-cool-gray-550" 
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Notes directly on card */}
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-cool-gray-450 uppercase tracking-wider block">
                                                    Notes on this List
                                                </label>
                                                <input
                                                    type="text"
                                                    value={notesVal}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setListNotes(prev => ({ ...prev, [cl.id]: val }));
                                                    }}
                                                    placeholder="e.g. Back stock only, keep box labeled, etc."
                                                    className="w-full px-3 py-2 bg-cool-gray-850 border border-cool-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white text-xs placeholder-cool-gray-550"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="pt-3 border-t border-cool-gray-700/60 flex flex-col gap-2 bg-cool-gray-800/40 p-3 rounded-lg border border-cool-gray-700/40">
                <div className="flex items-center justify-between">
                    <div className="pr-4">
                        <label htmlFor="product-archive-checkbox" className={`text-sm font-semibold block ${totalStock > 0 ? 'text-cool-gray-400' : 'text-cool-gray-200 cursor-pointer'}`}>
                            Archive Product
                        </label>
                        <p className="text-xs text-cool-gray-400 mt-0.5">
                            Archived products are hidden from everyday inventory dropdowns and views, but preserved for historical records.
                        </p>
                    </div>
                    <input 
                        id="product-archive-checkbox"
                        type="checkbox" 
                        disabled={totalStock > 0}
                        checked={totalStock > 0 ? false : isArchived} 
                        onChange={(e) => setIsArchived(e.target.checked)} 
                        className={`w-4 h-4 rounded text-cyan-500 border-cool-gray-600 bg-cool-gray-700 focus:ring-cyan-500 flex-shrink-0 ${totalStock > 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    />
                </div>
                {totalStock > 0 && (
                    <div className="text-[11px] font-semibold text-amber-300 bg-amber-950/40 border border-amber-800/50 p-2 rounded-md">
                        ⚠️ Cannot archive: Product has {totalStock} unit(s) in stock ({onSiteStock} on-site, {offSiteStock} off-site). Clear all inventory before archiving.
                    </div>
                )}
            </div>

            {showDeleteConfirm && existingProduct && existingProduct.id ? (
                <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-md text-sm text-red-100 flex flex-col gap-2">
                    <p className="font-semibold text-red-200">Are you sure you want to permanently delete "{existingProduct.name}"?</p>
                    {totalStock > 0 && (
                        <p className="text-xs text-red-350 bg-red-950/60 p-2 rounded">
                            <strong>WARNING:</strong> There are currently {totalStock} items of "{existingProduct.name}" in your inventory. Deleting this will permanently destroy all of these inventory records!
                        </p>
                    )}
                    <div className="flex justify-end gap-2 mt-1">
                        <button type="button" onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 bg-cool-gray-700 hover:bg-cool-gray-600 font-medium rounded text-xs text-white transition">Cancel</button>
                        <button type="button" onClick={() => {
                            dispatch({ type: 'DELETE_PRODUCT', payload: { productId: existingProduct.id } });
                            onClose();
                        }} className="px-3 py-1 bg-red-650 hover:bg-red-650/80 font-medium rounded text-xs text-white transition">Delete Permanently</button>
                    </div>
                </div>
            ) : (
                <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="py-2 px-4 bg-cool-gray-700 hover:bg-cool-gray-600 text-white font-semibold rounded-lg transition">Cancel</button>
                    {existingProduct && existingProduct.id && (
                        <button type="button" onClick={handleDelete} className="py-2 px-4 bg-red-650 hover:bg-red-750 text-white font-semibold rounded-lg transition" title="Delete product permanently from the system">
                            Delete Product
                        </button>
                    )}
                    <button type="submit" className="flex-grow py-2 px-4 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition">
                        {existingProduct && existingProduct.id ? 'Save Changes' : 'Create Product'}
                    </button>
                </div>
            )}
        </form>
    );
};


const EditContainerForm: React.FC<CommonFormProps & { container: Container; state: InventoryState }> = ({ dispatch, onClose, container, state }) => {
    const [name, setName] = useState(container.name);
    const [deleteOnEmpty, setDeleteOnEmpty] = useState(container.deleteOnEmpty || false);
    const [icon, setIcon] = useState(container.icon || 'generic');
    const [imageUrl, setImageUrl] = useState(container.imageUrl || '');
    const [applyGlobally, setApplyGlobally] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const generateContainerName = () => {
        const existingNames = new Set(state.containers.map(c => c.name.toLowerCase().trim()));
        
        const ShortNouns = [
            // 1-10
            'Jim', 'Bob', 'Sam', 'Hal', 'Leo', 'Max', 'Ben', 'Roy', 'Ted', 'Kai',
            // 11-20
            'Sky', 'Val', 'Gus', 'Jed', 'Kip', 'Sid', 'Dan', 'Tim', 'Ron', 'Art',
            // 21-30
            'Mac', 'Guy', 'Asa', 'Ian', 'Dex', 'Ray', 'Joe', 'Ned', 'Ken', 'Don',
            // 31-40
            'Jersey', 'York', 'Paris', 'Rome', 'Austin', 'Denver', 'Vegas', 'Miami', 'Car', 'Star',
            // 41-50
            'Moon', 'Sun', 'Tree', 'River', 'Lake', 'Bird', 'Bear', 'Fox', 'Wolf', 'Hawk',
            // 51-60
            'Eagle', 'Ridge', 'Stone', 'Wood', 'Iron', 'Gold', 'Silver', 'Cloud', 'Storm', 'Rain',
            // 61-70
            'Wind', 'Snow', 'Ice', 'Fire', 'Earth', 'Sea', 'Wave', 'Leaf', 'Root', 'Seed',
            // 71-80
            'Rose', 'Fern', 'Moss', 'Pine', 'Oak', 'Acer', 'Elm', 'Ash', 'Clay', 'Rock',
            // 81-90
            'Sand', 'Dust', 'Hill', 'Peak', 'Vale', 'Glen', 'Cave', 'Pond', 'Cove', 'Surf',
            // 91-100
            'Tide', 'Gale', 'Mist', 'Dew', 'Frost', 'Hail', 'Coal', 'Gem', 'Ruby', 'Opal',
            // 101-110
            'Apple', 'Pear', 'Plum', 'Peach', 'Grape', 'Lime', 'Lemon', 'Melon', 'Berry', 'Fig',
            // 111-120
            'Date', 'Kiwi', 'Mango', 'Olive', 'Cherry', 'Orange', 'Banana', 'Papaya', 'Guava', 'Quince',
            // 121-130
            'Apricot', 'Citrus', 'Lychee', 'Coconut', 'Currant', 'Damson', 'Satsuma', 'Cantaloupe', 'Kumquat', 'Persimmon',
            // 131-140
            'Avocado', 'Soursop', 'Tamarind', 'Mulberry', 'Bilberry', 'Barberry', 'Elderberry', 'Dewberry', 'Cloudberry', 'Lingonberry',
            // 141-150
            'Nectarine', 'Clementine', 'Tangerine', 'Mandarin', 'Grapefruit', 'Cranberry', 'Blackberry', 'Raspberry', 'Strawberry', 'Blueberry',
            // 151-160
            'Carrot', 'Potato', 'Tomato', 'Onion', 'Garlic', 'Radish', 'Celery', 'Squash', 'Pepper', 'Turnip',
            // 161-170
            'Cabbage', 'Lettuce', 'Spinach', 'Broccoli', 'Pea', 'Bean', 'Corn', 'Beet', 'Yam', 'Okra',
            // 171-180
            'Kale', 'Leek', 'Chive', 'Ginger', 'Chili', 'Fennel', 'Endive', 'Shallot', 'Pumpkin', 'Zucchini',
            // 181-190
            'Eggplant', 'Parsnip', 'Rhubarb', 'Asparagus', 'Artichoke', 'Watercress', 'Cauliflower', 'Rutabaga', 'Kohlrabi', 'Tomatillo',
            // 191-200
            'Chard', 'Arugula', 'Bokchoy', 'Cassava', 'Taro', 'Jicama', 'Scallion', 'Turmeric', 'Capers', 'Parsley',
            // 201-210
            'Lion', 'Tiger', 'Deer', 'Elk', 'Moose', 'Hare', 'Otter', 'Badger', 'Beaver', 'Seal',
            // 211-220
            'Whale', 'Shark', 'Trout', 'Salmon', 'Bass', 'Crab', 'Clam', 'Oyster', 'Snail', 'Bee',
            // 221-230
            'Wasp', 'Ant', 'Moth', 'Owl', 'Crow', 'Swan', 'Duck', 'Goose', 'Heron', 'Falcon',
            // 231-240
            'Robin', 'Lark', 'Wren', 'Finch', 'Dove', 'Crane', 'Swift', 'Jay', 'Gull', 'Pike',
            // 241-250
            'Perch', 'Carp', 'Cod', 'Tuna', 'Sole', 'Bream', 'Eel', 'Shrimp', 'Lobster', 'Prawn',
            // 251-260
            'Book', 'Pen', 'Cup', 'Bowl', 'Plate', 'Fork', 'Spoon', 'Knife', 'Pot', 'Pan',
            // 261-270
            'Jar', 'Can', 'Chest', 'Bag', 'Key', 'Lock', 'Bell', 'Clock', 'Lamp', 'Desk',
            // 271-280
            'Chair', 'Table', 'Shelf', 'Door', 'Gate', 'Wall', 'Roof', 'Floor', 'Yard', 'Path',
            // 281-290
            'Road', 'Bridge', 'Boat', 'Ship', 'Sail', 'Mast', 'Net', 'Hook', 'Rope', 'Wire',
            // 291-300
            'Pipe', 'Tube', 'Ring', 'Coin', 'Card', 'Dice', 'Toy', 'Doll', 'Kite', 'Drum'
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

    const containerItemsCount = useMemo(() => {
        return state.meatCuts.filter(mc => mc.containerId === container.id).reduce((sum, mc) => sum + mc.quantity, 0);
    }, [container.id, state.meatCuts]);

    const hasDuplicateInSameFreezer = useMemo(() => {
        if (!name.trim() || !container.freezerId) return false;
        return state.containers.some(c => 
            c.id !== container.id &&
            c.name.trim().toLowerCase() === name.trim().toLowerCase() && 
            c.freezerId === container.freezerId
        );
    }, [name, container.id, container.freezerId, state.containers]);

    const existingContainer = useMemo(() => 
        state.containers.find(c => c.id !== container.id && c.name.trim().toLowerCase() === name.trim().toLowerCase()),
        [name, container.id, state.containers]
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updates: Partial<Omit<Container, 'id' | 'freezerId'>> = {};
        if (name.trim() && name !== container.name) updates.name = name;
        if (deleteOnEmpty !== container.deleteOnEmpty) updates.deleteOnEmpty = deleteOnEmpty;
        if (icon !== (container.icon || 'generic')) updates.icon = icon;
        if (imageUrl !== (container.imageUrl || '')) updates.imageUrl = imageUrl;
        
        if (Object.keys(updates).length > 0) {
            dispatch({ type: 'EDIT_CONTAINER', payload: { containerId: container.id, updates, applyGlobally } } as any);
        }
        onClose();
    };

    const handleDelete = () => {
        setShowDeleteConfirm(true);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
                <label className="text-xs font-semibold text-cool-gray-400">Container Name</label>
                <div className="flex gap-2 items-center">
                    <div className="flex-grow">
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Container Name" required className="w-full px-3 py-2 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm placeholder-cool-gray-500 text-white" autoFocus />
                    </div>
                    <button
                        type="button"
                        onClick={generateContainerName}
                        className="h-[38px] px-3 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-650 rounded-md text-xs font-semibold text-cyan-400 flex items-center gap-1 shrink-0 transition cursor-pointer"
                        title="Suggest a generic name"
                    >
                        🎲 Suggest Name
                    </button>
                </div>
                {hasDuplicateInSameFreezer ? (
                    <p className="text-amber-400 text-xs mt-1 animate-pulse flex items-center gap-1 font-semibold">
                        ⚠️ Warning: This freezer already contains another container named "{name}". Proceeding will create a duplicate.
                    </p>
                ) : existingContainer ? (
                    <p className="text-cyan-400 text-xs mt-1 flex items-center gap-1 font-medium">
                        ℹ️ Notice: Another container with this name exists in another location. (Allowed duplicate)
                    </p>
                ) : null}
            </div>

            <div className="flex items-center">
                <input id="edit-delete-on-empty" type="checkbox" checked={deleteOnEmpty} onChange={e => setDeleteOnEmpty(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-600 cursor-pointer" />
                <label htmlFor="edit-delete-on-empty" className="ml-2 block text-sm text-cool-gray-300 cursor-pointer">Delete when empty (e.g., disposable bags/boxes)</label>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-semibold text-cool-gray-400">Container Image</label>
                <MediaSelector imageUrl={imageUrl} onChange={setImageUrl} placeholder="Image URL (optional)" />
            </div>
            
            <div className="flex items-center">
                <input id="apply-globally" type="checkbox" checked={applyGlobally} onChange={(e) => setApplyGlobally(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-600" />
                <label htmlFor="apply-globally" className="ml-2 block text-sm text-cool-gray-300">Apply changes to all containers named "{container.name}"</label>
            </div>

            {showDeleteConfirm ? (
                <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-md text-sm text-red-100 flex flex-col gap-2">
                    <p className="font-semibold text-red-200">Are you sure you want to permanently delete "{container.name}"?</p>
                    {containerItemsCount > 0 && (
                        <p className="text-xs text-red-350 bg-red-950/60 p-2 rounded">
                            <strong>WARNING:</strong> This container currently contains {containerItemsCount} items. Deleting it will permanently delete all meat cuts inside it!
                        </p>
                    )}
                    <div className="flex justify-end gap-2 mt-1">
                        <button type="button" onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 bg-cool-gray-700 hover:bg-cool-gray-650 font-medium rounded text-xs text-white transition">Cancel</button>
                        <button type="button" onClick={() => {
                            dispatch({ type: 'DELETE_CONTAINER', payload: { containerId: container.id } });
                            onClose();
                        }} className="px-3 py-1 bg-red-650 hover:bg-red-550 font-medium rounded text-xs text-white transition">Delete Permanently</button>
                    </div>
                </div>
            ) : (
                <div className="flex gap-2 pt-2">
                    <button type="button" onClick={handleDelete} className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition" title="Delete container permanently from the system">
                        Delete Container
                    </button>
                    <button type="submit" className="flex-grow py-2 px-4 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition">
                        Save Changes
                    </button>
                </div>
            )}
        </form>
    );
};

const InlineEdit: React.FC<{value: string, onSave: (newValue: string) => void, textClass?: string}> = ({ value, onSave, textClass }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(value);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (text.trim() && text.trim() !== value) {
            onSave(text.trim());
        }
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2 flex-grow">
                <input 
                    ref={inputRef}
                    type="text" 
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    onBlur={handleSave}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') setIsEditing(false);
                    }}
                    className="flex-grow px-2 py-1 bg-cool-gray-900 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
            </div>
        );
    }

    return (
        <div className="flex justify-between items-center w-full group cursor-pointer" onClick={() => setIsEditing(true)}>
            <span className={textClass || "text-cool-gray-200"}>{value}</span>
            <button className="p-1 text-cool-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><EditIcon className="w-4 h-4" /></button>
        </div>
    );
}

export const ManageCategoriesContent: React.FC<{products: Product[], dispatch: React.Dispatch<Action>}> = ({ products, dispatch }) => {
    const [confirmDelete, setConfirmDelete] = useState<{ type: 'primary' | 'sub'; name: string; parentPrimary?: string; count: number } | null>(null);

    const categories = useMemo(() => {
        const cats: Record<string, Set<string>> = {};
        products.forEach(p => {
            if (!cats[p.primaryCategory]) cats[p.primaryCategory] = new Set();
            cats[p.primaryCategory].add(p.subCategory);
        });
        return cats;
    }, [products]);

    const handleRename = (type: 'primary' | 'sub', oldName: string, newName: string) => {
        dispatch({ type: 'RENAME_CATEGORY', payload: { oldName, newName, type } });
    };

    const handleDelete = (type: 'primary' | 'sub', name: string, parentPrimary?: string) => {
        let matchingProductsCount = 0;
        if (type === 'primary') {
            matchingProductsCount = products.filter(p => p.primaryCategory === name).length;
        } else {
            matchingProductsCount = products.filter(p => p.subCategory === name && (!parentPrimary || p.primaryCategory === parentPrimary)).length;
        }

        setConfirmDelete({ type, name, parentPrimary, count: matchingProductsCount });
    };
    
    return (
        <div className="space-y-3">
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="w-full max-w-md p-6 bg-cool-gray-800 border border-cool-gray-700 rounded-lg shadow-xl animate-scale-up">
                        <h4 className="text-lg font-bold text-red-400 mb-2">Confirm Delete</h4>
                        <div className="space-y-3 text-cool-gray-300 text-sm">
                            <p>Are you sure you want to permanently delete the category <span className="font-semibold text-white">"{confirmDelete.name}"</span>?</p>
                            {confirmDelete.count > 0 ? (
                                <p className="p-3 bg-red-950/40 border border-red-900/60 rounded text-red-200 text-xs">
                                    <strong>WARNING:</strong> Deleting this category will permanently delete all <strong className="text-white">{confirmDelete.count}</strong> products inside it, along with all of their inventory records! This cannot be undone.
                                </p>
                            ) : (
                                <p className="text-xs text-cool-gray-400">This category is currently empty. Deleting it will remove it from the system.</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button 
                                onClick={() => setConfirmDelete(null)} 
                                className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-650 text-white text-sm font-semibold rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    dispatch({ type: 'DELETE_CATEGORY', payload: { name: confirmDelete.name, type: confirmDelete.type, parentPrimary: confirmDelete.parentPrimary } });
                                    setConfirmDelete(null);
                                }} 
                                className="px-4 py-2 bg-red-650 hover:bg-red-550 text-white text-sm font-semibold rounded-lg transition"
                            >
                                Yes, Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {Object.keys(categories).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).map(primary => (
                <div key={primary} className="p-2 bg-cool-gray-700/50 rounded-md animate-fade-in">
                    <div className="flex justify-between items-center group">
                        <div className="flex-grow">
                            <InlineEdit value={primary} onSave={(newName) => handleRename('primary', primary, newName)} textClass="font-bold text-cool-gray-200" />
                        </div>
                        <button 
                            onClick={() => handleDelete('primary', primary)} 
                            className="p-1 text-red-400 hover:text-red-350 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete category and all its products"
                        >
                            <BinIcon className="w-4 h-4 text-red-450 hover:scale-105" />
                        </button>
                    </div>
                    <ul className="pl-4 mt-1 space-y-1 border-l border-cool-gray-600/30">
                        {/* FIX: Ensure that all items from categories are strings before rendering, preventing crashes from malformed data. */}
                        {Array.from(categories[primary]).filter(s => typeof s === 'string').sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).map(sub => (
                             <li key={sub} className="flex justify-between items-center text-sm text-cool-gray-300 group">
                                <span className='mr-1.5 opacity-40 font-mono'>-</span>
                                <div className="flex-grow">
                                    <InlineEdit value={sub} onSave={(newName) => handleRename('sub', sub, newName)} textClass="text-cool-gray-300"/>
                                </div>
                                <button 
                                    onClick={() => handleDelete('sub', sub, primary)} 
                                    className="p-1 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete subcategory and all its products"
                                >
                                    <BinIcon className="w-3.5 h-3.5 hover:scale-105" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
};



export const ManageFreezers: React.FC<{state: InventoryState, dispatch: React.Dispatch<Action>, type?: 'freezers' | 'pallets'}> = ({state, dispatch, type = 'freezers'}) => {
    const freezers = type === 'pallets' ? state.freezers.filter(f => f.isPallet) : state.freezers.filter(f => !f.isPallet);
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [newIsSpecial, setNewIsSpecial] = useState(false);
    const [newIsLooseOnly, setNewIsLooseOnly] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string; count: number } | null>(null);

    const handleAdd = () => {
        if (newName.trim()) {
            dispatch({type: 'ADD_FREEZER', payload: {name: newName.trim(), isSpecial: newIsSpecial, isLooseOnly: newIsLooseOnly, isPallet: type === 'pallets'}});
            setNewName("");
            setNewIsSpecial(false);
            setNewIsLooseOnly(false);
            setIsAdding(false);
        }
    }
    const handleDelete = (id: string) => {
        const freezer = freezers.find(f => f.id === id);
        const name = freezer ? freezer.name : 'this freezer';
        const containerCount = state.containers.filter(c => c.freezerId === id).length;
        setConfirmDelete({ id, name, count: containerCount });
    }
    const handleRename = (id: string, name: string) => {
        const freezer = freezers.find(f => f.id === id);
        dispatch({type: 'EDIT_FREEZER', payload: {id, name, isSpecial: freezer?.isSpecial, isLooseOnly: freezer?.isLooseOnly}});
    }
    const handleToggleSpecial = (id: string, isSpecial: boolean) => {
        const freezer = freezers.find(f => f.id === id);
        if (freezer) {
            dispatch({type: 'EDIT_FREEZER', payload: {id, name: freezer.name, isSpecial, isLooseOnly: freezer.isLooseOnly}});
        }
    }
    const handleToggleLooseOnly = (id: string, isLooseOnly: boolean) => {
        const freezer = freezers.find(f => f.id === id);
        if (freezer) {
            dispatch({type: 'EDIT_FREEZER', payload: {id, name: freezer.name, isSpecial: freezer.isSpecial, isLooseOnly}});
        }
    }

    return (
        <div className="space-y-4">
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="w-full max-w-md p-6 bg-cool-gray-800 border border-cool-gray-700 rounded-lg shadow-xl animate-scale-up">
                        <h4 className="text-lg font-bold text-red-400 mb-2">Confirm Delete</h4>
                        <div className="space-y-3 text-cool-gray-300 text-sm">
                            <p>Are you sure you want to permanently delete the {type === 'pallets' ? 'pallet' : 'freezer'} <span className="font-semibold text-white">"{confirmDelete.name}"</span>?</p>
                            {confirmDelete.count > 0 ? (
                                <p className="p-3 bg-red-950/40 border border-red-900/60 rounded text-red-200 text-xs">
                                    <strong>WARNING:</strong> This {type === 'pallets' ? 'pallet' : 'freezer'} currently contains <strong className="text-white">{confirmDelete.count}</strong> containers. Deleting this {type === 'pallets' ? 'pallet' : 'freezer'} will move all of these containers to "Unassigned & Retired". This cannot be undone.
                                </p>
                            ) : (
                                <p className="text-xs text-cool-gray-400">This {type === 'pallets' ? 'pallet' : 'freezer'} is empty.</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button 
                                onClick={() => setConfirmDelete(null)} 
                                className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-650 text-white text-sm font-semibold rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    dispatch({type: 'DELETE_FREEZER', payload: {id: confirmDelete.id}});
                                    setConfirmDelete(null);
                                }} 
                                className="px-4 py-2 bg-red-650 hover:bg-red-550 text-white text-sm font-semibold rounded-lg transition"
                            >
                                Yes, Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ul className="space-y-2">
                {freezers.map(f => (
                    <li key={f.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-cool-gray-750 hover:bg-cool-gray-700 rounded-lg border border-cool-gray-700 transition duration-150 group gap-3">
                        <div className="flex-grow flex items-center gap-2 flex-wrap">
                           <InlineEdit value={f.name} onSave={(updatedName) => handleRename(f.id, updatedName)} textClass="font-semibold text-cool-gray-200"/>
                           <div className="flex gap-1">
                               {f.isSpecial && (
                                   <span className="text-[9px] bg-amber-950/90 text-amber-400 border border-amber-900/60 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-widest shadow-sm">
                                       Showroom Display
                                   </span>
                               )}
                               {f.isLooseOnly && (
                                   <span className="text-[9px] bg-blue-950/90 text-blue-400 border border-blue-900/60 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-widest shadow-sm">
                                       Loose Only
                                   </span>
                               )}
                           </div>
                        </div>
                        <div className="flex items-center gap-4 opacity-85 group-hover:opacity-100 transition-opacity justify-between sm:justify-end">
                             <div className="flex items-center gap-3">
                                 <label className="flex items-center gap-1 text-[11px] text-cool-gray-300 hover:text-white cursor-pointer select-none">
                                     <input 
                                         type="checkbox" 
                                         checked={!!f.isSpecial} 
                                         onChange={(e) => handleToggleSpecial(f.id, e.target.checked)}
                                         className="rounded border-cool-gray-600 bg-cool-gray-800 text-cyan-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                                     />
                                     Display Case
                                 </label>
                                 <label className="flex items-center gap-1 text-[11px] text-cool-gray-300 hover:text-white cursor-pointer select-none">
                                     <input 
                                         type="checkbox" 
                                         checked={!!f.isLooseOnly} 
                                         onChange={(e) => handleToggleLooseOnly(f.id, e.target.checked)}
                                         className="rounded border-cool-gray-600 bg-cool-gray-800 text-cyan-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                                     />
                                     Loose Only
                                 </label>
                             </div>
                             <button onClick={() => handleDelete(f.id)} className="p-1 text-red-405 hover:text-red-300 transition-colors"><XIcon className="w-4 h-4" /></button>
                        </div>
                    </li>
                ))}
            </ul>
            {isAdding ? (
                 <div className="space-y-3 p-4 bg-cool-gray-750/60 rounded-xl border border-cool-gray-700">
                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder={type === 'pallets' ? "New Pallet Name (e.g. Pallet 12)" : "New Freezer Name (e.g. Display Case A)"} className="w-full px-3 py-2 bg-cool-gray-850 border border-cool-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white font-medium placeholder:text-cool-gray-500 text-sm" autoFocus onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                    
                    <div className="space-y-2">
                        <div className="flex items-center">
                            <input 
                                id="new-is-special" 
                                type="checkbox" 
                                checked={newIsSpecial} 
                                onChange={e => setNewIsSpecial(e.target.checked)} 
                                className="h-4 w-4 rounded border-cool-gray-600 bg-cool-gray-850 text-cyan-600 focus:ring-0 cursor-pointer" 
                            />
                            <label htmlFor="new-is-special" className="ml-2 block text-xs text-cool-gray-300 font-medium cursor-pointer select-none">
                                Showroom Display (shows up in the Showroom / Customer-Facing shelves)
                            </label>
                        </div>
                        <div className="flex items-center">
                            <input 
                                id="new-is-loose-only" 
                                type="checkbox" 
                                checked={newIsLooseOnly} 
                                onChange={e => setNewIsLooseOnly(e.target.checked)} 
                                className="h-4 w-4 rounded border-cool-gray-600 bg-cool-gray-850 text-cyan-600 focus:ring-0 cursor-pointer" 
                            />
                            <label htmlFor="new-is-loose-only" className="ml-2 block text-xs text-cool-gray-300 font-medium cursor-pointer select-none">
                                Loose Only (unpacks containers automatically, everything inside is loose stock)
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                         <button onClick={() => { setIsAdding(false); setNewIsSpecial(false); setNewIsLooseOnly(false); }} className="w-full py-2 px-4 bg-cool-gray-700 text-cool-gray-300 font-semibold rounded-lg hover:bg-cool-gray-650 transition text-xs uppercase tracking-wider">Cancel</button>
                        <button onClick={handleAdd} className="w-full py-2 px-4 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition text-xs uppercase tracking-wider">Save</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => { setIsAdding(true); setNewIsSpecial(false); setNewIsLooseOnly(false); }} className="w-full flex justify-center items-center gap-2 py-2 px-4 bg-cyan-900/40 text-cyan-200 hover:text-white border border-cyan-800/40 font-semibold rounded-lg hover:bg-cyan-900/70 transition text-xs uppercase tracking-wider"><PlusIcon /> {type === 'pallets' ? 'Add Pallet' : 'Add Freezer'}</button>
            )}
        </div>
    )
}

export const ManagementForms = {
    ProductForm,
    EditContainerForm,
};