import React, { useMemo } from 'react';
import { SpeciesPrimal } from '../types';
import { buildSpeciesPrimalIndex, UNASSIGNED_PRIMAL_ID } from '../utils/speciesPrimals';

export const BULK_PRIMAL_NO_CHANGE = '__no_change__';
export const BULK_PRIMAL_CLEAR = '__clear__';

export interface PrimalSelectProps {
  speciesPrimals?: SpeciesPrimal[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  /** Optional species ID to restrict options to a single species */
  speciesFilterId?: string;
  /** In standard mode: include a blank/unassigned option at the top (default true) */
  includeEmptyOption?: boolean;
  emptyOptionLabel?: string;
  emptyOptionValue?: string;
  /** In filter mode: include an explicit "Unassigned" option (value = UNASSIGNED_PRIMAL_ID) */
  includeUnassignedFilterOption?: boolean;
  unassignedFilterLabel?: string;
  /** In bulk edit mode: offers Keep Unchanged / Clear Primal / specific primals */
  bulkMode?: boolean;
  ariaLabel?: string;
}

export const PrimalSelect: React.FC<PrimalSelectProps> = ({
  speciesPrimals,
  value,
  onChange,
  id,
  className = '',
  disabled = false,
  speciesFilterId,
  includeEmptyOption = true,
  emptyOptionLabel = 'No Primal Cut',
  emptyOptionValue = '',
  includeUnassignedFilterOption = false,
  unassignedFilterLabel = 'Unassigned (No Primal)',
  bulkMode = false,
  ariaLabel = 'Select primal cut',
}) => {
  const index = useMemo(() => buildSpeciesPrimalIndex(speciesPrimals), [speciesPrimals]);

  const groups = useMemo(() => {
    const speciesList = speciesFilterId
      ? index.speciesList.filter((s) => s.id === speciesFilterId)
      : index.speciesList;
    return speciesList
      .map((sp) => ({
        species: sp,
        primals: index.primalsBySpeciesId.get(sp.id) || [],
      }))
      .filter((g) => g.primals.length > 0);
  }, [index, speciesFilterId]);

  const hasAnyPrimals = groups.length > 0;

  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ||
        'w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50'
      }
    >
      {bulkMode ? (
        <>
          <option value={BULK_PRIMAL_NO_CHANGE}>Keep Existing Primal</option>
          <option value={BULK_PRIMAL_CLEAR}>Clear Primal (Unassigned)</option>
        </>
      ) : (
        <>
          {includeEmptyOption && (
            <option value={emptyOptionValue}>
              {hasAnyPrimals ? emptyOptionLabel : `${emptyOptionLabel} (Add primals in Catalog)`}
            </option>
          )}
          {includeUnassignedFilterOption && (
            <option value={UNASSIGNED_PRIMAL_ID}>{unassignedFilterLabel}</option>
          )}
        </>
      )}

      {groups.map(({ species, primals }) => (
        <optgroup
          key={species.id}
          label={species.icon ? `${species.icon} ${species.name}` : species.name}
        >
          {primals.map((primal) => (
            <option key={primal.id} value={primal.id}>
              {speciesFilterId ? primal.name : `${species.name} · ${primal.name}`}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

export interface SpeciesPrimalFilterPairProps {
  speciesPrimals?: SpeciesPrimal[];
  selectedSpeciesId: string;
  selectedPrimalId: string;
  onSpeciesChange: (speciesId: string) => void;
  onPrimalChange: (primalId: string) => void;
  compact?: boolean;
}

export const SpeciesPrimalFilterPair: React.FC<SpeciesPrimalFilterPairProps> = ({
  speciesPrimals,
  selectedSpeciesId,
  selectedPrimalId,
  onSpeciesChange,
  onPrimalChange,
  compact = false,
}) => {
  const index = useMemo(() => buildSpeciesPrimalIndex(speciesPrimals), [speciesPrimals]);

  if (index.speciesList.length === 0 && index.primalList.length === 0) {
    return null;
  }

  const selectClass = compact
    ? 'bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-cool-gray-100 focus:outline-none focus:border-cyan-500 cursor-pointer'
    : 'bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-sm text-cool-gray-100 focus:outline-none focus:border-cyan-500 cursor-pointer';

  const handleSpeciesChange = (nextSpeciesId: string) => {
    onSpeciesChange(nextSpeciesId);
    if (
      nextSpeciesId &&
      selectedPrimalId &&
      selectedPrimalId !== UNASSIGNED_PRIMAL_ID
    ) {
      const primal = index.primalById.get(selectedPrimalId);
      if (primal && primal.parentSpeciesId !== nextSpeciesId) {
        onPrimalChange('');
      }
    }
  };

  return (
    <>
      {index.speciesList.length > 0 && (
        <select
          aria-label="Filter by species"
          value={selectedSpeciesId}
          onChange={(e) => handleSpeciesChange(e.target.value)}
          className={selectClass}
        >
          <option value="">All Species</option>
          {index.speciesList.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.icon ? `${sp.icon} ${sp.name}` : sp.name}
            </option>
          ))}
        </select>
      )}
      <PrimalSelect
        speciesPrimals={speciesPrimals}
        speciesFilterId={selectedSpeciesId || undefined}
        value={selectedPrimalId}
        onChange={onPrimalChange}
        includeEmptyOption
        emptyOptionLabel="All Primals"
        emptyOptionValue=""
        includeUnassignedFilterOption
        unassignedFilterLabel="Unassigned Primal"
        className={selectClass}
        ariaLabel="Filter by primal cut"
      />
    </>
  );
};
