
'use client';

import { useState, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { Equipment } from '@/lib/types';
import { getFilteredEquipment, type EquipmentFilterCriteria } from '@/core/logic/equipment-filter';

/**
 * @fileOverview Custom hook to manage filtering states and logic for equipment.
 *
 * Encapsulates the searchTerm, selectedSistema, and selectedArea states,
 * derives available options for filters, and computes the filtered equipment list.
 */

interface UseFilterManagerProps {
  allEquipment: Equipment[];
}

interface UseFilterManagerReturn {
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  selectedSistema: string;
  setSelectedSistema: Dispatch<SetStateAction<string>>;
  selectedArea: string;
  setSelectedArea: Dispatch<SetStateAction<string>>;
  availableSistemas: string[];
  availableAreas: string[];
  filteredEquipment: Equipment[];
}

/**
 * Custom hook for managing equipment filtering.
 * @param {UseFilterManagerProps} props - The properties for the hook.
 * @param {Equipment[]} props.allEquipment - The complete list of equipment to be filtered.
 * @returns {UseFilterManagerReturn} The filter states, setters, available options, and the filtered list.
 */
export function useFilterManager({ allEquipment }: UseFilterManagerProps): UseFilterManagerReturn {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSistema, setSelectedSistema] = useState('All');
  const [selectedArea, setSelectedArea] = useState('All');

  const availableSistemas = useMemo(() => {
    const sistemas = new Set<string>(['All']);
    allEquipment.forEach(equip => {
      if (equip.sistema) sistemas.add(equip.sistema);
    });
    return Array.from(sistemas).sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)));
  }, [allEquipment]);

  const availableAreas = useMemo(() => {
    const areas = new Set<string>(['All']);
    allEquipment.forEach(equip => {
      if (equip.area) areas.add(equip.area);
    });
    return Array.from(areas).sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)));
  }, [allEquipment]);

  const filteredEquipment = useMemo(() => {
    const criteria: EquipmentFilterCriteria = {
      searchTerm,
      selectedSistema,
      selectedArea,
    };
    // Ensure allEquipment is an array before passing it to getFilteredEquipment
    return getFilteredEquipment(Array.isArray(allEquipment) ? allEquipment : [], criteria);
  }, [allEquipment, searchTerm, selectedSistema, selectedArea]);

  return {
    searchTerm,
    setSearchTerm,
    selectedSistema,
    setSelectedSistema,
    selectedArea,
    setSelectedArea,
    availableSistemas,
    availableAreas,
    filteredEquipment,
  };
}
