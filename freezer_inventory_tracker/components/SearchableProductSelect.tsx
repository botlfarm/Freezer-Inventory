import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product } from '../types';
import { SearchIcon } from './icons';

interface SearchableProductSelectProps {
  products: Product[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  includeArchived?: boolean;
}

export const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({
  products,
  value,
  onChange,
  placeholder = "Search product by name or category...",
  autoFocus = false,
  includeArchived = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const baseProducts = useMemo(() => {
    if (includeArchived) return products;
    return products.filter(p => !p.isArchived || p.id === value);
  }, [products, includeArchived, value]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === value);
  }, [products, value]);

  // Sync searchTerm when selected product changes or on initialization
  useEffect(() => {
    if (selectedProduct) {
      setSearchTerm(`${selectedProduct.name}${selectedProduct.isArchived ? ' [Archived]' : ''} (${selectedProduct.primaryCategory} > ${selectedProduct.subCategory})`);
    } else {
      setSearchTerm('');
    }
  }, [selectedProduct]);

  // Filter products based on search term
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    
    // If the search term matches selected product's text description,
    // show ALL base products when they click to open.
    const selectedText = selectedProduct
      ? `${selectedProduct.name}${selectedProduct.isArchived ? ' [Archived]' : ''} (${selectedProduct.primaryCategory} > ${selectedProduct.subCategory})`.toLowerCase().trim()
      : '';
      
    if (!term || term === selectedText) {
      return [...baseProducts].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    }

    const searchWords = term.split(/\s+/).filter(Boolean);

    return baseProducts
      .filter(p => {
        const nameLower = p.name.toLowerCase();
        const categoryLower = p.primaryCategory.toLowerCase();
        const subCategoryLower = p.subCategory.toLowerCase();
        
        return searchWords.every(word => 
          nameLower.includes(word) || 
          categoryLower.includes(word) || 
          subCategoryLower.includes(word) ||
          (p.productNumbers || []).some(n => n.toLowerCase().includes(word))
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [baseProducts, searchTerm, selectedProduct]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Reset search term back to selected product name on blur/close
        if (selectedProduct) {
          setSearchTerm(`${selectedProduct.name} (${selectedProduct.primaryCategory} > ${selectedProduct.subCategory})`);
        } else {
          setSearchTerm('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedProduct]);

  const handleSelect = (productId: string) => {
    onChange(productId);
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
    // Select all text in the search input on focus for easy typing
    const activeElement = document.activeElement as HTMLInputElement;
    if (activeElement && activeElement.select) {
      activeElement.select();
    }
  };

  return (
    <div className="relative flex-grow" ref={containerRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="h-4 w-4 text-cool-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (!e.target.value) {
              onChange(''); // clear value if input cleared
            }
          }}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 bg-cool-gray-700 border border-cool-gray-600 text-cool-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm placeholder:text-cool-gray-400"
          autoFocus={autoFocus}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              onChange('');
              setIsOpen(true);
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-cool-gray-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-[150] mt-1 w-full rounded-md border border-cool-gray-750 bg-cool-gray-900 shadow-2xl max-h-60 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="p-3 text-xs text-cool-gray-450 italic text-center">
              No matching products found
            </div>
          ) : (
            <ul className="py-1 text-sm divide-y divide-cool-gray-800">
              {filteredProducts.map((p) => {
                const isCurrent = p.id === value;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(p.id)}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-cool-gray-750 transition flex flex-col gap-0.5 ${
                        isCurrent ? 'bg-cyan-950/30 text-cyan-300 font-semibold border-l-2 border-cyan-500' : 'text-cool-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          <span className="font-bold text-xs sm:text-sm truncate">{p.name}</span>
                          {p.isArchived && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 shrink-0">
                              Archived
                            </span>
                          )}
                        </div>
                        {p.productNumbers && p.productNumbers.length > 0 && (
                          <span className="text-[10px] text-cool-gray-400 font-mono bg-cool-gray-750 border border-cool-gray-700 px-1.5 py-0.5 rounded shadow-xs shrink-0 whitespace-nowrap">
                            #{p.productNumbers.join(', #')}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-cool-gray-400 uppercase tracking-wider">
                        {p.primaryCategory} &gt; {p.subCategory}
                      </span>
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
