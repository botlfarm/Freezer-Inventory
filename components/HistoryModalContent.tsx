
import React from 'react';
import { HistoryEntry } from '../types';

interface HistoryModalContentProps {
  history: HistoryEntry[];
}

const HistoryModalContent: React.FC<HistoryModalContentProps> = ({ history }) => {
  if (history.length === 0) {
    return <p className="text-cool-gray-400">No history available for this item.</p>;
  }

  return (
    <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
      {history.map(entry => (
        <li key={entry.id} className="text-sm p-2 bg-cool-gray-700/50 rounded-md">
          <p className="text-cool-gray-200">{entry.description}</p>
          <p className="text-xs text-cool-gray-400 mt-1">
            {new Date(entry.timestamp).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
};

export default HistoryModalContent;
