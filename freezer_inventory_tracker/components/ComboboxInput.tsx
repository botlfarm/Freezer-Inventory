import React, { useState, useEffect, useRef, useMemo } from 'react';

interface ComboboxInputProps {
  value?: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export const ComboboxInput: React.FC<ComboboxInputProps> = ({
  value = '',
  onChange,
  options,
  placeholder = '',
  required = false,
  className = '',
  autoFocus = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on typed input
  const filteredOptions = useMemo(() => {
    const search = (value || '').trim().toLowerCase();
    if (!search) return options;
    return options.filter(option => 
      option.toLowerCase().includes(search)
    );
  }, [options, value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Reset highlighted index when filtered options or openness changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredOptions, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          e.preventDefault();
          onChange(filteredOptions[highlightedIndex]);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          onKeyDown={handleKeyDown}
          className={`${className} pr-10`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setIsOpen(!isOpen);
            inputRef.current?.focus();
          }}
          className="absolute right-0 top-0 bottom-0 px-3 text-cool-gray-400 hover:text-white transition flex items-center justify-center cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-[100] mt-1 max-h-60 overflow-y-auto bg-cool-gray-750 border border-cool-gray-650 rounded-md shadow-2xl focus:outline-none">
          {filteredOptions.length > 0 ? (
            <ul className="py-1 text-sm text-cool-gray-200 divide-y divide-cool-gray-700/30">
              {filteredOptions.map((option, index) => {
                const isSelected = value.trim().toLowerCase() === option.trim().toLowerCase();
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={option}
                    onClick={() => {
                      onChange(option);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-3 py-2.5 cursor-pointer flex items-center justify-between text-xs sm:text-sm transition duration-150 ${
                      isHighlighted 
                        ? 'bg-cyan-600/20 text-white font-semibold' 
                        : isSelected 
                          ? 'bg-cyan-955/30 text-cyan-300 font-semibold' 
                          : 'hover:bg-cool-gray-700'
                    }`}
                  >
                    <span>{option}</span>
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-cyan-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-3 py-3 text-xs text-cool-gray-400 italic text-center">
              No matching suggestions. You can keep typing to create "{value}" custom.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
