import React, { useState } from 'react';
import { Action } from '../types';

interface EditNoteModalContentProps {
  dispatch: React.Dispatch<Action>;
  meatCutId: string;
  initialNotes: string;
  initialOriginalCutName?: string;
  onClose: () => void;
}

const EditNoteModalContent: React.FC<EditNoteModalContentProps> = ({ 
  dispatch, 
  meatCutId, 
  initialNotes, 
  initialOriginalCutName, 
  onClose 
}) => {
  const [notes, setNotes] = useState(initialNotes || '');

  const handleSave = () => {
    dispatch({ 
      type: 'UPDATE_MEAT_NOTES', 
      payload: { 
        meatCutId, 
        notes, 
        originalCutName: initialOriginalCutName || undefined 
      } 
    });
    onClose();
  };

  return (
    <div className="space-y-4 text-left">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] text-cool-gray-400 font-bold uppercase tracking-wide">
            Notes / Comments
          </label>
          {notes && (
            <button
              type="button"
              onClick={() => setNotes('')}
              className="text-[11px] text-amber-400 hover:text-amber-300 underline font-semibold transition cursor-pointer"
            >
              Clear Note (Merge back if identical)
            </button>
          )}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full text-sm bg-cool-gray-800 border border-cool-gray-650 p-3 rounded-lg text-cool-gray-100 focus:ring-1 focus:ring-cyan-500 outline-none h-28 min-h-[80px] resize-y"
          placeholder="Add details about the wrong label or other notes..."
          autoFocus
        />
        <p className="text-[11px] text-cool-gray-400 mt-1.5 leading-relaxed">
          💡 <strong>Tip:</strong> Clearing notes and tags so they match the parent item in a container will automatically re-merge them into a single row.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button 
          onClick={onClose} 
          className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
        >
          Cancel
        </button>
        <button 
          onClick={handleSave} 
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default EditNoteModalContent;
