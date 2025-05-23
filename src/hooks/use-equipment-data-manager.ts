
/**
 * @fileOverview Custom hook responsible for fetching, storing, and managing the equipment data used in the application.
 * This includes maintaining the state of the equipment list and providing functions to modify equipment properties.
 */

import { useState, useCallback } from 'react';
import type { Equipment } from '@/lib/types';
import { initialEquipment } from '@/core/data/initial-data';
import { useToast } from '@/hooks/use-toast';

/**
 * Retorno do hook useEquipmentDataManager.
 * @interface UseEquipmentDataManagerReturn
 * @property {Equipment[]} equipmentData - A lista atual de todos os equipamentos.
 * @property {(equipmentTag: string, newState: string) => void} handleOperationalStateChange - Modifica o estado operacional de um equipamento.
 * @property {(equipmentTag: string, newProduct: string) => void} handleProductChange - Modifica o produto de um equipamento.
 */
export interface UseEquipmentDataManagerReturn {
  equipmentData: Equipment[];
  handleOperationalStateChange: (equipmentTag: string, newState: string) => void;
  handleProductChange: (equipmentTag: string, newProduct: string) => void;
}

/**
 * Hook customizado para gerenciar os dados dos equipamentos (a "fonte da verdade" dos equipamentos).
 * Inicializa os dados com `initialEquipment` e fornece funções para modificar
 * propriedades como estado operacional e produto.
 * @returns {UseEquipmentDataManagerReturn} Um objeto contendo os dados dos equipamentos e funções para modificá-los.
 */
export function useEquipmentDataManager(): UseEquipmentDataManagerReturn {
  const [equipmentData, setEquipmentData] = useState<Equipment[]>(initialEquipment);
  const { toast } = useToast();

  /**
   * Manipula a alteração do estado operacional de um equipamento.
   * Atualiza `equipmentData` e exibe um toast de confirmação.
   * @param {string} equipmentTag - A tag do equipamento a ser modificado.
   * @param {string} newState - O novo estado operacional.
   */
  const handleOperationalStateChange = useCallback((equipmentTag: string, newState: string) => {
    setEquipmentData(prevData =>
      prevData.map(equip =>
        equip.tag === equipmentTag ? { ...equip, operationalState: newState } : equip
      )
    );
    const equip = equipmentData.find(e => e.tag === equipmentTag);
    toast({ title: "Estado Atualizado", description: `Estado de ${equip?.name || 'Equipamento'} alterado para ${newState}.` });
  }, [equipmentData, toast]);

  /**
   * Manipula a alteração do produto de um equipamento.
   * Atualiza `equipmentData` e exibe um toast de confirmação.
   * @param {string} equipmentTag - A tag do equipamento a ser modificado.
   * @param {string} newProduct - O novo produto.
   */
  const handleProductChange = useCallback((equipmentTag: string, newProduct: string) => {
    setEquipmentData(prevData =>
      prevData.map(equip =>
        equip.tag === equipmentTag ? { ...equip, product: newProduct } : equip
      )
    );
    const equip = equipmentData.find(e => e.tag === equipmentTag);
    toast({ title: "Produto Atualizado", description: `Produto de ${equip?.name || 'Equipamento'} alterado para ${newProduct}.` });
  }, [equipmentData, toast]);

  return {
    equipmentData,
    handleOperationalStateChange,
    handleProductChange,
  };
}

    