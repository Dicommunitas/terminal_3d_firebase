
"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; // Changed from Input
import { Label } from "@/components/ui/label";
import type { Annotation } from '@/lib/types';

interface AnnotationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (text: string) => void;
  currentAnnotation: Annotation | null;
  equipmentName: string;
}

export function AnnotationDialog({ isOpen, onOpenChange, onConfirm, currentAnnotation, equipmentName }: AnnotationDialogProps) {
  const [annotationText, setAnnotationText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAnnotationText(currentAnnotation?.text || ''); // Pre-fill if editing, otherwise empty
    }
  }, [isOpen, currentAnnotation]);

  const handleConfirm = () => {
    // Basic validation: allow saving empty text if user wants to clear it (or make it required)
    // For now, we allow empty text.
    onConfirm(annotationText); 
    onOpenChange(false); // Close dialog
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{currentAnnotation ? 'Editar Anotação' : 'Adicionar Anotação'}</DialogTitle>
          <DialogDescription>
            {currentAnnotation ? `Editando anotação para` : `Adicionar uma anotação para`} {equipmentName ? `"${equipmentName}"` : "o equipamento selecionado"}.
            A data de criação/modificação será registrada automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 items-start gap-2"> {/* Adjusted for Textarea */}
            <Label htmlFor="annotation-text" className="text-left">
              Texto da Anotação
            </Label>
            <Textarea
              id="annotation-text"
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              placeholder="Digite sua anotação aqui..."
              rows={5} // Allow more space for long text
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirm}>
            Salvar Anotação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
