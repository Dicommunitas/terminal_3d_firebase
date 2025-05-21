
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AnnotationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (text: string) => void;
  equipmentName: string;
}

export function AnnotationDialog({ isOpen, onOpenChange, onConfirm, equipmentName }: AnnotationDialogProps) {
  const [annotationText, setAnnotationText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAnnotationText(''); // Reset text when dialog opens
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (annotationText.trim()) {
      onConfirm(annotationText.trim());
    }
    onOpenChange(false); // Close dialog
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Anotação</DialogTitle>
          <DialogDescription>
            Adicionar uma anotação para {equipmentName ? `"${equipmentName}"` : "o equipamento selecionado"}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="annotation-text" className="text-right col-span-1">
              Texto
            </Label>
            <Input
              id="annotation-text"
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              className="col-span-3"
              placeholder="Digite sua anotação aqui..."
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirm} disabled={!annotationText.trim()}>
            Salvar Anotação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
