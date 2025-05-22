
/**
 * @fileoverview Custom hook para gerenciar a seleção e o estado de hover dos equipamentos.
 *
 * Este hook encapsula a lógica para:
 * - Manter a lista de tags dos equipamentos selecionados.
 * - Manter a tag do equipamento atualmente sob o cursor (hover).
 * - Manipular cliques nos equipamentos para seleção única ou múltipla (com Ctrl/Cmd).
 * - Lidar com a definição programática de múltiplos equipamentos selecionados (ex: para focar em um sistema).
 * - Exibir notificações (toasts) relacionadas às ações de seleção.
 * - Integrar as ações de seleção com o sistema de histórico de comandos (undo/redo).
 */
"use client";

import { useState, useCallback } from 'react';
import type { Command, Equipment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

/**
 * Props para o hook useEquipmentSelectionManager.
 * @interface UseEquipmentSelectionManagerProps
 * @property {Equipment[]} equipmentData - Lista completa de equipamentos, usada para buscar nomes para toasts.
 * @property {(command: Command) => void} executeCommand - Função para executar comandos e adicioná-los ao histórico.
 */
interface UseEquipmentSelectionManagerProps {
  equipmentData: Equipment[];
  executeCommand: (command: Command) => void;
}

/**
 * Retorno do hook useEquipmentSelectionManager.
 * @interface UseEquipmentSelectionManagerReturn
 * @property {string[]} selectedEquipmentTags - Array das tags dos equipamentos atualmente selecionados.
 * @property {string | null} hoveredEquipmentTag - Tag do equipamento atualmente sob o cursor, ou null.
 * @property {(tag: string | null, isMultiSelectModifierPressed: boolean) => void} handleEquipmentClick - Manipula o clique em um equipamento para seleção.
 * @property {(tag: string | null) => void} handleSetHoveredEquipmentTag - Define o equipamento sob o cursor.
 * @property {(tagsToSelect: string[], operationDescription?: string) => void} selectTagsBatch - Seleciona um lote de equipamentos programaticamente.
 */
interface UseEquipmentSelectionManagerReturn {
  selectedEquipmentTags: string[];
  hoveredEquipmentTag: string | null;
  handleEquipmentClick: (tag: string | null, isMultiSelectModifierPressed: boolean) => void;
  handleSetHoveredEquipmentTag: (tag: string | null) => void;
  selectTagsBatch: (tagsToSelect: string[], operationDescription?: string) => void;
}

/**
 * Hook para gerenciar a seleção e o estado de hover dos equipamentos.
 * @param {UseEquipmentSelectionManagerProps} props As props do hook.
 * @returns {UseEquipmentSelectionManagerReturn} O estado da seleção e as funções para manipulá-la.
 */
export function useEquipmentSelectionManager({
  equipmentData,
  executeCommand,
}: UseEquipmentSelectionManagerProps): UseEquipmentSelectionManagerReturn {
  const [selectedEquipmentTags, setSelectedEquipmentTags] = useState<string[]>([]);
  const [hoveredEquipmentTag, setHoveredEquipmentTag] = useState<string | null>(null);
  const { toast } = useToast();

  /**
   * Manipula o clique em um equipamento na cena 3D para seleção.
   * Gerencia seleção única, múltipla (com Ctrl/Cmd) e deseleção.
   * @param {string | null} tag - A tag do equipamento clicado, ou null se o clique foi em espaço vazio.
   * @param {boolean} isMultiSelectModifierPressed - True se Ctrl/Cmd foi pressionado durante o clique.
   */
  const handleEquipmentClick = useCallback((tag: string | null, isMultiSelectModifierPressed: boolean) => {
    const oldSelection = [...selectedEquipmentTags];
    let newSelection: string[];
    let toastMessage = "";
    const equipmentName = tag ? (equipmentData.find(e => e.tag === tag)?.name || tag) : '';

    if (isMultiSelectModifierPressed) {
      if (tag) {
        if (oldSelection.includes(tag)) {
          newSelection = oldSelection.filter(t => t !== tag);
          toastMessage = `Equipamento ${equipmentName} removido da seleção.`;
        } else {
          newSelection = [...oldSelection, tag];
          toastMessage = `Equipamento ${equipmentName} adicionado à seleção. ${newSelection.length} itens selecionados.`;
        }
      } else {
        newSelection = oldSelection; 
      }
    } else {
      if (tag) {
        if (oldSelection.length === 1 && oldSelection[0] === tag) {
          newSelection = []; 
          toastMessage = "Seleção limpa.";
        } else {
          newSelection = [tag];
          toastMessage = `${equipmentName} selecionado.`;
        }
      } else {
        newSelection = []; 
        if (oldSelection.length > 0) {
          toastMessage = "Seleção limpa.";
        }
      }
    }

    const oldSelectionSorted = [...oldSelection].sort();
    const newSelectionSorted = [...newSelection].sort();

    if (JSON.stringify(oldSelectionSorted) === JSON.stringify(newSelectionSorted) && !toastMessage) {
      if (newSelection.length === oldSelection.length) {
         setSelectedEquipmentTags(newSelection); 
         return;
      }
    }
    
    const command: Command = {
      id: `select-equipment-${Date.now()}`,
      type: 'EQUIPMENT_SELECT',
      description: toastMessage || `Seleção de equipamento atualizada. ${newSelection.length} item(s) selecionados.`,
      execute: () => {
        setSelectedEquipmentTags(newSelection);
        if (toastMessage) {
            toast({ title: "Seleção", description: toastMessage });
        } else if (newSelection.length === 1) {
            const item = equipmentData.find(e => e.tag === newSelection[0]);
            toast({ title: "Selecionado", description: `${item?.name || 'Equipamento'} selecionado.` });
        } else if (newSelection.length > 1) {
            toast({ title: "Seleção Atualizada", description: `${newSelection.length} itens selecionados.` });
        } else if (oldSelection.length > 0 && newSelection.length === 0) {
            toast({ title: "Seleção Limpa" });
        }
      },
      undo: () => {
        setSelectedEquipmentTags(oldSelection);
        toast({ title: "Seleção Desfeita", description: `${oldSelection.length} itens restaurados na seleção.`});
      },
    };
    executeCommand(command);

  }, [selectedEquipmentTags, executeCommand, toast, equipmentData]);

  /**
   * Define diretamente a tag do equipamento sob o cursor.
   * @param {string | null} tag A tag do equipamento, ou null.
   */
  const handleSetHoveredEquipmentTag = useCallback((tag: string | null) => {
    setHoveredEquipmentTag(tag);
  }, []);

  /**
   * Seleciona programaticamente um conjunto de tags de equipamento.
   * Usado, por exemplo, ao focar em um sistema.
   * @param {string[]} tagsToSelect - Array de tags de equipamento a serem selecionadas.
   * @param {string} [operationDescription] - Descrição opcional para o comando no histórico.
   */
  const selectTagsBatch = useCallback((tagsToSelect: string[], operationDescription?: string) => {
    const oldSelection = [...selectedEquipmentTags];
    const newSelection = [...tagsToSelect].sort(); 

    if (JSON.stringify(oldSelection.sort()) === JSON.stringify(newSelection)) {
      return;
    }

    const command: Command = {
      id: `batch-select-equipment-${Date.now()}`,
      type: 'EQUIPMENT_SELECT',
      description: operationDescription || `Selecionados ${newSelection.length} equipamentos.`,
      execute: () => {
        setSelectedEquipmentTags(newSelection);
        if (operationDescription) {
          toast({ title: "Seleção em Lote", description: operationDescription });
        }
      },
      undo: () => {
        setSelectedEquipmentTags(oldSelection);
        toast({ title: "Seleção em Lote Desfeita", description: `Seleção anterior com ${oldSelection.length} itens restaurada.` });
      },
    };
    executeCommand(command);
  }, [selectedEquipmentTags, executeCommand, toast]);


  return {
    selectedEquipmentTags,
    hoveredEquipmentTag,
    handleEquipmentClick,
    handleSetHoveredEquipmentTag,
    selectTagsBatch,
  };
}
