
/**
 * @fileOverview Custom hook para gerenciar os dados dos equipamentos e suas modificações diretas.
 *
 * Responsabilidades:
 * - Manter o estado da lista de equipamentos (`equipmentData`), inicializada com dados padrão.
 * - Fornecer funções para modificar o estado operacional e o produto de um equipamento específico.
 * - Utilizar toasts para fornecer feedback ao usuário sobre as modificações realizadas.
 * - As modificações diretas nos dados dos equipamentos feitas através deste hook
 *   NÃO são gerenciadas pelo histórico de comandos (undo/redo), conforme RF008.
 */
"use client";

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
 * Hook customizado para gerenciar os dados dos equipamentos.
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
    const equip = equipmentData.find(e => e.tag === equipmentTag); // Encontra na lista antes da atualização para pegar o nome
    toast({ title: "Estado Atualizado", description: `Estado de ${equip?.name || 'Equipamento'} alterado para ${newState}.` });
  }, [equipmentData, toast]); // equipmentData como dependência para buscar o nome corretamente para o toast

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
    const equip = equipmentData.find(e => e.tag === equipmentTag); // Encontra na lista antes da atualização
    toast({ title: "Produto Atualizado", description: `Produto de ${equip?.name || 'Equipamento'} alterado para ${newProduct}.` });
  }, [equipmentData, toast]); // equipmentData como dependência para buscar o nome corretamente para o toast

  return {
    equipmentData,
    handleOperationalStateChange,
    handleProductChange,
  };
}
