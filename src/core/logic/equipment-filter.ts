
import type { Equipment } from '@/lib/types';

export interface EquipmentFilterCriteria {
  searchTerm: string;
  selectedSistema: string;
  selectedArea: string;
}

export function getFilteredEquipment(
  allEquipment: Equipment[],
  criteria: EquipmentFilterCriteria
): Equipment[] {
  const { searchTerm, selectedSistema, selectedArea } = criteria;
  let itemsToFilter = allEquipment;

  if (selectedSistema !== 'All' && selectedSistema) {
    itemsToFilter = itemsToFilter.filter(equip => equip.sistema === selectedSistema);
  }

  if (selectedArea !== 'All' && selectedArea) {
    itemsToFilter = itemsToFilter.filter(equip => equip.area === selectedArea);
  }

  if (searchTerm.trim()) {
    const searchTermsArray = searchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
    itemsToFilter = itemsToFilter.filter(equip => {
      const name = equip.name.toLowerCase();
      const type = equip.type.toLowerCase();
      const tag = equip.tag.toLowerCase(); // Changed from id to tag

      return searchTermsArray.every(term =>
        name.includes(term) ||
        type.includes(term) ||
        tag.includes(term)
      );
    });
  }
  return itemsToFilter;
}
