
/**
 * @fileOverview Custom hook para gerenciar a seleção e o estado de hover dos equipamentos.
 *
 * Responsabilidades:
 * - Manter a lista de tags dos equipamentos selecionados (`selectedEquipmentTags`).
 * - Manter a tag do equipamento atualmente sob o cursor (`hoveredEquipmentTag`).
 * - Manipular cliques nos equipamentos para seleção única ou múltipla (com Ctrl/Cmd).
 * - Lidar com a definição programática de múltiplos equipamentos selecionados (e.g., ao focar em um sistema).
 * - Exibir notificações (toasts) relacionadas às ações de seleção.
 * - Integrar as ações de seleção com o sistema de histórico de comandos (`useCommandHistory`) para undo/redo.
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
 * @property {(tag: string | null, isMultiSelectModifierPressed: boolean) => void} handleEquipmentClick - Manipula o clique em um equipamento para seleção, integrando com o histórico de comandos.
 * @property {(tag: string | null) => void} handleSetHoveredEquipmentTag - Define o equipamento sob o cursor.
 * @property {(tagsToSelect: string[], operationDescription?: string) => void} selectTagsBatch - Seleciona um lote de equipamentos programaticamente, integrando com o histórico.
 */
export interface UseEquipmentSelectionManagerReturn {
  selectedEquipmentTags: string[];
  hoveredEquipmentTag: string | null;
  handleEquipmentClick: (tag: string | null, isMultiSelectModifierPressed: boolean) => void;
  handleSetHoveredEquipmentTag: (tag: string | null) => void;
  selectTagsBatch: (tagsToSelect: string[], operationDescription?: string) => void;
}

/**
 * Hook customizado para gerenciar a seleção e o estado de hover dos equipamentos.
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
   * Cria e executa um comando para o histórico de Undo/Redo.
   * @param {string | null} tag - A tag do equipamento clicado, ou null se o clique foi em espaço vazio.
   * @param {boolean} isMultiSelectModifierPressed - True se Ctrl/Cmd foi pressionado durante o clique.
   */
  const handleEquipmentClick = useCallback((tag: string | null, isMultiSelectModifierPressed: boolean) => {
    // console.log(`[SelectionManager] handleEquipmentClick: tag=${tag}, multi=${isMultiSelectModifierPressed}`);
    const oldSelection = [...selectedEquipmentTags];
    let newSelection: string[];
    let toastMessage = "";
    const equipmentName = tag ? (equipmentData.find(e => e.tag === tag)?.name || tag) : '';

    if (isMultiSelectModifierPressed) {
      // Lógica para seleção múltipla (adicionar/remover da seleção existente)
      if (tag) {
        if (oldSelection.includes(tag)) {
          newSelection = oldSelection.filter(t => t !== tag);
          toastMessage = `Equipamento ${equipmentName} removido da seleção.`;
        } else {
          newSelection = [...oldSelection, tag];
          toastMessage = `Equipamento ${equipmentName} adicionado à seleção. ${newSelection.length} itens selecionados.`;
        }
      } else {
        newSelection = oldSelection; // Clique em espaço vazio com Ctrl/Cmd não altera a seleção
      }
    } else {
      // Lógica para seleção única ou deseleção
      if (tag) {
        // Se o item clicado já é o único selecionado, deseleciona. Caso contrário, seleciona apenas ele.
        if (oldSelection.length === 1 && oldSelection[0] === tag) {
          newSelection = []; 
          toastMessage = "Seleção limpa.";
        } else {
          newSelection = [tag];
          toastMessage = `${equipmentName} selecionado.`;
        }
      } else {
        // Clique em espaço vazio sem Ctrl/Cmd limpa a seleção
        newSelection = []; 
        if (oldSelection.length > 0) { // Só mostra toast se havia algo selecionado antes
          toastMessage = "Seleção limpa.";
        }
      }
    }

    // Evita criar comando se a seleção não mudou
    const oldSelectionSorted = [...oldSelection].sort();
    const newSelectionSorted = [...newSelection].sort();

    if (JSON.stringify(oldSelectionSorted) === JSON.stringify(newSelectionSorted)) {
      // console.log("[SelectionManager] Selection unchanged, skipping command.");
      // Mesmo que a seleção não mude, o estado pode precisar ser atualizado se o toastMessage for relevante
      // (ex: clicando no mesmo item já selecionado).
      if (toastMessage && newSelection.length === 1 && oldSelection.length === 1 && oldSelection[0] === newSelection[0]) {
         // Cenário: clicou no mesmo item único já selecionado (sem Ctrl) - não limpa nem mostra toast de "limpo"
      } else if (toastMessage) {
        setSelectedEquipmentTags(newSelection); // Atualiza o estado para o caso de um toast que não altere a seleção de fato.
        // toast({ title: "Seleção", description: toastMessage }); // O toast será disparado pelo execute do comando
      }
      return;
    }
    
    const commandDescription = toastMessage || 
                               (newSelection.length > 0 ? `Selecionados ${newSelection.length} equipamento(s).` : "Seleção limpa.");

    const command: Command = {
      id: `select-equipment-${Date.now()}`,
      type: 'EQUIPMENT_SELECT',
      description: commandDescription,
      execute: () => {
        // console.log(`[SelectionManager Command] Execute: Setting selection to`, newSelection, `Desc: ${commandDescription}`);
        setSelectedEquipmentTags(newSelection);
        toast({ title: "Seleção", description: commandDescription });
      },
      undo: () => {
        // console.log(`[SelectionManager Command] Undo: Restoring selection to`, oldSelection);
        setSelectedEquipmentTags(oldSelection);
        toast({ title: "Seleção Desfeita", description: `Seleção anterior com ${oldSelection.length} itens restaurada.`});
      },
    };
    executeCommand(command);

  }, [selectedEquipmentTags, executeCommand, toast, equipmentData]);

  /**
   * Define diretamente a tag do equipamento sob o cursor.
   * Esta ação não é rastreada pelo histórico de comandos.
   * @param {string | null} tag A tag do equipamento, ou null se nenhum estiver sob o cursor.
   */
  const handleSetHoveredEquipmentTag = useCallback((tag: string | null) => {
    // console.log(`[SelectionManager] Setting hovered tag: ${tag}`);
    setHoveredEquipmentTag(tag);
  }, []);

  /**
   * Seleciona programaticamente um conjunto de tags de equipamento.
   * Usado, por exemplo, ao focar em um sistema.
   * Cria e executa um comando para o histórico de Undo/Redo.
   * @param {string[]} tagsToSelect - Array de tags de equipamento a serem selecionadas.
   * @param {string} [operationDescription] - Descrição opcional para o comando no histórico.
   */
  const selectTagsBatch = useCallback((tagsToSelect: string[], operationDescription?: string) => {
    const oldSelection = [...selectedEquipmentTags];
    const newSelection = [...tagsToSelect].sort(); // Garante consistência para comparação

    // Evita criar comando se a seleção não mudou
    if (JSON.stringify(oldSelection.sort()) === JSON.stringify(newSelection)) {
      // console.log("[SelectionManager] Batch selection unchanged, skipping command.");
      return;
    }

    const desc = operationDescription || `Selecionados ${newSelection.length} equipamentos em lote.`;
    const command: Command = {
      id: `batch-select-equipment-${Date.now()}`,
      type: 'EQUIPMENT_SELECT',
      description: desc,
      execute: () => {
        // console.log(`[SelectionManager Command] Execute Batch: Setting selection to`, newSelection, `Desc: ${desc}`);
        setSelectedEquipmentTags(newSelection);
        toast({ title: "Seleção em Lote", description: desc });
      },
      undo: () => {
        // console.log(`[SelectionManager Command] Undo Batch: Restoring selection to`, oldSelection);
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
