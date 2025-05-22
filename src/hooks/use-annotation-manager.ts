
/**
 * @fileOverview Custom hook para gerenciar as anotações dos equipamentos.
 *
 * Este hook encapsula a lógica para:
 * - Manter a lista de anotações.
 * - Controlar a abertura/fechamento do diálogo de anotação.
 * - Rastrear o equipamento alvo para anotação e a anotação sendo editada.
 * - Manipular a abertura do diálogo para adicionar ou editar uma anotação.
 * - Salvar (adicionar ou atualizar) uma anotação.
 * - Excluir uma anotação.
 * - Obter a anotação para um equipamento específico.
 * - Exibir notificações (toasts) relacionadas às operações de anotação.
 */
"use client";

import { useState, useCallback } from 'react';
import type { Annotation, Equipment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

/**
 * Props para o hook useAnnotationManager.
 * @interface UseAnnotationManagerProps
 * @property {Annotation[]} [initialAnnotations=[]] - Lista inicial de anotações.
 * @property {Equipment[]} equipmentData - Lista completa de equipamentos, usada para buscar nomes para toasts.
 */
interface UseAnnotationManagerProps {
  initialAnnotations?: Annotation[];
  equipmentData: Equipment[]; 
}

/**
 * Retorno do hook useAnnotationManager.
 * @interface UseAnnotationManagerReturn
 * @property {Annotation[]} annotations - A lista atual de anotações.
 * @property {(annotations: Annotation[]) => void} setAnnotations - Função para definir diretamente a lista de anotações (usada pelo histórico de comandos).
 * @property {boolean} isAnnotationDialogOpen - Indica se o diálogo de anotação está aberto.
 * @property {Equipment | null} annotationTargetEquipment - O equipamento alvo para a anotação.
 * @property {Annotation | null} editingAnnotation - A anotação atualmente em edição.
 * @property {(equipment: Equipment | null) => void} handleOpenAnnotationDialog - Abre o diálogo para adicionar/editar anotação.
 * @property {(text: string) => void} handleSaveAnnotation - Salva a anotação (cria ou atualiza).
 * @property {(equipmentTag: string) => void} handleDeleteAnnotation - Exclui a anotação de um equipamento.
 * @property {(equipmentTag: string | null) => Annotation | null} getAnnotationForEquipment - Obtém a anotação de um equipamento.
 * @property {(isOpen: boolean) => void} setIsAnnotationDialogOpen - Define o estado de abertura do diálogo.
 */
export function useAnnotationManager({ initialAnnotations = [], equipmentData }: UseAnnotationManagerProps) {
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
   * Esta operação NÃO é gerenciada pelo histórico de comandos.
   * @param {string} text O texto da anotação a ser salvo.
   */
  const handleSaveAnnotation = useCallback((text: string) => {
    if (!annotationTargetEquipment) return;

    const equipmentName = annotationTargetEquipment.name;

    setAnnotations(prevAnnotations => {
      const existingAnnotationIndex = prevAnnotations.findIndex(a => a.equipmentTag === annotationTargetEquipment.tag);
      let newAnnotationsList: Annotation[];
      let toastDescription: string;

      if (existingAnnotationIndex > -1) {
        newAnnotationsList = [...prevAnnotations];
        newAnnotationsList[existingAnnotationIndex] = {
          ...newAnnotationsList[existingAnnotationIndex],
          text: text,
          createdAt: new Date().toISOString(), 
        };
        toastDescription = `Anotação para ${equipmentName} atualizada.`;
      } else {
        const newAnnotation: Annotation = {
          equipmentTag: annotationTargetEquipment.tag,
          text,
          createdAt: new Date().toISOString(),
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
   * Esta operação NÃO é gerenciada pelo histórico de comandos.
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
    annotationTargetEquipment,
    editingAnnotation,
    handleOpenAnnotationDialog,
    handleSaveAnnotation,
    handleDeleteAnnotation,
    getAnnotationForEquipment,
    setIsAnnotationDialogOpen,
  };
}
