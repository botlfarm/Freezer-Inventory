import React from 'react';
import { Action, InventoryState } from '../types';
import { ClipboardList, Plus, Trash, AlertTriangle } from 'lucide-react';

interface ListThresholdAlertModalContentProps {
  dispatch: (action: Action) => Promise<boolean>;
  state: InventoryState;
  listId: string;
  productId: string;
  actionType: 'add' | 'remove';
  currentValue: number;
  thresholdValue: number;
  controlCondition: 'min' | 'max';
  onClose: () => void;
}

export const ListThresholdAlertModalContent: React.FC<ListThresholdAlertModalContentProps> = ({
  dispatch,
  state,
  listId,
  productId,
  actionType,
  currentValue,
  thresholdValue,
  controlCondition,
  onClose,
}) => {
  const product = state.products.find(p => p.id === productId);
  const customList = state.customLists?.find(cl => cl.id === listId);

  if (!product || !customList) {
    return (
      <div className="p-4 text-center text-cool-gray-300">
        <p>Could not locate the associated list or product information.</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-cool-gray-700 text-white rounded-lg text-xs"
        >
          Close Dialog
        </button>
      </div>
    );
  }

  const handleConfirm = async () => {
    const success = await dispatch({
      type: 'TOGGLE_PRODUCT_ON_LIST',
      payload: {
        listId,
        productId,
        forceState: actionType === 'add',
      },
    });
    if (success) {
      onClose();
    }
  };

  const listItem = customList.items?.find(i => i.productId === productId);
  const controlSource = listItem?.controlSource || 'onsite_count';
  let unitLabel = 'onsite';
  if (controlSource === 'offsite_count') {
    unitLabel = 'offsite';
  } else if (controlSource === 'offsite_weight') {
    unitLabel = 'lbs';
  } else if (controlSource === 'total_count') {
    unitLabel = 'total';
  }

  const isMinCondition = controlCondition === 'min';

  const formatValue = (val: number) => {
    return val.toFixed(controlSource === 'offsite_weight' ? 2 : 0);
  };

  return (
    <div className="flex flex-col gap-4 p-2 text-sm select-none">
      <div className="flex items-center gap-3 bg-cyan-950/20 border border-cyan-800/40 p-3 rounded-lg">
        <AlertTriangle className="w-6 h-6 text-cyan-400 shrink-0" />
        <div>
          <h3 className="text-xs font-black uppercase text-cyan-400 tracking-wider">
            List Automation Trigger
          </h3>
          <p className="text-[11px] text-cool-gray-400">
            A defined stock threshold has been crossed for an active list.
          </p>
        </div>
      </div>

      <div className="bg-cool-gray-850 p-4 rounded-xl border border-cool-gray-750 space-y-2">
        <div className="text-xs text-cool-gray-400 uppercase tracking-widest font-bold">Product Name</div>
        <div className="text-lg font-black text-cool-gray-100">{product.name}</div>
        <div className="text-xs text-cool-gray-400">
          Category: <span className="font-semibold text-cool-gray-200">{product.primaryCategory} &gt; {product.subCategory}</span>
        </div>
      </div>

      <div className="bg-cool-gray-850 p-4 rounded-xl border border-cool-gray-750 space-y-3">
        <div className="flex items-center justify-between text-xs border-b border-cool-gray-800 pb-2">
          <span className="text-cool-gray-400 font-semibold">Target Checklist</span>
          <span className="font-extrabold text-cool-gray-100 flex items-center gap-1">
            <ClipboardList className="w-3.5 h-3.5 text-cyan-500" />
            {customList.name}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-2.5 bg-cool-gray-900 rounded-lg border border-cool-gray-800">
            <div className="text-[10px] text-cool-gray-450 uppercase font-black tracking-wider">Current Stock</div>
            <div className="text-base font-extrabold text-cool-gray-100 mt-1">{formatValue(currentValue)} {unitLabel}</div>
          </div>
          <div className="p-2.5 bg-cool-gray-900 rounded-lg border border-cool-gray-800">
            <div className="text-[10px] text-cool-gray-450 uppercase font-black tracking-wider">
              {isMinCondition ? 'Min Threshold' : 'Max Threshold'}
            </div>
            <div className="text-base font-extrabold text-cool-gray-100 mt-1">{formatValue(thresholdValue)} {unitLabel}</div>
          </div>
        </div>

        <p className="text-xs text-cool-gray-300 leading-relaxed text-center pt-1 font-medium">
          {actionType === 'add' ? (
            <span>
              Stock level reached <strong className="text-cyan-400">{formatValue(currentValue)} {unitLabel}</strong>, crossing the rule requirement ({isMinCondition ? '≤' : '≥'} {formatValue(thresholdValue)} {unitLabel}). Please confirm adding this product to <strong className="text-cool-gray-100">{customList.name}</strong>.
            </span>
          ) : (
            <span>
              Stock level recovered to <strong className="text-emerald-400">{formatValue(currentValue)} {unitLabel}</strong>, resolving the rule target ({isMinCondition ? '>' : '<'} {formatValue(thresholdValue)} {unitLabel}). Please confirm removing it from <strong className="text-cool-gray-100">{customList.name}</strong>.
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-650 text-cool-gray-100 hover:text-white border border-cool-gray-600 font-semibold rounded-lg transition text-xs cursor-pointer"
        >
          Ignore Alert
        </button>

        {actionType === 'add' ? (
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold rounded-lg transition text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add to List
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 bg-rose-650 hover:bg-rose-550 text-white font-extrabold rounded-lg transition text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Trash className="w-3.5 h-3.5" />
            Remove from List
          </button>
        )}
      </div>
    </div>
  );
};
