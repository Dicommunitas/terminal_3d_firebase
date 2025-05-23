
/**
 * This hook manages the state and logic for selecting equipment within the 3D scene.
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
 * Encapsula a lógica de seleção única/múltipla, hover, seleção em lote e integração com o histórico.
 *
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
    console.log(`[useEquipmentSelectionManager] handleEquipmentClick called with tag: ${tag}, multiSelect: ${isMultiSelectModifierPressed}`);
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
        // Ctrl/Cmd + click em espaço vazio não faz nada na seleção
        newSelection = oldSelection;
        // console.log("[useEquipmentSelectionManager] Ctrl/Cmd + click on empty space, no change to selection.");
        // return; // Poderia retornar aqui para evitar a criação de comando desnecessário
      }
    } else { // Clique simples
      if (tag) { // Clique em um equipamento
        if (oldSelection.length === 1 && oldSelection[0] === tag && !isMultiSelectModifierPressed) {
          // Clicar no mesmo item já selecionado (sem Ctrl/Cmd) não deseleciona.
          // Para deselecionar, o usuário precisa clicar em espaço vazio.
          // Ou, se quisermos que deselecione, a lógica seria: newSelection = []; toastMessage = "Seleção limpa.";
          newSelection = oldSelection; // Mantém a seleção
          // console.log("[useEquipmentSelectionManager] Clicked same selected item, no change.");
          // return; // Se não houver mudança, podemos retornar
        } else {
          newSelection = [tag];
          toastMessage = `${equipmentName} selecionado.`;
        }
      } else { // Clique em espaço vazio
        newSelection = [];
        if (oldSelection.length > 0) { // Só mostra toast se havia algo selecionado
          toastMessage = "Seleção limpa.";
        }
      }
    }
    
    console.log("[useEquipmentSelectionManager] Old selection:", oldSelection, "New selection:", newSelection);

    // Verifica se houve de fato uma mudança na seleção
    const oldSelectionSortedJSON = JSON.stringify([...oldSelection].sort());
    const newSelectionSortedJSON = JSON.stringify([...newSelection].sort());

    if (oldSelectionSortedJSON === newSelectionSortedJSON) {
      console.log("[useEquipmentSelectionManager] No actual change in selection, skipping command.");
      // Mesmo que não haja mudança "lógica", o estado pode precisar ser refletido se houve um clique
      // que resultou no mesmo estado (ex: clicar em item já selecionado).
      // Se o toastMessage foi definido, ainda pode ser útil, mas o comando de histórico não é necessário.
      if (toastMessage && !(newSelection.length === 0 && oldSelection.length === 0)) {
         //  toast({ title: "Seleção", description: toastMessage }); // Considerar se o toast é necessário sem comando
      }
      // Importante: se a newSelection for diferente de selectedEquipmentTags,
      // mesmo que o JSON ordenado seja igual (caso raro, mas possível se a ordem mudar mas os itens não),
      // precisamos chamar setSelectedEquipmentTags.
      // No entanto, a lógica atual já garante que isso não aconteça se os arrays são idênticos.
      // A principal razão para pular o comando é se a seleção é verdadeiramente idêntica.
      if(selectedEquipmentTags !== newSelection && JSON.stringify(selectedEquipmentTags.sort()) !== newSelectionSortedJSON){
         // Isso é um caso de borda, mas para garantir que a UI reflita, mesmo sem comando:
         // setSelectedEquipmentTags(newSelection); // Isso seria sem histórico.
         // É melhor deixar o comando lidar com isso se houver uma mudança real.
      }
      return;
    }


    const commandDescription = toastMessage ||
                               (newSelection.length > 0 ? `Selecionados ${newSelection.length} equipamento(s).` : (oldSelection.length > 0 ? "Seleção limpa." : "Nenhuma seleção."));
    
    console.log("[useEquipmentSelectionManager] Creating command with description:", commandDescription);

    const command: Command = {
      id: `select-equipment-${Date.now()}`,
      type: 'EQUIPMENT_SELECT',
      description: commandDescription,
      execute: () => {
        console.log("[useEquipmentSelectionManager Command] Executing selection change to:", newSelection);
        setSelectedEquipmentTags(newSelection);
        if(commandDescription !== "Nenhuma seleção.") { // Evita toast se nada foi selecionado e nada estava selecionado
            toast({ title: "Seleção", description: commandDescription });
        }
      },
      undo: () => {
        console.log("[useEquipmentSelectionManager Command] Undoing selection change to:", oldSelection);
        setSelectedEquipmentTags(oldSelection);
        const undoDescription = oldSelection.length > 0 ? `Seleção anterior com ${oldSelection.length} itens restaurada.` : "Histórico de seleção limpo.";
        toast({ title: "Seleção Desfeita", description: undoDescription });
      },
    };
    executeCommand(command);

  }, [selectedEquipmentTags, equipmentData, executeCommand, toast]);

  /**
   * Define diretamente a tag do equipamento sob o cursor.
   * @param {string | null} tag A tag do equipamento, ou null se nenhum estiver sob o cursor.
   */
  const handleSetHoveredEquipmentTag = useCallback((tag: string | null) => {
    // console.log(`[useEquipmentSelectionManager] handleSetHoveredEquipmentTag called with tag: ${tag}`);
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
    console.log(`[useEquipmentSelectionManager] selectTagsBatch called with tags:`, tagsToSelect);
    const oldSelection = [...selectedEquipmentTags];
    // Garantir que não haja duplicatas e ordenar para comparação consistente
    const newSelection = [...new Set(tagsToSelect)].sort();

    if (JSON.stringify(oldSelection.sort()) === JSON.stringify(newSelection)) {
      console.log("[useEquipmentSelectionManager] selectTagsBatch: No actual change in selection, skipping command.");
      return;
    }

    const desc = operationDescription || `Selecionados ${newSelection.length} equipamentos em lote.`;
    console.log("[useEquipmentSelectionManager] selectTagsBatch: Creating command with description:", desc);

    const command: Command = {
      id: `batch-select-equipment-${Date.now()}`,
      type: 'EQUIPMENT_SELECT',
      description: desc,
      execute: () => {
        console.log("[useEquipmentSelectionManager Command] Executing batch selection change to:", newSelection);
        setSelectedEquipmentTags(newSelection);
        toast({ title: "Seleção em Lote", description: desc });
      },
      undo: () => {
        console.log("[useEquipmentSelectionManager Command] Undoing batch selection change to:", oldSelection);
        setSelectedEquipmentTags(oldSelection);
        const undoDescription = `Seleção em lote anterior com ${oldSelection.length} itens restaurada.`;
        toast({ title: "Seleção em Lote Desfeita", description: undoDescription });
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
