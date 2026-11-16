import React from 'react';
import { Search, SlidersHorizontal, ChevronDown, X, RotateCcw } from 'lucide-react';

interface CatalogSearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  isFiltersOpen: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  onResetFilters?: () => void;
  filterButtonLabel?: string;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
}

export const CatalogSearchFilterBar: React.FC<CatalogSearchFilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  isFiltersOpen,
  onToggleFilters,
  activeFilterCount,
  onResetFilters,
  filterButtonLabel = 'Filters',
  rightSlot,
  children,
}) => {
  const hasAnyActive = activeFilterCount > 0 || searchValue.trim().length > 0;

  return (
    <div className="bg-cool-gray-850/65 border border-cool-gray-750 rounded-xl p-2.5 space-y-2.5 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-cool-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full h-9 pl-9 pr-8 bg-cool-gray-900 border border-cool-gray-750 rounded-lg text-xs text-white placeholder:text-cool-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-cool-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {rightSlot}
          {children && (
            <button
              type="button"
              onClick={onToggleFilters}
              aria-expanded={isFiltersOpen}
              className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                isFiltersOpen || activeFilterCount > 0
                  ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-200 hover:bg-cyan-950/70'
                  : 'bg-cool-gray-900 border-cool-gray-750 text-cool-gray-200 hover:text-white hover:bg-cool-gray-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{filterButtonLabel}</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-600 text-white text-[10px] font-bold font-mono leading-tight">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-cool-gray-400 transition-transform ${
                  isFiltersOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          )}
          {hasAnyActive && onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              title="Reset search and filters"
              className="h-9 px-2.5 rounded-lg border border-cool-gray-750 bg-cool-gray-900 hover:bg-cool-gray-800 text-cool-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {isFiltersOpen && children && (
        <div className="pt-2.5 border-t border-cool-gray-750/60 space-y-2.5 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
};
