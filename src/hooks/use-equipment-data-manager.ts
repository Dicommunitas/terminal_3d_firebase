
/**
 * @fileOverview Custom hook para gerenciar os dados dos equipamentos e suas modificações diretas.
 *
 * Responsabilidades:
 * - Manter o estado da lista de equipamentos (`equipmentData`).
 * - Fornecer funções para modificar o estado operacional e o produto de um equipamento.
 * - Utilizar toasts para fornecer feedback sobre as modificações.
 */
"use client";

import { useState, useCallback } from 'react';
import type { Equipment } from '@/lib/types';
import { initialEquipment } from '@/core/data/initial-data'; // Importando os dados iniciais
import { useToast } from '@/hooks/use-toast';

/**
 * Props para o hook useEquipmentDataManager.
 * Atualmente não são necessárias props, pois os dados iniciais são importados diretamente.
 */
interface UseEquipmentDataManagerProps {
  // Poderia receber initialEquipment como prop se quiséssemos mais flexibilidade
}

/**
 * Retorno do hook useEquipmentDataManager.
 */
interface UseEquipmentDataManagerReturn {
  equipmentData: Equipment[];
  handleOperationalStateChange: (equipmentTag: string, newState: string) => void;
  handleProductChange: (equipmentTag: string, newProduct: string) => void;
}

/**
 * Hook para gerenciar os dados dos equipamentos.
 * @returns Um objeto contendo os dados dos equipamentos e funções para modificá-los.
 */
export function useEquipmentDataManager({}: UseEquipmentDataManagerProps = {}): UseEquipmentDataManagerReturn {
  const [equipmentData, setEquipmentData] = useState<Equipment[]>(initialEquipment);
  const { toast } = useToast();

  /**
   * Manipula a alteração do estado operacional de um equipamento.
   * Esta alteração é direta e não passa pelo histórico de comandos.
   * @param equipmentTag A tag do equipamento.
   * @param newState O novo estado operacional.
   */
  const handleOperationalStateChange = useCallback((equipmentTag: string, newState: string) => {
    setEquipmentData(prevData =>
      prevData.map(equip =>
        equip.tag === equipmentTag ? { ...equip, operationalState: newState } : equip
      )
    );
    const equip = equipmentData.find(e => e.tag === equipmentTag);
    toast({ title: "Estado Atualizado", description: `Estado de ${equip?.name || 'Equipamento'} alterado para ${newState}.` });
  }, [equipmentData, toast]); // Adicionado equipmentData à dependência

  /**
   * Manipula a alteração do produto de um equipamento.
   * Esta alteração é direta e não passa pelo histórico de comandos.
   * @param equipmentTag A tag do equipamento.
   * @param newProduct O novo produto.
   */
  const handleProductChange = useCallback((equipmentTag: string, newProduct: string) => {
    setEquipmentData(prevData =>
      prevData.map(equip =>
        equip.tag === equipmentTag ? { ...equip, product: newProduct } : equip
      )
    );
    const equip = equipmentData.find(e => e.tag === equipmentTag);
    toast({ title: "Produto Atualizado", description: `Produto de ${equip?.name || 'Equipamento'} alterado para ${newProduct}.` });
  }, [equipmentData, toast]); // Adicionado equipmentData à dependência

  return {
    equipmentData,
    handleOperationalStateChange,
    handleProductChange,
  };
}
