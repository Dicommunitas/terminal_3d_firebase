
/**
 * @fileOverview Custom hook para gerenciar os estados de filtragem e a lógica de filtragem de equipamentos.
 *
 * Responsabilidades:
 * - Manter os estados para o termo de busca textual (`searchTerm`).
 * - Manter os estados para os filtros de propriedades selecionadas (`selectedSistema`, `selectedArea`).
 * - Derivar as listas de opções únicas disponíveis para os filtros de Sistema e Área.
 * - Calcular a lista de equipamentos filtrados (`filteredEquipment`) com base nos critérios atuais,
 *   utilizando a função `getFilteredEquipment` do `equipment-filter.ts`.
 */
'use client';

import { useState, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { Equipment } from '@/lib/types';
import { getFilteredEquipment, type EquipmentFilterCriteria } from '@/core/logic/equipment-filter';

/**
 * Props para o hook useFilterManager.
 * @interface UseFilterManagerProps
 * @property {Equipment[]} allEquipment - A lista completa de todos os equipamentos para filtrar.
 */
interface UseFilterManagerProps {
  allEquipment: Equipment[];
}

/**
 * Retorno do hook useFilterManager.
 * @interface UseFilterManagerReturn
 * @property {string} searchTerm - O termo de busca textual atual.
 * @property {Dispatch<SetStateAction<string>>} setSearchTerm - Função para definir o termo de busca.
 * @property {string} selectedSistema - O sistema selecionado para filtro (ou "All").
 * @property {Dispatch<SetStateAction<string>>} setSelectedSistema - Função para definir o sistema selecionado.
 * @property {string} selectedArea - A área selecionada para filtro (ou "All").
 * @property {Dispatch<SetStateAction<string>>} setSelectedArea - Função para definir a área selecionada.
 * @property {string[]} availableSistemas - Lista de sistemas únicos disponíveis para seleção, incluindo "All".
 * @property {string[]} availableAreas - Lista de áreas únicas disponíveis para seleção, incluindo "All".
 * @property {Equipment[]} filteredEquipment - A lista de equipamentos após a aplicação dos filtros.
 */
export interface UseFilterManagerReturn {
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
 * Hook customizado para gerenciar a lógica de filtragem de equipamentos.
 * Encapsula os estados dos filtros, as listas de opções de filtro disponíveis e a lista
 * resultante de equipamentos filtrados.
 * @param {UseFilterManagerProps} props As propriedades para o hook, incluindo `allEquipment`.
 * @returns {UseFilterManagerReturn} O estado dos filtros, setters, opções de filtro e a lista filtrada.
 */
export function useFilterManager({ allEquipment }: UseFilterManagerProps): UseFilterManagerReturn {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSistema, setSelectedSistema] = useState('All');
  const [selectedArea, setSelectedArea] = useState('All');

  /** Lista de sistemas únicos disponíveis, ordenada e com "All" no início. */
  const availableSistemas = useMemo(() => {
    const sistemas = new Set<string>(['All']);
    allEquipment.forEach(equip => {
      if (equip.sistema) sistemas.add(equip.sistema);
    });
    return Array.from(sistemas).sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)));
  }, [allEquipment]);

  /** Lista de áreas únicas disponíveis, ordenada e com "All" no início. */
  const availableAreas = useMemo(() => {
    const areas = new Set<string>(['All']);
    allEquipment.forEach(equip => {
      if (equip.area) areas.add(equip.area);
    });
    return Array.from(areas).sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)));
  }, [allEquipment]);

  /**
   * Lista de equipamentos filtrada com base nos critérios atuais.
   * Utiliza a função `getFilteredEquipment` para aplicar a lógica de filtragem combinada.
   */
  const filteredEquipment = useMemo(() => {
    const criteria: EquipmentFilterCriteria = {
      searchTerm,
      selectedSistema,
      selectedArea,
    };
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

    