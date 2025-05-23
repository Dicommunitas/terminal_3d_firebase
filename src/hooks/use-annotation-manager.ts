
/**
 * @fileOverview Custom hook to manage the state and logic for text annotations within the 3D scene.
 * Includes functionality for adding, removing, and updating annotations associated with equipment.
 */


/**
 * @fileOverview Custom hook para gerenciar o estado e a lógica das anotações dos equipamentos.
 *
 * Responsabilidades:
 * - Manter a lista de anotações (`Annotation[]`).
 * - Controlar o estado de abertura/fechamento do diálogo de anotação.
 * - Rastrear o equipamento alvo para anotação e a anotação que está sendo editada.
 * - Fornecer funções para adicionar, salvar (atualizar) e excluir anotações.
 * - Gerenciar a data de criação/modificação automática das anotações.
 * - Integrar com `useToast` para fornecer feedback ao usuário sobre as operações de anotação.
 *
 * Este hook NÃO gerencia o histórico de comandos (undo/redo) para as operações de anotação.
 * Cada equipamento pode ter no máximo uma anotação.
 */
"use client";

import { useState, useCallback } from 'react';
import type { Annotation, Equipment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

/**
 * Props para o hook useAnnotationManager.
 * @interface UseAnnotationManagerProps
 * @property {Annotation[]} [initialAnnotations=[]] - Lista inicial opcional de anotações.
 * @property {Equipment[]} equipmentData - Lista completa de equipamentos, usada para buscar nomes para toasts e identificar alvos.
 */
interface UseAnnotationManagerProps {
  initialAnnotations?: Annotation[];
  equipmentData: Equipment[];
}

/**
 * Retorno do hook useAnnotationManager.
 * @interface UseAnnotationManagerReturn
 * @property {Annotation[]} annotations - A lista atual de anotações.
 * @property {(annotations: Annotation[]) => void} setAnnotations - Função para definir diretamente a lista de anotações (usada internamente).
 * @property {boolean} isAnnotationDialogOpen - Indica se o diálogo de anotação está aberto.
 * @property {(isOpen: boolean) => void} setIsAnnotationDialogOpen - Define o estado de abertura do diálogo.
 * @property {Equipment | null} annotationTargetEquipment - O equipamento atualmente alvo para adicionar/editar uma anotação.
 * @property {Annotation | null} editingAnnotation - A anotação atualmente em edição (se houver).
 * @property {(equipment: Equipment | null) => void} handleOpenAnnotationDialog - Abre o diálogo para adicionar/editar anotação para um equipamento.
 * @property {(text: string) => void} handleSaveAnnotation - Salva a anotação (cria uma nova ou atualiza uma existente).
 * @property {(equipmentTag: string) => void} handleDeleteAnnotation - Exclui a anotação de um equipamento.
 * @property {(equipmentTag: string | null) => Annotation | null} getAnnotationForEquipment - Obtém a anotação de um equipamento específico pela sua tag.
 */
export interface UseAnnotationManagerReturn {
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  isAnnotationDialogOpen: boolean;
  setIsAnnotationDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  annotationTargetEquipment: Equipment | null;
  editingAnnotation: Annotation | null;
  handleOpenAnnotationDialog: (equipment: Equipment | null) => void;
  handleSaveAnnotation: (text: string) => void;
  handleDeleteAnnotation: (equipmentTag: string) => void;
  getAnnotationForEquipment: (equipmentTag: string | null) => Annotation | null;
}

/**
 * Hook customizado para gerenciar anotações textuais associadas a equipamentos.
 * Permite adicionar, editar e excluir uma anotação por equipamento.
 * @param {UseAnnotationManagerProps} props As props do hook.
 * @returns {UseAnnotationManagerReturn} Um objeto contendo o estado das anotações e funções para manipulá-las.
 */
export function useAnnotationManager({ initialAnnotations = [], equipmentData }: UseAnnotationManagerProps): UseAnnotationManagerReturn {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [isAnnotationDialogOpen, setIsAnnotationDialogOpen] = useState(false);
  const [annotationTargetEquipment, setAnnotationTargetEquipment] = useState<Equipment | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
  const { toast } = useToast();

  /**
   * Abre o diálogo de anotação para um equipamento específico.
   * Se o equipamento já possui uma anotação, preenche o diálogo para edição.
   * @param {Equipment | null} equipment O equipamento para o qual a anotação será gerenciada.
   */
  const handleOpenAnnotationDialog = useCallback((equipment: Equipment | null) => {
    if (equipment) {
      const existing = annotations.find(a => a.equipmentTag === equipment.tag);
      setEditingAnnotation(existing || null);
      setAnnotationTargetEquipment(equipment);
      setIsAnnotationDialogOpen(true);
    } else {
      toast({ title: "Nenhum Equipamento Selecionado", description: "Por favor, selecione um equipamento para gerenciar sua anotação.", variant: "destructive" });
    }
  }, [annotations, toast]);

  /**
   * Salva uma anotação (nova ou existente).
   * Atualiza a data de criação/modificação (`createdAt`).
   * @param {string} text O texto da anotação a ser salvo.
   */
  const handleSaveAnnotation = useCallback((text: string) => {
    if (!annotationTargetEquipment) return;

    const equipmentName = annotationTargetEquipment.name;
    const currentDate = new Date().toISOString();

    setAnnotations(prevAnnotations => {
      const existingAnnotationIndex = prevAnnotations.findIndex(a => a.equipmentTag === annotationTargetEquipment.tag);
      let newAnnotationsList: Annotation[];
      let toastDescription: string;

      if (existingAnnotationIndex > -1) {
        // Atualiza anotação existente
        newAnnotationsList = [...prevAnnotations];
        newAnnotationsList[existingAnnotationIndex] = {
          ...newAnnotationsList[existingAnnotationIndex],
          text: text,
          createdAt: currentDate, // Atualiza a data de modificação
        };
        toastDescription = `Anotação para ${equipmentName} atualizada.`;
      } else {
        // Adiciona nova anotação
        const newAnnotation: Annotation = {
          equipmentTag: annotationTargetEquipment.tag,
          text,
          createdAt: currentDate,
        };
        newAnnotationsList = [...prevAnnotations, newAnnotation];
        toastDescription = `Anotação para ${equipmentName} adicionada.`;
      }
      toast({ title: "Anotação Salva", description: toastDescription });
      return newAnnotationsList;
    });

    setIsAnnotationDialogOpen(false);
    setEditingAnnotation(null);
    setAnnotationTargetEquipment(null);
  }, [annotationTargetEquipment, toast]);

  /**
   * Exclui a anotação de um equipamento específico.
   * @param {string} equipmentTag A tag do equipamento cuja anotação será excluída.
   */
  const handleDeleteAnnotation = useCallback((equipmentTag: string) => {
    const equipment = equipmentData.find(e => e.tag === equipmentTag);
    if (!equipment) return;

    setAnnotations(prevAnnotations => {
      const newAnnotationsList = prevAnnotations.filter(a => a.equipmentTag !== equipmentTag);
      if (prevAnnotations.length === newAnnotationsList.length) {
        toast({ title: "Nenhuma Anotação", description: `Nenhuma anotação encontrada para ${equipment.name} para excluir.`, variant: "destructive" });
        return prevAnnotations;
      }
      toast({ title: "Anotação Excluída", description: `Anotação para ${equipment.name} foi excluída.` });
      return newAnnotationsList;
    });
    if (annotationTargetEquipment?.tag === equipmentTag) {
        setIsAnnotationDialogOpen(false);
        setEditingAnnotation(null);
        setAnnotationTargetEquipment(null);
    }
  }, [toast, equipmentData, annotationTargetEquipment]);

  /**
   * Obtém a anotação para um equipamento específico.
   * @param {string | null} equipmentTag A tag do equipamento.
   * @returns {Annotation | null} A anotação, ou null se não existir.
   */
  const getAnnotationForEquipment = useCallback((equipmentTag: string | null): Annotation | null => {
    if (!equipmentTag) return null;
    return annotations.find(a => a.equipmentTag === equipmentTag) || null;
  }, [annotations]);

  return {
    annotations,
    setAnnotations,
    isAnnotationDialogOpen,
    setIsAnnotationDialogOpen,
    annotationTargetEquipment,
    editingAnnotation,
    handleOpenAnnotationDialog,
    handleSaveAnnotation,
    handleDeleteAnnotation,
    getAnnotationForEquipment,
  };
}

    