
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

interface UseEquipmentSelectionManagerProps {
  equipmentData: Equipment[];
  executeCommand: (command: Command) => void;
}

interface UseEquipmentSelectionManagerReturn {
  selectedEquipmentTags: string[];
  hoveredEquipmentTag: string | null;
  handleEquipmentClick: (tag: string | null, isMultiSelectModifierPressed: boolean) => void;
  handleSetHoveredEquipmentTag: (tag: string | null) => void;
  selectTagsBatch: (tagsToSelect: string[], operationDescription?: string) => void;
}

export function useEquipmentSelectionManager({
  equipmentData,
  executeCommand,
}: UseEquipmentSelectionManagerProps): UseEquipmentSelectionManagerReturn {
  const [selectedEquipmentTags, setSelectedEquipmentTags] = useState<string[]>([]);
  const [hoveredEquipmentTag, setHoveredEquipmentTag] = useState<string | null>(null);
  const { toast } = useToast();

  /**
   * Manipula o clique em um equipamento na cena 3D para seleção.
   * @param equipmentTag A tag do equipamento clicado, ou null se o clique foi em espaço vazio.
   * @param isMultiSelectModifierPressed True se Ctrl/Cmd foi pressionado durante o clique.
   */
  const handleEquipmentClick = useCallback((equipmentTag: string | null, isMultiSelectModifierPressed: boolean) => {
    const oldSelection = [...selectedEquipmentTags];
    let newSelection: string[];
    let toastMessage = "";

    if (isMultiSelectModifierPressed) {
      if (equipmentTag) {
        if (oldSelection.includes(equipmentTag)) {
          newSelection = oldSelection.filter(tag => tag !== equipmentTag);
          toastMessage = `Equipamento ${equipmentData.find(e => e.tag === equipmentTag)?.name || equipmentTag} removido da seleção.`;
        } else {
          newSelection = [...oldSelection, equipmentTag];
          toastMessage = `Equipamento ${equipmentData.find(e => e.tag === equipmentTag)?.name || equipmentTag} adicionado à seleção. ${newSelection.length} itens selecionados.`;
        }
      } else {
        newSelection = oldSelection; // Nenhuma mudança se Ctrl+clique no vazio
      }
    } else {
      if (equipmentTag) {
        if (oldSelection.length === 1 && oldSelection[0] === equipmentTag) {
          newSelection = []; // Deseleciona se clicar no mesmo item já selecionado
          toastMessage = "Seleção limpa.";
        } else {
          newSelection = [equipmentTag]; // Seleção única
          toastMessage = `${equipmentData.find(e => e.tag === equipmentTag)?.name || 'Equipamento'} selecionado.`;
        }
      } else {
        newSelection = []; // Limpa seleção se clicar no vazio
        if (oldSelection.length > 0) {
          toastMessage = "Seleção limpa.";
        }
      }
    }

    const oldSelectionSorted = [...oldSelection].sort();
    const newSelectionSorted = [...newSelection].sort();

    if (JSON.stringify(oldSelectionSorted) === JSON.stringify(newSelectionSorted) && !toastMessage) {
      // Se a seleção não mudou e não há mensagem específica, não faz nada.
      // Isso pode acontecer se ctrl+clique no vazio não mudar a seleção.
      // Se a seleção realmente não mudou, podemos apenas atualizar o estado local, se necessário.
      // No entanto, para manter a consistência com o command pattern, geralmente queremos um comando
      // se a intenção era mudar, mesmo que o resultado seja o mesmo.
      // Mas para cliques que não resultam em mudança de estado nem mensagem, podemos pular o comando.
      if (newSelection.length === oldSelection.length) { // Verificação simples
         setSelectedEquipmentTags(newSelection); // Atualiza o estado local se necessário
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
        // Poderia ter um toast para undo/redo também, mas mantendo simples por agora.
        toast({ title: "Seleção Desfeita", description: `${oldSelection.length} itens restaurados na seleção.`});
      },
    };
    executeCommand(command);

  }, [selectedEquipmentTags, executeCommand, toast, equipmentData]);

  /**
   * Define diretamente a tag do equipamento sob o cursor.
   * @param tag A tag do equipamento, ou null.
   */
  const handleSetHoveredEquipmentTag = useCallback((tag: string | null) => {
    setHoveredEquipmentTag(tag);
  }, []);

  /**
   * Seleciona programaticamente um conjunto de tags de equipamento.
   * Usado, por exemplo, ao focar em um sistema.
   * @param tagsToSelect Array de tags de equipamento a serem selecionadas.
   * @param operationDescription Descrição opcional para o comando no histórico.
   */
  const selectTagsBatch = useCallback((tagsToSelect: string[], operationDescription?: string) => {
    const oldSelection = [...selectedEquipmentTags];
    const newSelection = [...tagsToSelect].sort(); // Garante uma ordem consistente para comparação

    if (JSON.stringify(oldSelection.sort()) === JSON.stringify(newSelection)) {
      // Se a seleção não mudou, não executa o comando.
      // Pode ser útil atualizar o estado local se houver alguma dessincronização, mas
      // a ideia é que o comando só seja executado se houver uma mudança real.
      // setSelectedEquipmentTags(newSelection); // Opcional: Forçar atualização se necessário
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
