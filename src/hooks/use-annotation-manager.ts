
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

  const handleOpenAnnotationDialog = useCallback((equipment: Equipment | null) => {
    if (equipment) {
      const existing = annotations.find(a => a.equipmentTag === equipment.tag);
      setEditingAnnotation(existing || null);
      setAnnotationTargetEquipment(equipment);
      setIsAnnotationDialogOpen(true);
    } else {
      toast({ title: "No Equipment Selected", description: "Please select an equipment to manage its annotation.", variant: "destructive" });
    }
  }, [annotations, toast]);

  const handleSaveAnnotation = useCallback((text: string) => {
    if (!annotationTargetEquipment) return;

    const equipmentName = annotationTargetEquipment.name;

    setAnnotations(prevAnnotations => {
      const existingAnnotationIndex = prevAnnotations.findIndex(a => a.equipmentTag === annotationTargetEquipment.tag);
      let newAnnotationsList: Annotation[];
      let toastDescription: string;

      if (existingAnnotationIndex > -1) {
        // Editing existing annotation
        newAnnotationsList = [...prevAnnotations];
        newAnnotationsList[existingAnnotationIndex] = {
          ...newAnnotationsList[existingAnnotationIndex],
          text: text,
          createdAt: new Date().toISOString(), // Update timestamp on edit
        };
        toastDescription = `Annotation for ${equipmentName} updated.`;
      } else {
        // Adding new annotation
        const newAnnotation: Annotation = {
          equipmentTag: annotationTargetEquipment.tag,
          text,
          createdAt: new Date().toISOString(),
        };
        newAnnotationsList = [...prevAnnotations, newAnnotation];
        toastDescription = `Annotation for ${equipmentName} added.`;
      }
      toast({ title: "Annotation Saved", description: toastDescription });
      return newAnnotationsList;
    });

    setIsAnnotationDialogOpen(false);
    setEditingAnnotation(null);
    setAnnotationTargetEquipment(null);
  }, [annotationTargetEquipment, toast]);

  const handleDeleteAnnotation = useCallback((equipmentTag: string) => {
    const equipment = equipmentData.find(e => e.tag === equipmentTag);
    if (!equipment) return;

    setAnnotations(prevAnnotations => {
      const newAnnotationsList = prevAnnotations.filter(a => a.equipmentTag !== equipmentTag);
      if (prevAnnotations.length === newAnnotationsList.length) {
        // This case should ideally not be reached if the delete button is only shown when an annotation exists.
        toast({ title: "No Annotation", description: `No annotation found for ${equipment.name} to delete.`, variant: "destructive" });
        return prevAnnotations;
      }
      toast({ title: "Annotation Deleted", description: `Annotation for ${equipment.name} has been deleted.` });
      return newAnnotationsList;
    });
    // Close dialog if it was open for the deleted annotation
    if (annotationTargetEquipment?.tag === equipmentTag) {
        setIsAnnotationDialogOpen(false);
        setEditingAnnotation(null);
        setAnnotationTargetEquipment(null);
    }
  }, [toast, equipmentData, annotationTargetEquipment]);

  const getAnnotationForEquipment = useCallback((equipmentTag: string | null): Annotation | null => {
    if (!equipmentTag) return null;
    return annotations.find(a => a.equipmentTag === equipmentTag) || null;
  }, [annotations]);

  return {
    annotations,
    setAnnotations, // Exposing setAnnotations might be needed if undo/redo for annotations is re-introduced
    isAnnotationDialogOpen,
    annotationTargetEquipment,
    editingAnnotation,
    handleOpenAnnotationDialog,
    handleSaveAnnotation,
    handleDeleteAnnotation,
    getAnnotationForEquipment,
    setIsAnnotationDialogOpen, // Expose to allow closing dialog from parent if needed
  };
}
