
/**
 * @fileoverview Utilitário para filtrar a lista de equipamentos com base em múltiplos critérios.
 *
 * Responsabilidades:
 * - Definir a interface `EquipmentFilterCriteria` para os critérios de filtro.
 * - Exportar a função `getFilteredEquipment` que aplica os filtros de Sistema, Área, e
 *   um termo de busca textual (verificando nome, tipo e tag do equipamento) de forma combinada.
 *
 * Exporta:
 * - `EquipmentFilterCriteria`: Interface para os critérios de filtro.
 * - `getFilteredEquipment`: Função para filtrar equipamentos.
 */
import type { Equipment } from '@/lib/types';

/**
 * Define os critérios de filtro aplicáveis aos equipamentos.
 * @interface EquipmentFilterCriteria
 * @property {string} searchTerm - Termo de busca textual. Múltiplos termos separados por espaço são tratados com lógica "E".
 * @property {string} selectedSistema - Sistema selecionado para filtro (ou "All" para não filtrar por sistema).
 * @property {string} selectedArea - Área selecionada para filtro (ou "All" para não filtrar por área).
 */
export interface EquipmentFilterCriteria {
  searchTerm: string;
  selectedSistema: string;
  selectedArea: string;
}

/**
 * Filtra uma lista de equipamentos com base nos critérios fornecidos.
 * A filtragem ocorre na seguinte ordem: Sistema, depois Área, depois Termo de Busca.
 * A filtragem textual por `searchTerm` considera nome, tipo e tag, com lógica "E" para múltiplos termos.
 * Os filtros de sistema e área são aplicados se não forem "All".
 *
 * @param {Equipment[]} allEquipment - A lista completa de equipamentos a serem filtrados.
 * @param {EquipmentFilterCriteria} criteria - Os critérios de filtro a serem aplicados.
 * @returns {Equipment[]} A lista de equipamentos filtrada.
 */
export function getFilteredEquipment(
  allEquipment: Equipment[],
  criteria: EquipmentFilterCriteria
): Equipment[] {
  const { searchTerm, selectedSistema, selectedArea } = criteria;
  let itemsToFilter = Array.isArray(allEquipment) ? allEquipment : [];

  // Filtra por Sistema
  if (selectedSistema !== 'All' && selectedSistema) {
    itemsToFilter = itemsToFilter.filter(equip => equip.sistema === selectedSistema);
  }

  // Filtra por Área
  if (selectedArea !== 'All' && selectedArea) {
    itemsToFilter = itemsToFilter.filter(equip => equip.area === selectedArea);
  }

  // Filtra por termo de busca (nome, tipo, tag)
  if (searchTerm.trim()) {
    const searchTermsArray = searchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
    itemsToFilter = itemsToFilter.filter(equip => {
      const name = equip.name.toLowerCase();
      const type = equip.type.toLowerCase();
      const tag = equip.tag.toLowerCase(); // Usando 'tag' conforme atualizado

      return searchTermsArray.every(term =>
        name.includes(term) ||
        type.includes(term) ||
        tag.includes(term)
      );
    });
  }
  return itemsToFilter;
}

    