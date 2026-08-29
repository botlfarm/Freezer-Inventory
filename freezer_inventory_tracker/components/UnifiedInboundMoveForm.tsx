import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Table } from 'lucide-react';
import { Action, InventoryState, Container, Product, MeatCut, Freezer } from '../types';
import { getContainerIcon } from './ContainerIconsMap';
import { SearchableProductSelect } from './SearchableProductSelect';
import { SearchableContainerSelect } from './SearchableContainerSelect';
import { PlusIcon, MinusIcon, SearchIcon, XIcon, PackageIcon } from './icons';
import { ManagementForms } from './ManagementForms';
import { generateUUID } from './uuidHelper';
import { MediaSelector } from './MediaSelector';

interface UnifiedInboundMoveFormProps {
  dispatch: React.Dispatch<Action>;
  state: InventoryState;
  onClose: () => void;
  // If moving, provide the sourceMeatCutId
  sourceMeatCutId?: string;
  // Pre-selected target container if accessed from a container's page or context
  initialContainerId?: string;
  // Pre-selected product ID for initial inbound item
  initialProductId?: string;
}

type DestinationType = 'existing' | 'retired' | 'new';

export const UnifiedInboundMoveForm: React.FC<UnifiedInboundMoveFormProps> = ({
  dispatch,
  state,
  onClose,
  sourceMeatCutId,
  initialContainerId = '',
  initialProductId
}) => {
  // Mode detection
  const isMoveMode = !!sourceMeatCutId;

  // --- Source Item Info (MOVING ONLY) ---
  const sourceMeatCut = useMemo(() => {
    if (!sourceMeatCutId) return null;
    return state.meatCuts.find(m => m.id === sourceMeatCutId) || null;
  }, [sourceMeatCutId, state.meatCuts]);

  const sourceProduct = useMemo(() => {
    if (!sourceMeatCut) return null;
    return state.products.find(p => p.id === sourceMeatCut.productId) || null;
  }, [sourceMeatCut, state.products]);

  const sourceContainer = useMemo(() => {
    if (!sourceMeatCut) return null;
    return state.containers.find(c => c.id === sourceMeatCut.containerId) || null;
  }, [sourceMeatCut, state.containers]);

  // --- State for Move Mode ---
  const [moveQuantityStr, setMoveQuantityStr] = useState(() => {
    return sourceMeatCutId ? (state.meatCuts.find(m => m.id === sourceMeatCutId)?.quantity.toString() || '1') : '1';
  });
  const lastSourceIdRef = React.useRef(sourceMeatCutId);

  useEffect(() => {
    if (lastSourceIdRef.current !== sourceMeatCutId) {
      lastSourceIdRef.current = sourceMeatCutId;
      const cut = state.meatCuts.find(m => m.id === sourceMeatCutId);
      if (cut) {
        setMoveQuantityStr(cut.quantity.toString());
      }
    }
  }, [sourceMeatCutId, state.meatCuts]);

  // Helper to parse math in quantity input
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

  const evalQty = useMemo(() => {
    if (!sourceMeatCut) return 1;
    return evaluateMathExpression(moveQuantityStr, 1, sourceMeatCut.quantity) ?? 1;
  }, [moveQuantityStr, sourceMeatCut]);

  const handleModifyQuantity = (delta: number) => {
    if (!sourceMeatCut) return;
    const newVal = Math.min(sourceMeatCut.quantity, Math.max(1, evalQty + delta));
    setMoveQuantityStr(newVal.toString());
  };

  // --- State for Inbound Mode (adding multiple items) ---
  const [inboundItems, setInboundItems] = useState<Array<{ id: string; productId: string; quantity: number | string; notes: string; workingFrom: boolean; notForSale: boolean; tagIds?: string[] }>>(() => {
    const prod = state.products.find(p => p.id === initialProductId);
    return [
      { 
        id: generateUUID(), 
        productId: initialProductId || '', 
        quantity: 1, 
        notes: '', 
        workingFrom: prod?.defaultTagIds?.includes('use-first') || false, 
        notForSale: prod?.defaultTagIds?.includes('not-for-sale') || false,
        tagIds: prod?.defaultTagIds || []
      }
    ];
  });
  const [showProductForm, setShowProductForm] = useState(false);

  const handleProductCreated = (newProduct: Product) => {
    dispatch({ type: 'ADD_PRODUCT', payload: { product: newProduct } });
    // Assign created product to any empty row
    setInboundItems(prev => {
      const copy = [...prev];
      const emptyIndex = copy.findIndex(item => !item.productId);
      const defaultTagIds = newProduct.defaultTagIds || [];
      if (emptyIndex !== -1) {
        copy[emptyIndex].productId = newProduct.id;
        copy[emptyIndex].tagIds = defaultTagIds;
        copy[emptyIndex].workingFrom = defaultTagIds.includes('use-first');
        copy[emptyIndex].notForSale = defaultTagIds.includes('not-for-sale');
      } else {
        copy.push({ 
          id: generateUUID(), 
          productId: newProduct.id, 
          quantity: 1, 
          notes: '', 
          workingFrom: defaultTagIds.includes('use-first'), 
          notForSale: defaultTagIds.includes('not-for-sale'),
          tagIds: defaultTagIds
        });
      }
      return copy;
    });
    setShowProductForm(false);
  };

  const handleInboundItemChange = (itemId: string, field: 'productId' | 'quantity' | 'notes' | 'workingFrom' | 'notForSale' | 'tagIds', value: any) => {
    setInboundItems(current => current.map(item => {
      if (item.id === itemId) {
        if (field === 'productId') {
          const prod = state.products.find(p => p.id === value);
          const defaultTagIds = prod?.defaultTagIds || [];
          return {
            ...item,
            productId: value,
            tagIds: defaultTagIds,
            workingFrom: defaultTagIds.includes('use-first'),
            notForSale: defaultTagIds.includes('not-for-sale')
          };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const addInboundRow = () => {
    setInboundItems(prev => [...prev, { id: generateUUID(), productId: '', quantity: 1, notes: '', workingFrom: false, notForSale: false, tagIds: [] }]);
  };

  const removeInboundRow = (itemId: string) => {
    setInboundItems(prev => prev.filter(item => item.id !== itemId));
  };

  // --- Shared Destination Selection State ---
  // DEFAULT DESTINATION IS STAGING ('staging_loose')
  const [destTab, setDestTab] = useState<DestinationType>('existing');
  const [selectedContainerId, setSelectedContainerId] = useState<string>(() => {
    if (initialContainerId) return initialContainerId;
    return 'staging_loose';
  });

  const [selectedFreezerId, setSelectedFreezerId] = useState<string>('');

  const [unretireFreezerId, setUnretireFreezerId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // --- Form fields for creating a NEW container on the fly ---
  const [newContainerName, setNewContainerName] = useState('');
  const [newContainerIcon, setNewContainerIcon] = useState('generic');
  const [newContainerDeleteOnEmpty, setNewContainerDeleteOnEmpty] = useState(true);
  const [newContainerFreezerId, setNewContainerFreezerId] = useState('');
  const [newContainerImageUrl, setNewContainerImageUrl] = useState('');

  const hasNewDuplicateInSameFreezer = useMemo(() => {
    const freezerIdToCheck = selectedFreezerId || newContainerFreezerId;
    if (destTab !== 'new' || !newContainerName.trim() || !freezerIdToCheck) return false;
    return state.containers.some(c => 
      c.name.trim().toLowerCase() === newContainerName.trim().toLowerCase() && 
      c.freezerId === freezerIdToCheck
    );
  }, [destTab, newContainerName, selectedFreezerId, newContainerFreezerId, state.containers]);

  const retiredContainer = useMemo(() => {
    if (destTab !== 'retired' || !selectedContainerId) return null;
    const found = state.containers.find(c => c.id === selectedContainerId);
    if (found) return found;
    const tpl = (state.containerTemplates || []).find(t => t.id === selectedContainerId || t.name.toLowerCase().trim() === selectedContainerId.toLowerCase().trim());
    if (tpl) {
      return {
        id: tpl.id,
        name: tpl.name,
        icon: tpl.icon || 'Folder',
        imageUrl: tpl.imageUrl,
        templateId: tpl.id,
        deleteOnEmpty: false,
        isArchived: false,
      } as Container;
    }
    return null;
  }, [destTab, selectedContainerId, state.containers, state.containerTemplates]);

  const selectedContainer = useMemo(() => {
    if (!selectedContainerId) return null;
    const found = state.containers.find(c => c.id === selectedContainerId);
    if (found) return found;
    const tpl = (state.containerTemplates || []).find(t => t.id === selectedContainerId || t.name.toLowerCase().trim() === selectedContainerId.toLowerCase().trim());
    if (tpl) {
      return {
        id: tpl.id,
        name: tpl.name,
        icon: tpl.icon || 'Folder',
        imageUrl: tpl.imageUrl,
        templateId: tpl.id,
        deleteOnEmpty: false,
        isArchived: false,
      } as Container;
    }
    return null;
  }, [selectedContainerId, state.containers, state.containerTemplates]);

  const hasRetiredDuplicateInSameFreezer = useMemo(() => {
    const freezerIdToCheck = selectedFreezerId || unretireFreezerId;
    if (!retiredContainer || !freezerIdToCheck) return false;
    return state.containers.some(c => 
      c.id !== retiredContainer.id &&
      c.name.trim().toLowerCase() === retiredContainer.name.trim().toLowerCase() && 
      c.freezerId === freezerIdToCheck
    );
  }, [retiredContainer, selectedFreezerId, unretireFreezerId, state.containers]);

  // Keep selectedFreezerId synced when selecting an existing container
  useEffect(() => {
    if (selectedContainerId && selectedContainerId !== 'staging_loose' && destTab === 'existing') {
      const cont = state.containers.find(c => c.id === selectedContainerId);
      if (cont) {
        setSelectedFreezerId(cont.freezerId || '');
      } else if (selectedContainerId.endsWith('_loose')) {
        const frizId = selectedContainerId.replace('_loose', '');
        setSelectedFreezerId(frizId);
      }
    } else if (selectedContainerId === 'staging_loose' && destTab === 'existing') {
      setSelectedFreezerId('');
    }
  }, [selectedContainerId, state.containers, destTab]);

  // Handler for freezer location selection
  const handleFreezerSelect = (freezerId: string) => {
    setSelectedFreezerId(freezerId);
    if (destTab === 'new') setNewContainerFreezerId(freezerId);
    if (destTab === 'retired') setUnretireFreezerId(freezerId);

    // If destination tab is existing active containers (or standard stock intake)
    if (destTab === 'existing') {
      if (freezerId) {
        // Default to loose in the selected freezer if no container selected, or if currently staging/loose
        if (!selectedContainerId || selectedContainerId === 'staging_loose' || selectedContainerId.endsWith('_loose')) {
          setSelectedContainerId(`${freezerId}_loose`);
        }
      } else {
        // If freezer unselected (reverted to Staging), default back to staging_loose if currently loose
        if (!selectedContainerId || selectedContainerId.endsWith('_loose')) {
          setSelectedContainerId('staging_loose');
        }
      }
    }
    setErrorMsg('');
  };

  // Auto-generate container name using robust combinatorics
  const suggestContainerName = () => {
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

    setNewContainerName(chosenName);
  };

  // Trigger suggest container name initially
  useEffect(() => {
    suggestContainerName();
  }, []);

  const filteredRetiredContainers = useMemo(() => {
    // 1. Convert all container templates into Container-compatible items
    const templateItems: Container[] = (state.containerTemplates || []).map(tpl => ({
      id: tpl.id,
      name: tpl.name,
      icon: tpl.icon || 'Folder',
      imageUrl: tpl.imageUrl,
      templateId: tpl.id,
      deleteOnEmpty: false,
      isArchived: false
    }));

    // 2. Collect any unassigned or archived containers not already represented by a template ID or template name
    const existingTemplateIds = new Set((state.containerTemplates || []).map(t => t.id));
    const existingTemplateNames = new Set((state.containerTemplates || []).map(t => t.name.toLowerCase().trim()));

    const archivedOrUnassignedContainers = state.containers.filter(c => {
      if (c.isBox || c.id.startsWith('box-') || c.id.endsWith('_loose') || c.id === 'staging_loose') return false;
      const isUnassignedOrArchived = !c.freezerId || c.isArchived;
      if (!isUnassignedOrArchived) return false;
      if (c.templateId && existingTemplateIds.has(c.templateId)) return false;
      if (existingTemplateNames.has(c.name.toLowerCase().trim())) return false;
      return true;
    });

    return [...templateItems, ...archivedOrUnassignedContainers]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [state.containers, state.containerTemplates]);

  // Aggregate active product IDs depending on mode (moving or inbounding)
  const activeProductIds = useMemo(() => {
    if (isMoveMode && sourceMeatCut) {
      return [sourceMeatCut.productId];
    }
    return Array.from(new Set(inboundItems.map(item => item.productId).filter(Boolean)));
  }, [isMoveMode, sourceMeatCut, inboundItems]);

  // Suggest other containers that already contain the same item(s) to encourage consolidation
  const suggestedContainers = useMemo(() => {
    if (activeProductIds.length === 0) return [];

    const cutsWithProduct = state.meatCuts.filter(mc => 
      activeProductIds.includes(mc.productId) && 
      mc.quantity > 0 &&
      (!isMoveMode || mc.containerId !== sourceMeatCut?.containerId)
    );

    const containerDataMap: Record<string, {
      container: Container;
      freezer: Freezer | undefined;
      cuts: typeof state.meatCuts;
    }> = {};

    for (const mc of cutsWithProduct) {
      const container = state.containers.find(c => c.id === mc.containerId);
      if (!container || container.isArchived) continue;

      if (container.isBox && container.freezerId) {
        const freezer = state.freezers.find(f => f.id === container.freezerId);
        if (!freezer || freezer.isPallet) continue;
      }
      
      const freezer = container.freezerId ? state.freezers.find(f => f.id === container.freezerId) : undefined;
      
      if (!containerDataMap[container.id]) {
        containerDataMap[container.id] = {
          container,
          freezer,
          cuts: []
        };
      }
      containerDataMap[container.id].cuts.push(mc);
    }

    return Object.values(containerDataMap).sort((a, b) => {
      const fAName = a.freezer?.name || 'Staging';
      const fBName = b.freezer?.name || 'Staging';
      const comp = fAName.localeCompare(fBName, undefined, { numeric: true, sensitivity: 'base' });
      if (comp !== 0) return comp;
      return a.container.name.localeCompare(b.container.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [activeProductIds, state.meatCuts, state.containers, state.freezers, isMoveMode, sourceMeatCut]);

  // Derived Header Target Display Information
  const targetContainerName = useMemo(() => {
    if (destTab === 'new') {
      return newContainerName.trim() ? `New Container "${newContainerName.trim()}"` : 'New Container';
    }
    if (selectedContainerId === 'staging_loose') {
      return '🛒 Staging';
    }
    if (selectedContainerId.endsWith('_loose')) {
      const frizId = selectedContainerId.replace('_loose', '');
      const freezerObj = state.freezers.find(f => f.id === frizId);
      return `Loose in ${freezerObj?.name || 'Freezer'}`;
    }
    if (selectedContainer) {
      return selectedContainer.name;
    }
    if (selectedFreezerId) {
      const freezerObj = state.freezers.find(f => f.id === selectedFreezerId);
      return `Loose in ${freezerObj?.name || 'Freezer'}`;
    }
    return 'None Selected';
  }, [destTab, newContainerName, selectedContainerId, selectedContainer, selectedFreezerId, state.freezers]);

  const targetFreezer = useMemo(() => {
    let frizId = selectedFreezerId;
    if (!frizId) {
      if (destTab === 'new') frizId = newContainerFreezerId;
      else if (destTab === 'retired') frizId = unretireFreezerId;
      else if (selectedContainer?.freezerId) frizId = selectedContainer.freezerId;
      else if (selectedContainerId.endsWith('_loose') && selectedContainerId !== 'staging_loose') {
        frizId = selectedContainerId.replace('_loose', '');
      }
    }
    if (!frizId) return null;
    return state.freezers.find(f => f.id === frizId) || null;
  }, [selectedFreezerId, destTab, newContainerFreezerId, unretireFreezerId, selectedContainer, selectedContainerId, state.freezers]);

  // Action Button / Submit Handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      let targetId = selectedContainerId;

      // 1. If "New Container" tab is selected, validate and create it first
      if (destTab === 'new') {
        if (!newContainerName.trim()) {
          setErrorMsg('Please specify a name for the new container.');
          return;
        }
        
        const generatedId = generateUUID();
        const finalFreezerId = selectedFreezerId || newContainerFreezerId || undefined;
        const newContainerPayload = {
          id: generatedId,
          name: newContainerName.trim(),
          icon: newContainerIcon,
          deleteOnEmpty: newContainerDeleteOnEmpty,
          freezerId: finalFreezerId,
          imageUrl: newContainerImageUrl.trim() || undefined
        };

        const success = await dispatch({ type: 'ADD_CONTAINER', payload: newContainerPayload });
        if (!success) {
          setErrorMsg('Failed to create the new container on the backend.');
          return;
        }
        targetId = generatedId;

      // 2. If "Retired" container selected, make sure to move it back to a freezer first (or leave in Staging optional)
      } else if (destTab === 'retired') {
        if (!selectedContainerId) {
          setErrorMsg('Please select a retired or unused container.');
          return;
        }
        const finalFreezerId = selectedFreezerId || unretireFreezerId || undefined;

        const existingContainer = state.containers.find(c => c.id === selectedContainerId);
        const matchedTemplate = (state.containerTemplates || []).find(t => t.id === selectedContainerId || t.name.toLowerCase().trim() === selectedContainerId.toLowerCase().trim());

        if (existingContainer) {
          if (existingContainer.isArchived) {
            await dispatch({ type: 'TOGGLE_CONTAINER_ARCHIVED', payload: { containerId: existingContainer.id, isArchived: false } });
          }
          const success = await dispatch({ type: 'MOVE_CONTAINER', payload: { containerId: existingContainer.id, newFreezerId: finalFreezerId } });
          if (!success) {
            setErrorMsg('Failed to assign the container selection.');
            return;
          }
          targetId = existingContainer.id;
        } else if (matchedTemplate) {
          const generatedId = generateUUID();
          const newContainerPayload = {
            id: generatedId,
            name: matchedTemplate.name,
            icon: matchedTemplate.icon || 'Folder',
            templateId: matchedTemplate.id,
            imageUrl: matchedTemplate.imageUrl || undefined,
            deleteOnEmpty: false,
            freezerId: finalFreezerId,
            isArchived: false
          };

          const success = await dispatch({ type: 'ADD_CONTAINER', payload: newContainerPayload });
          if (!success) {
            setErrorMsg('Failed to create container from template.');
            return;
          }
          targetId = generatedId;
        } else {
          targetId = selectedContainerId;
        }
      } else {
        // Existing Containers tab
        if (selectedFreezerId && (!selectedContainerId || selectedContainerId === 'staging_loose' || selectedContainerId.endsWith('_loose'))) {
          targetId = `${selectedFreezerId}_loose`;
        } else if (!selectedContainerId) {
          setErrorMsg('Please select a target container or Staging.');
          return;
        }
        // If user selected a specific container and chose or changed its freezer location in Section 2B
        if (selectedContainerId !== 'staging_loose' && !selectedContainerId.endsWith('_loose') && selectedContainer) {
          if (selectedFreezerId && selectedFreezerId !== selectedContainer.freezerId) {
            await dispatch({ type: 'MOVE_CONTAINER', payload: { containerId: selectedContainerId, newFreezerId: selectedFreezerId } });
          }
        }
      }

      // --- Execute Core Action based on Mode ---
      if (isMoveMode && sourceMeatCut) {
        if (evalQty <= 0) {
          setErrorMsg('Move quantity must be greater than zero.');
          return;
        }
        const success = await dispatch({
          type: 'MOVE_MEAT_QUANTITY',
          payload: {
            meatCutId: sourceMeatCut.id,
            newContainerId: targetId,
            quantity: evalQty,
            sourceContainerId: sourceMeatCut.containerId
          }
        });
        if (success) {
          onClose();
        }
      } else {
        // Inbound stock mode
        const validItems = inboundItems
          .filter(item => item.productId && Number(item.quantity) > 0)
          .map(({ productId, quantity, notes, workingFrom, notForSale, tagIds }) => ({ 
            productId, 
            quantity: Number(quantity), 
            notes,
            workingFrom,
            notForSale,
            tagIds: tagIds || []
          }));

        if (validItems.length === 0) {
          setErrorMsg('Please add at least one valid product with quantity larger than 0.');
          return;
        }

        const success = await dispatch({
          type: 'BULK_ADD_MEAT_CUTS',
          payload: {
            items: validItems,
            containerId: targetId
          }
        });
        if (success) {
          onClose();
        }
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      setErrorMsg(err?.message || 'An error occurred during submission.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Switch tabs cleanly
  const handleTabChange = (tab: DestinationType) => {
    setDestTab(tab);
    setErrorMsg('');
    if (tab === 'new') {
      setSelectedContainerId('');
    } else if (tab === 'retired') {
      setSelectedContainerId('');
    } else {
      setSelectedContainerId('staging_loose');
    }
  };

  if (showProductForm) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-cool-gray-800">
          <h3 className="text-md font-bold text-white">Create New Catalog Product</h3>
          <button type="button" onClick={() => setShowProductForm(false)} className="text-xs text-cyan-300 font-bold hover:underline">Back to List</button>
        </div>
        <ManagementForms.ProductForm 
          dispatch={dispatch} 
          onClose={() => setShowProductForm(false)} 
          products={state.products}
          onProductCreated={handleProductCreated}
          state={state}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col space-y-4">
      {/* ========================================================= */}
      {/* TOP HEADER BANNER: SELECTED LOCATION & DONE BUTTON */}
      {/* ========================================================= */}
      {/* STICKY ACTION HEADER SUMMARY */}
      {/* ========================================================= */}
      <div className="sticky -top-6 z-20 intake-header-sticky p-3.5 rounded-xl shadow-2xl space-y-2 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Destination Location Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl shrink-0 border shadow-inner ${
              targetFreezer 
                ? 'bg-cyan-950 border-cyan-500 text-cyan-200 ring-1 ring-cyan-400/30' 
                : 'bg-amber-950 border-amber-500 text-amber-200 ring-1 ring-amber-400/30'
            }`}>
              {selectedContainerId === 'staging_loose' ? (
                <Table className="w-6 h-6 text-amber-300" />
              ) : (
                <PackageIcon className="w-6 h-6 text-cyan-200" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <span className="target-destination-label text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded inline-block mb-0.5 shadow-sm">
                Target Destination Location
              </span>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="target-destination-name text-sm sm:text-base font-black truncate">
                  {targetContainerName}
                </span>
                <span className="text-cyan-400 font-black text-sm">➔</span>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border shadow-sm ${
                  targetFreezer
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-200'
                    : 'bg-amber-950 border-amber-500 text-amber-200'
                }`}>
                  {targetFreezer ? `❄️ ${targetFreezer.name}` : '🛒 Staging'}
                </span>
              </div>
            </div>
          </div>

          {/* DONE / COMPLETE ACTION BUTTON AT TOP */}
          <button
            type="submit"
            disabled={isSubmitting || (isMoveMode ? evalQty <= 0 : inboundItems.filter(i => i.productId && Number(i.quantity) > 0).length === 0)}
            className="py-2.5 px-5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg cursor-pointer flex items-center justify-center gap-2 border border-cyan-300/40 shrink-0 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{isMoveMode ? 'Moving Items...' : 'Saving Intake...'}</span>
              </div>
            ) : (
              <span>
                {isMoveMode
                  ? `✓ Done: Move ${evalQty} Item${evalQty > 1 ? 's' : ''}`
                  : `✓ Done: Complete Stock Intake`}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">
        {/* ========================================================= */}
        {/* SECTION 1: ITEMS INBOUNDED / BEING MOVED */}
        {/* ========================================================= */}
        <div className="intake-section-1 p-4 rounded-xl space-y-4 h-fit shadow-md">
          <h3 className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider">
            {isMoveMode ? '1. Select Quantity to Move' : '1. Stock Intake Details (Select Products)'}
          </h3>

          {isMoveMode && sourceMeatCut && sourceProduct && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2.5 intake-section-1-subcard rounded-lg">
                {sourceProduct.imageUrl ? (
                  <img 
                    src={sourceProduct.imageUrl} 
                    alt={sourceProduct.name} 
                    className="w-11 h-11 rounded object-cover flex-shrink-0 cursor-zoom-in hover:scale-110 active:scale-95 transition-transform duration-200" 
                    onClick={(e) => {
                      e.stopPropagation();
                      (window as any).__showImagePreview?.(sourceProduct.imageUrl, sourceProduct.name);
                    }}
                    title="Click to zoom in"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 rounded bg-cool-gray-700 flex items-center justify-center flex-shrink-0">
                    <PackageIcon className="w-6 h-6 text-cyan-200" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white truncate">{sourceProduct.name}</p>
                  <p className="text-xs text-cool-gray-300">
                    Currently in <span className="text-white font-bold">"{sourceContainer?.name || 'Unassigned'}"</span> ({sourceMeatCut.quantity} pcs total)
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-cool-gray-200">
                  Quantity (Supports + / - offsets or formulas like "5+3"):
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleModifyQuantity(-1)}
                    className="p-2 bg-cool-gray-700 hover:bg-cool-gray-600 rounded-lg text-white transition w-10 h-10 flex items-center justify-center cursor-pointer shrink-0 font-bold"
                  >
                    <MinusIcon className="w-4 h-4"/>
                  </button>
                  <input
                    type="text"
                    value={moveQuantityStr}
                    onChange={(e) => setMoveQuantityStr(e.target.value)}
                    className="flex-grow px-3 py-2 bg-cool-gray-900 border border-cool-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-center font-black text-cyan-300 text-sm"
                    placeholder="Quantity..."
                  />
                  <button
                    type="button"
                    onClick={() => handleModifyQuantity(1)}
                    className="p-2 bg-cool-gray-700 hover:bg-cool-gray-600 rounded-lg text-white transition w-10 h-10 flex items-center justify-center cursor-pointer shrink-0 font-bold"
                  >
                    <PlusIcon className="w-4 h-4"/>
                  </button>
                </div>
                <p className="text-xs text-right text-cool-gray-300 font-mono font-semibold">
                  Evaluated Target Quantity: <span className="text-cyan-300 font-black">{evalQty}</span> / {sourceMeatCut.quantity} pcs
                </p>
              </div>
            </div>
          )}

          {!isMoveMode && (
            <div className="space-y-3">
              <div className="space-y-2">
                {inboundItems.map((item, index) => (
                  <div key={item.id} className="p-3 intake-section-1-subcard rounded-lg space-y-2 relative shadow-sm">
                    {inboundItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInboundRow(item.id)}
                        className="absolute top-1.5 right-1.5 p-1 text-cool-gray-300 hover:text-red-400 transition cursor-pointer"
                        title="Remove Row"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    )}
                    
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-extrabold text-cool-gray-300">Product #{index + 1}</label>
                      <SearchableProductSelect
                        products={state.products}
                        value={item.productId}
                        onChange={(val) => handleInboundItemChange(item.id, 'productId', val)}
                        placeholder="Type product name to search..."
                      />
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] uppercase font-extrabold text-cool-gray-300">Qty</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={item.quantity ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d+$/.test(val)) {
                              handleInboundItemChange(item.id, 'quantity', val);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-cool-gray-900 border border-cool-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-white font-bold"
                          placeholder="Qty"
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <label className="text-[10px] uppercase font-extrabold text-cool-gray-300">Notes (Optional)</label>
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => handleInboundItemChange(item.id, 'notes', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-cool-gray-900 border border-cool-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white font-medium placeholder:text-cool-gray-400"
                          placeholder="e.g., Prime Rib, dated"
                        />
                      </div>
                    </div>

                    {/* Assignable Tags Section */}
                    <div className="flex flex-col gap-1 pt-1">
                      <span className="text-[10px] uppercase font-extrabold text-cool-gray-300">Assignable Tags</span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {(state?.tags || []).map(tag => {
                          const isSelected = (item.tagIds || []).includes(tag.id);
                          return (
                            <button
                              type="button"
                              key={tag.id}
                              onClick={() => {
                                const currentTags = item.tagIds || [];
                                const nextTags = currentTags.includes(tag.id)
                                  ? currentTags.filter(id => id !== tag.id)
                                  : [...currentTags, tag.id];
                                handleInboundItemChange(item.id, 'tagIds', nextTags);
                                
                                // sync backward compatibility fields
                                if (tag.id === 'use-first') {
                                  handleInboundItemChange(item.id, 'workingFrom', nextTags.includes('use-first'));
                                }
                                if (tag.id === 'not-for-sale') {
                                  handleInboundItemChange(item.id, 'notForSale', nextTags.includes('not-for-sale'));
                                }
                              }}
                              style={{ 
                                borderColor: tag.color || '#3b82f6', 
                                backgroundColor: isSelected ? (tag.color ? `${tag.color}40` : '#3b82f640') : 'transparent',
                                color: tag.color || '#3b82f6'
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold border transition flex items-center gap-1 select-none cursor-pointer hover:brightness-125 ${isSelected ? 'shadow-sm ring-1 ring-white/20' : 'text-cool-gray-200 border-cool-gray-700 hover:bg-cool-gray-800'}`}
                            >
                              <span>{tag.id === 'use-first' ? '⚡' : tag.id === 'not-for-sale' ? '🛑' : '🏷️'}</span>
                              <span>{tag.name}</span>
                            </button>
                          );
                        })}
                        {(state?.tags || []).length === 0 && (
                          <p className="text-[10px] text-cool-gray-400 font-medium">No tags configured. Create tags in the catalog.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 justify-between items-center pt-1">
                <button
                  type="button"
                  onClick={addInboundRow}
                  className="py-1.5 px-3 bg-cyan-950 hover:bg-cyan-900 text-cyan-200 font-bold rounded-lg text-xs transition border border-cyan-700/60 flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Add Another Item
                </button>

                <button
                  type="button"
                  onClick={() => setShowProductForm(true)}
                  className="py-1.5 px-3 bg-cool-gray-750 hover:bg-cool-gray-700 text-white font-bold rounded-lg text-xs transition border border-cool-gray-650 flex items-center gap-1 cursor-pointer"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  New Catalog Item
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: DESTINATION SELECTION (CONTAINER + FREEZER) */}
        {/* ========================================================= */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider">
            2. Destination Setup (Container & Freezer)
          </h3>

          {/* --------------------------------------------------------- */}
          {/* DISTINCT SUB-SECTION 2A: CONTAINER SELECTION */}
          {/* --------------------------------------------------------- */}
          <div className="intake-section-2a p-4 rounded-xl space-y-3.5 shadow-md">
            <div className="flex items-center justify-between pb-2 border-b border-cool-gray-750">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span className="p-1 rounded bg-amber-950 text-amber-300 border border-amber-800">📦</span>
                Section 2A: Select Container (Box, Bag, or Staging)
              </h4>
              {selectedContainerId === 'staging_loose' ? (
                <span className="text-[10px] bg-amber-950 text-amber-200 border border-amber-800 px-2.5 py-0.5 rounded-full font-extrabold">
                  🛒 Staging
                </span>
              ) : selectedContainerId.endsWith('_loose') ? (
                <span className="text-[10px] bg-cyan-950 text-cyan-200 border border-cyan-800 px-2.5 py-0.5 rounded-full font-extrabold">
                  ❄️ Loose in {targetFreezer?.name || 'Freezer'}
                </span>
              ) : null}
            </div>

            {/* Quick select for Staging Area */}
            <div 
              onClick={() => handleFreezerSelect('')}
              className={`p-3 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 text-left cursor-pointer ${
                selectedContainerId === 'staging_loose'
                  ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-400/30 shadow-md'
                  : 'intake-section-2a-subcard hover:opacity-90'
              }`}
            >
              <div className="min-w-0">
                <h4 className="text-xs font-black text-amber-200 flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-amber-300 shrink-0" />
                  🛒 Staging (Unassigned Loose)
                </h4>
                <p className="text-xs text-cool-gray-300 mt-0.5 leading-normal font-medium">
                  Send item(s) directly to the unplaced staging queue.
                </p>
              </div>
              <button
                type="button"
                className={`py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-wide transition shrink-0 ${
                  selectedContainerId === 'staging_loose'
                    ? 'bg-amber-500 border border-amber-400 text-cool-gray-950 shadow-md'
                    : 'bg-cool-gray-800 border border-cool-gray-700 text-white hover:bg-cool-gray-700'
                }`}
              >
                {selectedContainerId === 'staging_loose' ? 'Selected ✓' : 'Select Staging'}
              </button>
            </div>

            {/* Default Loose Container in Selected Freezer Indicator */}
            {selectedContainerId.endsWith('_loose') && selectedContainerId !== 'staging_loose' && targetFreezer && (
              <div className="p-3 rounded-xl border bg-cyan-950/40 border-cyan-500 ring-2 ring-cyan-400/30 shadow-md flex items-center justify-between gap-3 text-left animate-slide-in">
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-cyan-200 flex items-center gap-1.5">
                    <span>❄️</span> Loose in {targetFreezer.name}
                  </h4>
                  <p className="text-xs text-cool-gray-300 mt-0.5 leading-normal font-medium">
                    Defaulting to loose storage inside {targetFreezer.name}. Or search/pick a box below:
                  </p>
                </div>
                <span className="py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-wide bg-cyan-500 border border-cyan-400 text-cool-gray-950 shadow-md shrink-0">
                  Default Selected ✓
                </span>
              </div>
            )}

            {/* Tab switcher for Storage Containers */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-extrabold text-cool-gray-300 block">
                Or Choose Specific Storage Container Type:
              </label>
              <div className="grid grid-cols-3 gap-1.5 intake-section-2a-subcard p-1.5 rounded-xl border border-cool-gray-700/50">
                <button
                  type="button"
                  onClick={() => handleTabChange('existing')}
                  className={`py-2 px-1 text-[11px] sm:text-xs rounded-lg transition-all font-extrabold cursor-pointer text-center flex items-center justify-center border leading-tight ${
                    destTab === 'existing' && selectedContainerId !== 'staging_loose'
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-md ring-1 ring-cyan-300/30'
                      : 'bg-cool-gray-900/90 text-cool-gray-200 border-cool-gray-700/80 hover:bg-cool-gray-800 hover:text-white hover:border-cool-gray-600'
                  }`}
                >
                  Existing Active
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('retired')}
                  className={`py-2 px-1 text-[11px] sm:text-xs rounded-lg transition-all font-extrabold cursor-pointer text-center flex items-center justify-center border leading-tight ${
                    destTab === 'retired'
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-md ring-1 ring-cyan-300/30'
                      : 'bg-cool-gray-900/90 text-cool-gray-200 border-cool-gray-700/80 hover:bg-cool-gray-800 hover:text-white hover:border-cool-gray-600'
                  }`}
                >
                  Retired / Unused
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('new')}
                  className={`py-2 px-1 text-[11px] sm:text-xs rounded-lg transition-all font-extrabold cursor-pointer text-center flex items-center justify-center border leading-tight ${
                    destTab === 'new'
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-md ring-1 ring-cyan-300/30'
                      : 'bg-cool-gray-900/90 text-cool-gray-200 border-cool-gray-700/80 hover:bg-cool-gray-800 hover:text-white hover:border-cool-gray-600'
                  }`}
                >
                  + Create New Box
                </button>
              </div>
            </div>

            {/* Suggested Containers already containing this item */}
            {suggestedContainers.length > 0 && destTab === 'existing' && (
              <div className="bg-cyan-950/30 border border-cyan-800/60 p-3.5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="animate-pulse">✨</span> Suggested Consolidations (Already has same item)
                  </h4>
                  <span className="text-[10px] bg-[#0fa3f0] text-black border border-cyan-300 px-2 py-0.5 rounded font-mono font-black shadow-sm">
                    {suggestedContainers.length} found
                  </span>
                </div>
                <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                  {suggestedContainers.map(({ container, freezer, cuts }) => {
                    const isSelected = selectedContainerId === container.id;
                    const Icon = getContainerIcon(container.icon || 'generic');
                    const matchingQty = cuts.reduce((sum, c) => sum + c.quantity, 0);

                    return (
                      <button
                        type="button"
                        key={`suggested-${container.id}`}
                        onClick={() => {
                          setSelectedContainerId(container.id);
                          setSelectedFreezerId(container.freezerId || '');
                          setDestTab('existing');
                          setErrorMsg('');
                        }}
                        className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition cursor-pointer border ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-500 ring-2 ring-cyan-400/30 shadow-md'
                            : 'intake-section-2a-subcard hover:border-cyan-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {container.imageUrl ? (
                            <img 
                              src={container.imageUrl} 
                              alt={container.name} 
                              className="w-8 h-8 rounded object-cover flex-shrink-0 cursor-zoom-in border border-cool-gray-700" 
                              onClick={(e) => {
                                e.stopPropagation();
                                (window as any).__showImagePreview?.(container.imageUrl, container.name);
                              }}
                              title="Click to zoom in"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-cool-gray-900 flex items-center justify-center flex-shrink-0 border border-cool-gray-700">
                              <Icon className="w-4 h-4 text-cyan-300" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-white truncate flex items-center gap-1.5 flex-wrap">
                              <span className="truncate">{container.name}</span>
                              {freezer ? (
                                <span className="text-[10px] text-cyan-200 bg-cyan-950 border border-cyan-700 px-1.5 py-0.5 rounded font-extrabold truncate">
                                  ❄️ {freezer.name}
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-200 bg-amber-950 border border-amber-700 px-1.5 py-0.5 rounded font-extrabold truncate">
                                  🛒 Staging
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-black bg-cyan-300/90 border border-cyan-200 px-1.5 py-0.2 rounded font-black mt-0.5 inline-block">
                              Already has <span className="font-black text-black">{matchingQty}</span> pc{matchingQty !== 1 ? 's' : ''} inside
                            </p>
                          </div>
                        </div>
                        
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded transition-colors shrink-0 ${
                          isSelected 
                            ? 'bg-cyan-600 text-white' 
                            : 'bg-cool-gray-900 text-cool-gray-200 border border-cool-gray-700'
                        }`}>
                          {isSelected ? 'Selected ✓' : 'Select'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* --- Render Existing Active Containers Dropdown --- */}
            {destTab === 'existing' && (
              <div className="space-y-1.5 text-left pt-1">
                <label className="text-[10px] uppercase font-extrabold text-cool-gray-300">Search Existing Active Box / Bag:</label>
                <SearchableContainerSelect
                  containers={state.containers.filter(c => {
                    if (c.isArchived) return false;
                    if (c.id === sourceMeatCut?.containerId) return false;
                    if (!c.freezerId) return false;
                    if (c.isBox) {
                      const freezer = state.freezers.find(f => f.id === c.freezerId);
                      if (!freezer || freezer.isPallet) return false;
                    }
                    return true;
                  })}
                  value={selectedContainerId === 'staging_loose' || selectedContainerId.endsWith('_loose') ? '' : selectedContainerId}
                  onChange={(val) => {
                    setSelectedContainerId(val || (selectedFreezerId ? `${selectedFreezerId}_loose` : 'staging_loose'));
                    setErrorMsg('');
                  }}
                  placeholder="Type name to find existing container..."
                  freezers={state.freezers}
                />
              </div>
            )}

            {/* --- Render Unplaced / Retired Containers Dropdown --- */}
            {destTab === 'retired' && (
              <div className="space-y-1.5 text-left pt-1">
                <label className="text-[10px] uppercase font-extrabold text-cool-gray-300">Select Retired/Unused Container:</label>
                <SearchableContainerSelect
                  containers={filteredRetiredContainers}
                  value={selectedContainerId}
                  onChange={(val) => {
                    setSelectedContainerId(val);
                    setErrorMsg('');
                  }}
                  placeholder="Type name to find unused container..."
                  freezers={state.freezers}
                />
              </div>
            )}

            {/* --- Render Brand New Container Creator on the fly --- */}
            {destTab === 'new' && (
              <div className="intake-section-2a-creator p-3.5 rounded-xl space-y-3 text-left animate-slide-in shadow-sm">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="new-container-name" className="block text-xs font-extrabold text-cool-gray-200 uppercase tracking-wide">
                      Container Name:
                    </label>
                    <button
                      type="button"
                      onClick={() => suggestContainerName()}
                      className="text-[11px] text-cyan-300 font-bold hover:underline cursor-pointer"
                    >
                      Generate another name
                    </button>
                  </div>
                  <input
                    id="new-container-name"
                    type="text"
                    required
                    value={newContainerName}
                    onChange={(e) => setNewContainerName(e.target.value)}
                    placeholder="e.g., box - arctic max"
                    className="w-full px-3 py-2 text-xs bg-cool-gray-950 border border-cool-gray-700 rounded-lg text-white font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                
                <div className="flex items-center">
                  <input 
                    id="create-new-delete-on-empty" 
                    type="checkbox" 
                    checked={newContainerDeleteOnEmpty} 
                    onChange={e => setNewContainerDeleteOnEmpty(e.target.checked)} 
                    className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-600 cursor-pointer" 
                  />
                  <label htmlFor="create-new-delete-on-empty" className="ml-2 block text-xs text-cool-gray-200 font-medium cursor-pointer">
                    Delete when empty (e.g., disposable bags/boxes)
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-cool-gray-200 uppercase tracking-wide">
                    Container Image / Snapshot (Optional):
                  </label>
                  <MediaSelector imageUrl={newContainerImageUrl} onChange={setNewContainerImageUrl} placeholder="Or paste image URL link..." />
                </div>
              </div>
            )}
          </div>

          {/* --------------------------------------------------------- */}
          {/* DISTINCT SUB-SECTION 2B: FREEZER LOCATION SELECTION */}
          {/* --------------------------------------------------------- */}
          <div className="intake-section-2b p-4 rounded-xl space-y-3.5 shadow-md">
            <div className="flex items-center justify-between pb-2 border-b border-cool-gray-750">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span className="p-1 rounded bg-blue-950 text-blue-300 border border-blue-800">❄️</span>
                Section 2B: Assign Freezer Location
              </h4>
              {selectedFreezerId ? (
                <span className="text-[10px] bg-cyan-950 text-cyan-200 border border-cyan-800 px-2.5 py-0.5 rounded-full font-extrabold">
                  {state.freezers.find(f => f.id === selectedFreezerId)?.name || 'Freezer Unit'}
                </span>
              ) : (
                <span className="text-[10px] bg-amber-950 text-amber-200 border border-amber-800 px-2.5 py-0.5 rounded-full font-extrabold">
                  🛒 Staging
                </span>
              )}
            </div>

            <div className="space-y-2.5">
              <label className="block text-[11px] font-black text-cool-gray-200 uppercase tracking-wide">
                Select Target Freezer Unit:
              </label>

              {/* Freezer Select Dropdown */}
              <select
                value={selectedFreezerId}
                onChange={(e) => handleFreezerSelect(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-cool-gray-900 border border-cool-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 font-bold cursor-pointer"
              >
                <option value="">🛒 Staging (No Freezer Assigned)</option>
                {state.freezers
                  .filter(f => !f.isPallet && !f.id.startsWith('pallet-') && !f.isArchived)
                  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                  .map(f => (
                    <option key={f.id} value={f.id}>
                      ❄️ {f.name} {f.isSpecial ? " (Display Case)" : ""}
                    </option>
                  ))}
              </select>

              {/* Visual Freezer Selector Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleFreezerSelect('')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                    !selectedFreezerId
                      ? 'bg-amber-950/50 border-amber-500 text-amber-200 ring-1 ring-amber-400/30 shadow'
                      : 'intake-section-2b-subcard text-cool-gray-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Table className="w-4 h-4 text-amber-300 shrink-0" />
                    <span className="text-xs font-black truncate">🛒 Staging</span>
                  </div>
                  {!selectedFreezerId && <span className="text-[10px] font-black text-amber-300">Active ✓</span>}
                </button>

                {state.freezers
                  .filter(f => !f.isPallet && !f.id.startsWith('pallet-') && !f.isArchived)
                  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                  .map(f => {
                    const isSelected = selectedFreezerId === f.id;
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => handleFreezerSelect(f.id)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-cyan-950/70 border-cyan-500 text-cyan-200 ring-1 ring-cyan-400/30 shadow-md'
                            : 'intake-section-2b-subcard text-cool-gray-200 hover:border-cyan-500/50 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs">❄️</span>
                          <span className="text-xs font-black truncate">{f.name}</span>
                        </div>
                        {isSelected && <span className="text-[10px] font-black text-cyan-300">Selected ✓</span>}
                      </button>
                    );
                  })}
              </div>

              {hasNewDuplicateInSameFreezer && (
                <p className="text-yellow-300 text-xs font-bold mt-1 bg-yellow-950/50 p-2 rounded border border-yellow-700/50">
                  ⚠️ Warning: The selected freezer already contains a container named "{newContainerName}".
                </p>
              )}

              {hasRetiredDuplicateInSameFreezer && (
                <p className="text-yellow-300 text-xs font-bold mt-1 bg-yellow-950/50 p-2 rounded border border-yellow-700/50">
                  ⚠️ Warning: The selected freezer already contains a container named "{retiredContainer?.name}".
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 3: ERRORS AND NOTIFICATIONS */}
      {/* ========================================================= */}
      {errorMsg && (
        <p className="text-red-300 text-xs font-black animate-pulse bg-red-950/40 p-2.5 rounded-lg border border-red-500/40">
          ⚠️ {errorMsg}
        </p>
      )}

      {/* ========================================================= */}
      {/* BOTTOM ACTION BUTTON */}
      {/* ========================================================= */}
      <div className="pt-2 border-t border-cool-gray-800 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || (isMoveMode ? evalQty <= 0 : inboundItems.filter(i => i.productId && Number(i.quantity) > 0).length === 0)}
          className="w-full sm:w-auto py-3 px-8 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg cursor-pointer flex items-center justify-center gap-2 border border-cyan-300/40 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>{isMoveMode ? 'Moving Items...' : 'Saving Intake...'}</span>
            </div>
          ) : (
            <span>
              {isMoveMode
                ? `✓ Done: Move ${evalQty} Item${evalQty > 1 ? 's' : ''}`
                : `✓ Done: Complete Stock Intake`}
            </span>
          )}
        </button>
      </div>
    </form>
  );
};
