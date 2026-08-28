import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Container, Freezer } from '../types';
import { SearchIcon } from './icons';
import { getContainerIcon } from './ContainerIconsMap';

interface SearchableContainerSelectProps {
  containers: Container[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  freezers?: Freezer[];
}

export const SearchableContainerSelect: React.FC<SearchableContainerSelectProps> = ({
  containers,
  value,
  onChange,
  placeholder = "Search container by name...",
  freezers
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedContainer = useMemo(() => {
    return containers.find(c => c.id === value);
  }, [containers, value]);

  // Sync searchTerm when selected container changes
  useEffect(() => {
    if (selectedContainer) {
      setSearchTerm(selectedContainer.name);
    } else {
      setSearchTerm('');
    }
  }, [selectedContainer]);

  // Filter containers based on search term
  const filteredContainers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const selectedText = selectedContainer ? selectedContainer.name.toLowerCase().trim() : '';
    
    if (!term || term === selectedText) {
      return containers.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    }

    const searchWords = term.split(/\s+/).filter(Boolean);

    return containers
      .filter(c => {
        const nameLower = c.name.toLowerCase();
        // Match freezer location if freezers prop is provided
        let freezerMatch = false;
        if (freezers && c.freezerId) {
          const freezer = freezers.find(f => f.id === c.freezerId);
          if (freezer) {
            const freezerNameLower = freezer.name.toLowerCase();
            freezerMatch = searchWords.every(word => freezerNameLower.includes(word));
          }
        }
        
        // Match split-words against container name
        const containerNameMatch = searchWords.every(word => nameLower.includes(word));
        return containerNameMatch || freezerMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [containers, searchTerm, selectedContainer, freezers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (selectedContainer) {
          setSearchTerm(selectedContainer.name);
        } else {
          setSearchTerm('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedContainer]);

  const handleSelect = (containerId: string) => {
    onChange(containerId);
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
    const activeElement = document.activeElement as HTMLInputElement;
    if (activeElement && activeElement.select) {
      activeElement.select();
    }
  };

  return (
    <div className="relative flex-grow" ref={containerRef}>
      <div className="relative flex items-center">
        {selectedContainer && selectedContainer.imageUrl ? (
          <div className="absolute left-2 flex items-center z-10">
            <img 
              src={selectedContainer.imageUrl} 
              alt={selectedContainer.name} 
              className="w-6 h-6 rounded object-cover cursor-zoom-in hover:scale-110 active:scale-95 transition duration-200 border border-cool-gray-750 shadow-sm" 
              onClick={(e) => {
                e.stopPropagation();
                (window as any).__showImagePreview?.(selectedContainer.imageUrl, selectedContainer.name);
              }}
              title="Click to zoom in"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
            <SearchIcon className="h-4 w-4 text-cool-gray-400" />
          </div>
        )}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (!e.target.value) {
              onChange('');
            }
          }}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`w-full pr-8 py-2 bg-cool-gray-900 border border-cool-gray-750 text-cool-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs placeholder:text-cool-gray-400 ${
            selectedContainer && selectedContainer.imageUrl ? 'pl-10' : 'pl-9'
          }`}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              onChange('');
              setIsOpen(true);
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-cool-gray-400 hover:text-white text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-[150] mt-1 w-full rounded-md border border-cool-gray-750 bg-cool-gray-900 shadow-2xl max-h-48 overflow-y-auto">
          {filteredContainers.length === 0 ? (
            <div className="p-3 text-xs text-cool-gray-400 italic text-center">
              No matching containers found
            </div>
          ) : (
            <ul className="py-1 text-xs divide-y divide-cool-gray-800">
              {filteredContainers.map((c) => {
                const isCurrent = c.id === value;
                const Icon = getContainerIcon(c.icon || 'generic');

                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(c.id)}
                      className={`w-full text-left px-3 py-2 hover:bg-cool-gray-800 transition flex items-center justify-between ${
                        isCurrent ? 'bg-cyan-950/20 text-cyan-300 font-semibold' : 'text-cool-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {c.imageUrl ? (
                          <img 
                            src={c.imageUrl} 
                            alt={c.name} 
                            className="w-6 h-6 rounded object-cover flex-shrink-0 cursor-zoom-in hover:scale-110 active:scale-90 transition-transform duration-200" 
                            onClick={(e) => {
                              e.stopPropagation();
                              (window as any).__showImagePreview?.(c.imageUrl, c.name);
                            }}
                            title="Click to zoom in"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded bg-cool-gray-800 flex items-center justify-center flex-shrink-0 border border-cool-gray-700/60">
                            <Icon className="w-3.5 h-3.5 text-cyan-400 pointer-events-none" />
                          </div>
                        )}
                        <span className="truncate">{c.name}</span>
                        {freezers && (() => {
                          const freezer = freezers.find(f => f.id === c.freezerId);
                          return freezer ? (
                            <span className="text-[9px] text-cool-gray-400 bg-cool-gray-950 px-1 py-0.2 rounded font-medium ml-1.5 truncate">
                              {freezer.name}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
