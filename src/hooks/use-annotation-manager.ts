
/**
 * @fileoverview Custom hook para gerenciar as anotações dos equipamentos.
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

interface UseAnnotationManagerProps {
  initialAnnotations?: Annotation[];
  equipmentData: Equipment[]; 
}

export function useAnnotationManager({ initialAnnotations = [], equipmentData }: UseAnnotationManagerProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [isAnnotationDialogOpen, setIsAnnotationDialogOpen] = useState(false);
  const [annotationTargetEquipment, setAnnotationTargetEquipment] = useState<Equipment | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
  const { toast } = useToast();

  /**
   * Abre o diálogo de anotação para um equipamento específico.
   * Se o equipamento já possui uma anotação, preenche o diálogo para edição.
   * @param equipment O equipamento para o qual a anotação será gerenciada.
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
   * @param text O texto da anotação a ser salvo.
   */
  const handleSaveAnnotation = useCallback((text: string) => {
    if (!annotationTargetEquipment) return;

    const equipmentName = annotationTargetEquipment.name;

    setAnnotations(prevAnnotations => {
      const existingAnnotationIndex = prevAnnotations.findIndex(a => a.equipmentTag === annotationTargetEquipment.tag);
      let newAnnotationsList: Annotation[];
      let toastDescription: string;

      if (existingAnnotationIndex > -1) {
        // Editando anotação existente
        newAnnotationsList = [...prevAnnotations];
        newAnnotationsList[existingAnnotationIndex] = {
          ...newAnnotationsList[existingAnnotationIndex],
          text: text,
          createdAt: new Date().toISOString(), // Atualiza timestamp na edição
        };
        toastDescription = `Anotação para ${equipmentName} atualizada.`;
      } else {
        // Adicionando nova anotação
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
   * @param equipmentTag A tag do equipamento cuja anotação será excluída.
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
   * @param equipmentTag A tag do equipamento.
   * @returns A anotação, ou null se não existir.
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
